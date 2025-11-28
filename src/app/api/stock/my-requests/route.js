import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { handleJWTAuth } from '@/lib/jwtHandler'

export async function GET(request) {
  try {
    // Handle JWT authentication with role check
    const { decoded, errorResponse } = handleJWTAuth(request, ['kasir'])
    if (errorResponse) {
      return errorResponse
    }

    const kasirId = decoded.id
    
    // Get pagination parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page')) || 1
    const limit = parseInt(searchParams.get('limit')) || 10
    const offset = (page - 1) * limit

    // Get current kasir's branch info - prioritize JWT token for backup kasir
    const branchId = decoded.cabang_id // For collector backup kasir
    
    if (!branchId) {
      // Fallback to database for normal kasir
      const kasirBranch = await query(`
        SELECT id_cabang FROM karyawan WHERE id_karyawan = ?
      `, [kasirId])

      if (kasirBranch.length === 0) {
        return NextResponse.json({ error: 'Kasir not found' }, { status: 404 })
      }

      branchId = kasirBranch[0].id_cabang
    }

    // Get total count for all requests from same branch - include collector backup kasir
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM audit_log al
      LEFT JOIN karyawan k ON al.id_karyawan = k.id_karyawan
      WHERE (
        k.id_cabang = ? OR
        (k.id_cabang IS NULL AND JSON_EXTRACT(al.data_baru, '$.id_cabang') = ?)
      )
        AND al.tabel_diubah = 'stock_request'
        AND al.aksi = 'UPDATE'
        AND DATE(al.waktu_aksi) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `, [branchId, branchId])

    const totalRequests = countResult[0].total
    const totalPages = Math.ceil(totalRequests / limit)

    // Get stock requests from all kasir in same branch with pagination - include collector backup kasir
    const requests = await query(`
      SELECT
        al.id_audit,
        al.tabel_diubah,
        al.aksi,
        al.data_lama,
        al.data_baru,
        al.approval_status,
        al.approved_at,
        al.approved_by,
        al.approval_notes,
        al.waktu_aksi,
        al.ip_address,
        approver.nama_karyawan as approved_by_name,
        al.data_baru as request_data_raw,
        al.data_lama as current_data_raw
      FROM audit_log al
      LEFT JOIN karyawan k ON al.id_karyawan = k.id_karyawan
      LEFT JOIN karyawan approver ON al.approved_by = approver.id_karyawan
      WHERE (
        k.id_cabang = ? OR
        (k.id_cabang IS NULL AND JSON_EXTRACT(al.data_baru, '$.id_cabang') = ?)
      )
        AND al.tabel_diubah = 'stock_request'
        AND al.aksi = 'UPDATE'
        AND DATE(al.waktu_aksi) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      ORDER BY al.waktu_aksi DESC
      LIMIT ? OFFSET ?
    `, [branchId, branchId, limit, offset])

    // Process the requests to parse JSON data
    const processedRequests = requests.map(request => {
      let requestData = null
      let currentData = null

      // Parse request_data (data_baru)
      try {
        requestData = typeof request.request_data_raw === 'string' 
          ? JSON.parse(request.request_data_raw) 
          : request.request_data_raw
      } catch (e) {
        console.error('Error parsing request_data:', e)
        requestData = request.request_data_raw
      }

      // Parse current_data (data_lama)  
      try {
        currentData = typeof request.current_data_raw === 'string'
          ? JSON.parse(request.current_data_raw)
          : request.current_data_raw
      } catch (e) {
        console.error('Error parsing current_data:', e)
        currentData = request.current_data_raw
      }

      return {
        id_audit: request.id_audit,
        tabel_diubah: request.tabel_diubah,
        aksi: request.aksi,
        approval_status: request.approval_status,
        approved_at: request.approved_at,
        approved_by: request.approved_by,
        approved_by_name: request.approved_by_name,
        approval_notes: request.approval_notes,
        waktu_aksi: request.waktu_aksi,
        request_data: requestData,
        current_data: currentData
      }
    })

    return NextResponse.json({
      success: true,
      requests: processedRequests,
      currentPage: page,
      totalPages: totalPages,
      totalRequests: totalRequests,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    })

  } catch (error) {
    console.error('My requests API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 })
  }
}