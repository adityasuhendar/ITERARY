import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'

export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || (decoded.jenis_karyawan !== 'owner' && decoded.jenis_karyawan !== 'super_admin')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const branchId = searchParams.get('branch_id')
    const date = searchParams.get('date')
    const format = searchParams.get('format') || 'excel'
    const viewMode = searchParams.get('view_mode') || 'daily'
    
    // Default to current month if not specified
    const currentDate = new Date()
    const targetMonth = month || currentDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(0, 7)
    
    let whereConditions = []
    let queryParams = []
    
    // Date filter - prioritize specific date over month
    if (viewMode === 'daily' && date) {
      whereConditions.push('DATE(a.tanggal) = ?')
      queryParams.push(date)
    } else {
      whereConditions.push('DATE_FORMAT(a.tanggal, "%Y-%m") = ?')
      queryParams.push(targetMonth)
    }
    
    if (branchId) {
      whereConditions.push('a.id_cabang = ?')
      queryParams.push(branchId)
    }

    // Get attendance data
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    const attendanceData = await query(`
      SELECT 
        a.*,
        k.nama_karyawan as nama_akun_shift,
        c.nama_cabang,
        DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal_formatted,
        DATE_FORMAT(a.waktu_mulai, '%H:%i') as jam_mulai,
        DATE_FORMAT(a.waktu_selesai, '%H:%i') as jam_selesai,
        DATE_FORMAT(a.tanggal, '%d/%m/%Y') as tanggal_display
      FROM attendance_harian a
      LEFT JOIN karyawan k ON a.id_karyawan_akun = k.id_karyawan
      LEFT JOIN cabang c ON a.id_cabang = c.id_cabang
      ${whereClause}
      ORDER BY a.tanggal DESC, a.shift ASC
    `, queryParams)

    // Get summary data
    const summaryData = await query(`
      SELECT 
        a.nama_pekerja,
        c.nama_cabang,
        COUNT(*) as total_hari,
        SUM(CASE WHEN a.shift = 'pagi' THEN 1 ELSE 0 END) as shift_pagi,
        SUM(CASE WHEN a.shift = 'malam' THEN 1 ELSE 0 END) as shift_malam
      FROM attendance_harian a
      LEFT JOIN cabang c ON a.id_cabang = c.id_cabang
      ${whereClause}
      GROUP BY a.nama_pekerja, c.nama_cabang
      ORDER BY total_hari DESC
    `, queryParams)

    if (format === 'excel') {
      return await generateExcelReport(attendanceData, summaryData, { month: targetMonth, date, viewMode, branchId })
    } else if (format === 'pdf') {
      return await generatePDFReport(attendanceData, summaryData, { month: targetMonth, date, viewMode, branchId })
    } else {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
    }

  } catch (error) {
    console.error('Attendance export error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

async function generateExcelReport(attendanceData, summaryData, filters) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })
  }

  const getPeriodLabel = () => {
    if (filters.viewMode === 'daily' && filters.date) {
      return `${formatDate(filters.date)}`
    }
    
    // Convert YYYY-MM to Indonesian month format
    if (filters.month && filters.month.includes('-')) {
      const [year, month] = filters.month.split('-')
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ]
      const monthIndex = parseInt(month) - 1
      return `${monthNames[monthIndex]} ${year}`
    }
    
    return `${filters.month}`
  }

  // Create workbook
  const workbook = XLSX.utils.book_new()
  
  // 1. SUMMARY SHEET (Professional, Clean)
  const summaryData_clean = [
    ['D\'WASH LAUNDRY'],
    ['LAPORAN KEHADIRAN KARYAWAN'],
    [''],
    ['INFORMASI LAPORAN'],
    ['Periode', getPeriodLabel()],
    ['Mode Tampilan', filters.viewMode === 'daily' ? 'Harian' : 'Bulanan'],
    ['Tanggal Dibuat', new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })],
    [''],
    ['RINGKASAN KEHADIRAN'],
    ['Total Pekerja', summaryData.length],
    ['Total Kehadiran', attendanceData.length],
    ['Shift Pagi', summaryData.reduce((sum, item) => sum + parseInt(item.shift_pagi || 0), 0)],
    ['Shift Malam', summaryData.reduce((sum, item) => sum + parseInt(item.shift_malam || 0), 0)],
    [''],
    ['ANALISIS'],
    ['Rata-rata Kehadiran per Pekerja', summaryData.length > 0 ? Math.round(summaryData.reduce((sum, item) => sum + parseInt(item.total_hari || 0), 0) / summaryData.length) : 0],
    ['Tingkat Kehadiran', summaryData.length > 0 ? `${Math.round((attendanceData.length / (summaryData.length * (filters.viewMode === 'daily' ? 1 : 30))) * 100)}%` : '0%']
  ]
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData_clean)
  
  // Professional column widths
  summarySheet['!cols'] = [
    { width: 25 },
    { width: 30 }
  ]
  
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'RINGKASAN')
  
  // 2. SUMMARY PER PEKERJA SHEET
  if (summaryData.length > 0) {
    const summarySheetData = [
      ['RINGKASAN KEHADIRAN PER PEKERJA'],
      [`Periode: ${getPeriodLabel()} | Total: ${summaryData.length} pekerja`],
      [''],
      [
        'NO',
        'NAMA PEKERJA', 
        'CABANG',
        'TOTAL HARI',
        'SHIFT PAGI', 
        'SHIFT MALAM',
        'PERSENTASE'
      ]
    ]
    
    // Group data by branch for better organization
    const groupedData = summaryData.reduce((groups, item) => {
      const branch = item.nama_cabang || 'Tidak Ada Cabang'
      if (!groups[branch]) {
        groups[branch] = []
      }
      groups[branch].push(item)
      return groups
    }, {})

    // Add summary data with professional branch grouping
    let rowNumber = 1
    Object.keys(groupedData).forEach(branchName => {
      const branchData = groupedData[branchName]
      
      // Add branch header
      summarySheetData.push([
        '',
        `=== CABANG: ${branchName.toUpperCase()} (${branchData.length} pekerja) ===`,
        '',
        '',
        '',
        '',
        ''
      ])
      
      branchData.forEach((item, branchIndex) => {
        const maxDays = filters.viewMode === 'daily' ? 1 : 30
        const percentage = `${Math.round((item.total_hari / maxDays) * 100)}%`
          
        summarySheetData.push([
          rowNumber,
          item.nama_pekerja || '-',
          '-', // Branch info is in header now
          item.total_hari || 0,
          item.shift_pagi || 0,
          item.shift_malam || 0,
          percentage
        ])
        rowNumber++
      })
      
      // Add spacing between branches
      summarySheetData.push(['', '', '', '', '', '', ''])
    })
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summarySheetData)
    
    // Professional column widths
    summarySheet['!cols'] = [
      { width: 8 },   // No
      { width: 30 },  // Nama
      { width: 25 },  // Cabang
      { width: 15 },  // Total
      { width: 15 },  // Pagi
      { width: 15 },  // Malam
      { width: 15 }   // Persentase
    ]
    
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'DATA PEKERJA')
  }
  
  // 3. DETAIL KEHADIRAN SHEET
  if (attendanceData.length > 0) {
    const detailData = [
      ['DETAIL KEHADIRAN HARIAN'],
      [`Periode: ${getPeriodLabel()} | Total: ${attendanceData.length} kehadiran`],
      [''],
      [
        'NO',
        'TANGGAL',
        'NAMA PEKERJA', 
        'CABANG',
        'SHIFT',
        'JAM MULAI', 
        'JAM SELESAI',
        'STATUS'
      ]
    ]
    
    // Add attendance data with proper formatting
    attendanceData.forEach((item, index) => {
      detailData.push([
        index + 1,
        item.tanggal_display || formatDate(item.tanggal),
        item.nama_pekerja || '-',
        item.nama_cabang || '-',
        item.shift ? item.shift.toUpperCase() : '-',
        item.jam_mulai || '-',
        item.jam_selesai || '-',
        item.status === 'aktif' ? 'HADIR' : 'SELESAI'
      ])
    })
    
    const detailSheet = XLSX.utils.aoa_to_sheet(detailData)
    
    // Professional column widths
    detailSheet['!cols'] = [
      { width: 8 },   // No
      { width: 15 },  // Tanggal
      { width: 30 },  // Nama
      { width: 25 },  // Cabang
      { width: 12 },  // Shift
      { width: 12 },  // Mulai
      { width: 12 },  // Selesai
      { width: 12 }   // Status
    ]
    
    XLSX.utils.book_append_sheet(workbook, detailSheet, 'DETAIL KEHADIRAN')
  }

  // Generate Excel buffer
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

  return new Response(excelBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Laporan_Kehadiran_${filters.viewMode === 'daily' ? filters.date : filters.month}.xlsx"`
    }
  })
}

async function generatePDFReport(attendanceData, summaryData, filters) {
  try {
    const doc = new jsPDF()
    
    // Helper functions
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })
    }

    const formatDateOnly = (dateString) => {
      return new Date(dateString).toLocaleDateString('id-ID', { 
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }

    const getPeriodLabel = () => {
      if (filters.viewMode === 'daily' && filters.date) {
        return formatDateOnly(filters.date)
      }
      
      if (filters.month && filters.month.includes('-')) {
        const [year, month] = filters.month.split('-')
        const monthNames = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ]
        const monthIndex = parseInt(month) - 1
        return `${monthNames[monthIndex]} ${year}`
      }
      
      return `${filters.month}`
    }

    let yPosition = 25

    // Professional Header with Red Accent
    doc.setFillColor(220, 38, 38) // True red (bg-red-600)
    doc.rect(0, 0, 210, 35, 'F')
    
    doc.setTextColor(255, 255, 255) // White text
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text("DWASH LAUNDRY", 105, 15, { align: 'center' })
    
    doc.setFontSize(13)
    doc.text('LAPORAN KEHADIRAN KARYAWAN', 105, 25, { align: 'center' })
    
    // Reset text color
    doc.setTextColor(0, 0, 0)
    yPosition = 45

    // Report Info Box
    doc.setFillColor(248, 249, 250)
    doc.rect(15, yPosition - 5, 180, 25, 'F')
    doc.setDrawColor(200, 200, 200)
    doc.rect(15, yPosition - 5, 180, 25)
    
    doc.setFontSize(11)
    doc.text(`Periode: ${getPeriodLabel()}`, 20, yPosition + 5)
    doc.text(`Total Kehadiran: ${attendanceData.length}`, 20, yPosition + 15)
    doc.text(`Dibuat: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`, 110, yPosition + 5)
    doc.text(`Total Cabang: ${Object.keys(attendanceData.reduce((acc, item) => { acc[item.nama_cabang] = true; return acc }, {})).length}`, 110, yPosition + 15)
    
    yPosition += 35

    // Group data by branch
    const groupedAttendance = attendanceData.reduce((groups, item) => {
      const branch = item.nama_cabang || 'Tidak Ada Cabang'
      if (!groups[branch]) {
        groups[branch] = []
      }
      groups[branch].push(item)
      return groups
    }, {})

    // Process each branch with modern card-style design
    Object.keys(groupedAttendance).forEach((branchName, branchIndex) => {
      const branchAttendance = groupedAttendance[branchName]
      
      // Check if new page needed for branch
      if (yPosition > 220) {
        doc.addPage()
        yPosition = 25
      }

      // Branch Card Header
      doc.setFillColor(239, 68, 68) // Lighter red (bg-red-500)
      doc.roundedRect(15, yPosition, 180, 18, 3, 3, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(`${branchName.toUpperCase()}`, 25, yPosition + 12)
      doc.text(`${branchAttendance.length} kehadiran`, 170, yPosition + 12, { align: 'right' })
      
      doc.setTextColor(0, 0, 0)
      yPosition += 25

      // Modern Table Header
      doc.setFillColor(236, 240, 241)
      doc.rect(15, yPosition, 180, 12, 'F')
      doc.setDrawColor(189, 195, 199)
      doc.rect(15, yPosition, 180, 12)
      
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      const headers = [
        { text: 'No', x: 20 },
        { text: 'Tanggal', x: 35 },
        { text: 'Nama Pekerja', x: 75 },
        { text: 'Shift', x: 130 },
        { text: 'Jam', x: 155 },
        { text: 'Status', x: 175 }
      ]
      
      headers.forEach(header => {
        doc.text(header.text, header.x, yPosition + 8)
      })
      
      yPosition += 12

      // Table Data with Alternating Colors
      branchAttendance.forEach((item, index) => {
        // Check page break
        if (yPosition > 250) {
          doc.addPage()
          yPosition = 25
          
          // Repeat table header
          doc.setFillColor(236, 240, 241)
          doc.rect(15, yPosition, 180, 12, 'F')
          headers.forEach(header => {
            doc.text(header.text, header.x, yPosition + 8)
          })
          yPosition += 12
        }

        // Alternating row colors
        if (index % 2 === 0) {
          doc.setFillColor(252, 252, 252)
          doc.rect(15, yPosition, 180, 10, 'F')
        }
        
        // Draw row border
        doc.setDrawColor(230, 230, 230)
        doc.line(15, yPosition, 195, yPosition)
        
        // Data
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        
        doc.text((index + 1).toString(), 20, yPosition + 7)
        doc.text(formatDate(item.tanggal), 35, yPosition + 7)
        
        const workerName = (item.nama_pekerja || '-').length > 22 
          ? (item.nama_pekerja || '-').substring(0, 20) + '..'
          : (item.nama_pekerja || '-')
        doc.text(workerName, 75, yPosition + 7)
        
        // Shift with color coding
        const shift = (item.shift || '-').toUpperCase()
        if (shift === 'PAGI') {
          doc.setTextColor(220, 38, 38) // Red for pagi
        } else if (shift === 'MALAM') {
          doc.setTextColor(153, 27, 27) // Dark red for malam
        }
        doc.text(shift, 130, yPosition + 7)
        doc.setTextColor(0, 0, 0)
        
        doc.text(item.jam_mulai || '-', 155, yPosition + 7)
        
        // Status with color - hanya HADIR
        const status = 'HADIR'
        doc.setTextColor(39, 174, 96) // Green for HADIR
        doc.text(status, 175, yPosition + 7)
        doc.setTextColor(0, 0, 0)
        
        yPosition += 10
      })
      
      // Bottom border for table
      doc.setDrawColor(189, 195, 199)
      doc.line(15, yPosition, 195, yPosition)
      yPosition += 15

      // Worker Summary in Elegant Box
      const workerTotals = {}
      branchAttendance.forEach(item => {
        const workerName = item.nama_pekerja || 'Unknown'
        if (!workerTotals[workerName]) {
          workerTotals[workerName] = { total: 0, pagi: 0, malam: 0 }
        }
        workerTotals[workerName].total++
        if (item.shift === 'pagi') workerTotals[workerName].pagi++
        if (item.shift === 'malam') workerTotals[workerName].malam++
      })

      // Summary box
      doc.setFillColor(254, 249, 231) // Light yellow
      doc.roundedRect(15, yPosition, 180, Object.keys(workerTotals).length * 8 + 20, 3, 3, 'F')
      doc.setDrawColor(241, 196, 15)
      doc.roundedRect(15, yPosition, 180, Object.keys(workerTotals).length * 8 + 20, 3, 3)
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('RINGKASAN KEHADIRAN', 25, yPosition + 12)
      yPosition += 20
      
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      Object.entries(workerTotals).forEach(([workerName, totals]) => {
        const truncatedName = workerName.length > 20 
          ? workerName.substring(0, 18) + '..'
          : workerName
        
        // Worker name
        doc.text(`${truncatedName}`, 25, yPosition)
        
        // Total days with "hari"
        doc.text(`${totals.total} hari`, 100, yPosition)
        
        // Shift breakdown with labels
        doc.setTextColor(220, 38, 38) // Red for "Pagi"
        doc.text(`Pagi: ${totals.pagi}`, 140, yPosition)
        
        doc.setTextColor(153, 27, 27) // Dark red for "Malam"  
        doc.text(`Malam: ${totals.malam}`, 170, yPosition)
        
        doc.setTextColor(0, 0, 0) // Reset to black
        yPosition += 9
      })
      
      yPosition += 20
    })

    // Footer - always at bottom of page
    const currentPageCount = doc.internal.getNumberOfPages()
    
    for (let i = 1; i <= currentPageCount; i++) {
      doc.setPage(i)
      
      // Footer at bottom of page (297mm height - 15mm from bottom)
      const footerY = 282
      
      doc.setFillColor(220, 38, 38) // Red footer  
      doc.rect(0, footerY, 210, 15, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(8)
      doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} | DWash Laundry`, 105, footerY + 10, { align: 'center' })
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Laporan_Kehadiran_${filters.viewMode === 'daily' ? filters.date : filters.month}.pdf"`
      }
    })

  } catch (error) {
    throw error
  }
}