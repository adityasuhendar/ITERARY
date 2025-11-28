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

    // Get parameters
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'week'
    const branchId = searchParams.get('branch_id')
    const paymentMethod = searchParams.get('payment_method')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    

    // Build date conditions based on priority: dateRange > month+year > period
    let dateCondition = ''
    let groupBy = ''
    let dateFormat = ''
    let orderBy = ''
    let dateValue = ''
    
    if (startDate && endDate) {
      // Custom date range has highest priority
      dateCondition = 'AND DATE(t.tanggal_transaksi) >= ? AND DATE(t.tanggal_transaksi) <= ?'
      groupBy = 'transaction_date'
      dateFormat = 'DATE_FORMAT(transaction_date, "%d %b")'
      dateValue = 'transaction_date'
      orderBy = 'transaction_date'
    } else if (month && year && month !== '' && year !== '') {
      // Month + Year filter (only if both are specifically selected)
      dateCondition = 'AND YEAR(t.tanggal_transaksi) = ? AND MONTH(t.tanggal_transaksi) = ?'
      groupBy = 'transaction_date'
      dateFormat = 'DATE_FORMAT(transaction_date, "%d %b")'
      dateValue = 'transaction_date'
      orderBy = 'transaction_date'
    } else if (year && year !== '' && (!month || month === '')) {
      // Year only filter (when month is empty)
      dateCondition = 'AND YEAR(t.tanggal_transaksi) = ?'
      groupBy = 'transaction_date'
      dateFormat = 'DATE_FORMAT(transaction_date, "%d %b")'
      dateValue = 'transaction_date'
      orderBy = 'transaction_date'
    } else {
      // Default period-based filtering (when no specific month/year filters)
      switch (period) {
      case 'today':
        dateCondition = 'AND DATE(t.tanggal_transaksi) = CURDATE()'
        groupBy = 'transaction_date'
        dateFormat = 'DATE_FORMAT(transaction_date, "%d %b")'
        dateValue = 'transaction_date'
        orderBy = 'transaction_date'
        break
      case 'week':
        dateCondition = 'AND DATE(t.tanggal_transaksi) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)'
        groupBy = 'transaction_date'
        dateFormat = 'DATE_FORMAT(transaction_date, "%d %b")'
        dateValue = 'transaction_date'
        orderBy = 'transaction_date'
        break
      case 'month':
        dateCondition = 'AND DATE(t.tanggal_transaksi) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)'
        groupBy = 'transaction_date'
        dateFormat = 'DATE_FORMAT(transaction_date, "%d %b")'
        dateValue = 'transaction_date'
        orderBy = 'transaction_date'
        break
      case 'year':
        dateCondition = 'AND DATE(t.tanggal_transaksi) >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)'
        groupBy = 'transaction_year, transaction_month'
        dateFormat = 'DATE_FORMAT(CONCAT(transaction_year, "-", LPAD(transaction_month, 2, "0"), "-01"), "%b %Y")'
        dateValue = 'DATE(CONCAT(transaction_year, "-", LPAD(transaction_month, 2, "0"), "-01"))'
        orderBy = 'transaction_year, transaction_month'
        break
      default:
        dateCondition = 'AND DATE(t.tanggal_transaksi) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)'
        groupBy = 'transaction_date'
        dateFormat = 'DATE_FORMAT(transaction_date, "%d %b")'
        dateValue = 'transaction_date'
        orderBy = 'transaction_date'
      }
    }

    // Add branch and payment method filters if specified
    let branchCondition = ''
    let paymentCondition = ''
    let queryParams = []
    
    if (branchId) {
      branchCondition = 'AND t.id_cabang = ?'
      queryParams.push(branchId)
    }
    
    if (paymentMethod && paymentMethod !== 'all') {
      paymentCondition = 'AND t.metode_pembayaran = ?'
      queryParams.push(paymentMethod)
    }
    
    // Add date range parameters if specified
    if (startDate && endDate) {
      queryParams.push(startDate, endDate)
    } else if (month && year && month !== '' && year !== '') {
      queryParams.push(year, month)
    } else if (year && year !== '' && (!month || month === '')) {
      queryParams.push(year)
    }
    

    // Main query for payment trends with proper GROUP BY handling
    let trendsQuery = ''
    
    if (period === 'year') {
      trendsQuery = `
        SELECT 
          ${dateFormat} as date_label,
          ${dateValue} as date_value,
          ${paymentMethod && paymentMethod === 'tunai' ? 'COUNT(*)' : 'COUNT(CASE WHEN metode_pembayaran = \'tunai\' THEN 1 END)'} as tunai_count,
          ${paymentMethod && paymentMethod === 'qris' ? 'COUNT(*)' : 'COUNT(CASE WHEN metode_pembayaran = \'qris\' THEN 1 END)'} as qris_count,
          ${paymentMethod && paymentMethod === 'tunai' ? 'COALESCE(SUM(total_keseluruhan), 0)' : 'COALESCE(SUM(CASE WHEN metode_pembayaran = \'tunai\' THEN total_keseluruhan END), 0)'} as tunai_amount,
          ${paymentMethod && paymentMethod === 'qris' ? 'COALESCE(SUM(total_keseluruhan), 0)' : 'COALESCE(SUM(CASE WHEN metode_pembayaran = \'qris\' THEN total_keseluruhan END), 0)'} as qris_amount,
          COUNT(*) as total_transactions,
          COALESCE(SUM(total_keseluruhan), 0) as total_amount
        FROM (
          SELECT 
            YEAR(t.tanggal_transaksi) as transaction_year,
            MONTH(t.tanggal_transaksi) as transaction_month,
            t.metode_pembayaran,
            t.total_keseluruhan
          FROM transaksi t
          INNER JOIN cabang c ON t.id_cabang = c.id_cabang
          WHERE c.status_aktif = 'aktif' 
            ${dateCondition} 
            ${branchCondition}
            ${paymentCondition}
            AND t.status_transaksi IN ('lunas', 'selesai')
        ) AS monthly_data
        GROUP BY ${groupBy}
        ORDER BY ${orderBy} ASC
      `
    } else {
      trendsQuery = `
        SELECT 
          ${dateFormat} as date_label,
          ${dateValue} as date_value,
          ${paymentMethod && paymentMethod === 'tunai' ? 'COUNT(*)' : 'COUNT(CASE WHEN metode_pembayaran = \'tunai\' THEN 1 END)'} as tunai_count,
          ${paymentMethod && paymentMethod === 'qris' ? 'COUNT(*)' : 'COUNT(CASE WHEN metode_pembayaran = \'qris\' THEN 1 END)'} as qris_count,
          ${paymentMethod && paymentMethod === 'tunai' ? 'COALESCE(SUM(total_keseluruhan), 0)' : 'COALESCE(SUM(CASE WHEN metode_pembayaran = \'tunai\' THEN total_keseluruhan END), 0)'} as tunai_amount,
          ${paymentMethod && paymentMethod === 'qris' ? 'COALESCE(SUM(total_keseluruhan), 0)' : 'COALESCE(SUM(CASE WHEN metode_pembayaran = \'qris\' THEN total_keseluruhan END), 0)'} as qris_amount,
          COUNT(*) as total_transactions,
          COALESCE(SUM(total_keseluruhan), 0) as total_amount
        FROM (
          SELECT 
            DATE(t.tanggal_transaksi) as transaction_date,
            t.metode_pembayaran,
            t.total_keseluruhan
          FROM transaksi t
          INNER JOIN cabang c ON t.id_cabang = c.id_cabang
          WHERE c.status_aktif = 'aktif' 
            ${dateCondition} 
            ${branchCondition}
            ${paymentCondition}
            AND t.status_transaksi IN ('lunas', 'selesai')
        ) AS daily_data
        GROUP BY ${groupBy}
        ORDER BY ${orderBy} ASC
      `
    }



    
    const trends = await query(trendsQuery, queryParams)



    // Summary query for overall statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(t.total_keseluruhan), 0) as total_amount,
        ${paymentMethod && paymentMethod === 'tunai' ? 'COUNT(*)' : 'COUNT(CASE WHEN t.metode_pembayaran = \'tunai\' THEN 1 END)'} as tunai_transactions,
        ${paymentMethod && paymentMethod === 'qris' ? 'COUNT(*)' : 'COUNT(CASE WHEN t.metode_pembayaran = \'qris\' THEN 1 END)'} as qris_transactions,
        ${paymentMethod && paymentMethod === 'tunai' ? 'COALESCE(SUM(t.total_keseluruhan), 0)' : 'COALESCE(SUM(CASE WHEN t.metode_pembayaran = \'tunai\' THEN t.total_keseluruhan END), 0)'} as tunai_amount,
        ${paymentMethod && paymentMethod === 'qris' ? 'COALESCE(SUM(t.total_keseluruhan), 0)' : 'COALESCE(SUM(CASE WHEN t.metode_pembayaran = \'qris\' THEN t.total_keseluruhan END), 0)'} as qris_amount
      FROM transaksi t
      INNER JOIN cabang c ON t.id_cabang = c.id_cabang
      WHERE c.status_aktif = 'aktif' 
        ${dateCondition} 
        ${branchCondition}
        ${paymentCondition}
        AND t.status_transaksi IN ('lunas', 'selesai')
    `



    
    const summaryResult = await query(summaryQuery, queryParams)
    const summary = summaryResult[0]


    // Calculate percentages
    const tunaiPercentage = summary.total_transactions > 0 
      ? Math.round((summary.tunai_transactions / summary.total_transactions) * 100)
      : 0
    
    const qrisPercentage = summary.total_transactions > 0 
      ? Math.round((summary.qris_transactions / summary.total_transactions) * 100)
      : 0

    // Format trends data
    const formattedTrends = trends.map(trend => ({
      date: trend.date_label,
      date_value: trend.date_value,
      tunai: parseInt(trend.tunai_count),
      qris: parseInt(trend.qris_count),
      tunai_amount: parseFloat(trend.tunai_amount),
      qris_amount: parseFloat(trend.qris_amount),
      total_transactions: parseInt(trend.total_transactions),
      total_amount: parseFloat(trend.total_amount)
    }))

    // Fill missing dates for better visualization
    let filledTrends = formattedTrends
    if (period === 'week' || period === 'month') {

      filledTrends = fillMissingDates(formattedTrends, period)

      
      // Debug: Check for duplicates
      const dateCount = {}
      filledTrends.forEach(trend => {
        const dateKey = trend.date
        dateCount[dateKey] = (dateCount[dateKey] || 0) + 1
      })

    }

    const response = {
      trends: filledTrends,
      summary: {
        total_transactions: parseInt(summary.total_transactions),
        total_amount: parseFloat(summary.total_amount),
        tunai_transactions: parseInt(summary.tunai_transactions),
        qris_transactions: parseInt(summary.qris_transactions),
        tunai_amount: parseFloat(summary.tunai_amount),
        qris_amount: parseFloat(summary.qris_amount),
        tunai_percentage: tunaiPercentage,
        qris_percentage: qrisPercentage
      },
      period,
      branch_id: branchId,
      payment_method: paymentMethod,
      generated_at: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z'
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Payment trends API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Helper function to fill missing dates
function fillMissingDates(trends, period) {
  const filled = []
  const days = period === 'week' ? 7 : 30
  
  // Use Indonesia timezone (WIB = UTC+7)
  const today = new Date()
  // Convert to Indonesia timezone
  const indonesiaToday = new Date(today.getTime() + (7 * 60 * 60 * 1000))
  indonesiaToday.setUTCHours(0, 0, 0, 0)
  
  // Create a map of existing trends by date string for faster lookup
  const trendMap = new Map()
  trends.forEach(trend => {
    // Convert database UTC to Indonesia timezone for comparison
    const trendDate = new Date(trend.date_value)
    const indonesiaTrendDate = new Date(trendDate.getTime() + (7 * 60 * 60 * 1000))
    const dateKey = indonesiaTrendDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

    trendMap.set(dateKey, trend)
  })



  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(indonesiaToday)
    date.setUTCDate(date.getUTCDate() - i)
    
    const dateString = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

    
    if (trendMap.has(dateString)) {
      // Use existing trend data
      filled.push(trendMap.get(dateString))
    } else {
      // Add empty data for missing dates  
      // Convert back to Indonesia timezone for display
      const indonesiaDate = new Date(date.getTime() - (7 * 60 * 60 * 1000))
      filled.push({
        date: indonesiaDate.toLocaleDateString('id-ID', { 
          day: '2-digit', 
          month: 'short',
          timeZone: 'Asia/Jakarta'
        }),
        date_value: indonesiaDate,
        tunai: 0,
        qris: 0,
        tunai_amount: 0,
        qris_amount: 0,
        total_transactions: 0,
        total_amount: 0
      })
    }
  }

  return filled
}
