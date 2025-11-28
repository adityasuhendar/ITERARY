import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken } from '@/lib/auth'

export async function PUT(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user || (user.role !== 'kasir' && user.jenis_karyawan !== 'owner' && user.role !== 'owner')) {
      return NextResponse.json({ error: 'Forbidden - Kasir or Owner access required' }, { status: 403 })
    }

    const isOwner = user.jenis_karyawan === 'owner' || user.role === 'owner'

    const { id } = await params
    const { new_total_cuci, old_total_cuci, foto_bukti, alasan } = await request.json()

    // Validate input
    if (typeof new_total_cuci !== 'number' || new_total_cuci < 0) {
      return NextResponse.json({ error: 'Invalid total cuci value' }, { status: 400 })
    }

    // Validate alasan wajib diisi HANYA untuk kasir
    if (!isOwner && (!alasan || alasan.trim() === '')) {
      return NextResponse.json({ error: 'Alasan penyesuaian wajib diisi untuk audit trail' }, { status: 400 })
    }

    // Check if customer exists
    const customerCheck = await query(`
      SELECT id_pelanggan, nama_pelanggan, nomor_telepon FROM pelanggan WHERE id_pelanggan = ?
    `, [id])

    if (customerCheck.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const customer = customerCheck[0]

    // Get client IP address
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(/, /)[0] : request.headers.get('x-real-ip') || 'unknown'

    // Start transaction for atomic operation
    await query('START TRANSACTION')

    try {
      // Log the manual adjustment to audit_log
      await query(`
        INSERT INTO audit_log (
          id_karyawan,
          tabel_diubah,
          aksi,
          data_lama,
          data_baru,
          ip_address,
          approval_status,
          foto_bukti
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        user.id,
        'customer_total_cuci_manual',
        'UPDATE',
        JSON.stringify({
          customer_id: parseInt(id),
          customer_name: customer.nama_pelanggan,
          customer_phone: customer.nomor_telepon || null,
          old_total_cuci: old_total_cuci || 0,
          timestamp: new Date().toISOString()
        }),
        JSON.stringify({
          customer_id: parseInt(id),
          customer_name: customer.nama_pelanggan,
          customer_phone: customer.nomor_telepon || null,
          new_total_cuci: new_total_cuci,
          old_total_cuci: old_total_cuci || 0,
          difference: new_total_cuci - (old_total_cuci || 0),
          manual_adjustment: true,
          adjusted_by: user.nama_karyawan || `User ${user.id}`,
          adjusted_by_role: isOwner ? 'owner' : 'kasir',
          reason: alasan ? alasan.trim() : (isOwner ? 'Manual edit by owner' : null),
          timestamp: new Date().toISOString()
        }),
        ip,
        'auto_approved',
        foto_bukti || null
      ])

      // Update the total_cuci column in pelanggan table
      await query(`
        UPDATE pelanggan 
        SET total_cuci = ?, diperbarui_pada = NOW()
        WHERE id_pelanggan = ?
      `, [new_total_cuci, id])

      // Recalculate loyalty points based on new total_cuci
      const customerData = await query(`
        SELECT total_redeem FROM pelanggan WHERE id_pelanggan = ?
      `, [id])
      
      const total_redeem = customerData[0].total_redeem || 0
      const earnedPoints = Math.floor(new_total_cuci / 10)
      const availablePoints = earnedPoints - total_redeem

      await query(`
        UPDATE pelanggan 
        SET loyalty_points = ?
        WHERE id_pelanggan = ?
      `, [Math.max(0, availablePoints), id])

      // Commit the transaction
      await query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Total cuci adjustment logged successfully',
        customer_id: id,
        old_value: old_total_cuci || 0,
        new_value: new_total_cuci,
        logged_by: user.nama_karyawan || `User ${user.id}`
      })

    } catch (error) {
      await query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Total cuci update error:', error)
    return NextResponse.json({
      error: 'Failed to update total cuci',
      message: error.message || error.toString() || 'Unknown error occurred'
    }, { status: 500 })
  }
}