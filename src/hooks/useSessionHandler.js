"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function useSessionHandler() {
  const [sessionExpired, setSessionExpired] = useState(false)
  const router = useRouter()

  const handleApiResponse = async (response) => {
    // Check if response indicates session expiration
    if (response.status === 401 || response.status === 403) {
      try {
        const data = await response.json()
        
        // Check for token expired specifically
        if (data.expired === true || (data.error && (
          data.error.includes('Token expired') ||
          data.error.includes('token expired') ||
          data.error.includes('jwt expired') ||
          data.error.includes('Unauthorized') || 
          data.error.includes('Invalid token') ||
          data.error.includes('token')
        ))) {
          console.log('🔒 Session expired detected:', {
            status: response.status,
            error: data.error,
            expired: data.expired,
            expiredAt: data.expiredAt
          })
          setSessionExpired(true)
          return null
        }
      } catch (jsonError) {
        // If we can't parse JSON, still check for auth failure
        console.log('🔒 Auth check failed - could not parse response:', response.status)
        if (response.status === 401) {
          setSessionExpired(true)
          return null
        }
      }
    }
    
    return response
  }

  const handleApiError = (error) => {
    // Handle network errors or other API failures
    if (error.message && (
      error.message.includes('401') || 
      error.message.includes('403') ||
      error.message.includes('Unauthorized') ||
      error.message.includes('token')
    )) {
      setSessionExpired(true)
    }
    
    throw error
  }

  const clearSession = () => {
    // Clear all stored data
    localStorage.clear()
    sessionStorage.clear()
    
    // Clear cookies
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    })
  }

  const redirectToLogin = () => {
    clearSession()
    router.push('/login')
  }

  const redirectToHome = () => {
    clearSession()
    router.push('/')
  }

  return {
    sessionExpired,
    setSessionExpired,
    handleApiResponse,
    handleApiError,
    clearSession,
    redirectToLogin,
    redirectToHome
  }
}