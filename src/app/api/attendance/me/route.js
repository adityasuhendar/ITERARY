import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'

export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log('🔍 JWT decoded:', decoded)
    
    if (!decoded || (decoded.jenis_karyawan !== 'kasir' && decoded.jenis_karyawan !== 'collector')) {
      return NextResponse.json({ error: 'Access denied - kasir or backup collector only' }, { status: 403 })
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    console.log('📅 Today:', today)
    console.log('👤 Looking for id_karyawan_akun:', decoded.id)
    
    // Get current user's attendance today - NO daftar_pekerja needed!
    const myAttendance = await query(`
      SELECT 
        a.*,
        DATE_FORMAT(a.waktu_mulai, '%H:%i') as jam_mulai,
        DATE_FORMAT(a.waktu_selesai, '%H:%i') as jam_selesai
      FROM attendance_harian a
      WHERE a.id_karyawan_akun = ? AND DATE(a.tanggal) = ?
      LIMIT 1
    `, [decoded.id, today])
    
    console.log('📊 Query result:', myAttendance)

    return NextResponse.json({
      success: true,
      hasAttendance: myAttendance.length > 0,
      attendance: myAttendance[0] || null,
      date: today
    })

  } catch (error) {
    console.error('My attendance GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}