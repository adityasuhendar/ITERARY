import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

// Edge runtime compatible token verification
async function verifyTokenEdge(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch (error) {
    console.log('Edge token verification failed:', error.message)
    return null
  }
}

// Get client IP address
function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  if (realIp) {
    return realIp.trim()
  }
  if (cfConnectingIp) {
    return cfConnectingIp.trim()
  }
  
  return '127.0.0.1'
}

// Simple rate limiting for edge runtime
const rateLimitStore = new Map()

function checkRateLimit(identifier, windowMs = 60000, maxRequests = 15) {
  const now = Date.now()
  
  if (!rateLimitStore.has(identifier)) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }
  
  const record = rateLimitStore.get(identifier)
  
  if (now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }
  
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime }
  }
  
  record.count++
  return { allowed: true, remaining: maxRequests - record.count }
}

export async function middleware(request) {
  const token = request.cookies.get('auth-token')?.value
  const accessGranted = request.cookies.get('staff-access-granted')?.value
  const clientIP = getClientIP(request)
  const pathname = request.nextUrl.pathname
  
  // Rate limiting for sensitive endpoints
  if (pathname === '/login' || pathname.startsWith('/api/')) {
    const rateLimit = checkRateLimit(clientIP, 60000, 15) // 15 requests per minute
    
    if (!rateLimit.allowed) {
      console.warn(`[SECURITY] Rate limit exceeded for IP: ${clientIP} on ${pathname}`)
      
      return new NextResponse('Too Many Requests - Please wait before trying again', {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': '15',
          'X-RateLimit-Remaining': '0'
        }
      })
    }
  }
  
  // Add security headers to all responses
  const response = NextResponse.next()
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "child-src 'none'",
    "worker-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'"
  ].join('; ')
  
  response.headers.set('Content-Security-Policy', csp)

  // Public routes that don't need authentication
  if (request.nextUrl.pathname === '/') {
    return response
  }

  // Staff login route - requires access code first (unless already authenticated)
  if (request.nextUrl.pathname === '/login') {
    // If user already has valid auth token, allow direct access to login page
    if (token) {
      const user = await verifyTokenEdge(token)
      if (user) {
        // For kasir, check if they need to complete attendance first
        if (user.jenis_karyawan === 'kasir') {
          // Don't redirect if attendance modal is still pending
          const attendanceComplete = request.cookies.get('attendance-complete')?.value
          if (!attendanceComplete) {
            console.log('Kasir needs to complete attendance modal, staying on login page')
            return response
          }
        }
        // Already authenticated, redirect to dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    
    // Check access code requirement for new login attempts
    if (!accessGranted || accessGranted !== 'true') {
      // Redirect to clean landing page
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/profile', '/help']
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )
  
  if (isProtectedRoute) {
    console.log('Protected route access attempt:', request.nextUrl.pathname, 'token:', token ? 'present' : 'not found')
    if (!token) {
      console.log('No token, redirecting to login')
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const user = await verifyTokenEdge(token)
    console.log('Token verification result:', user ? 'valid' : 'invalid')
    if (!user) {
      console.log('Invalid token, redirecting to login')
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('auth-token')
      return response
    }
    console.log('Protected route access granted for user:', user.username)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/login', '/dashboard/:path*', '/profile/:path*', '/help/:path*']
}