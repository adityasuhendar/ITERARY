import { NextResponse } from 'next/server'
import { handleJWTAuth } from '@/lib/jwtHandler'
import { query } from '@/lib/database'

export async function PUT(request, { params }) {
  try {
    // Check authentication
    const { decoded, errorResponse } = handleJWTAuth(request, ['owner', 'super_admin'])
    if (errorResponse) return errorResponse

    const { id } = params
    const { id_cabang, nomor_mesin, jenis_mesin, status_mesin } = await request.json()

    // Validation
    if (!id_cabang || !nomor_mesin?.trim() || !jenis_mesin) {
      return NextResponse.json({
        success: false,
        message: 'Data tidak lengkap. Cabang, nomor mesin, dan jenis mesin harus diisi.'
      }, { status: 400 })
    }

    // Validate jenis_mesin
    if (!['cuci', 'pengering'].includes(jenis_mesin)) {
      return NextResponse.json({
        success: false,
        message: 'Jenis mesin tidak valid. Harus cuci atau pengering.'
      }, { status: 400 })
    }

    // Validate status_mesin
    const validStatuses = ['tersedia', 'rusak']
    if (status_mesin && !validStatuses.includes(status_mesin)) {
      return NextResponse.json({
        success: false,
        message: 'Status mesin tidak valid. Hanya tersedia atau rusak.'
      }, { status: 400 })
    }

    // Check if machine exists
    const existingMachines = await query(
      'SELECT id_mesin FROM mesin_laundry WHERE id_mesin = ?',
      [id]
    )

    if (existingMachines.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Mesin tidak ditemukan'
      }, { status: 404 })
    }

    // Check if branch exists
    const branches = await query(
      'SELECT id_cabang FROM cabang WHERE id_cabang = ?',
      [id_cabang]
    )

    if (branches.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Cabang tidak ditemukan'
      }, { status: 400 })
    }

    // Check if machine number already exists in the branch (excluding current machine)
    const duplicateMachines = await query(
      'SELECT id_mesin FROM mesin_laundry WHERE id_cabang = ? AND nomor_mesin = ? AND id_mesin != ?',
      [id_cabang, nomor_mesin.trim(), id]
    )

    if (duplicateMachines.length > 0) {
      return NextResponse.json({
        success: false,
        message: `Nomor mesin ${nomor_mesin} sudah ada di cabang ini`
      }, { status: 400 })
    }

    // Update machine
    await query(
      `UPDATE mesin_laundry
       SET id_cabang = ?, nomor_mesin = ?, jenis_mesin = ?, status_mesin = ?,
           updated_by_karyawan = ?, diupdate_pada = NOW()
       WHERE id_mesin = ?`,
      [
        id_cabang,
        nomor_mesin.trim().toUpperCase(),
        jenis_mesin,
        status_mesin || 'tersedia',
        decoded.id,
        id
      ]
    )

    return NextResponse.json({
      success: true,
      message: 'Mesin berhasil diupdate'
    })

  } catch (error) {
    console.error('Error updating machine:', error)

    // Handle specific MySQL errors
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({
        success: false,
        message: 'Nomor mesin sudah ada di cabang ini'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      message: 'Gagal mengupdate mesin',
      error: error.message
    }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    // Check authentication
    const { decoded, errorResponse } = handleJWTAuth(request, ['owner', 'super_admin'])
    if (errorResponse) return errorResponse

    const { id } = params

    // Check if machine exists
    const existingMachines = await query(
      'SELECT id_mesin, status_mesin FROM mesin_laundry WHERE id_mesin = ?',
      [id]
    )

    if (existingMachines.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Mesin tidak ditemukan'
      }, { status: 404 })
    }

    const machine = existingMachines[0]

    // Allow deletion regardless of status in simplified system

    // Check if machine is referenced in transactions
    const transactionUsage = await query(
      'SELECT COUNT(*) as count FROM detail_transaksi_layanan WHERE id_mesin = ?',
      [id]
    )

    if (transactionUsage[0].count > 0) {
      return NextResponse.json({
        success: false,
        message: 'Tidak dapat menghapus mesin yang pernah digunakan dalam transaksi. Ubah status menjadi "rusak" jika mesin tidak dapat digunakan lagi.'
      }, { status: 400 })
    }

    // Delete machine
    await query('DELETE FROM mesin_laundry WHERE id_mesin = ?', [id])

    return NextResponse.json({
      success: true,
      message: 'Mesin berhasil dihapus'
    })

  } catch (error) {
    console.error('Error deleting machine:', error)

    return NextResponse.json({
      success: false,
      message: 'Gagal menghapus mesin',
      error: error.message
    }, { status: 500 })
  }
}