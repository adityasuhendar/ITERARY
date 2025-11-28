import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { handleJWTAuth } from '@/lib/jwtHandler'

export async function GET(request) {
  try {
    // Handle JWT authentication with role check
    const { decoded, errorResponse } = handleJWTAuth(request, ['investor'])
    if (errorResponse) {
      return errorResponse
    }

    // Get user data including allowed_branches
    const userProfile = await query(`
      SELECT allowed_branches
      FROM karyawan
      WHERE id_karyawan = ?
    `, [decoded.id])

    if (userProfile.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let allowedBranches = userProfile[0].allowed_branches

    // Parse JSON if it's a string
    if (typeof allowedBranches === 'string') {
      try {
        allowedBranches = JSON.parse(allowedBranches)
      } catch (e) {
        console.error('Error parsing allowed_branches:', e)
        allowedBranches = []
      }
    }

    // If no branch restriction, return error (investor should have restrictions)
    if (!allowedBranches || !Array.isArray(allowedBranches) || allowedBranches.length === 0) {
      return NextResponse.json({ error: 'No branch access configured' }, { status: 403 })
    }

    // Get filter parameters from URL
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today'
    const paymentMethod = searchParams.get('payment_method') || 'all'

    console.log('Investor dashboard filters:', { period, paymentMethod, allowedBranches })

    // Parallel fetch for better performance with branch filtering
    const [
      dailyStats,
      branchPerformance
    ] = await Promise.all([
      getDailyStats(period, paymentMethod, allowedBranches),
      getBranchPerformance(period, paymentMethod, allowedBranches)
    ])

    return NextResponse.json({
      daily_stats: dailyStats,
      branch_performance: branchPerformance,
      allowed_branches: allowedBranches,
      last_updated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Investor dashboard error:', error)

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

async function getDailyStats(period = 'today', paymentMethod = 'all', allowedBranches = []) {
  let dateCondition = ''
  let params = []

  // Build date condition based on period
  switch (period) {
    case 'today':
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      dateCondition = 'DATE(tanggal_transaksi) = ?'
      params.push(today)
      break
    case 'week':
      dateCondition = 'DATE(tanggal_transaksi) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)'
      break
    case 'month':
      dateCondition = 'DATE(tanggal_transaksi) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)'
      break
  }

  // Build payment method condition
  let paymentCondition = ''
  if (paymentMethod !== 'all') {
    paymentCondition = ' AND metode_pembayaran = ?'
    params.push(paymentMethod)
  }

  // Build branch condition
  let branchCondition = ''
  if (allowedBranches.length > 0) {
    branchCondition = ` AND id_cabang IN (${allowedBranches.map(() => '?').join(',')})`
    params.push(...allowedBranches)
  }

  // Get overall stats
  const rows = await query(`
    SELECT
      COUNT(*) as total_transactions,
      COALESCE(SUM(total_keseluruhan), 0) as total_revenue,
      COUNT(DISTINCT id_pelanggan) as unique_customers,
      COALESCE(AVG(total_keseluruhan), 0) as avg_transaction
    FROM transaksi
    WHERE ${dateCondition}${paymentCondition}${branchCondition}
    AND status_transaksi = 'selesai'
  `, params)

  // Get payment method breakdown for the selected period (not just today)
  const paymentStats = await query(`
    SELECT
      metode_pembayaran,
      COUNT(*) as transactions,
      COALESCE(SUM(total_keseluruhan), 0) as revenue
    FROM transaksi
    WHERE ${dateCondition}${branchCondition}
    AND status_transaksi = 'selesai'
    GROUP BY metode_pembayaran
  `, [...params.filter(p => p !== paymentMethod), ...allowedBranches])

  // Process payment method breakdown
  const cashStats = paymentStats.find(p => p.metode_pembayaran === 'tunai') || { transactions: 0, revenue: 0 }
  const qrisStats = paymentStats.find(p => p.metode_pembayaran === 'qris') || { transactions: 0, revenue: 0 }

  return {
    ...(rows[0] || { total_transactions: 0, total_revenue: 0, unique_customers: 0, avg_transaction: 0 }),
    total_tunai: cashStats.revenue,
    total_qris: qrisStats.revenue
  }
}

async function getBranchPerformance(period = 'today', paymentMethod = 'all', allowedBranches = []) {
  let dateCondition = ''
  let params = []

  // Build date condition based on period
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

  // Build branch restriction
  const branchCondition = allowedBranches.length > 0 ?
    ` AND c.id_cabang IN (${allowedBranches.map(() => '?').join(',')})` : ''
  if (allowedBranches.length > 0) {
    params.push(...allowedBranches)
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
    WHERE c.status_aktif = 'aktif'${branchCondition}
    GROUP BY c.id_cabang, c.nama_cabang
    ORDER BY daily_revenue DESC
  `, params)

  // Get payment method breakdown for today per branch
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const paymentBreakdown = await query(`
    SELECT
      id_cabang,
      metode_pembayaran,
      COUNT(*) as transactions,
      COALESCE(SUM(total_keseluruhan), 0) as revenue
    FROM transaksi
    WHERE DATE(tanggal_transaksi) = ? AND id_cabang IN (${allowedBranches.map(() => '?').join(',')})
    AND status_transaksi = 'selesai'
    GROUP BY id_cabang, metode_pembayaran
  `, [today, ...allowedBranches])

  // Create payment breakdown map
  const paymentMap = {}
  paymentBreakdown.forEach(row => {
    if (!paymentMap[row.id_cabang]) {
      paymentMap[row.id_cabang] = { cash_revenue: 0, qris_revenue: 0, today_transactions: 0, today_revenue: 0 }
    }
    if (row.metode_pembayaran === 'tunai') {
      paymentMap[row.id_cabang].cash_revenue = row.revenue
    } else if (row.metode_pembayaran === 'qris') {
      paymentMap[row.id_cabang].qris_revenue = row.revenue
    }
    paymentMap[row.id_cabang].today_transactions += row.transactions
    paymentMap[row.id_cabang].today_revenue += row.revenue
  })

  return branches.map(branch => {
    const branchPayments = paymentMap[branch.id_cabang] || {
      cash_revenue: 0,
      qris_revenue: 0,
      today_transactions: 0,
      today_revenue: 0
    }

    return {
      ...branch,
      cash_revenue: branchPayments.cash_revenue,
      qris_revenue: branchPayments.qris_revenue,
      today_transactions: branchPayments.today_transactions,
      today_revenue: branchPayments.today_revenue
    }
  })
}