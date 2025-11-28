import { useState, useEffect } from 'react'

// Global cache for CSRF token to prevent multiple API calls
let globalCSRFCache = {
  token: null,
  timestamp: 0,
  ttl: 3600000 // 1 hour cache
}

/**
 * Custom hook for CSRF token management
 * @returns {Object} - { csrfToken, loading, error, refreshToken }
 */
export function useCSRF() {
  const [csrfToken, setCsrfToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCSRFToken = async (skipCacheCheck = false) => {
    try {
      setLoading(true)
      setError(null)
      
      // Check global cache first
      const now = Date.now()
      if (!skipCacheCheck && globalCSRFCache.token && (now - globalCSRFCache.timestamp < globalCSRFCache.ttl)) {
        console.log('🔒 Using cached CSRF token')
        setCsrfToken(globalCSRFCache.token)
        setLoading(false)
        return
      }
      
      // Check if we already have a token in cookies (from preload) - unless forced skip
      if (!skipCacheCheck) {
        const response = await fetch('/api/csrf-token', {
          credentials: 'include'
        })
        
        if (response.ok) {
          const data = await response.json()
          // Store in global cache
          globalCSRFCache = {
            token: data.csrfToken,
            timestamp: now,
            ttl: 3600000
          }
          setCsrfToken(data.csrfToken)
          setLoading(false)
          return
        }
      }
      
      // Fallback to fresh fetch
      const response = await fetch('/api/csrf-token', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        // Store in global cache
        globalCSRFCache = {
          token: data.csrfToken,
          timestamp: now,
          ttl: 3600000
        }
        setCsrfToken(data.csrfToken)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to get CSRF token')
      }
    } catch (err) {
      console.error('CSRF token fetch error:', err)
      console.error('Error details:', {
        message: err.message,
        name: err.name,
        stack: err.stack
      })
      setError(`Network error while fetching CSRF token: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Fetch token on mount
  useEffect(() => {
    fetchCSRFToken()
  }, [])

  return {
    csrfToken,
    loading,
    error,
    refreshToken: fetchCSRFToken
  }
}

/**
 * Enhanced fetch wrapper with CSRF protection
 * @param {string} url - API endpoint
 * @param {Object} options - fetch options
 * @param {string} csrfToken - CSRF token
 * @returns {Promise} - fetch promise with CSRF headers
 */
export function fetchWithCSRF(url, options = {}, csrfToken) {
  const method = options.method || 'GET'
  
  // Add CSRF token for non-safe methods
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
    if (!csrfToken) {
      throw new Error('CSRF token required for this request')
    }
    
    options.headers = {
      ...options.headers,
      'X-CSRF-Token': csrfToken
    }
  }
  
  return fetch(url, options)
}

/**
 * React component wrapper for CSRF-protected forms
 */
export function CSRFProtectedForm({ children, onSubmit, ...props }) {
  const { csrfToken, loading, error } = useCSRF()
  
  const handleSubmit = (e) => {
    if (!csrfToken) {
      e.preventDefault()
      alert('Security token not available. Please refresh the page.')
      return
    }
    
    if (onSubmit) {
      onSubmit(e, csrfToken)
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-sm text-gray-600">Loading ...</span>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
        <p className="text-red-800 text-sm">Security Error: {error}</p>
      </div>
    )
  }
  
  return (
    <form {...props} onSubmit={handleSubmit}>
      {children}
    </form>
  )
}