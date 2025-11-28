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
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }
    
    // Only collector and admin can access this
    if (!['collector', 'super_admin', 'owner'].includes(decoded.jenis_karyawan)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const url = new URL(request.url)
    const cabangId = url.searchParams.get('cabang_id')

    let whereClause = "WHERE k.jenis_karyawan = 'kasir' AND k.status_aktif = 'aktif'"
    let params = []

    if (cabangId) {
      whereClause += ' AND k.id_cabang = ?'
      params.push(cabangId)
    }

    const kasirData = await query(`
      SELECT 
        k.id_karyawan,
        k.nama_karyawan,
        k.shift,
        k.id_cabang,
        c.nama_cabang
      FROM karyawan k
      LEFT JOIN cabang c ON k.id_cabang = c.id_cabang
      ${whereClause}
      ORDER BY c.nama_cabang, k.shift, k.nama_karyawan
    `, params)

    return NextResponse.json({ kasir: kasirData })

  } catch (error) {
    console.error('Kasir API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}