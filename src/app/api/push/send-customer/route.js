import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { 
  sanitizeInput, 
  validatePhoneNumber, 
  checkRateLimit, 
  logSecurityEvent,
  validateSQLParam 
} from '@/lib/security'
import webpush from 'web-push'

// Configure web-push with VAPID details
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

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
  
  try {
    // Rate limiting - 10 requests per 5 minutes per IP (customer operations)
    const rateLimit = checkRateLimit(`customer-push-${clientIP}`, 300000, 10)
    
    if (!rateLimit.allowed) {
      logSecurityEvent('CUSTOMER_PUSH_RATE_LIMIT', {
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
    const { phone_number, cabang_id, notification } = body

    if (!phone_number || !cabang_id || !notification) {
      return NextResponse.json({ 
        error: 'Phone number, cabang_id, dan notification diperlukan' 
      }, { status: 400 })
    }

    // Validate phone number
    const phoneValidation = validatePhoneNumber(phone_number)
    
    if (!phoneValidation.isValid) {
      logSecurityEvent('CUSTOMER_PUSH_INVALID_PHONE', {
        error: phoneValidation.error,
        sanitized: phoneValidation.sanitized
      }, clientIP)
      
      return NextResponse.json({ 
        error: phoneValidation.error 
      }, { status: 400 })
    }

    const sanitizedPhone = phoneValidation.sanitized
    
    // SQL injection protection
    const sqlValidation = validateSQLParam(sanitizedPhone, 'string')
    if (!sqlValidation.isValid) {
      logSecurityEvent('CUSTOMER_PUSH_SQL_INJECTION_ATTEMPT', {
        phone: sanitizedPhone.substring(0, 5) + '***',
        error: sqlValidation.error
      }, clientIP)
      
      return NextResponse.json({ 
        error: 'Format nomor telepon tidak valid' 
      }, { status: 400 })
    }

    // Validate cabang_id
    const cabangValidation = validateSQLParam(cabang_id, 'number')
    if (!cabangValidation.isValid) {
      return NextResponse.json({ 
        error: 'Cabang ID tidak valid' 
      }, { status: 400 })
    }

    // Log notification attempt
    logSecurityEvent('CUSTOMER_PUSH_ATTEMPT', {
      phone: sanitizedPhone.substring(0, 5) + '***',
      cabang_id: cabang_id,
      title: notification.title?.substring(0, 50) || 'No title'
    }, clientIP)

    // Find customer subscriptions by phone + branch (using customer pool)
    const subscriptions = await query(`
      SELECT ps.endpoint, ps.p256dh_key, ps.auth_key, ps.id_pelanggan, p.nama_pelanggan
      FROM push_subscriptions ps
      LEFT JOIN pelanggan p ON ps.id_pelanggan = p.id_pelanggan
      WHERE ps.user_type = 'customer' 
      AND ps.phone_number = ? 
      AND ps.id_cabang = ?
    `, [sanitizedPhone, cabang_id], 'customer')

    if (subscriptions.length === 0) {
      // Try alternative lookup by id_pelanggan (legacy subscriptions)
      const customer = await query(`
        SELECT id_pelanggan FROM pelanggan 
        WHERE nomor_telepon = ? AND status_aktif = 'aktif'
      `, [sanitizedPhone], 'customer')

      if (customer.length > 0) {
        const altSubscriptions = await query(`
          SELECT endpoint, p256dh_key, auth_key, id_pelanggan
          FROM push_subscriptions 
          WHERE user_type = 'customer' 
          AND id_pelanggan = ? 
          AND id_cabang = ?
        `, [customer[0].id_pelanggan, cabang_id], 'customer')

        if (altSubscriptions.length === 0) {
          return NextResponse.json({ 
            success: true,
            message: 'Customer tidak memiliki subscription push notification',
            sent: 0
          })
        }
        subscriptions.push(...altSubscriptions)
      } else {
        return NextResponse.json({ 
          success: true,
          message: 'Customer tidak ditemukan atau tidak memiliki subscription',
          sent: 0
        })
      }
    }

    // Send push notifications
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key
          }
        }

        const payload = JSON.stringify({
          title: notification.title,
          body: notification.body,
          icon: notification.icon || '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          tag: notification.tag || 'dwash-customer-notification',
          data: {
            url: notification.url || '/',
            timestamp: Date.now(),
            phone: sanitizedPhone.substring(0, 5) + '***', // Masked for privacy
            ...notification.data
          },
          actions: notification.actions || []
        })

        await webpush.sendNotification(pushSubscription, payload)
        return { success: true, customerId: sub.id_pelanggan || 'anonymous' }
      } catch (error) {
        console.error(`Failed to send push to customer ${sub.id_pelanggan}:`, error)
        
        // Remove invalid subscriptions (410 Gone)
        if (error.statusCode === 410) {
          try {
            await query(`
              DELETE FROM push_subscriptions 
              WHERE endpoint = ?
            `, [sub.endpoint], 'customer')
            console.log('Removed invalid customer subscription:', sub.endpoint.substring(0, 50) + '...')
          } catch (dbError) {
            console.error('Failed to remove invalid customer subscription:', dbError)
          }
        }
        
        return { success: false, customerId: sub.id_pelanggan || 'anonymous', error: error.message }
      }
    })

    const results = await Promise.allSettled(sendPromises)
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - successful

    // Log successful notification
    logSecurityEvent('CUSTOMER_PUSH_SUCCESS', {
      phone: sanitizedPhone.substring(0, 5) + '***',
      sent: successful,
      failed: failed,
      total: results.length
    }, clientIP)

    return NextResponse.json({
      success: true,
      message: `Customer push notifications sent`,
      sent: successful,
      failed: failed,
      total: results.length
    })

  } catch (error) {
    console.error('Customer push send error:', error)
    
    logSecurityEvent('CUSTOMER_PUSH_ERROR', {
      error: error.message,
      stack: error.stack?.substring(0, 200),
      userAgent
    }, clientIP)
    
    return NextResponse.json({
      error: 'Failed to send customer push notifications',
      message: error.message
    }, { status: 500 })
  }
}