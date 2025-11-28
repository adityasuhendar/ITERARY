import { NextResponse } from 'next/server'
import db from '@/lib/database'
import jwt from 'jsonwebtoken'
import { sendPushNotificationDirect } from '@/lib/pushNotificationHelper'

// Authentication middleware for staff who manage inventory
function authenticateInventoryStaff(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return { error: 'Unauthorized', status: 401 }
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const allowedRoles = ['owner', 'kasir', 'collector'] // Kasir needs access for stock management
    if (!decoded || !allowedRoles.includes(decoded.jenis_karyawan)) {
      return { error: 'Access denied. Owner/Kasir role required.', status: 403 }
    }

    return { user: decoded }
  } catch (error) {
    console.error('JWT verification error:', error)
    return { error: 'Invalid token', status: 401 }
  }
}

export async function POST(request) {
  // Check authentication - inventory staff can manage products
  const auth = authenticateInventoryStaff(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { 
      nama_produk, 
      harga, 
      satuan, 
      kategori_produk, 
      stok_tersedia, 
      stok_minimum, 
      cabang_id,
      cabang_tersedia, // Array of cabang IDs where this product will be available
      updated_by_karyawan = 1 // Should be from authenticated user session
    } = await request.json()

    // Validasi input - cabang_id tidak required lagi, diganti dengan cabang_tersedia
    if (!nama_produk || !harga || !satuan || !kategori_produk || stok_tersedia === undefined || !stok_minimum) {
      return NextResponse.json({ 
        error: 'Semua field wajib diisi' 
      }, { status: 400 })
    }

    // Validasi minimal pilih satu cabang
    if (!cabang_tersedia || !Array.isArray(cabang_tersedia) || cabang_tersedia.length === 0) {
      return NextResponse.json({ 
        error: 'Pilih minimal satu cabang untuk produk ini' 
      }, { status: 400 })
    }

    // cabang_id masih diperlukan untuk menentukan cabang yang mendapat stok awal
    if (!cabang_id || !cabang_tersedia.includes(cabang_id.toString())) {
      return NextResponse.json({ 
        error: 'Cabang untuk stok awal harus dipilih dari cabang yang tersedia' 
      }, { status: 400 })
    }

    // Validasi kategori produk - sesuai database ENUM
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

    // Cek apakah produk dengan nama yang sama sudah ada (aktif atau nonaktif)
    const [existingProduct] = await db.query(
      'SELECT id_produk, status_aktif FROM produk_tambahan WHERE nama_produk = ?',
      [nama_produk]
    )

    if (existingProduct.length > 0) {
      const existing = existingProduct[0]
      
      if (existing.status_aktif === 'aktif') {
        return NextResponse.json({ 
          error: 'Produk dengan nama yang sama sudah ada dan masih aktif' 
        }, { status: 400 })
      }
      
      // Jika ada produk nonaktif dengan nama sama, tawarkan reaktivasi
      if (existing.status_aktif === 'nonaktif') {
        return NextResponse.json({ 
          error: 'INACTIVE_PRODUCT_EXISTS',
          message: 'Produk dengan nama yang sama sudah ada tapi nonaktif',
          inactive_product: {
            id_produk: existing.id_produk,
            nama_produk: nama_produk
          },
          suggestion: 'Apakah Anda ingin mengaktifkan kembali produk yang sudah ada?'
        }, { status: 409 }) // 409 Conflict
      }
    }

    // Start transaction
    await db.query('START TRANSACTION')

    try {
      // 1. Insert ke tabel produk_tambahan dengan cabang_tersedia
      const cabangTersediaJson = cabang_tersedia ? JSON.stringify(cabang_tersedia) : null
      const [productResult] = await db.query(
        `INSERT INTO produk_tambahan 
         (nama_produk, harga, satuan, kategori_produk, cabang_tersedia, status_aktif, dibuat_pada) 
         VALUES (?, ?, ?, ?, ?, 'aktif', NOW())`,
        [nama_produk, harga, satuan, kategori_produk, cabangTersediaJson]
      )

      const productId = productResult.insertId

      // 2. Insert ke tabel stok_cabang untuk cabang yang bersangkutan
      // Sequential insert untuk avoid race conditions dalam transaction
      if (cabang_tersedia && Array.isArray(cabang_tersedia) && cabang_tersedia.length > 0) {
        // Insert stok untuk semua cabang yang ditentukan secara sequential
        for (const cabang of cabang_tersedia) {
          const isMainBranch = String(cabang) === String(cabang_id)
          await db.query(
            `INSERT INTO stok_cabang 
             (id_cabang, id_produk, stok_tersedia, stok_minimum, terakhir_update, updated_by_karyawan) 
             VALUES (?, ?, ?, ?, NOW(), ?)`,
            [cabang, productId, isMainBranch ? stok_tersedia : 0, stok_minimum, updated_by_karyawan]
          )
        }
      } else {
        // Fallback: hanya insert untuk cabang yang menambahkan
        await db.query(
          `INSERT INTO stok_cabang 
           (id_cabang, id_produk, stok_tersedia, stok_minimum, terakhir_update, updated_by_karyawan) 
           VALUES (?, ?, ?, ?, NOW(), ?)`,
          [cabang_id, productId, stok_tersedia, stok_minimum, updated_by_karyawan]
        )
      }

      // Commit transaction
      await db.query('COMMIT')

      return NextResponse.json({
        message: 'Produk berhasil ditambahkan',
        product: {
          id_produk: productId,
          nama_produk,
          harga,
          satuan,
          kategori_produk,
          stok_tersedia,
          stok_minimum
        }
      }, { status: 201 })

    } catch (error) {
      // Rollback on error
      await db.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Create product error:', error)
    return NextResponse.json({ 
      error: 'Gagal menambahkan produk',
      details: error.message 
    }, { status: 500 })
  }
}

export async function PATCH(request) {
  // Check authentication - inventory staff can manage products
  const auth = authenticateInventoryStaff(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { 
      action,
      product_id, 
      harga, 
      satuan, 
      kategori_produk, 
      stok_tersedia, 
      stok_minimum, 
      cabang_id,
      cabang_ids = [], // Add cabang_ids untuk multiple reactivation
      updated_by_karyawan = 1
    } = await request.json()

    if (action === 'reactivate_multiple') {
      // Reaktivasi produk nonaktif untuk multiple cabang
      // Data sudah di-extract dari request.json() di atas
      
      if (!product_id || !Array.isArray(cabang_ids) || cabang_ids.length === 0) {
        return NextResponse.json({ 
          error: 'Product ID dan Cabang IDs diperlukan untuk reaktivasi multiple' 
        }, { status: 400 })
      }

      // Cek apakah produk memang nonaktif
      const [product] = await db.query(
        'SELECT * FROM produk_tambahan WHERE id_produk = ? AND status_aktif = "nonaktif"',
        [product_id]
      )

      if (product.length === 0) {
        return NextResponse.json({ 
          error: 'Produk tidak ditemukan atau sudah aktif' 
        }, { status: 404 })
      }

      // Start transaction
      await db.query('START TRANSACTION')

      try {
        // 1. Aktifkan kembali produk dan set cabang_tersedia untuk semua cabang yang dipilih
        await db.query(
          'UPDATE produk_tambahan SET status_aktif = "aktif", cabang_tersedia = ? WHERE id_produk = ?',
          [JSON.stringify(cabang_ids.map(String)), product_id]
        )

        // 2. Insert atau update stok untuk semua cabang yang dipilih
        for (const branch_id of cabang_ids) {
          // Cek apakah sudah ada record stok untuk cabang ini
          const [existingStock] = await db.query(
            'SELECT id_stok, stok_tersedia, stok_minimum FROM stok_cabang WHERE id_cabang = ? AND id_produk = ?',
            [branch_id, product_id]
          )

          // Get branch name for audit log
          const [branchInfo] = await db.query(
            'SELECT nama_cabang FROM cabang WHERE id_cabang = ?',
            [branch_id]
          )

          if (existingStock.length > 0) {
            // Update existing stock
            const oldStock = existingStock[0]

            await db.query(
              `UPDATE stok_cabang
               SET stok_tersedia = ?, stok_minimum = ?,
                   terakhir_update = NOW(), updated_by_karyawan = ?
               WHERE id_cabang = ? AND id_produk = ?`,
              [stok_tersedia || 0, stok_minimum || 10, updated_by_karyawan, branch_id, product_id]
            )

            // Log stock update to audit_log
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
                auth.user.id,
                JSON.stringify({
                  id_produk: parseInt(product_id),
                  id_cabang: parseInt(branch_id),
                  stok_tersedia: parseInt(oldStock.stok_tersedia),
                  stok_minimum: parseInt(oldStock.stok_minimum),
                  nama_produk: product[0].nama_produk,
                  nama_cabang: branchInfo[0]?.nama_cabang
                }),
                JSON.stringify({
                  id_produk: parseInt(product_id),
                  id_cabang: parseInt(branch_id),
                  stok_tersedia: parseInt(stok_tersedia || 0),
                  stok_minimum: parseInt(stok_minimum || 10),
                  nama_produk: product[0].nama_produk,
                  nama_cabang: branchInfo[0]?.nama_cabang
                }),
                'auto_approved',
                auth.user.id,
                `Reactivate product to multiple branches: ${product[0].nama_produk}`,
                request.headers.get('x-forwarded-for') || 'unknown'
              ]
            )
          } else {
            // Insert new stock record
            await db.query(
              `INSERT INTO stok_cabang
               (id_cabang, id_produk, stok_tersedia, stok_minimum, terakhir_update, updated_by_karyawan)
               VALUES (?, ?, ?, ?, NOW(), ?)`,
              [branch_id, product_id, stok_tersedia || 0, stok_minimum || 10, updated_by_karyawan]
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
                auth.user.id,
                null,
                JSON.stringify({
                  id_produk: parseInt(product_id),
                  id_cabang: parseInt(branch_id),
                  stok_tersedia: parseInt(stok_tersedia || 0),
                  stok_minimum: parseInt(stok_minimum || 10),
                  nama_produk: product[0].nama_produk,
                  nama_cabang: branchInfo[0]?.nama_cabang
                }),
                'auto_approved',
                auth.user.id,
                `Reactivate product to multiple branches: ${product[0].nama_produk}`,
                request.headers.get('x-forwarded-for') || 'unknown'
              ]
            )
          }
        }

        // Commit transaction
        await db.query('COMMIT')

        // Send push notification to owner
        try {
          const pushResult = await sendPushNotificationDirect({
            targetUserType: 'owner',
            notification: {
              title: '🔄 Produk Diaktifkan Kembali',
              body: `${product[0].nama_produk} telah diaktifkan di ${cabang_ids.length} cabang`,
              icon: '✅',
              tag: `product-reactivate-${product_id}`,
              url: '/audit-log',
              data: {
                productId: product_id,
                productName: product[0].nama_produk,
                action: 'reactivate_multiple',
                branchCount: cabang_ids.length
              }
            }
          })

          if (pushResult.success) {
            console.log(`✅ Push notification sent to owner for product reactivation`)
          }
        } catch (pushError) {
          console.error('Push notification error:', pushError)
        }

        return NextResponse.json({
          message: `Produk "${product[0].nama_produk}" berhasil diaktifkan di ${cabang_ids.length} cabang`,
          action: 'reactivated_multiple',
          product: {
            id_produk: product_id,
            nama_produk: product[0].nama_produk,
            status_aktif: 'aktif',
            cabang_count: cabang_ids.length
          }
        })

      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      }
    } else if (action === 'reactivate') {
      // Reaktivasi produk nonaktif global
      if (!product_id || !cabang_id) {
        return NextResponse.json({ 
          error: 'Product ID dan Cabang ID diperlukan untuk reaktivasi' 
        }, { status: 400 })
      }

      // Cek apakah produk memang nonaktif
      const [product] = await db.query(
        'SELECT * FROM produk_tambahan WHERE id_produk = ? AND status_aktif = "nonaktif"',
        [product_id]
      )

      if (product.length === 0) {
        return NextResponse.json({ 
          error: 'Produk tidak ditemukan atau sudah aktif' 
        }, { status: 404 })
      }

      // Start transaction
      await db.query('START TRANSACTION')

      try {
        // 1. Aktifkan kembali produk dan set cabang_tersedia untuk cabang yang direaktivasi
        await db.query(
          'UPDATE produk_tambahan SET status_aktif = "aktif", cabang_tersedia = ? WHERE id_produk = ?',
          [JSON.stringify([cabang_id.toString()]), product_id]
        )

        // 2. Update data produk jika ada perubahan
        if (harga || satuan || kategori_produk) {
          await db.query(
            `UPDATE produk_tambahan 
             SET harga = COALESCE(?, harga), 
                 satuan = COALESCE(?, satuan), 
                 kategori_produk = COALESCE(?, kategori_produk)
             WHERE id_produk = ?`,
            [harga, satuan, kategori_produk, product_id]
          )
        }

        // 3. Update atau insert stok cabang
        const [existingStock] = await db.query(
          'SELECT id_stok, stok_tersedia, stok_minimum FROM stok_cabang WHERE id_cabang = ? AND id_produk = ?',
          [cabang_id, product_id]
        )

        // Get branch name for audit log
        const [branchInfo] = await db.query(
          'SELECT nama_cabang FROM cabang WHERE id_cabang = ?',
          [cabang_id]
        )

        if (existingStock.length > 0) {
          // Update existing stock
          const oldStock = existingStock[0]
          const newStokTersedia = stok_tersedia !== undefined ? stok_tersedia : oldStock.stok_tersedia
          const newStokMinimum = stok_minimum !== undefined ? stok_minimum : oldStock.stok_minimum

          await db.query(
            `UPDATE stok_cabang
             SET stok_tersedia = COALESCE(?, stok_tersedia),
                 stok_minimum = COALESCE(?, stok_minimum),
                 terakhir_update = NOW(),
                 updated_by_karyawan = ?
             WHERE id_cabang = ? AND id_produk = ?`,
            [stok_tersedia, stok_minimum, updated_by_karyawan, cabang_id, product_id]
          )

          // Log stock update to audit_log
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
              auth.user.id,
              JSON.stringify({
                id_produk: parseInt(product_id),
                id_cabang: parseInt(cabang_id),
                stok_tersedia: parseInt(oldStock.stok_tersedia),
                stok_minimum: parseInt(oldStock.stok_minimum),
                nama_produk: product[0].nama_produk,
                nama_cabang: branchInfo[0]?.nama_cabang
              }),
              JSON.stringify({
                id_produk: parseInt(product_id),
                id_cabang: parseInt(cabang_id),
                stok_tersedia: parseInt(newStokTersedia),
                stok_minimum: parseInt(newStokMinimum),
                nama_produk: product[0].nama_produk,
                nama_cabang: branchInfo[0]?.nama_cabang
              }),
              'auto_approved',
              auth.user.id,
              `Reactivate product: ${product[0].nama_produk}`,
              request.headers.get('x-forwarded-for') || 'unknown'
            ]
          )
        } else {
          // Insert new stock record
          await db.query(
            `INSERT INTO stok_cabang
             (id_cabang, id_produk, stok_tersedia, stok_minimum, terakhir_update, updated_by_karyawan)
             VALUES (?, ?, ?, ?, NOW(), ?)`,
            [cabang_id, product_id, stok_tersedia || 0, stok_minimum || 10, updated_by_karyawan]
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
              auth.user.id,
              null,
              JSON.stringify({
                id_produk: parseInt(product_id),
                id_cabang: parseInt(cabang_id),
                stok_tersedia: parseInt(stok_tersedia || 0),
                stok_minimum: parseInt(stok_minimum || 10),
                nama_produk: product[0].nama_produk,
                nama_cabang: branchInfo[0]?.nama_cabang
              }),
              'auto_approved',
              auth.user.id,
              `Reactivate product: ${product[0].nama_produk}`,
              request.headers.get('x-forwarded-for') || 'unknown'
            ]
          )
        }

        // Commit transaction
        await db.query('COMMIT')

        // Send push notification to owner
        try {
          const [branchInfo] = await db.query('SELECT nama_cabang FROM cabang WHERE id_cabang = ?', [cabang_id])

          const pushResult = await sendPushNotificationDirect({
            targetUserType: 'owner',
            notification: {
              title: '🔄 Produk Diaktifkan Kembali',
              body: `${product[0].nama_produk} telah diaktifkan di ${branchInfo[0]?.nama_cabang || 'cabang'}`,
              icon: '✅',
              tag: `product-reactivate-${product_id}`,
              url: '/audit-log',
              data: {
                productId: product_id,
                productName: product[0].nama_produk,
                action: 'reactivate',
                branchId: cabang_id
              }
            }
          })

          if (pushResult.success) {
            console.log(`✅ Push notification sent to owner for product reactivation`)
          }
        } catch (pushError) {
          console.error('Push notification error:', pushError)
        }

        return NextResponse.json({
          message: `Produk "${product[0].nama_produk}" berhasil diaktifkan kembali`,
          action: 'reactivated',
          product: {
            id_produk: product_id,
            nama_produk: product[0].nama_produk,
            status_aktif: 'aktif'
          }
        })

      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      }
    } else if (action === 'add_to_branch') {
      // Tambahkan produk aktif ke cabang tertentu
      if (!product_id || !cabang_id) {
        return NextResponse.json({ 
          error: 'Product ID dan Cabang ID diperlukan untuk menambah ke cabang' 
        }, { status: 400 })
      }

      // Cek apakah produk aktif global tapi tidak ada di cabang ini
      const [product] = await db.query(
        `SELECT * FROM produk_tambahan p 
         WHERE p.id_produk = ? AND p.status_aktif = 'aktif'
         AND p.id_produk NOT IN (
           SELECT s.id_produk FROM stok_cabang s 
           WHERE s.id_cabang = ?
         )`,
        [product_id, cabang_id]
      )

      if (product.length === 0) {
        return NextResponse.json({ 
          error: 'Produk tidak ditemukan atau sudah tersedia di cabang ini' 
        }, { status: 404 })
      }

      try {
        // Get branch name for audit log
        const [branchInfo] = await db.query(
          'SELECT nama_cabang FROM cabang WHERE id_cabang = ?',
          [cabang_id]
        )

        // Insert stok_cabang record untuk cabang ini
        await db.query(
          `INSERT INTO stok_cabang
           (id_cabang, id_produk, stok_tersedia, stok_minimum, terakhir_update, updated_by_karyawan)
           VALUES (?, ?, ?, ?, NOW(), ?)`,
          [cabang_id, product_id, stok_tersedia || 0, stok_minimum || 10, updated_by_karyawan]
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
            auth.user.id,
            null,
            JSON.stringify({
              id_produk: parseInt(product_id),
              id_cabang: parseInt(cabang_id),
              stok_tersedia: parseInt(stok_tersedia || 0),
              stok_minimum: parseInt(stok_minimum || 10),
              nama_produk: product[0].nama_produk,
              nama_cabang: branchInfo[0]?.nama_cabang
            }),
            'auto_approved',
            auth.user.id,
            `Add product to branch: ${product[0].nama_produk}`,
            request.headers.get('x-forwarded-for') || 'unknown'
          ]
        )

        // Update cabang_tersedia di produk_tambahan
        let currentCabangTersedia = []
        try {
          if (product[0].cabang_tersedia) {
            if (typeof product[0].cabang_tersedia === 'string') {
              currentCabangTersedia = JSON.parse(product[0].cabang_tersedia)
            } else if (Array.isArray(product[0].cabang_tersedia)) {
              currentCabangTersedia = product[0].cabang_tersedia
            } else {
              // Data corrupt, reset to empty array
              currentCabangTersedia = []
            }
          }
        } catch (parseError) {
          console.warn('Corrupt cabang_tersedia in add_to_branch, resetting to empty array:', parseError)
          currentCabangTersedia = []
        }
        if (!currentCabangTersedia.includes(String(cabang_id))) {
          currentCabangTersedia.push(String(cabang_id))
          await db.query(
            'UPDATE produk_tambahan SET cabang_tersedia = ? WHERE id_produk = ?',
            [JSON.stringify(currentCabangTersedia), product_id]
          )
        }

        // Send push notification to owner
        try {
          const pushResponse = await fetch(`${request.nextUrl.origin}/api/push/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': request.headers.get('Cookie')
            },
            body: JSON.stringify({
              targetUserType: 'owner',
              notification: {
                title: '➕ Produk Ditambahkan ke Cabang',
                body: `${product[0].nama_produk} telah ditambahkan ke ${branchInfo[0]?.nama_cabang || 'cabang'}`,
                icon: '📦',
                tag: `product-add-${product_id}`,
                url: '/audit-log',
                data: {
                  productId: product_id,
                  productName: product[0].nama_produk,
                  action: 'add_to_branch',
                  branchId: cabang_id
                }
              }
            })
          })

          if (pushResponse.ok) {
            console.log(`✅ Push notification sent to owner for product addition`)
          }
        } catch (pushError) {
          console.error('Push notification error:', pushError)
        }

        return NextResponse.json({
          message: `Produk "${product[0].nama_produk}" berhasil ditambahkan ke cabang ini`,
          action: 'added_to_branch',
          product: {
            id_produk: product_id,
            nama_produk: product[0].nama_produk,
            status_aktif: 'aktif'
          }
        })

      } catch (error) {
        throw error
      }
    }

    return NextResponse.json({ 
      error: 'Action tidak valid' 
    }, { status: 400 })

  } catch (error) {
    console.error('Patch product error:', error)
    return NextResponse.json({ 
      error: 'Gagal memproses request',
      details: error.message 
    }, { status: 500 })
  }
}

export async function GET(request) {
  // Check authentication - inventory staff can view products
  const auth = authenticateInventoryStaff(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const cabang_id = searchParams.get('cabang_id')
    const status = searchParams.get('status') || 'aktif' // 'aktif', 'nonaktif', 'nonaktif_cabang', 'all'

    let query, params = []

    if (status === 'nonaktif') {
      // For globally inactive products, we only need product info (no cabang-specific data)
      query = `
        SELECT 
          p.id_produk,
          p.nama_produk,
          p.harga,
          p.satuan,
          p.kategori_produk,
          p.status_aktif,
          p.dibuat_pada
        FROM produk_tambahan p
        WHERE p.status_aktif = 'nonaktif'
        ORDER BY p.kategori_produk, p.nama_produk
      `
    } else if (status === 'nonaktif_cabang') {
      // For products inactive in specific branch (active globally but no stok_cabang record)
      if (!cabang_id) {
        return NextResponse.json({ 
          error: 'cabang_id diperlukan untuk melihat produk nonaktif per cabang' 
        }, { status: 400 })
      }

      query = `
        SELECT 
          p.id_produk,
          p.nama_produk,
          p.harga,
          p.satuan,
          p.kategori_produk,
          p.cabang_tersedia,
          p.status_aktif,
          p.dibuat_pada,
          0 as stok_tersedia,
          10 as stok_minimum
        FROM produk_tambahan p
        WHERE p.status_aktif = 'aktif' 
        AND p.id_produk NOT IN (
          SELECT s.id_produk FROM stok_cabang s 
          WHERE s.id_cabang = ?
        )
        ORDER BY p.kategori_produk, p.nama_produk
      `
      params.push(cabang_id)
    } else {
      // For active products, include stock information and cabang_tersedia
      query = `
        SELECT 
          p.id_produk,
          p.nama_produk,
          p.harga,
          p.satuan,
          p.kategori_produk,
          p.cabang_tersedia,
          p.status_aktif,
          p.dibuat_pada,
          COALESCE(s.stok_tersedia, 0) as stok_tersedia,
          COALESCE(s.stok_minimum, 10) as stok_minimum
        FROM produk_tambahan p
        LEFT JOIN stok_cabang s ON p.id_produk = s.id_produk
      `
      
      let whereConditions = []
      
      if (cabang_id) {
        // Filter untuk cabang tertentu
        whereConditions.push('(s.id_cabang = ? OR s.id_cabang IS NULL)')
        params.push(cabang_id)
        
        // Tambahan filter: produk harus tersedia di cabang ini atau tidak ada pembatasan cabang
        whereConditions.push('(p.cabang_tersedia IS NULL OR JSON_CONTAINS(p.cabang_tersedia, ?))')
        params.push(`"${cabang_id}"`)
      }
      
      if (status !== 'all') {
        whereConditions.push('p.status_aktif = ?')
        params.push(status)
      }
      
      if (whereConditions.length > 0) {
        query += ' WHERE ' + whereConditions.join(' AND ')
      }
      
      query += ' ORDER BY p.status_aktif DESC, p.kategori_produk, p.nama_produk'
    }

    const [products] = await db.query(query, params)

    return NextResponse.json({
      products,
      summary: {
        total: products.length,
        aktif: products.filter(p => p.status_aktif === 'aktif').length,
        nonaktif: products.filter(p => p.status_aktif === 'nonaktif').length
      }
    })

  } catch (error) {
    console.error('Get products error:', error)
    return NextResponse.json({ 
      error: 'Gagal mengambil data produk',
      details: error.message 
    }, { status: 500 })
  }
}