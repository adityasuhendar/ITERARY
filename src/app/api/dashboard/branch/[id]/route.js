import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { query } from '@/lib/database'

export async function GET(request, { params }) {
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

    // Check if user has access (owner, investor, or collector)
    if (!['owner', 'investor', 'collector'].includes(decoded.jenis_karyawan)) {
      return NextResponse.json(
        { error: 'Access denied. Owner, investor, or collector role required.' },
        { status: 403 }
      )
    }

    // Await params in Next.js 15
    const resolvedParams = await params
    const branchId = resolvedParams.id

    // Validate branch ID
    if (!branchId || isNaN(branchId)) {
      return NextResponse.json(
        { error: 'Invalid branch ID' },
        { status: 400 }
      )
    }

    // Check branch access for investor
    if (decoded.jenis_karyawan === 'investor') {
      // Get user's allowed branches
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

      // Check if investor has access to this branch
      if (!allowedBranches || !Array.isArray(allowedBranches) || !allowedBranches.includes(parseInt(branchId))) {
        return NextResponse.json(
          { error: 'Access denied. You do not have permission to view this branch.' },
          { status: 403 }
        )
      }
    }

    // Get params from query
    const { searchParams } = new URL(request.url)
    const period = parseInt(searchParams.get('period')) || 30

    // Get date range from query params, default to today
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    const dateFrom = searchParams.get('date_from') || today
    const dateTo = searchParams.get('date_to') || today

    // Parallel queries for better performance
    const [
      branchInfo,
      transactions,
      inventory,
      weeklyRevenue,
      weeklyFee,
      revenueBreakdown,
      todayExpenses
    ] = await Promise.all([
      // Branch basic info
      query(
        'SELECT * FROM cabang WHERE id_cabang = ?',
        [branchId]
      ),

      // Transactions for selected period (limited for overview)
      query(`
        SELECT
          t.*,
          p.nama_pelanggan,
          DATE_FORMAT(t.tanggal_transaksi, '%Y-%m-%d %H:%i:%s') as tanggal_transaksi_formatted,
          DATE_FORMAT(t.dibuat_pada, '%Y-%m-%d %H:%i:%s') as dibuat_pada_formatted
        FROM transaksi t
        LEFT JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
        WHERE t.id_cabang = ?
        AND DATE(t.tanggal_transaksi) BETWEEN ? AND ?
        ORDER BY t.tanggal_transaksi DESC
        LIMIT 20
      `, [branchId, dateFrom, dateTo]),

      // Inventory with stock levels
      query(`
        SELECT
          pt.nama_produk,
          pt.kategori_produk,
          pt.satuan,
          pt.harga,
          sc.stok_tersedia,
          sc.stok_minimum,
          DATE_FORMAT(sc.terakhir_update, '%Y-%m-%d %H:%i:%s') as terakhir_update_formatted,
          CASE
            WHEN sc.stok_tersedia = 0 THEN 'critical'
            WHEN sc.stok_tersedia <= sc.stok_minimum THEN 'low'
            WHEN sc.stok_tersedia <= sc.stok_minimum * 1.5 THEN 'warning'
            ELSE 'good'
          END as stock_status
        FROM stok_cabang sc
        JOIN produk_tambahan pt ON sc.id_produk = pt.id_produk
        WHERE sc.id_cabang = ?
        ORDER BY sc.stok_tersedia ASC, pt.nama_produk
      `, [branchId]),

      // Revenue data for 30 days (for both card & chart)
      query(`
        SELECT
          DATE(tanggal_transaksi) as date,
          DATE_FORMAT(DATE(tanggal_transaksi), '%Y-%m-%d') as date_formatted,
          COUNT(*) as transaction_count,
          COUNT(DISTINCT id_pelanggan) as customer_count,
          COALESCE(SUM(total_keseluruhan), 0) as daily_revenue_gross,
          COALESCE(SUM(CASE WHEN metode_pembayaran = 'tunai' THEN total_keseluruhan ELSE 0 END), 0) as tunai_revenue_gross,
          COALESCE(SUM(CASE WHEN metode_pembayaran = 'qris' THEN total_keseluruhan ELSE 0 END), 0) as qris_revenue_gross,
          COUNT(CASE WHEN metode_pembayaran = 'tunai' THEN 1 END) as tunai_transaction_count,
          COUNT(CASE WHEN metode_pembayaran = 'qris' THEN 1 END) as qris_transaction_count
        FROM transaksi
        WHERE id_cabang = ?
        AND tanggal_transaksi >= DATE_SUB(?, INTERVAL ? DAY)
        AND tanggal_transaksi <= CONCAT(?, ' 23:59:59')
        AND status_transaksi = 'selesai'
        GROUP BY DATE(tanggal_transaksi), DATE_FORMAT(DATE(tanggal_transaksi), '%Y-%m-%d')
        ORDER BY DATE(tanggal_transaksi) ASC
      `, [branchId, today, period, today]),

      // Fee data for 30 days (for both card & chart)
      query(`
        SELECT
          DATE(t.tanggal_transaksi) as date,
          DATE_FORMAT(DATE(t.tanggal_transaksi), '%Y-%m-%d') as date_formatted,
          COALESCE(SUM(dtl.fee_kasir), 0) as daily_fee,
          COUNT(DISTINCT CASE WHEN dtl.id_jenis_layanan = 4 AND dtl.fee_kasir > 0 THEN dtl.id_detail_layanan END) as ckl_count
        FROM detail_transaksi_layanan dtl
        JOIN transaksi t ON dtl.id_transaksi = t.id_transaksi
        WHERE t.id_cabang = ?
        AND t.tanggal_transaksi >= DATE_SUB(?, INTERVAL ? DAY)
        AND t.tanggal_transaksi <= CONCAT(?, ' 23:59:59')
        AND t.status_transaksi = 'selesai'
        AND dtl.fee_kasir > 0
        GROUP BY DATE(t.tanggal_transaksi), DATE_FORMAT(DATE(t.tanggal_transaksi), '%Y-%m-%d')
        ORDER BY DATE(t.tanggal_transaksi) ASC
      `, [branchId, today, period, today]),

      // Revenue breakdown (layanan vs produk) for period
      query(`
        SELECT
          COALESCE(SUM(total_layanan), 0) as pendapatan_layanan,
          COALESCE(SUM(total_produk), 0) as pendapatan_produk
        FROM transaksi
        WHERE id_cabang = ?
        AND DATE(tanggal_transaksi) BETWEEN ? AND ?
        AND status_transaksi = 'selesai'
      `, [branchId, dateFrom, dateTo]),

      // Expenses for period by kategori
      query(`
        SELECT
          kategori,
          COALESCE(SUM(jumlah), 0) as total_jumlah
        FROM pengeluaran
        WHERE id_cabang = ?
        AND DATE(tanggal) BETWEEN ? AND ?
        GROUP BY kategori
        ORDER BY kategori
      `, [branchId, dateFrom, dateTo])
    ])

    // Check if branch exists
    if (branchInfo.length === 0) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      )
    }

    // Process period data with net revenue calculation
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
    const chartData = []

    // Calculate period data from weeklyRevenue and weeklyFee
    let periodData = {
      revenue_gross: 0,
      revenue_net: 0,
      fee: 0,
      transactions: 0,
      customers: 0,
      tunai_revenue_gross: 0,
      qris_revenue_gross: 0,
      tunai_transactions: 0,
      qris_transactions: 0,
      ckl_count: 0
    }

    // Calculate yesterday date for growth comparison
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    let yesterdayData = null

    // Loop through 30 days and calculate net revenue
    for (let i = period - 1; i >= 0; i--) {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() - i)
      const dateStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

      // Get data from queries
      const revenueData = weeklyRevenue.find(row => row.date_formatted === dateStr)
      const feeData = weeklyFee.find(row => row.date_formatted === dateStr)

      // Calculate gross and net
      const grossRevenue = revenueData ? parseFloat(revenueData.daily_revenue_gross) : 0
      const fee = feeData ? parseFloat(feeData.daily_fee) : 0
      const netRevenue = grossRevenue - fee

      // Prepare day data
      const dayOfWeek = targetDate.getDay()
      const displayLabel = dayNames[dayOfWeek]
      const dateFormatted = targetDate.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit'
      })

      const dayInfo = {
        date: dateStr,
        date_formatted: dateFormatted,
        day: displayLabel,
        revenue_gross: grossRevenue,
        revenue_net: netRevenue,
        fee: fee,
        transactions: revenueData ? parseInt(revenueData.transaction_count) : 0,
        customers: revenueData ? parseInt(revenueData.customer_count) : 0,
        tunai_revenue_gross: revenueData ? parseFloat(revenueData.tunai_revenue_gross) : 0,
        qris_revenue_gross: revenueData ? parseFloat(revenueData.qris_revenue_gross) : 0,
        tunai_transactions: revenueData ? parseInt(revenueData.tunai_transaction_count) : 0,
        qris_transactions: revenueData ? parseInt(revenueData.qris_transaction_count) : 0,
        ckl_count: feeData ? parseInt(feeData.ckl_count) : 0
      }

      // Aggregate period data (dateFrom to dateTo)
      const currentDate = new Date(dateStr)
      const fromDate = new Date(dateFrom)
      const toDate = new Date(dateTo)

      if (currentDate >= fromDate && currentDate <= toDate) {
        periodData.revenue_gross += grossRevenue
        periodData.revenue_net += netRevenue
        periodData.fee += fee
        periodData.transactions += dayInfo.transactions
        periodData.customers += dayInfo.customers
        periodData.tunai_revenue_gross += dayInfo.tunai_revenue_gross
        periodData.qris_revenue_gross += dayInfo.qris_revenue_gross
        periodData.tunai_transactions += dayInfo.tunai_transactions
        periodData.qris_transactions += dayInfo.qris_transactions
        periodData.ckl_count += dayInfo.ckl_count
      }

      // Store yesterday's data for growth comparison
      if (dateStr === yesterdayStr) {
        yesterdayData = dayInfo
      }

      // Add to chart (chart uses gross revenue)
      // Hide day name if period > 30 days, show date only
      chartData.push({
        day: period > 30 ? '' : displayLabel,
        date: dateFormatted,
        revenue: Math.round(grossRevenue), // GROSS REVENUE for chart
        transactions: dayInfo.transactions
      })
    }

    // Fallback for yesterday data
    if (!yesterdayData) {
      yesterdayData = {
        revenue_net: 0,
        transactions: 0
      }
    }

    // Calculate growth percentage (based on NET revenue)
    const growthPercentage = yesterdayData.revenue_net > 0
      ? Math.round(((periodData.revenue_net - yesterdayData.revenue_net) / yesterdayData.revenue_net) * 100)
      : 0

    // Calculate average transaction (based on NET revenue)
    const avgTransaction = periodData.transactions > 0
      ? periodData.revenue_net / periodData.transactions
      : 0

    // Get revenue breakdown for today
    const pendapatanLayanan = parseFloat(revenueBreakdown[0]?.pendapatan_layanan || 0)
    const pendapatanProduk = parseFloat(revenueBreakdown[0]?.pendapatan_produk || 0)

    // Calculate total expenses
    const totalExpenses = todayExpenses.reduce((sum, exp) => sum + parseFloat(exp.total_jumlah), 0)

    // Calculate pendapatan bersih (revenue - fee - expenses)
    const pendapatanBersih = periodData.revenue_gross - periodData.fee - totalExpenses

    // Calculate tunai bersih (tunai gross - fee - expenses)
    const tunaiBersih = periodData.tunai_revenue_gross - periodData.fee - totalExpenses

    // Prepare response data
    const responseData = {
      branch_info: branchInfo[0],
      transactions: transactions,
      inventory: inventory,
      stats: {
        daily_revenue: periodData.revenue_net, // NET revenue for period
        daily_transactions: periodData.transactions,
        daily_customers: periodData.customers,
        daily_tunai_revenue: periodData.tunai_revenue_gross,
        daily_tunai_transactions: periodData.tunai_transactions,
        daily_qris_revenue: periodData.qris_revenue_gross,
        daily_qris_transactions: periodData.qris_transactions,
        yesterday_revenue: yesterdayData.revenue_net, // NET revenue
        yesterday_transactions: yesterdayData.transactions,
        growth_percentage: growthPercentage,
        avg_transaction: avgTransaction
      },
      revenue_breakdown: {
        // Pendapatan Kotor
        total_pendapatan: periodData.revenue_gross,

        // Breakdown by Payment Method
        pendapatan_tunai: periodData.tunai_revenue_gross,
        transaksi_tunai: periodData.tunai_transactions,
        pendapatan_qris: periodData.qris_revenue_gross,
        transaksi_qris: periodData.qris_transactions,

        // Breakdown by Type
        pendapatan_layanan: pendapatanLayanan,
        pendapatan_produk: pendapatanProduk,

        // Fee & CKL
        fee_kasir: periodData.fee,
        ckl_count: periodData.ckl_count,

        // Expenses
        expenses: todayExpenses.map(exp => ({
          kategori: exp.kategori,
          jumlah: parseFloat(exp.total_jumlah)
        })),
        total_expenses: totalExpenses,

        // Net Revenue
        pendapatan_bersih: pendapatanBersih,
        tunai_bersih: tunaiBersih,

        // Total Transactions
        total_transaksi: periodData.transactions
      },
      weekly_chart: chartData, // Chart with NET revenue
      last_updated: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z'
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Branch detail API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}