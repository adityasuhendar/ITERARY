import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { query } from '@/lib/database'

export async function GET(request, context) {
  try {
    // Await params FIRST in Next.js 15
    const resolvedParams = await context.params
    const branchId = resolvedParams.id

    // Validate branch ID
    if (!branchId || isNaN(branchId)) {
      return NextResponse.json(
        { error: 'Invalid branch ID' },
        { status: 400 }
      )
    }

    // Get token from cookies
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      )
    }

    // Verify JWT token
    let decoded
    try {
      decoded = jwt.verify(token.value, process.env.JWT_SECRET)
    } catch (jwtError) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Check if user has access (owner or investor)
    if (!['owner', 'investor'].includes(decoded.jenis_karyawan)) {
      return NextResponse.json(
        { error: 'Access denied. Owner or investor role required.' },
        { status: 403 }
      )
    }

    // Check branch access for investor
    if (decoded.jenis_karyawan === 'investor') {
      // Get user's allowed branches
      const userProfile = await query(`
        SELECT allowed_branches
        FROM karyawan
        WHERE id_karyawan = ?
      `, [decoded.id])

      if (userProfile.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      let allowedBranches = userProfile[0].allowed_branches

      // Parse JSON if it's a string
      if (typeof allowedBranches === 'string') {
        try {
          allowedBranches = JSON.parse(allowedBranches)
        } catch (e) {
          console.error('Error parsing allowed_branches:', e)
          allowedBranches = []
        }
      }

      // Check if investor has access to this branch
      if (!allowedBranches || !Array.isArray(allowedBranches) || !allowedBranches.includes(parseInt(branchId))) {
        return NextResponse.json(
          { error: 'Access denied. You do not have permission to view this branch.' },
          { status: 403 }
        )
      }
    }

    // Validate branch ID
    if (!branchId || isNaN(branchId)) {
      return NextResponse.json(
        { error: 'Invalid branch ID' },
        { status: 400 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page')) || 1
    const limit = Math.min(parseInt(searchParams.get('limit')) || 10, 20) // Default 10, max 20 items per page
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const paymentMethod = searchParams.get('paymentMethod')
    const status = searchParams.get('status')

    // Calculate offset
    const offset = (page - 1) * limit

    // Validate and enforce 3-month period limit
    let finalDateFrom = dateFrom
    let finalDateTo = dateTo

    if (dateFrom && dateTo) {
      const startDate = new Date(dateFrom)
      const endDate = new Date(dateTo)
      const daysDifference = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))

      if (daysDifference > 90) {
        return NextResponse.json({
          error: 'Periode terlalu panjang. Maksimal 3 bulan (90 hari).',
          maxDays: 90,
          requestedDays: daysDifference
        }, { status: 400 })
      }
    }

    // If no date filter provided, default to last 3 months
    if (!finalDateFrom || !finalDateTo) {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      const threeMonthsAgo = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000))
        .toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

      finalDateFrom = finalDateFrom || threeMonthsAgo
      finalDateTo = finalDateTo || today
    }

    // Build WHERE clause
    let whereConditions = ['t.id_cabang = ?']
    let params = [parseInt(branchId)]

    // Default to show all transactions (pending, selesai, dibatalkan) unless status filter is specified
    if (!status || status === 'all') {
      whereConditions.push("t.status_transaksi IN ('pending', 'selesai', 'dibatalkan')")
    }

    // Optimized date filters (index-friendly)
    if (finalDateFrom) {
      whereConditions.push('t.tanggal_transaksi >= ?')
      params.push(`${finalDateFrom} 00:00:00`)
    }
    if (finalDateTo) {
      whereConditions.push('t.tanggal_transaksi <= ?')
      params.push(`${finalDateTo} 23:59:59`)
    }

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      whereConditions.push('t.metode_pembayaran = ?')
      params.push(paymentMethod)
    }

    // Status filter
    if (status && status !== 'all') {
      whereConditions.push('t.status_transaksi = ?')
      params.push(status)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Default sort: newest first
    const orderBy = 'ORDER BY t.tanggal_transaksi DESC'

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM transaksi t
      LEFT JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
      ${whereClause}
    `
    console.log('Branch transactions count query:', countQuery.replace(/\s+/g, ' ').trim())
    console.log('Branch transactions params:', params)
    
    const countResult = await query(countQuery, params)
    const totalTransactions = countResult[0].total
    console.log('Branch transactions total count:', totalTransactions)

    // Get summary for filtered transactions (all pages)
    const summaryQuery = `
      SELECT
        COUNT(*) as total_transaksi,
        COALESCE(SUM(t.total_keseluruhan), 0) as total_pendapatan
      FROM transaksi t
      LEFT JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
      ${whereClause}
    `
    const summaryResult = await query(summaryQuery, params)
    const summary = summaryResult[0]

    const totalPages = Math.ceil(totalTransactions / limit)

    // Get transactions with pagination - with proper datetime formatting
    const transactionsQuery = `SELECT 
        t.id_transaksi,
        t.kode_transaksi,
        t.tanggal_transaksi,
        t.shift_transaksi,
        t.total_keseluruhan,
        t.metode_pembayaran,
        t.status_transaksi,
        t.catatan,
        t.dibuat_pada,
        t.nama_pekerja_aktual,
        p.nama_pelanggan,
        p.nomor_telepon,
        k.nama_karyawan
      FROM transaksi t
      LEFT JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
      LEFT JOIN karyawan k ON t.id_karyawan = k.id_karyawan
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?`

    // Build final query with values directly (safer for LIMIT/OFFSET)
    const finalQuery = transactionsQuery.replace('LIMIT ? OFFSET ?', `LIMIT ${limit} OFFSET ${offset}`)
    console.log('Executing transaction query:', finalQuery)
    console.log('With params:', params)
    
    const transactions = await query(finalQuery, params)

    // Ultra Optimized: Single UNION ALL query for both services and products (1 database round-trip)
    if (transactions.length > 0) {
      const transactionIds = transactions.map(t => t.id_transaksi)
      const placeholders = transactionIds.map(() => '?').join(',')

      // Single UNION ALL query for all services and products
      const allItems = await query(`
        SELECT
          dtl.id_transaksi,
          'service' AS item_type,
          jl.nama_layanan AS nama_item,
          dtl.quantity,
          dtl.harga_satuan,
          dtl.subtotal,
          NULL as satuan,
          NULL as is_free_promo,
          NULL as free_quantity
        FROM detail_transaksi_layanan dtl
        JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
        WHERE dtl.id_transaksi IN (${placeholders})

        UNION ALL

        SELECT
          dtp.id_transaksi,
          'product' AS item_type,
          pt.nama_produk AS nama_item,
          dtp.quantity,
          dtp.harga_satuan,
          dtp.subtotal,
          pt.satuan,
          dtp.is_free as is_free_promo,
          dtp.free_quantity
        FROM detail_transaksi_produk dtp
        JOIN produk_tambahan pt ON dtp.id_produk = pt.id_produk
        WHERE dtp.id_transaksi IN (${placeholders})

        ORDER BY id_transaksi, item_type, nama_item
      `, [...transactionIds, ...transactionIds])

      // Group items by transaction_id and separate by type (ultra fast JavaScript processing)
      const itemsByTransaction = {}

      allItems.forEach(item => {
        if (!itemsByTransaction[item.id_transaksi]) {
          itemsByTransaction[item.id_transaksi] = { services: [], products: [] }
        }

        if (item.item_type === 'service') {
          itemsByTransaction[item.id_transaksi].services.push({
            quantity: item.quantity,
            harga_satuan: item.harga_satuan,
            subtotal: item.subtotal,
            nama_layanan: item.nama_item
          })
        } else {
          itemsByTransaction[item.id_transaksi].products.push({
            quantity: item.quantity,
            harga_satuan: item.harga_satuan,
            subtotal: item.subtotal,
            nama_produk: item.nama_item,
            satuan: item.satuan,
            is_free_promo: item.is_free_promo,
            free_quantity: item.free_quantity
          })
        }
      })

      // Assign services and products to transactions
      transactions.forEach(transaction => {
        const items = itemsByTransaction[transaction.id_transaksi] || { services: [], products: [] }
        transaction.services = items.services
        transaction.products = items.products

        // REMOVED: totalCuciServices calculation
        // Free product data now comes directly from detail_transaksi_produk
        // No need to recalculate based on services
      })
    }

    return NextResponse.json({
      transactions,
      totalPages,
      totalTransactions,
      currentPage: page,
      itemsPerPage: limit,
      summary: {
        total_transaksi: parseInt(summary.total_transaksi),
        total_pendapatan: parseFloat(summary.total_pendapatan)
      },
      filters: {
        dateFrom,
        dateTo,
        paymentMethod,
        status
      }
    })

  } catch (error) {
    console.error('Branch transactions API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}