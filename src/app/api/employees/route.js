import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { hashPassword } from '@/lib/auth'
import jwt from 'jsonwebtoken'

export async function GET(request) {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || (decoded.jenis_karyawan !== 'owner' && decoded.jenis_karyawan !== 'super_admin')) {
      return NextResponse.json({ error: 'Access denied. Owner/Admin role required.' }, { status: 403 })
    }

    // Get status filter from query parameters
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    // Build WHERE clause based on status filter
    let whereClause = ''
    if (statusFilter === 'inactive') {
      whereClause = "WHERE k.status_aktif = 'nonaktif'"
    } else if (statusFilter === 'active') {
      whereClause = "WHERE k.status_aktif = 'aktif'"
    }
    // If no status filter, get all employees

    // Get employees with branch and role info
    const employees = await query(`
      SELECT 
        k.*, 
        c.nama_cabang,
        r.nama_role,
        r.deskripsi_role
      FROM karyawan k 
      LEFT JOIN cabang c ON k.id_cabang = c.id_cabang
      LEFT JOIN role_permissions r ON k.id_role = r.id_role
      ${whereClause}
      ORDER BY k.dibuat_pada DESC
    `)

    // Remove sensitive data
    const sanitizedEmployees = employees.map(emp => {
      const { password_hash, ...employee } = emp
      return employee
    })

    return NextResponse.json({
      success: true,
      employees: sanitizedEmployees,
      total: sanitizedEmployees.length
    })

  } catch (error) {
    console.error('Employees GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || (decoded.jenis_karyawan !== 'owner' && decoded.jenis_karyawan !== 'super_admin')) {
      return NextResponse.json({ error: 'Access denied. Owner/Admin role required.' }, { status: 403 })
    }

    const body = await request.json()
    const {
      nama_karyawan,
      nomor_telepon,
      jenis_karyawan,
      shift,
      username,
      password,
      id_cabang,
      status_aktif = 'aktif',
      allowed_branches
    } = body

    // Validation
    if (!nama_karyawan || !username || !password || !jenis_karyawan) {
      return NextResponse.json(
        { error: 'Nama, username, password, dan jenis karyawan wajib diisi' },
        { status: 400 }
      )
    }

    // Password length validation
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password minimal 6 karakter' },
        { status: 400 }
      )
    }

    // Check if username already exists
    const existingUser = await query(
      'SELECT id_karyawan FROM karyawan WHERE username = ?',
      [username]
    )

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: 'Username sudah digunakan' },
        { status: 400 }
      )
    }

    // Get role ID
    const roleResult = await query(
      'SELECT id_role FROM role_permissions WHERE nama_role = ?',
      [jenis_karyawan]
    )

    if (roleResult.length === 0) {
      return NextResponse.json(
        { error: 'Role tidak valid' },
        { status: 400 }
      )
    }

    const id_role = roleResult[0].id_role

    // Hash password
    const password_hash = await hashPassword(password)

    // Convert empty string to null for database consistency
    const finalIdCabang = (id_cabang === '' || id_cabang === null || id_cabang === undefined) ? null : parseInt(id_cabang)
    const finalShift = (shift === '' || shift === null || shift === undefined) ? null : shift

    // Handle allowed_branches for investor role
    const finalAllowedBranches = (jenis_karyawan === 'investor' && allowed_branches && Array.isArray(allowed_branches))
      ? JSON.stringify(allowed_branches)
      : null

    // Insert new employee
    const result = await query(`
      INSERT INTO karyawan (
        id_cabang, id_role, nama_karyawan, nomor_telepon,
        jenis_karyawan, shift, username, password_hash, status_aktif, allowed_branches
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      finalIdCabang,
      id_role,
      nama_karyawan,
      nomor_telepon || null,
      jenis_karyawan,
      finalShift,
      username,
      password_hash,
      status_aktif,
      finalAllowedBranches
    ])

    return NextResponse.json({
      success: true,
      message: 'Karyawan berhasil ditambahkan',
      id_karyawan: result.insertId
    })

  } catch (error) {
    console.error('Employees POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}