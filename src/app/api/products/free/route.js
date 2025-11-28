import { NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import jwt from 'jsonwebtoken'

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
}

// Authentication middleware for inventory staff
function authenticateInventoryStaff(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return { error: 'Unauthorized', status: 401 }
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const allowedRoles = ['owner', 'kasir', 'collector'] // Kasir needs access for transactions
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
  // Check authentication - inventory staff can access free products
  const auth = authenticateInventoryStaff(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const connection = await mysql.createConnection(dbConfig)
    
    // Get all products with their free config
    const [rows] = await connection.execute(`
      SELECT 
        id_produk,
        nama_produk,
        harga,
        satuan,
        kategori_produk,
        is_free_promo,
        free_quantity,
        status_aktif
      FROM produk_tambahan 
      WHERE status_aktif = 'aktif'
      ORDER BY nama_produk ASC
    `)
    
    await connection.end()
    
    return NextResponse.json({
      success: true,
      products: rows
    })
    
  } catch (error) {
    console.error('Error fetching free products:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function PUT(request) {
  // Check authentication - inventory staff can manage free products  
  const auth = authenticateInventoryStaff(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { id_produk, is_free_promo, free_quantity } = await request.json()
    
    // Validation
    if (!id_produk) {
      return NextResponse.json(
        { success: false, error: 'Product ID required' },
        { status: 400 }
      )
    }
    
    if (is_free_promo && (!free_quantity || free_quantity < 1 || free_quantity > 10)) {
      return NextResponse.json(
        { success: false, error: 'Free quantity must be between 1-10' },
        { status: 400 }
      )
    }
    
    const connection = await mysql.createConnection(dbConfig)
    
    // Update product free config
    await connection.execute(`
      UPDATE produk_tambahan 
      SET is_free_promo = ?, free_quantity = ?
      WHERE id_produk = ?
    `, [
      is_free_promo ? 1 : 0,
      is_free_promo ? free_quantity : 0,
      id_produk
    ])
    
    // Get updated product info
    const [rows] = await connection.execute(`
      SELECT nama_produk FROM produk_tambahan WHERE id_produk = ?
    `, [id_produk])
    
    await connection.end()
    
    const productName = rows[0]?.nama_produk || 'Product'
    const message = is_free_promo 
      ? `${productName} berhasil diset gratis ${free_quantity} per transaksi`
      : `${productName} berhasil diubah ke mode normal`
    
    return NextResponse.json({
      success: true,
      message: message
    })
    
  } catch (error) {
    console.error('Error updating free product:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    )
  }
}