import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'

// Authentication middleware for transaction staff who need customer data
function authenticateTransactionStaff(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return { error: 'Unauthorized', status: 401 }
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const allowedRoles = ['owner', 'kasir'] // Staff who handle transactions
    if (!decoded || !allowedRoles.includes(decoded.jenis_karyawan)) {
      return { error: 'Access denied. Owner/Kasir role required.', status: 403 }
    }

    return { user: decoded }
  } catch (error) {
    console.error('JWT verification error:', error)
    return { error: 'Invalid token', status: 401 }
  }
}

export async function GET(request) {
  // Check authentication - transaction staff can search customers
  const auth = authenticateTransactionStaff(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(request.url)
    const searchTerm = searchParams.get('q')
    const branchId = searchParams.get('branch_id')
    const limit = parseInt(searchParams.get('limit')) || 10

    if (!searchTerm || searchTerm.trim().length < 1) {
      return NextResponse.json({ customers: [] })
    }

    // Build WHERE conditions
    let whereConditions = ["status_aktif = 'aktif'"]
    let queryParams = []

    // Filter by branch if provided
    if (branchId) {
      whereConditions.push("id_cabang = ?")
      queryParams.push(branchId)
    }

    // Search condition
    whereConditions.push("(nama_pelanggan LIKE ? OR nomor_telepon LIKE ?)")
    queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`)

    const whereClause = whereConditions.join(' AND ')

    // Simple search with optional branch filter
    const customers = await query(`
      SELECT
        id_pelanggan,
        id_cabang,
        nama_pelanggan,
        nomor_telepon,
        total_cuci,
        total_redeem,
        loyalty_points,
        (loyalty_points - total_redeem) as available_points,
        dibuat_pada as created_at
      FROM pelanggan
      WHERE ${whereClause}
      ORDER BY
        CASE
          WHEN nama_pelanggan LIKE ? THEN 1
          WHEN nomor_telepon LIKE ? THEN 2
          ELSE 3
        END,
        nama_pelanggan ASC
      LIMIT ?
    `, [
      ...queryParams,
      `${searchTerm}%`, // Exact match at start gets priority
      `${searchTerm}%`,
      limit
    ])

    return NextResponse.json({
      success: true,
      customers: customers,
      total: customers.length,
      searchTerm: searchTerm,
      branchId: branchId
    })

  } catch (error) {
    console.error('Customer search error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}