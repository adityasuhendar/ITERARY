import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'

export async function GET(request) {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }
    
    // Owner can export all branches data
    if (decoded.role !== 'owner' && decoded.jenis_karyawan !== 'owner') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get filter parameters
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today'
    const paymentMethod = searchParams.get('payment_method') || 'all'
    const sortBy = searchParams.get('sort_by') || 'revenue_desc'
    const format = searchParams.get('format') || 'excel'

    // Get all branch data (no pagination for export)
    const exportData = await getExportData(period, paymentMethod, sortBy)

    if (format === 'pdf') {
      return await generatePDFReport(exportData, period, paymentMethod)
    } else {
      return await generateExcelReport(exportData, period, paymentMethod)
    }

  } catch (error) {
    console.error('Export multi-branch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getExportData(period = 'today', paymentMethod = 'all', sortBy = 'revenue_desc') {
  // Build date condition
  let dateCondition = ''
  let params = []
  
  switch (period) {
    case 'today':
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      dateCondition = 'AND DATE(t.tanggal_transaksi) = ?'
      params.push(today)
      break
    case 'week':
      dateCondition = 'AND DATE(t.tanggal_transaksi) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)'
      break
    case 'month':
      dateCondition = 'AND DATE(t.tanggal_transaksi) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)'
      break
  }
  
  // Build payment method condition
  if (paymentMethod !== 'all') {
    dateCondition += ' AND t.metode_pembayaran = ?'
    params.push(paymentMethod)
  }

  // Build sort condition
  let orderBy = ''
  switch (sortBy) {
    case 'revenue_desc':
      orderBy = 'ORDER BY current_revenue DESC'
      break
    case 'revenue_asc':
      orderBy = 'ORDER BY current_revenue ASC'
      break
    case 'transactions_desc':
      orderBy = 'ORDER BY current_transactions DESC'
      break
    case 'growth_desc':
      orderBy = 'ORDER BY growth_percentage DESC'
      break
    case 'name_asc':
      orderBy = 'ORDER BY c.nama_cabang ASC'
      break
    default:
      orderBy = 'ORDER BY current_revenue DESC'
  }

  // Main query with current period data
  const mainQuery = `
    SELECT 
      c.id_cabang,
      c.nama_cabang,
      c.alamat,
      COUNT(t.id_transaksi) as current_transactions,
      COALESCE(SUM(t.total_keseluruhan), 0) as current_revenue,
      COUNT(DISTINCT t.id_pelanggan) as current_customers,
      COALESCE(AVG(t.total_keseluruhan), 0) as avg_transaction
    FROM cabang c
    LEFT JOIN transaksi t ON c.id_cabang = t.id_cabang ${dateCondition}
    WHERE c.status_aktif = 'aktif'
    GROUP BY c.id_cabang, c.nama_cabang, c.alamat
    ${orderBy}
  `
  
  const branches = await query(mainQuery, params)

  // Get previous period data for growth calculation
  let prevDateCondition = ''
  let prevParams = []
  
  switch (period) {
    case 'today':
      const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      prevDateCondition = 'AND DATE(t.tanggal_transaksi) = ?'
      prevParams.push(yesterday)
      break
    case 'week':
      prevDateCondition = 'AND DATE(t.tanggal_transaksi) >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) AND DATE(t.tanggal_transaksi) < DATE_SUB(CURDATE(), INTERVAL 7 DAY)'
      break
    case 'month':
      prevDateCondition = 'AND DATE(t.tanggal_transaksi) >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) AND DATE(t.tanggal_transaksi) < DATE_SUB(CURDATE(), INTERVAL 30 DAY)'
      break
  }

  if (paymentMethod !== 'all') {
    prevDateCondition += ' AND t.metode_pembayaran = ?'
    prevParams.push(paymentMethod)
  }

  const prevQuery = `
    SELECT 
      c.id_cabang,
      COALESCE(SUM(t.total_keseluruhan), 0) as prev_revenue,
      COUNT(t.id_transaksi) as prev_transactions
    FROM cabang c
    LEFT JOIN transaksi t ON c.id_cabang = t.id_cabang ${prevDateCondition}
    WHERE c.status_aktif = 'aktif'
    GROUP BY c.id_cabang
  `

  const prevData = await query(prevQuery, prevParams)
  const prevDataMap = Object.fromEntries(
    prevData.map(row => [row.id_cabang, row])
  )

  // Get machine data
  const machinesQuery = `
    SELECT 
      id_cabang,
      COUNT(*) as total_machines,
      SUM(CASE WHEN status_mesin = 'tersedia' THEN 1 ELSE 0 END) as available_machines,
      SUM(CASE WHEN status_mesin = 'digunakan' THEN 1 ELSE 0 END) as used_machines,
      SUM(CASE WHEN status_mesin = 'maintenance' THEN 1 ELSE 0 END) as maintenance_machines,
      SUM(CASE WHEN status_mesin = 'rusak' THEN 1 ELSE 0 END) as broken_machines
    FROM mesin_laundry
    WHERE id_cabang IN (${branches.map(() => '?').join(',')})
    GROUP BY id_cabang
  `
  
  const branchIds = branches.map(b => b.id_cabang)
  const machinesData = branchIds.length > 0 ? await query(machinesQuery, branchIds) : []
  const machinesMap = Object.fromEntries(
    machinesData.map(row => [row.id_cabang, row])
  )

  // Get summary data
  const summaryQuery = `
    SELECT 
      COUNT(DISTINCT t.id_cabang) as active_branches,
      COUNT(t.id_transaksi) as total_transactions,
      COALESCE(SUM(t.total_keseluruhan), 0) as total_revenue,
      COUNT(DISTINCT t.id_pelanggan) as total_customers,
      COALESCE(AVG(t.total_keseluruhan), 0) as avg_transaction_all
    FROM transaksi t
    INNER JOIN cabang c ON t.id_cabang = c.id_cabang
    WHERE c.status_aktif = 'aktif' ${dateCondition.replace('AND', 'AND')}
  `

  const summary = await query(summaryQuery, params)
  
  // Calculate growth and add machine data
  const enrichedBranches = branches.map((branch, index) => {
    const prevBranch = prevDataMap[branch.id_cabang] || { prev_revenue: 0, prev_transactions: 0 }
    const machines = machinesMap[branch.id_cabang] || { 
      total_machines: 0, available_machines: 0, used_machines: 0, 
      maintenance_machines: 0, broken_machines: 0 
    }
    
    const growth = prevBranch.prev_revenue > 0 ? 
      ((branch.current_revenue - prevBranch.prev_revenue) / prevBranch.prev_revenue * 100) : 
      (branch.current_revenue > 0 ? 100 : 0)

    return {
      ...branch,
      growth_percentage: Math.round(growth * 10) / 10,
      prev_revenue: prevBranch.prev_revenue,
      prev_transactions: prevBranch.prev_transactions,
      rank: index + 1,
      ...machines,
      efficiency_rate: machines.total_machines > 0 ? 
        Math.round((machines.used_machines / machines.total_machines) * 100) : 0
    }
  })

  return {
    branches: enrichedBranches,
    summary: summary[0],
    period,
    paymentMethod,
    generatedAt: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z'
  }
}

async function generateExcelReport(data, period, paymentMethod) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR', 
      minimumFractionDigits: 0 
    }).format(amount || 0)
  }

  const getPeriodLabel = (period) => {
    switch (period) {
      case 'today': return 'Hari Ini'
      case 'week': return '7 Hari Terakhir'
      case 'month': return '30 Hari Terakhir'
      default: return period
    }
  }

  const getPaymentMethodLabel = (method) => {
    switch (method) {
      case 'tunai': return 'Tunai'
      case 'qris': return 'QRIS'
      default: return 'Semua Metode'
    }
  }

  // Create professional workbook
  const workbook = XLSX.utils.book_new()
  
  // 1. EXECUTIVE SUMMARY SHEET (matching branch structure)
  const executiveSummaryData = [
    ['D\'WASH LAUNDRY - LAPORAN EKSEKUTIF'],
    [''],
    ['📍 INFORMASI LAPORAN'],
    ['Jenis Laporan:', 'Multi-Branch Performance Report'],
    ['Tanggal Laporan:', new Date().toLocaleString('id-ID')],
    [''],
    ['🔍 FILTER YANG DITERAPKAN'],
    ['Periode:', getPeriodLabel(period)],
    ['Metode Pembayaran:', getPaymentMethodLabel(paymentMethod)],
    [''],
    ['💰 RINGKASAN KEUANGAN'],
    ['Total Cabang:', data.branches.length],
    ['Cabang Aktif:', data.branches.length],
    ['Total Transaksi:', `${data.summary.total_transactions} transaksi`],
    ['Total Pendapatan:', formatCurrency(data.summary.total_revenue)],
    ['Pendapatan Rata-rata:', formatCurrency(data.summary.avg_transaction_all || 0)],
    [''],
    ['📊 ANALISIS DISTRIBUSI'],
    ['Pendapatan Tunai:', formatCurrency(data.summary.tunai_revenue || 0)],
    ['Pendapatan QRIS:', formatCurrency(data.summary.qris_revenue || 0)],
    ['Transaksi Tunai:', `${data.summary.tunai_transactions || 0} transaksi`],
    ['Transaksi QRIS:', `${data.summary.qris_transactions || 0} transaksi`],
    [''],
    ['📈 ANALISIS PERFORMA'],
    ['Cabang Terbaik:', data.branches.length > 0 ? data.branches[0].nama_cabang : 'N/A'],
    ['Pendapatan Tertinggi:', data.branches.length > 0 ? formatCurrency(data.branches[0].current_revenue) : 'N/A'],
    ['Efisiensi Rata-rata:', `${Math.round(data.branches.reduce((acc, b) => acc + b.efficiency_rate, 0) / data.branches.length || 0)}%`]
  ]
  
  const executiveSheet = XLSX.utils.aoa_to_sheet(executiveSummaryData)
  
  // Enhanced column widths and formatting (matching branch)
  executiveSheet['!cols'] = [
    { width: 30 },
    { width: 40 }
  ]
  
  // Set title formatting (matching branch)
  if (executiveSheet['A1']) {
    executiveSheet['A1'].s = {
      font: { bold: true, sz: 16, color: { rgb: '2980B9' }},
      alignment: { horizontal: 'center' }
    }
  }
  
  XLSX.utils.book_append_sheet(workbook, executiveSheet, '📊 Executive Summary')
  
  // 2. DETAILED BRANCH PERFORMANCE SHEET (matching branch structure)
  if (data.branches.length > 0) {
    // Add summary row at the top (matching branch)
    const detailedData = [
      ['DETAIL CABANG - D\'WASH LAUNDRY'],
      [`Total: ${data.branches.length} cabang | Pendapatan: ${formatCurrency(data.summary.total_revenue)} | Periode: ${getPeriodLabel(period)}`],
      [''],
      [
        'No.',
        'Rank',
        'Nama Cabang', 
        'Alamat',
        'Pendapatan',
        'Transaksi', 
        'Pelanggan',
        'Rata-rata Transaksi',
        'Growth (%)',
        'Efisiensi Mesin (%)'
      ]
    ]
    
    // Add branch data with row numbers (matching branch)
    data.branches.forEach((branch, index) => {
      detailedData.push([
        index + 1,
        `#${branch.rank}`,
        branch.nama_cabang,
        branch.alamat,
        formatCurrency(branch.current_revenue),
        branch.current_transactions,
        branch.current_customers,
        formatCurrency(branch.avg_transaction),
        `${branch.growth_percentage >= 0 ? '+' : ''}${branch.growth_percentage}%`,
        `${branch.efficiency_rate}%`
      ])
    })
    
    const branchSheet = XLSX.utils.aoa_to_sheet(detailedData)
    
    branchSheet['!cols'] = [
      { width: 6 },   // No
      { width: 8 },   // Rank
      { width: 25 },  // Nama
      { width: 35 },  // Alamat
      { width: 18 },  // Pendapatan
      { width: 12 },  // Transaksi
      { width: 12 },  // Pelanggan
      { width: 18 },  // Rata-rata
      { width: 12 },  // Growth
      { width: 15 }   // Efisiensi
    ]
    
    XLSX.utils.book_append_sheet(workbook, branchSheet, '🏪 Detail Cabang')
  }
  
  // 3. BRANCH COMPARISON ANALYSIS SHEET (matching branch analysis style)
  const comparisonData = [
    ['ANALISIS PERBANDINGAN CABANG'],
    [''],
    ['📊 RINGKASAN PERFORMA'],
    ['Kategori', 'Cabang Terbaik', 'Nilai', 'Cabang Terburuk', 'Nilai', 'Gap Performa'],
    [
      '💰 PENDAPATAN',
      data.branches.length > 0 ? data.branches[0].nama_cabang : 'N/A',
      data.branches.length > 0 ? formatCurrency(data.branches[0].current_revenue) : 'N/A',
      data.branches.length > 0 ? data.branches[data.branches.length - 1].nama_cabang : 'N/A',
      data.branches.length > 0 ? formatCurrency(data.branches[data.branches.length - 1].current_revenue) : 'N/A',
      data.branches.length > 1 ? formatCurrency(data.branches[0].current_revenue - data.branches[data.branches.length - 1].current_revenue) : 'N/A'
    ],
    [
      '📈 TRANSAKSI',
      data.branches.length > 0 ? data.branches.reduce((max, branch) => branch.current_transactions > max.current_transactions ? branch : max).nama_cabang : 'N/A',
      data.branches.length > 0 ? data.branches.reduce((max, branch) => branch.current_transactions > max.current_transactions ? branch : max).current_transactions : 'N/A',
      data.branches.length > 0 ? data.branches.reduce((min, branch) => branch.current_transactions < min.current_transactions ? branch : min).nama_cabang : 'N/A',
      data.branches.length > 0 ? data.branches.reduce((min, branch) => branch.current_transactions < min.current_transactions ? branch : min).current_transactions : 'N/A',
      data.branches.length > 1 ? data.branches.reduce((max, branch) => branch.current_transactions > max.current_transactions ? branch : max).current_transactions - data.branches.reduce((min, branch) => branch.current_transactions < min.current_transactions ? branch : min).current_transactions : 'N/A'
    ],
    [''],
    ['📈 INSIGHT BISNIS'],
    ['Cabang dengan Growth Terbaik:', data.branches.length > 0 ? data.branches.reduce((max, branch) => branch.growth_percentage > max.growth_percentage ? branch : max).nama_cabang : 'N/A'],
    ['Efisiensi Mesin Tertinggi:', data.branches.length > 0 ? data.branches.reduce((max, branch) => branch.efficiency_rate > max.efficiency_rate ? branch : max).nama_cabang : 'N/A'],
    ['Rekomendasi Focus:', data.branches.length > 0 && data.branches[data.branches.length - 1].current_revenue === 0 ? 'Perlu strategi khusus untuk cabang dengan revenue 0' : 'Perluas strategi cabang terbaik ke cabang lain']
  ]
  
  const comparisonSheet = XLSX.utils.aoa_to_sheet(comparisonData)
  
  comparisonSheet['!cols'] = [
    { width: 15 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 20 }
  ]
  
  XLSX.utils.book_append_sheet(workbook, comparisonSheet, '📊 Analisis Perbandingan')

  // Generate Excel buffer
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

  return new Response(excelBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Multi_Branch_Report_${period}_${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })}.xlsx"`
    }
  })
}

async function generatePDFReport(data, period, paymentMethod) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0)
  }

  const getPeriodLabel = (period) => {
    switch (period) {
      case 'today': return 'Hari Ini'
      case 'week': return '7 Hari Terakhir'
      case 'month': return '30 Hari Terakhir'
      default: return period
    }
  }

  const getPaymentMethodLabel = (method) => {
    switch (method) {
      case 'tunai': return 'Tunai'
      case 'qris': return 'QRIS'
      default: return 'Semua Metode'
    }
  }

  // Create PDF document
  const doc = new jsPDF()
  let yPos = 20
  let currentPage = 1

  // SIMPLE AND CLEAN HEADER (matching branch design)
  const drawHeader = () => {
    // Red header background (matching branch)
    doc.setFillColor(220, 53, 69)
    doc.rect(0, 0, 210, 40, 'F')
    
    // Company info - white text
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text("DWASH LAUNDRY", 15, 20)
    
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text("Multi-Branch Performance Report", 15, 30)
    
    // Page info
    doc.setFontSize(10)
    doc.text(`Halaman ${currentPage}`, 170, 20)
    doc.text(new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' }), 170, 30)
  }

  // STATISTICS BOX (matching branch design)
  const drawStats = () => {
    let yPos = 50
    
    // Title
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('RINGKASAN', 15, yPos)
    
    yPos += 10
    
    // Stats box
    doc.setFillColor(245, 245, 245)
    doc.rect(15, yPos, 180, 25, 'F')
    doc.setDrawColor(200, 200, 200)
    doc.rect(15, yPos, 180, 25, 'S')
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(0, 0, 0)
    
    doc.text(`Total Cabang: ${data.branches.length} | Aktif: ${data.branches.length}`, 20, yPos + 8)
    doc.text(`Total Transaksi: ${data.summary.total_transactions}`, 20, yPos + 16)
    doc.text(`Total Pendapatan: ${formatCurrency(data.summary.total_revenue)}`, 20, yPos + 24)
    
    return yPos + 35
  }

  // FILTER INFO
  const drawFilters = (yPos) => {
    const hasFilters = period !== 'today' || paymentMethod !== 'all'
    
    if (hasFilters) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('FILTER DITERAPKAN', 15, yPos)
      yPos += 8
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      
      if (period !== 'today') {
        doc.text(`• Periode: ${getPeriodLabel(period)}`, 20, yPos)
        yPos += 6
      }
      
      if (paymentMethod !== 'all') {
        doc.text(`• Metode Pembayaran: ${getPaymentMethodLabel(paymentMethod)}`, 20, yPos)
        yPos += 6
      }
      
      yPos += 5
    }
    
    return yPos
  }

  drawHeader()
  yPos = drawStats()
  yPos = drawFilters(yPos)

  // BRANCH PERFORMANCE TABLE (matching branch design)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('DAFTAR CABANG', 15, yPos)
  yPos += 15
  
  // Table header with dark background (matching branch)
  doc.setFillColor(52, 58, 64)
  doc.rect(15, yPos, 180, 10, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  
  doc.text('RANK', 20, yPos + 7)
  doc.text('NAMA CABANG', 40, yPos + 7)
  doc.text('PENDAPATAN', 90, yPos + 7)
  doc.text('TRANSAKSI', 130, yPos + 7)
  doc.text('GROWTH', 155, yPos + 7)
  doc.text('EFISIENSI', 175, yPos + 7)
  
  yPos += 12
  
  // Table rows
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  
  data.branches.forEach((branch, index) => {
    // New page check
    if (yPos > 270) {
      doc.setFontSize(8)
      doc.setTextColor(128, 128, 128)
      doc.text("DWash Laundry", 15, 285)
      doc.text(`Halaman ${currentPage}`, 170, 285)
      
      doc.addPage()
      currentPage++
      drawHeader()
      yPos = 50
      
      // Repeat table header
      doc.setFillColor(52, 58, 64)
      doc.rect(15, yPos, 180, 10, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      
      doc.text('RANK', 20, yPos + 7)
      doc.text('NAMA CABANG', 40, yPos + 7)
      doc.text('PENDAPATAN', 90, yPos + 7)
      doc.text('TRANSAKSI', 130, yPos + 7)
      doc.text('GROWTH', 155, yPos + 7)
      doc.text('EFISIENSI', 175, yPos + 7)
      
      yPos += 12
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
    }
    
    // Row background (alternating)
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250)
      doc.rect(15, yPos - 2, 180, 8, 'F')
    }
    
    // Row data
    doc.text(`#${branch.rank}`, 20, yPos + 5)
    
    const branchName = branch.nama_cabang.length > 15 
      ? branch.nama_cabang.substring(0, 13) + '..'
      : branch.nama_cabang
    doc.text(branchName, 40, yPos + 5)
    
    doc.text(formatCurrency(branch.current_revenue), 90, yPos + 5)
    doc.text(branch.current_transactions.toString(), 130, yPos + 5)
    
    // Growth with color (matching branch design)
    if (branch.growth_percentage >= 0) {
      doc.setTextColor(0, 128, 0) // Green
      doc.text(`+${branch.growth_percentage}%`, 155, yPos + 5)
    } else {
      doc.setTextColor(255, 0, 0) // Red
      doc.text(`${branch.growth_percentage}%`, 155, yPos + 5)
    }
    
    doc.setTextColor(0, 0, 0) // Reset to black
    doc.text(`${branch.efficiency_rate}%`, 175, yPos + 5)
    
    yPos += 8
  })
  
  // Final footer (matching branch)
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text("DWash Laundry", 15, 285)
  doc.text(`Halaman ${currentPage}`, 170, 285)

  // Generate PDF buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Multi_Branch_Report_${period}_${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })}.pdf"`
    }
  })
}