"use client"
import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Button from '@/components/ui/Button'
import { getRoleConfig } from '@/lib/roleConfig'
import { useSessionHandler } from '@/hooks/useSessionHandler'
import SessionExpired from '@/components/ui/SessionExpired'
import SuccessModal from '@/components/modals/SuccessModal'

// DWash Logo with Image and Text - Same as Landing Page
function HeaderLogo({ onClick, isScrolled }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center space-x-3 flex-shrink-0 hover:opacity-80 transition-opacity duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 rounded-lg px-2 py-1"
    >
      <div className="w-10 h-10 rounded-lg overflow-hidden">
        <img
          src="/images/logo/logo-dwash.jpg"
          alt="DWash Logo"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="hidden sm:block text-left">
        <h1 className="text-lg font-bold text-red-600">DWash</h1>
        <p className="text-xs leading-tight text-gray-500">Self Service Laundry</p>
      </div>
    </button>
  )
}

export default function Header({ user, onLogout }) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [pendingRequests, setPendingRequests] = useState(0)
  const [recentRequests, setRecentRequests] = useState([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const menuRef = useRef(null)
  const notificationRef = useRef(null)
  const router = useRouter()
  const pathname = usePathname()
  
  // Session handler for token expiry detection
  const { sessionExpired, handleApiResponse } = useSessionHandler()

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setShowUserMenu(false)
    setShowNotifications(false)
  }, [pathname])

  // Detect scroll for header background change
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Fetch notifications for owner only
  useEffect(() => {
    if (user && (user.role === 'owner' || user.jenis_karyawan === 'owner')) {
      fetchNotifications()
      // Auto refresh every 5 minutes to reduce server load
      const interval = setInterval(fetchNotifications, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [user?.id, user?.role, user?.jenis_karyawan])

  const fetchNotifications = async () => {
    try {
      // Use different endpoint for different roles
      const endpoint = (user?.role === 'owner' || user?.jenis_karyawan === 'owner')
        ? '/api/notifications/pending-requests'  // Pending requests for owner (need approval)
        : '/api/notifications/owner'  // Decision notifications for collectors (approved/rejected)
      
      const response = await fetch(endpoint)
      
      // Handle session expiry using session handler
      const handledResponse = await handleApiResponse(response)
      if (!handledResponse) {
        // Session expired, handleApiResponse will show SessionExpired component
        return
      }
      
      if (response.ok) {
        const data = await response.json()
        
        // Handle different response formats
        if (endpoint.includes('/pending-requests')) {
          // Pending requests endpoint (used by owner)
          setPendingRequests(data.total || 0)
          setRecentRequests(data.recent || [])
        } else {
          // Owner notifications endpoint (used by collector)
          setPendingRequests(data.notifications?.length || 0)
          setRecentRequests(data.notifications || [])
        }
      } else {
        console.error('Failed to fetch notifications:', response.status)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const handleNotificationClick = async () => {
    setShowNotifications(!showNotifications)
    if (!showNotifications) {
      setLoadingNotifications(true)
      await fetchNotifications()
      setLoadingNotifications(false)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/owner', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' })
      })
      if (response.ok) {
        setRecentRequests([])
        setPendingRequests(0)
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const handleLogoClick = () => {
    router.push('/dashboard')
  }

  const handleLogoutClick = () => {
    setShowUserMenu(false)
    setShowLogoutModal(true)
  }

  const handleLogoutConfirm = async () => {
    try {
      // 🧹 NUCLEAR LOGOUT CLEANUP - CLEAR EVERYTHING!

      // 1. Clear server-side sessions (CSRF will auto-expire in 24h)
      await fetch('/api/auth', { method: 'DELETE' }).catch(() => {})

      // 2. Clear ALL localStorage - NO exceptions
      localStorage.clear()

      // 3. Clear ALL sessionStorage
      sessionStorage.clear()

      // 4. SELECTIVE COOKIE CLEARING - preserve staff access
      const preserveCookies = ['staff-access-granted', 'staff-access-role']
      document.cookie.split(";").forEach(function(c) {
        const cookieName = c.split("=")[0].trim()

        // Skip staff access cookies to avoid re-entering access code
        if (preserveCookies.includes(cookieName)) {
          return
        }

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
        try {
          const databases = await indexedDB.databases()
          databases.forEach(db => {
            indexedDB.deleteDatabase(db.name)
          })
        } catch (error) {
          console.warn('IndexedDB cleanup failed:', error)
        }
      }

      // 6. Clear any Cache API
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys()
          cacheNames.forEach(cacheName => {
            caches.delete(cacheName)
          })
        } catch (error) {
          console.warn('Cache API cleanup failed:', error)
        }
      }

      console.log('🧹 NUCLEAR LOGOUT CLEANUP COMPLETED')
      
      setShowLogoutModal(false)
      
      // Show success modal
      setShowSuccessModal(true)
      
      // Navigate after modal auto-closes
      setTimeout(() => {
        setShowSuccessModal(false)
        if (onLogout) {
          onLogout()
        } else {
          router.push('/')
        }
      }, 2000)
      
    } catch (error) {
      console.error('Logout error:', error)
      // Even if server logout fails, clear client side
      localStorage.clear()
      sessionStorage.clear()
      
      // Show success modal even on error
      setShowSuccessModal(true)
      setTimeout(() => {
        setShowSuccessModal(false)
        router.push('/login')
      }, 2000)
    }
  }

  const handleLogoutCancel = () => {
    setShowLogoutModal(false)
  }


  const getPageTitle = () => {
    const titles = {
      '/dashboard': 'Dashboard',
      '/dashboard/kasir': 'Kasir Dashboard',
      '/dashboard/owner': 'Owner Dashboard',
      '/dashboard/collector': 'Collector Dashboard',
      '/dashboard/admin': 'Admin Dashboard'
    }
    return titles[pathname] || 'Dashboard'
  }

  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return 'Selamat Pagi'
    if (hour < 15) return 'Selamat Siang'
    if (hour < 18) return 'Selamat Sore'
    return 'Selamat Malam'
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    })
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Jakarta'
    })
  }

  const roleConfig = getRoleConfig(user?.role)

  // Show session expired page if token expired
  if (sessionExpired) {
    return <SessionExpired 
      title="Sesi Login Berakhir"
      message="Token akses Anda telah kedaluwarsa. Silakan login kembali untuk melanjutkan aktivitas."
      showAutoRedirect={false}
    />
  }

  return (
    <header className="sticky top-0 z-50 bg-white shadow-lg border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left Section - Brand Only */}
          <div className="flex items-center">
            <HeaderLogo onClick={handleLogoClick} isScrolled={isScrolled} />
          </div>

          {/* Center Section - Time & Date (Desktop only) */}
          <div className="hidden lg:flex flex-col items-center text-center">
            <div className="text-xl font-bold drop-shadow-sm text-gray-900">
              {formatTime(currentTime)}
            </div>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-600">
              {formatDate(currentTime).split(',')[0]}
            </div>
          </div>

          {/* Right Section - User Menu */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Desktop User Info - Improved readability */}
            <div className="hidden md:flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-600">{getGreeting()},</div>
                <div className="text-base font-bold drop-shadow-sm text-gray-900">
                  {user?.name || 'User'}
                </div>
              </div>
              
              {/* Role Badge with better contrast */}
              <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold ${roleConfig.color} ${roleConfig.textColor} shadow-lg border border-white/20 backdrop-blur-sm`}>
                <span className="text-base">{roleConfig.icon}</span>
                <div className="flex flex-col items-start">
                  <span>{roleConfig.name}</span>
                  {user?.cabang && (
                    <span className="text-xs opacity-90">{user.cabang}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Notifications Bell (Owner only) */}
            {user && (user.role === 'owner' || user.jenis_karyawan === 'owner') && (
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={handleNotificationClick}
                  className="relative p-2 transition-colors duration-200 rounded-lg focus:outline-none focus:ring-2 text-gray-600 hover:text-dwash-red hover:bg-gray-100 focus:ring-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {pendingRequests > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
                      {pendingRequests > 9 ? '9+' : pendingRequests}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="fixed left-2 right-2 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto mt-3 w-auto sm:w-80 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-[9999] max-h-96 overflow-y-auto">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {(user?.role === 'owner' || user?.jenis_karyawan === 'owner') ? 'Notifications' : 'Stock Requests'}
                        </h3>
                        <div className="flex items-center space-x-2">
                          {(user?.role === 'owner' || user?.jenis_karyawan === 'owner') && recentRequests.length > 0 && (
                            <button
                              onClick={markAllAsRead}
                              className="text-xs text-red-600 hover:text-red-800"
                              disabled={loadingNotifications}
                            >
                              Hapus Semua
                            </button>
                          )}
                          <span className="text-xs text-gray-500">
                            {(user?.role === 'owner' || user?.jenis_karyawan === 'owner')
                              ? `${pendingRequests} notifications`
                              : `${pendingRequests} pending`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {loadingNotifications ? (
                      <div className="px-4 py-6 text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-dwash-red mx-auto mb-2"></div>
                        <p className="text-sm text-gray-500">Loading...</p>
                      </div>
                    ) : (
                      <>
                        {recentRequests.length > 0 ? (
                          <div className="max-h-64 overflow-y-auto">
                            {recentRequests.map((request, index) => (
                              <div 
                                key={index} 
                                className="px-3 sm:px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-b-0 cursor-pointer"
                                onClick={() => {
                                  setShowNotifications(false)
                                  router.push('/dashboard?view=stock&tab=requests')
                                }}
                              >
                                <div className="flex items-start space-x-2 sm:space-x-3">
                                  <div className={`flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                                    request.type === 'stock_request_decision' 
                                      ? (request.status === 'approved' ? 'bg-green-100' : 'bg-red-100')
                                      : 'bg-blue-100'
                                  }`}>
                                    <span className={`text-xs sm:text-sm ${
                                      request.type === 'stock_request_decision'
                                        ? (request.status === 'approved' ? 'text-green-600' : 'text-red-600')
                                        : 'text-blue-600'
                                    }`}>
                                      {request.type === 'stock_request_decision' 
                                        ? (request.status === 'approved' ? '✅' : '❌')
                                        : '📝'}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    {request.type === 'stock_request_decision' ? (
                                      // Owner notification format
                                      <>
                                        <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                                          {request.message}
                                        </div>
                                        {request.approval_notes && (
                                          <div className="text-xs text-gray-600 truncate">
                                            Note: {request.approval_notes}
                                          </div>
                                        )}
                                        <div className="text-xs text-gray-400 mt-1">
                                          {new Date(request.timestamp).toLocaleString('id-ID', {
                                            day: '2-digit',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </div>
                                      </>
                                    ) : (
                                      // Collector pending request format
                                      <>
                                        <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                                          {request.request_type === 'update_product' ? 'Product Update' : 
                                           request.request_type === 'update_stock' ? 'Stock Update' : 
                                           'Request Update'}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">
                                          {request.product_name || 'Unknown Product'}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">
                                          {request.kasir_name || 'Kasir'} • {request.branch_name || 'Unknown Branch'}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">
                                          {new Date(request.created_at).toLocaleString('id-ID', {
                                            day: '2-digit',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex-shrink-0">
                                    {request.type === 'stock_request_decision' ? (
                                      <span className={`inline-flex px-1 sm:px-2 py-1 text-xs font-medium rounded-full ${
                                        request.status === 'approved' 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-red-100 text-red-800'
                                      }`}>
                                        <span className="hidden sm:inline">
                                          {request.status === 'approved' ? 'Approved' : 'Rejected'}
                                        </span>
                                        <span className="sm:hidden">
                                          {request.status === 'approved' ? '✅' : '❌'}
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex px-1 sm:px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                                        <span className="hidden sm:inline">Pending</span>
                                        <span className="sm:hidden">⏳</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="px-3 sm:px-4 py-6 text-center">
                            <span className="text-3xl sm:text-4xl mb-2 block">✅</span>
                            <p className="text-xs sm:text-sm text-gray-500">No pending requests</p>
                          </div>
                        )}

                        <div className="px-3 sm:px-4 py-3 border-t border-gray-100">
                          <button
                            onClick={() => {
                              console.log('=== Bell Button Clicked ===')
                              console.log('Navigating to: /dashboard?view=stock&tab=requests')
                              setShowNotifications(false)
                              router.push('/dashboard?view=stock&tab=requests')
                            }}
                            className="w-full text-center text-xs sm:text-sm text-dwash-red hover:text-red-700 font-medium"
                          >
                            View All Requests ({pendingRequests})
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* User Menu Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 sm:space-x-3 p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 backdrop-blur-sm min-h-[44px] hover:bg-gray-100 focus:ring-gray-300"
              >
                {/* Avatar with better visibility - Mobile optimized */}
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg ${roleConfig.color} ${roleConfig.textColor} flex items-center justify-center text-base sm:text-lg font-bold shadow-lg border-2 border-white/30 flex-shrink-0`}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                
                {/* Mobile user info - Simplified */}
                <div className="md:hidden text-left min-w-0 flex-1">
                  <div className="text-sm font-bold truncate text-gray-900">
                    {user?.name || 'User'}
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="truncate block">{roleConfig.name}</span>
                  </div>
                </div>

                {/* Dropdown Arrow - Mobile responsive */}
                <svg
                  className={`h-3 w-3 sm:h-4 sm:w-4 transform transition-all duration-200 flex-shrink-0 text-gray-600 ${showUserMenu ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu - Mobile Enhanced */}
              {showUserMenu && (
                <div className="absolute right-0 mt-3 w-72 sm:w-80 bg-white rounded-xl shadow-2xl border border-gray-100 py-3 z-[9999] animate-fadeIn max-w-[calc(100vw-2rem)] sm:max-w-none">
                  {/* User Info Card - Mobile Optimized */}
                  <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl ${roleConfig.color} ${roleConfig.textColor} flex items-center justify-center text-lg sm:text-xl font-bold shadow-lg border-2 border-white flex-shrink-0`}>
                        {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-base sm:text-lg text-gray-900 truncate">
                          {user?.name || 'User'}
                        </div>
                        <div className={`inline-flex items-center space-x-2 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold ${roleConfig.color} ${roleConfig.textColor} mt-2 shadow-md`}>
                          <span>{roleConfig.icon}</span>
                          <span>{roleConfig.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Time & Date (Mobile) - Responsive */}
                  <div className="px-4 sm:px-6 py-4 lg:hidden border-b border-gray-100 bg-gray-50">
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-red-600">
                        {formatTime(currentTime)}
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-gray-600 mt-1">
                        {formatDate(currentTime)}
                      </div>
                    </div>
                  </div>

                  {/* Menu Items - Mobile Optimized */}
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        router.push('/profile')
                      }}
                      className="w-full px-4 sm:px-6 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors duration-200 flex items-center space-x-3 min-h-[44px]"
                    >
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="truncate">Profile Settings</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        router.push('/help')
                      }}
                      className="w-full px-4 sm:px-6 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors duration-200 flex items-center space-x-3 min-h-[44px]"
                    >
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="truncate">Help & Support</span>
                    </button>
                  </div>

                  {/* Logout Button - Mobile Enhanced */}
                  <div className="border-t border-gray-100 pt-3">
                    <button
                      onClick={handleLogoutClick}
                      className="w-full px-4 sm:px-6 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors duration-200 flex items-center space-x-3 min-h-[44px]"
                    >
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span className="truncate">Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Logout Berhasil!"
        message="Anda telah keluar dari sistem..."
        icon="👋"
        autoClose={true}
        autoCloseDelay={2000}
      />

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="text-center">
              <div className="text-6xl mb-4">🚪</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Konfirmasi Logout
              </h3>
              <p className="text-gray-600 mb-6">
                Yakin ingin keluar dari sistem?
                <br />
                <span className="text-sm text-orange-600">Anda perlu login kembali untuk mengakses sistem.</span>
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleLogoutCancel}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ❌ Batal
                </button>
                <button
                  onClick={handleLogoutConfirm}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  🚪 Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}