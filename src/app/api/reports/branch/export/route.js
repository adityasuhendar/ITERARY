import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { query } from '@/lib/database'
import * as XLSX from 'xlsx'

export async function GET(request) {
  try {
    // Get token from cookies
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      )
    }

    // Verify JWT token
    let decoded
    try {
      decoded = jwt.verify(token.value, process.env.JWT_SECRET)
    } catch (jwtError) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Check if user is owner or investor
    if (decoded.jenis_karyawan !== 'owner' && decoded.jenis_karyawan !== 'investor') {
      return NextResponse.json(
        { error: 'Access denied. Owner or investor role required.' },
        { status: 403 }
      )
    }

    // Get parameters
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branch_id')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const paymentMethod = searchParams.get('paymentMethod')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      )
    }

    // Build dynamic WHERE conditions
    let whereConditions = ['t.id_cabang = ?']
    let queryParams = [branchId]

    // Date filters
    if (dateFrom && dateTo) {
      whereConditions.push('DATE(t.tanggal_transaksi) BETWEEN ? AND ?')
      queryParams.push(dateFrom, dateTo)
    } else if (dateFrom) {
      whereConditions.push('DATE(t.tanggal_transaksi) >= ?')
      queryParams.push(dateFrom)
    } else if (dateTo) {
      whereConditions.push('DATE(t.tanggal_transaksi) <= ?')
      queryParams.push(dateTo)
    } else {
      // Default: last 30 days if no date filter is specified
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      whereConditions.push('DATE(t.tanggal_transaksi) BETWEEN DATE_SUB(?, INTERVAL 29 DAY) AND ?')
      queryParams.push(today, today)
    }

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      whereConditions.push('t.metode_pembayaran = ?')
      queryParams.push(paymentMethod)
    }

    // Status filter
    if (status && status !== 'all') {
      whereConditions.push('t.status_transaksi = ?')
      queryParams.push(status)
    }
    // No default status filter - show all transactions when no status is specified

    // Search filter
    if (search) {
      whereConditions.push('(t.kode_transaksi LIKE ? OR p.nama_pelanggan LIKE ?)')
      queryParams.push(`%${search}%`, `%${search}%`)
    }

    const whereClause = whereConditions.join(' AND ')

    // Build separate WHERE clause for stats (only selesai)
    let statsWhereConditions = ['t.id_cabang = ?']
    let statsQueryParams = [branchId]

    // Copy date filters
    if (dateFrom && dateTo) {
      statsWhereConditions.push('DATE(t.tanggal_transaksi) BETWEEN ? AND ?')
      statsQueryParams.push(dateFrom, dateTo)
    } else if (dateFrom) {
      statsWhereConditions.push('DATE(t.tanggal_transaksi) >= ?')
      statsQueryParams.push(dateFrom)
    } else if (dateTo) {
      statsWhereConditions.push('DATE(t.tanggal_transaksi) <= ?')
      statsQueryParams.push(dateTo)
    } else {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      statsWhereConditions.push('DATE(t.tanggal_transaksi) BETWEEN DATE_SUB(?, INTERVAL 29 DAY) AND ?')
      statsQueryParams.push(today, today)
    }

    // Copy payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      statsWhereConditions.push('t.metode_pembayaran = ?')
      statsQueryParams.push(paymentMethod)
    }

    // FORCE selesai for stats
    statsWhereConditions.push("t.status_transaksi = 'selesai'")

    const statsWhereClause = statsWhereConditions.join(' AND ')

    // Get today for default date fallback
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

    // Fetch branch data
    const [branchInfo, branchStats, transactionData, feeKasirData, expensesData, revenueBreakdown] = await Promise.all([
      // Branch info
      query('SELECT * FROM cabang WHERE id_cabang = ?', [branchId]),

      // Branch statistics - ONLY SELESAI
      query(`
        SELECT
          COUNT(*) as total_transactions,
          COALESCE(SUM(t.total_keseluruhan), 0) as total_revenue,
          COUNT(DISTINCT t.id_pelanggan) as unique_customers,
          AVG(t.total_keseluruhan) as avg_transaction,
          COUNT(CASE WHEN t.metode_pembayaran = 'tunai' THEN 1 END) as tunai_count,
          COUNT(CASE WHEN t.metode_pembayaran = 'qris' THEN 1 END) as qris_count,
          COALESCE(SUM(CASE WHEN t.metode_pembayaran = 'tunai' THEN t.total_keseluruhan END), 0) as tunai_revenue,
          COALESCE(SUM(CASE WHEN t.metode_pembayaran = 'qris' THEN t.total_keseluruhan END), 0) as qris_revenue
        FROM transaksi t
        LEFT JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
        WHERE ${statsWhereClause}
      `, statsQueryParams),

      // Transaction details - follow user filter (could be all statuses)
      query(`
        SELECT
          t.id_transaksi,
          t.kode_transaksi as 'Kode Transaksi',
          DATE_FORMAT(t.tanggal_transaksi, '%d/%m/%Y %H:%i:%s') as 'Tanggal & Waktu',
          p.nama_pelanggan as 'Nama Pelanggan',
          t.metode_pembayaran as 'Metode Pembayaran',
          t.total_layanan as 'Total Layanan',
          t.total_produk as 'Total Produk',
          t.total_keseluruhan as 'Total Keseluruhan',
          t.status_transaksi as 'Status'
        FROM transaksi t
        LEFT JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
        WHERE ${whereClause}
        ORDER BY t.tanggal_transaksi DESC
      `, queryParams),

      // Fee kasir data (CKL services) - ONLY SELESAI transactions
      query(`
        SELECT
          COALESCE(SUM(dtl.fee_kasir), 0) as fee_kasir,
          COUNT(DISTINCT CASE WHEN dtl.id_jenis_layanan = 4 AND dtl.fee_kasir > 0 THEN dtl.id_detail_layanan END) as ckl_count
        FROM detail_transaksi_layanan dtl
        JOIN transaksi t ON dtl.id_transaksi = t.id_transaksi
        LEFT JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
        WHERE ${statsWhereClause}
        AND dtl.fee_kasir > 0
      `, statsQueryParams),

      // Expenses data for the period - Individual items with dates
      query(`
        SELECT
          kategori,
          jumlah,
          DATE_FORMAT(tanggal, '%d/%m/%Y') as tanggal_formatted,
          keterangan
        FROM pengeluaran
        WHERE id_cabang = ?
        AND DATE(tanggal) BETWEEN ? AND ?
        ORDER BY tanggal DESC, kategori
      `, [branchId, dateFrom || today, dateTo || today]),

      // Revenue breakdown (layanan vs produk) for period
      query(`
        SELECT
          COALESCE(SUM(total_layanan), 0) as pendapatan_layanan,
          COALESCE(SUM(total_produk), 0) as pendapatan_produk
        FROM transaksi
        WHERE id_cabang = ?
        AND DATE(tanggal_transaksi) BETWEEN ? AND ?
        AND status_transaksi = 'selesai'
      `, [branchId, dateFrom || today, dateTo || today])
    ])

    if (branchInfo.length === 0) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      )
    }

    const branch = branchInfo[0]
    const stats = branchStats[0]

    // Calculate fee kasir and expenses
    const feeKasir = parseFloat(feeKasirData[0]?.fee_kasir || 0)
    const cklCount = parseInt(feeKasirData[0]?.ckl_count || 0)

    // Calculate total expenses
    const totalExpenses = expensesData.reduce((sum, exp) => sum + parseFloat(exp.jumlah), 0)

    // Calculate net revenue (Kotor - Fee - Expenses)
    const pendapatanBersih = stats.total_revenue - feeKasir - totalExpenses
    const tunaiBersih = stats.tunai_revenue - feeKasir - totalExpenses
    const qrisBersih = stats.qris_revenue // QRIS tidak kena potongan

    // Revenue breakdown
    const pendapatanLayanan = parseFloat(revenueBreakdown[0]?.pendapatan_layanan || 0)
    const pendapatanProduk = parseFloat(revenueBreakdown[0]?.pendapatan_produk || 0)

    // OPTIMIZED: Batch queries instead of N+1 problem
    if (transactionData.length > 0) {
      const transactionIds = transactionData.map(t => t.id_transaksi)
      const placeholders = transactionIds.map(() => '?').join(',')

      // Batch get ALL services for all transactions
      const allServices = await query(`
        SELECT
          dtl.id_transaksi,
          dtl.quantity,
          dtl.harga_satuan,
          dtl.subtotal,
          jl.nama_layanan
        FROM detail_transaksi_layanan dtl
        JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
        WHERE dtl.id_transaksi IN (${placeholders})
        ORDER BY dtl.id_transaksi, dtl.id_detail_layanan
      `, transactionIds)

      // Batch get ALL products for all transactions
      const allProducts = await query(`
        SELECT
          dtp.id_transaksi,
          dtp.quantity,
          dtp.harga_satuan,
          dtp.subtotal,
          pt.nama_produk,
          pt.satuan,
          dtp.is_free as is_free_promo,
          dtp.free_quantity
        FROM detail_transaksi_produk dtp
        JOIN produk_tambahan pt ON dtp.id_produk = pt.id_produk
        WHERE dtp.id_transaksi IN (${placeholders})
        ORDER BY dtp.id_transaksi, dtp.id_detail_produk
      `, transactionIds)

      // Group services and products by transaction ID
      const servicesByTransaction = {}
      const productsByTransaction = {}

      allServices.forEach(service => {
        if (!servicesByTransaction[service.id_transaksi]) {
          servicesByTransaction[service.id_transaksi] = []
        }
        servicesByTransaction[service.id_transaksi].push(service)
      })

      allProducts.forEach(product => {
        if (!productsByTransaction[product.id_transaksi]) {
          productsByTransaction[product.id_transaksi] = []
        }
        productsByTransaction[product.id_transaksi].push(product)
      })

      // Assign grouped data to transactions
      transactionData.forEach(transaction => {
        transaction.services = servicesByTransaction[transaction.id_transaksi] || []
        transaction.products = productsByTransaction[transaction.id_transaksi] || []
      })
    }

    // Create professional workbook
    const workbook = XLSX.utils.book_new()
    
    // Helper function to format currency
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0 
      }).format(amount)
    }

    // Helper function to format services breakdown
    const formatServicesBreakdown = (services) => {
      if (!services || services.length === 0) return '-'
      
      const grouped = {}
      services.forEach(service => {
        const isFree = parseFloat(service.subtotal) === 0
        const serviceName = service.nama_layanan
        
        if (!grouped[serviceName]) {
          grouped[serviceName] = { free: 0, paid: 0 }
        }
        
        if (isFree) {
          grouped[serviceName].free += parseInt(service.quantity) || 1
        } else {
          grouped[serviceName].paid += parseInt(service.quantity) || 1
        }
      })
      
      return Object.entries(grouped).map(([name, counts]) => {
        if (counts.free > 0 && counts.paid > 0) {
          return `${counts.paid + counts.free}x ${name} (${counts.free} gratis)`
        } else if (counts.free > 0) {
          return `${counts.free}x ${name} (gratis)`
        } else {
          return `${counts.paid}x ${name}`
        }
      }).join(', ')
    }

    // Helper function to format products breakdown
    const formatProductsBreakdown = (products) => {
      if (!products || products.length === 0) return '-'
      
      return products.map(product => {
        // UPDATED: Read free data directly from transaction, no recalculation
        const totalQty = parseInt(product.quantity) || 0
        const freeQty = parseInt(product.free_quantity) || 0
        const paidQty = totalQty - freeQty
        
        if (freeQty > 0 && paidQty > 0) {
          return `${totalQty}${product.satuan} ${product.nama_produk} (${freeQty} gratis promo)`
        } else if (freeQty > 0) {
          return `${freeQty}${product.satuan} ${product.nama_produk} (gratis promo)`
        } else {
          return `${paidQty}${product.satuan} ${product.nama_produk}`
        }
      }).join(', ')
    }

    // 1. EXECUTIVE SUMMARY SHEET
    const executiveSummaryData = [
      ['DWASH LAUNDRY - LAPORAN EKSEKUTIF'],
      [''],
      ['📍 INFORMASI CABANG'],
      ['Nama Cabang:', branch.nama_cabang],
      ['ID Cabang:', branchId],
      ['Alamat:', branch.alamat || 'Tidak ada data'],
      ['Tanggal Laporan:', new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })],
      [''],
      ['🔍 FILTER YANG DITERAPKAN'],
    ]
    
    // Add applied filters
    if (dateFrom && dateTo) {
      executiveSummaryData.push(['Periode:', `${dateFrom} sampai ${dateTo}`])
    } else if (dateFrom) {
      executiveSummaryData.push(['Dari Tanggal:', dateFrom])
    } else if (dateTo) {
      executiveSummaryData.push(['Sampai Tanggal:', dateTo])
    } else {
      executiveSummaryData.push(['Periode:', 'Default - 30 hari terakhir'])
    }
    
    if (paymentMethod && paymentMethod !== 'all') {
      executiveSummaryData.push(['Metode Pembayaran:', paymentMethod.toUpperCase()])
    }
    
    if (status && status !== 'all') {
      executiveSummaryData.push(['Status Transaksi:', status.toUpperCase()])
    }
    
    if (search) {
      executiveSummaryData.push(['Kata Kunci Pencarian:', `"${search}"`])
    }

    executiveSummaryData.push([''])
    executiveSummaryData.push(['Catatan: Statistik ringkasan hanya menghitung transaksi yang selesai'])

    executiveSummaryData.push(
      [''],
      ['💰 RINGKASAN KEUANGAN'],
      ['Total Transaksi:', `${stats.total_transactions} transaksi`],
      ['Total Pelanggan:', `${stats.unique_customers} pelanggan`],
      [''],
      ['📊 PENDAPATAN KOTOR'],
      ['Total Pendapatan:', formatCurrency(stats.total_revenue)],
      ['  • Layanan:', formatCurrency(pendapatanLayanan)],
      ['  • Produk:', formatCurrency(pendapatanProduk)],
      [''],
      ['💵 BREAKDOWN PEMBAYARAN'],
      ['TUNAI:', `${formatCurrency(stats.tunai_revenue || 0)} (${stats.tunai_count || 0} transaksi)`],
      ['QRIS:', `${formatCurrency(stats.qris_revenue || 0)} (${stats.qris_count || 0} transaksi)`],
      [''],
      ['📉 PENGELUARAN'],
      ['Fee Jasa Lipat (CKL):', `${formatCurrency(feeKasir)} (${cklCount} layanan CKL)`],
      ['Pengeluaran Operasional:', formatCurrency(totalExpenses)],
    )

    // Add expense details if exists
    if (expensesData.length > 0) {
      expensesData.forEach((expense) => {
        executiveSummaryData.push([
          `  • ${expense.kategori} (${expense.tanggal_formatted}):`,
          formatCurrency(parseFloat(expense.jumlah))
        ])
      })
    }

    executiveSummaryData.push(
      ['Total Potongan:', formatCurrency(feeKasir + totalExpenses)],
      [''],
      ['✅ PENDAPATAN BERSIH'],
      ['Pendapatan Bersih:', formatCurrency(pendapatanBersih)],
      ['Tunai Bersih:', formatCurrency(tunaiBersih)],
      ['QRIS Bersih:', formatCurrency(qrisBersih)],
      [''],
      ['📊 RATA-RATA'],
      ['Pendapatan Rata-rata per Transaksi:', formatCurrency(stats.avg_transaction || 0)],
      [''],
      ['📊 BREAKDOWN METODE PEMBAYARAN'],
      ['💰 TUNAI'],
      ['  • Jumlah Transaksi:', `${stats.tunai_count} transaksi`],
      ['  • Total Pendapatan:', formatCurrency(stats.tunai_revenue)],
      ['  • Persentase:', `${((stats.tunai_count / stats.total_transactions) * 100).toFixed(1)}%`],
      [''],
      ['📱 QRIS'],
      ['  • Jumlah Transaksi:', `${stats.qris_count} transaksi`],
      ['  • Total Pendapatan:', formatCurrency(stats.qris_revenue)],
      ['  • Persentase:', `${((stats.qris_count / stats.total_transactions) * 100).toFixed(1)}%`],
      [''],
      ['📈 ANALISIS PERFORMA'],
      ['Efisiensi Metode Digital:', `${((stats.qris_count / stats.total_transactions) * 100).toFixed(1)}%`],
      ['Nilai Transaksi Tertinggi:', formatCurrency(Math.max(...transactionData.map(t => t['Total Keseluruhan'])))],
      ['Nilai Transaksi Terendah:', formatCurrency(Math.min(...transactionData.map(t => t['Total Keseluruhan'])))]
    )
    
    const executiveSheet = XLSX.utils.aoa_to_sheet(executiveSummaryData)
    
    // Enhanced column widths and formatting
    executiveSheet['!cols'] = [
      { width: 30 },
      { width: 40 }
    ]
    
    // Set title formatting
    if (executiveSheet['A1']) {
      executiveSheet['A1'].s = {
        font: { bold: true, sz: 16, color: { rgb: '2980B9' }},
        alignment: { horizontal: 'center' }
      }
    }
    
    XLSX.utils.book_append_sheet(workbook, executiveSheet, '📊 Executive Summary')
    
    // 2. DETAILED TRANSACTIONS SHEET
    if (transactionData.length > 0) {
      const detailedData = [
        ['DETAIL TRANSAKSI - DWASH LAUNDRY'],
        [''],
        [
          'No.',
          'Kode Transaksi',
          'Tanggal & Waktu',
          'Nama Pelanggan',
          'Layanan',
          'Produk',
          'Metode Pembayaran',
          'Total Layanan',
          'Total Produk',
          'Total Keseluruhan',
          'Status'
        ]
      ]
      
      // Add transaction data with row numbers
      transactionData.forEach((transaction, index) => {
        detailedData.push([
          index + 1,
          transaction['Kode Transaksi'],
          transaction['Tanggal & Waktu'],
          transaction['Nama Pelanggan'],
          formatServicesBreakdown(transaction.services),
          formatProductsBreakdown(transaction.products),
          transaction['Metode Pembayaran'] === 'tunai' ? 'TUNAI' : 'QRIS',
          formatCurrency(transaction['Total Layanan'] || 0),
          formatCurrency(transaction['Total Produk'] || 0),
          formatCurrency(transaction['Total Keseluruhan']),
          transaction['Status'].toUpperCase()
        ])
      })
      
      const transactionSheet = XLSX.utils.aoa_to_sheet(detailedData)
      
      // Enhanced column widths
      transactionSheet['!cols'] = [
        { width: 6 },   // No.
        { width: 18 },  // Kode
        { width: 20 },  // Tanggal
        { width: 25 },  // Pelanggan
        { width: 30 },  // Layanan
        { width: 30 },  // Produk
        { width: 12 },  // Metode
        { width: 15 },  // Total Layanan
        { width: 15 },  // Total Produk
        { width: 18 },  // Total
        { width: 12 }   // Status
      ]
      
      XLSX.utils.book_append_sheet(workbook, transactionSheet, '💳 Detail Transaksi')
    }
    
    // 3. PAYMENT METHOD ANALYSIS SHEET
    const paymentAnalysisData = [
      ['ANALISIS METODE PEMBAYARAN'],
      [''],
      ['📊 RINGKASAN METODE PEMBAYARAN'],
      ['Metode', 'Jumlah Transaksi', 'Total Pendapatan', 'Persentase Transaksi', 'Persentase Pendapatan', 'Rata-rata per Transaksi'],
      [
        '💰 TUNAI',
        stats.tunai_count,
        formatCurrency(stats.tunai_revenue),
        `${((stats.tunai_count / stats.total_transactions) * 100).toFixed(1)}%`,
        `${((stats.tunai_revenue / stats.total_revenue) * 100).toFixed(1)}%`,
        formatCurrency(stats.tunai_count > 0 ? stats.tunai_revenue / stats.tunai_count : 0)
      ],
      [
        '📱 QRIS',
        stats.qris_count,
        formatCurrency(stats.qris_revenue),
        `${((stats.qris_count / stats.total_transactions) * 100).toFixed(1)}%`,
        `${((stats.qris_revenue / stats.total_revenue) * 100).toFixed(1)}%`,
        formatCurrency(stats.qris_count > 0 ? stats.qris_revenue / stats.qris_count : 0)
      ],
      [''],
      ['📈 INSIGHT BISNIS'],
      ['Preferensi Pelanggan:', stats.tunai_count > stats.qris_count ? 'TUNAI lebih disukai' : 'QRIS lebih disukai'],
      ['Digitalisasi Pembayaran:', `${((stats.qris_count / stats.total_transactions) * 100).toFixed(1)}% transaksi menggunakan digital`],
      ['Efisiensi Operasional:', stats.qris_count > stats.tunai_count ? 'Tinggi - mayoritas digital' : 'Perlu ditingkatkan']
    ]
    
    const paymentSheet = XLSX.utils.aoa_to_sheet(paymentAnalysisData)
    
    paymentSheet['!cols'] = [
      { width: 15 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 20 }
    ]
    
    XLSX.utils.book_append_sheet(workbook, paymentSheet, '💳 Analisis Pembayaran')

    // 4. EXPENSES DETAIL SHEET
    if (expensesData.length > 0) {
      const expensesSheetData = [
        ['DETAIL PENGELUARAN OPERASIONAL'],
        [''],
        ['📋 DAFTAR PENGELUARAN'],
        ['No.', 'Tanggal', 'Kategori', 'Jumlah', 'Keterangan']
      ]

      expensesData.forEach((expense, index) => {
        expensesSheetData.push([
          index + 1,
          expense.tanggal_formatted,
          expense.kategori,
          formatCurrency(parseFloat(expense.jumlah)),
          expense.keterangan || '-'
        ])
      })

      expensesSheetData.push(
        [''],
        [''],
        ['TOTAL PENGELUARAN:', '', '', formatCurrency(totalExpenses), '']
      )

      const expensesSheet = XLSX.utils.aoa_to_sheet(expensesSheetData)

      expensesSheet['!cols'] = [
        { width: 6 },   // No.
        { width: 15 },  // Tanggal
        { width: 20 },  // Kategori
        { width: 18 },  // Jumlah
        { width: 40 }   // Keterangan
      ]

      XLSX.utils.book_append_sheet(workbook, expensesSheet, '💸 Detail Pengeluaran')
    }

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Build filename with filters
    let filename = `Laporan_Transaksi_${branch.nama_cabang.replace(/\s+/g, '_')}`

    // Add date range if provided
    if (dateFrom && dateTo) {
      if (dateFrom === dateTo) {
        filename += `_${dateFrom}`
      } else {
        filename += `_${dateFrom}_sd_${dateTo}`
      }
    } else if (dateFrom) {
      filename += `_dari_${dateFrom}`
    } else if (dateTo) {
      filename += `_sampai_${dateTo}`
    }

    // Add payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      filename += `_${paymentMethod}`
    }

    // Add status filter
    if (status && status !== 'all') {
      filename += `_${status}`
    }

    // Add search filter
    if (search) {
      filename += `_search_${search.replace(/\s+/g, '_')}`
    }

    filename += '.xlsx'

    return new Response(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('Branch Excel export error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}