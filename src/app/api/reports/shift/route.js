// FILE: src/app/api/reports/shift/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken } from '@/lib/auth'

export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user || !['kasir', 'super_admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const cabangId = searchParams.get('cabang_id') || user.cabang_id
    const date = searchParams.get('date') || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    const shift = searchParams.get('shift') || user.current_shift || user.shift

    // Verify access for kasir role
    if (user.role === 'kasir' && cabangId != user.cabang_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get cabang info and actual worker name from attendance
    const cabangInfo = await query(`
      SELECT c.nama_cabang
      FROM cabang c
      WHERE c.id_cabang = ?
    `, [cabangId])

    // Get actual worker name from attendance_harian for this shift
    let workerInfo
    if (shift === 'semua') {
      workerInfo = await query(`
        SELECT GROUP_CONCAT(DISTINCT ah.nama_pekerja ORDER BY ah.shift SEPARATOR ', ') as nama_pekerja
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

    if (cabangInfo.length === 0) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    // Determine kasir name - use actual worker name if available, fallback to "-"
    const kasirName = (workerInfo.length > 0 && workerInfo[0].nama_pekerja) ? workerInfo[0].nama_pekerja : "-"

    // Get all transactions for the shift
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
        JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
        JOIN karyawan k ON t.id_karyawan = k.id_karyawan
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
        JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
        JOIN karyawan k ON t.id_karyawan = k.id_karyawan
        WHERE t.id_cabang = ?
        AND DATE(t.tanggal_transaksi) = ?
        AND t.shift_transaksi = ?
        AND t.status_transaksi = 'selesai'
        ORDER BY t.tanggal_transaksi ASC
      `, [cabangId, date, shift])
    }

    // Get pendapatan layanan, produk, dan fee kasir dengan 1 query ringan
    let pendapatanLayanan = 0
    let pendapatanProduk = 0
    let feeKasir = 0
    let cklCount = 0
    let totalPengeluaran = 0

    // Get expenses for the day
    const expensesData = await query(`
      SELECT COALESCE(SUM(jumlah), 0) as total_pengeluaran
      FROM pengeluaran
      WHERE id_cabang = ?
      AND DATE(tanggal) = ?
    `, [cabangId, date])
    totalPengeluaran = parseFloat(expensesData[0]?.total_pengeluaran || 0)

    if (shift === 'semua') {
      const pendapatanData = await query(`
        SELECT
          COALESCE(SUM(t.total_layanan), 0) as pendapatan_layanan,
          COALESCE(SUM(t.total_produk), 0) as pendapatan_produk
        FROM transaksi t
        WHERE t.id_cabang = ?
          AND DATE(t.tanggal_transaksi) = ?
          AND t.status_transaksi = 'selesai'
      `, [cabangId, date])

      const feeKasirData = await query(`
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

      pendapatanLayanan = parseFloat(pendapatanData[0]?.pendapatan_layanan || 0)
      pendapatanProduk = parseFloat(pendapatanData[0]?.pendapatan_produk || 0)
      feeKasir = parseFloat(feeKasirData[0]?.fee_kasir || 0)
      cklCount = parseInt(feeKasirData[0]?.ckl_count || 0)
    } else {
      const pendapatanData = await query(`
        SELECT
          COALESCE(SUM(t.total_layanan), 0) as pendapatan_layanan,
          COALESCE(SUM(t.total_produk), 0) as pendapatan_produk
        FROM transaksi t
        WHERE t.id_cabang = ?
          AND DATE(t.tanggal_transaksi) = ?
          AND t.shift_transaksi = ?
          AND t.status_transaksi = 'selesai'
      `, [cabangId, date, shift])

      const feeKasirData = await query(`
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

      pendapatanLayanan = parseFloat(pendapatanData[0]?.pendapatan_layanan || 0)
      pendapatanProduk = parseFloat(pendapatanData[0]?.pendapatan_produk || 0)
      feeKasir = parseFloat(feeKasirData[0]?.fee_kasir || 0)
      cklCount = parseInt(feeKasirData[0]?.ckl_count || 0)
    }

    // Calculate summary statistics
    const summary = {
      total_transaksi: transactions.length,
      total_pendapatan: transactions.reduce((sum, tx) => sum + parseFloat(tx.total_keseluruhan), 0),
      transaksi_tunai: transactions.filter(tx => tx.metode_pembayaran === 'tunai').length,
      transaksi_qris: transactions.filter(tx => tx.metode_pembayaran === 'qris').length,
      pendapatan_tunai: transactions
        .filter(tx => tx.metode_pembayaran === 'tunai')
        .reduce((sum, tx) => sum + parseFloat(tx.total_keseluruhan), 0),
      pendapatan_qris: transactions
        .filter(tx => tx.metode_pembayaran === 'qris')
        .reduce((sum, tx) => sum + parseFloat(tx.total_keseluruhan), 0),
      pendapatan_layanan: pendapatanLayanan,
      pendapatan_produk: pendapatanProduk,
      fee_kasir: feeKasir,
      ckl_count: cklCount,
      total_pengeluaran: totalPengeluaran
    }

    // Format report data
    const reportData = {
      info: {
        cabang: cabangInfo[0].nama_cabang,
        kasir: kasirName,
        tanggal: date,
        shift: shift,
        generated_at: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z',
        generated_by: user.name
      },
      summary: summary,
      transactions: transactions.map(tx => ({
        kode_transaksi: tx.kode_transaksi,
        tanggal_transaksi: tx.tanggal_transaksi,
        nama_pelanggan: tx.nama_pelanggan,
        metode_pembayaran: tx.metode_pembayaran,
        total_keseluruhan: parseFloat(tx.total_keseluruhan),
        shift_transaksi: tx.shift_transaksi,
        kasir: tx.nama_karyawan
      }))
    }

    return NextResponse.json(reportData)

  } catch (error) {
    console.error('Shift report API error:', error)
    return NextResponse.json({
      error: 'Database error',
      message: error.message
    }, { status: 500 })
  }
}

