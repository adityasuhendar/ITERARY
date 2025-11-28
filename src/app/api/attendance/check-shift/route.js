import { NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const shift = searchParams.get('shift') 
    const branch = searchParams.get('branch')
    const checkSelf = searchParams.get('checkSelf') === 'true'

    if (!date || !shift) {
      return NextResponse.json(
        { error: 'Date and shift are required' },
        { status: 400 }
      )
    }

    let sqlQuery, params

    if (checkSelf) {
      // Check current user's attendance for this specific shift
      const token = request.cookies.get('auth-token')?.value
      if (!token) {
        return NextResponse.json({ hasAttendance: false })
      }

      const jwt = require('jsonwebtoken')
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      
      sqlQuery = `
        SELECT
          a.nama_pekerja,
          a.id_attendance,
          a.waktu_mulai,
          a.created_at,
          a.id_cabang,
          c.nama_cabang
        FROM attendance_harian a
        LEFT JOIN cabang c ON a.id_cabang = c.id_cabang
        WHERE DATE(a.tanggal) = ? AND a.shift = ? AND a.id_karyawan_akun = ?
      `
      params = [date, shift, decoded.id]
    } else {
      // Query to check if anyone has attendance for this shift today
      sqlQuery = `
        SELECT nama_pekerja, id_karyawan_akun
        FROM attendance_harian
        WHERE DATE(tanggal) = ? AND shift = ?
      `
      params = [date, shift]

      // Add branch filter if provided
      if (branch) {
        sqlQuery += ` AND id_cabang = ?`
        params.push(branch)
      }
    }

    sqlQuery += ` LIMIT 1`

    const rows = await query(sqlQuery, params)

    const hasAttendance = rows.length > 0
    const workerName = hasAttendance ? rows[0].nama_pekerja : ''
    const workerId = hasAttendance ? rows[0].id_karyawan_akun : null

    const response = {
      hasAttendance,
      workerName,
      workerId,
      date,
      // Include branch name for checkSelf queries
      ...(checkSelf && hasAttendance && { nama_cabang: rows[0].nama_cabang }),
      shift,
      branch,
      checkSelf
    }

    // Add attendance details if checkSelf and has attendance
    if (checkSelf && hasAttendance && rows[0]) {
      response.waktu_mulai = rows[0].waktu_mulai
      response.created_at = rows[0].created_at
      response.id_attendance = rows[0].id_attendance
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Check shift attendance error:', error)
    return NextResponse.json(
      { error: 'Database error' },
      { status: 500 }
    )
  }
}