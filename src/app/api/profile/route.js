import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// GET - Fetch user profile
export async function GET(request) {
  try {
    console.log('Profile API: GET request received')
    const token = request.cookies.get('auth-token')?.value
    const activeWorkerId = request.headers.get('x-active-worker-id')
    const activeWorkerName = request.headers.get('x-active-worker-name')
    
    console.log('Profile API: Token found:', token ? 'yes' : 'no')
    console.log('Profile API: Active worker ID:', activeWorkerId)
    console.log('Profile API: Active worker name:', activeWorkerName)
    console.log('Profile API: All headers:', Object.fromEntries(request.headers.entries()))
    
    if (!token) {
      console.log('Profile API: No token provided')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    console.log('Profile API: Token verification result:', user ? 'valid' : 'invalid')
    
    if (!user) {
      console.log('Profile API: Invalid token')
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }


    // Fetch complete user profile with branch info (default behavior)
    const userProfile = await query(`
      SELECT 
        k.*,
        c.nama_cabang as cabang,
        r.nama_role
      FROM karyawan k
      LEFT JOIN cabang c ON k.id_cabang = c.id_cabang
      LEFT JOIN role_permissions r ON k.id_role = r.id_role
      WHERE k.id_karyawan = ?
    `, [user.id])

    if (userProfile.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const profile = userProfile[0]
    profile.is_worker_profile = false
    
    // Remove sensitive data
    delete profile.password_hash
    
    return NextResponse.json(profile)

  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json({
      error: 'Database error',
      message: error.message
    }, { status: 500 })
  }
}

// PUT - Update user profile
export async function PUT(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    const activeWorkerId = request.headers.get('x-active-worker-id')
    const activeWorkerName = request.headers.get('x-active-worker-name')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    const requestData = await request.json()


    // Default behavior - update kasir account
    const { nama_karyawan, username } = requestData

    // Validation
    if (!nama_karyawan || !username) {
      return NextResponse.json({ 
        error: 'Validation error',
        message: 'Nama karyawan dan username wajib diisi'
      }, { status: 400 })
    }

    // Check if username is already taken by another user
    const existingUser = await query(`
      SELECT id_karyawan FROM karyawan 
      WHERE username = ? AND id_karyawan != ?
    `, [username, user.id])

    if (existingUser.length > 0) {
      return NextResponse.json({
        error: 'Validation error',
        message: 'Username sudah digunakan oleh pengguna lain'
      }, { status: 400 })
    }

    // Update profile
    await query(`
      UPDATE karyawan
      SET nama_karyawan = ?,
          username = ?
      WHERE id_karyawan = ?
    `, [nama_karyawan, username, user.id])

    // Log the profile update
    try {
      await query(`
        INSERT INTO audit_log (
          id_karyawan, 
          tabel_diubah, 
          aksi, 
          data_baru,
          ip_address
        ) VALUES (?, 'karyawan', 'UPDATE', ?, ?)
      `, [
        user.id,
        JSON.stringify({
          action: 'profile_update',
          fields_updated: ['nama_karyawan', 'username'],
          timestamp: new Date().toISOString()
        }),
        request.headers.get('x-forwarded-for') || 'unknown'
      ])
    } catch (auditError) {
      console.warn('Failed to log profile update:', auditError)
    }

    // Fetch updated profile
    const updatedProfile = await query(`
      SELECT 
        k.*,
        c.nama_cabang as cabang,
        r.nama_role
      FROM karyawan k
      LEFT JOIN cabang c ON k.id_cabang = c.id_cabang
      LEFT JOIN role_permissions r ON k.id_role = r.id_role
      WHERE k.id_karyawan = ?
    `, [user.id])

    const profile = updatedProfile[0]
    profile.is_worker_profile = false
    delete profile.password_hash

    return NextResponse.json(profile)

  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json({
      error: 'Database error',
      message: error.message
    }, { status: 500 })
  }
}