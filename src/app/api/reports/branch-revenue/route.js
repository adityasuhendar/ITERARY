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

    // Build WHERE clause based on filters
    let whereClause = 'WHERE DATE(t.dibuat_pada) = ?'
    let queryParams = [selectedDate]

    // Query manual total cuci from audit_log (join karyawan untuk dapat id_cabang)
    // Sum the difference between new and old total_cuci to get total nota adjusted
    const manualAdjustmentQuery = `
      SELECT
        k.id_cabang,
        SUM(
          JSON_EXTRACT(al.data_baru, '$.new_total_cuci') -
          JSON_EXTRACT(al.data_lama, '$.old_total_cuci')
        ) as tukar_nota_count
      FROM audit_log al
      JOIN karyawan k ON al.id_karyawan = k.id_karyawan
      WHERE al.tabel_diubah = 'customer_total_cuci_manual'
        AND al.aksi = 'UPDATE'
        AND DATE(al.waktu_aksi) = ?
      GROUP BY k.id_cabang
    `

    const manualAdjustments = await query(manualAdjustmentQuery, [selectedDate])

    // Map to branch
    const tukarNotaMap = {}
    manualAdjustments.forEach(row => {
      tukarNotaMap[row.id_cabang] = parseInt(row.tukar_nota_count) || 0
    })

    // Query to get revenue data per branch with fee_kasir using SUBQUERY
    const revenueQuery = `
      SELECT
        c.id_cabang,
        c.nama_cabang,
        c.alamat,
        COUNT(DISTINCT t.id_transaksi) as total_transactions,
        COALESCE(SUM(t.total_keseluruhan), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN t.metode_pembayaran = 'tunai' THEN t.total_keseluruhan ELSE 0 END), 0) as tunai_revenue,
        COALESCE(SUM(CASE WHEN t.metode_pembayaran = 'qris' THEN t.total_keseluruhan ELSE 0 END), 0) as qris_revenue,
        COUNT(DISTINCT CASE WHEN t.metode_pembayaran = 'tunai' THEN t.id_transaksi END) as tunai_transactions,
        COUNT(DISTINCT CASE WHEN t.metode_pembayaran = 'qris' THEN t.id_transaksi END) as qris_transactions,
        COALESCE((
          SELECT SUM(dtl.fee_kasir)
          FROM detail_transaksi_layanan dtl
          WHERE dtl.id_transaksi = t.id_transaksi
        ), 0) as fee_kasir,
        COALESCE((
          SELECT COUNT(DISTINCT dtl.id_detail_layanan)
          FROM detail_transaksi_layanan dtl
          WHERE dtl.id_transaksi = t.id_transaksi 
            AND dtl.id_jenis_layanan = 4 
            AND dtl.fee_kasir > 0
        ), 0) as ckl_count,
        DATE(t.dibuat_pada) as transaction_date
      FROM cabang c
      LEFT JOIN transaksi t ON c.id_cabang = t.id_cabang 
        AND DATE(t.dibuat_pada) = ?
        AND t.status_transaksi = 'selesai'
      WHERE c.status_aktif = 'aktif'
      GROUP BY c.id_cabang, c.nama_cabang, c.alamat, t.id_transaksi, DATE(t.dibuat_pada)
      ORDER BY c.id_cabang ASC
    `

    const revenueData = await query(revenueQuery, [...queryParams, ...queryParams])

    // Aggregate data per branch (karena sekarang ada multiple rows per branch)
    const branchMap = {}
    
    revenueData.forEach(row => {
      const branchId = row.id_cabang
      
      if (!branchMap[branchId]) {
        branchMap[branchId] = {
          id_cabang: row.id_cabang,
          nama_cabang: row.nama_cabang,
          alamat: row.alamat,
          total_transactions: 0,
          total_revenue: 0,
          tunai_revenue: 0,
          qris_revenue: 0,
          tunai_transactions: 0,
          qris_transactions: 0,
          fee_kasir: 0,
          ckl_count: 0,
          tukar_nota_count: tukarNotaMap[branchId] || 0,
          transaction_date: row.transaction_date
        }
      }
      
      branchMap[branchId].total_transactions += parseInt(row.total_transactions) || 0
      branchMap[branchId].total_revenue += parseFloat(row.total_revenue) || 0
      branchMap[branchId].tunai_revenue += parseFloat(row.tunai_revenue) || 0
      branchMap[branchId].qris_revenue += parseFloat(row.qris_revenue) || 0
      branchMap[branchId].tunai_transactions += parseInt(row.tunai_transactions) || 0
      branchMap[branchId].qris_transactions += parseInt(row.qris_transactions) || 0
      branchMap[branchId].fee_kasir += parseFloat(row.fee_kasir) || 0
      branchMap[branchId].ckl_count += parseInt(row.ckl_count) || 0
    })

    // Format the data
    const formattedData = Object.values(branchMap).map(branch => {
      const totalRevenue = parseFloat(branch.total_revenue) || 0
      const feeKasir = parseFloat(branch.fee_kasir) || 0
      const netRevenue = totalRevenue - feeKasir

      return {
        ...branch,
        total_revenue: totalRevenue,
        fee_kasir: feeKasir,
        net_revenue: netRevenue
      }
    })

    return NextResponse.json({
      success: true,
      revenue: formattedData,
      date: selectedDate,
      total_branches: formattedData.length,
      total_revenue_gross: formattedData.reduce((sum, item) => sum + item.total_revenue, 0),
      total_fee_kasir: formattedData.reduce((sum, item) => sum + item.fee_kasir, 0),
      total_revenue_net: formattedData.reduce((sum, item) => sum + item.net_revenue, 0),
      total_transactions: formattedData.reduce((sum, item) => sum + item.total_transactions, 0),
      total_ckl: formattedData.reduce((sum, item) => sum + item.ckl_count, 0),
      total_qris: formattedData.reduce((sum, item) => sum + item.qris_revenue, 0),
      total_tukar_nota: formattedData.reduce((sum, item) => sum + (item.tukar_nota_count || 0), 0)
    })

  } catch (error) {
    console.error('Error fetching branch revenue:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message }, 
      { status: 500 }
    )
  }
}