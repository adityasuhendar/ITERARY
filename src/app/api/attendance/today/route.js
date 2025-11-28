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
    if (!decoded || (decoded.jenis_karyawan !== 'owner' && decoded.jenis_karyawan !== 'super_admin')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    
    // Get today's attendance data
    const attendanceData = await query(`
      SELECT 
        a.*,
        k.nama_karyawan as nama_akun_shift,
        c.nama_cabang,
        DATE_FORMAT(a.waktu_mulai, '%H:%i') as jam_mulai
      FROM attendance_harian a
      LEFT JOIN karyawan k ON a.id_karyawan_akun = k.id_karyawan
      LEFT JOIN cabang c ON a.id_cabang = c.id_cabang
      WHERE DATE(a.tanggal) = ?
      ORDER BY a.shift ASC, a.waktu_mulai ASC
    `, [today])

    return NextResponse.json({
      success: true,
      attendance: attendanceData,
      date: today,
      total: attendanceData.length
    })

  } catch (error) {
    console.error('Today attendance GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}