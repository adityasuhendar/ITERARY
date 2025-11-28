import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// PUT - Change user password
export async function PUT(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    const { currentPassword, newPassword } = await request.json()

    // Validation
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ 
        error: 'Validation error',
        message: 'Password lama dan password baru wajib diisi'
      }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({
        error: 'Validation error',
        message: 'Password baru minimal 6 karakter'
      }, { status: 400 })
    }

    // Get current user data
    const userData = await query(`
      SELECT password_hash FROM karyawan WHERE id_karyawan = ?
    `, [user.id])

    if (userData.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userData[0].password_hash)
    if (!isCurrentPasswordValid) {
      return NextResponse.json({
        error: 'Authentication error',
        message: 'Password lama tidak benar'
      }, { status: 400 })
    }

    // Hash new password
    const saltRounds = 10
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds)

    // Update password
    await query(`
      UPDATE karyawan 
      SET password_hash = ?
      WHERE id_karyawan = ?
    `, [newPasswordHash, user.id])

    // Log the password change
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
          action: 'password_change',
          timestamp: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z',
          security_event: true
        }),
        request.headers.get('x-forwarded-for') || 'unknown'
      ])
    } catch (auditError) {
      console.warn('Failed to log password change:', auditError)
    }

    return NextResponse.json({
      success: true,
      message: 'Password berhasil diubah'
    })

  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({
      error: 'Database error',
      message: error.message
    }, { status: 500 })
  }
}