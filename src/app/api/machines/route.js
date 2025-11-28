// FILE: src/app/api/machines/status/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken } from '@/lib/auth'

export async function PUT(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user || !['kasir', 'super_admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { machine_id, new_status, estimated_finish, notes } = await request.json()

    if (!machine_id || !new_status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate status
    const validStatuses = ['tersedia', 'digunakan', 'maintenance', 'rusak']
    if (!validStatuses.includes(new_status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Check if machine exists and belongs to user's cabang (for kasir)
    const machineCheck = await query(`
      SELECT m.*, c.nama_cabang 
      FROM mesin_laundry m
      JOIN cabang c ON m.id_cabang = c.id_cabang
      WHERE m.id_mesin = ?
    `, [machine_id])

    if (machineCheck.length === 0) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 })
    }

    const machine = machineCheck[0]

    // Kasir can only update machines in their cabang
    if (user.role === 'kasir' && machine.id_cabang !== user.cabang_id) {
      return NextResponse.json({ error: 'Access denied to this machine' }, { status: 403 })
    }

    // Update machine status with timing support for manual assignments
    if (new_status === 'digunakan' && estimated_finish) {
      // Convert time string (HH:MM) to full datetime for today
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      const estimatedDateTime = new Date(`${today}T${estimated_finish}:00`) // Full timestamp
      
      await query(`
        UPDATE mesin_laundry 
        SET status_mesin = ?, 
            estimasi_selesai = ?,
            updated_by_karyawan = ?,
            diupdate_pada = NOW()
        WHERE id_mesin = ?
      `, [new_status, estimatedDateTime, user.id, machine_id])
      
    } else if (new_status === 'tersedia') {
      // Clear estimated finish when setting machine to available
      await query(`
        UPDATE mesin_laundry 
        SET status_mesin = ?, 
            estimasi_selesai = NULL,
            updated_by_karyawan = ?,
            diupdate_pada = NOW()
        WHERE id_mesin = ?
      `, [new_status, user.id, machine_id])
      
    } else {
      // For other statuses (maintenance, rusak), clear estimated finish
      await query(`
        UPDATE mesin_laundry 
        SET status_mesin = ?, 
            estimasi_selesai = NULL,
            updated_by_karyawan = ?,
            diupdate_pada = NOW()
        WHERE id_mesin = ?
      `, [new_status, user.id, machine_id])
    }

    // If machine is being set to 'tersedia', clear any active assignments
    if (new_status === 'tersedia') {
      await query(`
        UPDATE detail_transaksi_layanan 
        SET estimasi_selesai = NULL
        WHERE id_mesin = ? AND estimasi_selesai > NOW()
      `, [machine_id])
      
      console.log(`🧹 Cleared active assignments for machine ${machine_id}`)
    }

    // Log the machine status change in audit log
    try {
      await query(`
        INSERT INTO audit_log (
          id_karyawan, 
          tabel_diubah, 
          aksi, 
          data_baru,
          ip_address
        ) VALUES (?, 'mesin_laundry', 'UPDATE', ?, ?)
      `, [
        user.id,
        JSON.stringify({
          machine_id,
          old_status: machine.status_mesin,
          new_status,
          estimated_finish,
          notes,
          timestamp: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z'
        }),
        request.headers.get('x-forwarded-for') || 'unknown'
      ])
    } catch (auditError) {
      console.warn('Failed to log machine status update:', auditError)
    }

    // Get updated machine info
    const updatedMachine = await query(`
      SELECT m.*, c.nama_cabang, k.nama_karyawan as updated_by_name
      FROM mesin_laundry m
      JOIN cabang c ON m.id_cabang = c.id_cabang
      LEFT JOIN karyawan k ON m.updated_by_karyawan = k.id_karyawan
      WHERE m.id_mesin = ?
    `, [machine_id])

    return NextResponse.json({
      success: true,
      message: 'Machine status updated successfully',
      machine: updatedMachine[0],
      changes: {
        old_status: machine.status_mesin,
        new_status,
        estimated_finish,
        notes
      }
    })

  } catch (error) {
    console.error('Machine status update error:', error)
    return NextResponse.json({
      error: 'Update failed',
      message: error.message
    }, { status: 500 })
  }
}

// GET method to retrieve machine status
export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const cabangId = searchParams.get('cabang_id') || user.cabang_id

    // Kasir can only access their own cabang
    if (user.role === 'kasir' && cabangId != user.cabang_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const machines = await query(`
      SELECT 
        m.*,
        c.nama_cabang,
        k.nama_karyawan as updated_by_name
      FROM mesin_laundry m
      JOIN cabang c ON m.id_cabang = c.id_cabang
      LEFT JOIN karyawan k ON m.updated_by_karyawan = k.id_karyawan
      WHERE m.id_cabang = ?
      ORDER BY m.jenis_mesin, m.nomor_mesin
    `, [cabangId])

    return NextResponse.json({ machines })

  } catch (error) {
    console.error('Get machines error:', error)
    return NextResponse.json({
      error: 'Database error',
      message: error.message
    }, { status: 500 })
  }
}

// POST method to make all machines available (bulk operation)
export async function POST(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user || !['kasir', 'super_admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { action, cabang_id } = await request.json()

    if (action !== 'make_all_available') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const targetCabangId = cabang_id || user.cabang_id

    // Kasir can only update machines in their cabang
    if (user.role === 'kasir' && targetCabangId !== user.cabang_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    console.log(`🔓 Making all machines available for cabang ${targetCabangId} by user ${user.id}`)

    // Get all machines that need to be made available (not already tersedia)
    const machinesBefore = await query(`
      SELECT id_mesin, nomor_mesin, jenis_mesin, status_mesin
      FROM mesin_laundry 
      WHERE id_cabang = ? AND status_mesin != 'tersedia'
    `, [targetCabangId])

    console.log(`📊 Found ${machinesBefore.length} machines to make available:`, 
      machinesBefore.map(m => `${m.nomor_mesin}(${m.status_mesin})`).join(', '))

    if (machinesBefore.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All machines are already available',
        updated_count: 0,
        machines_updated: []
      })
    }

    // Update all machines to 'tersedia' and clear timing
    const updateResult = await query(`
      UPDATE mesin_laundry 
      SET status_mesin = 'tersedia',
          estimasi_selesai = NULL,
          updated_by_karyawan = ?,
          diupdate_pada = NOW()
      WHERE id_cabang = ? AND status_mesin != 'tersedia'
    `, [user.id, targetCabangId])

    console.log(`✅ Updated ${updateResult.affectedRows} machines to available status`)

    // Clear any active service assignments for machines in this cabang
    const assignmentClearResult = await query(`
      UPDATE detail_transaksi_layanan dtl
      JOIN mesin_laundry ml ON dtl.id_mesin = ml.id_mesin
      SET dtl.id_mesin = NULL,
          dtl.estimasi_selesai = NULL,
          dtl.waktu_mulai = NULL,
          dtl.service_status = 'cancelled'
      WHERE ml.id_cabang = ? 
        AND dtl.estimasi_selesai > NOW()
        AND dtl.service_status IN ('active', 'planned')
    `, [targetCabangId])

    console.log(`🧹 Cleared ${assignmentClearResult.affectedRows} active service assignments`)

    // Log the bulk operation in audit log
    try {
      await query(`
        INSERT INTO audit_log (
          id_karyawan, 
          tabel_diubah, 
          aksi, 
          data_baru,
          ip_address
        ) VALUES (?, 'mesin_laundry', 'BULK_UPDATE', ?, ?)
      `, [
        user.id,
        JSON.stringify({
          action: 'make_all_available',
          cabang_id: targetCabangId,
          machines_before: machinesBefore.map(m => ({ id: m.id_mesin, nomor: m.nomor_mesin, old_status: m.status_mesin })),
          updated_count: updateResult.affectedRows,
          assignments_cleared: assignmentClearResult.affectedRows,
          timestamp: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z'
        }),
        request.headers.get('x-forwarded-for') || 'unknown'
      ])
    } catch (auditError) {
      console.warn('Failed to log bulk machine update:', auditError)
    }

    // Get updated machine status
    const machinesAfter = await query(`
      SELECT id_mesin, nomor_mesin, jenis_mesin, status_mesin
      FROM mesin_laundry 
      WHERE id_cabang = ?
      ORDER BY jenis_mesin, nomor_mesin
    `, [targetCabangId])

    return NextResponse.json({
      success: true,
      message: `Successfully made ${updateResult.affectedRows} machines available`,
      updated_count: updateResult.affectedRows,
      assignments_cleared: assignmentClearResult.affectedRows,
      machines_updated: machinesBefore.map(m => m.nomor_mesin),
      machines_after: machinesAfter
    })

  } catch (error) {
    console.error('Bulk machine update error:', error)
    return NextResponse.json({
      error: 'Bulk update failed',
      message: error.message
    }, { status: 500 })
  }
}