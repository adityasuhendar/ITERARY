import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'
import * as XLSX from 'xlsx'

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

    // Get cabang info
    const cabangInfo = await query(`
      SELECT nama_cabang FROM cabang WHERE id_cabang = ?
    `, [cabangId])

    if (cabangInfo.length === 0) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
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
          p.nama_pelanggan,
          k.nama_karyawan
        FROM transaksi t
        LEFT JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
        LEFT JOIN karyawan k ON t.id_karyawan = k.id_karyawan
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
          p.nama_pelanggan,
          k.nama_karyawan
        FROM transaksi t
        LEFT JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
        LEFT JOIN karyawan k ON t.id_karyawan = k.id_karyawan
        WHERE t.id_cabang = ?
        AND DATE(t.tanggal_transaksi) = ?
        AND t.shift_transaksi = ?
        AND t.status_transaksi = 'selesai'
        ORDER BY t.tanggal_transaksi ASC
      `, [cabangId, date, shift])
    }

    // Calculate summary
    const summary = {
      total_transaksi: transactions.length,
      total_pendapatan: transactions.reduce((sum, tx) => sum + parseFloat(tx.total_keseluruhan || 0), 0),
      transaksi_tunai: transactions.filter(tx => tx.metode_pembayaran === 'tunai').length,
      transaksi_qris: transactions.filter(tx => tx.metode_pembayaran === 'qris').length,
      pendapatan_tunai: transactions
        .filter(tx => tx.metode_pembayaran === 'tunai')
        .reduce((sum, tx) => sum + parseFloat(tx.total_keseluruhan || 0), 0),
      pendapatan_qris: transactions
        .filter(tx => tx.metode_pembayaran === 'qris')
        .reduce((sum, tx) => sum + parseFloat(tx.total_keseluruhan || 0), 0)
    }

    // Helper function for currency formatting
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(amount)
    }

    // Create Excel workbook
    const workbook = XLSX.utils.book_new()

    // Create Info Sheet
    const infoData = [
      ['LAPORAN SHIFT KASIR'],
      [''],
      ['Cabang', cabangInfo[0].nama_cabang],
      ['Tanggal', new Date(date).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })],
      ['Shift', shift.toUpperCase()],
      [''],
      ['RINGKASAN PENDAPATAN'],
      ['Total Transaksi', summary.total_transaksi],
      ['Total Pendapatan', formatCurrency(summary.total_pendapatan)],
      ['Transaksi Tunai', summary.transaksi_tunai],
      ['Pendapatan Tunai', formatCurrency(summary.pendapatan_tunai)],
      ['Transaksi QRIS', summary.transaksi_qris],
      ['Pendapatan QRIS', formatCurrency(summary.pendapatan_qris)]
    ]

    const infoSheet = XLSX.utils.aoa_to_sheet(infoData)
    XLSX.utils.book_append_sheet(workbook, infoSheet, 'Ringkasan')

    // Create Transactions Sheet with conditional shift column
    const transactionData = shift === 'semua' 
      ? [['Kode Transaksi', 'Tanggal & Waktu', 'Shift', 'Pelanggan', 'Kasir', 'Metode Pembayaran', 'Total']]
      : [['Kode Transaksi', 'Tanggal & Waktu', 'Pelanggan', 'Kasir', 'Metode Pembayaran', 'Total']]

    transactions.forEach(tx => {
      const formattedDateTime = new Date(tx.tanggal_transaksi).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
      
      if (shift === 'semua') {
        transactionData.push([
          tx.kode_transaksi || '',
          formattedDateTime,
          tx.shift_transaksi ? tx.shift_transaksi.toUpperCase() : '',
          tx.nama_pelanggan || '',
          tx.nama_karyawan || '',
          tx.metode_pembayaran ? tx.metode_pembayaran.toUpperCase() : 'BELUM DIBAYAR',
          formatCurrency(tx.total_keseluruhan)
        ])
      } else {
        transactionData.push([
          tx.kode_transaksi || '',
          formattedDateTime,
          tx.nama_pelanggan || '',
          tx.nama_karyawan || '',
          tx.metode_pembayaran ? tx.metode_pembayaran.toUpperCase() : 'BELUM DIBAYAR',
          formatCurrency(tx.total_keseluruhan)
        ])
      }
    })

    const transactionSheet = XLSX.utils.aoa_to_sheet(transactionData)
    XLSX.utils.book_append_sheet(workbook, transactionSheet, 'Detail Transaksi')

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Return Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Laporan_Transaksi-${getBranchCode(cabangId)}_${date}_${shift}.xlsx"`
      }
    })

  } catch (error) {
    console.error('Export shift report error:', error)
    return NextResponse.json({
      error: 'Export failed',
      message: error.message
    }, { status: 500 })
  }
}