import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { handleJWTAuth } from '@/lib/jwtHandler'

export async function GET(request) {
  try {
    // Handle JWT authentication with role check
    const { decoded, errorResponse } = handleJWTAuth(request, ['owner'])
    if (errorResponse) {
      return errorResponse
    }

    // Get filter parameters from URL
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today'
    const paymentMethod = searchParams.get('payment_method') || 'all'
    
    console.log('Owner dashboard filters:', { period, paymentMethod })

    // Parallel fetch for better performance with filters - optimized to remove unused queries
    const [
      dailyStats,
      monthlyStats,
      branchPerformance,
      inventoryAlerts
    ] = await Promise.all([
      getDailyStats(period, paymentMethod),
      getMonthlyStats(),
      getBranchPerformance(period, paymentMethod),
      getInventoryAlerts()
    ])

    return NextResponse.json({
      daily_stats: dailyStats,
      monthly_stats: monthlyStats,
      branch_performance: branchPerformance,
      inventory_alerts: inventoryAlerts,
      last_updated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Owner dashboard error:', error)
    
    // Handle JWT token expired specifically
    if (error.name === 'TokenExpiredError') {
      return NextResponse.json({ 
        error: 'jwt expired',
        expired: true,
        message: 'Token has expired, please login again'
      }, { status: 401 })
    }
    
    // Handle other JWT errors
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ 
        error: 'Invalid token',
        expired: true,
        message: 'Invalid token, please login again'
      }, { status: 401 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getDailyStats(period = 'today', paymentMethod = 'all') {
  let dateCondition = ''
  let params = []

  // Build date condition based on period - optimized to use index (removed DATE() function)
  switch (period) {
    case 'today':
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      const tomorrow = new Date(new Date(today).getTime() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      dateCondition = 'tanggal_transaksi >= ? AND tanggal_transaksi < ?'
      params.push(today + ' 00:00:00', tomorrow + ' 00:00:00')
      break
    case 'week':
      const weekAgo = new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      dateCondition = 'tanggal_transaksi >= ?'
      params.push(weekAgo + ' 00:00:00')
      break
    case 'month':
      const monthAgo = new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      dateCondition = 'tanggal_transaksi >= ?'
      params.push(monthAgo + ' 00:00:00')
      break
  }

  // Build payment method condition
  let paymentCondition = ''
  if (paymentMethod !== 'all') {
    paymentCondition = ' AND metode_pembayaran = ?'
    params.push(paymentMethod)
  }

  // Get overall stats
  const rows = await query(`
    SELECT
      COUNT(*) as total_transactions,
      COALESCE(SUM(total_keseluruhan), 0) as total_revenue,
      COUNT(DISTINCT id_pelanggan) as unique_customers,
      COALESCE(AVG(total_keseluruhan), 0) as avg_transaction
    FROM transaksi
    WHERE ${dateCondition}${paymentCondition}
    AND status_transaksi = 'selesai'
  `, params)

  // Get payment method breakdown for the selected period
  const paymentStats = await query(`
    SELECT
      metode_pembayaran,
      COUNT(*) as transactions,
      COALESCE(SUM(total_keseluruhan), 0) as revenue
    FROM transaksi
    WHERE ${dateCondition}${paymentCondition}
    AND status_transaksi = 'selesai'
    GROUP BY metode_pembayaran
  `, params)

  // Process payment method breakdown
  const cashStats = paymentStats.find(p => p.metode_pembayaran === 'tunai') || { transactions: 0, revenue: 0 }
  const qrisStats = paymentStats.find(p => p.metode_pembayaran === 'qris') || { transactions: 0, revenue: 0 }

  return {
    // Removed duplicate fields (total_revenue, total_transactions) - UI only uses today_* fields
    today_revenue: rows[0]?.total_revenue || 0,
    today_transactions: rows[0]?.total_transactions || 0,
    unique_customers: rows[0]?.unique_customers || 0,
    avg_transaction: rows[0]?.avg_transaction || 0,
    cash_revenue: cashStats.revenue,
    cash_transactions: cashStats.transactions,
    qris_revenue: qrisStats.revenue,
    qris_transactions: qrisStats.transactions
  }
}

async function getMonthlyStats() {
  // Removed unused parameters (period, paymentMethod) - this function always compares current vs last month
  const now = new Date()
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

  // Only fetch SUM for growth calculation - optimized to use index (removed DATE() and LIKE)
  const thisMonthData = await query(`
    SELECT COALESCE(SUM(total_keseluruhan), 0) as total_revenue
    FROM transaksi
    WHERE tanggal_transaksi >= ? AND tanggal_transaksi < ?
  `, [`${thisMonth} 00:00:00`, `${nextMonth} 00:00:00`])

  const lastMonthData = await query(`
    SELECT COALESCE(SUM(total_keseluruhan), 0) as total_revenue
    FROM transaksi
    WHERE tanggal_transaksi >= ? AND tanggal_transaksi < ?
  `, [`${lastMonth} 00:00:00`, `${thisMonth} 00:00:00`])

  const currentRevenue = thisMonthData[0]?.total_revenue || 0
  const lastRevenue = lastMonthData[0]?.total_revenue || 0
  const growth = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue * 100) : 0

  return {
    growth_percentage: growth.toFixed(1)
  }
}

async function getBranchPerformance(period = 'today', paymentMethod = 'all') {
  let dateCondition = ''
  let params = []

  // Build date condition based on period - optimized to use index (removed DATE() function)
  switch (period) {
    case 'today':
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      const tomorrow = new Date(new Date(today).getTime() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      dateCondition = 'AND t.tanggal_transaksi >= ? AND t.tanggal_transaksi < ?'
      params.push(today + ' 00:00:00', tomorrow + ' 00:00:00')
      break
    case 'week':
      const weekAgo = new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      dateCondition = 'AND t.tanggal_transaksi >= ?'
      params.push(weekAgo + ' 00:00:00')
      break
    case 'month':
      const monthAgo = new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      dateCondition = 'AND t.tanggal_transaksi >= ?'
      params.push(monthAgo + ' 00:00:00')
      break
  }
  
  // Build payment method condition
  if (paymentMethod !== 'all') {
    dateCondition += ' AND t.metode_pembayaran = ?'
    params.push(paymentMethod)
  }
  
  const branches = await query(`
    SELECT
      c.nama_cabang,
      c.id_cabang,
      COUNT(t.id_transaksi) as daily_transactions,
      COALESCE(SUM(t.total_keseluruhan), 0) as daily_revenue,
      COUNT(DISTINCT t.id_pelanggan) as unique_customers
    FROM cabang c
    LEFT JOIN transaksi t ON c.id_cabang = t.id_cabang
      ${dateCondition ? dateCondition : ''}
      AND t.status_transaksi = 'selesai'
    WHERE c.status_aktif = 'aktif'
    GROUP BY c.id_cabang, c.nama_cabang
    ORDER BY daily_revenue DESC
  `, params)

  // Get yesterday's data for comparison - optimized to use index (removed DATE() function)
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const yesterdayData = await query(`
    SELECT
      id_cabang,
      COALESCE(SUM(total_keseluruhan), 0) as yesterday_revenue
    FROM transaksi
    WHERE tanggal_transaksi >= ? AND tanggal_transaksi < ?
    GROUP BY id_cabang
  `, [yesterday + ' 00:00:00', today + ' 00:00:00'])

  const yesterdayMap = Object.fromEntries(
    yesterdayData.map(row => [row.id_cabang, row.yesterday_revenue])
  )

  return branches.map(branch => {
    const yesterdayRev = yesterdayMap[branch.id_cabang] || 0
    const growth = yesterdayRev > 0 ?
      ((branch.daily_revenue - yesterdayRev) / yesterdayRev * 100) :
      (branch.daily_revenue > 0 ? 100 : 0)

    return {
      ...branch,
      growth_percentage: growth.toFixed(1)
    }
  })
}

async function getInventoryAlerts() {
  // Only fetch items with alerts (out_of_stock, critical, low) - removed 'good' items
  const rows = await query(`
    SELECT
      p.nama_produk,
      s.stok_tersedia,
      s.stok_minimum,
      p.satuan,
      c.nama_cabang,
      CASE
        WHEN s.stok_tersedia = 0 THEN 'out_of_stock'
        WHEN s.stok_tersedia <= s.stok_minimum THEN 'critical'
        WHEN s.stok_tersedia <= (s.stok_minimum * 1.5) THEN 'low'
      END as alert_level
    FROM stok_cabang s
    JOIN produk_tambahan p ON s.id_produk = p.id_produk
    JOIN cabang c ON s.id_cabang = c.id_cabang
    WHERE p.status_aktif = 'aktif'
      AND c.status_aktif = 'aktif'
      AND s.stok_tersedia <= (s.stok_minimum * 1.5)  -- Filter only items with alerts
    ORDER BY
      CASE
        WHEN s.stok_tersedia = 0 THEN 1
        WHEN s.stok_tersedia <= s.stok_minimum THEN 2
        ELSE 3
      END,
      c.nama_cabang,
      p.nama_produk
  `)

  return rows
}

