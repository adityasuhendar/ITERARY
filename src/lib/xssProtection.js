// XSS Protection utilities

// Sanitize input by removing dangerous patterns and escaping HTML
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input
  
  // Remove dangerous JavaScript patterns
  let sanitized = input
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove data: URLs with potential JS
    .replace(/data:.*,.*script/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=/gi, '')
    // Remove script tags content (case insensitive)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove expression() CSS
    .replace(/expression\s*\(/gi, '')
    // Remove vbscript: protocol
    .replace(/vbscript:/gi, '')
    // Remove eval() calls
    .replace(/eval\s*\(/gi, '')
  
  // Escape HTML characters
  return sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

// Sanitize output for display - comprehensive XSS prevention
export function sanitizeOutput(output) {
  if (typeof output !== 'string') return output
  
  // Apply same sanitization as input for consistency and safety
  return sanitizeInput(output)
}

// Validate username - alphanumeric, underscore, dot only
export function validateUsername(username) {
  if (typeof username !== 'string') return false
  if (username.length < 3 || username.length > 50) return false
  return /^[a-zA-Z0-9._]+$/.test(username)
}

// Validate password - basic checks
export function validatePassword(password) {
  if (typeof password !== 'string') return false
  if (password.length < 6 || password.length > 100) return false
  return true
}