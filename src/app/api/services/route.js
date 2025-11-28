import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'

// Authentication middleware for transaction staff (owner, kasir only)
function authenticateTransactionStaff(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return { error: 'Unauthorized', status: 401 }
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const allowedRoles = ['owner', 'kasir']
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
  // Check authentication - only owner and kasir can access services
  const auth = authenticateTransactionStaff(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const services = await query(`
      SELECT 
        id_jenis_layanan as id,
        nama_layanan,
        durasi_menit,
        harga,
        deskripsi
      FROM jenis_layanan
      WHERE status_aktif = 'aktif'
      ORDER BY id_jenis_layanan
    `)

    return NextResponse.json(services)
  } catch (error) {
    console.error('Services API error:', error)
    return NextResponse.json({ 
      error: 'Database error',
      message: error.message 
    }, { status: 500 })
  }
}