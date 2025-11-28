import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { 
  sanitizeInput, 
  validatePhoneNumber, 
  checkRateLimit, 
  logSecurityEvent,
  validateSQLParam 
} from '@/lib/security'

// Get client IP
function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIp) return realIp.trim()
  return '127.0.0.1'
}

export async function POST(request) {
  const clientIP = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'Unknown'
  const referer = request.headers.get('referer') || ''
  
  // Smart pool detection: kasir dashboard uses internal, customer homepage uses customer
  const isKasirContext = referer.includes('/kasir') || referer.includes('/dashboard') || referer.includes('/transactions')
  const poolType = isKasirContext ? 'internal' : 'customer'
  
  try {
    // Rate limiting - 5 requests per 5 minutes per IP (non real-time)
    const rateLimit = checkRateLimit(`loyalty-${clientIP}`, 300000, 5)
    
    if (!rateLimit.allowed) {
      logSecurityEvent('LOYALTY_RATE_LIMIT', {
        ip: clientIP,
        userAgent
      }, clientIP)
      
      return NextResponse.json({
        error: 'Terlalu banyak permintaan. Coba lagi dalam 5 menit.',
        retryAfter: 300
      }, {
        status: 429,
        headers: {
          'Retry-After': '300'
        }
      })
    }
    
    const body = await request.json()
    const { phone, id_cabang } = body

    // Require phone
    if (!phone) {
      return NextResponse.json({
        error: 'Nomor telepon diperlukan'
      }, { status: 400 })
    }

    // Validate phone
    const phoneValidation = validatePhoneNumber(phone)

    if (!phoneValidation.isValid) {
      logSecurityEvent('LOYALTY_INVALID_PHONE', {
        error: phoneValidation.error,
        sanitized: phoneValidation.sanitized
      }, clientIP)

      return NextResponse.json({
        error: phoneValidation.error
      }, { status: 400 })
    }

    const sanitizedPhone = phoneValidation.sanitized

    // SQL injection protection - validate phone parameter
    const sqlValidation = validateSQLParam(sanitizedPhone, 'string')
    if (!sqlValidation.isValid) {
      logSecurityEvent('LOYALTY_SQL_INJECTION_ATTEMPT', {
        phone: sanitizedPhone.substring(0, 5) + '***',
        error: sqlValidation.error
      }, clientIP)

      return NextResponse.json({
        error: 'Format nomor telepon tidak valid'
      }, { status: 400 })
    }

    // Mode 1: No id_cabang -> return list of branches
    if (!id_cabang) {
      logSecurityEvent('LOYALTY_GET_BRANCHES', {
        phone: sanitizedPhone.substring(0, 5) + '***',
        userAgent
      }, clientIP)

      // Get all branches where customer is registered
      const branchesQuery = `
        SELECT
          p.id_pelanggan,
          p.id_cabang,
          p.nama_pelanggan,
          c.nama_cabang,
          c.alamat
        FROM pelanggan p
        LEFT JOIN cabang c ON p.id_cabang = c.id_cabang
        WHERE p.nomor_telepon = ? AND p.status_aktif = 'aktif'
        ORDER BY p.id_cabang ASC
      `

      const branches = await query(branchesQuery, [sanitizedPhone], poolType)

      if (branches.length === 0) {
        return NextResponse.json({
          error: 'Nomor HP tidak terdaftar'
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        branches: branches.map(b => ({
          id_pelanggan: b.id_pelanggan,
          id_cabang: b.id_cabang,
          nama_cabang: b.nama_cabang,
          alamat: b.alamat,
          nama_pelanggan: b.nama_pelanggan
        }))
      })
    }

    // Mode 2: With id_cabang -> return loyalty data
    // Validate id_cabang
    const cabangValidation = validateSQLParam(id_cabang, 'number')
    if (!cabangValidation.isValid) {
      logSecurityEvent('LOYALTY_INVALID_CABANG_ID', {
        id_cabang: id_cabang,
        error: cabangValidation.error
      }, clientIP)

      return NextResponse.json({
        error: 'ID cabang tidak valid'
      }, { status: 400 })
    }

    // Log loyalty check attempt
    logSecurityEvent('LOYALTY_CHECK_ATTEMPT', {
      phone: sanitizedPhone.substring(0, 5) + '***',
      id_cabang: id_cabang,
      userAgent
    }, clientIP)

    // Get customer loyalty data - query by phone + id_cabang (per-branch)
    const customerQuery = `
      SELECT id_pelanggan as id, nama_pelanggan as nama, nomor_telepon as nomor_hp,
             dibuat_pada as tanggal_bergabung, terakhir_datang
      FROM pelanggan
      WHERE nomor_telepon = ? AND id_cabang = ? AND status_aktif = 'aktif'
    `
    const queryParams = [sanitizedPhone, id_cabang]

    const customer = await query(customerQuery, queryParams, poolType)

    if (customer.length === 0) {
      logSecurityEvent('LOYALTY_CUSTOMER_NOT_FOUND', {
        phone: sanitizedPhone.substring(0, 5) + '***',
        id_cabang: id_cabang,
        userAgent
      }, clientIP)

      return NextResponse.json({
        error: 'Customer tidak ditemukan di cabang ini',
        message: 'Nomor HP tidak terdaftar di cabang yang dipilih atau tidak aktif'
      }, { status: 404 })
    }

    const customerData = customer[0]
    
    // Get recent wash history (10 latest - with aggregated services)
    const transactionsQuery = `
      SELECT
        t.id_transaksi as id,
        t.tanggal_transaksi,
        t.total_keseluruhan as total_bayar,
        t.status_transaksi as status,
        t.metode_pembayaran,
        t.kode_transaksi,
        (SELECT GROUP_CONCAT(CONCAT(total_qty, 'x ', nama_layanan) ORDER BY nama_layanan SEPARATOR ', ')
        FROM (
          SELECT
            SUM(dtl.quantity) as total_qty,
            jl.nama_layanan
          FROM detail_transaksi_layanan dtl
          JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
          WHERE dtl.id_transaksi = t.id_transaksi
          GROUP BY jl.id_jenis_layanan, jl.nama_layanan
        ) as aggregated) as layanan_detail
       FROM transaksi t
       WHERE t.id_pelanggan = ? AND t.status_transaksi = 'selesai'
       ORDER BY t.tanggal_transaksi DESC
       LIMIT 10
    `

    const transactions = await query(transactionsQuery, [customerData.id], poolType)

    // Get tukar nota kertas history from audit_log
    const tukarNotaQuery = `
      SELECT
        al.id_audit as id,
        al.waktu_aksi as tanggal,
        al.data_baru,
        al.data_lama
      FROM audit_log al
      WHERE al.tabel_diubah = 'customer_total_cuci_manual'
        AND al.aksi = 'UPDATE'
        AND JSON_EXTRACT(al.data_baru, '$.customer_id') = ?
      ORDER BY al.waktu_aksi DESC
      LIMIT 10
    `

    const tukarNotaRecords = await query(tukarNotaQuery, [customerData.id], poolType)

    // Get loyalty data from columns (much simpler!)
    const loyaltyQuery = `
      SELECT total_cuci, loyalty_points, total_redeem FROM pelanggan WHERE id_pelanggan = ?
    `
    
    const loyaltyData = await query(loyaltyQuery, [customerData.id], poolType)
    const totalCuci = loyaltyData[0].total_cuci || 0
    const loyaltyPoints = loyaltyData[0].loyalty_points || 0
    const totalRedeem = loyaltyData[0].total_redeem || 0

    // FIXED: loyalty_points already represents available points (earnedPoints - totalRedeem)
    // Don't subtract totalRedeem again - that would be double subtraction!
    const remainingFreeWashes = Math.max(0, loyaltyPoints)
    const progressToNextFree = totalCuci % 10
    const nextFreeIn = 10 - progressToNextFree

    // Calculate savings (free cuci price = 10k each)
    const normalCuciPrice = 10000 // Rp10k per cuci service
    const totalSpent = transactions.reduce((sum, t) => sum + (parseFloat(t.total_bayar) || 0), 0)
    const totalSavings = (totalRedeem * normalCuciPrice)
    
    // Format wash history (transactions)
    const washHistory = transactions.map(t => ({
      id: t.id,
      type: 'transaksi',
      kode: t.kode_transaksi,
      tanggal: new Date(t.tanggal_transaksi).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      timestamp: new Date(t.tanggal_transaksi).getTime(),
      layanan: t.layanan_detail || t.nama_layanan || 'Cuci + Kering',
      harga: parseFloat(t.total_bayar) || 0,
      metode: t.metode_pembayaran,
      status: t.status,
      isFree: (parseFloat(t.total_bayar) || 0) === 0
    }))

    // Format tukar nota kertas history
    const tukarNotaHistory = tukarNotaRecords.map(tn => {
      // MySQL JSON columns are already parsed as objects
      const dataBaru = tn.data_baru
      const dataLama = tn.data_lama
      const jumlahNota = (dataBaru.new_total_cuci || 0) - (dataLama.old_total_cuci || 0)
      const isAddition = jumlahNota > 0

      return {
        id: `tn-${tn.id}`,
        type: isAddition ? 'tukar_nota_kertas' : 'koreksi_data',
        kode: isAddition ? `📝 TNK-${tn.id}` : `✏️ KOREKSI-${tn.id}`,
        tanggal: new Date(tn.tanggal).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        timestamp: new Date(tn.tanggal).getTime(),
        layanan: isAddition
          ? `Tukar ${jumlahNota} Nota Kertas`
          : `Koreksi Data`,
        harga: 0,
        metode: isAddition ? 'tukar_nota' : 'koreksi',
        status: 'selesai',
        isFree: false,
        jumlahNota: jumlahNota
      }
    })

    // Merge and sort by timestamp (newest first)
    const combinedHistory = [...washHistory, ...tukarNotaHistory]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10) // Limit to 10 most recent

    // Log successful loyalty check
    logSecurityEvent('LOYALTY_CHECK_SUCCESS', {
      customerId: customerData.id,
      phone: sanitizedPhone.substring(0, 5) + '***',
      id_cabang: id_cabang,
      totalCuci: totalCuci
    }, clientIP)

    return NextResponse.json({
      success: true,
      customer: {
        nama: sanitizeInput(customerData.nama),
        phone: sanitizeInput(customerData.nomor_hp),
        member_since: new Date(customerData.tanggal_bergabung).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta',
          month: 'long',
          year: 'numeric'
        })
      },
      loyalty: {
        total_cuci: totalCuci,
        loyalty_points: loyaltyPoints,
        total_redeem: totalRedeem,
        remaining_free_washes: remainingFreeWashes,
        progress_to_next_free: progressToNextFree,
        next_free_in: nextFreeIn
      },
      financial: {
        total_spent: totalSpent,
        total_savings: totalSavings,
        average_per_wash: totalCuci > 0 ? Math.round(totalSpent / totalCuci) : 0
      },
      history: combinedHistory,
      history_info: {
        title: "History Cucian",
        subtitle: "10 riwayat terbaru (transaksi & tukar nota)",
        note: "Menampilkan riwayat transaksi dan tukar nota kertas terbaru"
      }
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=900', // 15 minutes cache
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('Loyalty API Error:', error)
    
    logSecurityEvent('LOYALTY_API_ERROR', {
      error: error.message,
      stack: error.stack?.substring(0, 200),
      userAgent
    }, clientIP)
    
    return NextResponse.json({ 
      error: 'Terjadi kesalahan sistem',
      message: 'Silakan coba lagi atau hubungi staff D\'Wash'
      // Remove debug info in production for security
    }, { status: 500 })
  }
}

export async function GET(request) {
  const clientIP = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'Unknown'
  const referer = request.headers.get('referer') || ''
  
  // Smart pool detection: kasir dashboard uses internal, customer homepage uses customer
  const isKasirContext = referer.includes('/kasir') || referer.includes('/dashboard') || referer.includes('/transactions')
  const poolType = isKasirContext ? 'internal' : 'customer'
  
  try {
    // Get phone or customer_id from query params for TransactionForm usage
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const customer_id = searchParams.get('customer_id')
    
    if (!phone && !customer_id) {
      return NextResponse.json({ 
        error: 'Phone or customer_id parameter required' 
      }, { status: 400 })
    }
    
    // Rate limiting - 20 requests per 5 minutes per IP (more lenient for GET)
    const rateLimit = checkRateLimit(`loyalty-get-${clientIP}`, 300000, 20)
    
    if (!rateLimit.allowed) {
      logSecurityEvent('LOYALTY_GET_RATE_LIMIT', {
        ip: clientIP,
        userAgent
      }, clientIP)
      
      return NextResponse.json({
        error: 'Terlalu banyak permintaan. Coba lagi dalam 5 menit.',
        retryAfter: 300
      }, {
        status: 429,
        headers: {
          'Retry-After': '300'
        }
      })
    }
    
    let sanitizedPhone, cleanPhone
    
    // Validate phone if provided
    if (phone) {
      const phoneValidation = validatePhoneNumber(phone)
      
      if (!phoneValidation.isValid) {
        return NextResponse.json({ 
          error: phoneValidation.error 
        }, { status: 400 })
      }
      
      sanitizedPhone = phoneValidation.sanitized
      cleanPhone = sanitizedPhone.replace(/\D/g, '').replace(/^0/, '62')
    }
    
    // Validate customer_id if provided
    if (customer_id) {
      const idValidation = validateSQLParam(customer_id, 'number')
      if (!idValidation.isValid) {
        return NextResponse.json({ 
          error: 'Customer ID tidak valid' 
        }, { status: 400 })
      }
    }
    
    // Get customer loyalty data
    let customerQuery, queryParams
    
    if (customer_id) {
      // Lookup by customer ID (preferred for customers without phones)
      customerQuery = `
        SELECT id_pelanggan as id, nama_pelanggan as nama, nomor_telepon as nomor_hp, 
               dibuat_pada as tanggal_bergabung, terakhir_datang
        FROM pelanggan 
        WHERE id_pelanggan = ? AND status_aktif = 'aktif'
      `
      queryParams = [customer_id]
    } else {
      // Lookup by phone (normalized to database format)
      customerQuery = `
        SELECT id_pelanggan as id, nama_pelanggan as nama, nomor_telepon as nomor_hp, 
               dibuat_pada as tanggal_bergabung, terakhir_datang
        FROM pelanggan 
        WHERE nomor_telepon = ? AND status_aktif = 'aktif'
      `
      queryParams = [sanitizedPhone]
    }
    
    const customer = await query(customerQuery, queryParams, poolType)

    if (customer.length === 0) {
      const errorMessage = customer_id 
        ? 'Customer tidak ditemukan'
        : 'Nomor HP tidak ditemukan'
      
      return NextResponse.json({ 
        error: errorMessage 
      }, { status: 404 })
    }

    const customerData = customer[0]
    
    // Get loyalty data from columns (much simpler!)
    const loyaltyQuery = `
      SELECT total_cuci, loyalty_points, total_redeem FROM pelanggan WHERE id_pelanggan = ?
    `
    
    const loyaltyData = await query(loyaltyQuery, [customerData.id], poolType)
    const totalCuci = loyaltyData[0].total_cuci || 0
    const loyaltyPoints = loyaltyData[0].loyalty_points || 0
    const totalRedeem = loyaltyData[0].total_redeem || 0

    // FIXED: loyalty_points already represents available points (earnedPoints - totalRedeem)
    // Don't subtract totalRedeem again - that would be double subtraction!
    const remainingFreeWashes = Math.max(0, loyaltyPoints)
    const progressToNextFree = totalCuci % 10
    const nextFreeIn = 10 - progressToNextFree

    // Console log when customer earns loyalty points (every 10 washes)
    const earnedFreeWashes = Math.floor(totalCuci / 10)
    if (totalCuci > 0 && totalCuci % 10 === 0) {
      console.log(`🎉 [LOYALTY] Customer ${customerData.nama} (${customerData.id}) earned FREE WASH! Total cuci: ${totalCuci}, Earned: ${earnedFreeWashes}, Available: ${remainingFreeWashes}`)
    }

    return NextResponse.json({
      success: true,
      customer: {
        nama: sanitizeInput(customerData.nama),
        phone: sanitizeInput(customerData.nomor_hp),
        member_since: new Date(customerData.tanggal_bergabung).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta',
          month: 'long',
          year: 'numeric'
        })
      },
      loyalty: {
        total_cuci: totalCuci,
        loyalty_points: loyaltyPoints,
        total_redeem: totalRedeem,
        remaining_free_washes: remainingFreeWashes,
        progress_to_next_free: progressToNextFree,
        next_free_in: nextFreeIn
      }
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=900', // 15 minutes cache
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('Loyalty GET API Error:', error)
    
    logSecurityEvent('LOYALTY_GET_API_ERROR', {
      error: error.message,
      userAgent
    }, clientIP)
    
    return NextResponse.json({ 
      error: 'Terjadi kesalahan sistem'
    }, { status: 500 })
  }
}