import { NextResponse } from 'next/server'
import { 
  sanitizeInput, 
  validateStaffCode, 
  checkRateLimit, 
  logSecurityEvent,
  generateCSRFToken 
} from '@/lib/security'
import { query } from '@/lib/database'

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
    // Rate limiting - only 5 attempts per 10 minutes per IP
    const rateLimit = checkRateLimit(`staff-access-${clientIP}`, 600000, 5)
    
    if (!rateLimit.allowed) {
      logSecurityEvent('STAFF_ACCESS_RATE_LIMIT', {
        ip: clientIP,
        userAgent,
        attempts: 'exceeded'
      }, clientIP)
      
      return NextResponse.json({
        success: false,
        error: 'Terlalu banyak percobaan. Coba lagi dalam 10 menit.',
        retryAfter: 600
      }, {
        status: 429,
        headers: {
          'Retry-After': '600'
        }
      })
    }
    
    const body = await request.json()
    const { accessCode, csrfToken } = body
    
    // Validate and sanitize input
    const validation = validateStaffCode(accessCode)
    
    if (!validation.isValid) {
      logSecurityEvent('STAFF_ACCESS_INVALID_INPUT', {
        error: validation.error,
        sanitized: validation.sanitized
      }, clientIP)
      
      return NextResponse.json({
        success: false,
        error: validation.error
      }, { status: 400 })
    }
    
    const sanitizedCode = validation.sanitized
    
    // Additional database-level validation
    if (sanitizedCode.length > 50 || sanitizedCode.length < 1) {
      logSecurityEvent('STAFF_ACCESS_INVALID_LENGTH', {
        length: sanitizedCode.length,
        userAgent
      }, clientIP)
      
      return NextResponse.json({
        success: false,
        error: 'Format kode akses tidak valid'
      }, { status: 400 })
    }
    
    // Security: Log all attempts
    logSecurityEvent('STAFF_ACCESS_ATTEMPT', {
      code: sanitizedCode.substring(0, 3) + '***', // Partial logging for security
      userAgent
    }, clientIP)
    
    // Check against database staff codes
    try {
      const codeResults = await query(`
        SELECT id, access_code, allowed_role, description
        FROM staff_access_codes 
        WHERE access_code = ? AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
      `, [sanitizedCode], 'internal')
    
      if (codeResults.length === 0) {
      // Security: Log failed attempts
      logSecurityEvent('STAFF_ACCESS_FAILED', {
        attemptedCode: sanitizedCode.substring(0, 3) + '***',
        userAgent
      }, clientIP)
      
      // Get remaining attempts from rate limit check done earlier
      const remaining = rateLimit.remaining || 0
      
      // Add remaining attempts to error message
      let errorMessage = 'Kode akses tidak valid'
      if (remaining > 0) {
        errorMessage += ` (${remaining} percobaan tersisa)`
      }
      
      // Introduce delay for failed attempts to prevent brute force
      await new Promise(resolve => setTimeout(resolve, 2000))
      
        return NextResponse.json({
          success: false,
          error: errorMessage
        }, { status: 401 })
      }
      
      const accessCode = codeResults[0]
      
      // Update usage tracking
      await query(`
        UPDATE staff_access_codes 
        SET last_used_at = NOW(), usage_count = usage_count + 1
        WHERE id = ?
      `, [accessCode.id], 'internal')
      
      // Success - log and set cookie
      logSecurityEvent('STAFF_ACCESS_SUCCESS', {
        code: sanitizedCode.substring(0, 3) + '***',
        role: accessCode.allowed_role,
        userAgent
      }, clientIP)
      
      const response = NextResponse.json({
        success: true,
        message: 'Akses berhasil'
      })
      
      // Set secure cookie with limited lifetime (8 hours)
      response.cookies.set('staff-access-granted', 'true', {
        httpOnly: false, // Needs to be readable by client for navigation
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 28800, // 8 hours
        path: '/'
      })
      
      // Set allowed role cookie for login validation
      response.cookies.set('staff-access-role', accessCode.allowed_role, {
        httpOnly: true, // Server-only for security
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 28800, // 8 hours, same as access cookie
        path: '/'
      })
      
      return response
    
    } catch (dbError) {
      console.error('Database error in staff access:', dbError)
      
      logSecurityEvent('STAFF_ACCESS_DB_ERROR', {
        error: dbError.message,
        userAgent
      }, clientIP)
      
      return NextResponse.json({
        success: false,
        error: 'Terjadi kesalahan sistem'
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('Staff access API error:', error)
    
    logSecurityEvent('STAFF_ACCESS_ERROR', {
      error: error.message,
      userAgent
    }, clientIP)
    
    return NextResponse.json({
      success: false,
      error: 'Terjadi kesalahan sistem'
    }, { status: 500 })
  }
}