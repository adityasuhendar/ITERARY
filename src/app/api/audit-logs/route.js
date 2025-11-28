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
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page')) || 1
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit')) || 20))
    const table = searchParams.get('table') || 'all'
    const action = searchParams.get('action') || 'all'
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const userId = searchParams.get('user') || ''
    
    const offset = (page - 1) * limit
    
    // Build WHERE conditions
    let whereConditions = []
    let queryParams = []
    
    // Table filter
    if (table && table !== 'all') {
      whereConditions.push("al.tabel_diubah = ?")
      queryParams.push(table)
    }
    
    // Action filter  
    if (action && action !== 'all') {
      whereConditions.push("al.aksi = ?")
      queryParams.push(action)
    }
    
    // Date range filter
    if (dateFrom && dateTo) {
      whereConditions.push("DATE(al.waktu_aksi) BETWEEN ? AND ?")
      queryParams.push(dateFrom, dateTo)
    } else if (dateFrom) {
      whereConditions.push("DATE(al.waktu_aksi) >= ?")
      queryParams.push(dateFrom)
    } else if (dateTo) {
      whereConditions.push("DATE(al.waktu_aksi) <= ?")
      queryParams.push(dateTo)
    }
    
    // User filter
    if (userId && userId !== '') {
      whereConditions.push("(al.id_karyawan = ? OR al.requested_by = ?)")
      queryParams.push(parseInt(userId), parseInt(userId))
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''
    
    // Count query for pagination
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM audit_log al
      ${whereClause}
    `
    
    const countResult = await query(countQuery, queryParams)
    const totalLogs = countResult[0].total
    const totalPages = Math.ceil(totalLogs / limit)
    
    // Main query with joins to get employee names only
    const auditQuery = `
      SELECT
        al.id_audit,
        al.id_karyawan,
        al.requested_by,
        al.tabel_diubah,
        al.aksi,
        al.data_lama,
        al.data_baru,
        al.ip_address,
        al.waktu_aksi,
        al.approval_status,
        al.approved_by,
        al.approval_notes,
        al.approved_at,
        al.notified_at,
        al.foto_bukti,
        k1.nama_karyawan,
        k2.nama_karyawan as requested_by_name,
        k3.nama_karyawan as approved_by_name,
        c.id_cabang,
        c.nama_cabang,
        c.alamat as cabang_alamat
      FROM audit_log al
      LEFT JOIN karyawan k1 ON al.id_karyawan = k1.id_karyawan
      LEFT JOIN karyawan k2 ON al.requested_by = k2.id_karyawan
      LEFT JOIN karyawan k3 ON al.approved_by = k3.id_karyawan
      LEFT JOIN cabang c ON k1.id_cabang = c.id_cabang
      ${whereClause}
      ORDER BY al.waktu_aksi DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    
    const logs = await query(auditQuery, queryParams)

    // Process the logs to handle JSON parsing safely and extract branch info from stock_request
    const processedLogs = await Promise.all(logs.map(async (log) => {
      const processed = {
        ...log,
        data_lama: log.data_lama ? (typeof log.data_lama === 'string' ? log.data_lama : JSON.stringify(log.data_lama)) : null,
        data_baru: log.data_baru ? (typeof log.data_baru === 'string' ? log.data_baru : JSON.stringify(log.data_baru)) : null
      }

      // For stock_request, extract branch info from JSON data if not available from JOIN
      if (log.tabel_diubah === 'stock_request' && !log.nama_cabang && log.data_baru) {
        try {
          const dataBaru = typeof log.data_baru === 'string' ? JSON.parse(log.data_baru) : log.data_baru
          if (dataBaru.id_cabang) {
            const branchResult = await query('SELECT id_cabang, nama_cabang, alamat FROM cabang WHERE id_cabang = ?', [dataBaru.id_cabang])
            if (branchResult.length > 0) {
              processed.id_cabang = branchResult[0].id_cabang
              processed.nama_cabang = branchResult[0].nama_cabang
              processed.cabang_alamat = branchResult[0].alamat
            }
          }
        } catch (error) {
          console.warn('Failed to extract branch from stock_request:', error)
        }
      }

      return processed
    }))

    return NextResponse.json({
      success: true,
      logs: processedLogs,
      totalLogs,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      filters: {
        table,
        action,
        dateFrom,
        dateTo,
        user: userId
      }
    })

  } catch (error) {
    console.error('Audit logs API error:', error)
    return NextResponse.json({
      error: 'Failed to fetch audit logs',
      message: error.message
    }, { status: 500 })
  }
}