import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth'
import { sanitizeInput, validateUsername, validatePassword } from '@/lib/xssProtection'
import { checkRateLimit, logSecurityEvent } from '@/lib/security'

// Get client IP helper
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
    // AGGRESSIVE Rate limiting - 5 attempts per 5 minutes per IP
    const strictRateLimit = checkRateLimit(`login-strict-${clientIP}`, 300000, 5)
    
    if (!strictRateLimit.allowed) {
      logSecurityEvent('LOGIN_AGGRESSIVE_RATE_LIMIT', {
        ip: clientIP,
        userAgent,
        attempts: 'exceeded_strict'
      }, clientIP)
      
      return NextResponse.json({
        success: false,
        message: 'Terlalu banyak percobaan. Tunggu 5 menit.'
      }, {
        status: 429,
        headers: {
          'Retry-After': '300'
        }
      })
    }

    // MODERATE Rate limiting - 10 attempts per 15 minutes per IP  
    const moderateRateLimit = checkRateLimit(`login-moderate-${clientIP}`, 900000, 10)
    
    if (!moderateRateLimit.allowed) {
      logSecurityEvent('LOGIN_MODERATE_RATE_LIMIT', {
        ip: clientIP,
        userAgent,
        attempts: 'exceeded_moderate'
      }, clientIP)
      
      return NextResponse.json({
        success: false,
        message: 'Terlalu banyak percobaan. Tunggu 15 menit.'
      }, {
        status: 429,
        headers: {
          'Retry-After': '900'
        }
      })
    }

    const { username, password, rememberMe } = await request.json()

    if (!username || !password) {
      logSecurityEvent('LOGIN_MISSING_CREDENTIALS', {
        ip: clientIP,
        userAgent
      }, clientIP)
      
      return NextResponse.json(
        { success: false, message: 'Login gagal' },
        { status: 400 }
      )
    }

    // Server-side input sanitization and validation
    const sanitizedUsername = sanitizeInput(username.trim())
    const sanitizedPassword = sanitizeInput(password)

    if (!validateUsername(sanitizedUsername)) {
      logSecurityEvent('LOGIN_INVALID_USERNAME_FORMAT', {
        username: sanitizedUsername.substring(0, 3) + '***',
        ip: clientIP,
        userAgent
      }, clientIP)
      
      return NextResponse.json(
        { success: false, message: 'Login gagal' },
        { status: 400 }
      )
    }

    if (!validatePassword(sanitizedPassword)) {
      logSecurityEvent('LOGIN_INVALID_PASSWORD_FORMAT', {
        username: sanitizedUsername.substring(0, 3) + '***',
        ip: clientIP,
        userAgent
      }, clientIP)
      
      return NextResponse.json(
        { success: false, message: 'Login gagal' },
        { status: 400 }
      )
    }

    // Get staff access role from cookie
    const staffAccessRole = request.cookies.get('staff-access-role')?.value
    
    // Add delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const result = await authenticateUser(sanitizedUsername, sanitizedPassword, rememberMe)

    if (!result.success) {
      logSecurityEvent('LOGIN_FAILED', {
        username: sanitizedUsername.substring(0, 3) + '***',
        ip: clientIP,
        userAgent,
        reason: result.message || 'invalid_credentials'
      }, clientIP)
      
      // Calculate remaining attempts from already incremented counters above
      const remaining = Math.min(strictRateLimit.remaining || 0, moderateRateLimit.remaining || 0)
      
      // Specific error + remaining attempts
      let message = result.message || 'Login gagal'
      if (remaining > 0) {
        message += ` (${remaining} percobaan tersisa)`
      }
      
      return NextResponse.json({ 
        success: false, 
        message: message 
      }, { status: 401 })
    }

    // Role validation: Owner code = universal access, other codes = role specific
    if (staffAccessRole && 
        result.user.role !== staffAccessRole && 
        staffAccessRole.toLowerCase() !== 'owner') {
      
      logSecurityEvent('LOGIN_ROLE_MISMATCH', {
        username: sanitizedUsername.substring(0, 3) + '***',
        userRole: result.user.role,
        requiredRole: staffAccessRole,
        ip: clientIP,
        userAgent
      }, clientIP)
      
      return NextResponse.json({
        success: false,
        message: 'Login gagal'
      }, { status: 401 })
    }

    // Log successful login
    logSecurityEvent('LOGIN_SUCCESS', {
      username: sanitizedUsername.substring(0, 3) + '***',
      userRole: result.user.role,
      ip: clientIP,
      userAgent
    }, clientIP)

    // Set HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      user: result.user
    })

    // Set cookie duration based on rememberMe
    const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60 // 30 days vs 24 hours
    
    response.cookies.set('auth-token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: cookieMaxAge
    })

    return response

  } catch (error) {
    console.error('Login API error:', error)
    
    logSecurityEvent('LOGIN_ERROR', {
      error: error.message,
      ip: clientIP,
      userAgent
    }, clientIP)
    
    return NextResponse.json(
      { success: false, message: 'Login gagal' },
      { status: 500 }
    )
  }
}

// Logout endpoint - Clear all session data
export async function DELETE() {
  const response = NextResponse.json({ 
    success: true, 
    message: 'Logged out successfully' 
  })
  
  // Clear auth token
  response.cookies.delete('auth-token')
  
  // Clear any other cookies that might exist (EXCEPT staff-access to avoid re-entering access code)
  // response.cookies.delete('staff-access-granted') // PRESERVED for easier re-login
  // response.cookies.delete('staff-access-role') // PRESERVED for easier re-login
  response.cookies.delete('next_hmr_refresh_hash__')
  
  // Set additional cookie clearing headers
  response.cookies.set('auth-token', '', {
    expires: new Date(0),
    path: '/',
  })
  
  // Don't clear staff-access cookies to avoid re-entering access code
  // response.cookies.set('staff-access-granted', '', {
  //   expires: new Date(0),
  //   path: '/',
  // })

  // response.cookies.set('staff-access-role', '', {
  //   expires: new Date(0),
  //   path: '/',
  // })
  
  return response
}