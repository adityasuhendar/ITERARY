// FILE: src/app/api/inventory/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken } from '@/lib/auth'

// UPDATE stock quantities
export async function PUT(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user || !['kasir', 'super_admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { updates, cabang_id } = await request.json()

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'Updates array is required' }, { status: 400 })
    }

    // Verify kasir can only update their own cabang
    if (user.role === 'kasir' && user.cabang_id != cabang_id) {
      return NextResponse.json({ error: 'Access denied to this branch' }, { status: 403 })
    }

    // Process each stock update
    const results = []
    for (const update of updates) {
      const { product_id, new_stock, reason } = update

      if (typeof new_stock !== 'number' || new_stock < 0) {
        return NextResponse.json({ 
          error: `Invalid stock quantity for product ${product_id}` 
        }, { status: 400 })
      }

      // Update stock
      const result = await query(`
        UPDATE stok_cabang 
        SET stok_tersedia = ?,
            terakhir_update = NOW(),
            updated_by_karyawan = ?
        WHERE id_cabang = ? AND id_produk = ?
      `, [new_stock, user.id, cabang_id, product_id])

      if (result.affectedRows === 0) {
        return NextResponse.json({ 
          error: `Product ${product_id} not found in branch ${cabang_id}` 
        }, { status: 404 })
      }

      // Log the stock movement (optional - for audit trail)
      try {
        await query(`
          INSERT INTO audit_log (
            id_karyawan, 
            tabel_diubah, 
            aksi, 
            data_baru,
            ip_address
          ) VALUES (?, 'stok_cabang', 'UPDATE', ?, ?)
        `, [
          user.id,
          JSON.stringify({
            cabang_id,
            product_id,
            new_stock,
            reason,
            timestamp: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z'
          }),
          request.headers.get('x-forwarded-for') || 'unknown'
        ])
      } catch (auditError) {
        console.warn('Failed to log stock update:', auditError)
      }

      results.push({
        product_id,
        old_stock: 'unknown', // Could fetch if needed
        new_stock,
        success: true
      })
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${results.length} products successfully`,
      results
    })

  } catch (error) {
    console.error('Stock update error:', error)
    return NextResponse.json({
      error: 'Update failed',
      message: error.message
    }, { status: 500 })
  }
}

// GET all products (for product management)
export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    // Get all products with their categories
    const products = await query(`
      SELECT 
        id_produk as id,
        nama_produk,
        harga,
        satuan,
        kategori_produk,
        status_aktif,
        dibuat_pada
      FROM produk_tambahan
      ORDER BY kategori_produk, nama_produk
    `)

    return NextResponse.json(products)

  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json({
      error: 'Database error',
      message: error.message
    }, { status: 500 })
  }
}

// ADD new product (admin only)
export async function POST(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user || !['super_admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { 
      nama_produk, 
      harga, 
      satuan, 
      kategori_produk,
      initial_stock_per_cabang = 0 
    } = await request.json()

    if (!nama_produk || !harga || !satuan || !kategori_produk) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create product
    const productResult = await query(`
      INSERT INTO produk_tambahan (
        nama_produk, 
        harga, 
        satuan, 
        kategori_produk
      ) VALUES (?, ?, ?, ?)
    `, [nama_produk, harga, satuan, kategori_produk])

    const productId = productResult.insertId

    // Add initial stock to all active branches
    if (initial_stock_per_cabang > 0) {
      const branches = await query(`
        SELECT id_cabang FROM cabang WHERE status_aktif = 'aktif'
      `)

      for (const branch of branches) {
        await query(`
          INSERT INTO stok_cabang (
            id_cabang, 
            id_produk, 
            stok_tersedia, 
            stok_minimum,
            updated_by_karyawan
          ) VALUES (?, ?, ?, 10, ?)
        `, [branch.id_cabang, productId, initial_stock_per_cabang, user.id])
      }
    }

    return NextResponse.json({
      success: true,
      product_id: productId,
      message: 'Product created successfully'
    })

  } catch (error) {
    console.error('Create product error:', error)
    return NextResponse.json({
      error: 'Creation failed',
      message: error.message
    }, { status: 500 })
  }
}
