import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken } from '@/lib/auth'

export async function DELETE(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user || (user.role !== 'owner' && user.jenis_karyawan !== 'owner')) {
      return NextResponse.json({ 
        error: 'Forbidden - Owner access required' 
      }, { status: 403 })
    }

    const { id } = params

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({
        error: 'Valid audit log ID is required'
      }, { status: 400 })
    }

    // Check if audit log exists and get its details for logging
    const existingLog = await query(
      'SELECT id_audit, tabel_diubah, aksi, waktu_aksi FROM audit_log WHERE id_audit = ?',
      [parseInt(id)]
    )

    if (existingLog.length === 0) {
      return NextResponse.json({
        error: 'Audit log not found'
      }, { status: 404 })
    }

    const logDetails = existingLog[0]

    // Delete the audit log permanently
    const result = await query(
      'DELETE FROM audit_log WHERE id_audit = ?',
      [parseInt(id)]
    )

    if (result.affectedRows === 0) {
      return NextResponse.json({
        error: 'Failed to delete audit log'
      }, { status: 500 })
    }

    // Log the deletion action
    console.log(`🗑️ Owner ${user.username || user.nama_karyawan} permanently deleted audit log:`, {
      id_audit: logDetails.id_audit,
      tabel_diubah: logDetails.tabel_diubah,
      aksi: logDetails.aksi,
      waktu_aksi: logDetails.waktu_aksi,
      deleted_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Audit log berhasil dihapus secara permanen',
      deletedId: parseInt(id),
      deletedLog: {
        id_audit: logDetails.id_audit,
        tabel_diubah: logDetails.tabel_diubah,
        aksi: logDetails.aksi
      }
    })

  } catch (error) {
    console.error('Delete audit log error:', error)
    return NextResponse.json({
      error: 'Gagal menghapus audit log',
      message: error.message
    }, { status: 500 })
  }
}