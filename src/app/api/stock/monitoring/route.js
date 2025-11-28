import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'

export async function GET(request) {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }
    
    // Only owner and pure collector can access - NO backup kasir hybrid access
    if (decoded.jenis_karyawan !== 'owner' && decoded.jenis_karyawan !== 'collector') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get URL parameters
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branch_id')
    
    if (branchId) {
      // Get detailed stock for specific branch
      const branchStock = await getBranchStockDetail(branchId)
      return NextResponse.json(branchStock)
    } else {
      // Get stock overview for all branches
      const stockOverview = await getStockOverview()
      return NextResponse.json(stockOverview)
    }

  } catch (error) {
    console.error('Stock monitoring API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getStockOverview() {
  // Get all branches with their stock summary
  // Only count products that are available in each specific branch
  const branches = await query(`
    SELECT 
      c.id_cabang,
      c.nama_cabang,
      c.alamat,
      COUNT(sc.id_produk) as total_products,
      SUM(CASE WHEN sc.stok_tersedia = 0 THEN 1 ELSE 0 END) as out_of_stock_count,
      SUM(CASE WHEN sc.stok_tersedia <= sc.stok_minimum AND sc.stok_tersedia > 0 THEN 1 ELSE 0 END) as critical_count,
      SUM(CASE WHEN sc.stok_tersedia <= (sc.stok_minimum * 1.5) AND sc.stok_tersedia > sc.stok_minimum THEN 1 ELSE 0 END) as low_count,
      SUM(CASE WHEN sc.stok_tersedia > (sc.stok_minimum * 1.5) THEN 1 ELSE 0 END) as good_count
    FROM cabang c
    LEFT JOIN stok_cabang sc ON c.id_cabang = sc.id_cabang
    LEFT JOIN produk_tambahan pt ON sc.id_produk = pt.id_produk
    WHERE c.status_aktif = 'aktif' 
      AND (pt.status_aktif = 'aktif' OR pt.status_aktif IS NULL)
      AND (
        pt.cabang_tersedia IS NULL 
        OR JSON_CONTAINS(pt.cabang_tersedia, JSON_QUOTE(CAST(c.id_cabang AS CHAR)))
        OR pt.id_produk IS NULL
      )
    GROUP BY c.id_cabang, c.nama_cabang, c.alamat
    ORDER BY c.id_cabang
  `)

  // Get top critical items across all branches
  const criticalItems = await query(`
    SELECT 
      pt.nama_produk,
      sc.stok_tersedia,
      sc.stok_minimum,
      c.nama_cabang,
      c.id_cabang,
      CASE 
        WHEN sc.stok_tersedia = 0 THEN 'out_of_stock'
        WHEN sc.stok_tersedia <= sc.stok_minimum THEN 'critical'
        WHEN sc.stok_tersedia <= (sc.stok_minimum * 1.5) THEN 'low'
        ELSE 'good'
      END as alert_level
    FROM stok_cabang sc
    JOIN produk_tambahan pt ON sc.id_produk = pt.id_produk
    JOIN cabang c ON sc.id_cabang = c.id_cabang
    WHERE sc.stok_tersedia <= (sc.stok_minimum * 1.5)
      AND pt.status_aktif = 'aktif'
      AND c.status_aktif = 'aktif'
      AND (
        pt.cabang_tersedia IS NULL 
        OR JSON_CONTAINS(pt.cabang_tersedia, JSON_QUOTE(CAST(c.id_cabang AS CHAR)))
      )
    ORDER BY 
      CASE 
        WHEN sc.stok_tersedia = 0 THEN 1
        WHEN sc.stok_tersedia <= sc.stok_minimum THEN 2
        ELSE 3
      END,
      sc.stok_tersedia ASC
    LIMIT 20
  `)

  return {
    branches: branches.map(branch => ({
      id_cabang: branch.id_cabang,
      nama_cabang: branch.nama_cabang,
      alamat: branch.alamat,
      total_products: parseInt(branch.total_products) || 0,
      stock_status: {
        out_of_stock: parseInt(branch.out_of_stock_count) || 0,
        critical: parseInt(branch.critical_count) || 0,
        low: parseInt(branch.low_count) || 0,
        good: parseInt(branch.good_count) || 0
      }
    })),
    critical_items: criticalItems,
    last_updated: new Date().toISOString()
  }
}

async function getBranchStockDetail(branchId) {
  // Get branch info
  const branchInfo = await query(`
    SELECT nama_cabang, alamat FROM cabang 
    WHERE id_cabang = ? AND status_aktif = 'aktif'
  `, [branchId])

  if (branchInfo.length === 0) {
    throw new Error('Branch not found')
  }

  // Get detailed stock for the branch
  const stockDetails = await query(`
    SELECT 
      pt.id_produk,
      pt.nama_produk,
      pt.harga,
      pt.satuan,
      pt.kategori_produk,
      sc.stok_tersedia,
      sc.stok_minimum,
      sc.terakhir_update,
      CASE 
        WHEN sc.stok_tersedia = 0 THEN 'out_of_stock'
        WHEN sc.stok_tersedia <= sc.stok_minimum THEN 'critical'
        WHEN sc.stok_tersedia <= (sc.stok_minimum * 1.5) THEN 'low'
        ELSE 'good'
      END as status
    FROM stok_cabang sc
    JOIN produk_tambahan pt ON sc.id_produk = pt.id_produk
    WHERE sc.id_cabang = ?
      AND pt.status_aktif = 'aktif'
    ORDER BY 
      CASE 
        WHEN sc.stok_tersedia = 0 THEN 1
        WHEN sc.stok_tersedia <= sc.stok_minimum THEN 2
        WHEN sc.stok_tersedia <= (sc.stok_minimum * 1.5) THEN 3
        ELSE 4
      END,
      sc.stok_tersedia ASC,
      pt.nama_produk
  `, [branchId])

  console.log('DEBUG stockDetails sample:', stockDetails.slice(0, 2)) // Debug log

  // Group by status
  const stockByStatus = {
    out_of_stock: [],
    critical: [],
    low: [],
    good: []
  }

  stockDetails.forEach(item => {
    stockByStatus[item.status].push({
      id_produk: item.id_produk,
      nama_produk: item.nama_produk,
      harga: item.harga,
      satuan: item.satuan,
      kategori_produk: item.kategori_produk,
      stok_tersedia: item.stok_tersedia,
      stok_minimum: item.stok_minimum,
      terakhir_update: item.terakhir_update,
      status: item.status
    })
  })

  return {
    branch_info: {
      id_cabang: branchId,
      nama_cabang: branchInfo[0].nama_cabang,
      alamat: branchInfo[0].alamat
    },
    stock_summary: {
      total_products: stockDetails.length,
      out_of_stock: stockByStatus.out_of_stock.length,
      critical: stockByStatus.critical.length,
      low: stockByStatus.low.length,
      good: stockByStatus.good.length
    },
    stock_details: stockByStatus,
    last_updated: new Date().toISOString()
  }
}