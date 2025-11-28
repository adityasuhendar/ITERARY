import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'

// Authentication middleware for authorized staff access
function authenticateStaff(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return { error: 'Unauthorized', status: 401 }
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const allowedRoles = ['owner', 'collector', 'kasir'] // Staff who need branches data
    if (!decoded || !allowedRoles.includes(decoded.jenis_karyawan)) {
      return { error: 'Access denied. Staff role required.', status: 403 }
    }

    return { user: decoded }
  } catch (error) {
    console.error('JWT verification error:', error)
    return { error: 'Invalid token', status: 401 }
  }
}

export async function GET(request) {
  // Check authentication
  const auth = authenticateStaff(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const branches = await query(`
      SELECT id_cabang, nama_cabang, status_aktif
      FROM cabang 
      WHERE status_aktif = 'aktif'
      ORDER BY id_cabang ASC
    `)

    return NextResponse.json({
      success: true,
      branches
    })
  } catch (error) {
    console.error('Branches API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch branches'
    }, { status: 500 })
  }
}