import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'

// Authentication middleware for inventory staff
function authenticateInventoryStaff(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return { error: 'Unauthorized', status: 401 }
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const allowedRoles = ['owner', 'kasir', 'collector'] // Staff who manage inventory
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
  // Check authentication - inventory staff can access units
  const auth = authenticateInventoryStaff(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    // Get all distinct satuan from produk_tambahan where status_aktif = 'aktif'
    const unitsResult = await query(`
      SELECT DISTINCT satuan 
      FROM produk_tambahan 
      WHERE status_aktif = 'aktif' 
      AND satuan IS NOT NULL 
      AND satuan != ''
      ORDER BY satuan ASC
    `)

    // Extract units array from result
    const units = unitsResult.map(row => row.satuan).filter(Boolean)

    // Only return units that actually exist in database
    const uniqueUnits = [...new Set(units)].sort()


    return NextResponse.json({
      success: true,
      units: uniqueUnits
    })

  } catch (error) {
    console.error('Error fetching units:', error)
    
    // Return minimal fallback units if database query fails
    return NextResponse.json({
      success: false,
      units: ['pcs'],
      error: 'Database error, returning fallback units'
    })
  }
}