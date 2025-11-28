import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'

export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    console.log('GET /api/attendance/check - Token:', token ? 'Present' : 'Missing')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log('GET /api/attendance/check - Decoded token:', { id: decoded.id, jenis_karyawan: decoded.jenis_karyawan })
    
    if (!decoded || decoded.jenis_karyawan !== 'kasir') {
      return NextResponse.json({ error: 'Only kasir can check attendance' }, { status: 403 })
    }

    const userId = decoded.id || decoded.id_karyawan
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    
    console.log('GET /api/attendance/check - Checking for user ID:', userId, 'on date:', today)

    // Check if attendance already recorded for this shift today
    const existingAttendance = await query(`
      SELECT 
        id_attendance,
        nama_pekerja,
        tanggal,
        shift,
        waktu_mulai,
        status
      FROM attendance_harian 
      WHERE id_karyawan_akun = ? AND tanggal = ?
    `, [userId, today])

    console.log('GET /api/attendance/check - Found existing attendance:', existingAttendance.length)

    return NextResponse.json({
      success: true,
      hasAttendance: existingAttendance.length > 0,
      attendance: existingAttendance.length > 0 ? existingAttendance[0] : null
    })

  } catch (error) {
    console.error('Attendance check error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}