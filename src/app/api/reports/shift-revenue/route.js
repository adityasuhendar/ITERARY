import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { handleJWTAuth } from '@/lib/jwtHandler'

export async function GET(request) {
  try {
    // Handle JWT authentication with role check
    const { decoded, errorResponse } = handleJWTAuth(request, ['owner', 'collector', 'super_admin'])
    if (errorResponse) {
      return errorResponse
    }

    const { searchParams } = new URL(request.url)
    const selectedDate = searchParams.get('date')

    if (!selectedDate) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 })
    }

    // Get all active branches first with custom ordering
    const allBranches = await query(`
      SELECT id_cabang, nama_cabang
      FROM cabang 
      WHERE status_aktif = 'aktif'
      ORDER BY FIELD(nama_cabang, 'Tanjung Senang', 'Panglima Polim', 'Sukarame', 'Korpri', 'Gedong Meneng', 'Untung', 'Komarudin'), nama_cabang
    `)

    // Get shift revenue data for the selected date
    const shiftRevenueRows = await query(`
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
        AND DATE(t.dibuat_pada) = ?
        AND t.status_transaksi = 'selesai'
      WHERE c.status_aktif = 'aktif'
      GROUP BY c.id_cabang, c.nama_cabang, t.shift_transaksi
      HAVING total_transactions > 0
      ORDER BY FIELD(c.nama_cabang, 'Tanjung Senang', 'Panglima Polim', 'Sukarame', 'Korpri', 'Gedong Meneng', 'Untung', 'Komarudin'), t.shift_transaksi
    `, [selectedDate])

    // Get daily stats for the selected date
    const dailyStatsRows = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN metode_pembayaran = 'tunai' THEN total_keseluruhan ELSE 0 END), 0) as total_tunai,
        COALESCE(SUM(CASE WHEN metode_pembayaran = 'qris' THEN total_keseluruhan ELSE 0 END), 0) as total_qris,
        COALESCE(SUM(total_keseluruhan), 0) as total_revenue,
        COUNT(*) as total_transactions,
        COUNT(DISTINCT id_cabang) as active_branches,
        COUNT(CASE WHEN shift_transaksi = 'pagi' THEN 1 END) as pagi_transactions,
        COUNT(CASE WHEN shift_transaksi = 'malam' THEN 1 END) as malam_transactions
      FROM transaksi 
      WHERE DATE(dibuat_pada) = ?
      AND status_transaksi = 'selesai'
    `, [selectedDate])

    // Group shift data
    const shifts = {
      pagi: [],
      malam: []
    }

    shiftRevenueRows.forEach(row => {
      if (row.shift && shifts[row.shift]) {
        shifts[row.shift].push(row)
      }
    })

    const dailyStats = dailyStatsRows[0] || {
      total_tunai: 0,
      total_qris: 0, 
      total_revenue: 0,
      total_transactions: 0,
      active_branches: 0,
      pagi_transactions: 0,
      malam_transactions: 0
    }

    return NextResponse.json({
      success: true,
      date: selectedDate,
      revenue_by_shift: shifts,
      daily_stats: dailyStats,
      all_branches: allBranches,
      last_updated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching shift revenue:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message }, 
      { status: 500 }
    )
  }
}