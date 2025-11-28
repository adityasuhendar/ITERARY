
// ============================================================================
// SOLUTION: REMOVE DATE FILTER - SHOW ALL BY DEFAULT
// ============================================================================

// FILE: src/app/api/dashboard/kasir/route.js (SIMPLIFIED)
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
    if (!user || user.role !== 'kasir') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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

    const currentShift = user.current_shift || user.shift || 'pagi'

    // 1. Get ALL transactions for this kasir's shift and cabang (NO DATE FILTER!)
    const transactionStats = await query(`
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(total_keseluruhan), 0) as total_revenue,
        COUNT(CASE WHEN metode_pembayaran = 'tunai' THEN 1 END) as tunai_count,
        COUNT(CASE WHEN metode_pembayaran = 'qris' THEN 1 END) as qris_count,
        COALESCE(SUM(CASE WHEN metode_pembayaran = 'tunai' THEN total_keseluruhan ELSE 0 END), 0) as tunai_revenue,
        COALESCE(SUM(CASE WHEN metode_pembayaran = 'qris' THEN total_keseluruhan ELSE 0 END), 0) as qris_revenue
      FROM transaksi 
      WHERE id_cabang = ? 
      AND shift_transaksi = ?
      AND status_transaksi = 'selesai'
    `, [cabangId, currentShift])

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

    // 4. Get stock alerts
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

    // 6. Get recent transactions (last 10, NO DATE FILTER!)
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
      AND t.shift_transaksi = ?
      AND t.status_transaksi = 'selesai'
      ORDER BY t.tanggal_transaksi DESC
      LIMIT 10
    `, [cabangId, currentShift])

    // 7. Get cabang info
    const cabangInfo = await query(`
      SELECT nama_cabang, alamat FROM cabang WHERE id_cabang = ?
    `, [cabangId])

    // Format response data
    const stats = transactionStats[0] || {}
    const machines = machineStats[0] || {}
    
    const dashboardData = {
      stats: {
        transactions: parseInt(stats.total_transactions) || 0,
        revenue: parseFloat(stats.total_revenue) || 0,
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
      last_updated: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z'
    }

    return NextResponse.json(dashboardData)

  } catch (error) {
    console.error('Kasir dashboard API error:', error)
    return NextResponse.json({
      error: 'Database error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}