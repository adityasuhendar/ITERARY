import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'

// POST - Record new money collection
export async function POST(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || decoded.jenis_karyawan !== 'collector') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const {
      cabang_id,
      kasir_id,
      shift,
      total_tunai_sistem,
      total_qris_sistem,
      uang_fisik_dihitung,
      uang_diambil,
      alasan_selisih,
      catatan
    } = await request.json()

    if (!cabang_id || !kasir_id || !shift || uang_diambil === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    const currentTime = new Date().toTimeString().slice(0, 8)
    const collectorId = decoded.id

    // Calculate selisih (difference)
    const sistemTotal = (total_tunai_sistem || 0) + (total_qris_sistem || 0)
    const selisih = (uang_fisik_dihitung || 0) - sistemTotal

    // Insert pengambilan_uang record
    const result = await query(`
      INSERT INTO pengambilan_uang (
        id_cabang, id_karyawan_kasir, id_karyawan_collector, shift_diambil,
        total_tunai_sistem, total_qris_sistem, uang_fisik_dihitung,
        uang_diambil, selisih, alasan_selisih, tanggal_pengambilan,
        jam_pengambilan, status_pengambilan, catatan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'selesai', ?)
    `, [
      cabang_id, kasir_id, collectorId, shift,
      total_tunai_sistem || 0, total_qris_sistem || 0, uang_fisik_dihitung || 0,
      uang_diambil, selisih, alasan_selisih, today,
      currentTime, catatan
    ])

    return NextResponse.json({ 
      success: true, 
      id: result.insertId,
      message: 'Collection recorded successfully',
      selisih: selisih
    })

  } catch (error) {
    console.error('Collection recording error:', error)
    return NextResponse.json({ error: 'Failed to record collection' }, { status: 500 })
  }
}

// GET - Get collections for current collector
export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || decoded.jenis_karyawan !== 'collector') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const url = new URL(request.url)
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')
    const limit = parseInt(url.searchParams.get('limit')) || 50

    let whereClause = 'WHERE p.id_karyawan_collector = ?'
    let params = [decoded.id]

    if (startDate) {
      whereClause += ' AND p.tanggal_pengambilan >= ?'
      params.push(startDate)
    }

    if (endDate) {
      whereClause += ' AND p.tanggal_pengambilan <= ?'
      params.push(endDate)
    }

    const collections = await query(`
      SELECT 
        p.*,
        c.nama_cabang,
        k.nama_karyawan as nama_kasir
      FROM pengambilan_uang p
      JOIN cabang c ON p.id_cabang = c.id_cabang
      JOIN karyawan k ON p.id_karyawan_kasir = k.id_karyawan
      ${whereClause}
      ORDER BY p.tanggal_pengambilan DESC, p.jam_pengambilan DESC
      LIMIT ?
    `, [...params, limit])

    return NextResponse.json({ collections })

  } catch (error) {
    console.error('Collections fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 })
  }
}