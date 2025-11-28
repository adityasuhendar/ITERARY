import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'
import { sendPushNotificationDirect } from '@/lib/pushNotificationHelper'

// Approve/Reject stock request (Owner)
export async function PUT(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || !['owner', 'collector', 'super_admin'].includes(decoded.jenis_karyawan)) {
      return NextResponse.json({ error: 'Access denied. Owner or collector role required.' }, { status: 403 })
    }

    const requestId = (await params).id
    const body = await request.json()
    const { action, notes } = body // action: 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be approve or reject.' }, { status: 400 })
    }

    // Get the request
    const requestData = await query(`
      SELECT * FROM audit_log 
      WHERE id_audit = ? 
      AND tabel_diubah = 'stock_request'
      AND approval_status = 'pending'
      AND aksi = 'UPDATE'
    `, [requestId])

    if (requestData.length === 0) {
      return NextResponse.json({ error: 'Request not found or already processed' }, { status: 404 })
    }

    const stockRequest = requestData[0]
    const requestInfo = typeof stockRequest.data_baru === 'string' ? JSON.parse(stockRequest.data_baru) : stockRequest.data_baru
    const currentData = typeof stockRequest.data_lama === 'string' ? JSON.parse(stockRequest.data_lama) : stockRequest.data_lama

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    // Update approval status
    await query(`
      UPDATE audit_log 
      SET approval_status = ?, 
          approved_by = ?, 
          approval_notes = ?,
          approved_at = NOW()
      WHERE id_audit = ?
    `, [newStatus, decoded.id, notes || null, requestId])

    let result = { success: true, action: newStatus }

    // If approved, apply the changes
    if (action === 'approve') {
      const { request_type, id_produk, requested_data } = requestInfo

      try {
        if (request_type === 'update_stock') {
          // Update stock quantity
          await query(`
            UPDATE stok_cabang 
            SET stok_tersedia = ?, 
                terakhir_update = NOW()
            WHERE id_produk = ? AND id_cabang = (
              SELECT id_cabang FROM karyawan WHERE id_karyawan = ?
            )
          `, [requested_data.stok_tersedia, id_produk, stockRequest.id_karyawan])

        } else if (request_type === 'update_product') {
          // Update product info
          const updateFields = []
          const updateValues = []

          if (requested_data.nama_produk) {
            updateFields.push('nama_produk = ?')
            updateValues.push(requested_data.nama_produk)
          }
          if (requested_data.harga) {
            updateFields.push('harga = ?')
            updateValues.push(requested_data.harga)
          }
          if (requested_data.satuan) {
            updateFields.push('satuan = ?')
            updateValues.push(requested_data.satuan)
          }
          if (requested_data.kategori_produk) {
            updateFields.push('kategori_produk = ?')
            updateValues.push(requested_data.kategori_produk)
          }

          if (updateFields.length > 0) {
            updateValues.push(id_produk)
            await query(`
              UPDATE produk_tambahan 
              SET ${updateFields.join(', ')}
              WHERE id_produk = ?
            `, updateValues)
          }

          // Update stock data if provided
          const stockFields = []
          const stockValues = []
          
          if (requested_data.stok_tersedia !== undefined) {
            stockFields.push('stok_tersedia = ?')
            stockValues.push(requested_data.stok_tersedia)
          }
          if (requested_data.stok_minimum !== undefined) {
            stockFields.push('stok_minimum = ?')
            stockValues.push(requested_data.stok_minimum)
          }
          
          if (stockFields.length > 0) {
            stockFields.push('terakhir_update = NOW()')
            stockValues.push(id_produk, stockRequest.id_karyawan)
            await query(`
              UPDATE stok_cabang 
              SET ${stockFields.join(', ')}
              WHERE id_produk = ? AND id_cabang = (
                SELECT id_cabang FROM karyawan WHERE id_karyawan = ?
              )
            `, stockValues)
          }

        } else if (request_type === 'delete_product') {
          // Soft delete product
          await query(`
            UPDATE produk_tambahan 
            SET status_aktif = 'nonaktif' 
            WHERE id_produk = ?
          `, [id_produk])
        }

        // Log the actual change
        await query(`
          INSERT INTO audit_log (
            id_karyawan, 
            tabel_diubah, 
            aksi, 
            data_lama, 
            data_baru, 
            approval_status,
            ip_address
          ) VALUES (?, ?, 'UPDATE', ?, ?, 'auto_approved', ?)
        `, [
          decoded.id,
          request_type === 'delete_product' ? 'produk_tambahan' :
          request_type === 'update_product' ? 'produk_tambahan' : 'stok_cabang',
          JSON.stringify(currentData),
          JSON.stringify(requested_data),
          request.headers.get('x-forwarded-for') || 'unknown'
        ])

        result.message = 'Request approved and changes applied successfully'
        result.changes_applied = true

      } catch (applyError) {
        console.error('Error applying approved changes:', applyError)
        result.message = 'Request approved but failed to apply changes'
        result.changes_applied = false
        result.error = applyError.message
      }
    } else {
      result.message = 'Request rejected successfully'
    }

    // Send push notification to kasir
    try {
      const pushResult = await sendPushNotificationDirect({
        targetUserType: 'kasir',
        targetUserId: stockRequest.id_karyawan,
        notification: {
          title: action === 'approve' ? '✅ Request Disetujui!' : '❌ Request Ditolak',
          body: action === 'approve'
            ? `Request ${requestInfo.request_type === 'update_stock' ? 'tambah stok' : 'update produk'} Anda telah disetujui`
            : `Request ${requestInfo.request_type === 'update_stock' ? 'tambah stok' : 'update produk'} Anda ditolak: ${notes || 'Tidak ada catatan'}`,
          icon: action === 'approve' ? '✅' : '❌',
          tag: `stock-request-${requestId}`,
          url: '/dashboard',
          data: {
            requestId: requestId,
            action: action,
            requestType: requestInfo.request_type
          }
        }
      })

      if (pushResult.success) {
        console.log(`✅ Push notification sent for ${action} action`)
      } else {
        console.log(`⚠️ Push notification failed for ${action} action`)
      }
    } catch (pushError) {
      console.error('Push notification error:', pushError)
      // Don't fail the main request if push fails
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Stock request approval error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 })
  }
}