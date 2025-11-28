import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'
import { validatePhoneNumber } from '@/lib/security'

// Authentication middleware for customer management staff
function authenticateCustomerStaff(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return { error: 'Unauthorized', status: 401 }
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const allowedRoles = ['owner', 'kasir'] // Staff who manage customers
    if (!decoded || !allowedRoles.includes(decoded.jenis_karyawan)) {
      return { error: 'Access denied. Owner/Kasir role required.', status: 403 }
    }

    return { user: decoded }
  } catch (error) {
    console.error('JWT verification error:', error)
    return { error: 'Invalid token', status: 401 }
  }
}

export async function PUT(request, { params }) {
  // Check authentication - customer management staff can update customers
  const auth = authenticateCustomerStaff(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const user = auth.user
  const branchId = user.cabang_id // Kasir has cabang_id, owner might not

  try {
    const { id } = params
    const { nama_pelanggan, nomor_telepon } = await request.json()

    if (!nama_pelanggan || !nama_pelanggan.trim()) {
      return NextResponse.json({ error: 'Nama pelanggan wajib diisi' }, { status: 400 })
    }

    // Check if customer exists AND belongs to user's branch (if kasir)
    let checkQuery = `SELECT id_pelanggan, id_cabang FROM pelanggan WHERE id_pelanggan = ? AND status_aktif = 'aktif'`
    const existingCustomer = await query(checkQuery, [id])

    if (existingCustomer.length === 0) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 })
    }

    // Validate branch access for kasir
    if (branchId && existingCustomer[0].id_cabang !== branchId) {
      return NextResponse.json({
        error: 'Akses ditolak',
        message: 'Anda tidak bisa mengedit customer dari cabang lain'
      }, { status: 403 })
    }

    const customerBranchId = existingCustomer[0].id_cabang

    // Validate and normalize phone number if provided
    let normalizedPhone = nomor_telepon
    if (nomor_telepon && nomor_telepon.trim()) {
      const phoneValidation = validatePhoneNumber(nomor_telepon)
      if (!phoneValidation.isValid) {
        return NextResponse.json({
          error: phoneValidation.error
        }, { status: 400 })
      }
      normalizedPhone = phoneValidation.sanitized

      // Check for duplicate phone number PER CABANG (excluding current customer)
      const duplicateCustomer = await query(`
        SELECT id_pelanggan, nama_pelanggan
        FROM pelanggan
        WHERE nomor_telepon = ?
          AND id_cabang = ?
          AND id_pelanggan != ?
          AND status_aktif = 'aktif'
      `, [normalizedPhone, customerBranchId, id])

      if (duplicateCustomer.length > 0) {
        return NextResponse.json({
          error: 'Nomor telepon sudah digunakan',
          message: `Nomor telepon ${normalizedPhone} sudah terdaftar di cabang ini atas nama "${duplicateCustomer[0].nama_pelanggan}"`
        }, { status: 409 })
      }
    }

    // Update customer with normalized phone and diperbarui_pada timestamp
    await query(`
      UPDATE pelanggan 
      SET nama_pelanggan = ?, nomor_telepon = ?, diperbarui_pada = NOW()
      WHERE id_pelanggan = ?
    `, [nama_pelanggan.trim(), normalizedPhone || null, id])

    // Get updated customer data (without loyalty_points column for now)
    const updatedCustomer = await query(`
      SELECT 
        id_pelanggan,
        nama_pelanggan,
        nomor_telepon,
        dibuat_pada,
        status_aktif,
        loyalty_points
      FROM pelanggan 
      WHERE id_pelanggan = ?
    `, [id])

    return NextResponse.json(updatedCustomer[0])
  } catch (error) {
    console.error('Update customer error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  // Check authentication - customer management staff can delete customers
  const auth = authenticateCustomerStaff(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const user = auth.user
  const branchId = user.cabang_id // Kasir has cabang_id, owner might not

  try {
    const { id } = params

    // Check if customer exists AND belongs to user's branch (if kasir)
    const existingCustomer = await query(`
      SELECT id_pelanggan, id_cabang FROM pelanggan WHERE id_pelanggan = ? AND status_aktif = 'aktif'
    `, [id])

    if (existingCustomer.length === 0) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 })
    }

    // Validate branch access for kasir
    if (branchId && existingCustomer[0].id_cabang !== branchId) {
      return NextResponse.json({
        error: 'Akses ditolak',
        message: 'Anda tidak bisa menghapus customer dari cabang lain'
      }, { status: 403 })
    }

    // Check if customer has transactions
    const hasTransactions = await query(`
      SELECT COUNT(*) as count FROM transaksi WHERE id_pelanggan = ?
    `, [id])

    if (hasTransactions[0].count > 0) {
      // Soft delete - don't actually delete, just mark as inactive
      await query(`
        UPDATE pelanggan 
        SET status_aktif = 'nonaktif', diperbarui_pada = NOW()
        WHERE id_pelanggan = ?
      `, [id])
      
      return NextResponse.json({ 
        message: 'Pelanggan berhasil dinonaktifkan (memiliki riwayat transaksi)',
        soft_delete: true 
      })
    } else {
      // Hard delete if no transactions
      await query(`
        DELETE FROM pelanggan WHERE id_pelanggan = ?
      `, [id])
      
      return NextResponse.json({ 
        message: 'Pelanggan berhasil dihapus',
        hard_delete: true 
      })
    }
  } catch (error) {
    console.error('Delete customer error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function GET(request, { params }) {
  // Check authentication - customer management staff can view customer details
  const auth = authenticateCustomerStaff(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  
  try {
    const { id } = params

    const customer = await query(`
      SELECT 
        p.id_pelanggan,
        p.nama_pelanggan,
        p.nomor_telepon,
        p.dibuat_pada,
        p.status_aktif,
        loyalty_points,
        COUNT(t.id_transaksi) as total_transaksi,
        COALESCE(SUM(t.total_keseluruhan), 0) as total_belanja
      FROM pelanggan p
      LEFT JOIN transaksi t ON p.id_pelanggan = t.id_pelanggan
      WHERE p.id_pelanggan = ? AND p.status_aktif = 'aktif'
      GROUP BY p.id_pelanggan
    `, [id])

    if (customer.length === 0) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(customer[0])
  } catch (error) {
    console.error('Get customer error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}