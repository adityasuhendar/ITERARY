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
    if (!user || user.role !== 'kasir') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const customerId = parseInt(id)

    if (!customerId || isNaN(customerId)) {
      return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 })
    }

    // Check for existing draft transaction
    const existingDraft = await query(`
      SELECT 
        t.id_transaksi,
        t.kode_transaksi,
        t.tanggal_transaksi,
        t.total_keseluruhan,
        p.nama_pelanggan
      FROM transaksi t
      JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
      WHERE t.id_pelanggan = ? 
      AND t.status_transaksi = 'pending'
      AND t.id_cabang = ?
      LIMIT 1
    `, [customerId, user.cabang_id])

    if (existingDraft.length > 0) {
      const draft = existingDraft[0]
      return NextResponse.json({
        hasDraft: true,
        draft: {
          id: draft.id_transaksi,
          kode: draft.kode_transaksi,
          tanggal: draft.tanggal_transaksi,
          total: draft.total_keseluruhan,
          customerName: draft.nama_pelanggan
        }
      })
    }

    return NextResponse.json({
      hasDraft: false,
      draft: null
    })

  } catch (error) {
    console.error('Check active draft error:', error)
    return NextResponse.json({
      error: 'Database error',
      message: error.message
    }, { status: 500 })
  }
}