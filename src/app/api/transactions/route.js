import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken } from '@/lib/auth'
import { checkCSRF } from '@/lib/csrf'

export async function POST(request) {
  try {
    // CSRF Protection
    const csrfCheck = checkCSRF(request)
    if (!csrfCheck.isValid) {
      return NextResponse.json({ 
        error: 'CSRF protection failed',
        message: csrfCheck.error 
      }, { status: 403 })
    }

    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user || user.role !== 'kasir') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      id_pelanggan, 
      services, 
      products = [], // Default to empty array
      payment_method, 
      notes,
      cabang_id,
      shift,
      active_worker_name, // For database storage as string
      is_draft = false
    } = body

    // Debug logging
    console.log('🔍 [Transaction API] Full request body:', body)
    console.log('🔍 [Transaction API] Request body:', {
      id_pelanggan,
      cabang_id,
      shift,
      active_worker_name,
      servicesCount: services?.length || 0,
      productsCount: products?.length || 0
    })

    // Validation
    if (!id_pelanggan || !cabang_id || !shift) {
      console.log('❌ [Transaction API] Missing required fields:', {
        id_pelanggan: !!id_pelanggan,
        cabang_id: !!cabang_id,
        shift: !!shift
      })
      return NextResponse.json({ 
        error: 'Missing required fields: id_pelanggan, cabang_id, shift' 
      }, { status: 400 })
    }

    // Validate that either services OR products are provided
    const hasServices = services && Array.isArray(services) && services.length > 0
    const hasProducts = products && Array.isArray(products) && products.length > 0
    
    if (!hasServices && !hasProducts) {
      return NextResponse.json({ 
        error: 'At least one service or product is required' 
      }, { status: 400 })
    }

    // Calculate totals - handle empty services array
    const totalLayanan = hasServices ? services.reduce((sum, s) => {
      const quantity = s.quantity || 1 // Default quantity to 1
      const harga = parseFloat(s.harga) || 0
      // Always use original price for total calculation, regardless of free status
      return sum + (harga * quantity)
    }, 0) : 0

    const totalProduk = Array.isArray(products) ? products.reduce((sum, p) => {
      const quantity = parseInt(p.quantity) || 0
      const harga = parseFloat(p.harga) || 0
      
      // Check if product is free (multiple checks for robustness)
      const isFreeProduct = p.isFree === true || p.isFree === 'true'
      
      if (isFreeProduct) {
        const freeQuantity = parseInt(p.freeQuantity) || quantity // If no freeQuantity specified, assume all is free
        const paidQuantity = Math.max(0, quantity - freeQuantity)
        return sum + (harga * paidQuantity)
      }
      
      return sum + (harga * quantity)
    }, 0) : 0

    const totalKeseluruhan = totalLayanan + totalProduk


    // // Generate unique transaction code using timestamp + random
    // const generateTransactionCode = () => {
    //   const now = new Date()
    //   const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(2).replace(/-/g, '') // YYMMDD format WIB
    //   const timeStr = now.getTime().toString().slice(-4) // Last 4 digits of timestamp
    //   const randomStr = Math.random().toString(36).substr(2, 2).toUpperCase() // 2 random chars
      
    //   return `TA${dateStr}${timeStr}${randomStr}`
    // }

    // 1. Create main transaction record (let trigger generate kode_transaksi)
    const transactionResult = await query(`
      INSERT INTO transaksi (
        id_pelanggan, 
        id_karyawan, 
        nama_pekerja_aktual,
        id_cabang, 
        shift_transaksi,
        total_layanan,
        total_produk,
        total_keseluruhan,
        metode_pembayaran,
        catatan,
        status_transaksi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id_pelanggan,
      user.id,
      active_worker_name || null, // String snapshot of worker name
      cabang_id,
      shift,
      totalLayanan,
      totalProduk,
      totalKeseluruhan,
      payment_method || 'tunai', // Default to 'tunai' if null
      notes || null,
      is_draft ? 'pending' : 'selesai'
    ])

    const transactionId = transactionResult.insertId

    // 1.5. DISABLED: Pre-assign machines for services (using draft system instead)
    let machineAssignment = { success: true, assignments: [], errors: [] }
    
    // COMMENT OUT AUTO-ASSIGNMENT FOR DRAFT SYSTEM
    /*
    if (hasServices) {
      const serviceRequests = []
      for (const service of services) {
        const quantity = service.quantity || 1
        // Create individual requests for each quantity unit
        for (let i = 0; i < quantity; i++) {
          serviceRequests.push({ 
            id_jenis_layanan: service.id,
            service_name: service.nama_layanan,
            instance: i + 1,
            total_quantity: quantity
          })
        }
      }
      
      machineAssignment = await assignMachinesForTransaction(
        serviceRequests, 
        cabang_id, 
        user.id
      )

      // If no machines are available for some services, still continue but log warning
      if (!machineAssignment.success && machineAssignment.assignments.length === 0) {
        console.warn('No machines available for transaction:', transactionId)
      }
    }
    */

    // 2. Insert service details - INDIVIDUAL RECORDS FOR EACH QUANTITY UNIT (only if services exist)
    const detailLayananIds = []
    if (hasServices) {
      for (const service of services) {
        const quantity = service.quantity || 1
        const harga = parseFloat(service.harga) || 0
        
        // Services from API have structure: { id, nama_layanan, harga, durasi_menit }
        // where 'id' is actually the id_jenis_layanan from database
        const serviceId = service.id
        if (!serviceId) {
          throw new Error(`Service ID missing for service: ${service.nama_layanan || 'Unknown'}`)
        }
        
        
        // For free laundry, price should be 0
        const actualPrice = (service.isFree || harga === 0) ? 0 : harga
        const unitPrice = actualPrice // Price per individual unit

        // Calculate fee kasir (CKL = 2000 per service)
        const feeKasir = (serviceId === 4) ? 2000 : 0  // CKL id = 4

        // Create individual records for each quantity unit (1 record = 1 machine assignment)
        for (let i = 0; i < quantity; i++) {

          const detailResult = await query(`
            INSERT INTO detail_transaksi_layanan (
              id_transaksi,
              id_jenis_layanan,
              quantity,
              harga_satuan,
              subtotal,
              fee_kasir
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [
            transactionId,
            serviceId,
            1, // Each record represents 1 unit for 1 machine assignment
            unitPrice,
            unitPrice, // subtotal = 1 * unitPrice
            feeKasir   // 2000 untuk CKL, 0 untuk layanan lain
          ])
          
          detailLayananIds.push(detailResult.insertId)
          
        }
      }
    }

    // 2.5. DISABLED: Complete machine assignments (using draft system instead)
    let machineActivationResult = { success: true, activated: [], errors: [] }
    
    // COMMENT OUT MACHINE ACTIVATION FOR DRAFT SYSTEM
    /*
    if (machineAssignment.assignments.length > 0) {
      machineActivationResult = await completeMachineAssignments(
        machineAssignment.assignments,
        detailLayananIds,
        user.id
      )
    }
    */
      
      // DISABLED: Log machine activation results (draft system)
      /*
      if (!machineActivationResult.success) {
        console.warn('Some machines failed to activate:', machineActivationResult.errors)
      } else {
      }
      */

    // 3. Insert product details and update stock
    if (Array.isArray(products) && products.length > 0) {
      
      for (const product of products) {
        if (!product.quantity || product.quantity <= 0) {
          continue // Skip products with no quantity
        }

        // Handle different product ID field names
        const productId = product.id_produk || product.id
        if (!productId) {
          throw new Error(`Product ID missing for product: ${product.nama_produk}`)
        }

        // Check stock first
        const stockCheck = await query(`
          SELECT stok_tersedia 
          FROM stok_cabang 
          WHERE id_cabang = ? AND id_produk = ?
        `, [cabang_id, productId])

        if (stockCheck.length === 0) {
          throw new Error(`Product ${product.nama_produk || product.id} not found in branch stock`)
        }

        if (stockCheck[0].stok_tersedia < product.quantity) {
          throw new Error(`Insufficient stock for ${product.nama_produk || product.id}. Available: ${stockCheck[0].stok_tersedia}`)
        }

        const harga = parseFloat(product.harga) || 0
        const quantity = parseInt(product.quantity) || 0
        
        // Calculate subtotal considering free products
        let subtotal = harga * quantity
        const isFreeProduct = product.isFree === true || product.isFree === 'true'
        
        if (isFreeProduct) {
          const freeQuantity = parseInt(product.freeQuantity) || quantity
          const paidQuantity = Math.max(0, quantity - freeQuantity)
          subtotal = harga * paidQuantity
        } else {
        }

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
        `, [
          transactionId,
          productId,
          quantity,
          harga,
          subtotal,
          product.isFree ? 1 : 0,
          product.freeQuantity || 0
        ])

        // Update stock
        await query(`
          UPDATE stok_cabang 
          SET stok_tersedia = stok_tersedia - ?,
              terakhir_update = NOW(),
              updated_by_karyawan = ?
          WHERE id_cabang = ? AND id_produk = ?
        `, [quantity, user.id, cabang_id, productId])
      }

      // 3.5. Recalculate all totals after all products are inserted
      // This fixes the issue where database trigger recalculates total before products are inserted
      await query(`
        UPDATE transaksi
        SET total_layanan = COALESCE(
            (SELECT SUM(subtotal) FROM detail_transaksi_layanan WHERE id_transaksi = ?), 0
          ),
          total_produk = COALESCE(
            (SELECT SUM(subtotal) FROM detail_transaksi_produk WHERE id_transaksi = ?), 0
          ),
          total_keseluruhan = (
            COALESCE(
              (SELECT SUM(subtotal) FROM detail_transaksi_layanan WHERE id_transaksi = ?), 0
            ) +
            COALESCE(
              (SELECT SUM(subtotal) FROM detail_transaksi_produk WHERE id_transaksi = ?), 0
            )
          )
        WHERE id_transaksi = ?
      `, [transactionId, transactionId, transactionId, transactionId, transactionId])
      
    }

    // 4. Get the complete transaction with generated code
    const completedTransaction = await query(`
      SELECT 
        t.id_transaksi,
        t.kode_transaksi,
        t.total_keseluruhan,
        t.metode_pembayaran,
        t.tanggal_transaksi,
        t.status_transaksi,
        t.catatan,
        t.nama_pekerja_aktual,
        p.nama_pelanggan,
        p.nomor_telepon,
        c.nama_cabang,
        k.nama_karyawan
      FROM transaksi t
      JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
      JOIN cabang c ON t.id_cabang = c.id_cabang
      JOIN karyawan k ON t.id_karyawan = k.id_karyawan
      WHERE t.id_transaksi = ?
    `, [transactionId])

    if (completedTransaction.length === 0) {
      throw new Error('Failed to retrieve created transaction')
    }

    // 5. Get service details for receipt
    const transactionServices = await query(`
      SELECT 
        dtl.*,
        jl.nama_layanan,
        jl.durasi_menit
      FROM detail_transaksi_layanan dtl
      JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
      WHERE dtl.id_transaksi = ?
    `, [transactionId])

    // 6. Get product details for receipt
    const transactionProducts = await query(`
      SELECT 
        dtp.*,
        pt.nama_produk,
        pt.satuan
      FROM detail_transaksi_produk dtp
      JOIN produk_tambahan pt ON dtp.id_produk = pt.id_produk
      WHERE dtp.id_transaksi = ?
    `, [transactionId])

    // Add services and products to transaction object
    const transaction = {
      ...completedTransaction[0],
      services: transactionServices,
      products: transactionProducts,
      // Add active worker name for receipt display
      active_worker_name: active_worker_name || null
    }

    // 7. Update customer's total_cuci if transaction is completed (not draft)
    if (!is_draft && hasServices) {
      // Count how many cuci services in this transaction (paid ones only)
      const cuciServicesCount = transactionServices.filter(service => 
        service.nama_layanan && service.nama_layanan.toLowerCase().includes('cuci') && service.subtotal > 0
      ).length

      // Count FREE cuci services (subtotal = 0)
      const freeCuciServicesCount = transactionServices.filter(service => 
        service.nama_layanan && service.nama_layanan.toLowerCase().includes('cuci') && parseFloat(service.subtotal) === 0
      ).length


      if (cuciServicesCount > 0) {
        await query(`
          UPDATE pelanggan 
          SET total_cuci = total_cuci + ?, 
              terakhir_datang = NOW(),
              diperbarui_pada = NOW()
          WHERE id_pelanggan = ?
        `, [cuciServicesCount, id_pelanggan])

        // Award loyalty points for every 10 cuci (with proper redeem calculation)
        const customerData = await query(`
          SELECT total_cuci, loyalty_points, total_redeem FROM pelanggan WHERE id_pelanggan = ?
        `, [id_pelanggan])

        const { total_cuci, loyalty_points: currentLoyalty, total_redeem } = customerData[0]

        // Calculate previous earned points (before this transaction)
        const previousTotalCuci = total_cuci - cuciServicesCount
        const previousEarnedPoints = Math.floor(previousTotalCuci / 10)

        // Hitung total points yang seharusnya diterima dari total cuci
        const earnedPoints = Math.floor(total_cuci / 10)

        // Check if customer earned new points from this transaction
        const newPointsEarned = earnedPoints - previousEarnedPoints

        // Points yang tersedia = earned - redeemed
        const availablePoints = earnedPoints - (total_redeem || 0)

        // Store loyalty achievement data for frontend
        global.loyaltyAchievement = {
          hasNewPoints: newPointsEarned > 0,
          newPointsEarned: newPointsEarned,
          totalEarnedPoints: earnedPoints,
          totalCuci: total_cuci,
          totalAvailablePoints: Math.max(0, availablePoints),
          customerName: completedTransaction[0].nama_pelanggan,
          message: newPointsEarned > 0 ? `🎉 Selamat! ${completedTransaction[0].nama_pelanggan} mendapat ${newPointsEarned} loyalty points baru!` : null
        }

        await query(`
          UPDATE pelanggan
          SET loyalty_points = ?
          WHERE id_pelanggan = ?
        `, [Math.max(0, availablePoints), id_pelanggan])
      }

      // Update loyalty points and total_redeem for free cuci services
      if (freeCuciServicesCount > 0) {
        await query(`
          UPDATE pelanggan 
          SET loyalty_points = GREATEST(0, loyalty_points - ?),
              total_redeem = total_redeem + ?,
              diperbarui_pada = NOW()
          WHERE id_pelanggan = ?
        `, [freeCuciServicesCount, freeCuciServicesCount, id_pelanggan])
      }
    }

    // Prepare response with machine activation info
    const responseMessage = machineActivationResult.activated.length > 0 
      ? `Transaksi berhasil dibuat. ${machineActivationResult.activated.length} mesin otomatis diaktifkan.`
      : 'Transaksi berhasil dibuat.'

    return NextResponse.json({
      success: true,
      transaction: transaction,
      machineActivation: {
        activated: machineActivationResult.activated,
        errors: machineActivationResult.errors,
        totalActivated: machineActivationResult.activated.length
      },
      loyaltyAchievement: global.loyaltyAchievement || null,
      message: responseMessage
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Transaction failed',
      message: error.message,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user || user.role !== 'kasir') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const cabangId = parseInt(searchParams.get('cabang_id')) || user.cabang_id || 1
    const shift = searchParams.get('shift') // Don't default to user.shift if not provided
    const status = searchParams.get('status') || 'selesai' // new parameter for status
    const customerId = searchParams.get('customer_id') // filter by customer
    
    // OPTIONAL FILTERS (bukan required)
    const date = searchParams.get('date') // jika ada
    const startDate = searchParams.get('start_date') // tanggal mulai
    const endDate = searchParams.get('end_date') // tanggal akhir
    const paymentMethod = searchParams.get('payment_method') // jika ada
    // const limit = Math.max(1, parseInt(searchParams.get('limit')) || 50)
    const limit = Math.max(1, Math.min(1000, parseInt(searchParams.get('limit')) || 50))

    // Validate cabangId
    if (!cabangId || isNaN(cabangId)) {
      return NextResponse.json({ error: 'Invalid cabang_id' }, { status: 400 })
    }


    // Simple query - same as dashboard working query
    let baseQuery = `
      SELECT 
        t.id_transaksi,
        t.kode_transaksi,
        t.tanggal_transaksi,
        t.total_keseluruhan,
        t.metode_pembayaran,
        t.status_transaksi,
        p.nama_pelanggan,
        p.nomor_telepon,
        k.nama_karyawan
      FROM transaksi t
      JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
      JOIN karyawan k ON t.id_karyawan = k.id_karyawan
      WHERE t.id_cabang = ? AND t.status_transaksi = ?
    `
    let params = [cabangId, status]

    // Add filters based on parameters
    if (date && shift) {
      baseQuery += ` AND DATE(t.tanggal_transaksi) = ? AND t.shift_transaksi = ?`
      params.push(date, shift)
    } else if (startDate && endDate) {
      baseQuery += ` AND DATE(t.tanggal_transaksi) BETWEEN ? AND ?`
      params.push(startDate, endDate)
    } else if (startDate) {
      baseQuery += ` AND DATE(t.tanggal_transaksi) >= ?`
      params.push(startDate)
    } else if (endDate) {
      baseQuery += ` AND DATE(t.tanggal_transaksi) <= ?`
      params.push(endDate)
    }
    // For 'all' case - no additional filters, just cabang and status

    if (paymentMethod && paymentMethod !== '') {
      baseQuery += ` AND t.metode_pembayaran = ?`
      params.push(paymentMethod)
    }

    if (customerId && customerId !== '') {
      baseQuery += ` AND t.id_pelanggan = ?`
      params.push(parseInt(customerId))
    }

baseQuery += ` ORDER BY t.tanggal_transaksi DESC LIMIT ${parseInt(limit)}`
// Jangan push limit ke params array

    const transactions = await query(baseQuery, params)
    return NextResponse.json({ transactions })

  } catch (error) {
    return NextResponse.json({ 
      error: 'Database error',
      message: error.message,
      code: error.code,
      debug: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        sqlMessage: error.sqlMessage,
        errno: error.errno
      } : undefined
    }, { status: 500 })
  }
}