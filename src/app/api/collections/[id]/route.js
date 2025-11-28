import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'

export async function GET(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }
    
    // Only collector, admin, and owner can access collection details
    if (!['collector', 'super_admin', 'owner'].includes(decoded.jenis_karyawan)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const resolvedParams = await params
    const collectionId = resolvedParams.id

    const collections = await query(`
      SELECT 
        p.*,
        c.nama_cabang,
        k1.nama_karyawan as nama_kasir,
        k2.nama_karyawan as nama_collector
      FROM pengambilan_uang p
      JOIN cabang c ON p.id_cabang = c.id_cabang
      JOIN karyawan k1 ON p.id_karyawan_kasir = k1.id_karyawan
      JOIN karyawan k2 ON p.id_karyawan_collector = k2.id_karyawan
      WHERE p.id_pengambilan = ?
    `, [collectionId])

    if (collections.length === 0) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    return NextResponse.json({ collection: collections[0] })

  } catch (error) {
    console.error('Collection detail API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }
    
    // Only collector can edit their own collections
    if (decoded.jenis_karyawan !== 'collector') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const resolvedParams = await params
    const collectionId = resolvedParams.id
    const {
      uang_fisik_dihitung,
      uang_diambil,
      alasan_selisih,
      catatan,
      status_pengambilan
    } = await request.json()

    // Calculate new selisih
    const collections = await query(`
      SELECT total_tunai_sistem, total_qris_sistem 
      FROM pengambilan_uang 
      WHERE id_pengambilan = ? AND id_karyawan_collector = ?
    `, [collectionId, decoded.id])

    if (collections.length === 0) {
      return NextResponse.json({ error: 'Collection not found or access denied' }, { status: 404 })
    }

    const collection = collections[0]
    const sistemTotal = collection.total_tunai_sistem + collection.total_qris_sistem
    const selisih = (uang_fisik_dihitung || 0) - sistemTotal

    await query(`
      UPDATE pengambilan_uang SET
        uang_fisik_dihitung = ?,
        uang_diambil = ?,
        selisih = ?,
        alasan_selisih = ?,
        catatan = ?,
        status_pengambilan = ?
      WHERE id_pengambilan = ? AND id_karyawan_collector = ?
    `, [
      uang_fisik_dihitung || 0,
      uang_diambil || 0,
      selisih,
      alasan_selisih,
      catatan,
      status_pengambilan || 'selesai',
      collectionId,
      decoded.id
    ])

    return NextResponse.json({ 
      success: true, 
      message: 'Collection updated successfully',
      selisih: selisih
    })

  } catch (error) {
    console.error('Collection update error:', error)
    return NextResponse.json({ error: 'Failed to update collection' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }
    
    // Only collector or admin can delete collections
    if (!['collector', 'super_admin'].includes(decoded.jenis_karyawan)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const resolvedParams = await params
    const collectionId = resolvedParams.id

    // For collector, they can only delete their own collections
    let whereClause = 'WHERE id_pengambilan = ?'
    let params_array = [collectionId]

    if (decoded.jenis_karyawan === 'collector') {
      whereClause += ' AND id_karyawan_collector = ?'
      params_array.push(decoded.id)
    }

    const result = await query(`
      DELETE FROM pengambilan_uang ${whereClause}
    `, params_array)

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Collection not found or access denied' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Collection deleted successfully'
    })

  } catch (error) {
    console.error('Collection delete error:', error)
    return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 })
  }
}