import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { 
  validatePhoneNumber, 
  checkRateLimit, 
  logSecurityEvent 
} from '@/lib/security'

// Get client IP
function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIp) return realIp.trim()
  return '127.0.0.1'
}

/**
 * Validate customer phone number - real-time check
 * Public endpoint for customer validation
 */
export async function POST(request) {
  const clientIP = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'Unknown'
  
  // Using customer pool via parameter
  
  try {
    // Rate limiting - 10 requests per minute per IP
    const rateLimit = checkRateLimit(`customer-validate-${clientIP}`, 60000, 10)
    
    if (!rateLimit.allowed) {
      logSecurityEvent('CUSTOMER_VALIDATE_RATE_LIMIT', {
        ip: clientIP,
        userAgent,
        requests_count: rateLimit.count
      }, clientIP)
      
      return NextResponse.json({
        success: false,
        error: 'Terlalu banyak permintaan. Tunggu sebentar.',
        retryAfter: 60
      }, {
        status: 429,
        headers: {
          'Retry-After': '60'
        }
      })
    }

    const { phone } = await request.json()

    // Basic validation
    if (!phone) {
      return NextResponse.json({
        success: false,
        error: 'Nomor HP wajib diisi'
      }, { status: 400 })
    }

    // Use security validation with normalization
    const phoneValidation = validatePhoneNumber(phone)
    
    if (!phoneValidation.isValid) {
      return NextResponse.json({
        success: false,
        error: phoneValidation.error,
        code: 'INVALID_FORMAT'
      }, { status: 400 })
    }

    const normalizedPhone = phoneValidation.sanitized

    // Check if phone number is registered in database - GET ALL CUSTOMERS with this phone
    const customerCheck = await query(`
      SELECT
        p.id_pelanggan,
        p.nama_pelanggan,
        p.nomor_telepon,
        p.id_cabang,
        c.nama_cabang,
        c.alamat
      FROM pelanggan p
      LEFT JOIN cabang c ON p.id_cabang = c.id_cabang
      WHERE p.nomor_telepon = ? AND p.status_aktif = 'aktif'
    `, [normalizedPhone], 'customer')

    if (customerCheck.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nomor HP tidak terdaftar. Silakan daftar terlebih dahulu atau hubungi kasir untuk registrasi.',
        code: 'CUSTOMER_NOT_FOUND'
      }, { status: 404 })
    }

    // Get all customer IDs with this phone
    const customerIds = customerCheck.map(c => c.id_pelanggan)

    // Get visited branches from recent transaction history for ALL customers with this phone
    // (completed in 10 days OR pending today)
    const visitedBranches = await query(`
      SELECT DISTINCT
        p.id_pelanggan,
        p.nama_pelanggan,
        c.id_cabang,
        c.nama_cabang,
        c.alamat,
        MAX(t.tanggal_transaksi) as last_visit,
        COUNT(t.id_transaksi) as total_transactions,
        SUM(CASE WHEN t.status_transaksi = 'pending' AND DATE(t.tanggal_transaksi) = CURDATE() THEN 1 ELSE 0 END) as active_transactions
      FROM pelanggan p
      JOIN transaksi t ON p.id_pelanggan = t.id_pelanggan
      JOIN cabang c ON p.id_cabang = c.id_cabang
      WHERE p.id_pelanggan IN (${customerIds.map(() => '?').join(',')})
        AND (
          (t.status_transaksi = 'selesai' AND DATE(t.tanggal_transaksi) >= DATE_SUB(NOW(), INTERVAL 10 DAY))
          OR
          (t.status_transaksi = 'pending' AND DATE(t.tanggal_transaksi) = CURDATE())
        )
      GROUP BY p.id_pelanggan, c.id_cabang, c.nama_cabang, c.alamat
      ORDER BY last_visit DESC, active_transactions DESC
    `, customerIds, 'customer')

    return NextResponse.json({
      success: true,
      customer: {
        nama_pelanggan: customerCheck[0].nama_pelanggan,
        nomor_telepon: customerCheck[0].nomor_telepon
      },
      visited_branches: visitedBranches,
      last_visited_branch: visitedBranches.length > 0 ? visitedBranches[0] : null,
      message: `Halo ${customerCheck[0].nama_pelanggan}! Nomor HP terverifikasi`
    })

  } catch (error) {
    console.error('Customer validation API error:', error)
    
    logSecurityEvent('CUSTOMER_VALIDATE_API_ERROR', {
      error: error.message,
      stack: error.stack?.substring(0, 200),
      userAgent
    }, clientIP)
    
    return NextResponse.json({
      success: false,
      error: 'Terjadi kesalahan sistem',
      message: 'Silakan coba lagi dalam beberapa saat'
    }, { status: 500 })
  }
}