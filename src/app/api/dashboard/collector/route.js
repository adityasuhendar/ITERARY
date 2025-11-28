import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'

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
    
    // Only pure collector can access - NO backup kasir hybrid access
    // If user is backup kasir (collector turned kasir), deny access
    if (decoded.jenis_karyawan !== 'collector') {
      return NextResponse.json({
        error: 'Access denied - Collector sudah menjadi backup kasir',
        isBackupKasir: decoded.backup_mode === true && decoded.original_role === 'collector'
      }, { status: 403 })
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    const collectorId = decoded.id

    // Parallel fetch for better performance
    const [
      revenueByShift,
      stockAlerts,
      branchSummary,
      dailyStats
    ] = await Promise.all([
      getRevenueByShift(today),
      getStockAlerts(),
      getBranchRevenueToday(today),
      getDailyStats(today)
    ])

    return NextResponse.json({
      revenue_by_shift: revenueByShift,
      stock_alerts: stockAlerts,
      branch_summary: branchSummary,
      daily_stats: dailyStats,
      last_updated: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z'
    })

  } catch (error) {
    console.error('Collector dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get revenue breakdown per shift across all branches
async function getRevenueByShift(today) {
  const rows = await query(`
    SELECT 
      t.shift_transaksi as shift,
      c.nama_cabang,
      c.id_cabang,
      COALESCE(SUM(CASE WHEN t.metode_pembayaran = 'tunai' THEN t.total_keseluruhan ELSE 0 END), 0) as tunai_revenue,
      COALESCE(SUM(CASE WHEN t.metode_pembayaran = 'qris' THEN t.total_keseluruhan ELSE 0 END), 0) as qris_revenue,
      COUNT(t.id_transaksi) as total_transactions,
      COALESCE(SUM(t.total_keseluruhan), 0) as total_revenue
    FROM cabang c
    LEFT JOIN transaksi t ON c.id_cabang = t.id_cabang 
      AND DATE(t.tanggal_transaksi) = ?
      AND t.status_transaksi = 'selesai'
    WHERE c.status_aktif = 'aktif'
    GROUP BY c.id_cabang, c.nama_cabang, t.shift_transaksi
    HAVING total_transactions > 0
    ORDER BY FIELD(c.nama_cabang, 'Tanjung Senang', 'Panglima Polim', 'Sukarame', 'Korpri', 'Gedong Meneng', 'Untung'), t.shift_transaksi
  `, [today])

  // Group by shift
  const shifts = {
    pagi: [],
    malam: []
  }

  rows.forEach(row => {
    if (row.shift && shifts[row.shift]) {
      shifts[row.shift].push(row)
    }
  })

  return shifts
}

// Get stock alerts across all branches  
async function getStockAlerts() {
  const rows = await query(`
    SELECT 
      c.nama_cabang,
      c.id_cabang,
      pt.nama_produk,
      pt.kategori_produk,
      pt.satuan,
      sc.stok_tersedia,
      sc.stok_minimum,
      sc.terakhir_update,
      CASE 
        WHEN sc.stok_tersedia = 0 THEN 'out_of_stock'
        WHEN sc.stok_tersedia <= sc.stok_minimum THEN 'critical'
        WHEN sc.stok_tersedia <= (sc.stok_minimum * 1.5) THEN 'low'
        ELSE 'good'
      END as status
    FROM stok_cabang sc
    JOIN produk_tambahan pt ON sc.id_produk = pt.id_produk
    JOIN cabang c ON sc.id_cabang = c.id_cabang
    WHERE sc.stok_tersedia <= (sc.stok_minimum * 1.5)
      AND pt.status_aktif = 'aktif'
      AND c.status_aktif = 'aktif'
    ORDER BY 
      CASE 
        WHEN sc.stok_tersedia = 0 THEN 1
        WHEN sc.stok_tersedia <= sc.stok_minimum THEN 2
        ELSE 3
      END,
      c.nama_cabang,
      sc.stok_tersedia ASC
  `)

  return rows
}

// Get revenue summary per branch today
async function getBranchRevenueToday(today) {
  const rows = await query(`
    SELECT 
      c.nama_cabang,
      c.id_cabang,
      c.alamat,
      COALESCE(SUM(CASE WHEN t.metode_pembayaran = 'tunai' THEN t.total_keseluruhan ELSE 0 END), 0) as tunai_revenue,
      COALESCE(SUM(CASE WHEN t.metode_pembayaran = 'qris' THEN t.total_keseluruhan ELSE 0 END), 0) as qris_revenue,
      COUNT(t.id_transaksi) as total_transactions,
      COALESCE(SUM(t.total_keseluruhan), 0) as total_revenue,
      MAX(t.tanggal_transaksi) as last_transaction
    FROM cabang c
    LEFT JOIN transaksi t ON c.id_cabang = t.id_cabang 
      AND DATE(t.tanggal_transaksi) = ?
      AND t.status_transaksi = 'selesai'
    WHERE c.status_aktif = 'aktif'
    GROUP BY c.id_cabang, c.nama_cabang, c.alamat
    ORDER BY FIELD(c.nama_cabang, 'Tanjung Senang', 'Panglima Polim', 'Sukarame', 'Korpri', 'Gedong Meneng', 'Untung'), c.nama_cabang
  `, [today])

  return rows
}

// Get daily statistics summary
async function getDailyStats(today) {
  const rows = await query(`
    SELECT 
      COALESCE(SUM(CASE WHEN metode_pembayaran = 'tunai' THEN total_keseluruhan ELSE 0 END), 0) as total_tunai,
      COALESCE(SUM(CASE WHEN metode_pembayaran = 'qris' THEN total_keseluruhan ELSE 0 END), 0) as total_qris,
      COALESCE(SUM(total_keseluruhan), 0) as total_revenue,
      COUNT(*) as total_transactions,
      COUNT(DISTINCT id_cabang) as active_branches,
      COUNT(CASE WHEN shift_transaksi = 'pagi' THEN 1 END) as pagi_transactions,
      COUNT(CASE WHEN shift_transaksi = 'malam' THEN 1 END) as malam_transactions
    FROM transaksi 
    WHERE DATE(tanggal_transaksi) = ?
    AND status_transaksi = 'selesai'
  `, [today])

  return rows[0] || {
    total_tunai: 0,
    total_qris: 0, 
    total_revenue: 0,
    total_transactions: 0,
    active_branches: 0,
    pagi_transactions: 0,
    malam_transactions: 0
  }
}