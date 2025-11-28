import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { hashPassword } from '@/lib/auth'
import jwt from 'jsonwebtoken'

export async function GET(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || (decoded.jenis_karyawan !== 'owner' && decoded.jenis_karyawan !== 'super_admin')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    const employees = await query(`
      SELECT 
        k.*, 
        c.nama_cabang,
        r.nama_role,
        r.deskripsi_role
      FROM karyawan k 
      LEFT JOIN cabang c ON k.id_cabang = c.id_cabang
      LEFT JOIN role_permissions r ON k.id_role = r.id_role
      WHERE k.id_karyawan = ?
    `, [id])

    if (employees.length === 0) {
      return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
    }

    const { password_hash, ...employee } = employees[0]

    return NextResponse.json({
      success: true,
      employee
    })

  } catch (error) {
    console.error('Employee GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || (decoded.jenis_karyawan !== 'owner' && decoded.jenis_karyawan !== 'super_admin')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      nama_karyawan,
      nomor_telepon,
      jenis_karyawan,
      shift,
      username,
      password,
      id_cabang,
      status_aktif,
      allowed_branches
    } = body

    // Check if employee exists
    const existingEmployee = await query(
      'SELECT id_karyawan, username FROM karyawan WHERE id_karyawan = ?',
      [id]
    )

    if (existingEmployee.length === 0) {
      return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
    }

    // Check username uniqueness (excluding current employee)
    if (username && username !== existingEmployee[0].username) {
      const usernameCheck = await query(
        'SELECT id_karyawan FROM karyawan WHERE username = ? AND id_karyawan != ?',
        [username, id]
      )

      if (usernameCheck.length > 0) {
        return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 400 })
      }
    }

    // Get role ID if jenis_karyawan changed
    let id_role = null
    if (jenis_karyawan) {
      const roleResult = await query(
        'SELECT id_role FROM role_permissions WHERE nama_role = ?',
        [jenis_karyawan]
      )

      if (roleResult.length === 0) {
        return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
      }
      id_role = roleResult[0].id_role
    }

    // Build update query dynamically
    const updateFields = []
    const updateValues = []

    if (nama_karyawan) {
      updateFields.push('nama_karyawan = ?')
      updateValues.push(nama_karyawan)
    }
    if (nomor_telepon !== undefined) {
      updateFields.push('nomor_telepon = ?')
      updateValues.push(nomor_telepon || null)
    }
    if (jenis_karyawan) {
      updateFields.push('jenis_karyawan = ?', 'id_role = ?')
      updateValues.push(jenis_karyawan, id_role)
    }
    if (shift !== undefined) {
      updateFields.push('shift = ?')
      // Convert empty string to null for database consistency
      const finalShift = (shift === '' || shift === null || shift === undefined) ? null : shift
      updateValues.push(finalShift)
    }
    if (username) {
      updateFields.push('username = ?')
      updateValues.push(username)
    }
    if (id_cabang !== undefined) {
      updateFields.push('id_cabang = ?')
      // Convert empty string to null for database consistency
      const finalIdCabang = (id_cabang === '' || id_cabang === null || id_cabang === undefined) ? null : parseInt(id_cabang)
      updateValues.push(finalIdCabang)
    }
    if (status_aktif) {
      updateFields.push('status_aktif = ?')
      updateValues.push(status_aktif)
    }
    if (allowed_branches !== undefined) {
      updateFields.push('allowed_branches = ?')
      // Handle allowed_branches for investor role
      const finalAllowedBranches = (jenis_karyawan === 'investor' && allowed_branches && Array.isArray(allowed_branches))
        ? JSON.stringify(allowed_branches)
        : null
      updateValues.push(finalAllowedBranches)
    }

    // Hash new password if provided
    if (password) {
      // Password length validation
      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Password minimal 6 karakter' },
          { status: 400 }
        )
      }
      const password_hash = await hashPassword(password)
      updateFields.push('password_hash = ?')
      updateValues.push(password_hash)
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang diupdate' }, { status: 400 })
    }

    updateValues.push(id)

    const updateQuery = `UPDATE karyawan SET ${updateFields.join(', ')} WHERE id_karyawan = ?`
    await query(updateQuery, updateValues)

    return NextResponse.json({
      success: true,
      message: 'Data karyawan berhasil diupdate'
    })

  } catch (error) {
    console.error('Employee PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || (decoded.jenis_karyawan !== 'owner' && decoded.jenis_karyawan !== 'super_admin')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    // Check if employee exists and prevent deletion of super_admin/owner
    const employee = await query(
      'SELECT jenis_karyawan FROM karyawan WHERE id_karyawan = ?',
      [id]
    )

    if (employee.length === 0) {
      return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
    }

    if (employee[0].jenis_karyawan === 'super_admin' || employee[0].jenis_karyawan === 'owner') {
      return NextResponse.json({ error: 'Super Admin dan Owner tidak bisa dihapus' }, { status: 400 })
    }

    // Soft delete - change status to nonaktif instead of actual deletion
    await query(
      'UPDATE karyawan SET status_aktif = ? WHERE id_karyawan = ?',
      ['nonaktif', id]
    )

    return NextResponse.json({
      success: true,
      message: 'Karyawan berhasil dinonaktifkan'
    })

  } catch (error) {
    console.error('Employee DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}