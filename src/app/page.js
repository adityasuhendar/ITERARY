'use client'
import { useState, useEffect } from 'react'
import { validateStaffCode } from '@/lib/security'
import { sanitizeInput, sanitizeOutput } from '@/lib/xssProtection'
// Helper function to check staff access cookies
const checkStaffAccessCookie = () => {
  if (typeof window === 'undefined') return false
  return document.cookie.includes('staff-access-granted=true')
}
import CustomerMachineStatusModal from '@/components/modals/CustomerMachineStatusModal'

// Custom colors as CSS variables simulation
const customStyles = {
  dwashRed: '#dc2626',
  dwashYellow: '#fbbf24'
}

// Helper functions for machine status calculations
const calculateServiceDuration = (services) => {
  const serviceDurations = {
    'Cuci': 15,
    'Kering': 45, 
    'Bilas': 7
  }
  
  // Handle multiple services - PARALLEL processing
  const serviceList = services.split(', ')
  
  // Count occurrences of each service type
  const serviceCounts = {}
  serviceList.forEach(service => {
    const serviceName = service.trim()
    serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1
  })
  
  // Calculate parallel duration - services of same type run in parallel
  let totalDuration = 0
  
  // Group services by category for parallel calculation
  const cuciServices = (serviceCounts['Cuci'] || 0) + (serviceCounts['Bilas'] || 0)
  const keringServices = serviceCounts['Kering'] || 0
  
  // Parallel calculation:
  // Multiple cuci/bilas can run simultaneously on different machines
  // So max duration = longest individual service duration
  if (cuciServices > 0) {
    // If we have both Cuci and Bilas, they run sequentially per machine
    let cuciDuration = 0
    if (serviceCounts['Cuci']) cuciDuration += serviceDurations['Cuci']
    if (serviceCounts['Bilas']) cuciDuration += serviceDurations['Bilas']
    
    // But multiple sets can run in parallel, so duration doesn't multiply
    totalDuration += cuciDuration
  }
  
  if (keringServices > 0) {
    totalDuration += serviceDurations['Kering']
  }
  
  return totalDuration
}

const getTransactionTimeRemaining = (transactionTime, services, transactionDateISO) => {
  const now = new Date()
  const [hours, minutes] = transactionTime.split('.').map(Number) // Fix: split by '.' not ':'

  // Use actual transaction date if provided, otherwise assume today
  let transactionDate
  if (transactionDateISO) {
    transactionDate = new Date(transactionDateISO)
    // Ensure hours/minutes are set correctly (in case timezone issues)
    transactionDate.setHours(hours, minutes, 0, 0)
  } else {
    transactionDate = new Date()
    transactionDate.setHours(hours, minutes, 0, 0)
  }

  const duration = calculateServiceDuration(services)
  const estimatedFinish = new Date(transactionDate.getTime() + (duration * 60 * 1000))

  const isStillRunning = estimatedFinish > now
  const timeRemaining = isStillRunning
    ? Math.max(0, Math.ceil((estimatedFinish - now) / (1000 * 60)))
    : Math.ceil((now - estimatedFinish) / (1000 * 60)) // Minutes since finished

  // Check if transaction is from today
  const isSameDay = transactionDate.toDateString() === now.toDateString()

  return {
    isStillRunning,
    timeRemaining,
    estimatedFinish,
    isSameDay
  }
}

export default function HomePage() {
  // Cache utilities
  const LOYALTY_CACHE_DURATION = 15 * 60 * 1000 // 15 menit

  const getCachedLoyalty = (phone) => {
    try {
      const cacheKey = `dwash_loyalty_${phone}`
      const cached = localStorage.getItem(cacheKey)
      
      if (!cached) return null
      
      const data = JSON.parse(cached)
      const isExpired = (Date.now() - data.timestamp) > LOYALTY_CACHE_DURATION
      
      if (isExpired) {
        localStorage.removeItem(cacheKey) // Cleanup expired
        return null
      }
      
      console.log('🚀 Using cached loyalty data')
      return data.loyaltyData
    } catch (err) {
      console.log('❌ Cache error, will fetch fresh')
      return null
    }
  }

  const setCachedLoyalty = (phone, loyaltyData) => {
    try {
      const cacheKey = `dwash_loyalty_${phone}`
      const cacheData = {
        loyaltyData: loyaltyData,
        timestamp: Date.now()
      }
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
      console.log('💾 Loyalty data cached for 15 minutes')
    } catch (err) {
      console.log('❌ Failed to cache loyalty data')
    }
  }

  // Universal cache cleanup utility
  const clearOldPhoneCaches = (newPhone) => {
    const currentPhone = getLastUsedPhone()
    if (currentPhone && currentPhone !== newPhone.trim()) {
      try {
        const keys = Object.keys(localStorage)
        let clearedCount = 0
        keys.forEach(key => {
          if (key.includes(currentPhone) && key.startsWith('dwash_')) {
            localStorage.removeItem(key)
            clearedCount++
            console.log('🗑️ Cleared old cache:', key.substring(0, 40) + '...')
          }
        })
        if (clearedCount > 0) {
          console.log(`✨ Cleaned up ${clearedCount} old cache entries for phone: ${currentPhone.substring(0, 5)}***`)
        }
      } catch (err) {
        console.log('❌ Failed to clear old caches')
      }
    }
  }

  // Sticky phone utilities
  const getLastUsedPhone = () => {
    try {
      return localStorage.getItem('dwash_last_phone') || ''
    } catch (err) {
      return ''
    }
  }

  const setLastUsedPhone = (phone) => {
    try {
      localStorage.setItem('dwash_last_phone', phone.trim())
    } catch (err) {
      console.log('❌ Failed to save last phone')
    }
  }

  // Handle PWA installation
  const handleInstallPWA = async () => {
    // Special handling for iPhone Safari
    if (isIOSSafari) {
      alert(`📱 Untuk menambah ke Home Screen di iPhone/iPad:

1. Tap tombol Share (⬆️) di bawah layar
2. Scroll dan pilih "Add to Home Screen"
3. Tap "Add" untuk konfirmasi

Setelah ditambah, buka dari Home Screen untuk pengalaman app yang lebih baik!`)
      return
    }

    // Regular PWA installation for other browsers
    if (!deferredPrompt) {
      alert('Aplikasi sudah terinstall atau browser tidak mendukung instalasi PWA')
      return
    }

    try {
      setIsInstalling(true)
      const result = await deferredPrompt.prompt()
      console.log('PWA install result:', result.outcome)

      if (result.outcome === 'accepted') {
        setDeferredPrompt(null)
        setCanInstall(false)
      }
      setIsInstalling(false)
    } catch (error) {
      console.error('PWA install error:', error)
      setIsInstalling(false)
      alert('Gagal menginstall aplikasi. Silakan coba lagi.')
    }
  }

  // Loyalty modal opener - reset states
  const handleOpenLoyaltyModal = async () => {
    setShowTrackModal(true)
    setError('')
    setLoyaltyData(null)
    setTrackingPhone('')
    setLoyaltyStep(1)
    setLoyaltyBranches([])
    setSelectedLoyaltyBranch(null)

    const lastPhone = getLastUsedPhone()
    if (lastPhone) {
      console.log('🔍 Found last used phone:', lastPhone.substring(0, 5) + '***')
      setTrackingPhone(lastPhone) // Auto-populate phone
    }
  }

  const [trackingPhone, setTrackingPhone] = useState('')
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showTrackModal, setShowTrackModal] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [loyaltyData, setLoyaltyData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [customerValidation, setCustomerValidation] = useState({ isValid: false, customer: null, error: '' })
  const [isValidatingCustomer, setIsValidatingCustomer] = useState(false)
  // Loyalty branch selection states
  const [loyaltyStep, setLoyaltyStep] = useState(1) // 1=input phone, 2=select branch, 3=show loyalty data
  const [loyaltyBranches, setLoyaltyBranches] = useState([])
  const [selectedLoyaltyBranch, setSelectedLoyaltyBranch] = useState(null)
  const [showChatWidget, setShowChatWidget] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      text: "Halo! Selamat datang di DWash Laundry 😊\n\nAda yang bisa saya bantu?\n\nTanya aja tentang harga, lokasi, atau cara mencuci di laundry kami!",
      isBot: true,
      timestamp: new Date()
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)

  // Chat functions
  const sendChatMessage = async (message) => {
    if (!message.trim() || isSendingMessage) return

    const userMessage = {
      id: Date.now(),
      text: message.trim(),
      isBot: false,
      timestamp: new Date()
    }

    // Add user message immediately
    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsSendingMessage(true)

    try {
      // Call API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          sessionId: 'web_' + Date.now()
        })
      })

      const data = await response.json()

      if (data.success) {
        // Add bot response
        const botMessage = {
          id: Date.now() + 1,
          text: data.data.response,
          isBot: true,
          timestamp: new Date()
        }
        setChatMessages(prev => [...prev, botMessage])
      } else {
        // Add error message
        const errorMessage = {
          id: Date.now() + 1,
          text: "Maaf, terjadi kesalahan. Silakan coba lagi atau hubungi CS di +62 821-8148-7971",
          isBot: true,
          timestamp: new Date()
        }
        setChatMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage = {
        id: Date.now() + 1,
        text: "Koneksi bermasalah. Silakan coba lagi dalam beberapa saat 😅",
        isBot: true,
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsSendingMessage(false)
    }
  }

  const handleQuickAction = (actionText) => {
    sendChatMessage(actionText)
  }

  const handleChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendChatMessage(chatInput)
    }
  }

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    const chatContainer = document.getElementById('chat-messages')
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight
    }
  }, [chatMessages, isSendingMessage])





  const [showAccessModal, setShowAccessModal] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [accessError, setAccessError] = useState('')
  const [accessSuccess, setAccessSuccess] = useState(false)
  const [accessLoading, setAccessLoading] = useState(false)
  const [securityAlert, setSecurityAlert] = useState('')
  const [showPromoNotification, setShowPromoNotification] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [hasValidStaffAccess, setHasValidStaffAccess] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [showMachineStatusModal, setShowMachineStatusModal] = useState(false)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showMainCustomerDropdown, setShowMainCustomerDropdown] = useState(false)
  const [showStaffButton, setShowStaffButton] = useState(true)
  const [isScrolled, setIsScrolled] = useState(false)

  // Washing machine demo control
  const [isMachineRunning, setIsMachineRunning] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(15 * 60) // 15 minutes in seconds

  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [canInstall, setCanInstall] = useState(false)
  const [pwaCheckComplete, setPwaCheckComplete] = useState(false)
  const [isIOSSafari, setIsIOSSafari] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [isStoreOpen, setIsStoreOpen] = useState(true) // Status buka/tutup toko

  // Centralized useEffect for managing body scroll lock for all modals
  useEffect(() => {
    const isAnyModalOpen = showMachineStatusModal || showTrackModal || showChatWidget || showCustomerModal || showAccessModal;

    if (isAnyModalOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = 'auto';
      document.body.style.position = 'static';
      document.body.style.width = 'auto';
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'auto';
      document.body.style.position = 'static';
      document.body.style.width = 'auto';
      document.body.style.top = '';
    };
  }, [showMachineStatusModal, showTrackModal, showChatWidget, showCustomerModal, showAccessModal]);

  // Check for client-side rendering and detect iPhone
  useEffect(() => {
    setIsClient(true)

    // Simple iPhone detection
    if (typeof window !== 'undefined') {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
      setIsIOSSafari(isIOS && isSafari)
    }
  }, [])

  // Handle scroll event for navbar transparency
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true)
      } else {
        setIsScrolled(false)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Handle PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setCanInstall(true)
      setPwaCheckComplete(true)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setCanInstall(false)
      setPwaCheckComplete(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Set timeout untuk mark PWA check as complete jika event tidak trigger
    const pwaCheckTimeout = setTimeout(() => {
      if (!pwaCheckComplete) {
        setPwaCheckComplete(true)
        // For iPhone, don't set canInstall since we use different logic
        if (!isIOSSafari) {
          // PWA sudah installed atau tidak eligible untuk install (non-iPhone)
        }
      }
    }, 2000) // 2 detik timeout

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      clearTimeout(pwaCheckTimeout)
    }
  }, [pwaCheckComplete])

  // Check for maintenance message and staff access on component mount
  useEffect(() => {
    if (!isClient) return
    
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('maintenance') === 'scheduled') {
      setSecurityAlert('')
      setTimeout(() => setSecurityAlert(''), 5000)
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
    }

    // Note: Removed auto-redirect, let user choose when to access staff area
    
    // Check initial staff access status
    setHasValidStaffAccess(checkStaffAccessCookie())

    // Show promo notification after 3 seconds initially
    const promoTimer = setTimeout(() => {
      setShowPromoNotification(true)
      // Auto hide after 8 seconds
      setTimeout(() => setShowPromoNotification(false), 8000)
    }, 3000)

    return () => clearTimeout(promoTimer)
  }, [isClient])

  // Promo notification recurring every 1 minute
  useEffect(() => {
    if (!isClient) return

    // Recurring promo notification every 1 minute
    const promoInterval = setInterval(() => {
      setShowPromoNotification(true)
      // Auto hide after 8 seconds
      setTimeout(() => setShowPromoNotification(false), 8000)
    }, 60000) // 60000ms = 1 minute

    return () => clearInterval(promoInterval)
  }, [isClient])

  // Refresh staff access status every minute
  useEffect(() => {
    if (!isClient) return

    const checkInterval = setInterval(() => {
      const isValid = checkStaffAccessCookie()
      setHasValidStaffAccess(isValid)
    }, 60000) // Check every minute

    return () => clearInterval(checkInterval)
  }, [isClient])

  // Track scroll position to show/hide staff button
  useEffect(() => {
    if (!isClient) return

    const handleScroll = () => {
      // Hide button when scrolled past hero section (roughly 100px)
      setShowStaffButton(window.scrollY < 100)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isClient])

  // Block scroll when hamburger menu is open
  useEffect(() => {
    if (showMobileMenu) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showMobileMenu])

  // Washing machine timer countdown
  useEffect(() => {
    if (!isMachineRunning || timeRemaining <= 0) return

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setIsMachineRunning(false)
          return 15 * 60 // Reset to 15 minutes
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isMachineRunning, timeRemaining])

  // Check store open/close status (06:00 - 22:00)
  useEffect(() => {
    if (!isClient) return

    const checkStoreStatus = () => {
      const now = new Date()
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()

      // Open: 06:00 - 22:00
      const isOpen = (currentHour > 6 || (currentHour === 6 && currentMinute >= 0)) &&
                     (currentHour < 22)

      setIsStoreOpen(isOpen)
    }

    // Check immediately
    checkStoreStatus()

    // Check every minute
    const interval = setInterval(checkStoreStatus, 60000)

    return () => clearInterval(interval)
  }, [isClient])

  const handleTrackOrder = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setLoyaltyData(null)

    try {
      const phone = trackingPhone.trim()

      // Step 1: Get all branches where customer is registered (no time filter for loyalty)
      const response = await fetch('/api/loyalty', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone }) // No id_cabang = get branches mode
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Nomor HP tidak ditemukan')
        setIsLoading(false)
        return
      }

      const branches = data.branches || []

      if (branches.length === 0) {
        setError('Nomor HP tidak terdaftar di cabang manapun')
        setIsLoading(false)
        return
      }

      if (branches.length === 1) {
        // Only 1 branch - fetch loyalty directly
        setSelectedLoyaltyBranch(branches[0])
        await fetchLoyaltyData(phone, branches[0].id_cabang)
      } else {
        // Multiple branches - show selection
        setLoyaltyBranches(branches)
        setLoyaltyStep(2)
        setIsLoading(false)
      }

    } catch (err) {
      setError('Tidak dapat terhubung ke server. Silakan coba lagi.')
      console.error('Error:', err)
      setIsLoading(false)
    }
  }

  // Fetch loyalty data for selected branch
  const fetchLoyaltyData = async (phone, branchId) => {
    setIsLoading(true)
    setError('')

    try {
      // Check cache first (with branch ID)
      const cacheKey = `${phone}-${branchId}`
      const cached = getCachedLoyalty(cacheKey)
      if (cached) {
        setLoyaltyData(cached)
        setLoyaltyStep(3)
        setIsLoading(false)

        return
      }

      // Fetch from server
      const response = await fetch('/api/loyalty', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, id_cabang: branchId })
      })

      const data = await response.json()

      if (response.ok) {
        clearOldPhoneCaches(phone)

        setLoyaltyData(data)
        setCachedLoyalty(cacheKey, data)
        setLastUsedPhone(phone)
        setLoyaltyStep(3)
      } else {
        setError(data.error || 'Terjadi kesalahan')
      }
    } catch (err) {
      setError('Tidak dapat terhubung ke server. Silakan coba lagi.')
      console.error('Error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const validateCustomer = async (phone) => {
    if (!phone || phone.length < 10) {
      setCustomerValidation({ isValid: false, customer: null, error: '' })
      return
    }
    
    // Check if phone format is valid first
    const phoneRegex = /^(08|62)[0-9]{8,12}$/
    if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
      setCustomerValidation({ isValid: false, customer: null, error: 'Format nomor HP tidak valid' })
      return
    }
    
    setIsValidatingCustomer(true)
    
    try {
      const response = await fetch('/api/customers/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setCustomerValidation({ 
          isValid: true,
          customer: data.customer,
          error: ''
        })
      } else {
        setCustomerValidation({ 
          isValid: false,
          customer: null,
          error: data.error || 'Customer tidak ditemukan'
        })
      }
    } catch (error) {
      setCustomerValidation({ 
        isValid: false,
        customer: null,
        error: 'Terjadi kesalahan validasi'
      })
    } finally {
      setIsValidatingCustomer(false)
    }
  }

  const handleStaffAccessClick = () => {
    // Check if staff access is still valid
    const isValid = checkStaffAccessCookie()
    setHasValidStaffAccess(isValid)
    
    if (isValid) {
      // Valid access - direct redirect to login
      console.log('Valid staff access found, redirecting directly to login...')
      window.location.href = '/login'
    } else {
      // No valid access - show modal for code input
      console.log('No valid staff access, showing access modal...')
      setShowAccessModal(true)
    }
  }

  const handleAccessCode = async (e) => {
    e.preventDefault()
    setAccessError('')
    setAccessLoading(true)
    
    try {
      // Validate input using security library
      const validation = validateStaffCode(accessCode)
      
      if (!validation.isValid) {
        setAccessError(sanitizeOutput(validation.error))
        setAccessLoading(false)
        setTimeout(() => {
          setAccessError('')
        }, 3000)
        return
      }
      
      // Make secure API call
      const response = await fetch('/api/staff-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessCode: validation.sanitized
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Cookies are set by the API, just update UI state
        setHasValidStaffAccess(true) // Update state for button
        setAccessSuccess(true)
        
        setTimeout(() => {
          setShowAccessModal(false)
          setAccessCode('')
          setAccessSuccess(false)
          setAccessLoading(false)
          window.location.href = '/login'
        }, 1500)
      } else {
        setAccessError(sanitizeOutput(data.error || 'Kode akses tidak valid'))
        setAccessLoading(false)
        setTimeout(() => {
          setAccessError('')
        }, 3000)
      }
    } catch (error) {
      console.error('Error validating access code:', error)
      setAccessError(sanitizeOutput('Terjadi kesalahan sistem. Silakan coba lagi.'))
      setAccessLoading(false)
      setTimeout(() => {
        setAccessError('')
      }, 3000)
    }
  }

  // Functions related to machine status modal are now handled in the separate component

  // Branches are now handled in the separate modal component

  return (
    <div className="min-h-screen bg-white">

      {/* Chat Button - Floating left bottom */}
      <button
        onClick={() => setShowChatWidget(!showChatWidget)}
        className="fixed bottom-6 left-6 w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white rounded-full shadow-2xl hover:shadow-red-500/50 border-4 border-white transition-all duration-500 z-50 flex items-center justify-center group animate-bounce hover:animate-none hover:scale-110"
        style={{
          boxShadow: '0 0 30px rgba(239, 68, 68, 0.4), 0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
        title="Chat dengan Asisten DWash"
      >
        <span className="text-2xl group-hover:scale-125 transition-transform duration-300">💬</span>
        {/* Notification badge */}
        <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full animate-pulse">
          HELP
        </div>
      </button>

      {/* Maintenance Alert */}
      {securityAlert && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-100 border-2 border-yellow-500 text-yellow-700 px-6 py-3 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🔧</span>
            <span className="font-semibold">{securityAlert}</span>
          </div>
        </div>
      )}
      
      {/* Header - Fixed with better mobile handling */}
      <header className={`fixed w-full top-0 z-[100] transition-shadow duration-300 ${
        isScrolled
          ? 'bg-white shadow-lg border-b border-gray-100'
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-visible">
          <div className="flex items-center justify-between h-16 lg:h-20 overflow-visible">
            {/* Logo - Same as Dashboard Header */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              <div className="w-10 h-10 rounded-lg overflow-hidden">
                <img 
                  src="/images/logo/logo-dwash.jpg" 
                  alt="DWash Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="hidden sm:block text-left">
                <h1 className={`text-lg font-bold ${isScrolled ? 'text-red-600' : 'text-white'}`}>DWash</h1>
                <p className={`text-xs leading-tight ${isScrolled ? 'text-gray-500' : 'text-white/80'}`}>Self Service Laundry</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-8">
              <a href="#home" className={`font-medium ${isScrolled ? 'text-gray-700' : 'text-white'}`}>Home</a>
              <a href="#about" className={`font-medium ${isScrolled ? 'text-gray-700' : 'text-white'}`}>Tentang Kami</a>
              <a href="#services" className={`font-medium ${isScrolled ? 'text-gray-700' : 'text-white'}`}>Layanan</a>
              <a href="#pricing" className={`font-medium ${isScrolled ? 'text-gray-700' : 'text-white'}`}>Harga</a>
              <a href="#cabang" className={`font-medium ${isScrolled ? 'text-gray-700' : 'text-white'}`}>Cabang</a>
              <a href="#footer" className={`font-medium ${isScrolled ? 'text-gray-700' : 'text-white'}`}>Kontak</a>
              <button
                onClick={() => setShowCustomerModal(true)}
                className={`font-medium transition-colors ${isScrolled ? 'text-gray-700 hover:text-red-600' : 'text-white hover:text-white/80'}`}
              >
                Area Pelanggan
              </button>
            </nav>


            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className={`p-2 rounded-lg transition-colors ${
                  isScrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10 drop-shadow-lg'
                }`}
                aria-label="Toggle mobile menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d={showMobileMenu ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Mobile Navigation - Full Screen Overlay */}
      {showMobileMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-[9998] md:hidden"
            onClick={() => setShowMobileMenu(false)}
          ></div>

          {/* Menu */}
          <div className="fixed inset-0 bg-white z-[9999] md:hidden flex flex-col animate-in fade-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              {/* Logo and Text */}
              <div className="flex items-center space-x-3 flex-shrink-0">
                <div className="w-10 h-10 rounded-lg overflow-hidden">
                  <img
                    src="/images/logo/logo-dwash.jpg"
                    alt="DWash Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-left">
                  <h1 className="text-lg font-bold text-red-600">DWash</h1>
                  <p className="text-xs leading-tight text-gray-500">Self Service Laundry</p>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 flex flex-col p-4 space-y-2 overflow-y-auto">
            <a href="#home" onClick={() => setShowMobileMenu(false)} className="text-gray-800 font-medium px-4 py-4 hover:bg-gray-50 rounded-lg transition-colors">Home</a>
            <a href="#about" onClick={() => setShowMobileMenu(false)} className="text-gray-800 font-medium px-4 py-4 hover:bg-gray-50 rounded-lg transition-colors">Tentang Kami</a>
            <a href="#services" onClick={() => setShowMobileMenu(false)} className="text-gray-800 font-medium px-4 py-4 hover:bg-gray-50 rounded-lg transition-colors">Layanan</a>
            <a href="#pricing" onClick={() => setShowMobileMenu(false)} className="text-gray-800 font-medium px-4 py-4 hover:bg-gray-50 rounded-lg transition-colors">Harga</a>
            <a href="#cabang" onClick={() => setShowMobileMenu(false)} className="text-gray-800 font-medium px-4 py-4 hover:bg-gray-50 rounded-lg transition-colors">Cabang</a>
            <a href="#footer" onClick={() => setShowMobileMenu(false)} className="text-gray-800 font-medium px-4 py-4 hover:bg-gray-50 rounded-lg transition-colors">Kontak</a>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowMachineStatusModal(true)
                  setShowMobileMenu(false)
                }}
                className="w-full text-left text-blue-600 font-medium px-4 py-4 hover:bg-blue-50 rounded-lg transition-colors flex items-center space-x-3"
              >
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm2 2a1 1 0 100 2 1 1 0 000-2zm3 0a1 1 0 100 2 1 1 0 000-2zm3 4a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z"/>
                </svg>
                <span>Cek Status Mesin</span>
              </button>
              <button
                onClick={() => {
                  handleOpenLoyaltyModal()
                  setShowMobileMenu(false)
                }}
                className="w-full text-left text-yellow-600 font-medium px-4 py-4 hover:bg-yellow-50 rounded-lg transition-colors flex items-center space-x-3"
              >
                <span>🎁</span>
                <span>Cek Loyalty Points</span>
              </button>
              <button
                onClick={() => {
                  setShowChatWidget(true)
                  setShowMobileMenu(false)
                }}
                className="w-full text-left text-red-600 font-medium px-4 py-4 hover:bg-red-50 rounded-lg transition-colors flex items-center space-x-3"
              >
                <span>💬</span>
                <span>Chat Asisten DWash</span>
              </button>
            </div>
          </nav>
        </div>
        </>
      )}

<section id="home" className="pt-8 sm:pt-12 lg:pt-16 min-h-screen max-h-none sm:max-h-screen text-white relative overflow-hidden flex items-center">
  {/* Background - Image for All Devices */}
  <div className="absolute inset-0">
    {/* Background Photo - Local HD Image */}
    <div
      className="absolute inset-0 bg-cover bg-center"
      style={{
        backgroundImage: `url('/images/hero-laundry.jpg')`
      }}
    ></div>

    {/* Red Overlay - Keep the red theme */}
    <div className="absolute inset-0 bg-gradient-to-br from-red-600/85 via-red-700/80 to-red-800/85"></div>
    
    {/* Soft glowing orbs */}
    <div className="absolute inset-0">
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-yellow-400/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-red-500/20 rounded-full blur-3xl"></div>
    </div>

    {/* Accent elements - visible on all screens */}
    <div className="absolute top-20 right-20 w-20 h-20 border border-white/10 rounded-full"></div>
    <div className="absolute bottom-20 left-20 w-32 h-32 border border-white/10 rounded-full"></div>
  </div>

  <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-8 pb-2 sm:py-6 md:py-8 lg:py-10 xl:py-12">
    <div className="grid lg:grid-cols-2 gap-6 md:gap-8 lg:gap-10 xl:gap-12 items-center">
      {/* Left Column - Brand Message (Full width on mobile) */}
      <div className="text-center lg:text-left lg:pl-8 xl:pl-12">
        {/* Location badge */}
        <a
          href="#cabang"
          className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 sm:px-4 py-1 sm:py-2 mt-2 sm:mt-3 mb-3 sm:mb-6 hover:bg-white/20 transition-all duration-300 cursor-pointer group"
        >
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-white/90 text-xs sm:text-sm font-medium group-hover:text-white">7 Cabang di Bandar Lampung</span>
        </a>
        
        {/* Brand Name - responsive sizing */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black mb-3 sm:mb-4 tracking-tight">
          <span className="text-white drop-shadow-md">DWASH</span>
        </h1>
        
        {/* Tagline - improved visibility */}
        <div className="bg-yellow-400/90 text-red-800 inline-block px-4 sm:px-6 py-2 sm:py-3 rounded-xl transform -rotate-2 mb-4 sm:mb-8 shadow-lg">
          <span className="text-lg sm:text-xl md:text-2xl font-bold tracking-wide">SELF SERVICE LAUNDRY</span>
        </div>
        
        {/* Main value proposition - larger on mobile for impact */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-4 sm:mb-6 leading-tight">
          <span className="block text-white">Cuci Sendiri</span>
          <span className="block text-yellow-300">Lebih Hemat!</span>
        </h2>
        
        {/* Feature list - better spacing on mobile */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-5 mb-6 sm:mb-8 border border-white/20 mx-8 sm:mx-0">
          <p className="text-xl sm:text-2xl font-bold text-yellow-300 mb-2">
            Tanpa Koin, Tanpa Ribet, Lebih Murah
          </p>
          <p className="text-sm sm:text-base text-white/80">
            Melayani <span className="font-bold text-yellow-300">5000+</span> pelanggan sejak 2022
          </p>
        </div>
        
        {/* Call-to-action buttons - optimized for mobile */}
        <div className="flex flex-col sm:flex-row items-stretch gap-4 mb-6 sm:mb-8 px-8 sm:px-0">
          <div className="relative flex-1 group">
            <button
              onClick={handleInstallPWA}
              disabled={!pwaCheckComplete || (!canInstall && !isIOSSafari) || isInstalling}
              className={`w-full font-bold text-base sm:text-lg px-4 sm:px-6 py-4 rounded-xl shadow-lg text-center transition-all duration-300 whitespace-nowrap ${
                !pwaCheckComplete || isInstalling
                  ? 'bg-gray-300 text-gray-600 cursor-wait animate-pulse'
                  : isIOSSafari
                    ? 'bg-yellow-400 text-red-800 hover:bg-yellow-300 cursor-pointer'
                    : canInstall
                      ? 'bg-yellow-400 text-red-800 hover:bg-yellow-300 cursor-pointer'
                      : 'bg-[#00AA13] text-white hover:bg-[#1CC41C] cursor-default shadow-lg'

              }`}
            >
              {!pwaCheckComplete
                ? 'Mengecek Device... ⏳'
                : isInstalling
                  ? 'Menginstall... ⏳'
                  : isIOSSafari
                    ? 'Tambah ke Home Screen 📱'
                    : canInstall
                      ? 'Install Aplikasi 📱'
                      : 'Aplikasi Terinstall ✓'
              }
            </button>
            
            {/* Custom Tooltip */}
            {!canInstall && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg whitespace-nowrap shadow-lg">
                  Cek di home screen HP Anda! 📱
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            )}
          </div>
          <div className="relative flex-1 overflow-visible">
            <button
              onClick={() => setShowCustomerModal(true)}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold text-base sm:text-lg px-4 sm:px-6 py-4 rounded-xl transition-all duration-300 w-full flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="whitespace-nowrap">Area Pelanggan</span>
              <div className="w-5 h-5 bg-yellow-400 text-red-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                3
              </div>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Customer Dropdown - Desktop: floating dropdown, Mobile: inline expand */}
            {showMainCustomerDropdown && (
              <>
                {/* Desktop Dropdown */}
                <div className="hidden sm:block absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-white/20 backdrop-blur-md rounded-xl shadow-xl border border-white/30 py-3 z-50 overflow-visible">
                  <button
                    onClick={() => {
                      setShowMachineStatusModal(true)
                      setShowMainCustomerDropdown(false)
                    }}
                    className="w-full px-4 py-3 text-white hover:bg-white/20 hover:text-yellow-300 transition-all duration-200 flex items-center justify-center space-x-3 group"
                  >
                    <svg className="w-5 h-5 text-white group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm2 2a1 1 0 100 2 1 1 0 000-2zm3 0a1 1 0 100 2 1 1 0 000-2zm3 4a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z"/>
                    </svg>
                    <span className="font-semibold">Cek Status Mesin</span>
                  </button>
                  <div className="border-t border-white/20 my-1"></div>
                  <button
                    onClick={() => {
                      handleOpenLoyaltyModal()
                      setShowMainCustomerDropdown(false)
                    }}
                    className="w-full px-4 py-3 text-white hover:bg-white/20 hover:text-yellow-300 transition-all duration-200 flex items-center justify-center space-x-3 group"
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform">🎁</span>
                    <span className="font-semibold">Cek Loyalty Point</span>
                  </button>
                </div>
                
                {/* Mobile Inline Expand */}
                <div className="block sm:hidden mt-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 animate-slide-down">
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => {
                        setShowMachineStatusModal(true)
                        setShowMainCustomerDropdown(false)
                      }}
                      className="flex items-center justify-center space-x-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white hover:text-yellow-300 transition-all duration-200 group"
                    >
                      <svg className="w-5 h-5 text-white group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm2 2a1 1 0 100 2 1 1 0 000-2zm3 0a1 1 0 100 2 1 1 0 000-2zm3 4a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z"/>
                      </svg>
                      <span className="font-semibold">Cek Status Mesin</span>
                    </button>
                    <button
                      onClick={() => {
                        handleOpenLoyaltyModal()
                        setShowMainCustomerDropdown(false)
                      }}
                      className="flex items-center justify-center space-x-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white hover:text-yellow-300 transition-all duration-200 group"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">🎁</span>
                      <span className="font-semibold">Cek Loyalty Point</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Trust indicators - centered and well-spaced */}
        <div className="flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-4 lg:gap-6 -mt-2 sm:-mt-3">
          <div className="flex items-center gap-2">
            <div className="text-yellow-400">⭐⭐⭐⭐⭐</div>
            <span className="text-white/80 text-sm">4.99/5 Rating</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 sm:w-3 h-2 sm:h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-white/80 text-sm">
              Buka 06:00 - 22:00
            </span>
          </div>
        </div>
      </div>
      
      {/* Right Column - Visual Element - ONLY shown on desktop/tablet */}
      <div className="hidden lg:block relative">
        <div className="relative mx-auto max-w-md">
          {/* Highlight glow */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-yellow-400/20 rounded-full blur-3xl"></div>
          
          {/* Washing Machine Visualization - improved based on image3 */}
          <div className="relative bg-red-500/40 backdrop-blur-sm rounded-3xl p-6 border border-red-400/30 shadow-lg overflow-hidden">
            {/* Status Badge */}
            <div className={`absolute top-2 left-1/2 transform -translate-x-1/2 px-6 py-2 rounded-full text-sm font-bold shadow-lg transition-colors duration-300 ${
              isMachineRunning
                ? 'bg-orange-500 text-white animate-pulse'
                : 'bg-green-500 text-white'
            }`}>
              {isMachineRunning ? 'RUNNING' : 'AVAILABLE'}
            </div>
            
            {/* Main circular window with water effect background */}
            <div className="w-full aspect-square rounded-full border-4 border-purple-300/30 overflow-hidden shadow-inner my-10 relative"
                 style={{background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 50%, #6366f1 100%)'}}>

              {/* Water/Foam gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-blue-400/20 via-transparent to-blue-300/30"></div>

              {/* Foam patches */}
              <div className="absolute top-4 left-6 w-16 h-12 bg-white/40 rounded-full blur-md"></div>
              <div className="absolute top-8 right-10 w-20 h-14 bg-white/30 rounded-full blur-lg"></div>
              <div className="absolute bottom-6 left-8 w-14 h-10 bg-white/35 rounded-full blur-md"></div>
              <div className="absolute bottom-10 right-6 w-12 h-8 bg-white/40 rounded-full blur-sm"></div>

              {/* Clothes - Simple boxes */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3/4 h-3/4 relative animate-spin-slow transition-all duration-500"
                     style={{animationDuration: isMachineRunning ? '1s' : '20s'}}>
                  {/* Blue shirt - LARGE */}
                  <div className="absolute top-1/4 left-1/4 w-16 h-16 bg-blue-500 rounded-md shadow-lg"></div>

                  {/* Red towel - MEDIUM */}
                  <div className="absolute top-1/4 right-1/4 w-14 h-12 bg-red-500 rounded-md shadow-lg"></div>

                  {/* Green pants */}
                  <div className="absolute bottom-1/4 left-1/3 w-10 h-12 bg-green-500 rounded-md shadow-lg"></div>

                  {/* Yellow shirt */}
                  <div className="absolute top-1/2 left-1/2 w-10 h-10 bg-yellow-400 rounded-md shadow-lg"></div>

                  {/* Purple socks */}
                  <div className="absolute bottom-1/3 right-1/4 w-9 h-11 bg-purple-500 rounded-md shadow-lg"></div>
                </div>
              </div>

              {/* Bubbles - MUCH MORE with varying sizes */}
              {/* Large bubbles */}
              <div className="absolute top-1/6 left-1/4 w-4 h-4 bg-white/80 rounded-full animate-float" style={{animationDelay: '0s'}}></div>
              <div className="absolute top-1/3 right-1/3 w-5 h-5 bg-white/70 rounded-full animate-float" style={{animationDelay: '0.5s'}}></div>
              <div className="absolute bottom-1/4 left-1/3 w-4 h-4 bg-white/75 rounded-full animate-float" style={{animationDelay: '1s'}}></div>

              {/* Medium bubbles */}
              <div className="absolute top-1/4 right-1/4 w-3 h-3 bg-white/70 rounded-full animate-float" style={{animationDelay: '0.2s'}}></div>
              <div className="absolute top-2/3 left-1/5 w-3 h-3 bg-white/65 rounded-full animate-float" style={{animationDelay: '0.7s'}}></div>
              <div className="absolute bottom-1/3 right-1/5 w-3 h-3 bg-white/70 rounded-full animate-float" style={{animationDelay: '1.2s'}}></div>
              <div className="absolute top-1/2 left-1/6 w-3 h-3 bg-white/60 rounded-full animate-float" style={{animationDelay: '0.9s'}}></div>
              <div className="absolute bottom-1/6 left-1/2 w-3 h-3 bg-white/65 rounded-full animate-float" style={{animationDelay: '1.5s'}}></div>

              {/* Small bubbles */}
              <div className="absolute top-1/6 right-1/6 w-2 h-2 bg-white/70 rounded-full animate-float" style={{animationDelay: '0.3s'}}></div>
              <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-white/60 rounded-full animate-float" style={{animationDelay: '0.8s'}}></div>
              <div className="absolute bottom-1/5 right-1/3 w-2 h-2 bg-white/65 rounded-full animate-float" style={{animationDelay: '1.3s'}}></div>
              <div className="absolute top-3/4 left-1/4 w-2 h-2 bg-white/70 rounded-full animate-float" style={{animationDelay: '1.8s'}}></div>
              <div className="absolute top-1/3 left-2/3 w-2 h-2 bg-white/60 rounded-full animate-float" style={{animationDelay: '0.4s'}}></div>
              <div className="absolute bottom-2/3 right-2/3 w-2 h-2 bg-white/65 rounded-full animate-float" style={{animationDelay: '1.1s'}}></div>
              <div className="absolute bottom-1/2 left-1/4 w-2 h-2 bg-white/70 rounded-full animate-float" style={{animationDelay: '1.6s'}}></div>

              {/* Tiny bubbles */}
              <div className="absolute top-1/5 left-3/4 w-1.5 h-1.5 bg-white/80 rounded-full"></div>
              <div className="absolute top-3/5 right-1/5 w-1.5 h-1.5 bg-white/75 rounded-full"></div>
              <div className="absolute bottom-1/4 left-2/3 w-1.5 h-1.5 bg-white/70 rounded-full"></div>
              <div className="absolute bottom-2/5 right-1/4 w-1.5 h-1.5 bg-white/65 rounded-full"></div>
              <div className="absolute top-2/5 left-1/5 w-1.5 h-1.5 bg-white/70 rounded-full"></div>

              {/* Glass Door Overlay - Realistic glass reflection effect */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Main glass reflection - diagonal shine */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-60"
                     style={{
                       background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 20%, transparent 45%)'
                     }}></div>

                {/* Secondary reflection - top arc */}
                <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent opacity-70"></div>

                {/* Glass edge highlight - bright rim */}
                <div className="absolute inset-0 rounded-full"
                     style={{
                       boxShadow: 'inset 0 0 40px rgba(255,255,255,0.3), inset 0 8px 20px rgba(255,255,255,0.4)'
                     }}></div>

                {/* Glare spots - like real glass */}
                <div className="absolute top-8 left-12 w-20 h-24 bg-white/40 blur-xl rounded-full transform -rotate-45"></div>
                <div className="absolute top-16 right-16 w-12 h-16 bg-white/30 blur-lg rounded-full"></div>
              </div>
            </div>
            
            {/* Bottom Control Panel */}
            <div className="flex justify-between items-center mt-4">
              {/* Timer Display */}
              <div className={`bg-gray-900/70 px-4 py-2 rounded-md font-mono text-sm transition-colors duration-300 ${
                isMachineRunning ? 'text-orange-400' : 'text-green-400'
              }`}>
                {Math.floor(timeRemaining / 60).toString().padStart(2, '0')}:{(timeRemaining % 60).toString().padStart(2, '0')}
              </div>

              {/* Control Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (!isMachineRunning) {
                      setIsMachineRunning(true)
                      setTimeRemaining(15 * 60) // Reset to 15 minutes on start
                    }
                  }}
                  disabled={isMachineRunning}
                  className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300 ${
                    isMachineRunning
                      ? 'bg-gray-400/50 border-gray-400/30 text-gray-300 cursor-not-allowed'
                      : 'bg-green-500/70 border-green-400/30 text-white hover:bg-green-600/70 hover:scale-110 cursor-pointer'
                  }`}
                >
                  <span className="text-xl">▶️</span>
                </button>
                <button
                  onClick={() => {
                    setIsMachineRunning(false)
                    setTimeRemaining(15 * 60)
                  }}
                  disabled={!isMachineRunning}
                  className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300 ${
                    !isMachineRunning
                      ? 'bg-gray-400/50 border-gray-400/30 text-gray-300 cursor-not-allowed'
                      : 'bg-red-500/70 border-red-400/30 text-white hover:bg-red-600/70 hover:scale-110 cursor-pointer'
                  }`}
                >
                  <span className="text-xl">⏹️</span>
                </button>
              </div>
            </div>
            
            {/* Price Tags */}
            <div className="absolute top-1/4 -left-2 bg-yellow-400 text-red-800 px-3 py-1 rounded-sm text-xs font-bold shadow-lg transform -rotate-6">
              Rp 10k
            </div>
            
            <div className="absolute bottom-1/3 -right-2 bg-yellow-400 text-red-800 px-3 py-1 rounded-sm text-xs font-bold shadow-lg transform rotate-6">
              Rp 20k
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <style jsx>{`
    @keyframes float {
      0%, 100% { transform: translateY(0); opacity: 0.7; }
      50% { transform: translateY(-10px); opacity: 1; }
    }
    
    @keyframes spin-slow {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .animate-spin-slow {
      animation: spin-slow 10s linear infinite;
    }
    
    .animate-float {
      animation: float 3s ease-in-out infinite;
    }
  `}</style>
</section>

      {/* Floating Promo Notification */}
      {showPromoNotification && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-40 bg-gradient-to-r from-yellow-400 to-orange-500 text-red-800 p-4 rounded-2xl shadow-2xl max-w-sm transition-all duration-500 animate-bounce-in">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-red-700 rounded-full flex items-center justify-center flex-shrink-0 animate-spin-slow">
              <span className="text-yellow-300 text-lg">🎁</span>
            </div>
            <div className="flex-1">
              <div className="font-black text-sm mb-1">PROMO HARI INI!</div>
              <div className="text-xs leading-tight">
                Cuci + Kering cuma <span className="font-black">Rp 20k</span>. Hemat 50%!
              </div>
            </div>
            <button 
              onClick={() => setShowPromoNotification(false)}
              className="text-red-700 font-bold text-lg leading-none"
            >
              ×
            </button>
          </div>
          <div className="mt-2">
            <button 
              onClick={() => {
                setShowPromoNotification(false)
                // Add delay to ensure notification closes first
                setTimeout(() => {
                  // Desktop: scroll to services (cara self-service), Mobile: scroll to promo populer
                  const targetId = window.innerWidth < 768 ? 'promo-populer' : 'services'
                  const targetElement = document.getElementById(targetId)
                  if (targetElement) {
                    // Calculate offset for better positioning
                    const yOffset = window.innerWidth < 768 ? -80 : -20
                    const y = targetElement.getBoundingClientRect().top + window.pageYOffset + yOffset
                    window.scrollTo({ top: y, behavior: 'smooth' })
                  }
                }, 100)
              }}
              className="w-full bg-red-700 text-yellow-300 py-2 px-4 rounded-lg text-xs font-bold"
            >
              Lihat Layanan →
            </button>
          </div>
        </div>
      )}

      {/* About Section - Enhanced with modern interactive elements */}
      <section id="about" className="py-16 lg:py-20 bg-gradient-to-br from-gray-50 to-white relative overflow-visible">
        {/* Background decorative elements */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-32 h-32 bg-red-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-yellow-400 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-red-600 rounded-full blur-2xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Section Header */}
          <div className="text-center mb-12 lg:mb-16">
            <div className="inline-flex items-center space-x-2 bg-red-100 text-red-600 px-6 py-2 rounded-full font-semibold text-sm mb-6">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span>TENTANG DWASH</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mb-6">
              Revolusi <span className="bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">Self-Service</span> Laundry
            </h2>
            <p className="text-xl sm:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              DWash menghadirkan konsep <span className="font-bold text-red-600">self-service laundry modern</span> tanpa koin, 
              memberikan kontrol penuh pada pelanggan dengan <span className="font-bold text-green-600">harga yang lebih terjangkau</span>
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Content - Feature Cards */}
            <div className="order-2 lg:order-1">
              <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mb-8 flex items-center">
                <span className="text-4xl mr-3">🤔</span>
                Kenapa Self-Service Lebih Baik?
              </h3>
              
              <div className="space-y-6">
                {/* Feature 1 */}
                <div className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-green-600 transition-colors">Lebih Hemat 50%+</h4>
                      <p className="text-gray-600 leading-relaxed mb-3">
                        Hanya <span className="font-bold text-green-600 text-lg">Rp20.000</span> untuk cuci+kering, jauh lebih murah dari laundry biasa yang bisa Rp30-50k
                      </p>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                        <span>Hemat hingga Rp300.000/bulan</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Feature 2 */}
                <div className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">Kontrol Penuh 100%</h4>
                      <p className="text-gray-600 leading-relaxed mb-3">
                        Anda yang masukkan baju, pilih sabun, dan awasi prosesnya. <span className="font-semibold">Tidak khawatir baju tercampur</span> atau hilang
                      </p>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                        <span>Privasi & keamanan terjamin</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Feature 3 */}
                <div className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-yellow-600 transition-colors">Tanpa Ribet Koin</h4>
                      <p className="text-gray-600 leading-relaxed mb-3">
                        Sistem pembayaran langsung ke kasir, <span className="font-semibold">tidak perlu beli koin</span> atau kartu khusus
                      </p>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                        <span>Bayar cash/transfer langsung</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Stats Grid */}
              <div className="mt-8 grid grid-cols-3 gap-4">
                <div className="text-center bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl">
                  <div className="text-2xl font-black text-red-600 mb-1">60</div>
                  <div className="text-xs font-semibold text-red-800">Menit Total</div>
                </div>
                <div className="text-center bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl">
                  <div className="text-2xl font-black text-green-600 mb-1">50%</div>
                  <div className="text-xs font-semibold text-green-800">Lebih Hemat</div>
                </div>
                <div className="text-center bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
                  <div className="text-2xl font-black text-blue-600 mb-1">24/7</div>
                  <div className="text-xs font-semibold text-blue-800">Akses Mudah</div>
                </div>
              </div>
            </div>
            
            {/* Right Content - Enhanced Philosophy Card */}
            <div className="order-1 lg:order-2">
              <div className="relative">
                {/* Main Card */}
                <div className="bg-gradient-to-br from-red-600 via-red-700 to-red-800 rounded-3xl p-8 sm:p-10 text-white relative overflow-hidden shadow-2xl">
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-400 rounded-full -translate-y-20 translate-x-20"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-16 -translate-x-16"></div>
                  </div>
                  
                  {/* Content */}
                  <div className="relative z-10">
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="text-4xl">💭</div>
                      <h4 className="text-2xl sm:text-3xl font-black">Filosofi DWash</h4>
                    </div>
                    
                    <blockquote className="text-lg sm:text-xl italic mb-8 leading-relaxed font-medium">
                      &quot;Self-service bukan berarti tidak ada service. Kami tetap melayani dengan sepenuh hati, 
                      tapi memberikan <span className="text-yellow-300 font-bold">kebebasan dan kontrol</span> kepada pelanggan atas pakaian mereka.&quot;
                    </blockquote>
                    
                    {/* Team Info */}
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                        <span className="text-red-800 font-black text-xl sm:text-2xl">DW</span>
                      </div>
                      <div>
                        <div className="font-black text-lg sm:text-xl">DWash Team</div>
                        <div className="text-red-200 text-sm sm:text-base font-semibold">Self-Service Laundry Specialist</div>
                        <div className="flex items-center space-x-1 mt-1">
                          <div className="flex text-yellow-400">⭐⭐⭐⭐⭐</div>
                          <span className="text-red-200 text-xs">5+ years experience</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Key Benefits */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20">
                        <div className="text-2xl font-black text-yellow-300 mb-1">5000+</div>
                        <div className="text-xs text-red-100 font-semibold">Happy Customers</div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20">
                        <div className="text-2xl font-black text-yellow-300 mb-1">2022</div>
                        <div className="text-xs text-red-100 font-semibold">Since Started</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Decorative Elements */}
                  <div className="absolute top-6 right-6 text-6xl opacity-20 animate-pulse">🏆</div>
                </div>
                
                {/* Floating Badge */}
                <div className="absolute -bottom-4 -right-4 bg-yellow-400 text-red-800 px-6 py-3 rounded-full font-black text-sm shadow-lg transform rotate-12 animate-bounce z-50">
                  TRUSTED BRAND
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section - Improved mobile cards */}
<section id="services" className="py-16 lg:py-20 bg-gray-50">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="text-center mb-12 lg:mb-16">
      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-red-600 mb-4">Cara Self-Service DWash</h2>
      <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
              Cuci sendiri dengan mudah, tanpa koin, bayar langsung ke kasir
            </p>
          </div>

          {/* Process Steps - Better mobile grid */}
          <div className="mb-12 lg:mb-16">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {[
                { num: 1, title: "Daftar & Pilih Mesin", desc: "Berikan nama dan nomor HP, pilih mesin yang kosong" },
                { num: 2, title: "Masukkan Pakaian", desc: "Masukkan baju + sabun + softener" },
                { num: 3, title: "Kasir Start Mesin", desc: "Kasir tap kartu untuk mulai cuci" },
                { num: 4, title: "Tunggu & Ambil", desc: "Cuci 15 menit → Kering 45 menit → Selesai!" }
              ].map((step, index) => (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-red-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                    {step.num}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Cards - Stack on mobile */}
          <div id="layanan-pricing" className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-12 lg:mb-16 pt-4">
            {/* Cuci Only */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white text-center rounded-t-2xl">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 2h16c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm2 2c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 0c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 4c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 2c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-bold">Cuci Saja</h3>
                <p className="text-blue-100 mt-2 text-sm">15-25 Menit</p>
              </div>
              <div className="p-6">
                <div className="text-center mb-6">
                  <div className="text-3xl font-bold text-red-600 mb-2">Rp 10.000</div>
                  <div className="text-gray-500 text-sm">per load</div>
                </div>
                <ul className="space-y-3">
                  {[
                    "Mesin cuci berkualitas tinggi",
                    "Gratis softener*", 
                    "Kapasitas 7 kg",
                    "Hasil bersih maksimal"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start text-sm">
                      <span className="text-green-500 mr-2 mt-1 flex-shrink-0">✓</span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Cuci + Kering - Popular */}
            <div id="promo-populer" className="bg-white rounded-2xl shadow-lg overflow-visible hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-2 border-yellow-400 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-20">
                <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-red-700 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg animate-bounce border-2 border-white">
                  ⭐ POPULER ⭐
                </div>
              </div>
              <div className="bg-gradient-to-br from-red-600 to-red-700 p-6 text-white text-center rounded-t-2xl">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold">Cuci + Kering</h3>
                <p className="text-red-100 mt-2 text-sm">Total 60 Menit</p>
              </div>
              <div className="p-6">
                <div className="text-center mb-6">
                  <div className="text-3xl font-bold text-red-600 mb-2">Rp 20.000</div>
                  <div className="text-gray-500 text-sm">per load</div>
                </div>
                <ul className="space-y-3">
                  {[
                    "Cuci (15 menit) + Kering (45 menit)",
                    "Pakaian kering dan siap pakai",
                    "Hemat waktu dan tenaga", 
                    "Mesin pengering otomatis"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start text-sm">
                      <span className="text-green-500 mr-2 mt-1 flex-shrink-0">✓</span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bilas Tambahan */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100">
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 text-white text-center rounded-t-2xl">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-bold">Bilas Tambahan</h3>
                <p className="text-green-100 mt-2 text-sm">7 Menit</p>
              </div>
              <div className="p-6">
                <div className="text-center mb-6">
                  <div className="text-3xl font-bold text-red-600 mb-2">Rp 5.000</div>
                  <div className="text-gray-500 text-sm">per load</div>
                </div>
                <ul className="space-y-3">
                  {[
                    "Untuk menghilangkan sisa sabun",
                    "Jika masih ada busa berlebih",
                    "Hasil lebih bersih dan fresh",
                    "Opsional sesuai kebutuhan"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start text-sm">
                      <span className="text-green-500 mr-2 mt-1 flex-shrink-0">✓</span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="bg-red-600 text-white rounded-2xl p-6 sm:p-8 text-center">
            <h3 className="text-xl sm:text-2xl font-bold mb-6">Fasilitas Lengkap</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {/* Toko Kelengkapan */}
              <div>
                <div className="text-3xl sm:text-4xl mb-3 flex justify-center">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <h4 className="font-semibold text-base sm:text-lg mb-2">Toko Kelengkapan</h4>
                <p className="text-red-100 text-sm leading-relaxed">Goodie bag, plastik besar, minuman dingin tersedia</p>
              </div>

              {/* Program Loyalitas */}
              <div>
                <div className="text-3xl sm:text-4xl mb-3 flex justify-center">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-yellow-400 rounded-full flex items-center justify-center">
                    <span className="text-2xl sm:text-3xl">🎁</span>
                  </div>
                </div>
                <h4 className="font-semibold text-base sm:text-lg mb-2">Program Loyalitas</h4>
                <p className="text-red-100 text-sm leading-relaxed">Cuci gratis setiap 10x cuci + bonus merchandise</p>
              </div>

              {/* Notifikasi WhatsApp */}
              <div>
                <div className="text-3xl sm:text-4xl mb-3 flex justify-center">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#25D366] rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                  </div>
                </div>
                <h4 className="font-semibold text-base sm:text-lg mb-2">Notifikasi WhatsApp</h4>
                <p className="text-red-100 text-sm leading-relaxed">Info status cucian langsung ke HP Anda</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials - Mobile optimized */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-red-600 mb-4">Apa Kata Pelanggan Kami?</h2>
            <p className="text-lg sm:text-xl text-gray-600">
              Kepercayaan dan kepuasan pelanggan adalah prioritas utama kami
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-12 lg:mb-16">
            {[
              { name: "Dicky Rahman", role: "Mahasiswa", initial: "DR", review: "Pas banget buat mahasiswa kost yang males nyuci manual. Harga murah, cuma 1 jam udah kelar, mesin juga bersih. Pokoknya top deh!" },
              { name: "Ibu Wati", role: "Pedagang Sayur", initial: "IW", review: "Dari dulu cari laundry yang bisa dipercaya buat cuci seragam anak sekolah. Alhamdulillah ketemu DWash, cuciannya bersih dan wangi tahan lama." },
              { name: "Budi Santoso", role: "Ojek Online", initial: "BS", review: "Jaket ojol kotor kena hujan, 1 jam udah kering dan bersih lagi. Praktis banget soalnya bisa sambil nunggu di sekitaran sini." }
            ].map((testimonial, i) => (
              <div key={i} className="bg-gray-50 p-6 sm:p-8 rounded-2xl">
                <div className="text-yellow-400 text-3xl mb-4">&quot;</div>
                <p className="text-gray-700 mb-6 italic text-sm sm:text-base leading-relaxed">
                  {testimonial.review}
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-white font-bold text-sm">{testimonial.initial}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 text-sm sm:text-base">{testimonial.name}</div>
                    <div className="text-gray-500 text-xs sm:text-sm">{testimonial.role}</div>
                  </div>
                </div>
                <div className="flex text-yellow-400 mt-4 text-sm">
                  ⭐⭐⭐⭐⭐
                </div>
              </div>
            ))}
          </div>

          {/* Trust Indicators */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-6 sm:p-8 text-white text-center">
            <h3 className="text-xl sm:text-2xl font-bold mb-6">Dipercaya Ribuan Pelanggan</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {[
                { number: "5000+", label: "Pelanggan Aktif" },
                { number: "4.9/5", label: "Rating Google" },
                { number: "99%", label: "Tingkat Kepuasan" },
                { number: "0", label: "Komplain Tidak Terselesaikan" }
              ].map((stat, i) => (
                <div key={i}>
                  <div className="text-2xl sm:text-3xl font-bold text-yellow-400 mb-2">{stat.number}</div>
                  <div className="text-xs sm:text-sm opacity-90">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section id="pricing" className="py-12 lg:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 lg:mb-12 text-red-600">Keunggulan Self-Service DWash</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {/* Cuma 60 Menit */}
            <div className="text-center">
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Cuma 60 Menit</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Cuci 15 menit + kering 45 menit = beres!</p>
            </div>

            {/* Murah Banget */}
            <div className="text-center">
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Murah Banget</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Rp20k cuci+kering vs laundry biasa Rp40k+</p>
            </div>

            {/* Anda Yang Kontrol */}
            <div className="text-center">
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Anda Yang Kontrol</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Tidak khawatir baju hilang atau tercampur</p>
            </div>

            {/* Tanpa Ribet */}
            <div className="text-center">
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Tanpa Ribet</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Gak perlu beli koin, bayar cash langsung</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact - 6 Branch Locations */}
      <section id="cabang" className="py-16 lg:py-20 bg-gradient-to-br from-red-600 to-red-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">Cabang DWash di Bandar Lampung</h2>
            <p className="text-lg sm:text-xl text-red-100 max-w-3xl mx-auto">
              Pilih lokasi terdekat untuk pengalaman self-service laundry terbaik
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-12">
            {/* Cabang Tanjung Senang */}
            <div id="cabang-tanjung-senang" className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-red-700 font-bold text-lg">TS</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Tanjung Senang</h3>
                  <div className="flex items-center space-x-1">
                    <span className={`w-2 h-2 rounded-full ${isStoreOpen ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                    <span className={`text-sm ${isStoreOpen ? 'text-green-200' : 'text-red-200'}`}>
                      {isStoreOpen ? 'Buka' : 'Tutup'}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-red-100 text-sm mb-3">
                <a
                  href="https://share.google/whjLF2wMOFzMbD8vL"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-200 hover:text-yellow-100 transition-all cursor-pointer leading-tight flex items-start space-x-2"
                >
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <span>Jl. Ratu Dibalau, Tj. Senang, Kec. Tj. Senang, Kota Bandar Lampung, Lampung 35135</span>
                </a>
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  <span>0821-8148-7971</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                  </svg>
                  <span>06:00 - 22:00</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 2h16c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm2 2c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 0c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 4c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 2c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4z"/>
                  </svg>
                  <span>5 Mesin Cuci + 5 Pengering</span>
                </div>
              </div>
            </div>

            {/* Cabang Panglima Polim */}
            <div id="cabang-panglima-polim" className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-red-700 font-bold text-lg">PP</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Panglima Polim</h3>
                  <div className="flex items-center space-x-1">
                    <span className={`w-2 h-2 rounded-full ${isStoreOpen ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                    <span className={`text-sm ${isStoreOpen ? 'text-green-200' : 'text-red-200'}`}>
                      {isStoreOpen ? 'Buka' : 'Tutup'}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-red-100 text-sm mb-3">
                <a 
                  href="https://share.google/I5JWmhMD1bww5LIzZ"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-200 hover:text-yellow-100 transition-all cursor-pointer leading-tight flex items-start space-x-2"
                >
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <span>Jl.Panglima Polim No.15, Gedong Air, Kec. Tj. Karang Bar., Kota Bandar Lampung, Lampung 35125</span>
                </a>
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  <span>0821-8148-7971</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                  </svg>
                  <span>06:00 - 22:00</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 2h16c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm2 2c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 0c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 4c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 2c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4z"/>
                  </svg>
                  <span>5 Mesin Cuci + 5 Pengering</span>
                </div>
              </div>
            </div>

            {/* Cabang Sukarame */}
            <div id="cabang-sukarame" className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-red-700 font-bold text-lg">SK</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Sukarame</h3>
                  <div className="flex items-center space-x-1">
                    <span className={`w-2 h-2 rounded-full ${isStoreOpen ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                    <span className={`text-sm ${isStoreOpen ? 'text-green-200' : 'text-red-200'}`}>
                      {isStoreOpen ? 'Buka' : 'Tutup'}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-red-100 text-sm mb-3">
                <a 
                  href="https://share.google/zgddrTY1NG0C6s7eL"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-200 hover:text-yellow-100 transition-all cursor-pointer leading-tight flex items-start space-x-2"
                >
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <span>Jl.Endro Suratmin, Waydadi, Kec. Sukarame, Kota Bandar Lampung, Lampung 35133</span>
                </a>
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  <span>0821-8148-7971</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                  </svg>
                  <span>06:00 - 22:00</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 2h16c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm2 2c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 0c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 4c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 2c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4z"/>
                  </svg>
                  <span>6 Mesin Cuci + 6 Pengering</span>
                </div>
              </div>
            </div>

            {/* Cabang Korpri */}
            <div id="cabang-korpri" className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-red-700 font-bold text-lg">KP</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Korpri</h3>
                  <div className="flex items-center space-x-1">
                    <span className={`w-2 h-2 rounded-full ${isStoreOpen ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                    <span className={`text-sm ${isStoreOpen ? 'text-green-200' : 'text-red-200'}`}>
                      {isStoreOpen ? 'Buka' : 'Tutup'}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-red-100 text-sm mb-3">
                <a 
                  href="https://share.google/9NueEMn8IjJEowlze"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-200 hover:text-yellow-100 transition-all cursor-pointer leading-tight flex items-start space-x-2"
                >
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <span>Jl.Ryamizard Jl. Ryacudu, Harapan Jaya, Kec. Sukarame, Kota Bandar Lampung, Lampung 56101</span>
                </a>
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  <span>0821-8148-7971</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                  </svg>
                  <span>06:00 - 22:00</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 2h16c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm2 2c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 0c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 4c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 2c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4z"/>
                  </svg>
                  <span>5 Mesin Cuci + 5 Pengering</span>
                </div>
              </div>
            </div>

            {/* Cabang Gedong Meneng */}
            <div id="cabang-gedong-meneng" className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-red-700 font-bold text-lg">GM</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Gedong Meneng</h3>
                  <div className="flex items-center space-x-1">
                    <span className={`w-2 h-2 rounded-full ${isStoreOpen ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                    <span className={`text-sm ${isStoreOpen ? 'text-green-200' : 'text-red-200'}`}>
                      {isStoreOpen ? 'Buka' : 'Tutup'}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-red-100 text-sm mb-3">
                <a 
                  href="https://share.google/n5nw7o9PPAUWUhIXE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-200 hover:text-yellow-100 transition-all cursor-pointer leading-tight flex items-start space-x-2"
                >
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <span>Jl.Abdul Muis, Gedong Meneng, Kec. Rajabasa, Kota Bandar Lampung, Lampung 35147</span>
                </a>
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  <span>0821-8148-7971</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                  </svg>
                  <span>06:00 - 22:00</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 2h16c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm2 2c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 0c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 4c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 2c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4z"/>
                  </svg>
                  <span>5 Mesin Cuci + 5 Pengering</span>
                </div>
              </div>
            </div>

            {/* Cabang Untung */}
            <div id="cabang-untung" className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-red-700 font-bold text-lg">UG</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Untung</h3>
                  <div className="flex items-center space-x-1">
                    <span className={`w-2 h-2 rounded-full ${isStoreOpen ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                    <span className={`text-sm ${isStoreOpen ? 'text-green-200' : 'text-red-200'}`}>
                      {isStoreOpen ? 'Buka' : 'Tutup'}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-red-100 text-sm mb-3">
                <a 
                  href="https://share.google/QsQqsOt9gT5Fs7wsC"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-200 hover:text-yellow-100 transition-all cursor-pointer leading-tight flex items-start space-x-2"
                >
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <span>Jl.R.A. Basyid, Labuhan Dalam, Kec. Tj. Senang, Kota Bandar Lampung, Lampung 35141</span>
                </a>
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  <span>0821-8148-7971</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                  </svg>
                  <span>06:00 - 22:00</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 2h16c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm2 2c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 0c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 4c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 2c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4z"/>
                  </svg>
                  <span>3 Mesin Cuci + 3 Pengering</span>
                </div>
              </div>
            </div>

            {/* Cabang Komarudin */}
            <div id="cabang-komarudin" className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-red-700 font-bold text-lg">KM</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Komarudin</h3>
                  <div className="flex items-center space-x-1">
                    <span className={`w-2 h-2 rounded-full ${isStoreOpen ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                    <span className={`text-sm ${isStoreOpen ? 'text-green-200' : 'text-red-200'}`}>
                      {isStoreOpen ? 'Buka' : 'Tutup'}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-red-100 text-sm mb-3">
                <a
                  href="https://maps.app.goo.gl/pNRQrxcjqDMmCrTJ9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-200 hover:text-yellow-100 transition-all cursor-pointer leading-tight flex items-start space-x-2"
                >
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <span>Jl.H. Komarudin, Rajabasa Raya, Kec. Rajabasa, Kota Bandar Lampung, Lampung</span>
                </a>
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  <span>0821-8148-7971</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                  </svg>
                  <span>06:00 - 22:00</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 2h16c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm2 2c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 0c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 4c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 2c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4z"/>
                  </svg>
                  <span>3 Mesin Cuci + 3 Pengering</span>
                </div>
              </div>
            </div>

            {/* Coming Soon - Cabang ke-8 */}
            <div className="hidden lg:block bg-gradient-to-br from-yellow-400/20 via-orange-400/20 to-red-400/20 backdrop-blur-sm rounded-xl p-6 border-2 border-yellow-400/30 hover:border-yellow-400/50 transition-all duration-300 relative overflow-hidden group">
              {/* Animated background sparkles */}
              <div className="absolute inset-0">
                <div className="absolute top-4 left-4 w-1 h-1 bg-yellow-400 rounded-full animate-ping"></div>
                <div className="absolute top-8 right-6 w-1 h-1 bg-white rounded-full animate-ping animation-delay-1000"></div>
                <div className="absolute bottom-6 left-8 w-1 h-1 bg-yellow-300 rounded-full animate-ping animation-delay-2000"></div>
                <div className="absolute bottom-4 right-4 w-1 h-1 bg-white rounded-full animate-ping animation-delay-500"></div>
              </div>

              <div className="relative z-10 text-center py-4">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <span className="text-white font-bold text-2xl animate-pulse">🌟</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-extrabold bg-gradient-to-r from-yellow-300 via-orange-300 to-red-300 bg-clip-text text-transparent animate-pulse">
                    COMING SOON
                  </h3>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="flex space-x-1">
                      <span className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce animation-delay-200"></span>
                      <span className="w-2 h-2 bg-red-400 rounded-full animate-bounce animation-delay-400"></span>
                    </div>
                  </div>
                  <p className="text-yellow-200 text-sm font-semibold">
                    ✨ Segera Hadir ✨
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
  {/* Corner Staff Access Button - Only show in hero section */}
      {showStaffButton && (
        <button
          onClick={handleStaffAccessClick}
          className="fixed bottom-6 right-6 w-12 h-12 bg-transparent border-none outline-none z-50"
          title={hasValidStaffAccess ? "Staff Access (Valid - Click to Login)" : "Staff Access"}
        >
          <span className="sr-only">
            {hasValidStaffAccess ? 'Staff Login' : 'Staff Access'}
          </span>
        </button>
      )}

      {/* Track Order Modal */}
      {showTrackModal && (
        <div className="fixed inset-0 bg-black/60 sm:backdrop-blur-sm z-[120] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white/98 sm:backdrop-blur-xl rounded-2xl shadow-2xl w-full max-h-[92vh] overflow-hidden transition-all duration-300 max-w-md">
            {/* Modern Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4 sm:p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
              
              <div className="relative flex items-center justify-between">
                {/* Left Section - Icon, Title */}
                <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-sm border border-white/30 flex-shrink-0">
                    <span className="text-xl sm:text-2xl">🎁</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold truncate leading-tight">
                      {loyaltyData ? 'Loyalty Points' : 'Cek Loyalty Points'}
                    </h2>
                    {loyaltyData && selectedLoyaltyBranch && (
                      <p className="text-red-100 text-xs sm:text-sm font-medium truncate opacity-90 leading-tight">
                        {selectedLoyaltyBranch.nama_cabang}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Section - Close Button */}
                <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                  <button 
                    onClick={() => {
                      setShowTrackModal(false)
                      setCustomerValidation({ isValid: false, customer: null, error: '' })
                      clearTimeout(window.customerValidationTimeout)
                    }}
                    className="text-white/80 hover:text-white hover:bg-white/20 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all duration-200 group"
                    title="Tutup Modal"
                  >
                    <span className="text-lg sm:text-xl group-hover:scale-110 transition-transform duration-200">✕</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white/90 sm:backdrop-blur-lg overflow-y-auto max-h-[calc(92vh-120px)]">
              {!loyaltyData ? (
                <div className="p-5 sm:p-6">
                  {/* Step 1: Input Phone */}
                  {loyaltyStep === 1 && (
                  <form onSubmit={handleTrackOrder} className="space-y-5">
                    <div className="space-y-3">
                      <label className="block text-gray-800 font-semibold text-sm">
                        📱 Nomor HP Anda
                      </label>
                      <div className="relative group">
                        <input
                          type="tel"
                          inputMode="numeric"
                          placeholder="0812-3456-7890"
                          value={trackingPhone}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '')
                            let formatted = value

                            if (value.startsWith('62')) {
                              // International: 62-812-3456-7890
                              if (value.length > 5 && value.length <= 9) {
                                formatted = value.slice(0, 2) + '-' + value.slice(2, 5) + '-' + value.slice(5)
                              } else if (value.length > 9) {
                                formatted = value.slice(0, 2) + '-' + value.slice(2, 5) + '-' + value.slice(5, 9) + '-' + value.slice(9)
                              }
                            } else if (value.startsWith('0')) {
                              // Local: 0812-3456-7890 (4-4-rest)
                              if (value.length > 4 && value.length <= 8) {
                                formatted = value.slice(0, 4) + '-' + value.slice(4)
                              } else if (value.length > 8) {
                                formatted = value.slice(0, 4) + '-' + value.slice(4, 8) + '-' + value.slice(8)
                              }
                            }

                            setTrackingPhone(formatted)
                          }}
                          className="w-full p-4 pr-12 border-2 rounded-xl focus:ring-4 focus:ring-red-600/20 focus:border-red-600 transition-all duration-200 text-gray-900 placeholder-gray-400 shadow-sm border-gray-200 bg-white hover:border-gray-300 focus:bg-white"
                          pattern="[0-9\-]*"
                          required
                          disabled={isLoading}
                        />
                        
                      </div>
                      {/* <p className="text-sm text-gray-500">
                        Cek berapa kali sudah cuci & kapan dapat gratis
                      </p> */}
                      
                    </div>
                    
                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center space-x-3">
                        <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm">✗</span>
                        </div>
                        <div>
                          <p className="text-red-600 text-sm font-medium">{error}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <button
                        type="submit"
                        disabled={isLoading || !trackingPhone.trim()}
                        className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center justify-center space-x-2"
                      >
                        {isLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                            <span>Mengecek...</span>
                          </>
                        ) : (
                          <>
                            <span className="text-lg">🎁</span>
                            <span>Cek Loyalty Points</span>
                          </>
                        )}
                      </button>
                      {/* <button
                        type="button"
                        onClick={() => {
                          setShowTrackModal(false)
                          setCustomerValidation({ isValid: false, customer: null, error: '' })
                          clearTimeout(window.customerValidationTimeout)
                        }}
                        className="w-full border-2 border-gray-300 text-gray-700 py-4 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold"
                        disabled={isLoading}
                      >
                        Batal
                      </button> */}
                    </div>
                  </form>
                  )}

                  {/* Step 2: Select Branch */}
                  {loyaltyStep === 2 && (
                    <div className="space-y-4">
                      <div className="text-center mb-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Pilih Cabang</h3>
                        <p className="text-sm text-gray-600">
                          Nomor HP terdaftar di {loyaltyBranches.length} cabang. Pilih cabang untuk melihat loyalty points.
                        </p>
                      </div>

                      {loyaltyBranches.map((branch) => {
                        const isLastVisited = branch === loyaltyBranches[0]
                        const daysAgo = branch.last_visit ? Math.floor((new Date() - new Date(branch.last_visit)) / (1000 * 60 * 60 * 24)) : null

                        return (
                          <button
                            key={branch.id_cabang}
                            onClick={() => {
                              setSelectedLoyaltyBranch(branch)
                              fetchLoyaltyData(trackingPhone.trim(), branch.id_cabang)
                            }}
                            disabled={isLoading}
                            className="w-full p-4 border-2 border-gray-300 rounded-xl hover:border-red-300 hover:bg-red-50 transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="text-lg">📍</span>
                                  <h4 className="font-semibold text-base text-gray-900 group-hover:text-red-700">
                                    {branch.nama_cabang}
                                  </h4>
                                  {isLastVisited && (
                                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                                      ⭐ Terakhir
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600">{branch.alamat}</p>
                                <div className="flex items-center space-x-3 text-xs text-gray-500 mt-2">
                                  <span>📅 {daysAgo === 0 ? 'Hari ini' : `${daysAgo} hari lalu`}</span>
                                  <span>🧾 {branch.total_transactions} transaksi</span>
                                </div>
                              </div>
                              <div className="text-red-600 text-xl group-hover:translate-x-1 transition-transform">
                                →
                              </div>
                            </div>
                          </button>
                        )
                      })}

                      <button
                        onClick={() => {
                          setLoyaltyStep(1)
                          setLoyaltyBranches([])
                          setError('')
                        }}
                        className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold"
                        disabled={isLoading}
                      >
                        ← Kembali
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6">
                  {/* Achievement Badges */}
                  <div className="flex flex-wrap gap-2 mb-4 justify-center">
                    {loyaltyData.loyalty.remaining_free_washes > 0 && (
                      <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1 animate-pulse">
                        <span>🎁</span>
                        <span>FREE WASH READY!</span>
                      </div>
                    )}
                    {loyaltyData.loyalty.next_free_in === 1 && (
                      <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1 animate-bounce">
                        <span>🔥</span>
                        <span>ALMOST THERE!</span>
                      </div>
                    )}
                    {loyaltyData.financial.total_savings >= 100000 && (
                      <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
                        <span>💰</span>
                        <span>SAVER MASTER</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Clean Customer Info */}
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl mb-6">
                    <div className="p-5 sm:p-6 border-b border-gray-200">
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
                        Halo {loyaltyData.customer.nama} 👋
                      </h3>
                    </div>
                    
                    <div className="p-5 sm:p-6">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                          <span className="text-white text-2xl">🎁</span>
                          {/* VIP Crown disabled - not fully implemented
                          {loyaltyData.loyalty.total_cuci >= 50 && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                              <span className="text-xs">👑</span>
                            </div>
                          )} */}
                        </div>
                        
                        {loyaltyData.loyalty.remaining_free_washes > 0 ? (
                          <>
                            <p className="text-gray-700 font-medium mb-3">
                              Anda memiliki cuci gratis!
                            </p>
                            <div className="mb-2">
                              <span className="text-4xl sm:text-5xl font-bold text-red-600">
                                {loyaltyData.loyalty.remaining_free_washes}
                              </span>
                              <span className="text-xl text-gray-600 ml-2">gratis tersisa</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-gray-700 font-medium mb-3">
                              Progress ke cuci gratis
                            </p>
                            <div className="mb-2">
                              <span className="text-4xl sm:text-5xl font-bold text-red-600">
                                {loyaltyData.loyalty.next_free_in}
                              </span>
                              <span className="text-xl text-gray-600 ml-2">lagi dapat gratis</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Loyalty Stats with animations */}
                  <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-4 md:p-6 text-center transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <div className="w-12 h-12 md:w-16 md:h-16 bg-yellow-200 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3 animate-pulse">
                        <span className="text-2xl">🧺</span>
                      </div>
                      <div className="text-2xl md:text-3xl font-bold text-yellow-600 mb-1">{loyaltyData.loyalty.total_cuci}</div>
                      <div className="text-xs md:text-base text-yellow-800 font-semibold">Total Cuci</div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4 md:p-6 text-center transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl relative overflow-hidden">
                      {loyaltyData.loyalty.remaining_free_washes > 0 && (
                        <div className="absolute top-1 right-1 md:top-2 md:right-2 bg-green-400 text-white text-[9px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full animate-bounce">
                          READY!
                        </div>
                      )}
                      <div className="w-12 h-12 md:w-16 md:h-16 bg-green-200 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3">
                        <span className="text-2xl">🎁</span>
                      </div>
                      <div className="text-2xl md:text-3xl font-bold text-green-600 mb-1">{loyaltyData.loyalty.remaining_free_washes}</div>
                      <div className="text-xs md:text-base text-green-800 font-semibold">Gratis Tersisa</div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 md:p-6 text-center transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-200 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3">
                        <span className="text-2xl">🔄</span>
                      </div>
                      <div className="text-2xl md:text-3xl font-bold text-blue-600 mb-1">{loyaltyData.loyalty.total_redeem}</div>
                      <div className="text-xs md:text-base text-blue-800 font-semibold">Gratis Terpakai</div>
                    </div>
                  </div>

                  {/* Animated Progress Bar */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 mb-6 shadow-inner">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg font-semibold text-gray-700">Progress ke cuci gratis</span>
                        {loyaltyData.loyalty.next_free_in <= 3 && (
                          <span className="animate-bounce text-xl">🎯</span>
                        )}
                      </div>
                      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold text-sm">
                        {loyaltyData.loyalty.progress_to_next_free}/10
                      </span>
                    </div>
                    
                    <div className="relative w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-red-500 via-red-600 to-red-700 h-4 rounded-full transition-all duration-1000 ease-out relative"
                        style={{ width: `${(loyaltyData.loyalty.progress_to_next_free / 10) * 100}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        {loyaltyData.loyalty.progress_to_next_free >= 8 && (
                          <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 animate-ping"></div>
                        )}
                      </div>
                      
                      {/* Progress milestones */}
                      {[...Array(10)].map((_, i) => (
                        <div
                          key={i}
                          className={`absolute top-0 bottom-0 w-0.5 ${i < loyaltyData.loyalty.progress_to_next_free ? 'bg-white/50' : 'bg-gray-400/50'}`}
                          style={{ left: `${((i + 1) / 10) * 100}%` }}
                        ></div>
                      ))}
                    </div>
                    
                    <div className="mt-3 text-center">
                      {loyaltyData.loyalty.next_free_in === 1 ? (
                        <p className="text-green-600 font-bold text-sm animate-pulse">
                          🎉 1 CUCI LAGI DAPAT GRATIS! 🎉
                        </p>
                      ) : loyaltyData.loyalty.next_free_in <= 3 ? (
                        <p className="text-orange-600 font-semibold text-sm">
                          🔥 Tinggal {loyaltyData.loyalty.next_free_in} lagi dapat cuci gratis!
                        </p>
                      ) : (
                        <p className="text-gray-600 text-sm">
                          Cuci {loyaltyData.loyalty.next_free_in} kali lagi untuk dapat gratis
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Rewards Information */}
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-6 mb-6 shadow-lg">
                    <div className="text-center mb-4">
                      <div className="w-20 h-20 bg-yellow-200 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce">
                        <span className="text-3xl">🎁</span>
                      </div>
                      <h3 className="text-xl font-bold text-yellow-800 mb-2">Reward Loyalty Program</h3>
                      <p className="text-yellow-700 text-sm">Dapatkan lebih banyak dengan cuci lebih sering!</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white/80 rounded-lg p-5 border border-yellow-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center space-x-4">
                          <div className="w-14 h-14 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center shadow-inner">
                            <span className="text-2xl">🧼</span>
                          </div>
                          <div>
                            <div className="font-bold text-red-700 text-lg">Cuci Gratis</div>
                            <div className="text-sm text-red-600">Setiap 10x cuci = 1x gratis</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white/80 rounded-lg p-5 border border-yellow-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center space-x-4">
                          <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center shadow-inner">
                            <span className="text-2xl">🍽️</span>
                          </div>
                          <div>
                            <div className="font-bold text-blue-700 text-lg">Piring Gratis</div>
                            <div className="text-sm text-blue-600">Setiap 10x cuci = 1x piring</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* VIP Activated banner disabled - not fully implemented
                    {loyaltyData.loyalty.total_cuci >= 50 && (
                      <div className="mt-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg p-4 text-center">
                        <div className="flex items-center justify-center space-x-2 mb-2">
                          <span className="text-2xl animate-bounce">👑</span>
                          <span className="font-bold">MEMBER VIP ACTIVATED!</span>
                          <span className="text-2xl animate-bounce">👑</span>
                        </div>
                        <p className="text-sm opacity-90">Selamat! Anda mendapat prioritas antrian dan diskon khusus</p>
                      </div>
                    )} */}
                  </div>

                  {/* Financial Summary */}
                  <div className="flex gap-3 md:gap-4 mb-6">
                    <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3 md:p-4 text-center">
                      <h4 className="font-semibold text-red-800 mb-1 md:mb-2 text-sm md:text-base">Total Pengeluaran</h4>
                      <div className="text-lg md:text-2xl font-bold text-red-600">
                        Rp {loyaltyData.financial.total_spent.toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 md:p-4 text-center">
                      <h4 className="font-semibold text-green-800 mb-1 md:mb-2 text-sm md:text-base">Total Hemat</h4>
                      <div className="text-lg md:text-2xl font-bold text-green-600">
                        Rp {loyaltyData.financial.total_savings.toLocaleString('id-ID')}
                      </div>
                      <div className="text-xs md:text-sm text-green-700">Dari cuci gratis</div>
                    </div>
                  </div>

                  {/* Wash History */}
                  <div className="bg-white border rounded-lg">
                    <div className="p-4 border-b border-gray-200">
                      <h4 className="text-lg font-semibold text-gray-800">
                        {loyaltyData.history_info?.title || "History Cucian"}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {loyaltyData.history_info?.subtitle || "Riwayat transaksi terbaru"}
                      </p>
                    </div>
                    <div>
                      {(showAllHistory ? loyaltyData.history : loyaltyData.history.slice(0, 5)).map((wash, index) => (
                        <div key={wash.id} className="p-4 border-b border-gray-100 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                {/* <span className="text-sm font-semibold text-gray-800">{wash.kode}</span> */}
                                {wash.isFree && (
                                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                                    GRATIS
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{wash.tanggal}</p>
                              <p className="text-sm text-gray-700">{wash.layanan}</p>
                            </div>
                            <div className="text-right">
                              {wash.type === 'tukar_nota_kertas' ? (
                                <div className="font-semibold text-green-600">
                                  +{wash.jumlahNota} Cuci
                                </div>
                              ) : wash.type === 'koreksi_data' ? (
                                <div className={`font-semibold ${wash.jumlahNota > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {wash.jumlahNota > 0 ? '+' : ''}{wash.jumlahNota} Cuci
                                </div>
                              ) : (
                                <div className="font-semibold text-gray-800">
                                  {wash.isFree ? 'GRATIS' : `Rp ${wash.harga.toLocaleString('id-ID')}`}
                                </div>
                              )}
                              {wash.type !== 'tukar_nota_kertas' && wash.type !== 'koreksi_data' && (
                                <div className="text-xs text-gray-500 capitalize">{wash.metode}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {loyaltyData.history.length > 5 && (
                      <div className="p-4 border-t border-gray-200">
                        <button
                          onClick={() => setShowAllHistory(!showAllHistory)}
                          className="w-full py-2 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg transition-colors"
                        >
                          {showAllHistory ? 'Lihat Lebih Sedikit' : `Lihat Semua (${loyaltyData.history.length} transaksi)`}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Back Button - Pilih Cabang Lain */}
                  {loyaltyBranches.length > 1 && (
                    <div className="mt-4 sm:mt-5">
                      <div className="bg-gray-50/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/50">
                        <button
                          onClick={() => {
                            setLoyaltyStep(2)
                            setLoyaltyData(null)
                          }}
                          className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Pilih Cabang Lain
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Machine Status Modal - Using Separate Component */}
      <CustomerMachineStatusModal 
        isOpen={showMachineStatusModal}
        onClose={() => setShowMachineStatusModal(false)}
      />

      {/* Staff Access Code Modal */}
      {showAccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[120] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-8 max-w-sm w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-red-600">Staff Access</h2>
              <button 
                onClick={() => {
                  setShowAccessModal(false)
                  setAccessCode('')
                  setAccessError('')
                  setAccessLoading(false)
                }}
                className="text-gray-500 hover:text-gray-700 text-xl"
                disabled={accessLoading}
              >
                ✕
              </button>
            </div>
            
            {!accessSuccess ? (
              <form onSubmit={handleAccessCode}>
                <div className="mb-6">
                  <label className="block text-gray-700 font-semibold mb-2">
                    Masukkan Kode Akses
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Kode akses staff..."
                      value={accessCode}
                      onChange={(e) => setAccessCode(sanitizeInput(e.target.value))}
                      className={`w-full p-3 pr-12 border rounded-lg focus:ring-2 focus:border-transparent transition-all duration-200 ${
                        accessError 
                          ? 'border-red-300 focus:ring-red-600 bg-red-50' 
                          : 'border-gray-300 focus:ring-red-600'
                      }`}
                      required
                      autoFocus
                      disabled={accessLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors duration-200"
                      disabled={accessLoading}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  
                  {accessError && (
                    <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded-lg flex items-center space-x-2 animate-shake">
                      <span className="text-red-500 text-lg">❌</span>
                      <p className="text-red-700 text-sm font-medium">{accessError}</p>
                    </div>
                  )}
                  
                  {!accessError && (
                    <p className="text-sm text-gray-500 mt-2">
                      Hubungi management untuk mendapatkan kode akses
                    </p>
                  )}
                </div>
                
                <div className="space-y-3">
                  <button
                    type="submit"
                    className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold disabled:bg-gray-400"
                    disabled={accessError || accessLoading}
                  >
                    {accessLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Memverifikasi...
                      </div>
                    ) : (
                      'Akses Staff Portal'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccessModal(false)
                      setAccessCode('')
                      setAccessError('')
                      setAccessLoading(false)
                    }}
                    className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={accessLoading}
                  >
                    Batal
                  </button>
                </div>
              </form>
            ) : (
              /* Success State */
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <span className="text-4xl text-green-600">✅</span>
                </div>
                <h3 className="text-2xl font-bold text-green-600 mb-2">Akses Berhasil!</h3>
                <p className="text-gray-600 mb-4">Mengalihkan ke staff portal...</p>
                
                <div className="flex justify-center">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Widget */}
      {showChatWidget && (
        <div className="fixed bottom-6 left-4 right-4 sm:bottom-24 sm:left-6 sm:right-auto sm:w-80 h-[calc(100vh-8rem)] sm:h-[540px] max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-[110] overflow-hidden flex flex-col">
          {/* Chat Header */}
          <div className="bg-red-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-sm">💬</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm">Asisten DWash</h3>
                <p className="text-xs text-blue-100">Online • Siap membantu</p>
              </div>
            </div>
            <button
              onClick={() => setShowChatWidget(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Chat Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50" id="chat-messages">
            {/* Messages */}
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`mb-3 ${msg.isBot ? 'flex items-start space-x-2' : 'flex justify-end'}`}>
                {msg.isBot && (
                  <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-white">💬</span>
                  </div>
                )}
                <div className={`rounded-lg p-3 shadow-sm max-w-[240px] ${
                  msg.isBot
                    ? 'bg-white text-gray-800'
                    : 'bg-red-600 text-white ml-auto'
                }`}>
                  <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere">
                    {msg.text}
                  </p>
                  <p className={`text-xs mt-1 ${
                    msg.isBot ? 'text-gray-500' : 'text-red-100'
                  }`}>
                    {msg.timestamp.toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isSendingMessage && (
              <div className="flex items-start space-x-2 mb-3">
                <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-white">💬</span>
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions - Only show if no messages yet */}
            {chatMessages.length === 1 && (
              <div className="space-y-2 mb-4">
                <p className="text-xs text-gray-600 font-medium">Pertanyaan populer:</p>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => handleQuickAction('Berapa harga cuci?')}
                    className="bg-white border border-gray-200 rounded-lg p-2 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm text-gray-700">💰 Berapa harga cuci?</span>
                  </button>
                  <button
                    onClick={() => handleQuickAction('Lokasi cabang dimana?')}
                    className="bg-white border border-gray-200 rounded-lg p-2 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm text-gray-700">📍 Lokasi cabang dimana?</span>
                  </button>
                  <button
                    onClick={() => handleQuickAction('Jam berapa buka?')}
                    className="bg-white border border-gray-200 rounded-lg p-2 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm text-gray-700">⏰ Jam berapa buka?</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={handleChatKeyPress}
                placeholder="Ketik pesan..."
                disabled={isSendingMessage}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={() => sendChatMessage(chatInput)}
                disabled={!chatInput.trim() || isSendingMessage}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isSendingMessage ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {isSendingMessage ? 'Sedang mengetik...' : 'Tekan Enter untuk kirim • Response ~2 detik'}
            </p>
          </div>
        </div>
      )}

      {/* Customer Menu Modal - Same design as Machine Status Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/50 sm:backdrop-blur-sm z-[120] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden transition-all duration-300">
            {/* Modern Compact Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4 sm:p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>

              <div className="relative flex items-center justify-between">
                {/* Left Section - Icon, Title */}
                <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-sm border border-white/30 flex-shrink-0">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold truncate leading-tight">
                      Area Pelanggan
                    </h2>
                    <p className="text-xs sm:text-sm text-red-100/90 truncate leading-tight">
                      Pilih layanan yang Anda butuhkan
                    </p>
                  </div>
                </div>

                {/* Right Section - Close Button */}
                <button
                  onClick={() => setShowCustomerModal(false)}
                  className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-all duration-200 backdrop-blur-sm border border-white/30 flex-shrink-0 ml-2"
                  title="Tutup"
                >
                  <span className="text-lg sm:text-xl font-bold">×</span>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 space-y-4">
              {/* Status Mesin Button */}
              <button
                onClick={() => {
                  setShowMachineStatusModal(true)
                  setShowCustomerModal(false)
                }}
                className="w-full p-4 bg-blue-50 hover:bg-blue-100 rounded-2xl text-left transition-all duration-200 group border border-blue-100 hover:border-blue-200"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-500 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm2 2a1 1 0 100 2 1 1 0 000-2zm3 0a1 1 0 100 2 1 1 0 000-2zm3 4a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">Status Mesin</h3>
                    <p className="text-sm text-gray-600">Cek status cucian Anda di cabang</p>
                  </div>
                  <div className="text-blue-500 group-hover:translate-x-1 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Loyalty Points Button */}
              <button
                onClick={() => {
                  handleOpenLoyaltyModal()
                  setShowCustomerModal(false)
                }}
                className="w-full p-4 bg-yellow-50 hover:bg-yellow-100 rounded-2xl text-left transition-all duration-200 group border border-yellow-100 hover:border-yellow-200"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-yellow-500 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-xl">🎁</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">Loyalty Points</h3>
                    <p className="text-sm text-gray-600">Cek poin dan reward Anda</p>
                  </div>
                  <div className="text-yellow-500 group-hover:translate-x-1 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Chat CS Button */}
              <button
                onClick={() => {
                  setShowChatWidget(true)
                  setShowCustomerModal(false)
                }}
                className="w-full p-4 bg-red-50 hover:bg-red-100 rounded-2xl text-left transition-all duration-200 group border border-red-100 hover:border-red-200"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-red-500 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-xl">💬</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">Chat Asisten DWash</h3>
                    <p className="text-sm text-gray-600">Tanya langsung ke Asisten DWash</p>
                  </div>
                  <div className="text-red-500 group-hover:translate-x-1 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer id="footer" className="text-white pt-12 pb-8" style={{ backgroundColor: '#13293d' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Company Info */}
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 rounded-lg overflow-hidden">
                  <img
                    src="/images/logo/logo-dwash.jpg"
                    alt="DWash Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">DWash</h3>
                  <p className="text-xs text-gray-400">Self Service Laundry</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Solusi laundry self-service modern dengan teknologi terkini. Cuci sendiri, lebih hemat!
              </p>
              <div className="flex space-x-3">
                <a href="https://www.instagram.com/dwash.laundry/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 hover:scale-110 rounded-lg flex items-center justify-center transition-transform" aria-label="Instagram DWash">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
                <a href="https://www.tiktok.com/@dwash_laundry" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-black hover:scale-110 rounded-lg flex items-center justify-center transition-transform" aria-label="TikTok DWash">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/></svg>
                </a>
                <a href="https://wa.me/6282181487971" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-[#25D366] hover:scale-110 rounded-lg flex items-center justify-center transition-transform" aria-label="WhatsApp DWash">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                </a>
                <button onClick={() => setShowChatWidget(true)} className="w-10 h-10 bg-red-600 hover:scale-110 rounded-lg flex items-center justify-center transition-transform" aria-label="Chat dengan DWash">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
                </button>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-lg font-bold mb-4">Link Cepat</h4>
              <ul className="space-y-2">
                <li><a href="#home" className="text-gray-400 hover:text-white transition-colors">Home</a></li>
                <li><a href="#about" className="text-gray-400 hover:text-white transition-colors">Tentang Kami</a></li>
                <li><a href="#services" className="text-gray-400 hover:text-white transition-colors">Layanan</a></li>
                <li><a href="#pricing" className="text-gray-400 hover:text-white transition-colors">Harga</a></li>
                <li><a href="#contact" className="text-gray-400 hover:text-white transition-colors">Kontak</a></li>
              </ul>
            </div>

            {/* Services */}
            <div>
              <h4 className="text-lg font-bold mb-4">Layanan</h4>
              <ul className="space-y-2">
                <li className="text-gray-400">Cuci</li>
                <li className="text-gray-400">Cuci + Kering</li>
                <li className="text-gray-400">Bilas Tambahan</li>
                <li>
                  <button onClick={handleOpenLoyaltyModal} className="text-gray-400 hover:text-white transition-colors text-left">
                    Loyalty Program
                  </button>
                </li>
                <li>
                  <button onClick={() => setShowMachineStatusModal(true)} className="text-gray-400 hover:text-white transition-colors text-left">
                    Cek Status Mesin
                  </button>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="text-lg font-bold mb-4">Hubungi Kami</h4>
              <ul className="space-y-3">
                <li className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-gray-400 text-sm">Bandar Lampung, Lampung<br/>7 Cabang Tersedia</span>
                </li>
                <li className="flex items-center space-x-3">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-gray-400 text-sm">0821-8148-7971</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-white/20 pt-8 mt-8">
            <p className="text-gray-400 text-sm text-center">
              © 2025 DWash Laundry. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}