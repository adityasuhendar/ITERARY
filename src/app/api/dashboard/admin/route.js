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
    
    // Super admin can see all system data
    if (decoded.role !== 'super_admin' && decoded.jenis_karyawan !== 'super_admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Parallel fetch for better performance
    const [
      systemOverview,
      userStats,
      branchStats,
      financialOverview,
      recentActivity,
      systemHealth,
      auditLogs,
      performanceMetrics
    ] = await Promise.all([
      getSystemOverview(),
      getUserStats(),
      getBranchStats(),
      getFinancialOverview(),
      getRecentActivity(),
      getSystemHealth(),
      getAuditLogs(),
      getPerformanceMetrics()
    ])

    return NextResponse.json({
      system_overview: systemOverview,
      user_stats: userStats,
      branch_stats: branchStats,
      financial_overview: financialOverview,
      recent_activity: recentActivity,
      system_health: systemHealth,
      audit_logs: auditLogs,
      performance_metrics: performanceMetrics,
      last_updated: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z'
    })

  } catch (error) {
    console.error('Admin dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getSystemOverview() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  
  const rows = await query(`
    SELECT 
      (SELECT COUNT(*) FROM karyawan WHERE status_aktif = 'aktif') as total_users,
      (SELECT COUNT(*) FROM cabang WHERE status_aktif = 'aktif') as active_branches,
      (SELECT COUNT(*) FROM transaksi WHERE DATE(tanggal_transaksi) = ? AND status_transaksi = 'selesai') as today_transactions,
      (SELECT COALESCE(SUM(total_keseluruhan), 0) FROM transaksi WHERE DATE(tanggal_transaksi) = ? AND status_transaksi = 'selesai') as today_revenue,
      (SELECT COUNT(*) FROM mesin_laundry WHERE status_mesin = 'rusak') as broken_machines,
      (SELECT COUNT(*) FROM stok_cabang sc JOIN produk_tambahan pt ON sc.id_produk = pt.id_produk 
       WHERE sc.stok_tersedia <= sc.stok_minimum AND pt.status_aktif = 'aktif') as low_stock_alerts
  `, [today, today])

  return rows[0] || {}
}

async function getUserStats() {
  const rows = await query(`
    SELECT 
      k.jenis_karyawan as role,
      COUNT(*) as count,
      COUNT(CASE WHEN k.status_aktif = 'aktif' THEN 1 END) as active_count,
      COUNT(CASE WHEN k.terakhir_login >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as recent_login_count
    FROM karyawan k
    GROUP BY k.jenis_karyawan
    ORDER BY count DESC
  `)

  const recentLogins = await query(`
    SELECT 
      k.nama_karyawan,
      k.jenis_karyawan,
      c.nama_cabang,
      k.terakhir_login
    FROM karyawan k
    LEFT JOIN cabang c ON k.id_cabang = c.id_cabang
    WHERE k.terakhir_login IS NOT NULL
    ORDER BY k.terakhir_login DESC
    LIMIT 10
  `)

  return {
    role_distribution: rows,
    recent_logins: recentLogins
  }
}

async function getBranchStats() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  
  // First get basic branch info
  const branches = await query(`
    SELECT 
      c.id_cabang,
      c.nama_cabang,
      c.alamat,
      c.status_aktif
    FROM cabang c
    WHERE c.status_aktif = 'aktif'
    ORDER BY c.nama_cabang
  `)

  // Then get today's transactions for each branch
  const branchStats = await Promise.all(branches.map(async (branch) => {
    const transactions = await query(`
      SELECT 
        COUNT(*) as today_transactions,
        COALESCE(SUM(total_keseluruhan), 0) as today_revenue
      FROM transaksi 
      WHERE id_cabang = ? AND DATE(tanggal_transaksi) = ? AND status_transaksi = 'selesai'
    `, [branch.id_cabang, today])

    const machines = await query(`
      SELECT 
        COUNT(*) as total_machines,
        COUNT(CASE WHEN status_mesin = 'tersedia' THEN 1 END) as available_machines,
        COUNT(CASE WHEN status_mesin = 'rusak' THEN 1 END) as broken_machines
      FROM mesin_laundry 
      WHERE id_cabang = ?
    `, [branch.id_cabang])

    const staff = await query(`
      SELECT COUNT(*) as staff_count
      FROM karyawan 
      WHERE id_cabang = ? AND status_aktif = 'aktif'
    `, [branch.id_cabang])

    return {
      ...branch,
      today_transactions: transactions[0]?.today_transactions || 0,
      today_revenue: transactions[0]?.today_revenue || 0,
      total_machines: machines[0]?.total_machines || 0,
      available_machines: machines[0]?.available_machines || 0,
      broken_machines: machines[0]?.broken_machines || 0,
      staff_count: staff[0]?.staff_count || 0
    }
  }))

  // Sort by today revenue descending
  return branchStats.sort((a, b) => parseFloat(b.today_revenue) - parseFloat(a.today_revenue))
}

async function getFinancialOverview() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const thisMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(0, 7)
  const thisYear = new Date().getFullYear()

  const daily = await query(`
    SELECT 
      COALESCE(SUM(total_keseluruhan), 0) as total_revenue,
      COUNT(*) as total_transactions,
      COALESCE(SUM(CASE WHEN metode_pembayaran = 'tunai' THEN total_keseluruhan ELSE 0 END), 0) as tunai_revenue,
      COALESCE(SUM(CASE WHEN metode_pembayaran = 'qris' THEN total_keseluruhan ELSE 0 END), 0) as qris_revenue
    FROM transaksi 
    WHERE DATE(tanggal_transaksi) = ? AND status_transaksi = 'selesai'
  `, [today])

  const monthly = await query(`
    SELECT 
      COALESCE(SUM(total_keseluruhan), 0) as total_revenue,
      COUNT(*) as total_transactions
    FROM transaksi 
    WHERE DATE(tanggal_transaksi) LIKE ? AND status_transaksi = 'selesai'
  `, [`${thisMonth}%`])

  const yearly = await query(`
    SELECT 
      COALESCE(SUM(total_keseluruhan), 0) as total_revenue,
      COUNT(*) as total_transactions
    FROM transaksi 
    WHERE YEAR(tanggal_transaksi) = ? AND status_transaksi = 'selesai'
  `, [thisYear])

  return {
    daily: daily[0] || {},
    monthly: monthly[0] || {},
    yearly: yearly[0] || {}
  }
}

async function getRecentActivity() {
  const recentTransactions = await query(`
    SELECT 
      t.kode_transaksi,
      t.tanggal_transaksi,
      t.total_keseluruhan,
      t.metode_pembayaran,
      p.nama_pelanggan,
      c.nama_cabang,
      k.nama_karyawan
    FROM transaksi t
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
    JOIN cabang c ON t.id_cabang = c.id_cabang
    JOIN karyawan k ON t.id_karyawan = k.id_karyawan
    ORDER BY t.tanggal_transaksi DESC
    LIMIT 10
  `)

  // Skip pengambilan_uang table since it doesn't exist
  const recentCollections = []

  return {
    recent_transactions: recentTransactions,
    recent_collections: recentCollections
  }
}

async function getSystemHealth() {
  const machineStats = await query(`
    SELECT 
      COUNT(*) as total_machines,
      COUNT(CASE WHEN status_mesin = 'tersedia' THEN 1 END) as available,
      COUNT(CASE WHEN status_mesin = 'digunakan' THEN 1 END) as in_use,
      COUNT(CASE WHEN status_mesin = 'maintenance' THEN 1 END) as maintenance,
      COUNT(CASE WHEN status_mesin = 'rusak' THEN 1 END) as broken
    FROM mesin_laundry
  `)

  const stockAlerts = await query(`
    SELECT 
      COUNT(*) as total_alerts,
      COUNT(CASE WHEN sc.stok_tersedia = 0 THEN 1 END) as out_of_stock,
      COUNT(CASE WHEN sc.stok_tersedia <= sc.stok_minimum AND sc.stok_tersedia > 0 THEN 1 END) as low_stock
    FROM stok_cabang sc
    JOIN produk_tambahan pt ON sc.id_produk = pt.id_produk
    WHERE sc.stok_tersedia <= sc.stok_minimum AND pt.status_aktif = 'aktif'
  `)

  return {
    machines: machineStats[0] || {},
    inventory: stockAlerts[0] || {}
  }
}

async function getAuditLogs() {
  const rows = await query(`
    SELECT 
      a.id_audit,
      a.tabel_diubah,
      a.aksi,
      a.waktu_aksi,
      a.ip_address,
      k.nama_karyawan,
      k.jenis_karyawan
    FROM audit_log a
    LEFT JOIN karyawan k ON a.id_karyawan = k.id_karyawan
    ORDER BY a.waktu_aksi DESC
    LIMIT 20
  `)

  return rows
}

async function getPerformanceMetrics() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

  const todayMetrics = await query(`
    SELECT 
      COUNT(*) as transactions,
      COALESCE(AVG(total_keseluruhan), 0) as avg_transaction_value,
      COALESCE(SUM(total_keseluruhan), 0) as total_revenue
    FROM transaksi 
    WHERE DATE(tanggal_transaksi) = ? AND status_transaksi = 'selesai'
  `, [today])

  const yesterdayMetrics = await query(`
    SELECT 
      COUNT(*) as transactions,
      COALESCE(SUM(total_keseluruhan), 0) as total_revenue
    FROM transaksi 
    WHERE DATE(tanggal_transaksi) = ? AND status_transaksi = 'selesai'
  `, [yesterday])

  const todayData = todayMetrics[0] || {}
  const yesterdayData = yesterdayMetrics[0] || {}

  const transactionGrowth = yesterdayData.transactions > 0 ? 
    ((todayData.transactions - yesterdayData.transactions) / yesterdayData.transactions * 100) : 0

  const revenueGrowth = yesterdayData.total_revenue > 0 ? 
    ((todayData.total_revenue - yesterdayData.total_revenue) / yesterdayData.total_revenue * 100) : 0

  return {
    today: todayData,
    yesterday: yesterdayData,
    transaction_growth: transactionGrowth.toFixed(1),
    revenue_growth: revenueGrowth.toFixed(1)
  }
}