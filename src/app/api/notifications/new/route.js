import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'

// Check for new notifications since last check
export async function POST(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || (decoded.role !== 'kasir' && decoded.jenis_karyawan !== 'kasir')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { since } = await request.json()
    const userId = decoded.id || decoded.id_karyawan

    if (!since) {
      return NextResponse.json({ error: 'Missing since parameter' }, { status: 400 })
    }

    // Get new notifications since the specified time
    const newNotifications = await query(`
      SELECT 
        al.id_audit,
        al.tabel_diubah as table_name,
        al.aksi as action_type,
        al.approval_status,
        al.approved_at,
        al.approved_by,
        al.waktu_aksi as timestamp,
        k.nama_pekerja as approved_by_name,
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
        AND al.approved_at > ?
        AND al.approved_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND al.notified_at IS NULL
      ORDER BY al.approved_at DESC
      LIMIT 10
    `, [userId, since])

    const formattedNotifications = newNotifications.map(notification => ({
      id: notification.id_audit,
      message: notification.notification_message,
      type: notification.approval_status === 'approved' ? 'approval' : 'rejection',
      timestamp: notification.approved_at,
      approved_by: notification.approved_by_name,
      details: {
        table_name: notification.table_name,
        action_type: notification.action_type
      }
    }))

    return NextResponse.json({
      new_notifications: formattedNotifications,
      count: formattedNotifications.length,
      since
    })

  } catch (error) {
    console.error('New notifications API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}