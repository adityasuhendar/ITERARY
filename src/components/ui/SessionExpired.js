"use client"
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Button from '@/components/ui/Button'

export default function SessionExpired({ 
  title = "Sesi Anda Telah Berakhir", 
  message = "Maaf, sesi login Anda sudah habis. Silakan login kembali untuk melanjutkan.",
  showAutoRedirect = true,
  autoRedirectDelay = 10
}) {
  const router = useRouter()

  const handleLoginRedirect = async () => {
    try {
      // 🧹 NUCLEAR CLEANUP - CLEAR EVERYTHING!

      // 1. Clear server-side sessions & CSRF
      await fetch('/api/auth', { method: 'DELETE' }).catch(() => {})
      await fetch('/api/csrf-token', { method: 'DELETE' }).catch(() => {})

      // 2. Clear ALL localStorage
      localStorage.clear()

      // 3. Clear ALL sessionStorage
      sessionStorage.clear()

      // 4. NUCLEAR COOKIE CLEARING - all domains & paths
      document.cookie.split(";").forEach(function(c) {
        const cookieName = c.split("=")[0].trim()
        // Clear for current domain & path
        document.cookie = cookieName + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;"
        // Clear for current domain with hostname
        document.cookie = cookieName + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname + ";"
        // Clear for parent domain (subdomain support)
        const hostParts = window.location.hostname.split('.')
        if (hostParts.length > 2) {
          document.cookie = cookieName + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=." + hostParts.slice(-2).join('.') + ";"
        }
      })

      // 5. Clear IndexedDB (if exists)
      if ('indexedDB' in window && indexedDB.databases) {
        const databases = await indexedDB.databases()
        databases.forEach(db => {
          indexedDB.deleteDatabase(db.name)
        })
      }

      // 6. Clear any Cache API
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName)
        })
      }

      console.log('🧹 NUCLEAR LOGIN CLEANUP COMPLETED')

    } catch (error) {
      console.error('Error during nuclear cleanup:', error)
    }

    // 7. Force hard reload to clear JS memory & redirect to homepage
    // (Can't go to /login because staff-access-granted cookie was cleared)
    window.location.href = '/'
  }

  const handleHomeRedirect = async () => {
    try {
      // 🧹 NUCLEAR CLEANUP - CLEAR EVERYTHING!

      // 1. Clear server-side sessions & CSRF
      await fetch('/api/auth', { method: 'DELETE' }).catch(() => {})
      await fetch('/api/csrf-token', { method: 'DELETE' }).catch(() => {})

      // 2. Clear ALL localStorage
      localStorage.clear()

      // 3. Clear ALL sessionStorage
      sessionStorage.clear()

      // 4. NUCLEAR COOKIE CLEARING - all domains & paths
      document.cookie.split(";").forEach(function(c) {
        const cookieName = c.split("=")[0].trim()
        // Clear for current domain & path
        document.cookie = cookieName + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;"
        // Clear for current domain with hostname
        document.cookie = cookieName + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname + ";"
        // Clear for parent domain (subdomain support)
        const hostParts = window.location.hostname.split('.')
        if (hostParts.length > 2) {
          document.cookie = cookieName + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=." + hostParts.slice(-2).join('.') + ";"
        }
      })

      // 5. Clear IndexedDB (if exists)
      if ('indexedDB' in window && indexedDB.databases) {
        const databases = await indexedDB.databases()
        databases.forEach(db => {
          indexedDB.deleteDatabase(db.name)
        })
      }

      // 6. Clear any Cache API
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName)
        })
      }

      console.log('🧹 NUCLEAR HOME CLEANUP COMPLETED')

    } catch (error) {
      console.error('Error during nuclear cleanup:', error)
    }

    // 7. Force hard reload to clear JS memory & redirect
    window.location.href = '/'
  }

  // Auto redirect to login after delay
  useEffect(() => {
    if (showAutoRedirect) {
      const timer = setTimeout(() => {
        handleLoginRedirect()
      }, autoRedirectDelay * 1000)
      
      return () => clearTimeout(timer)
    }
  }, [showAutoRedirect, autoRedirectDelay])

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 text-center border border-red-100">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            {title}
          </h1>

          {/* Message */}
          <p className="text-gray-600 mb-8 leading-relaxed">
            {message}
          </p>

          {/* Auto redirect info */}
          {showAutoRedirect && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-5 h-5 text-yellow-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="text-sm text-yellow-800">
                  Otomatis mengarahkan ke halaman login dalam {autoRedirectDelay} detik...
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleLoginRedirect}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              🔐 Login Ulang
            </Button>
            
            <Button
              onClick={handleHomeRedirect}
              variant="outline"
              className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 py-3 rounded-lg font-medium transition-all duration-200"
            >
              🏠 Kembali ke Beranda
            </Button>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Jika masalah terus berlanjut, hubungi administrator sistem.
          </p>
        </div>
      </div>
    </div>
  )
}