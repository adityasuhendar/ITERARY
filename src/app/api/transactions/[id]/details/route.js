import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken } from '@/lib/auth'

export async function GET(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    const { id } = await params

    // Get main transaction data
    const transactionData = await query(`
      SELECT 
        t.*,
        p.nama_pelanggan,
        p.nomor_telepon,
        c.nama_cabang,
        k.nama_karyawan
      FROM transaksi t
      JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
      JOIN cabang c ON t.id_cabang = c.id_cabang
      JOIN karyawan k ON t.id_karyawan = k.id_karyawan
      WHERE t.id_transaksi = ?
    `, [id])

    if (transactionData.length === 0) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const transaction = transactionData[0]

    // Verify access (kasir can only see their own branch transactions)
    if (user.role === 'kasir' && transaction.id_cabang !== user.cabang_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get service details with current stock status for editing
    const services = await query(`
      SELECT 
        dtl.*,
        jl.nama_layanan,
        jl.durasi_menit,
        jl.deskripsi
      FROM detail_transaksi_layanan dtl
      JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
      WHERE dtl.id_transaksi = ?
      ORDER BY dtl.id_detail_layanan
    `, [id])

    // Get product details with current stock status for editing
    const products = await query(`
      SELECT 
        dtp.*,
        pt.nama_produk,
        pt.satuan,
        pt.kategori_produk,
        sc.stok_tersedia
      FROM detail_transaksi_produk dtp
      JOIN produk_tambahan pt ON dtp.id_produk = pt.id_produk
      LEFT JOIN stok_cabang sc ON pt.id_produk = sc.id_produk AND sc.id_cabang = ?
      WHERE dtp.id_transaksi = ?
      ORDER BY dtp.id_detail_produk
    `, [transaction.id_cabang, id])

    // Combine all data
    const detailTransaction = {
      ...transaction,
      services: services,
      products: products
    }

    return NextResponse.json(detailTransaction)

  } catch (error) {
    console.error('Get transaction details error:', error)
    return NextResponse.json({
      error: 'Database error',
      message: error.message
    }, { status: 500 })
  }
}