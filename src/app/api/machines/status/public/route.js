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
  
  // Using customer pool via parameter
  
  try {
    // Rate limiting - 5 requests per 5 minutes per IP
    const rateLimit = checkRateLimit(`machine-status-${clientIP}`, 300000, 5)
    
    if (!rateLimit.allowed) {
      logSecurityEvent('MACHINE_STATUS_RATE_LIMIT', {
        ip: clientIP,
        userAgent,
        attempts: 'exceeded'
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
    const { phone_number, cabang_id, csrfToken } = body
    
    // CSRF Protection - Validate token for public customer endpoints
    // Note: For now, we'll add basic CSRF header check
    const csrfHeader = request.headers.get('X-CSRF-Token')
    if (!csrfHeader && !csrfToken) {
      logSecurityEvent('MACHINE_STATUS_MISSING_CSRF', {
        ip: clientIP,
        userAgent,
        hasHeader: !!csrfHeader,
        hasBody: !!csrfToken
      }, clientIP)
      
      return NextResponse.json({
        error: 'Security token diperlukan'
      }, { status: 403 })
    }
    
    // Input validation and sanitization
    if (!phone_number) {
      logSecurityEvent('MACHINE_STATUS_MISSING_PHONE', {
        ip: clientIP,
        userAgent
      }, clientIP)
      
      return NextResponse.json({ 
        error: 'Nomor telepon diperlukan' 
      }, { status: 400 })
    }

    if (!cabang_id) {
      logSecurityEvent('MACHINE_STATUS_MISSING_BRANCH', {
        ip: clientIP,
        userAgent
      }, clientIP)
      
      return NextResponse.json({ 
        error: 'Pilih cabang terlebih dahulu' 
      }, { status: 400 })
    }

    // Validate and sanitize phone number
    const phoneValidation = validatePhoneNumber(phone_number)
    
    if (!phoneValidation.isValid) {
      logSecurityEvent('MACHINE_STATUS_INVALID_PHONE', {
        error: phoneValidation.error,
        sanitized: phoneValidation.sanitized,
        ip: clientIP,
        userAgent
      }, clientIP)
      
      return NextResponse.json({ 
        error: phoneValidation.error 
      }, { status: 400 })
    }
    
    const sanitizedPhone = phoneValidation.sanitized
    
    // Validate cabang_id
    const cabangValidation = validateSQLParam(cabang_id, 'number')
    if (!cabangValidation.isValid) {
      logSecurityEvent('MACHINE_STATUS_INVALID_BRANCH_ID', {
        cabang_id: cabang_id,
        error: cabangValidation.error,
        ip: clientIP,
        userAgent
      }, clientIP)
      
      return NextResponse.json({ 
        error: 'ID cabang tidak valid' 
      }, { status: 400 })
    }

    // Log security event
    logSecurityEvent('MACHINE_STATUS_CHECK_ATTEMPT', {
      phone: sanitizedPhone.substring(0, 5) + '***',
      cabang_id: cabang_id,
      userAgent
    }, clientIP)

    // 1. Validate customer exists dan punya transaction (completed OR pending today)
    const customerCheck = await query(`
      SELECT 
        p.id_pelanggan,
        p.nama_pelanggan
      FROM pelanggan p 
      WHERE p.nomor_telepon = ? 
        AND p.status_aktif = 'aktif'
        AND EXISTS (
          SELECT 1 FROM transaksi t WHERE t.id_pelanggan = p.id_pelanggan 
          AND t.id_cabang = ? AND (
            (t.status_transaksi = 'selesai' AND DATE(t.tanggal_transaksi) >= DATE_SUB(NOW(), INTERVAL 10 DAY))
            OR 
            (t.status_transaksi = 'pending' AND DATE(t.tanggal_transaksi) = CURDATE())
          )
        )
    `, [sanitizedPhone, cabang_id], 'customer')

    if (customerCheck.length === 0) {
      logSecurityEvent('MACHINE_STATUS_CUSTOMER_NOT_FOUND', {
        phone: sanitizedPhone.substring(0, 5) + '***',
        cabang_id: cabang_id,
        userAgent
      }, clientIP)
      
      return NextResponse.json({
        error: 'Nomor telepon tidak ditemukan atau tidak memiliki transaksi aktif di cabang ini dalam 10 hari terakhir'
      }, { status: 404 })
    }

    // 2. Get branch info
    const branchInfo = await query(`
      SELECT nama_cabang, alamat 
      FROM cabang 
      WHERE id_cabang = ? AND status_aktif = 'aktif'
    `, [cabang_id], 'customer')

    if (branchInfo.length === 0) {
      return NextResponse.json({
        error: 'Cabang tidak ditemukan'
      }, { status: 404 })
    }

    // 3. Get machine status with estimasi selesai - DEBUG & IMPROVED QUERY
    const machineStatus = await query(`
      SELECT 
        m.id_mesin,
        m.nomor_mesin,
        m.jenis_mesin,
        m.status_mesin,
        m.estimasi_selesai as machine_estimasi,
        dtl.id_detail_layanan,
        dtl.estimasi_selesai as service_estimasi,
        dtl.waktu_mulai,
        jl.nama_layanan,
        jl.durasi_menit,
        dtl.service_status,
        t.kode_transaksi,
        -- Use service estimasi first, fallback to machine estimasi
        COALESCE(dtl.estimasi_selesai, m.estimasi_selesai) as best_estimasi,
        -- Debug info
        dtl.quantity,
        dtl.subtotal
      FROM mesin_laundry m
      LEFT JOIN detail_transaksi_layanan dtl ON m.id_mesin = dtl.id_mesin 
        AND dtl.service_status IN ('active', 'planned')
      LEFT JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
      LEFT JOIN transaksi t ON dtl.id_transaksi = t.id_transaksi
      WHERE m.id_cabang = ?
        AND m.status_mesin IN ('tersedia', 'digunakan')
      ORDER BY m.jenis_mesin DESC, m.nomor_mesin ASC
    `, [cabang_id], 'customer')


    // 4. Format machine data for customer display
    const formattedMachines = machineStatus.map(machine => {
      let statusText = ''
      let estimasiText = ''
      let isAvailable = false
      
      
      if (machine.status_mesin === 'tersedia') {
        statusText = 'Tersedia'
        estimasiText = 'Siap digunakan'
        isAvailable = true
      } else if (machine.status_mesin === 'digunakan') {
        // Try to get estimasi from any available source
        let estimasiTime = null
        
        if (machine.best_estimasi) {
          estimasiTime = new Date(machine.best_estimasi)
        } else if (machine.waktu_mulai && machine.durasi_menit) {
          // Calculate estimasi from waktu_mulai + durasi
          const startTime = new Date(machine.waktu_mulai)
          estimasiTime = new Date(startTime.getTime() + (machine.durasi_menit * 60 * 1000))
        }
        
        if (estimasiTime && !isNaN(estimasiTime.getTime())) {
          const now = new Date()
          const diffMinutes = Math.ceil((estimasiTime - now) / (1000 * 60))
          
          if (diffMinutes <= 0) {
            statusText = 'Hampir Selesai' 
            estimasiText = 'Segera tersedia'
          } else if (diffMinutes <= 5) {
            statusText = 'Hampir Selesai'
            estimasiText = `Sekitar ${diffMinutes} menit lagi`
          } else {
            statusText = 'Sedang Digunakan'
            estimasiText = `Selesai sekitar ${estimasiTime.toLocaleTimeString('id-ID', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}`
          }
          isAvailable = false
        } else {
          // Fallback: assume standard duration based on machine type
          const standardDuration = machine.jenis_mesin === 'cuci' ? 15 : 45
          statusText = 'Sedang Digunakan'
          estimasiText = `Estimasi ${standardDuration} menit (standar ${machine.jenis_mesin})`
          isAvailable = false
        }
      }

      return {
        id_mesin: machine.id_mesin,
        nomor_mesin: machine.nomor_mesin,
        jenis_mesin: machine.jenis_mesin,
        status_text: statusText,
        estimasi_text: estimasiText,
        is_available: isAvailable,
        service_name: machine.nama_layanan,
        transaction_code: machine.kode_transaksi
      }
    })

    // 5. Group by machine type
    const cuciMachines = formattedMachines.filter(m => m.jenis_mesin === 'cuci')
    const pengeringMachines = formattedMachines.filter(m => m.jenis_mesin === 'pengering')

    // 6. Calculate summary
    const summary = {
      total_cuci: cuciMachines.length,
      available_cuci: cuciMachines.filter(m => m.is_available).length,
      total_pengering: pengeringMachines.length,
      available_pengering: pengeringMachines.filter(m => m.is_available).length
    }

    // 7. Get today's transactions for activity display
    const todayTransactions = await query(`
      SELECT 
        t.kode_transaksi,
        t.status_transaksi,
        t.tanggal_transaksi,
        t.id_pelanggan,
        -- Services summary
        GROUP_CONCAT(jl.nama_layanan ORDER BY jl.nama_layanan SEPARATOR ', ') as services,
        COUNT(dtl.id_detail_layanan) as service_count,
        -- Anonymous customer
        CONCAT(LEFT(p.nama_pelanggan, 1), '***') as customer_display,
        -- Flag if this is the requesting customer's transaction
        CASE WHEN p.nomor_telepon = ? THEN true ELSE false END as is_own_transaction
      FROM transaksi t
      JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
      JOIN detail_transaksi_layanan dtl ON t.id_transaksi = dtl.id_transaksi
      JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
      WHERE t.id_cabang = ?
        AND DATE(t.tanggal_transaksi) = CURDATE()
      GROUP BY t.id_transaksi
      ORDER BY t.tanggal_transaksi DESC
      LIMIT 20
    `, [sanitizedPhone, cabang_id], 'customer')

    // 8. Log successful machine status check
    logSecurityEvent('MACHINE_STATUS_SUCCESS', {
      customerId: customerCheck[0].id_pelanggan,
      phone: sanitizedPhone.substring(0, 5) + '***',
      cabang_id: cabang_id,
      totalMachines: cuciMachines.length + pengeringMachines.length,
      userAgent
    }, clientIP)

    // 9. Sanitize output data
    const sanitizedCustomer = {
      id_pelanggan: customerCheck[0].id_pelanggan,
      nama_pelanggan: sanitizeInput(customerCheck[0].nama_pelanggan),
      total_transactions: customerCheck[0].total_transactions
    }

    const sanitizedBranch = {
      nama_cabang: sanitizeInput(branchInfo[0].nama_cabang),
      alamat: sanitizeInput(branchInfo[0].alamat)
    }

    return NextResponse.json({
      success: true,
      customer: sanitizedCustomer,
      branch: sanitizedBranch,
      machines: {
        cuci: cuciMachines,
        pengering: pengeringMachines
      },
      summary,
      // NEW: Today's transaction list
      transactions: todayTransactions.map(t => ({
        kode: sanitizeInput(t.kode_transaksi),
        customer: sanitizeInput(t.customer_display),
        services: sanitizeInput(t.services),
        status: sanitizeInput(t.status_transaksi),
        is_own_transaction: t.is_own_transaction,
        time: (() => {
          const date = new Date(t.tanggal_transaksi);
          // Force WIB timezone (+7 hours from UTC)
          const wibTime = new Date(date.getTime() + (7 * 60 * 60 * 1000));
          const hours = wibTime.getUTCHours().toString().padStart(2, '0');
          const minutes = wibTime.getUTCMinutes().toString().padStart(2, '0');
          return `${hours}.${minutes}`;
        })(),
        transaction_date: new Date(t.tanggal_transaksi).toISOString()
      })),
      last_updated: new Date().toISOString(),
      message: 'Status mesin berhasil diambil'
    })

  } catch (error) {
    console.error('Machine status API error:', error)
    
    logSecurityEvent('MACHINE_STATUS_API_ERROR', {
      error: error.message,
      stack: error.stack?.substring(0, 200),
      userAgent,
      ip: clientIP
    }, clientIP)
    
    return NextResponse.json({
      error: 'Gagal mengambil status mesin',
      message: 'Terjadi kesalahan sistem. Silakan coba lagi.',
      // Remove debug info in production for security
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}