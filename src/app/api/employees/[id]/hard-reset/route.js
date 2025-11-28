import { NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function DELETE(request, { params }) {
  try {
    const { id } = await params

    // Start transaction to ensure atomicity
    await query('START TRANSACTION')

    try {
      // First, verify the employee exists and is non-active
      const employeeCheck = await query(`
        SELECT id_karyawan, nama_karyawan, status_aktif
        FROM karyawan
        WHERE id_karyawan = ?
      `, [id])

      if (employeeCheck.length === 0) {
        await query('ROLLBACK')
        return NextResponse.json({
          success: false,
          error: 'Karyawan tidak ditemukan'
        }, { status: 404 })
      }

      if (employeeCheck[0].status_aktif === 'aktif') {
        await query('ROLLBACK')
        return NextResponse.json({
          success: false,
          error: 'Tidak dapat menghapus karyawan yang masih aktif. Nonaktifkan terlebih dahulu.'
        }, { status: 400 })
      }

      // Delete in proper order to handle FK constraints
      // 1. Delete push_subscriptions (CASCADE DELETE will handle this automatically)

      // 2. Update detail_transaksi_layanan.cancelled_by to NULL (SET NULL constraint)
      await query(`
        UPDATE detail_transaksi_layanan
        SET cancelled_by = NULL
        WHERE cancelled_by = ?
      `, [id])

      // 3. Delete from dependent tables that reference karyawan
      await query('DELETE FROM attendance_harian WHERE id_karyawan_akun = ?', [id])
      await query('DELETE FROM audit_log WHERE id_karyawan = ?', [id])
      await query('DELETE FROM user_sessions WHERE id_karyawan = ?', [id])

      // 4. Update mesin_laundry to remove operator references
      await query(`
        UPDATE mesin_laundry
        SET updated_by_karyawan = NULL
        WHERE updated_by_karyawan = ?
      `, [id])

      // 5. Update stok_cabang to remove references (set to system admin ID 1)
      await query(`
        UPDATE stok_cabang
        SET updated_by_karyawan = 1
        WHERE updated_by_karyawan = ?
      `, [id])

      // 6. Handle transaksi table - check if any active transactions exist
      const activeTransactions = await query(`
        SELECT COUNT(*) as count
        FROM transaksi
        WHERE id_karyawan = ? AND status_transaksi NOT IN ('selesai', 'dibatalkan')
      `, [id])

      if (activeTransactions[0].count > 0) {
        await query('ROLLBACK')
        return NextResponse.json({
          success: false,
          error: 'Tidak dapat menghapus karyawan yang memiliki transaksi aktif. Selesaikan atau batalkan transaksi terlebih dahulu.'
        }, { status: 400 })
      }

      // Update completed transactions to remove karyawan reference (set to system admin ID 1)
      await query(`
        UPDATE transaksi
        SET id_karyawan = 1
        WHERE id_karyawan = ? AND status_transaksi IN ('selesai', 'dibatalkan')
      `, [id])

      // 7. Finally, delete the employee record
      const deleteResult = await query(`
        DELETE FROM karyawan
        WHERE id_karyawan = ?
      `, [id])

      if (deleteResult.affectedRows === 0) {
        await query('ROLLBACK')
        return NextResponse.json({
          success: false,
          error: 'Gagal menghapus data karyawan'
        }, { status: 500 })
      }

      // Commit transaction
      await query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Karyawan ${employeeCheck[0].nama_karyawan} dan semua data terkait berhasil dihapus permanen`,
        deletedEmployee: {
          id: employeeCheck[0].id_karyawan,
          nama: employeeCheck[0].nama_karyawan
        }
      })

    } catch (error) {
      // Rollback on any error
      await query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Hard reset employee error:', error)

    // Handle specific database errors
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return NextResponse.json({
        success: false,
        error: 'Tidak dapat menghapus karyawan karena masih terdapat data terkait yang tidak dapat dihapus. Hubungi administrator.'
      }, { status: 409 })
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return NextResponse.json({
        success: false,
        error: 'Terjadi kesalahan referensi data. Periksa integritas data.'
      }, { status: 409 })
    }

    return NextResponse.json({
      success: false,
      error: 'Terjadi kesalahan sistem saat menghapus data'
    }, { status: 500 })
  }
}