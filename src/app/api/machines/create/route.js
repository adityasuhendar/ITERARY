import { NextResponse } from 'next/server'
import { handleJWTAuth } from '@/lib/jwtHandler'
import { query } from '@/lib/database'

export async function POST(request) {
  try {
    // Check authentication
    const { decoded, errorResponse } = handleJWTAuth(request, ['owner', 'super_admin'])
    if (errorResponse) return errorResponse

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

    // Check if machine number already exists in the branch
    const existingMachines = await query(
      'SELECT id_mesin FROM mesin_laundry WHERE id_cabang = ? AND nomor_mesin = ?',
      [id_cabang, nomor_mesin.trim()]
    )

    if (existingMachines.length > 0) {
      return NextResponse.json({
        success: false,
        message: `Nomor mesin ${nomor_mesin} sudah ada di cabang ini`
      }, { status: 400 })
    }

    // Insert new machine
    const result = await query(
      `INSERT INTO mesin_laundry
       (id_cabang, nomor_mesin, jenis_mesin, status_mesin, updated_by_karyawan, diupdate_pada)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        id_cabang,
        nomor_mesin.trim().toUpperCase(),
        jenis_mesin,
        status_mesin || 'tersedia',
        decoded.id
      ]
    )

    return NextResponse.json({
      success: true,
      message: 'Mesin berhasil ditambahkan',
      machine_id: result.insertId
    })

  } catch (error) {
    console.error('Error creating machine:', error)

    // Handle specific MySQL errors
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({
        success: false,
        message: 'Nomor mesin sudah ada di cabang ini'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      message: 'Gagal menambahkan mesin',
      error: error.message
    }, { status: 500 })
  }
}