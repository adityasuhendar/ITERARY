import { NextResponse } from 'next/server'
import db from '@/lib/database'
import jwt from 'jsonwebtoken'
import { sendPushNotificationDirect } from '@/lib/pushNotificationHelper'

// Authentication middleware for inventory staff
function authenticateInventoryStaff(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return { error: 'Unauthorized', status: 401 }
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const allowedRoles = ['owner', 'kasir', 'collector'] // Staff who manage inventory
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
  // Check authentication - inventory staff can update products
  const auth = authenticateInventoryStaff(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const { id } = await params
    const { 
      nama_produk,
      harga,
      satuan,
      kategori_produk,
      stok_tersedia,
      stok_minimum,
      cabang_id
    } = await request.json()

    // Get user ID from authenticated session
    const updated_by_karyawan = auth.user.id

    // Validasi input
    if (!nama_produk || !harga || !satuan || !kategori_produk || stok_tersedia === undefined || !stok_minimum || !cabang_id) {
      return NextResponse.json({ 
        error: 'Semua field wajib diisi' 
      }, { status: 400 })
    }

    // Validasi kategori produk
    const validCategories = ['sabun_softener', 'tas_plastik', 'minuman', 'lainnya']
    if (!validCategories.includes(kategori_produk)) {
      return NextResponse.json({ 
        error: 'Kategori produk tidak valid' 
      }, { status: 400 })
    }

    // Validasi nilai numerik
    if (isNaN(harga) || harga <= 0) {
      return NextResponse.json({ 
        error: 'Harga harus berupa angka positif' 
      }, { status: 400 })
    }

    if (isNaN(stok_tersedia) || stok_tersedia < 0) {
      return NextResponse.json({ 
        error: 'Stok tersedia harus berupa angka non-negatif' 
      }, { status: 400 })
    }

    if (isNaN(stok_minimum) || stok_minimum <= 0) {
      return NextResponse.json({ 
        error: 'Stok minimum harus berupa angka positif' 
      }, { status: 400 })
    }

    // Cek apakah produk ada
    const [existingProduct] = await db.query(
      'SELECT id_produk FROM produk_tambahan WHERE id_produk = ?',
      [id]
    )

    if (existingProduct.length === 0) {
      return NextResponse.json({ 
        error: 'Produk tidak ditemukan' 
      }, { status: 404 })
    }

    // Cek apakah nama produk sudah digunakan oleh produk lain
    const [duplicateName] = await db.query(
      'SELECT id_produk FROM produk_tambahan WHERE nama_produk = ? AND id_produk != ?',
      [nama_produk, id]
    )

    if (duplicateName.length > 0) {
      return NextResponse.json({ 
        error: 'Nama produk sudah digunakan oleh produk lain' 
      }, { status: 400 })
    }

    // Start transaction
    await db.query('START TRANSACTION')

    try {
      // Get old data before update for audit log
      const [oldProductData] = await db.query(
        'SELECT nama_produk, harga, satuan, kategori_produk FROM produk_tambahan WHERE id_produk = ?',
        [id]
      )

      const [oldStockData] = await db.query(
        'SELECT stok_tersedia, stok_minimum FROM stok_cabang WHERE id_cabang = ? AND id_produk = ?',
        [cabang_id, id]
      )

      const [branchInfo] = await db.query(
        'SELECT nama_cabang FROM cabang WHERE id_cabang = ?',
        [cabang_id]
      )

      // 1. Update tabel produk_tambahan
      await db.query(
        `UPDATE produk_tambahan
         SET nama_produk = ?, harga = ?, satuan = ?, kategori_produk = ?
         WHERE id_produk = ?`,
        [nama_produk, harga, satuan, kategori_produk, id]
      )

      // Check if product data actually changed before logging
      const productChanged = oldProductData[0] && (
        oldProductData[0].nama_produk !== nama_produk ||
        parseFloat(oldProductData[0].harga) !== parseFloat(harga) ||
        oldProductData[0].satuan !== satuan ||
        oldProductData[0].kategori_produk !== kategori_produk
      )

      console.log('🔍 Product change detection:', {
        productChanged,
        oldData: oldProductData[0],
        newData: { nama_produk, harga, satuan, kategori_produk }
      })

      // Log product update to audit_log only if changed
      if (productChanged) {
        await db.query(
          `INSERT INTO audit_log (
            tabel_diubah,
            aksi,
            id_karyawan,
            data_lama,
            data_baru,
            approval_status,
            approved_by,
            approved_at,
            approval_notes,
            waktu_aksi,
            ip_address
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), ?)`,
          [
            'produk_tambahan',
            'UPDATE',
            updated_by_karyawan,
            JSON.stringify({
              id_produk: parseInt(id),
              nama_produk: oldProductData[0]?.nama_produk,
              harga: parseFloat(oldProductData[0]?.harga),
              satuan: oldProductData[0]?.satuan,
              kategori_produk: oldProductData[0]?.kategori_produk
            }),
            JSON.stringify({
              id_produk: parseInt(id),
              nama_produk: nama_produk,
              harga: parseFloat(harga),
              satuan: satuan,
              kategori_produk: kategori_produk
            }),
            'auto_approved',
            updated_by_karyawan,
            `Direct product update from Stock Monitoring by Owner/Collector`,
            request.headers.get('x-forwarded-for') || 'unknown'
          ]
        )
      }

      // 2. Update atau insert ke tabel stok_cabang
      const [existingStock] = await db.query(
        'SELECT id_stok FROM stok_cabang WHERE id_cabang = ? AND id_produk = ?',
        [cabang_id, id]
      )

      // Declare stockChanged outside the block so it's accessible later
      let stockChanged = false

      if (existingStock.length > 0) {
        // Check if stock data actually changed before updating and logging
        stockChanged = oldStockData[0] && (
          parseInt(oldStockData[0].stok_tersedia) !== parseInt(stok_tersedia) ||
          parseInt(oldStockData[0].stok_minimum) !== parseInt(stok_minimum)
        )

        console.log('🔍 Stock change detection:', {
          stockChanged,
          oldData: oldStockData[0],
          newData: { stok_tersedia, stok_minimum }
        })

        // Update existing stock
        await db.query(
          `UPDATE stok_cabang
           SET stok_tersedia = ?, stok_minimum = ?, terakhir_update = NOW(), updated_by_karyawan = ?
           WHERE id_cabang = ? AND id_produk = ?`,
          [stok_tersedia, stok_minimum, updated_by_karyawan, cabang_id, id]
        )

        // Log stock update to audit_log only if changed
        if (stockChanged) {
          await db.query(
            `INSERT INTO audit_log (
              tabel_diubah,
              aksi,
              id_karyawan,
              data_lama,
              data_baru,
              approval_status,
              approved_by,
              approved_at,
              approval_notes,
              waktu_aksi,
              ip_address
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), ?)`,
            [
              'stok_cabang',
              'UPDATE',
              updated_by_karyawan,
              JSON.stringify({
                id_produk: parseInt(id),
                id_cabang: parseInt(cabang_id),
                stok_tersedia: parseInt(oldStockData[0]?.stok_tersedia || 0),
                stok_minimum: parseInt(oldStockData[0]?.stok_minimum || 10),
                nama_produk: nama_produk,
                nama_cabang: branchInfo[0]?.nama_cabang
              }),
              JSON.stringify({
                id_produk: parseInt(id),
                id_cabang: parseInt(cabang_id),
                stok_tersedia: parseInt(stok_tersedia),
                stok_minimum: parseInt(stok_minimum),
                nama_produk: nama_produk,
                nama_cabang: branchInfo[0]?.nama_cabang
              }),
              'auto_approved',
              updated_by_karyawan,
              `Direct stock update from Stock Monitoring by Owner/Collector`,
              request.headers.get('x-forwarded-for') || 'unknown'
            ]
          )
        }
      } else {
        // Insert new stock record for this branch
        await db.query(
          `INSERT INTO stok_cabang
           (id_cabang, id_produk, stok_tersedia, stok_minimum, terakhir_update, updated_by_karyawan)
           VALUES (?, ?, ?, ?, NOW(), ?)`,
          [cabang_id, id, stok_tersedia, stok_minimum, updated_by_karyawan]
        )

        // Log stock creation to audit_log
        await db.query(
          `INSERT INTO audit_log (
            tabel_diubah,
            aksi,
            id_karyawan,
            data_lama,
            data_baru,
            approval_status,
            approved_by,
            approved_at,
            approval_notes,
            waktu_aksi,
            ip_address
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), ?)`,
          [
            'stok_cabang',
            'INSERT',
            updated_by_karyawan,
            null,
            JSON.stringify({
              id_produk: parseInt(id),
              id_cabang: parseInt(cabang_id),
              stok_tersedia: parseInt(stok_tersedia),
              stok_minimum: parseInt(stok_minimum),
              nama_produk: nama_produk,
              nama_cabang: branchInfo[0]?.nama_cabang
            }),
            'auto_approved',
            updated_by_karyawan,
            `Direct stock creation from Stock Monitoring by Owner/Collector`,
            request.headers.get('x-forwarded-for') || 'unknown'
          ]
        )
      }

      // Commit transaction
      await db.query('COMMIT')

      // Send push notification to owner about product/stock changes
      try {
        // Get user info who made the change
        const [userInfo] = await db.query(
          'SELECT nama_karyawan, jenis_karyawan FROM karyawan WHERE id_karyawan = ?',
          [updated_by_karyawan]
        )

        let notificationBody = ''
        const namaCabang = branchInfo[0]?.nama_cabang || 'Unknown Branch'
        const namaUser = userInfo[0]?.nama_karyawan || 'Unknown User'

        if (productChanged && stockChanged) {
          notificationBody = `${nama_produk} (${namaCabang}) - Informasi produk dan stok telah diubah oleh ${namaUser}`
        } else if (productChanged) {
          notificationBody = `${nama_produk} (${namaCabang}) - Informasi produk telah diubah oleh ${namaUser}`
        } else if (stockChanged) {
          notificationBody = `${nama_produk} (${namaCabang}) - Stok telah diubah menjadi ${stok_tersedia} oleh ${namaUser}`
        }

        if (notificationBody) {
          // Use direct function call instead of self-fetch to avoid ECONNREFUSED in shared hosting
          const pushResult = await sendPushNotificationDirect({
            targetUserType: 'owner',
            notification: {
              title: '📝 Perubahan Produk/Stok',
              body: notificationBody,
              icon: '📦',
              tag: `product-update-${id}`,
              url: '/audit-log',
              data: {
                productId: id,
                productName: nama_produk,
                action: 'direct_update'
              }
            }
          })

          if (pushResult.success) {
            console.log(`✅ Push notification sent to owner: ${pushResult.sent} sent, ${pushResult.failed} failed`)
          } else {
            console.error('❌ Push notification failed:', pushResult.error)
          }
        } else {
          console.log('⚠️ No changes detected, notification not sent')
        }
      } catch (pushError) {
        console.error('❌ Push notification error:', pushError)
        console.error('❌ Error details:', {
          message: pushError.message,
          code: pushError.code,
          cause: pushError.cause,
          stack: pushError.stack
        })
        // Don't fail the main request if push fails
      }

      return NextResponse.json({
        message: 'Produk berhasil diupdate',
        product: {
          id_produk: id,
          nama_produk,
          harga,
          satuan,
          kategori_produk,
          stok_tersedia,
          stok_minimum
        }
      })

    } catch (error) {
      // Rollback on error
      await db.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Update product error:', error)
    return NextResponse.json({ 
      error: 'Gagal mengupdate produk',
      details: error.message 
    }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  // Check authentication - inventory staff can delete products
  const auth = authenticateInventoryStaff(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const cabang_id = searchParams.get('cabang_id')

    if (!cabang_id) {
      return NextResponse.json({ 
        error: 'cabang_id diperlukan untuk menghapus produk' 
      }, { status: 400 })
    }

    // Cek apakah produk ada
    const [existingProduct] = await db.query(
      'SELECT id_produk, nama_produk FROM produk_tambahan WHERE id_produk = ?',
      [id]
    )

    if (existingProduct.length === 0) {
      return NextResponse.json({ 
        error: 'Produk tidak ditemukan' 
      }, { status: 404 })
    }

    // Cek apakah produk ada di cabang ini
    const [stockInBranch] = await db.query(
      'SELECT id_stok FROM stok_cabang WHERE id_produk = ? AND id_cabang = ?',
      [id, cabang_id]
    )

    if (stockInBranch.length === 0) {
      return NextResponse.json({ 
        error: 'Produk tidak ditemukan di cabang ini' 
      }, { status: 404 })
    }

    // Cek apakah produk sedang digunakan dalam transaksi (di cabang ini atau global)
    const [usedInTransactions] = await db.query(
      'SELECT COUNT(*) as count FROM detail_transaksi_produk WHERE id_produk = ?',
      [id]
    )

    if (usedInTransactions[0].count > 0) {
      // Jika pernah digunakan dalam transaksi, tidak bisa dihapus permanen
      // Hanya hapus dari cabang ini saja
      await db.query(
        'DELETE FROM stok_cabang WHERE id_produk = ? AND id_cabang = ?', 
        [id, cabang_id]
      )

      // Update cabang_tersedia - hilangkan cabang ini dari list
      const [currentProduct] = await db.query(
        'SELECT cabang_tersedia FROM produk_tambahan WHERE id_produk = ?',
        [id]
      )
      
      if (currentProduct.length > 0 && currentProduct[0].cabang_tersedia) {
        try {
          let currentCabangTersedia
          const rawData = currentProduct[0].cabang_tersedia
          
          // Handle corrupt JSON - reset to default if parsing fails
          if (typeof rawData === 'string') {
            currentCabangTersedia = JSON.parse(rawData)
          } else if (Array.isArray(rawData)) {
            currentCabangTersedia = rawData
          } else {
            // Data corrupt, reset to all branches
            currentCabangTersedia = ["1", "2", "3", "4", "5", "6"]
          }
          console.log('Debug - cabang_id:', cabang_id, 'type:', typeof cabang_id)
          console.log('Debug - currentCabangTersedia:', currentCabangTersedia)
          const updatedCabangTersedia = currentCabangTersedia.filter(cab => cab !== String(cabang_id))
          console.log('Debug - updatedCabangTersedia:', updatedCabangTersedia)
          
          if (updatedCabangTersedia.length > 0) {
            // Masih ada cabang lain, update cabang_tersedia
            await db.query(
              'UPDATE produk_tambahan SET cabang_tersedia = ? WHERE id_produk = ?',
              [JSON.stringify(updatedCabangTersedia), id]
            )
          } else {
            // Tidak ada cabang lagi, nonaktifkan produk
            await db.query(
              'UPDATE produk_tambahan SET status_aktif = "nonaktif", cabang_tersedia = NULL WHERE id_produk = ?',
              [id]
            )
          }
        } catch (parseError) {
          console.warn('Error parsing cabang_tersedia JSON:', parseError)
          // Fallback: reset corrupt data to all branches minus current
          const allBranches = ["1", "2", "3", "4", "5", "6"]
          const updatedCabangTersedia = allBranches.filter(cab => cab !== String(cabang_id))
          
          if (updatedCabangTersedia.length > 0) {
            await db.query(
              'UPDATE produk_tambahan SET cabang_tersedia = ? WHERE id_produk = ?',
              [JSON.stringify(updatedCabangTersedia), id]
            )
          } else {
            await db.query(
              'UPDATE produk_tambahan SET status_aktif = "nonaktif", cabang_tersedia = NULL WHERE id_produk = ?',
              [id]
            )
          }
        }
      }

      // Cek apakah masih ada produk ini di cabang lain
      const [remainingStock] = await db.query(
        'SELECT COUNT(*) as count FROM stok_cabang WHERE id_produk = ?',
        [id]
      )

      if (remainingStock[0].count === 0) {
        // Tidak ada lagi di cabang manapun, nonaktifkan produk
        await db.query(
          'UPDATE produk_tambahan SET status_aktif = "nonaktif" WHERE id_produk = ?',
          [id]
        )
        
        return NextResponse.json({
          message: `Produk "${existingProduct[0].nama_produk}" dihapus dari cabang ini dan dinonaktifkan karena pernah digunakan dalam transaksi`,
          action: 'removed_and_deactivated'
        })
      }

      return NextResponse.json({
        message: `Produk "${existingProduct[0].nama_produk}" berhasil dihapus dari cabang ini (masih tersedia di cabang lain)`,
        action: 'removed_from_branch'
      })
    }

    // Start transaction
    await db.query('START TRANSACTION')

    try {
      // 1. Hapus dari stok_cabang untuk cabang ini saja
      await db.query(
        'DELETE FROM stok_cabang WHERE id_produk = ? AND id_cabang = ?', 
        [id, cabang_id]
      )

      // 2. Update cabang_tersedia - hilangkan cabang ini dari list
      const [currentProduct] = await db.query(
        'SELECT cabang_tersedia FROM produk_tambahan WHERE id_produk = ?',
        [id]
      )
      
      if (currentProduct.length > 0 && currentProduct[0].cabang_tersedia) {
        try {
          const currentCabangTersedia = JSON.parse(currentProduct[0].cabang_tersedia)
          const updatedCabangTersedia = currentCabangTersedia.filter(cab => cab !== String(cabang_id))
          
          if (updatedCabangTersedia.length > 0) {
            // Masih ada cabang lain, update cabang_tersedia
            await db.query(
              'UPDATE produk_tambahan SET cabang_tersedia = ? WHERE id_produk = ?',
              [JSON.stringify(updatedCabangTersedia), id]
            )
          } else {
            // Tidak ada cabang lagi, set cabang_tersedia ke null
            await db.query(
              'UPDATE produk_tambahan SET cabang_tersedia = NULL WHERE id_produk = ?',
              [id]
            )
          }
        } catch (parseError) {
          console.warn('Error parsing cabang_tersedia JSON:', parseError)
          // Fallback: reset corrupt data to all branches minus current
          const allBranches = ["1", "2", "3", "4", "5", "6"]
          const updatedCabangTersedia = allBranches.filter(cab => cab !== String(cabang_id))
          
          if (updatedCabangTersedia.length > 0) {
            await db.query(
              'UPDATE produk_tambahan SET cabang_tersedia = ? WHERE id_produk = ?',
              [JSON.stringify(updatedCabangTersedia), id]
            )
          } else {
            await db.query(
              'UPDATE produk_tambahan SET status_aktif = "nonaktif", cabang_tersedia = NULL WHERE id_produk = ?',
              [id]
            )
          }
        }
      }

      // 3. Cek apakah masih ada produk ini di cabang lain
      const [remainingStock] = await db.query(
        'SELECT COUNT(*) as count FROM stok_cabang WHERE id_produk = ?',
        [id]
      )

      let action = 'removed_from_branch'
      let message = `Produk "${existingProduct[0].nama_produk}" berhasil dihapus dari cabang ini`

      // 4. Jika tidak ada lagi di cabang manapun, hapus master produk juga
      if (remainingStock[0].count === 0) {
        await db.query('DELETE FROM produk_tambahan WHERE id_produk = ?', [id])
        action = 'deleted_completely'
        message = `Produk "${existingProduct[0].nama_produk}" berhasil dihapus permanen (tidak ada lagi di cabang manapun)`
      }

      // Commit transaction
      await db.query('COMMIT')

      return NextResponse.json({
        message,
        action
      })

    } catch (error) {
      // Rollback on error
      await db.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Delete product error:', error)
    return NextResponse.json({ 
      error: 'Gagal menghapus produk',
      details: error.message 
    }, { status: 500 })
  }
}

export async function GET(request, { params }) {
  // Check authentication - inventory staff can view product details
  const auth = authenticateInventoryStaff(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const cabang_id = searchParams.get('cabang_id')

    let query = `
      SELECT 
        p.id_produk,
        p.nama_produk,
        p.harga,
        p.satuan,
        p.kategori_produk,
        p.status_aktif,
        p.dibuat_pada,
        COALESCE(s.stok_tersedia, 0) as stok_tersedia,
        COALESCE(s.stok_minimum, 10) as stok_minimum,
        s.terakhir_update
      FROM produk_tambahan p
      LEFT JOIN stok_cabang s ON p.id_produk = s.id_produk
      WHERE p.id_produk = ?
    `
    
    const params_query = [id]
    
    if (cabang_id) {
      query += ' AND (s.id_cabang = ? OR s.id_cabang IS NULL)'
      params_query.push(cabang_id)
    }

    const [products] = await db.query(query, params_query)

    if (products.length === 0) {
      return NextResponse.json({ 
        error: 'Produk tidak ditemukan' 
      }, { status: 404 })
    }

    return NextResponse.json({
      product: products[0]
    })

  } catch (error) {
    console.error('Get product error:', error)
    return NextResponse.json({ 
      error: 'Gagal mengambil data produk',
      details: error.message 
    }, { status: 500 })
  }
}