import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'
import { jsPDF } from 'jspdf'

// Function to get branch code from cabang_id
function getBranchCode(cabangId) {
  const branchCodes = {
    1: 'TS',  // Tanjung Senang
    2: 'PP',  // Panglima Polim
    3: 'SK',  // Sukarame
    4: 'KP',  // Korpri
    5: 'GM',  // Gedong Meneng
    6: 'UG',  // Untung
    7: 'KM'   // Komarudin
  }
  return branchCodes[parseInt(cabangId)] || 'XX'
}

export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const cabangId = searchParams.get('cabang_id')
    const date = searchParams.get('date')
    const shift = searchParams.get('shift')

    if (!cabangId || !date || !shift) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Get report data
    const reportData = await getShiftReportData(cabangId, date, shift, decoded)

    // Generate PDF
    const pdfBuffer = await generatePDF(reportData, date, shift)

    // Get branch code for filename
    const branchCode = getBranchCode(cabangId)
    const filename = `Laporan_Transaksi-${branchCode}_${date}_${shift}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}

async function getShiftReportData(cabangId, date, shift, decoded) {
  // Get branch info
  const branchInfo = await query(
    'SELECT nama_cabang FROM cabang WHERE id_cabang = ?',
    [cabangId]
  )

  // Get actual worker name from attendance_harian for this shift
  let workerInfo
  if (shift === 'semua') {
    workerInfo = await query(`
      SELECT GROUP_CONCAT(DISTINCT ah.nama_pekerja ORDER BY ah.shift SEPARATOR ' & ') as nama_pekerja
      FROM attendance_harian ah
      WHERE ah.id_cabang = ?
      AND ah.tanggal = ?
      AND ah.status = 'aktif'
    `, [cabangId, date])
  } else {
    workerInfo = await query(`
      SELECT ah.nama_pekerja
      FROM attendance_harian ah
      WHERE ah.id_cabang = ?
      AND ah.tanggal = ?
      AND ah.shift = ?
      AND ah.status = 'aktif'
      LIMIT 1
    `, [cabangId, date, shift])
  }

  // Get all transactions for the date and shift
  let transactions
  if (shift === 'semua') {
    transactions = await query(`
      SELECT 
        t.kode_transaksi,
        t.tanggal_transaksi,
        t.total_keseluruhan,
        t.metode_pembayaran,
        t.shift_transaksi,
        p.nama_pelanggan
      FROM transaksi t
      LEFT JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
      WHERE t.id_cabang = ? 
        AND DATE(t.tanggal_transaksi) = ?
        AND t.status_transaksi = 'selesai'
      ORDER BY t.tanggal_transaksi ASC
    `, [cabangId, date])
  } else {
    transactions = await query(`
      SELECT 
        t.kode_transaksi,
        t.tanggal_transaksi,
        t.total_keseluruhan,
        t.metode_pembayaran,
        t.shift_transaksi,
        p.nama_pelanggan
      FROM transaksi t
      LEFT JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
      WHERE t.id_cabang = ? 
        AND DATE(t.tanggal_transaksi) = ?
        AND t.shift_transaksi = ?
        AND t.status_transaksi = 'selesai'
      ORDER BY t.tanggal_transaksi ASC
    `, [cabangId, date, shift])
  }

  // Get fee kasir data
  let feeKasirData
  if (shift === 'semua') {
    feeKasirData = await query(`
      SELECT
        COALESCE(SUM(dtl.fee_kasir), 0) as fee_kasir,
        COUNT(DISTINCT CASE WHEN dtl.id_jenis_layanan = 4 AND dtl.fee_kasir > 0 THEN dtl.id_detail_layanan END) as ckl_count
      FROM detail_transaksi_layanan dtl
      JOIN transaksi t ON t.id_transaksi = dtl.id_transaksi
      WHERE t.id_cabang = ?
        AND DATE(t.tanggal_transaksi) = ?
        AND t.status_transaksi = 'selesai'
        AND dtl.fee_kasir > 0
    `, [cabangId, date])
  } else {
    feeKasirData = await query(`
      SELECT
        COALESCE(SUM(dtl.fee_kasir), 0) as fee_kasir,
        COUNT(DISTINCT CASE WHEN dtl.id_jenis_layanan = 4 AND dtl.fee_kasir > 0 THEN dtl.id_detail_layanan END) as ckl_count
      FROM detail_transaksi_layanan dtl
      JOIN transaksi t ON t.id_transaksi = dtl.id_transaksi
      WHERE t.id_cabang = ?
        AND DATE(t.tanggal_transaksi) = ?
        AND t.shift_transaksi = ?
        AND t.status_transaksi = 'selesai'
        AND dtl.fee_kasir > 0
    `, [cabangId, date, shift])
  }

  // Get expenses data for the date
  const expensesData = await query(`
    SELECT
      kategori,
      jumlah,
      DATE_FORMAT(tanggal, '%d/%m/%Y') as tanggal_formatted
    FROM pengeluaran
    WHERE id_cabang = ?
    AND DATE(tanggal) = ?
    ORDER BY tanggal DESC, kategori
  `, [cabangId, date])

  // Calculate summary
  const totalTransaksi = transactions.length
  const totalPendapatan = transactions.reduce((sum, t) => sum + parseFloat(t.total_keseluruhan || 0), 0)
  const pendapatanTunai = transactions
    .filter(t => t.metode_pembayaran === 'tunai')
    .reduce((sum, t) => sum + parseFloat(t.total_keseluruhan || 0), 0)
  const pendapatanQris = transactions
    .filter(t => t.metode_pembayaran === 'qris')
    .reduce((sum, t) => sum + parseFloat(t.total_keseluruhan || 0), 0)
  const transaksiTunai = transactions.filter(t => t.metode_pembayaran === 'tunai').length
  const transaksiQris = transactions.filter(t => t.metode_pembayaran === 'qris').length
  const feeKasir = parseFloat(feeKasirData[0]?.fee_kasir || 0)
  const cklCount = parseInt(feeKasirData[0]?.ckl_count || 0)

  // Calculate total expenses
  const totalExpenses = expensesData.reduce((sum, exp) => sum + parseFloat(exp.jumlah), 0)

  // Calculate net revenue (Kotor - Fee - Expenses)
  const pendapatanBersih = totalPendapatan - feeKasir - totalExpenses
  const tunaiBersih = pendapatanTunai - feeKasir - totalExpenses
  const qrisBersih = pendapatanQris // QRIS tidak kena potongan

  // Determine kasir name - use actual worker name if available, fallback to "-"
  const kasirName = workerInfo.length > 0 ? workerInfo[0].nama_pekerja : "-"

  return {
    info: {
      cabang: branchInfo[0]?.nama_cabang || '',
      kasir: kasirName,
      tanggal: date,
      shift: shift
    },
    transactions,
    expenses: expensesData,
    summary: {
      total_transaksi: totalTransaksi,
      total_pendapatan: totalPendapatan,
      pendapatan_tunai: pendapatanTunai,
      pendapatan_qris: pendapatanQris,
      transaksi_tunai: transaksiTunai,
      transaksi_qris: transaksiQris,
      fee_kasir: feeKasir,
      ckl_count: cklCount,
      total_expenses: totalExpenses,
      pendapatan_bersih: pendapatanBersih,
      tunai_bersih: tunaiBersih,
      qris_bersih: qrisBersih
    }
  }
}

async function generatePDF(reportData, date, shift) {
  try {
    const doc = new jsPDF()
    
    // Helper functions
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(amount)
    }

    const formatDateTime = (dateString) => {
      return new Date(dateString).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    }

    const formatDateOnly = (dateString) => {
      return new Date(dateString).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }

    let yPosition = 20

    // Header background with dynamic height
    const headerHeight = 40
    doc.setFillColor(220, 53, 69) // Red background
    doc.rect(0, 0, 210, headerHeight, 'F')

    // Company info in header
    doc.setTextColor(255, 255, 255) // White text
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text("DWASH LAUNDRY", 15, 20)

    doc.setFontSize(12)
    doc.text("LAPORAN SHIFT KASIR", 15, 27)

    // Report info in header
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Cabang: ${reportData.info.cabang}`, 15, 34)

    // Date, shift, and kasir info on the right side
    doc.setFontSize(9)
    doc.text(`Tanggal: ${formatDateOnly(reportData.info.tanggal)}`, 120, 20)
    doc.text(`Shift: ${reportData.info.shift.toUpperCase()}`, 120, 25)
    doc.text(`Kasir: ${reportData.info.kasir}`, 120, 30)

    // Reset text color to black and update position
    doc.setTextColor(0, 0, 0)
    yPosition = headerHeight + 15

    // Summary Section with box
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('RINGKASAN LAPORAN', 15, yPosition)
    yPosition += 6

    // Calculate dynamic height based on expenses
    const expenseLines = reportData.expenses.length
    const boxHeight = 40 + (expenseLines > 0 ? (expenseLines * 4) : 0)

    // Stats grid box - dynamic height
    doc.setFillColor(248, 249, 250)
    doc.rect(15, yPosition, 180, boxHeight, 'F')
    doc.setDrawColor(220, 220, 220)
    doc.rect(15, yPosition, 180, boxHeight, 'S')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)

    // Left column - Stats & Payment Breakdown
    doc.text(`Total Transaksi: ${reportData.summary.total_transaksi}`, 25, yPosition + 6)
    doc.text(`Pendapatan Tunai: ${formatCurrency(reportData.summary.pendapatan_tunai)} (${reportData.summary.transaksi_tunai}x)`, 25, yPosition + 12)
    doc.text(`Pendapatan QRIS: ${formatCurrency(reportData.summary.pendapatan_qris)} (${reportData.summary.transaksi_qris}x)`, 25, yPosition + 18)

    // Middle column - Revenue, Fee, Expenses
    let midY = yPosition + 6
    doc.text(`Pendapatan Kotor: ${formatCurrency(reportData.summary.total_pendapatan)}`, 105, midY)

    midY += 6
    doc.setTextColor(255, 111, 0)
    doc.text(`Fee Jasa Lipat: ${formatCurrency(reportData.summary.fee_kasir)} (${reportData.summary.ckl_count} CKL)`, 105, midY)

    midY += 6
    if (expenseLines > 0) {
      doc.setTextColor(220, 53, 69)
      doc.text(`Pengeluaran: ${formatCurrency(reportData.summary.total_expenses)}`, 105, midY)
      midY += 4
      doc.setFontSize(7)
      doc.setTextColor(100, 100, 100)
      reportData.expenses.forEach((expense) => {
        doc.text(`  - ${expense.kategori} (${expense.tanggal_formatted}): ${formatCurrency(parseFloat(expense.jumlah))}`, 105, midY)
        midY += 4
      })
      doc.setFontSize(9)
    } else {
      doc.setTextColor(220, 53, 69)
      doc.text(`Pengeluaran: Rp 0`, 105, midY)
    }

    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')

    // Bottom - Net Results (stacked vertically)
    doc.setTextColor(0, 128, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(`Pendapatan Bersih: ${formatCurrency(reportData.summary.pendapatan_bersih)}`, 25, yPosition + 24)
    doc.text(`Tunai Bersih: ${formatCurrency(reportData.summary.tunai_bersih)}`, 25, yPosition + 30)
    doc.setTextColor(13, 110, 253)
    doc.text(`QRIS Bersih: ${formatCurrency(reportData.summary.qris_bersih)}`, 25, yPosition + 36)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')

    yPosition += boxHeight + 10

    // Transactions Section
    doc.setFontSize(14)
    doc.text('DETAIL TRANSAKSI', 15, yPosition)
    yPosition += 10

    // Table Header with proper spacing
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')

    if (shift === 'semua') {
      // 6-column layout for "semua"
      doc.text('Kode', 15, yPosition)
      doc.text('Waktu', 45, yPosition)
      doc.text('Shift', 90, yPosition)
      doc.text('Pelanggan', 110, yPosition)
      doc.text('Pembayaran', 145, yPosition)
      doc.text('Total', 175, yPosition)
    } else {
      // 5-column layout for specific shift
      doc.text('Kode', 15, yPosition)
      doc.text('Waktu', 50, yPosition)
      doc.text('Pelanggan', 100, yPosition)
      doc.text('Pembayaran', 140, yPosition)
      doc.text('Total', 175, yPosition)
    }

    doc.setFont('helvetica', 'normal')
    yPosition += 5

    // Table line
    doc.line(15, yPosition, 195, yPosition)
    yPosition += 7

    // Table Rows
    reportData.transactions.forEach((transaction, index) => {
      // Check if we need a new page - reserve space for summary and signature
      if (yPosition > 250) { // Optimized space calculation
        doc.addPage()
        yPosition = 20
      }

      if (shift === 'semua') {
        // 6-column data layout with proper spacing
        doc.text(transaction.kode_transaksi || '', 15, yPosition)
        doc.text(formatDateTime(transaction.tanggal_transaksi), 45, yPosition)
        doc.text((transaction.shift_transaksi || '').toUpperCase(), 88, yPosition)
        doc.text(transaction.nama_pelanggan || '', 110, yPosition)
        doc.text(transaction.metode_pembayaran?.toUpperCase() || 'BELUM', 150, yPosition)
        doc.text(formatCurrency(transaction.total_keseluruhan), 170, yPosition)
      } else {
        // 5-column data layout with proper spacing
        doc.text(transaction.kode_transaksi || '', 15, yPosition)
        doc.text(formatDateTime(transaction.tanggal_transaksi), 50, yPosition)
        doc.text(transaction.nama_pelanggan || '', 100, yPosition)
        doc.text(transaction.metode_pembayaran?.toUpperCase() || 'BELUM', 140, yPosition)
        doc.text(formatCurrency(transaction.total_keseluruhan), 170, yPosition)
      }
      
      yPosition += 7
    })

    // Check if signature fits on current page
    const signatureHeight = 25 // signature section height

    if (yPosition + signatureHeight > 275) {
      doc.addPage()
      yPosition = 20
    } else {
      yPosition += 15
    }

    // Signature Section - Only Kasir and Owner
    doc.text('Kasir', 50, yPosition)
    doc.text('Owner', 140, yPosition)
    
    yPosition += 15
    doc.text('(_____________)', 40, yPosition)
    doc.text('(_____________)', 130, yPosition)

    return Buffer.from(doc.output('arraybuffer'))

  } catch (error) {
    throw error
  }
}