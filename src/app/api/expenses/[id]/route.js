import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'

// Update expense
export async function PUT(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || !['kasir', 'owner', 'collector', 'super_admin'].includes(decoded.jenis_karyawan)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const expenseId = (await params).id
    const body = await request.json()
    const { tanggal, kategori, jumlah, keterangan, foto_bukti } = body

    // Validation
    if (!tanggal || !kategori || !jumlah) {
      return NextResponse.json({
        error: 'Missing required fields: tanggal, kategori, jumlah'
      }, { status: 400 })
    }

    // Check if expense exists
    const existingExpense = await query(`
      SELECT id_cabang FROM pengeluaran WHERE id_pengeluaran = ?
    `, [expenseId])

    if (existingExpense.length === 0) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    // Kasir can only update expense from their own branch
    if (decoded.jenis_karyawan === 'kasir' && existingExpense[0].id_cabang !== decoded.cabang_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Validate jumlah
    const jumlahNum = parseFloat(jumlah)
    if (isNaN(jumlahNum) || jumlahNum <= 0) {
      return NextResponse.json({ error: 'Invalid jumlah' }, { status: 400 })
    }

    // Update expense
    await query(`
      UPDATE pengeluaran
      SET tanggal = ?,
          kategori = ?,
          jumlah = ?,
          keterangan = ?,
          foto_bukti = ?
      WHERE id_pengeluaran = ?
    `, [tanggal, kategori, jumlahNum, keterangan || null, foto_bukti || null, expenseId])

    return NextResponse.json({
      success: true,
      message: 'Expense updated successfully'
    })

  } catch (error) {
    console.error('Update expense error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 })
  }
}

// Delete expense
export async function DELETE(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || !['kasir', 'owner', 'collector', 'super_admin'].includes(decoded.jenis_karyawan)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const expenseId = (await params).id

    // Check if expense exists
    const existingExpense = await query(`
      SELECT id_cabang FROM pengeluaran WHERE id_pengeluaran = ?
    `, [expenseId])

    if (existingExpense.length === 0) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    // Kasir can only delete expense from their own branch
    if (decoded.jenis_karyawan === 'kasir' && existingExpense[0].id_cabang !== decoded.cabang_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete expense
    await query(`
      DELETE FROM pengeluaran WHERE id_pengeluaran = ?
    `, [expenseId])

    return NextResponse.json({
      success: true,
      message: 'Expense deleted successfully'
    })

  } catch (error) {
    console.error('Delete expense error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 })
  }
}
