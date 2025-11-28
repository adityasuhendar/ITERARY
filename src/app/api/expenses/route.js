import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'

// Get expenses (with filters)
export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const cabangId = searchParams.get('cabang_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const kategori = searchParams.get('kategori')

    let expenseQuery = `
      SELECT
        p.*,
        c.nama_cabang
      FROM pengeluaran p
      JOIN cabang c ON p.id_cabang = c.id_cabang
      WHERE 1=1
    `
    const params = []

    // Filter by cabang (kasir only see their branch)
    if (decoded.jenis_karyawan === 'kasir') {
      expenseQuery += ` AND p.id_cabang = ?`
      params.push(decoded.cabang_id)
    } else if (cabangId) {
      expenseQuery += ` AND p.id_cabang = ?`
      params.push(cabangId)
    }

    // Filter by date range
    if (startDate) {
      expenseQuery += ` AND p.tanggal >= ?`
      params.push(startDate)
    }
    if (endDate) {
      expenseQuery += ` AND p.tanggal <= ?`
      params.push(endDate)
    }

    // Filter by kategori
    if (kategori) {
      expenseQuery += ` AND p.kategori = ?`
      params.push(kategori)
    }

    expenseQuery += ` ORDER BY p.tanggal DESC, p.created_at DESC`

    const expenses = await query(expenseQuery, params)

    return NextResponse.json({ success: true, expenses })

  } catch (error) {
    console.error('Get expenses error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 })
  }
}

// Create new expense
export async function POST(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || !['kasir', 'owner', 'collector', 'super_admin'].includes(decoded.jenis_karyawan)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { id_cabang, tanggal, kategori, jumlah, keterangan, foto_bukti } = body

    // Validation
    if (!id_cabang || !tanggal || !kategori || !jumlah) {
      return NextResponse.json({
        error: 'Missing required fields: id_cabang, tanggal, kategori, jumlah'
      }, { status: 400 })
    }

    // Kasir can only create expense for their own branch
    if (decoded.jenis_karyawan === 'kasir' && id_cabang !== decoded.cabang_id) {
      return NextResponse.json({ error: 'Access denied. Can only create expense for your branch' }, { status: 403 })
    }

    // Validate jumlah
    const jumlahNum = parseFloat(jumlah)
    if (isNaN(jumlahNum) || jumlahNum <= 0) {
      return NextResponse.json({ error: 'Invalid jumlah' }, { status: 400 })
    }

    // Insert expense
    const result = await query(`
      INSERT INTO pengeluaran (
        id_cabang,
        tanggal,
        kategori,
        jumlah,
        keterangan,
        foto_bukti
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [id_cabang, tanggal, kategori, jumlahNum, keterangan || null, foto_bukti || null])

    return NextResponse.json({
      success: true,
      id_pengeluaran: result.insertId,
      message: 'Expense created successfully'
    })

  } catch (error) {
    console.error('Create expense error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 })
  }
}
