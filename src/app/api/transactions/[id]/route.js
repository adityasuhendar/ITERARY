// FILE: src/app/api/transactions/[id]/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken } from '@/lib/auth'
import { updateMachineAssignmentsForEdit } from '@/lib/machineManager'

export async function GET(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    const { id } = await params

    // OPTIMIZED: Single query with parallel execution
    const [transactionData, services, products] = await Promise.all([
      // Main transaction data
      query(`
        SELECT
          t.*,
          p.nama_pelanggan,
          p.nomor_telepon,
          c.nama_cabang,
          k.nama_karyawan,
          k.nomor_telepon as nomor_telepon_kasir
        FROM transaksi t
        JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
        JOIN cabang c ON t.id_cabang = c.id_cabang
        JOIN karyawan k ON t.id_karyawan = k.id_karyawan
        WHERE t.id_transaksi = ?
      `, [id]),
      
      // Service details
      query(`
        SELECT 
          dtl.*,
          jl.nama_layanan,
          jl.durasi_menit,
          jl.deskripsi
        FROM detail_transaksi_layanan dtl
        JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
        WHERE dtl.id_transaksi = ?
        ORDER BY dtl.id_detail_layanan
      `, [id]),
      
      // Product details
      query(`
        SELECT
          dtp.id_detail_produk,
          dtp.id_transaksi,
          dtp.id_produk,
          dtp.quantity,
          dtp.harga_satuan,
          dtp.subtotal,
          dtp.is_free,
          dtp.free_quantity,
          pt.nama_produk,
          pt.satuan,
          pt.kategori_produk
        FROM detail_transaksi_produk dtp
        JOIN produk_tambahan pt ON dtp.id_produk = pt.id_produk
        WHERE dtp.id_transaksi = ?
        ORDER BY dtp.id_detail_produk
      `, [id])
    ])

    if (transactionData.length === 0) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const transaction = transactionData[0]

    // Verify access (kasir can only see their own branch transactions)
    if (user.role === 'kasir' && transaction.id_cabang !== user.cabang_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Combine all data
    const detailTransaction = {
      ...transaction,
      services: services,
      products: products
    }

    return NextResponse.json(detailTransaction)

  } catch (error) {
    console.error('Get transaction detail error:', error)
    return NextResponse.json({
      error: 'Database error',
      message: error.message
    }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user || user.role !== 'kasir') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const { status_transaksi, metode_pembayaran } = await request.json()

    // Validate status
    if (!['pending', 'selesai', 'dibatalkan'].includes(status_transaksi)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Check if transaction exists and belongs to user's branch
    const existingTransaction = await query(`
      SELECT id_cabang FROM transaksi WHERE id_transaksi = ?
    `, [id])

    if (existingTransaction.length === 0) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    if (existingTransaction[0].id_cabang !== user.cabang_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Update transaction status and payment method if provided
    if (metode_pembayaran && ['tunai', 'qris'].includes(metode_pembayaran)) {
      await query(`
        UPDATE transaksi 
        SET status_transaksi = ?, metode_pembayaran = ?, diupdate_pada = NOW() 
        WHERE id_transaksi = ?
      `, [status_transaksi, metode_pembayaran, id])
    } else {
      await query(`
        UPDATE transaksi 
        SET status_transaksi = ?, diupdate_pada = NOW() 
        WHERE id_transaksi = ?
      `, [status_transaksi, id])
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Status transaksi berhasil diupdate' 
    })

  } catch (error) {
    return NextResponse.json({ 
      error: 'Database error',
      message: error.message 
    }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user || user.role !== 'kasir') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const { 
      services, 
      products = [], 
      payment_method, 
      notes,
      is_draft = false
    } = await request.json()

    // Check if transaction exists and belongs to user's branch
    const existingTransaction = await query(`
      SELECT id_cabang, status_transaksi FROM transaksi WHERE id_transaksi = ?
    `, [id])

    if (existingTransaction.length === 0) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    if (existingTransaction[0].id_cabang !== user.cabang_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Only allow editing of 'pending' transactions
    if (existingTransaction[0].status_transaksi !== 'pending') {
      return NextResponse.json({ error: 'Can only edit pending transactions' }, { status: 400 })
    }

    // Check if this is just a payment update (no services/products provided)
    if (!services && !products.length) {
      // This is just a payment/status update
      await query(`
        UPDATE transaksi 
        SET metode_pembayaran = ?,
            status_transaksi = ?,
            diupdate_pada = NOW()
        WHERE id_transaksi = ?
      `, [
        payment_method || null,
        is_draft ? 'pending' : 'selesai',
        id
      ])

      // If converting draft to completed, update customer's total_cuci
      if (!is_draft) {
        // Get transaction details including customer ID and services
        const transactionDetails = await query(`
          SELECT t.id_pelanggan, dtl.*, jl.nama_layanan
          FROM transaksi t
          LEFT JOIN detail_transaksi_layanan dtl ON t.id_transaksi = dtl.id_transaksi
          LEFT JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
          WHERE t.id_transaksi = ?
        `, [id])

        if (transactionDetails.length > 0) {
          const customerId = transactionDetails[0].id_pelanggan
          
          // Count cuci services (paid ones only)
          const cuciServicesCount = transactionDetails.filter(detail => 
            detail.nama_layanan && 
            detail.nama_layanan.toLowerCase().includes('cuci') && 
            detail.subtotal > 0
          ).length

          // Count FREE cuci services (subtotal = 0)
          const freeCuciServicesCount = transactionDetails.filter(detail => 
            detail.nama_layanan && 
            detail.nama_layanan.toLowerCase().includes('cuci') && 
            parseFloat(detail.subtotal) === 0
          ).length

          if (cuciServicesCount > 0) {
            await query(`
              UPDATE pelanggan 
              SET total_cuci = total_cuci + ?, 
                  terakhir_datang = NOW(),
                  diperbarui_pada = NOW()
              WHERE id_pelanggan = ?
            `, [cuciServicesCount, customerId])

            // Award loyalty points for every 10 cuci (with proper redeem calculation)
            try {
                const customerData = await query(`
                SELECT total_cuci, loyalty_points, total_redeem FROM pelanggan WHERE id_pelanggan = ?
              `, [customerId])
              
              const { total_cuci, loyalty_points: currentLoyalty, total_redeem } = customerData[0]
            
            // Hitung total points yang seharusnya diterima dari total cuci
            const earnedPoints = Math.floor(total_cuci / 10)
            
            // Points yang tersedia = earned - redeemed  
            const availablePoints = earnedPoints - (total_redeem || 0)
            
            
            await query(`
              UPDATE pelanggan
              SET loyalty_points = ?
              WHERE id_pelanggan = ?
            `, [Math.max(0, availablePoints), customerId])

            // Calculate new points earned from this transaction (payment update)
            const previousTotalCuci = total_cuci - cuciServicesCount
            const newPointsEarned = Math.floor(total_cuci / 10) - Math.floor(previousTotalCuci / 10)

            // Get customer name for achievement modal
            const customerInfo = await query(`
              SELECT nama_pelanggan FROM pelanggan WHERE id_pelanggan = ?
            `, [customerId])

            // Store loyalty achievement data for frontend (payment update)
            if (newPointsEarned > 0 && customerInfo.length > 0) {
              global.loyaltyAchievement = {
                hasNewPoints: true,
                newPointsEarned: newPointsEarned,
                totalEarnedPoints: earnedPoints,
                totalCuci: total_cuci,
                totalAvailablePoints: Math.max(0, availablePoints),
                customerName: customerInfo[0].nama_pelanggan,
                message: `🎉 Selamat! ${customerInfo[0].nama_pelanggan} mendapat ${newPointsEarned} loyalty points baru!`
              }
            } else {
              global.loyaltyAchievement = null
            }

            } catch (loyaltyError) {
              console.error('Loyalty calculation error:', loyaltyError)
              global.loyaltyAchievement = null
            }

          }

          // Update loyalty points and total_redeem for free cuci services
          if (freeCuciServicesCount > 0) {
            await query(`
              UPDATE pelanggan 
              SET loyalty_points = GREATEST(0, loyalty_points - ?),
                  total_redeem = total_redeem + ?,
                  diperbarui_pada = NOW()
              WHERE id_pelanggan = ?
            `, [freeCuciServicesCount, freeCuciServicesCount, customerId])

          }
        }
      }

      const updatedTransaction = await query(`
        SELECT
          t.*,
          p.nama_pelanggan,
          p.nomor_telepon,
          c.nama_cabang,
          k.nama_karyawan
        FROM transaksi t
        JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
        JOIN cabang c ON t.id_cabang = c.id_cabang
        JOIN karyawan k ON t.id_karyawan = k.id_karyawan
        WHERE t.id_transaksi = ?
      `, [id])

      return NextResponse.json({
        success: true,
        transaction: updatedTransaction[0],
        loyaltyAchievement: global.loyaltyAchievement || null,
        message: 'Payment completed successfully'
      })
    }

    // Calculate new totals (only count services with quantity > 0)
    const totalLayanan = (services || []).reduce((sum, s) => {
      const quantity = parseInt(s.quantity) || 0
      if (quantity <= 0) return sum // Skip services with 0 quantity
      
      const harga = parseFloat(s.harga) || 0
      const actualPrice = s.isFree ? 0 : harga
      return sum + (actualPrice * quantity)
    }, 0)

    const totalProduk = Array.isArray(products) ? products.reduce((sum, p) => {
      const quantity = parseInt(p.quantity) || 0
      const harga = parseFloat(p.harga) || 0
      
      // Check if product is free (multiple checks for robustness)
      const isFreeProduct = p.isFree === true || p.isFree === 'true'
      
      if (isFreeProduct) {
        const freeQuantity = parseInt(p.freeQuantity) || quantity
        const paidQuantity = Math.max(0, quantity - freeQuantity)
        return sum + (harga * paidQuantity)
      }
      
      return sum + (harga * quantity)
    }, 0) : 0

    const totalKeseluruhan = totalLayanan + totalProduk

    // Start transaction to update everything atomically
    await query('START TRANSACTION')

    try {
      // 1. Update main transaction record
      await query(`
        UPDATE transaksi 
        SET total_layanan = ?,
            total_produk = ?,
            total_keseluruhan = ?,
            metode_pembayaran = ?,
            catatan = ?,
            status_transaksi = ?,
            diupdate_pada = NOW()
        WHERE id_transaksi = ?
      `, [
        totalLayanan,
        totalProduk,
        totalKeseluruhan,
        payment_method || null,
        notes || null,
        is_draft ? 'pending' : 'selesai',
        id
      ])

      // 2. Simple service update - delete all and recreate (safer for mixed pricing)
      // Release all existing machines first
      const currentAssignments = await query(`
        SELECT dtl.id_mesin
        FROM detail_transaksi_layanan dtl
        WHERE dtl.id_transaksi = ? AND dtl.id_mesin IS NOT NULL
      `, [id])
      
      for (const assignment of currentAssignments) {
        await query(`
          UPDATE mesin_laundry 
          SET status_mesin = 'tersedia',
              updated_by_karyawan = NULL,
              estimasi_selesai = NULL,
              diupdate_pada = NOW()
          WHERE id_mesin = ?
        `, [assignment.id_mesin])
      }
      
      // Delete all existing service records
      await query('DELETE FROM detail_transaksi_layanan WHERE id_transaksi = ?', [id])
      
      // Insert all new services (handles mixed pricing correctly)
      for (const service of (services || [])) {
        const quantity = parseInt(service.quantity) || 0
        const serviceId = service.id_jenis_layanan || service.id
        
        if (quantity <= 0) {
          continue
        }
        
        const harga = parseFloat(service.harga) || 0
        const actualPrice = (service.isFree || harga === 0) ? 0 : harga

        // Calculate fee kasir (CKL = 2000 per service)
        const feeKasir = (serviceId === 4) ? 2000 : 0  // CKL id = 4

        // Create individual records for each quantity unit
        for (let i = 0; i < quantity; i++) {
          await query(`
            INSERT INTO detail_transaksi_layanan (
              id_transaksi,
              id_jenis_layanan,
              quantity,
              harga_satuan,
              subtotal,
              fee_kasir
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [
            id,
            serviceId,
            1, // Each record represents 1 unit
            actualPrice,
            actualPrice,
            feeKasir   // 2000 untuk CKL, 0 untuk layanan lain
          ])
        }
      }

      // 4. Handle product updates (restore stock first, then deduct new quantities)
      // Get existing products to restore stock
      const existingProducts = await query(`
        SELECT id_produk, quantity FROM detail_transaksi_produk WHERE id_transaksi = ?
      `, [id])

      // Restore stock for existing products
      for (const existing of existingProducts) {
        await query(`
          UPDATE stok_cabang 
          SET stok_tersedia = stok_tersedia + ?
          WHERE id_cabang = ? AND id_produk = ?
        `, [existing.quantity, user.cabang_id, existing.id_produk])
      }

      // Delete existing product details
      await query('DELETE FROM detail_transaksi_produk WHERE id_transaksi = ?', [id])

      // Insert new product details and deduct stock
      if (Array.isArray(products) && products.length > 0) {
        for (const product of products) {
          if (!product.quantity || product.quantity <= 0) {
            continue
          }

          const productId = product.id_produk || product.id
          const harga = parseFloat(product.harga) || 0
          const quantity = parseInt(product.quantity) || 0
          
          // Calculate subtotal considering free products
          let subtotal = harga * quantity
          const isFreeProduct = product.isFree === true || product.isFree === 'true'
          
          if (isFreeProduct) {
            const freeQuantity = parseInt(product.freeQuantity) || quantity
            const paidQuantity = Math.max(0, quantity - freeQuantity)
            subtotal = harga * paidQuantity
          }

          // Check stock
          const stockCheck = await query(`
            SELECT stok_tersedia FROM stok_cabang 
            WHERE id_cabang = ? AND id_produk = ?
          `, [user.cabang_id, productId])

          if (stockCheck.length === 0 || stockCheck[0].stok_tersedia < quantity) {
            throw new Error(`Insufficient stock for product ${product.nama_produk || productId}`)
          }

          // Determine is_free and free_quantity flags
          const isFreeFlag = isFreeProduct ? 1 : 0
          const freeQty = isFreeProduct ? (parseInt(product.freeQuantity) || quantity) : 0

          // Insert product detail with free flags
          await query(`
            INSERT INTO detail_transaksi_produk (
              id_transaksi,
              id_produk,
              quantity,
              harga_satuan,
              subtotal,
              is_free,
              free_quantity
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [id, productId, quantity, harga, subtotal, isFreeFlag, freeQty])

          // Update stock
          await query(`
            UPDATE stok_cabang 
            SET stok_tersedia = stok_tersedia - ?,
                terakhir_update = NOW(),
                updated_by_karyawan = ?
            WHERE id_cabang = ? AND id_produk = ?
          `, [quantity, user.id, user.cabang_id, productId])
        }
      }

      // If converting draft to completed, update customer's total_cuci
      if (!is_draft) {
        // Get transaction details including customer ID
        const transactionDetails = await query(`
          SELECT t.id_pelanggan, dtl.*, jl.nama_layanan
          FROM transaksi t
          LEFT JOIN detail_transaksi_layanan dtl ON t.id_transaksi = dtl.id_transaksi
          LEFT JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
          WHERE t.id_transaksi = ?
        `, [id])

        if (transactionDetails.length > 0) {
          const customerId = transactionDetails[0].id_pelanggan
          
          // Count cuci services (paid ones only)
          const cuciServicesCount = transactionDetails.filter(detail => 
            detail.nama_layanan && 
            detail.nama_layanan.toLowerCase().includes('cuci') && 
            detail.subtotal > 0
          ).length

          // Count FREE cuci services (subtotal = 0)
          const freeCuciServicesCount = transactionDetails.filter(detail => 
            detail.nama_layanan && 
            detail.nama_layanan.toLowerCase().includes('cuci') && 
            parseFloat(detail.subtotal) === 0
          ).length


          if (cuciServicesCount > 0) {
            await query(`
              UPDATE pelanggan 
              SET total_cuci = total_cuci + ?, 
                  terakhir_datang = NOW(),
                  diperbarui_pada = NOW()
              WHERE id_pelanggan = ?
            `, [cuciServicesCount, customerId])

            // Award loyalty points for every 10 cuci (with proper redeem calculation)
            const customerData = await query(`
              SELECT total_cuci, loyalty_points, total_redeem FROM pelanggan WHERE id_pelanggan = ?
            `, [customerId])
            
            const { total_cuci, loyalty_points: currentLoyalty, total_redeem } = customerData[0]
            
            // Hitung total points yang seharusnya diterima dari total cuci
            const earnedPoints = Math.floor(total_cuci / 10)
            
            // Points yang tersedia = earned - redeemed  
            const availablePoints = earnedPoints - (total_redeem || 0)
            
            
            await query(`
              UPDATE pelanggan
              SET loyalty_points = ?
              WHERE id_pelanggan = ?
            `, [Math.max(0, availablePoints), customerId])

            // Calculate new points earned from this transaction
            const previousTotalCuci = total_cuci - cuciServicesCount
            const newPointsEarned = Math.floor(total_cuci / 10) - Math.floor(previousTotalCuci / 10)

            // Get customer name for achievement modal
            const customerInfo = await query(`
              SELECT nama_pelanggan FROM pelanggan WHERE id_pelanggan = ?
            `, [customerId])

            // Store loyalty achievement data for frontend (edit mode)
            if (newPointsEarned > 0 && customerInfo.length > 0) {
              global.loyaltyAchievement = {
                hasNewPoints: true,
                newPointsEarned: newPointsEarned,
                totalEarnedPoints: earnedPoints,
                totalCuci: total_cuci,
                totalAvailablePoints: Math.max(0, availablePoints),
                customerName: customerInfo[0].nama_pelanggan,
                message: `🎉 Selamat! ${customerInfo[0].nama_pelanggan} mendapat ${newPointsEarned} loyalty points baru!`
              }
            } else {
              global.loyaltyAchievement = null
            }

          }

          // Update loyalty points and total_redeem for free cuci services
          if (freeCuciServicesCount > 0) {
            await query(`
              UPDATE pelanggan 
              SET loyalty_points = GREATEST(0, loyalty_points - ?),
                  total_redeem = total_redeem + ?,
                  diperbarui_pada = NOW()
              WHERE id_pelanggan = ?
            `, [freeCuciServicesCount, freeCuciServicesCount, customerId])

          }
        }
      }

      // Commit transaction
      await query('COMMIT')

      // DISABLED: Update machine assignments (using draft system)
      // Only pass services with quantity > 0 to machine assignment
      const validServices = (services || []).filter(s => parseInt(s.quantity) > 0)
      
      
      // COMMENT OUT AUTO-ASSIGNMENT FOR DRAFT SYSTEM
      /*
      const machineUpdateResult = await updateMachineAssignmentsForEdit(
        id, 
        validServices, 
        user.cabang_id, 
        user.id
      )
      
      */
      
      // Mock successful result for draft system
      const machineUpdateResult = { 
        success: true, 
        released: [], 
        assigned: [], 
        errors: [] 
      }

      // Get updated transaction data
      const updatedTransaction = await query(`
        SELECT
          t.*,
          p.nama_pelanggan,
          p.nomor_telepon,
          c.nama_cabang,
          k.nama_karyawan
        FROM transaksi t
        JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
        JOIN cabang c ON t.id_cabang = c.id_cabang
        JOIN karyawan k ON t.id_karyawan = k.id_karyawan
        WHERE t.id_transaksi = ?
      `, [id])

      return NextResponse.json({
        success: true,
        transaction: updatedTransaction[0],
        machineAssignment: {
          released: machineUpdateResult.released,
          assigned: machineUpdateResult.assigned,
          errors: machineUpdateResult.errors,
          success: machineUpdateResult.success
        },
        loyaltyAchievement: global.loyaltyAchievement || null,
        message: `Transaksi berhasil diupdate. ${machineUpdateResult.released.length} mesin dirilis, ${machineUpdateResult.assigned.length} mesin baru di-assign.`
      })

    } catch (error) {
      // Rollback on error
      await query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Update transaction error:', error)
    return NextResponse.json({
      error: 'Transaction update failed',
      message: error.message
    }, { status: 500 })
  }
}