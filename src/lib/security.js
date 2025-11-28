// Security utilities for input validation and sanitization

/**
 * Sanitize string input to prevent XSS attacks
 * @param {string} input - Raw user input
 * @returns {string} - Sanitized input
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return String(input || '')
  }
  
  // Remove script tags and dangerous HTML
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/expression\s*\(/gi, '')
    .trim()
}

/**
 * Escape HTML entities to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - HTML escaped text
 */
export function escapeHtml(text) {
  if (typeof text !== 'string') {
    return String(text || '')
  }
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  }
  
  return String(text).replace(/[&<>"'`=\/]/g, function (s) {
    return map[s]
  })
}

/**
 * Validate and sanitize transaction code
 * @param {string} code - Transaction code input
 * @returns {object} - Validation result
 */
export function validateTransactionCode(code) {
  const sanitized = sanitizeInput(code)
  
  // Transaction code pattern: 2 letters + 6 digits + 3 digits (e.g., TA2507190001)
  const pattern = /^[A-Z]{2}\d{6}\d{3}$/
  
  if (!sanitized || sanitized.length === 0) {
    return {
      isValid: false,
      sanitized: '',
      error: 'Kode transaksi tidak boleh kosong'
    }
  }
  
  if (sanitized.length > 20) {
    return {
      isValid: false,
      sanitized: sanitized.substring(0, 20),
      error: 'Kode transaksi terlalu panjang (maksimal 20 karakter)'
    }
  }
  
  if (!pattern.test(sanitized.toUpperCase())) {
    return {
      isValid: false,
      sanitized: sanitized.toUpperCase(),
      error: 'Format kode transaksi tidak valid'
    }
  }
  
  return {
    isValid: true,
    sanitized: sanitized.toUpperCase(),
    error: null
  }
}

/**
 * Validate and sanitize phone number
 * @param {string} phone - Phone number input
 * @returns {object} - Validation result with database format
 */
export function validatePhoneNumber(phone) {
  const cleanDigits = sanitizeInput(phone).replace(/\D/g, '') // Remove all non-digits (spasi, +, -, dll)
  
  if (!cleanDigits || cleanDigits.length === 0) {
    return {
      isValid: false,
      sanitized: '',
      error: 'Nomor telepon tidak boleh kosong'
    }
  }
  
  // Normalize to database format (08xxx)
  let normalized
  if (cleanDigits.startsWith('62')) {
    // 6285842816810 → 085842816810
    normalized = '0' + cleanDigits.substring(2)
  } else if (cleanDigits.startsWith('0')) {
    // 085842816810 → 085842816810 (already correct)
    normalized = cleanDigits
  } else if (cleanDigits.length >= 9) {
    // 85842816810 → 085842816810 (assume local number)
    normalized = '0' + cleanDigits
  } else {
    normalized = cleanDigits
  }
  
  // Indonesian phone number validation
  if (normalized.length < 10 || normalized.length > 15) {
    return {
      isValid: false,
      sanitized: normalized,
      error: 'Nomor telepon harus 10-15 digit'
    }
  }
  
  // Must start with 08 after normalization
  if (!normalized.startsWith('08')) {
    return {
      isValid: false,
      sanitized: normalized,
      error: 'Format nomor telepon tidak valid'
    }
  }
  
  return {
    isValid: true,
    sanitized: normalized, // Return database format (08xxx)
    error: null
  }
}

/**
 * Validate and sanitize staff access code
 * @param {string} code - Staff access code
 * @returns {object} - Validation result
 */
export function validateStaffCode(code) {
  const sanitized = sanitizeInput(code)

  if (!sanitized || sanitized.length === 0) {
    return {
      isValid: false,
      sanitized: '',
      error: 'Kode akses tidak boleh kosong'
    }
  }

  if (sanitized.length > 50) {
    return {
      isValid: false,
      sanitized: sanitized.substring(0, 50),
      error: 'Kode akses terlalu panjang'
    }
  }

  // Only allow alphanumeric and underscore
  if (!/^[a-zA-Z0-9_]+$/.test(sanitized)) {
    return {
      isValid: false,
      sanitized: sanitized,
      error: 'Kode akses tidak valid'
    }
  }

  return {
    isValid: true,
    sanitized: sanitized,
    error: null
  }
}

/**
 * Generate CSRF token
 * @returns {string} - CSRF token
 */
export function generateCSRFToken() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Rate limiting helper
 * @param {string} identifier - IP or user identifier
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} maxRequests - Maximum requests per window
 * @returns {object} - Rate limit status
 */
const rateLimitStore = new Map()

export function checkRateLimit(identifier, windowMs = 60000, maxRequests = 10) {
  const now = Date.now()
  const key = identifier
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }
  
  const record = rateLimitStore.get(key)
  
  if (now > record.resetTime) {
    // Reset window
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }
  
  if (record.count >= maxRequests) {
    return { 
      allowed: false, 
      remaining: 0,
      resetTime: record.resetTime 
    }
  }
  
  record.count++
  return { 
    allowed: true, 
    remaining: maxRequests - record.count 
  }
}

/**
 * SQL Injection protection - validate parameters
 * @param {any} value - Value to validate
 * @param {string} type - Expected type (string, number, email, etc.)
 * @returns {object} - Validation result
 */
export function validateSQLParam(value, type = 'string') {
  if (value === null || value === undefined) {
    return { isValid: true, sanitized: null }
  }
  
  switch (type) {
    case 'number':
      const num = Number(value)
      if (isNaN(num)) {
        return { isValid: false, error: 'Invalid number format' }
      }
      return { isValid: true, sanitized: num }
      
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const sanitizedEmail = sanitizeInput(String(value))
      if (!emailRegex.test(sanitizedEmail)) {
        return { isValid: false, error: 'Invalid email format' }
      }
      return { isValid: true, sanitized: sanitizedEmail }
      
    case 'string':
    default:
      const sanitizedString = sanitizeInput(String(value))
      if (sanitizedString.length > 1000) { // Reasonable limit
        return { isValid: false, error: 'String too long' }
      }
      return { isValid: true, sanitized: sanitizedString }
  }
}

/**
 * Get client IP address from request
 * @param {Request} request - Next.js request object
 * @returns {string} - Client IP address
 */
export function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIp) return realIp.trim()
  return '127.0.0.1'
}

/**
 * Log security events
 * @param {string} event - Event type
 * @param {object} details - Event details
 * @param {string} ip - Client IP
 */
export function logSecurityEvent(event, details, ip) {
  const timestamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z'
  console.warn(`[SECURITY] ${timestamp} - ${event}`, {
    ip,
    details,
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'Server'
  })
}