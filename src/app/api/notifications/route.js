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

    // Only kasir can access notifications
    if (decoded.role !== 'kasir' && decoded.jenis_karyawan !== 'kasir') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const userId = decoded.id || decoded.id_karyawan
    const cabangId = decoded.cabang_id

    console.log('🔍 Kasir notifications - User ID:', userId, 'Role:', decoded.role, 'Backup mode:', decoded.backup_mode)

    // Get notifications for this kasir (approved requests they made)
    const notifications = await query(`
      SELECT 
        al.id_audit,
        al.tabel_diubah as table_name,
        al.aksi as action_type,
        al.data_lama as old_values,
        al.data_baru as new_values,
        al.approval_status,
        al.approved_at,
        al.approved_by,
        al.approval_notes,
        al.waktu_aksi as timestamp,
        k.nama_karyawan as approved_by_name,
        CASE 
          WHEN al.approval_status = 'approved' THEN
            CASE 
              WHEN al.tabel_diubah = 'produk_tambahan' AND al.aksi = 'INSERT' THEN 'Request produk baru telah disetujui'
              WHEN al.tabel_diubah = 'produk_tambahan' AND al.aksi = 'UPDATE' THEN 'Request update produk telah disetujui' 
              WHEN al.tabel_diubah = 'produk_tambahan' AND al.aksi = 'DELETE' THEN 'Request hapus produk telah disetujui'
              WHEN al.tabel_diubah = 'stok_cabang' AND al.aksi = 'UPDATE' THEN 'Request update stok telah disetujui'
              WHEN al.tabel_diubah = 'stock_request' THEN 'Stock request telah disetujui'
              ELSE CONCAT(al.aksi, ' request telah disetujui')
            END
          WHEN al.approval_status = 'rejected' THEN
            CASE 
              WHEN al.tabel_diubah = 'produk_tambahan' AND al.aksi = 'INSERT' THEN 'Request produk baru ditolak'
              WHEN al.tabel_diubah = 'produk_tambahan' AND al.aksi = 'UPDATE' THEN 'Request update produk ditolak' 
              WHEN al.tabel_diubah = 'produk_tambahan' AND al.aksi = 'DELETE' THEN 'Request hapus produk ditolak'
              WHEN al.tabel_diubah = 'stok_cabang' AND al.aksi = 'UPDATE' THEN 'Request update stok ditolak'
              WHEN al.tabel_diubah = 'stock_request' THEN 'Stock request ditolak'
              ELSE CONCAT(al.aksi, ' request ditolak')
            END
          ELSE 'Request diproses'
        END as notification_message
      FROM audit_log al
      LEFT JOIN karyawan k ON al.approved_by = k.id_karyawan
      WHERE COALESCE(al.requested_by, al.id_karyawan) = ?
        AND al.approval_status IN ('approved', 'rejected')
        AND al.approved_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND al.notified_at IS NULL
      ORDER BY al.approved_at DESC
      LIMIT 20
    `, [userId])

    // Don't auto-mark as read - let user manually dismiss

    return NextResponse.json({
      notifications: notifications.map(notification => ({
        id: notification.id_audit,
        message: notification.notification_message,
        type: 'approval',
        timestamp: notification.approved_at,
        approved_by: notification.approved_by_name,
        approval_notes: notification.approval_notes,
        details: {
          table_name: notification.table_name,
          action_type: notification.action_type,
          record_id: notification.record_id
        },
        read: notification.notified_at !== null
      }))
    })

  } catch (error) {
    console.error('Notifications API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Mark specific notification as read
export async function PATCH(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || (decoded.role !== 'kasir' && decoded.jenis_karyawan !== 'kasir')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { action, notification_ids } = await request.json()
    const userId = decoded.id || decoded.id_karyawan

    if (action === 'mark_read' && notification_ids?.length > 0) {
      await query(`
        UPDATE audit_log 
        SET notified_at = NOW() 
        WHERE id_audit IN (${notification_ids.map(() => '?').join(',')})
        AND COALESCE(requested_by, id_karyawan) = ?
      `, [...notification_ids, userId])

      return NextResponse.json({ success: true, marked_count: notification_ids.length })
    }

    if (action === 'mark_all_read') {
      const result = await query(`
        UPDATE audit_log 
        SET notified_at = NOW() 
        WHERE COALESCE(requested_by, id_karyawan) = ?
        AND approval_status IN ('approved', 'rejected')
        AND notified_at IS NULL
      `, [userId])

      return NextResponse.json({ success: true, marked_count: result.affectedRows })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Mark notification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get count of unread notifications
export async function HEAD(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return new NextResponse(null, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || (decoded.role !== 'kasir' && decoded.jenis_karyawan !== 'kasir')) {
      return new NextResponse(null, { status: 403 })
    }

    const userId = decoded.id || decoded.id_karyawan

    const countResult = await query(`
      SELECT COUNT(*) as unread_count
      FROM audit_log 
      WHERE COALESCE(requested_by, id_karyawan) = ?
        AND approval_status IN ('approved', 'rejected')
        AND approved_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND notified_at IS NULL
    `, [userId])

    const unreadCount = countResult && countResult[0] ? countResult[0].unread_count || 0 : 0

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Unread-Count': unreadCount.toString()
      }
    })

  } catch (error) {
    console.error('Notification count error:', error)
    return new NextResponse(null, { status: 500 })
  }
}