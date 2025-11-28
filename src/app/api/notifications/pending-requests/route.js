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
    // Allow owner and collector to see pending requests
    const allowedRoles = ['owner', 'collector']
    if (!user || (!allowedRoles.includes(user.role) && !allowedRoles.includes(user.jenis_karyawan))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get pending requests count
    const totalResult = await query(`
      SELECT COUNT(*) as total
      FROM audit_log 
      WHERE tabel_diubah = 'stock_request'
      AND aksi = 'UPDATE'
      AND approval_status = 'pending'
    `)

    const total = totalResult[0]?.total || 0

    // Get recent pending requests (last 10)
    const recentResult = await query(`
      SELECT 
        al.id_audit,
        al.id_karyawan,
        al.data_baru as request_data,
        al.waktu_aksi as created_at,
        k.nama_karyawan as kasir_name,
        c.nama_cabang as branch_name
      FROM audit_log al
      JOIN karyawan k ON al.id_karyawan = k.id_karyawan  
      LEFT JOIN cabang c ON k.id_cabang = c.id_cabang
      WHERE al.tabel_diubah = 'stock_request'
      AND al.aksi = 'UPDATE'
      AND al.approval_status = 'pending'
      ORDER BY al.waktu_aksi DESC
      LIMIT 10
    `)

    // Parse JSON data for recent requests
    const parsedRecentResult = recentResult.map(req => {
      try {
        const requestData = typeof req.request_data === 'string' ? JSON.parse(req.request_data) : req.request_data
        return {
          ...req,
          request_type: requestData.request_type,
          product_name: requestData.product_name,
          reason: requestData.reason
        }
      } catch (e) {
        console.error('Error parsing request data:', e)
        return {
          ...req,
          request_type: 'unknown',
          product_name: 'Unknown Product',
          reason: 'No reason available'
        }
      }
    })

    return NextResponse.json({
      total,
      recent: parsedRecentResult
    })

  } catch (error) {
    console.error('Error fetching pending requests:', error)
    
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