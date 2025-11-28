// FILE: src/app/api/inventory/[cabang_id]/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken } from '@/lib/auth'

export async function GET(request, { params }) {
  try {
    // Verify authentication
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    const { cabang_id } = await params

    // Verify user has access to this cabang (kasir only their cabang, others can access all)
    if (user.role === 'kasir' && user.cabang_id != cabang_id) {
      return NextResponse.json({ error: 'Access denied to this branch' }, { status: 403 })
    }

    // Get URL parameters for pagination and filters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page')) || 1
    const limit = parseInt(searchParams.get('limit')) || 10
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || 'all'
    const status = searchParams.get('status') || 'all'
    
    const offset = (page - 1) * limit
    
    // Build WHERE conditions
    let whereConditions = ["sc.id_cabang = ?", "pt.status_aktif = 'aktif'"]
    let queryParams = [cabang_id]
    
    // Search condition
    if (search && search.trim()) {
      whereConditions.push("pt.nama_produk LIKE ?")
      queryParams.push(`%${search}%`)
    }
    
    // Category filter
    if (category !== 'all') {
      whereConditions.push("pt.kategori_produk = ?")
      queryParams.push(category)
    }
    
    // Status filter (needs to be applied after CASE calculation)
    let havingCondition = ''
    if (status !== 'all') {
      switch (status) {
        case 'out_of_stock':
          havingCondition = 'HAVING status = "out_of_stock"'
          break
        case 'critical':
          havingCondition = 'HAVING status = "critical"'
          break
        case 'low':
          havingCondition = 'HAVING status = "low"'
          break
        case 'good':
          havingCondition = 'HAVING status = "good"'
          break
      }
    }
    
    const whereClause = whereConditions.join(' AND ')
    
    // Count query
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM (
        SELECT 
          pt.id_produk,
          CASE 
            WHEN sc.stok_tersedia = 0 THEN 'out_of_stock'
            WHEN sc.stok_tersedia <= sc.stok_minimum THEN 'critical'
            WHEN sc.stok_tersedia <= (sc.stok_minimum * 1.5) THEN 'low'
            ELSE 'good'
          END as status
        FROM produk_tambahan pt
        JOIN stok_cabang sc ON pt.id_produk = sc.id_produk
        WHERE ${whereClause}
        ${havingCondition}
      ) counted
    `
    
    const countResult = await query(countQuery, queryParams)
    const totalProducts = countResult[0].total
    const totalPages = Math.ceil(totalProducts / limit)

    // Main query with pagination
    const inventoryQuery = `
      SELECT 
        pt.id_produk as id,
        pt.nama_produk,
        pt.harga,
        pt.satuan,
        pt.kategori_produk,
        sc.stok_tersedia,
        sc.stok_minimum,
        sc.terakhir_update,
        k.nama_karyawan as updated_by_name,
        CASE 
          WHEN sc.stok_tersedia = 0 THEN 'out_of_stock'
          WHEN sc.stok_tersedia <= sc.stok_minimum THEN 'critical'
          WHEN sc.stok_tersedia <= (sc.stok_minimum * 1.5) THEN 'low'
          ELSE 'good'
        END as status
      FROM produk_tambahan pt
      JOIN stok_cabang sc ON pt.id_produk = sc.id_produk
      LEFT JOIN karyawan k ON sc.updated_by_karyawan = k.id_karyawan
      WHERE ${whereClause}
      ${havingCondition}
      ORDER BY 
        CASE 
          WHEN sc.stok_tersedia = 0 THEN 1
          WHEN sc.stok_tersedia <= sc.stok_minimum THEN 2
          WHEN sc.stok_tersedia <= (sc.stok_minimum * 1.5) THEN 3
          ELSE 4
        END,
        pt.kategori_produk,
        pt.nama_produk
      LIMIT ${limit} OFFSET ${offset}
    `
    
    const inventory = await query(inventoryQuery, queryParams)

    // Get cabang info
    const cabangInfo = await query(`
      SELECT nama_cabang, alamat FROM cabang WHERE id_cabang = ?
    `, [cabang_id])

    return NextResponse.json({
      cabang: cabangInfo[0] || null,
      inventory: inventory,
      totalProducts,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
      filters: {
        search,
        category,
        status
      },
      summary: {
        total_items: inventory.length,
        out_of_stock: inventory.filter(item => item.status === 'out_of_stock').length,
        critical: inventory.filter(item => item.status === 'critical').length,
        low: inventory.filter(item => item.status === 'low').length,
        good: inventory.filter(item => item.status === 'good').length
      }
    })

  } catch (error) {
    console.error('Inventory API error:', error)
    return NextResponse.json({
      error: 'Database error',
      message: error.message
    }, { status: 500 })
  }
}