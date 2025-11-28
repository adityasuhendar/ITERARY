import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken } from '@/lib/auth'

export async function GET(request) {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }
    
    if (user.role !== 'kasir') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's cabang_id from database if not in token
    let cabangId = user.cabang_id
    if (!cabangId) {
      const userData = await query(
        'SELECT id_cabang FROM karyawan WHERE id_karyawan = ?',
        [user.id]
      )
      cabangId = userData[0]?.id_cabang
    }

    if (!cabangId) {
      return NextResponse.json({ error: 'Cabang not found' }, { status: 400 })
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) // YYYY-MM-DD format in WIB
    
    // Get shift from request query parameter (sent from frontend) or fallback to JWT/default
    const { searchParams } = new URL(request.url)
    const requestedShift = searchParams.get('shift')
    const currentShift = requestedShift || user.current_shift || user.shift || 'pagi'

    // 1. Get today's transactions for this cabang
    const transactionStats = await query(`
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(total_keseluruhan), 0) as total_revenue,
        COUNT(CASE WHEN metode_pembayaran = 'tunai' THEN 1 END) as tunai_count,
        COUNT(CASE WHEN metode_pembayaran = 'qris' THEN 1 END) as qris_count,
        COALESCE(SUM(CASE WHEN metode_pembayaran = 'tunai' THEN total_keseluruhan ELSE 0 END), 0) as tunai_revenue,
        COALESCE(SUM(CASE WHEN metode_pembayaran = 'qris' THEN total_keseluruhan ELSE 0 END), 0) as qris_revenue
      FROM transaksi
      WHERE DATE(tanggal_transaksi) = ?
      AND id_cabang = ?
      AND status_transaksi = 'selesai'
    `, [today, cabangId])

    // 1a. Get today's total branch revenue (all shifts)
    const branchRevenueStats = await query(`
      SELECT
        COALESCE(SUM(total_keseluruhan), 0) as branch_revenue
      FROM transaksi
      WHERE DATE(tanggal_transaksi) = ?
      AND id_cabang = ?
      AND status_transaksi = 'selesai'
    `, [today, cabangId])

    // 1b. Get fee kasir cabang (from CKL services)
    const feeKasirStats = await query(`
      SELECT
        COALESCE(SUM(dtl.fee_kasir), 0) as fee_kasir_shift,
        COUNT(DISTINCT CASE WHEN dtl.id_jenis_layanan = 4 AND dtl.fee_kasir > 0 THEN dtl.id_detail_layanan END) as ckl_count
      FROM detail_transaksi_layanan dtl
      JOIN transaksi t ON t.id_transaksi = dtl.id_transaksi
      WHERE DATE(t.tanggal_transaksi) = ?
        AND t.id_cabang = ?
        AND t.status_transaksi = 'selesai'
        AND dtl.fee_kasir > 0
    `, [today, cabangId])

    // 2. Get machine status for this cabang
    const machineStats = await query(`
      SELECT 
        COUNT(*) as total_machines,
        COUNT(CASE WHEN status_mesin = 'tersedia' THEN 1 END) as available,
        COUNT(CASE WHEN status_mesin = 'digunakan' THEN 1 END) as in_use,
        COUNT(CASE WHEN status_mesin = 'maintenance' THEN 1 END) as maintenance,
        COUNT(CASE WHEN status_mesin = 'rusak' THEN 1 END) as broken
      FROM mesin_laundry 
      WHERE id_cabang = ?
    `, [cabangId])

    // 3. Get detailed machine list
  // Replace line 67-79 with this:
  const machineList = await query(`
    SELECT 
      id_mesin,
      nomor_mesin,
      jenis_mesin,
      status_mesin,
      terakhir_maintenance,
      diupdate_pada
    FROM mesin_laundry 
    WHERE id_cabang = ?
    ORDER BY jenis_mesin, nomor_mesin
  `, [cabangId])

    // 4. Get stock alerts (items at or below minimum)
    const stockAlerts = await query(`
      SELECT COUNT(*) as alert_count
      FROM stok_cabang sc
      WHERE sc.id_cabang = ? 
      AND sc.stok_tersedia <= sc.stok_minimum
    `, [cabangId])

    // 5. Get detailed inventory with status
    const inventoryList = await query(`
      SELECT 
        pt.id_produk,
        pt.nama_produk,
        pt.satuan,
        pt.kategori_produk,
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
      WHERE sc.id_cabang = ?
      AND pt.status_aktif = 'aktif'
      ORDER BY 
        CASE 
          WHEN sc.stok_tersedia = 0 THEN 1
          WHEN sc.stok_tersedia <= sc.stok_minimum THEN 2
          WHEN sc.stok_tersedia <= (sc.stok_minimum * 1.5) THEN 3
          ELSE 4
        END,
        sc.stok_tersedia ASC
    `, [cabangId])

    // 6. Get recent transactions (last 5)
    const recentTransactions = await query(`
      SELECT 
        t.id_transaksi,
        t.kode_transaksi,
        t.tanggal_transaksi,
        t.total_keseluruhan,
        t.metode_pembayaran,
        p.nama_pelanggan,
        k.nama_karyawan
      FROM transaksi t
      JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
      JOIN karyawan k ON t.id_karyawan = k.id_karyawan
      WHERE t.id_cabang = ?
      AND DATE(t.tanggal_transaksi) = ?
      AND t.shift_transaksi = ?
      AND t.status_transaksi = 'selesai'
      ORDER BY t.tanggal_transaksi DESC
      LIMIT 5
    `, [cabangId, today, currentShift])

    // 7. Get cabang info
    const cabangInfo = await query(`
      SELECT nama_cabang, alamat FROM cabang WHERE id_cabang = ?
    `, [cabangId])

    // Format response data
    const stats = transactionStats[0] || {}
    const machines = machineStats[0] || {}
    const branchRevenue = branchRevenueStats[0] || {}
    const feeKasir = feeKasirStats[0] || {}

    const dashboardData = {
      stats: {
        transactions: parseInt(stats.total_transactions) || 0,
        revenue: parseFloat(stats.total_revenue) || 0,
        branch_revenue: parseFloat(branchRevenue.branch_revenue) || 0,
        fee_kasir_shift: parseFloat(feeKasir.fee_kasir_shift) || 0,
        ckl_count: parseInt(feeKasir.ckl_count) || 0,
        revenue_breakdown: {
          tunai: parseFloat(stats.tunai_revenue) || 0,
          qris: parseFloat(stats.qris_revenue) || 0,
          tunai_count: parseInt(stats.tunai_count) || 0,
          qris_count: parseInt(stats.qris_count) || 0
        },
        machines: {
          total: parseInt(machines.total_machines) || 0,
          available: parseInt(machines.available) || 0,
          in_use: parseInt(machines.in_use) || 0,
          active: parseInt(machines.in_use) || 0,
          maintenance: parseInt(machines.maintenance) || 0,
          broken: parseInt(machines.broken) || 0
        },
        stock_alerts: parseInt(stockAlerts[0]?.alert_count) || 0
      },
      machines: machineList.map(machine => ({
        id: machine.id_mesin,
        nomor_mesin: machine.nomor_mesin,
        jenis_mesin: machine.jenis_mesin,
        status_mesin: machine.status_mesin,
        terakhir_maintenance: machine.terakhir_maintenance,
        diupdate_pada: machine.diupdate_pada
      })),
      inventory: inventoryList.map(item => ({
        id: item.id_produk,
        nama_produk: item.nama_produk,
        satuan: item.satuan,
        kategori_produk: item.kategori_produk,
        stok_tersedia: item.stok_tersedia,
        stok_minimum: item.stok_minimum,
        status: item.status,
        terakhir_update: item.terakhir_update
      })),
      recent_transactions: recentTransactions.map(tx => ({
        id: tx.id_transaksi,
        code: tx.kode_transaksi,
        date: tx.tanggal_transaksi,
        amount: parseFloat(tx.total_keseluruhan),
        payment_method: tx.metode_pembayaran,
        customer: tx.nama_pelanggan,
        cashier: tx.nama_karyawan
      })),
      cabang_info: {
        name: cabangInfo[0]?.nama_cabang || 'Unknown',
        address: cabangInfo[0]?.alamat || ''
      },
      shift: currentShift,
      date: today,
      last_updated: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z'
    }

    return NextResponse.json(dashboardData)

  } catch (error) {
    console.error('Kasir dashboard API error:', error)
    
    // Return detailed error for debugging
    return NextResponse.json({
      error: 'Database error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

// POST method for updating machine status (bonus feature)
export async function POST(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user || user.role !== 'kasir') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { machine_id, new_status } = await request.json()

    if (!machine_id || !new_status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate status
    const validStatuses = ['tersedia', 'digunakan', 'maintenance', 'rusak']
    if (!validStatuses.includes(new_status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Update machine status
    await query(`
      UPDATE mesin_laundry 
      SET status_mesin = ?, 
          updated_by_karyawan = ?,
          diupdate_pada = NOW()
      WHERE id_mesin = ?
    `, [new_status, user.id, machine_id])

    return NextResponse.json({ 
      success: true, 
      message: 'Machine status updated successfully' 
    })

  } catch (error) {
    console.error('Machine update error:', error)
    return NextResponse.json({
      error: 'Update failed',
      message: error.message
    }, { status: 500 })
  }
}