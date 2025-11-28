import { NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function PUT(request, { params }) {
  try {
    const { id } = await params

    // Update employee status to active
    const result = await query(`
      UPDATE karyawan
      SET status_aktif = 'aktif'
      WHERE id_karyawan = ? AND status_aktif != 'aktif'
    `, [id])

    if (result.affectedRows === 0) {
      return NextResponse.json({
        success: false,
        error: 'Akun tidak ditemukan atau sudah aktif'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Akun berhasil diaktifkan kembali'
    })

  } catch (error) {
    console.error('Restore employee error:', error)

    return NextResponse.json({
      success: false,
      error: 'Terjadi kesalahan sistem'
    }, { status: 500 })
  }
}