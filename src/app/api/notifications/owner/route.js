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
    if (!user || (user.role !== 'owner' && user.jenis_karyawan !== 'owner')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get approved/rejected stock requests (notifications for owner about decisions made by collectors)
    const notifications = await query(`
      SELECT 
        al.id_audit,
        al.id_karyawan,
        al.data_baru as request_data,
        al.waktu_aksi as created_at,
        al.approved_at,
        al.approval_status,
        al.approved_by,
        al.approval_notes,
        k.nama_karyawan as kasir_name,
        c.nama_cabang as branch_name,
        approver.nama_karyawan as approved_by_name
      FROM audit_log al
      JOIN karyawan k ON al.id_karyawan = k.id_karyawan  
      LEFT JOIN cabang c ON k.id_cabang = c.id_cabang
      LEFT JOIN karyawan approver ON al.approved_by = approver.id_karyawan
      WHERE al.tabel_diubah = 'stock_request'
      AND al.aksi = 'UPDATE'
      AND al.approval_status IN ('approved', 'rejected')
      AND al.approved_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ORDER BY al.approved_at DESC
      LIMIT 20
    `)

    // Parse JSON data and create notification messages
    const parsedNotifications = notifications.map(notification => {
      try {
        const requestData = typeof notification.request_data === 'string' 
          ? JSON.parse(notification.request_data) 
          : notification.request_data

        // Create notification message
        const action = notification.approval_status === 'approved' ? 'disetujui' : 'ditolak'
        const actionIcon = notification.approval_status === 'approved' ? '✅' : '❌'
        
        let message = `${actionIcon} Stock request ${requestData.product_name || 'produk'} telah ${action}`
        if (notification.branch_name) {
          message += ` di ${notification.branch_name}`
        }
        if (notification.approved_by_name) {
          message += ` oleh ${notification.approved_by_name}`
        }

        return {
          id: notification.id_audit,
          message: message,
          type: 'stock_request_decision',
          timestamp: notification.approved_at,
          status: notification.approval_status,
          kasir_name: notification.kasir_name,
          branch_name: notification.branch_name || 'Unknown Branch',
          approved_by: notification.approved_by_name,
          approval_notes: notification.approval_notes,
          product_name: requestData.product_name,
          request_type: requestData.request_type,
          reason: requestData.reason
        }
      } catch (e) {
        console.error('Error parsing notification data:', e)
        return {
          id: notification.id_audit,
          message: '📋 Stock request decision received',
          type: 'stock_request_decision',
          timestamp: notification.approved_at,
          status: notification.approval_status,
          kasir_name: notification.kasir_name,
          branch_name: notification.branch_name || 'Unknown Branch'
        }
      }
    })

    return NextResponse.json({
      notifications: parsedNotifications,
      total: parsedNotifications.length
    })

  } catch (error) {
    console.error('Owner notifications API error:', error)
    
    // Handle JWT token expired specifically
    if (error.name === 'TokenExpiredError') {
      return NextResponse.json({ 
        error: 'jwt expired',
        expired: true,
        message: 'Token has expired, please login again'
      }, { status: 401 })
    }
    
    // Handle other JWT errors  
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ 
        error: 'Invalid token',
        expired: true,
        message: 'Invalid token, please login again'
      }, { status: 401 })
    }
    
    return NextResponse.json({ 
      error: 'Database error',
      message: error.message 
    }, { status: 500 })
  }
}

// Mark all owner notifications as read (clear notifications)
export async function PATCH(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user || (user.role !== 'owner' && user.jenis_karyawan !== 'owner')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { action } = await request.json()

    if (action === 'mark_all_read') {
      const result = await query(`
        UPDATE audit_log
        SET notified_at = NOW()
        WHERE tabel_diubah = 'stock_request'
        AND aksi = 'UPDATE'
        AND approval_status IN ('approved', 'rejected')
        AND approved_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND notified_at IS NULL
      `)

      return NextResponse.json({ success: true, marked_count: result.affectedRows })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Mark owner notifications error:', error)

    // Handle JWT token expired specifically
    if (error.name === 'TokenExpiredError') {
      return NextResponse.json({
        error: 'jwt expired',
        expired: true,
        message: 'Token has expired, please login again'
      }, { status: 401 })
    }

    // Handle other JWT errors
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({
        error: 'Invalid token',
        expired: true,
        message: 'Invalid token, please login again'
      }, { status: 401 })
    }

    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 })
  }
}