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
  
  try {
    // Rate limiting - 5 requests per 10 minutes per IP (subscription is less frequent)
    const rateLimit = checkRateLimit(`customer-subscribe-${clientIP}`, 600000, 5)
    
    if (!rateLimit.allowed) {
      logSecurityEvent('CUSTOMER_SUBSCRIBE_RATE_LIMIT', {
        ip: clientIP,
        userAgent
      }, clientIP)
      
      return NextResponse.json({
        error: 'Terlalu banyak permintaan subscription. Coba lagi dalam 10 menit.',
        retryAfter: 600
      }, {
        status: 429,
        headers: {
          'Retry-After': '600'
        }
      })
    }

    const body = await request.json()
    const { subscription, phone_number, cabang_id } = body

    if (!subscription || !phone_number || !cabang_id) {
      return NextResponse.json({ 
        error: 'Subscription, phone number, dan cabang_id diperlukan' 
      }, { status: 400 })
    }

    // Validate phone number
    const phoneValidation = validatePhoneNumber(phone_number)
    
    if (!phoneValidation.isValid) {
      logSecurityEvent('CUSTOMER_SUBSCRIBE_INVALID_PHONE', {
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
      logSecurityEvent('CUSTOMER_SUBSCRIBE_SQL_INJECTION_ATTEMPT', {
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

    // Validate subscription object structure
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json({ 
        error: 'Invalid subscription object' 
      }, { status: 400 })
    }

    // Try to find customer by phone to get id_pelanggan (optional for better data integrity)
    let customerId = null
    try {
      const customer = await query(`
        SELECT id_pelanggan FROM pelanggan 
        WHERE nomor_telepon = ? AND status_aktif = 'aktif'
        LIMIT 1
      `, [sanitizedPhone], 'customer')
      
      if (customer.length > 0) {
        customerId = customer[0].id_pelanggan
      }
    } catch (error) {
      // Continue without id_pelanggan if customer lookup fails
      console.warn('Customer lookup failed for subscription:', error.message)
    }

    // Check if subscription already exists
    const existingSubscription = await query(`
      SELECT id FROM push_subscriptions 
      WHERE endpoint = ? 
      AND user_type = 'customer'
      LIMIT 1
    `, [subscription.endpoint], 'customer')

    if (existingSubscription.length > 0) {
      // Update existing subscription with new phone/branch info
      await query(`
        UPDATE push_subscriptions 
        SET phone_number = ?, 
            id_cabang = ?, 
            id_pelanggan = ?,
            updated_at = NOW()
        WHERE id = ?
      `, [sanitizedPhone, cabang_id, customerId, existingSubscription[0].id], 'customer')

      logSecurityEvent('CUSTOMER_SUBSCRIBE_UPDATED', {
        phone: sanitizedPhone.substring(0, 5) + '***',
        cabang_id: cabang_id,
        customer_id: customerId || 'anonymous',
        endpoint: subscription.endpoint.substring(0, 50) + '...'
      }, clientIP)

      return NextResponse.json({
        success: true,
        message: 'Subscription updated successfully'
      })
    }

    // Create new subscription
    await query(`
      INSERT INTO push_subscriptions 
      (user_type, id_pelanggan, phone_number, id_cabang, endpoint, p256dh_key, auth_key, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      'customer',
      customerId, // Can be null for anonymous customers
      sanitizedPhone,
      cabang_id,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth
    ], 'customer')

    // Log successful subscription
    logSecurityEvent('CUSTOMER_SUBSCRIBE_SUCCESS', {
      phone: sanitizedPhone.substring(0, 5) + '***',
      cabang_id: cabang_id,
      customer_id: customerId || 'anonymous',
      endpoint: subscription.endpoint.substring(0, 50) + '...'
    }, clientIP)

    return NextResponse.json({
      success: true,
      message: 'Customer push notification subscription created successfully'
    })

  } catch (error) {
    console.error('Customer subscribe error:', error)
    
    logSecurityEvent('CUSTOMER_SUBSCRIBE_ERROR', {
      error: error.message,
      stack: error.stack?.substring(0, 200),
      userAgent
    }, clientIP)
    
    return NextResponse.json({
      error: 'Failed to create customer subscription',
      message: error.message
    }, { status: 500 })
  }
}

export async function DELETE(request) {
  const clientIP = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'Unknown'
  
  try {
    const body = await request.json()
    const { endpoint, phone_number } = body

    if (!endpoint) {
      return NextResponse.json({ 
        error: 'Endpoint diperlukan untuk unsubscribe' 
      }, { status: 400 })
    }

    // Delete customer subscription
    const result = await query(`
      DELETE FROM push_subscriptions 
      WHERE endpoint = ? 
      AND user_type = 'customer'
      ${phone_number ? 'AND phone_number = ?' : ''}
      LIMIT 1
    `, phone_number ? [endpoint, phone_number] : [endpoint], 'customer')

    if (result.affectedRows > 0) {
      logSecurityEvent('CUSTOMER_UNSUBSCRIBE_SUCCESS', {
        phone: phone_number ? phone_number.substring(0, 5) + '***' : 'unknown',
        endpoint: endpoint.substring(0, 50) + '...'
      }, clientIP)

      return NextResponse.json({
        success: true,
        message: 'Customer push notification subscription removed'
      })
    } else {
      return NextResponse.json({
        success: true,
        message: 'Subscription not found or already removed'
      })
    }

  } catch (error) {
    console.error('Customer unsubscribe error:', error)
    
    logSecurityEvent('CUSTOMER_UNSUBSCRIBE_ERROR', {
      error: error.message,
      userAgent
    }, clientIP)
    
    return NextResponse.json({
      error: 'Failed to remove customer subscription',
      message: error.message
    }, { status: 500 })
  }
}