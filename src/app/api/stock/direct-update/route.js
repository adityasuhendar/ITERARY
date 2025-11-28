import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { handleJWTAuth } from '@/lib/jwtHandler'

export async function POST(request) {
  try {
    // Handle JWT authentication - only backup kasir can use this
    const { decoded, errorResponse } = handleJWTAuth(request, ['kasir'])
    if (errorResponse) {
      return errorResponse
    }

    // Only collector backup kasir can use direct update
    if (!decoded.backup_mode || decoded.original_role !== 'collector') {
      return NextResponse.json({ 
        error: 'Access denied. Collector backup kasir only.' 
      }, { status: 403 })
    }

    const { stockUpdates, reason } = await request.json()

    // Validate input
    if (!stockUpdates || Object.keys(stockUpdates).length === 0) {
      return NextResponse.json({ 
        error: 'No stock updates provided' 
      }, { status: 400 })
    }

    if (!reason || reason.trim() === '') {
      return NextResponse.json({ 
        error: 'Reason is required for stock updates' 
      }, { status: 400 })
    }

    const kasirId = decoded.id
    const branchId = decoded.cabang_id

    console.log('🔄 Direct stock update by collector backup kasir:', {
      kasirId,
      branchId,
      updatesCount: Object.keys(stockUpdates).length,
      backup_mode: decoded.backup_mode
    })

    const results = []
    const errors = []

    // Process each stock update
    for (const [productId, newStock] of Object.entries(stockUpdates)) {
      try {
        // Get current stock data
        const currentStockData = await query(`
          SELECT 
            sc.id_stok,
            sc.stok_tersedia as current_stock,
            pt.nama_produk,
            pt.satuan,
            c.nama_cabang
          FROM stok_cabang sc
          JOIN produk_tambahan pt ON sc.id_produk = pt.id_produk
          JOIN cabang c ON sc.id_cabang = c.id_cabang
          WHERE sc.id_produk = ? AND sc.id_cabang = ?
        `, [productId, branchId])

        if (currentStockData.length === 0) {
          errors.push(`Product ID ${productId} not found in branch stock`)
          continue
        }

        const currentStock = currentStockData[0]
        const stockChange = parseInt(newStock) - parseInt(currentStock.current_stock)

        if (stockChange === 0) {
          continue // No change needed
        }

        // Update stock directly
        await query(`
          UPDATE stok_cabang 
          SET stok_tersedia = ?,
              terakhir_update = NOW(),
              updated_by_karyawan = ?
          WHERE id_produk = ? AND id_cabang = ?
        `, [newStock, kasirId, productId, branchId])

        // Log the direct update in audit_log for tracking
        await query(`
          INSERT INTO audit_log (
            tabel_diubah,
            aksi,
            id_karyawan,
            data_lama,
            data_baru,
            approval_status,
            approved_by,
            approved_at,
            approval_notes,
            waktu_aksi,
            ip_address
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), ?)
        `, [
          'stok_cabang',
          'UPDATE',
          kasirId,
          JSON.stringify({
            id_produk: parseInt(productId),
            id_cabang: branchId,
            stok_tersedia: parseInt(currentStock.current_stock),
            nama_produk: currentStock.nama_produk,
            nama_cabang: currentStock.nama_cabang
          }),
          JSON.stringify({
            id_produk: parseInt(productId),
            id_cabang: branchId,
            stok_tersedia: parseInt(newStock),
            stok_change: stockChange,
            nama_produk: currentStock.nama_produk,
            nama_cabang: currentStock.nama_cabang
          }),
          'auto_approved',
          kasirId,
          `Direct update by collector backup kasir: ${reason}`,
          request.ip || 'unknown'
        ])

        results.push({
          productId: productId,
          productName: currentStock.nama_produk,
          oldStock: currentStock.current_stock,
          newStock: parseInt(newStock),
          stockChange: stockChange,
          success: true
        })

        console.log(`✅ Stock updated: ${currentStock.nama_produk} ${currentStock.current_stock} → ${newStock} (${stockChange > 0 ? '+' : ''}${stockChange})`)

      } catch (error) {
        console.error(`Error updating stock for product ${productId}:`, error)
        errors.push(`Failed to update product ID ${productId}: ${error.message}`)
      }
    }

    if (results.length === 0 && errors.length > 0) {
      return NextResponse.json({
        error: 'All stock updates failed',
        details: errors
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Direct stock update completed. ${results.length} products updated.`,
      results: results,
      errors: errors.length > 0 ? errors : undefined,
      kasir: {
        name: decoded.name,
        backup_mode: true,
        branch: decoded.cabang
      }
    })

  } catch (error) {
    console.error('Direct stock update API error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 })
  }
}