import { NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import jwt from 'jsonwebtoken'

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
}

// Authentication middleware for transaction staff
function authenticateTransactionStaff(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return { error: 'Unauthorized', status: 401 }
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const allowedRoles = ['owner', 'kasir'] // Kasir needs this for transactions
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
  // Check authentication - transaction staff can access active free products
  const auth = authenticateTransactionStaff(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const connection = await mysql.createConnection(dbConfig)
    
    // Get only free products that are active
    const [rows] = await connection.execute(`
      SELECT 
        id_produk,
        nama_produk,
        free_quantity
      FROM produk_tambahan 
      WHERE status_aktif = 'aktif' 
        AND is_free_promo = 1 
        AND free_quantity > 0
      ORDER BY nama_produk ASC
    `)
    
    await connection.end()
    
    return NextResponse.json({
      success: true,
      free_products: rows
    })
    
  } catch (error) {
    console.error('Error fetching active free products:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch free products' },
      { status: 500 }
    )
  }
}