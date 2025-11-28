// CSRF Protection utilities
import crypto from 'crypto'

/**
 * Generate CSRF token
 * @returns {string} - CSRF token
 */
export function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Validate CSRF token
 * @param {string} tokenFromRequest - Token from request (header/body)
 * @param {string} tokenFromSession - Token from session/cookie
 * @returns {boolean} - Token is valid
 */
export function validateCSRFToken(tokenFromRequest, tokenFromSession) {
  if (!tokenFromRequest || !tokenFromSession) {
    return false
  }
  
  // Use crypto.timingSafeEqual to prevent timing attacks
  try {
    const requestBuffer = Buffer.from(tokenFromRequest, 'hex')
    const sessionBuffer = Buffer.from(tokenFromSession, 'hex')
    
    if (requestBuffer.length !== sessionBuffer.length) {
      return false
    }
    
    return crypto.timingSafeEqual(requestBuffer, sessionBuffer)
  } catch (error) {
    console.error('CSRF token validation error:', error)
    return false
  }
}

/**
 * CSRF Middleware for API routes
 * @param {Request} request - Next.js request object
 * @returns {Object} - { isValid: boolean, csrfToken?: string, error?: string }
 */
export function checkCSRF(request) {
  const method = request.method
  
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { isValid: true }
  }
  
  // Get CSRF token from header or body
  const csrfFromHeader = request.headers.get('x-csrf-token')
  const csrfFromCookie = request.cookies.get('csrf-token')?.value
  
  if (!csrfFromCookie) {
    return { 
      isValid: false, 
      error: 'CSRF token missing from session',
      needsToken: true
    }
  }
  
  if (!csrfFromHeader) {
    return { 
      isValid: false, 
      error: 'CSRF token missing from request headers' 
    }
  }
  
  const isValid = validateCSRFToken(csrfFromHeader, csrfFromCookie)
  
  if (!isValid) {
    return { 
      isValid: false, 
      error: 'CSRF token validation failed' 
    }
  }
  
  return { isValid: true }
}

/**
 * Get CSRF token for client-side use
 * @param {Request} request - Next.js request object
 * @returns {string} - CSRF token (existing or newly generated)
 */
export function getCSRFToken(request) {
  const existingToken = request.cookies.get('csrf-token')?.value
  
  if (existingToken) {
    return existingToken
  }
  
  return generateCSRFToken()
}