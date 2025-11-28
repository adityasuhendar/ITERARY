import jwt from 'jsonwebtoken'
import { NextResponse } from 'next/server'

/**
 * Safely verify JWT token with proper error handling
 * @param {string} token - JWT token to verify
 * @param {string} secret - JWT secret
 * @returns {object|null} - Decoded token or null if invalid/expired
 */
export function verifyToken(token, secret = process.env.JWT_SECRET) {
  try {
    return jwt.verify(token, secret)
  } catch (error) {
    console.log('JWT verification failed:', error.name, error.message)
    return null
  }
}

/**
 * Handle JWT verification and return appropriate error responses
 * @param {Request} request - Next.js request object
 * @param {array} allowedRoles - Array of allowed roles (optional)
 * @returns {object} - { decoded, errorResponse }
 */
export function handleJWTAuth(request, allowedRoles = null) {
  // Get token from cookie
  const token = request.cookies.get('auth-token')?.value
  if (!token) {
    return {
      decoded: null,
      errorResponse: NextResponse.json({ 
        error: 'Unauthorized - No token provided', 
        expired: true 
      }, { status: 401 })
    }
  }

  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET)
  } catch (jwtError) {
    if (jwtError.name === 'TokenExpiredError') {
      return {
        decoded: null,
        errorResponse: NextResponse.json({ 
          error: 'Token expired', 
          expired: true,
          expiredAt: jwtError.expiredAt 
        }, { status: 401 })
      }
    } else if (jwtError.name === 'JsonWebTokenError') {
      return {
        decoded: null,
        errorResponse: NextResponse.json({ 
          error: 'Invalid token format', 
          expired: true 
        }, { status: 401 })
      }
    } else {
      return {
        decoded: null,
        errorResponse: NextResponse.json({ 
          error: 'Token verification failed', 
          expired: true 
        }, { status: 401 })
      }
    }
  }
  
  if (!decoded) {
    return {
      decoded: null,
      errorResponse: NextResponse.json({ 
        error: 'Invalid token', 
        expired: true 
      }, { status: 401 })
    }
  }

  // Check role authorization if specified
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = decoded.role || decoded.jenis_karyawan

    // Simple role check - backup kasir is pure kasir, no hybrid access
    if (!allowedRoles.includes(userRole)) {
      return {
        decoded,
        errorResponse: NextResponse.json({
          error: `Access denied. Required roles: ${allowedRoles.join(', ')}`
        }, { status: 403 })
      }
    }
  }

  return {
    decoded,
    errorResponse: null
  }
}