import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken } from '@/lib/auth'

export async function GET(request, { params }) {
  try {
    // Get token from cookies
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify token
    const user = verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Only kasir and owner can view customer history
    if (!['kasir', 'owner'].includes(user.jenis_karyawan)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Await params in Next.js 15
    const resolvedParams = await params
    const customerId = resolvedParams.id

    // Get pagination params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit')) || 10
    const offset = parseInt(searchParams.get('offset')) || 0

    // Build query based on user role
    let transactionQuery = `
      SELECT
        t.id_transaksi,
        t.kode_transaksi,
        t.tanggal_transaksi,
        t.total_keseluruhan,
        t.status_transaksi,
        t.metode_pembayaran,
        c.nama_cabang,
        DATE_FORMAT(t.tanggal_transaksi, '%Y-%m-%d %H:%i:%s') as tanggal_formatted
      FROM transaksi t
      LEFT JOIN cabang c ON t.id_cabang = c.id_cabang
      WHERE t.id_pelanggan = ?
    `

    const queryParams = [customerId]

    // Kasir can only see transactions from their branch
    if (user.jenis_karyawan === 'kasir' && user.cabang_id) {
      transactionQuery += ` AND t.id_cabang = ?`
      queryParams.push(user.cabang_id)
    }

    transactionQuery += `
      ORDER BY t.tanggal_transaksi DESC
      LIMIT ? OFFSET ?
    `
    queryParams.push(limit, offset)

    const transactions = await query(transactionQuery, queryParams)

    // Fetch detail layanan dan produk untuk setiap transaksi
    for (const transaction of transactions) {
      // Get layanan details
      const layanan = await query(`
        SELECT
          dtl.id_jenis_layanan,
          jl.nama_layanan,
          dtl.quantity,
          dtl.harga_satuan,
          dtl.subtotal
        FROM detail_transaksi_layanan dtl
        LEFT JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
        WHERE dtl.id_transaksi = ?
      `, [transaction.id_transaksi])

      // Get produk details
      const produk = await query(`
        SELECT
          dtp.id_produk,
          pt.nama_produk,
          dtp.quantity,
          dtp.harga_satuan,
          dtp.subtotal
        FROM detail_transaksi_produk dtp
        LEFT JOIN produk_tambahan pt ON dtp.id_produk = pt.id_produk
        WHERE dtp.id_transaksi = ?
      `, [transaction.id_transaksi])

      transaction.layanan = layanan || []
      transaction.produk = produk || []
    }

    return NextResponse.json({
      transactions: transactions || [],
      limit,
      offset
    })

  } catch (error) {
    console.error('Error fetching customer transactions:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
