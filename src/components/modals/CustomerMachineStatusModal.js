'use client'
import { useState, useEffect } from 'react'

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

  // Calculate duration based on service combinations
  let cuciCount = serviceCounts['Cuci'] || 0
  const bilasCount = serviceCounts['Bilas'] || 0
  let keringServices = serviceCounts['Kering'] || 0
  const cklCount = serviceCounts['CKL'] || 0

  // CKL = Cuci + Kering + Lipat, treat as Cuci + Kering for duration
  if (cklCount > 0) {
    cuciCount += cklCount
    keringServices += cklCount
  }

  // Handle different service combinations
  if (cuciCount > 0 && bilasCount > 0) {
    // Both Cuci and Bilas - sequential: Cuci(15) + Bilas(7) = 22 minutes
    totalDuration += serviceDurations['Cuci'] + serviceDurations['Bilas']
  } else if (cuciCount > 0) {
    // Only Cuci - 15 minutes
    totalDuration += serviceDurations['Cuci']
  } else if (bilasCount > 0) {
    // Only Bilas - 7 minutes (standalone, starts immediately)
    totalDuration += serviceDurations['Bilas']
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

const CustomerMachineStatusModal = ({ isOpen, onClose }) => {
  // Cache utilities - same pattern as loyalty
  const MACHINE_CACHE_DURATION = 2 * 60 * 1000 // 2 menit
  const VALIDATION_CACHE_DURATION = 2 * 60 * 60 * 1000 // 2 jam for customer validation (optimized for auto-fill)
  const MACHINE_COUNT_CACHE_DURATION = 2 * 60 * 60 * 1000 // 2 jam for machine count (infrastructure data - consistent with validation)

  const getCachedMachineStatus = (phone, branchId) => {
    try {
      const cacheKey = `dwash_machine_${phone}_${branchId}`
      const cached = localStorage.getItem(cacheKey)
      
      if (!cached) return null
      
      const data = JSON.parse(cached)
      const isExpired = (Date.now() - data.timestamp) > MACHINE_CACHE_DURATION
      
      if (isExpired) {
        localStorage.removeItem(cacheKey) // Cleanup expired
        return null
      }
      
      console.log('🚀 Using cached machine status')
      return data.machineData
    } catch (err) {
      console.log('❌ Machine cache error, will fetch fresh')
      return null
    }
  }

  const setCachedMachineStatus = (phone, branchId, machineData) => {
    try {
      const cacheKey = `dwash_machine_${phone}_${branchId}`
      const cacheData = {
        machineData: machineData,
        timestamp: Date.now()
      }
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
      console.log('💾 Machine status cached for 2 minutes')
    } catch (err) {
      console.log('❌ Failed to cache machine status')
    }
  }

  // Customer validation cache utilities
  const getCachedValidation = (phone) => {
    try {
      const cacheKey = `dwash_validation_${phone}`
      const cached = localStorage.getItem(cacheKey)
      
      if (!cached) return null
      
      const data = JSON.parse(cached)
      const isExpired = (Date.now() - data.timestamp) > VALIDATION_CACHE_DURATION
      
      if (isExpired) {
        localStorage.removeItem(cacheKey) // Cleanup expired
        return null
      }
      
      console.log('🚀 Using cached customer validation')
      return data.validationData
    } catch (err) {
      console.log('❌ Validation cache error, will fetch fresh')
      return null
    }
  }

  const setCachedValidation = (phone, validationData) => {
    try {
      const cacheKey = `dwash_validation_${phone}`
      const cacheData = {
        validationData: validationData,
        timestamp: Date.now()
      }
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
      console.log('💾 Customer validation cached for 5 minutes')
    } catch (err) {
      console.log('❌ Failed to cache customer validation')
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

  // Cross-feature phone sharing utilities  
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

  const [machinePhone, setMachinePhone] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [machineData, setMachineData] = useState(null)
  const [machineLoading, setMachineLoading] = useState(false)
  const [machineError, setMachineError] = useState('')
  const [showBranchSelection, setShowBranchSelection] = useState(false)
  const [customerValidation, setCustomerValidation] = useState({ isValid: false, customer: null, error: '', visitedBranches: [], lastVisitedBranch: null })
  const [currentStep, setCurrentStep] = useState(1) // 1: Phone input, 2: Branch selection, 3: Machine status
  const [isValidatingCustomer, setIsValidatingCustomer] = useState(false)
  const [machineCount, setMachineCount] = useState({ cuci: 5, pengering: 5 }) // Default fallback
  const [realMachines, setRealMachines] = useState({ cuci: [], pengering: [] }) // Real machine data
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(null) // Auto-refresh interval
  const [nextRefreshTime, setNextRefreshTime] = useState(null) // Next refresh timestamp
  const [refreshCountdown, setRefreshCountdown] = useState(0) // Countdown in seconds
  const [hasAutoPopulated, setHasAutoPopulated] = useState(false) // Prevent multiple auto-populates
  // Notification states removed - will be handled by Service Worker

  // Fetch branches when modal opens
  const fetchBranches = async () => {
    // Note: branches are now fetched via validation API (visited_branches)
    // No need to fetch all branches separately
  }

  // Cache utilities for machine count
  const getCachedMachineCount = (branchId) => {
    try {
      const cacheKey = `dwash_machine_count_${branchId}`
      const cached = localStorage.getItem(cacheKey)
      
      if (!cached) return null
      
      const data = JSON.parse(cached)
      const isExpired = (Date.now() - data.timestamp) > MACHINE_COUNT_CACHE_DURATION
      
      if (isExpired) {
        localStorage.removeItem(cacheKey)
        return null
      }
      
      console.log('🚀 Using cached machine count')
      return data.countData
    } catch (err) {
      console.log('❌ Machine count cache error')
      return null
    }
  }

  const setCachedMachineCount = (branchId, countData) => {
    try {
      const cacheKey = `dwash_machine_count_${branchId}`
      const cacheData = {
        countData: countData,
        timestamp: Date.now()
      }
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
      console.log('💾 Machine count cached for 2 hours')
    } catch (err) {
      console.log('❌ Failed to cache machine count')
    }
  }

  // Fetch machine count for selected branch with caching
  const fetchMachineCount = async (branchId) => {
    // Check cache first
    const cached = getCachedMachineCount(branchId)
    if (cached) {
      setRealMachines(cached.machines)
      setMachineCount({
        cuci: cached.counts.cuci || 5,
        pengering: cached.counts.pengering || 5
      })
      return
    }

    // Cache miss - fetch from server
    try {
      const response = await fetch(`/api/machines/count?cabang_id=${branchId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.machines) {
          // Cache the result
          setCachedMachineCount(branchId, data)
          
          setRealMachines(data.machines)
          setMachineCount({
            cuci: data.counts.cuci || 5, // Fallback to 5 if no data
            pengering: data.counts.pengering || 5
          })
        }
      }
    } catch (err) {
      console.error('Error fetching machine count:', err)
      // Keep default fallback values
    }
  }



  // Auto-populate phone when modal opens (cross-feature sharing) - ONCE only
  useEffect(() => {
    if (isOpen && !machinePhone && !hasAutoPopulated) {
      const lastPhone = getLastUsedPhone()
      if (lastPhone) {
        console.log('🔍 Auto-populating phone from cross-feature:', lastPhone.substring(0, 5) + '***')
        setMachinePhone(lastPhone)
        setHasAutoPopulated(true) // Prevent re-execution
        
        // Check validation cache first
        const cachedValidation = getCachedValidation(lastPhone)
        if (cachedValidation) {
          console.log('🚀 Using cached customer validation - skip API call!')
          setCustomerValidation({
            isValid: true,
            customer: cachedValidation.customer,
            error: '',
            visitedBranches: cachedValidation.visited_branches || [],
            lastVisitedBranch: cachedValidation.last_visited_branch
          })
          setCurrentStep(2) // Go directly to branch selection
        } else {
          // Cache miss - validate via API
          setTimeout(() => {
            validateCustomer(lastPhone)
          }, 100)
        }
      }
    }
  }, [isOpen, machinePhone, hasAutoPopulated]) // Complete dependencies

  // Note: branches now handled via validation API - no need to fetch separately

  // Fetch machine count when branch is selected
  useEffect(() => {
    if (selectedBranch) {
      fetchMachineCount(selectedBranch)
    }
  }, [selectedBranch])

  // Countdown timer effect
  useEffect(() => {
    if (!nextRefreshTime) return

    const countdownInterval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((nextRefreshTime - now) / 1000))
      setRefreshCountdown(remaining)
      
      if (remaining === 0) {
        clearInterval(countdownInterval)
      }
    }, 1000)

    return () => clearInterval(countdownInterval)
  }, [nextRefreshTime])

  const validateCustomer = async (phone) => {
    if (!phone || phone.length < 10) {
      setCustomerValidation({ isValid: false, customer: null, error: '' })
      setShowBranchSelection(false)
      return
    }

    // Check if phone format is valid first
    const phoneRegex = /^(08|62)[0-9]{8,12}$/
    if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
      setCustomerValidation({ isValid: false, customer: null, error: 'Format nomor HP tidak valid' })
      setShowBranchSelection(false)
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
        setShowBranchSelection(true)
      } else {
        setCustomerValidation({ 
          isValid: false, 
          customer: null, 
          error: data.error || 'Nomor HP tidak terdaftar' 
        })
        setShowBranchSelection(false)
        setSelectedBranch('')
      }
    } catch (err) {
      setCustomerValidation({ 
        isValid: false, 
        customer: null, 
        error: 'Tidak dapat memverifikasi nomor HP. Silakan coba lagi.' 
      })
      setShowBranchSelection(false)
      console.error('Customer validation error:', err)
    } finally {
      setIsValidatingCustomer(false)
    }
  }

  // Step 1: Validate customer and get visited branches
  const handlePhoneValidation = async (e) => {
    e.preventDefault()
    
    if (!machinePhone.trim()) {
      setMachineError('Nomor HP wajib diisi')
      return
    }

    setMachineLoading(true)
    setMachineError('')

    try {
      const response = await fetch('/api/customers/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: machinePhone.trim() })
      })

      const data = await response.json()
      
      if (data.success) {
        const currentPhone = machinePhone.trim()
        
        // Universal cache cleanup for different phone number
        clearOldPhoneCaches(currentPhone)
        
        // Save phone for cross-feature sharing
        setLastUsedPhone(currentPhone)
        
        // Cache validation result
        setCachedValidation(currentPhone, data)
        
        // Get visited branches from response
        const visitedBranches = data.visited_branches || []
        
        setCustomerValidation({
          isValid: true,
          customer: data.customer,
          error: '',
          visitedBranches: visitedBranches,
          lastVisitedBranch: data.last_visited_branch
        })

        if (visitedBranches.length > 0) {
          setCurrentStep(2) // Go to branch selection
        } else {
          setMachineError(`Mohon maaf, tidak dapat mengecek status mesin karena belum ada transaksi dalam 10 hari terakhir. Silakan hubungi kasir untuk bantuan 😊`)
        }
      } else {
        setMachineError(data.error || 'Nomor HP tidak terdaftar')
      }
    } catch (err) {
      console.error('Customer validation error:', err)
      setMachineError('Tidak dapat memverifikasi nomor HP. Silakan coba lagi.')
    } finally {
      setMachineLoading(false)
    }
  }

  // Step 3: Get machine status for selected branch with caching
  const handleMachineStatusCheck = async (branchId = null, isAutoRefresh = false) => {
    // Use passed branchId or fall back to selectedBranch state
    const targetBranch = branchId || selectedBranch
    const phoneNumber = machinePhone.trim()

    if (!targetBranch) {
      setMachineError('Pilih cabang terlebih dahulu')
      return
    }

    // Check cache first
    const cached = getCachedMachineStatus(phoneNumber, targetBranch)
    if (cached && !isAutoRefresh) {
      console.log('🚀 Using cached machine status data')
      setMachineData(cached)
      setCurrentStep(3)
      
      // Still setup auto-refresh for cache expiry
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval)
      }
      
      const refreshTime = Date.now() + 120000 // 2 minutes from now
      setNextRefreshTime(refreshTime)
      setRefreshCountdown(120)
      
      const intervalId = setInterval(() => {
        const newRefreshTime = Date.now() + 120000
        setNextRefreshTime(newRefreshTime)
        setRefreshCountdown(120)
        
        handleMachineStatusCheck(targetBranch, true) // isAutoRefresh = true
      }, 120000) // 2 minutes
      setAutoRefreshInterval(intervalId)
      
      return
    }

    // No cache or auto-refresh - fetch fresh data
    setMachineLoading(true)
    setMachineError('')
    
    // Don't clear machineData on auto-refresh to prevent UI flicker
    if (!isAutoRefresh) {
      setMachineData(null)
    }

    try {
      console.log('🔍 MACHINE STATUS DEBUG - Fetching for branch:', selectedBranch.nama_cabang)
      console.log('🔍 Request payload:', { nomor_telepon: phoneNumber, cabang_id: selectedBranch.id_cabang })
      
      const response = await fetch('/api/machines/status/public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'customer-public-request'
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          cabang_id: parseInt(targetBranch)
        })
      })

      const data = await response.json()
      
      console.log('🔍 MACHINE STATUS RESPONSE:', {
        status: response.status,
        ok: response.ok,
        data: data
      })

      if (response.ok) {
        setMachineData(data)
        
        // Universal cache cleanup and save for cross-feature sharing
        clearOldPhoneCaches(phoneNumber)
        
        // Save to cache for future use
        setCachedMachineStatus(phoneNumber, targetBranch, data)
        
        // Save phone for cross-feature sharing
        setLastUsedPhone(phoneNumber)
        
        // Only set step on first load, not on auto-refresh
        if (!isAutoRefresh) {
          setCurrentStep(3) // Go to machine status display
          
          // Notification setup removed - handled by Service Worker background monitoring
        }

        // Transaction data logging for Service Worker reference
        if (data.transactions) {
          const customerTransactions = data.transactions.filter(t => t.is_own_transaction)
          console.log('🔍 Customer transactions found:', customerTransactions.length)
          
          if (customerTransactions.length > 0) {
            console.log('ℹ️ Service Worker will handle notification scheduling for transactions')
          } else {
            console.log('ℹ️ No active transactions for this customer')
          }
        }
        
        // Start auto-refresh when machine status is displayed (first time only)
        if (!isAutoRefresh) {
          if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval)
          }
          
          // Set next refresh time and start countdown - 2 minutes
          const refreshTime = Date.now() + 120000 // 2 minutes from now
          setNextRefreshTime(refreshTime)
          setRefreshCountdown(120)
          
          const intervalId = setInterval(() => {
            // Reset countdown for next cycle
            const newRefreshTime = Date.now() + 120000
            setNextRefreshTime(newRefreshTime)
            setRefreshCountdown(120)
            
            handleMachineStatusCheck(targetBranch, true) // isAutoRefresh = true
          }, 120000) // 2 minutes
          setAutoRefreshInterval(intervalId)
        }
      } else {
        console.log('❌ MACHINE STATUS ERROR:', data)
        setMachineError(data.error || 'Terjadi kesalahan saat mengambil data mesin')
      }
    } catch (err) {
      console.log('💥 MACHINE STATUS FETCH ERROR:', err)
      setMachineError('Tidak dapat terhubung ke server. Silakan coba lagi.')
      console.error('Error:', err)
    } finally {
      setMachineLoading(false)
    }
  }

  // Handle back to previous step
  const handleBackStep = () => {
    // Clear auto-refresh when navigating away from machine status
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval)
      setAutoRefreshInterval(null)
    }
    setNextRefreshTime(null)
    setRefreshCountdown(0)

    if (currentStep === 2) {
      setCurrentStep(1)
      setSelectedBranch('')
      setCustomerValidation({ isValid: false, customer: null, error: '', visitedBranches: [], lastVisitedBranch: null })
    } else if (currentStep === 3) {
      setCurrentStep(2)
      setMachineData(null)
    }
  }

  const handleClose = async () => {
    // Clear auto-refresh when closing modal
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval)
      setAutoRefreshInterval(null)
    }
    setNextRefreshTime(null)
    setRefreshCountdown(0)

    // Modal cleanup - Service Worker handles notifications independently
    console.log('ℹ️ Modal closed - Service Worker continues background monitoring')

    setCurrentStep(1)
    setMachineError('')
    setMachinePhone('')
    setSelectedBranch('')
    setMachineData(null)
    setShowBranchSelection(false)
    setCustomerValidation({ isValid: false, customer: null, error: '', visitedBranches: [], lastVisitedBranch: null })
    setHasAutoPopulated(false) // Reset auto-populate guard for next time
    // State cleanup - notification handling removed
    clearTimeout(window.customerValidationTimeout)
    onClose()
  }

  // Clear cache when user manually changes phone (real-time cleanup)
  const handleNewPhoneInput = () => {
    const currentPhone = machinePhone.trim()
    if (currentPhone && currentPhone.length >= 8) {
      // Only cleanup when user has typed substantial phone number
      clearOldPhoneCaches(currentPhone)
    }
  }

  // Handle push notification subscription
  // Notification functions removed - handled by Service Worker background monitoring



  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 sm:backdrop-blur-sm z-[120] flex items-center justify-center p-3 sm:p-4">
      <div className={`bg-white/98 sm:backdrop-blur-xl rounded-2xl shadow-2xl w-full max-h-[92vh] overflow-hidden transition-all duration-300 ${
        machineData ? 'max-w-2xl' : 'max-w-md'
      }`}>
        {/* Modern Compact Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4 sm:p-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
          
          <div className="relative flex items-center justify-between">
            {/* Left Section - Icon, Title, Branch */}
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg border-2 border-red-500 flex-shrink-0">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm2 2a1 1 0 100 2 1 1 0 000-2zm3 0a1 1 0 100 2 1 1 0 000-2zm3 4a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-bold truncate leading-tight">
                  {machineData ? `Status Mesin` : 'Cek Status Mesin'}
                </h2>
                {machineData && (
                  <p className="text-red-100 text-xs sm:text-sm font-medium truncate opacity-90 leading-tight">{machineData.branch.nama_cabang}</p>
                )}
              </div>
            </div>

            {/* Right Section - Time, Refresh, Close */}
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              {machineData ? (
                <>
                  {/* Desktop Time Badge */}
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/30 shadow-sm hidden sm:block">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🕐</span>
                      <span className="font-semibold text-sm">{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                  </div>
                  
                  {/* Mobile Time (very compact) */}
                  <div className="sm:hidden bg-white/20 backdrop-blur-sm rounded-lg px-2 py-1 border border-white/30 flex items-center gap-1">
                    <span className="text-sm">🕐</span>
                    <span className="font-bold text-xs">{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                  
                  
                  {/* Close Button for results modal */}
                  <button 
                    onClick={handleClose}
                    className="text-white/80 hover:text-white hover:bg-white/20 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all duration-200 group"
                    title="Tutup Modal"
                  >
                    <span className="text-lg sm:text-xl group-hover:scale-110 transition-transform duration-200">✕</span>
                  </button>
                </>
              ) : (
                /* Close Button for form modal */
                <button 
                  onClick={handleClose}
                  className="text-white/80 hover:text-white hover:bg-white/20 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all duration-200 group"
                  title="Tutup Modal"
                >
                  <span className="text-lg sm:text-xl group-hover:scale-110 transition-transform duration-200">✕</span>
                </button>
              )}
            </div>
          </div>
        </div>

{/* Sticky Hint Bar */}
{machineData && (
  <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-300 shadow-sm">
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-1.5 sm:py-2">
      {refreshCountdown > 0 ? (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 text-[12px] sm:text-sm font-medium text-gray-800">
          <span className="flex items-center gap-1.5">
            <span className="animate-spin">🔄</span>
            <span className="font-semibold text-gray-900">
              Auto-update&nbsp;
            </span>
            <span className="hidden sm:inline font-normal">setiap</span> 2 menit
          </span>
          <span className="hidden sm:inline text-gray-400">|</span>
          <span className="text-gray-700 font-normal">
            Estimasi simulasi — kondisi aktual bisa berbeda
          </span>
        </div>
      ) : (
        <p className="text-[12px] sm:text-sm text-center text-gray-800 font-semibold animate-pulse">
          🔄 Sedang memperbarui status mesin...
        </p>
      )}
    </div>
  </div>
)}


        <div className="bg-white/90 sm:backdrop-blur-lg overflow-y-auto max-h-[calc(92vh-120px)]">
          {currentStep === 1 && (
            <div className="p-4 sm:p-6">
              <form onSubmit={handlePhoneValidation} className="space-y-5">
                <div className="space-y-3">
                  <label className="block text-gray-800 font-semibold text-sm">
                    📱 Nomor HP Anda
                  </label>
                  <div className="relative group">
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="0812-3456-7890"
                      value={machinePhone}
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

                        setMachinePhone(formatted)
                        setSelectedBranch('')
                        handleNewPhoneInput() // Clear cache when phone changes
                      }}
                      className="w-full p-4 pr-12 border-2 rounded-xl focus:ring-4 focus:ring-red-600/20 focus:border-red-600 transition-all duration-200 text-gray-900 placeholder-gray-400 shadow-sm border-gray-200 bg-white hover:border-gray-300 focus:bg-white"
                      pattern="[0-9\-]*"
                      required
                      disabled={machineLoading}
                    />
                    
                  </div>
                  
                </div>
                
                {machineError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm">!</span>
                    </div>
                    <div>
                      <p className="text-red-800 font-medium text-sm">Halo Kak {customerValidation.customer?.nama_pelanggan || ''} 👋</p>
                      <p className="text-red-600 text-xs">{machineError}</p>
                    </div>
                  </div>
                )}
                
                <button 
                  type="submit" 
                  disabled={machineLoading || !machinePhone.trim()}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
                >
                  {machineLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Memverifikasi...</span>
                    </>
                  ) : (
                    <>
                      {/* <span>✓</span>kalo */}
                      <span>Cek Status Mesin</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Step 2: Branch Selection Cards */}
          {currentStep === 2 && (
            <div className="p-5 sm:p-6">
              <div className="mb-6">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    Halo {customerValidation.customer?.nama_pelanggan}! 👋
                  </h3>
                </div>
                <p className="text-gray-600 text-sm sm:text-base mb-3">
                  Pilih cabang untuk mengecek status mesin:
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-blue-700 text-xs font-medium">
                    ℹ️ Hanya dapat mengecek status mesin di cabang yang pernah dikunjungi dalam 10 hari terakhir
                  </p>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {customerValidation.visitedBranches && customerValidation.visitedBranches.length > 0 ? (
                  customerValidation.visitedBranches.map((branch) => {
                    const isLastVisited = branch.id_cabang === customerValidation.lastVisitedBranch?.id_cabang
                    const daysAgo = branch.last_visit ? Math.floor((new Date() - new Date(branch.last_visit)) / (1000 * 60 * 60 * 24)) : null
                  
                  return (
                    <button
                      key={branch.id_cabang}
                      onClick={() => {
                        setMachineError('') // Clear any previous errors
                        setSelectedBranch(branch.id_cabang.toString())
                        handleMachineStatusCheck(branch.id_cabang.toString())
                      }}
                      disabled={machineLoading}
                      className="w-full p-4 sm:p-5 border-2 border-gray-300 rounded-xl hover:border-red-300 hover:bg-red-50 transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] active:bg-red-100"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-lg sm:text-xl">📍</span>
                            <h4 className="font-semibold text-base sm:text-lg text-gray-900 group-hover:text-red-700">
                              {branch.nama_cabang}
                            </h4>
                            {isLastVisited && (
                              <span className="bg-yellow-100 text-yellow-800 text-xs sm:text-sm px-2 py-1 rounded-full font-medium flex items-center space-x-1">
                                <span>⭐</span>
                                <span>Terakhir</span>
                              </span>
                            )}
                          </div>
                          <p className="text-sm sm:text-base text-gray-600 mb-3 leading-relaxed">{branch.alamat}</p>
                          <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-500">
                            <span>
                              📅 {daysAgo === 0 ? 'Hari ini' : daysAgo === 1 ? '1 hari lalu' : `${daysAgo} hari lalu`}
                            </span>
                            <span>
                              🧾 {branch.total_transactions} transaksi
                            </span>
                          </div>
                        </div>
                        <div className="text-red-600 text-xl sm:text-2xl group-hover:translate-x-1 transition-transform duration-200">
                          →
                        </div>
                      </div>
                    </button>
                  )
                  })
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-sm">Tidak ada riwayat kunjungan cabang ditemukan.</p>
                  </div>
                )}
              </div>

              {machineLoading && (
                <div className="mt-4 sm:mt-6 flex items-center justify-center space-x-3 text-gray-600 bg-gray-50 rounded-xl p-4 sm:p-5">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-7 sm:w-7 border-2 border-red-600 border-t-transparent"></div>
                  <span className="text-sm sm:text-base">Mengambil status mesin...</span>
                </div>
              )}

              {machineError && (
                <div className="mt-4 sm:mt-6 bg-red-50 border border-red-200 rounded-xl p-4 sm:p-5 flex items-start space-x-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm sm:text-base">✗</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-red-600 text-sm sm:text-base font-medium leading-relaxed">{machineError}</p>
                  </div>
                </div>
              )}

              {/* Back button to return to phone input */}
              <button
                onClick={handleBackStep}
                className="mt-4 w-full border-2 border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold"
                disabled={machineLoading}
              >
                ← Kembali
              </button>
            </div>
          )}

          {/* Step 3: Machine Status Display */}
          {currentStep === 3 && machineData && (
            <div className="overflow-y-auto">
              {/* Clean Customer Status */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl m-4">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-base font-bold text-gray-900">
                    Halo {machineData.customer.nama_pelanggan} 👋
                  </h3>
                </div>
                
                {(() => {
                  try {
                    const customerActiveTransactions = machineData.transactions ?
                      machineData.transactions.filter((transaction) => {
                        try {
                          const timeInfo = getTransactionTimeRemaining(transaction.time, transaction.services, transaction.transaction_date)
                          // Show if: own transaction, not canceled, and same day (regardless of finished or not)
                          return transaction.is_own_transaction &&
                                 transaction.status !== 'dibatalkan' &&
                                 timeInfo.isSameDay
                        } catch (err) {
                          return false
                        }
                      }) : []

                    if (customerActiveTransactions.length > 0) {
                      const stillRunning = customerActiveTransactions.filter(t =>
                        getTransactionTimeRemaining(t.time, t.services, t.transaction_date).isStillRunning
                      )

                      const shortestWait = stillRunning.length > 0 ? Math.min(...stillRunning.map(t =>
                        getTransactionTimeRemaining(t.time, t.services, t.transaction_date).timeRemaining
                      )) : 0
                      const longestWait = stillRunning.length > 0 ? Math.max(...stillRunning.map(t =>
                        getTransactionTimeRemaining(t.time, t.services, t.transaction_date).timeRemaining
                      )) : 0
                      
                      return (
                        <div className="p-4">
                          <div className="text-center">
                            {stillRunning.length > 0 ? (
                              <>
                                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <p className="text-gray-700 font-medium mb-3">
                                  Anda memiliki transaksi aktif
                                </p>
                                <p className="text-gray-600 mb-3 text-sm">
                                  Estimasi selesai
                                </p>
                                <div className="mb-2">
                                  <span className="text-4xl sm:text-5xl font-bold text-red-600">
                                    {shortestWait === longestWait ? shortestWait : `${shortestWait}-${longestWait}`}
                                  </span>
                                  <span className="text-xl text-gray-600 ml-2">menit lagi</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                                <p className="text-gray-700 font-medium mb-3">
                                  Cucian kamu sudah selesai!
                                </p>
                                {(() => {
                                  const finishedTransactions = customerActiveTransactions.filter(t =>
                                    !getTransactionTimeRemaining(t.time, t.services, t.transaction_date).isStillRunning
                                  )
                                  const latestFinished = finishedTransactions[0]
                                  if (latestFinished) {
                                    const timeInfo = getTransactionTimeRemaining(latestFinished.time, latestFinished.services, latestFinished.transaction_date)
                                    const totalMinutes = timeInfo.timeRemaining
                                    const hours = Math.floor(totalMinutes / 60)
                                    const minutes = totalMinutes % 60

                                    let timeText = ''
                                    if (hours > 0 && minutes > 0) {
                                      timeText = `${hours} jam ${minutes} menit yang lalu`
                                    } else if (hours > 0) {
                                      timeText = `${hours} jam yang lalu`
                                    } else {
                                      timeText = `${minutes} menit yang lalu`
                                    }

                                    return (
                                      <div className="mb-2">
                                        <span className="text-2xl sm:text-3xl font-bold text-green-600">
                                          {timeText}
                                        </span>
                                      </div>
                                    )
                                  }
                                  return null
                                })()}
                              </>
                            )}
                          </div>

                          {/* Customer's Today Transactions */}
                          <div className="mt-4 space-y-2">
                            {customerActiveTransactions.map((transaction, index) => {
                              const timeInfo = getTransactionTimeRemaining(transaction.time, transaction.services, transaction.transaction_date)
                              const servicesList = transaction.services.split(', ')
                              const serviceCounts = {}
                              servicesList.forEach(service => {
                                const serviceName = service.trim()
                                serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1
                              })

                              const servicesText = Object.entries(serviceCounts).map(([service, count]) =>
                                count > 1 ? `${count}x ${service}` : service
                              ).join(', ')

                              const finishTime = timeInfo.estimatedFinish.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

                              return (
                                <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-sm font-medium text-blue-900">
                                      {transaction.kode}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      Mulai {transaction.time}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-700">
                                      {servicesText}
                                    </span>
                                    {timeInfo.isStillRunning ? (
                                      <span className="text-sm text-orange-600 font-medium">
                                        Selesai ± {finishTime}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-green-600 font-medium">
                                        Selesai jam {timeInfo.estimatedFinish.toLocaleTimeString('id-ID', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          hour12: false
                                        })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    } else {
                      // Customer tidak ada transaksi hari ini
                      return (
                        <div className="p-4">
                          <div className="text-center py-6">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                            </div>
                            <p className="text-gray-700 font-medium mb-2">
                              Belum ada riwayat cucian hari ini
                            </p>
                            <p className="text-gray-500 text-sm">
                              Silahkan cek ketersediaan mesin di bawah ini
                            </p>
                          </div>
                        </div>
                      )
                    }
                  } catch (error) {
                    return null
                  }
                  return null
                })()}
              </div>

              {/* Machine Status Display */}
              <div className="pt-0 px-4 sm:pt-0 sm:px-5">
                {(() => {
                  // Calculate active service usage (only still running transactions for machine count)
                  const activeTransactions = machineData.transactions ?
                    machineData.transactions.filter((transaction) => {
                      const timeInfo = getTransactionTimeRemaining(transaction.time, transaction.services, transaction.transaction_date)
                      return transaction.status !== 'dibatalkan' &&
                             timeInfo.isStillRunning && timeInfo.timeRemaining > 0
                    }) : []
                  
                  // Deterministic machine assignment based on transaction codes
                  const simulateMachineAssignment = () => {
                    const machines = {
                      cuci: realMachines.cuci.length > 0 ? 
                        realMachines.cuci.map(m => ({
                          id: m.id,
                          nomor_mesin: m.nomor_mesin,
                          status_real: m.status,
                          queue: [],
                          currentFinishTime: new Date()
                        })) :
                        Array.from({length: machineCount.cuci}, (_, i) => ({
                          id: `C${i + 1}`,
                          status_real: 'tersedia',
                          queue: [],
                          currentFinishTime: new Date()
                        })),
                      pengering: realMachines.pengering.length > 0 ?
                        realMachines.pengering.map(m => ({
                          id: m.id,
                          nomor_mesin: m.nomor_mesin,
                          status_real: m.status,
                          queue: [],
                          currentFinishTime: new Date()
                        })) :
                        Array.from({length: machineCount.pengering}, (_, i) => ({
                          id: `P${i + 1}`,
                          status_real: 'tersedia',
                          queue: [],
                          currentFinishTime: new Date()
                        }))
                    }
                    
                    // Helper function to create deterministic hash from string
                    const simpleHash = (str) => {
                      let hash = 0
                      for (let i = 0; i < str.length; i++) {
                        const char = str.charCodeAt(i)
                        hash = ((hash << 5) - hash) + char
                        hash = hash & hash // Convert to 32bit integer
                      }
                      return Math.abs(hash)
                    }
                    
                    // Sort transactions by time (FIFO)
                    const sortedTransactions = [...activeTransactions].sort((a, b) => {
                      const timeA = a.time.split('.').map(Number)
                      const timeB = b.time.split('.').map(Number)
                      return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1])
                    })
                    
                    // Assign services to machines
                    sortedTransactions.forEach(transaction => {
                      try {
                        if (!transaction.services) return
                        
                        const services = transaction.services.split(', ')
                        
                        // Calculate times based on transaction time (FIXED TIME)
                        const [hours, minutes] = transaction.time.split('.').map(Number)
                        const transactionDate = new Date()
                        transactionDate.setHours(hours, minutes, 0, 0)
                        
                        // Count services for parallel assignment
                        const serviceCounts = {}
                        services.forEach(serviceName => {
                          const service = serviceName.trim()
                          if (service) {
                            serviceCounts[service] = (serviceCounts[service] || 0) + 1
                          }
                        })

                        // EXPANSION: CKL should be treated as Cuci + Kering for machine assignment
                        if (serviceCounts['CKL']) {
                          const cklCount = serviceCounts['CKL']
                          serviceCounts['Cuci'] = (serviceCounts['Cuci'] || 0) + cklCount
                          serviceCounts['Kering'] = (serviceCounts['Kering'] || 0) + cklCount
                          // Keep CKL in serviceCounts for display purposes
                        }

                        // Use transaction code for deterministic starting machine selection
                        const transactionHash = simpleHash(transaction.kode || transaction.time)
                        
                        // Assign Cuci services to consecutive machines starting from hash position
                        if (serviceCounts['Cuci']) {
                          const startMachineIndex = transactionHash % machines.cuci.length
                          const usedCuciMachines = new Set()
                          
                          for (let i = 0; i < serviceCounts['Cuci']; i++) {
                            // Find next available machine that's not already used by this or other transactions
                            let machineIndex = (startMachineIndex + i) % machines.cuci.length
                            let attempts = 0
                            
                            // Check both: same transaction collision AND cross-transaction collision
                            while (attempts < machines.cuci.length) {
                              const targetMachine = machines.cuci[machineIndex]
                              const now = new Date()
                              
                              // Check if this machine is already used by this transaction
                              const usedByThisTransaction = usedCuciMachines.has(machineIndex)
                              
                              // Check if this machine has conflicting tasks from other transactions
                              const hasConflictingTasks = targetMachine.queue.some(existingTask => {
                                return existingTask.transaction !== transaction.kode &&
                                       existingTask.finishTime > now
                              })
                              
                              // Check if machine is available (not rusak or maintenance)
                              const machineAvailable = targetMachine.status_real === 'tersedia' || targetMachine.status_real === 'digunakan'
                              
                              // If no conflicts and machine is available, use this machine
                              if (!usedByThisTransaction && !hasConflictingTasks && machineAvailable) {
                                break
                              }
                              
                              // Try next machine
                              machineIndex = (machineIndex + 1) % machines.cuci.length
                              attempts++
                            }
                            
                            usedCuciMachines.add(machineIndex)
                            const targetMachine = machines.cuci[machineIndex]
                            
                            // Service starts at transaction time and runs for fixed duration
                            const serviceStartTime = new Date(transactionDate.getTime())
                            const serviceFinishTime = new Date(serviceStartTime.getTime() + 15 * 60 * 1000)
                            
                            targetMachine.queue.push({
                              transaction: transaction.kode,
                              service: 'Cuci',
                              duration: 15,
                              startTime: serviceStartTime,
                              finishTime: serviceFinishTime
                            })
                            
                            // Update machine finish time only if this service finishes later
                            if (serviceFinishTime > targetMachine.currentFinishTime) {
                              targetMachine.currentFinishTime = serviceFinishTime
                            }
                          }
                        }
                        
                        // Assign Bilas services (use same machines as Cuci for sequential processing)
                        if (serviceCounts['Bilas']) {
                          const startMachineIndex = transactionHash % machines.cuci.length
                          for (let i = 0; i < serviceCounts['Bilas']; i++) {
                            const machineIndex = (startMachineIndex + i) % machines.cuci.length
                            const targetMachine = machines.cuci[machineIndex]
                            
                            // Bilas starts after Cuci finishes (or immediately if no Cuci)
                            const hasCuci = serviceCounts['Cuci'] && serviceCounts['Cuci'] > 0
                            const serviceStartTime = hasCuci 
                              ? new Date(transactionDate.getTime() + 15 * 60 * 1000)  // After Cuci (15 min delay)
                              : new Date(transactionDate.getTime())                    // Immediately if no Cuci
                            const serviceFinishTime = new Date(serviceStartTime.getTime() + 7 * 60 * 1000)
                            
                            targetMachine.queue.push({
                              transaction: transaction.kode,
                              service: 'Bilas',
                              duration: 7,
                              startTime: serviceStartTime,
                              finishTime: serviceFinishTime
                            })
                            
                            // Update machine finish time
                            if (serviceFinishTime > targetMachine.currentFinishTime) {
                              targetMachine.currentFinishTime = serviceFinishTime
                            }
                          }
                        }
                        
                        // Assign Kering services to consecutive machines starting from hash position
                        if (serviceCounts['Kering']) {
                          const startMachineIndex = transactionHash % machines.pengering.length
                          const usedKeringMachines = new Set()
                          
                          for (let i = 0; i < serviceCounts['Kering']; i++) {
                            // Find next available machine that's not already used by this or other transactions
                            let machineIndex = (startMachineIndex + i) % machines.pengering.length
                            let attempts = 0
                            
                            // Check both: same transaction collision AND cross-transaction collision
                            while (attempts < machines.pengering.length) {
                              const targetMachine = machines.pengering[machineIndex]
                              const now = new Date()
                              
                              // Check if this machine is already used by this transaction
                              const usedByThisTransaction = usedKeringMachines.has(machineIndex)
                              
                              // Check if this machine has conflicting tasks from other transactions
                              const hasConflictingTasks = targetMachine.queue.some(existingTask => {
                                return existingTask.transaction !== transaction.kode &&
                                       existingTask.finishTime > now
                              })
                              
                              // Check if machine is available (not rusak or maintenance)
                              const machineAvailable = targetMachine.status_real === 'tersedia' || targetMachine.status_real === 'digunakan'
                              
                              // If no conflicts and machine is available, use this machine
                              if (!usedByThisTransaction && !hasConflictingTasks && machineAvailable) {
                                break
                              }
                              
                              // Try next machine
                              machineIndex = (machineIndex + 1) % machines.pengering.length
                              attempts++
                            }
                            
                            usedKeringMachines.add(machineIndex)
                            const targetMachine = machines.pengering[machineIndex]
                            
                            // Kering timing should match total transaction timing for consistency
                            // If there's Cuci in same transaction, Kering finishes when total transaction finishes
                            const hasCuci = serviceCounts['Cuci'] && serviceCounts['Cuci'] > 0
                            let serviceStartTime, serviceFinishTime
                            
                            if (hasCuci) {
                              // Sequential: Cuci(15) + Kering(45) = 60 minutes total
                              serviceStartTime = new Date(transactionDate.getTime() + 15 * 60 * 1000) // After cuci
                              serviceFinishTime = new Date(transactionDate.getTime() + 60 * 60 * 1000) // Total 60 min
                            } else {
                              // Standalone Kering: 45 minutes
                              serviceStartTime = new Date(transactionDate.getTime())
                              serviceFinishTime = new Date(serviceStartTime.getTime() + 45 * 60 * 1000)
                            }
                            
                            targetMachine.queue.push({
                              transaction: transaction.kode,
                              service: 'Kering',
                              duration: 45,
                              startTime: serviceStartTime,
                              finishTime: serviceFinishTime
                            })
                            
                            // Update machine finish time
                            if (serviceFinishTime > targetMachine.currentFinishTime) {
                              targetMachine.currentFinishTime = serviceFinishTime
                            }
                          }
                        }
                      } catch (err) {
                        console.error('Error processing transaction in simulation:', transaction, err)
                      }
                    })
                    
                    return machines
                  }
                  
                  const simulatedMachines = simulateMachineAssignment()
                  
                  // Helper to get machine status text
                  const getMachineStatusText = (machine) => {
                    const now = new Date()
                    
                    // Check real machine status first
                    if (machine.status_real === 'rusak') {
                      return { status: 'Rusak', class: 'bg-gray-100/80 text-gray-800', time: 'Tidak dapat digunakan' }
                    }
                    if (machine.status_real === 'maintenance') {
                      return { status: 'Maintenance', class: 'bg-yellow-100/80 text-yellow-800', time: 'Sedang diperbaiki' }
                    }
                    
                    // Filter out tasks that are already finished
                    const activeTasks = machine.queue.filter(task => task.finishTime > now)
                    
                    if (activeTasks.length === 0) {
                      return { status: 'Tersedia', class: 'bg-green-100/80 text-green-800', time: 'Siap digunakan' }
                    } else {
                      // Find the latest finish time from active tasks
                      const latestFinishTime = Math.max(...activeTasks.map(task => task.finishTime.getTime()))
                      const finishTime = new Date(latestFinishTime)
                      
                      return {
                        status: 'Digunakan',
                        class: 'bg-red-100/80 text-red-800',
                        time: `Selesai ${finishTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                      }
                    }
                  }
                  
                  return (
                    <div className="space-y-4">
                      {/* Transaksi Aktif*/}
                      {machineData.transactions && machineData.transactions.length > 0 && (() => {
                        const activeTransactionsList = machineData.transactions.filter((transaction) => {
                          const timeInfo = getTransactionTimeRemaining(transaction.time, transaction.services, transaction.transaction_date)
                          return transaction.status !== 'dibatalkan' &&
                                 (timeInfo.isStillRunning && timeInfo.timeRemaining > 0)
                        })

                        if (activeTransactionsList.length === 0) return null

                        return (
                          <div>
                            <div className="bg-white/95 sm:backdrop-blur-md rounded-t-2xl border border-gray-200/50 p-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                  </svg>
                                </div>
                                <div>
                                  <h3 className="text-base font-bold text-gray-900">Transaksi Aktif</h3>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white/95 sm:backdrop-blur-md rounded-b-2xl border border-t-0 border-gray-200/50 shadow-lg">
                              <div className="p-4 space-y-2">
                                {activeTransactionsList.map((transaction, index) => {
                                  const timeInfo = getTransactionTimeRemaining(transaction.time, transaction.services, transaction.transaction_date)
                                  const servicesList = transaction.services.split(', ')
                                  const serviceCounts = {}
                                  servicesList.forEach(service => {
                                    const serviceName = service.trim()
                                    serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1
                                  })

                                  const servicesText = Object.entries(serviceCounts).map(([service, count]) =>
                                    count > 1 ? `${count}x ${service}` : service
                                  ).join(', ')

                                  const customerName = transaction.is_own_transaction
                                    ? `${machineData.customer.nama_pelanggan} (Kamu)`
                                    : transaction.customer
                                  const finishTime = timeInfo.estimatedFinish.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

                                  return (
                                    <div key={index} className={`p-2.5 rounded-lg transition-colors duration-200 ${
                                      transaction.status === 'dibatalkan' ? 'opacity-60 bg-gray-50' :
                                      transaction.is_own_transaction ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100' :
                                      'bg-gray-50 hover:bg-gray-100'
                                    }`}>
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className={`text-sm font-medium ${
                                          transaction.is_own_transaction ? 'text-blue-900' : 'text-gray-900'
                                        }`}>
                                          {customerName}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                          Mulai {transaction.time}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-700">
                                          {servicesText}
                                        </span>
                                        {transaction.status !== 'dibatalkan' && timeInfo.isStillRunning && timeInfo.timeRemaining > 0 && (
                                          <span className="text-sm text-orange-600 font-medium">
                                            Selesai ± {finishTime}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Enhanced Individual Machine Status */}
                      <div className="space-y-4">
                        {/* Cuci Machines */}
                        <div className="bg-white/95 sm:backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/50 p-4">
                          <div className="flex items-center space-x-3 mb-4">
                            <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm2 2a1 1 0 100 2 1 1 0 000-2zm3 0a1 1 0 100 2 1 1 0 000-2zm3 4a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z"/>
                              </svg>
                            </div>
                            <div>
                              <h4 className="text-base font-bold text-gray-900">
                                Mesin Cuci ({simulatedMachines.cuci.filter(m => getMachineStatusText(m).status === 'Tersedia').length}/{simulatedMachines.cuci.length})
                              </h4>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                            {simulatedMachines.cuci.map(machine => {
                              const statusInfo = getMachineStatusText(machine)
                              return (
                                <div key={machine.id} className={`relative rounded-xl border-2 p-3 transition-all duration-300 backdrop-blur-sm hover:scale-105 hover:shadow-lg ${
                                  statusInfo.status === 'Tersedia' ? 'bg-green-50/80 border-green-200 hover:border-green-300' :
                                  statusInfo.status === 'Hampir Selesai' ? 'bg-yellow-50/80 border-yellow-200 hover:border-yellow-300' :
                                  'bg-red-50/80 border-red-200 hover:border-red-300'
                                }`}>
                                  <div className="text-center">
                                    <div className="font-bold text-lg mb-2 text-gray-900">{machine.id}</div>
                                    <div className={`flex items-center justify-center py-2 rounded-lg mb-2 shadow-sm w-full ${
                                      statusInfo.status === 'Tersedia' ? 'bg-green-100 border border-green-200' :
                                      statusInfo.status === 'Hampir Selesai' ? 'bg-yellow-100 border border-yellow-200' :
                                      'bg-red-100 border border-red-200'
                                    }`}>
                                      {statusInfo.status === 'Tersedia' ? (
                                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      ) : statusInfo.status === 'Hampir Selesai' ? (
                                        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-700 font-medium leading-tight">
                                      {statusInfo.status === 'Digunakan'
                                        ? statusInfo.time.replace('Selesai ', 'Selesai ± ')
                                        : statusInfo.time
                                      }
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        
                        {/* Pengering Machines */}
                        <div className="bg-white/95 sm:backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/50 p-4">
                          <div className="flex items-center space-x-3 mb-4">
                            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
                              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm2 2a1 1 0 100 2 1 1 0 000-2zm3 0a1 1 0 100 2 1 1 0 000-2zm3 4a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z"/>
                              </svg>
                            </div>
                            <div>
                              <h4 className="text-base font-bold text-gray-900">
                                Mesin Pengering ({simulatedMachines.pengering.filter(m => getMachineStatusText(m).status === 'Tersedia').length}/{simulatedMachines.pengering.length})
                              </h4>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                            {simulatedMachines.pengering.map(machine => {
                              const statusInfo = getMachineStatusText(machine)
                              return (
                                <div key={machine.id} className={`relative rounded-xl border-2 p-3 transition-all duration-300 backdrop-blur-sm hover:scale-105 hover:shadow-lg ${
                                  statusInfo.status === 'Tersedia' ? 'bg-green-50/80 border-green-200 hover:border-green-300' :
                                  statusInfo.status === 'Hampir Selesai' ? 'bg-yellow-50/80 border-yellow-200 hover:border-yellow-300' :
                                  'bg-red-50/80 border-red-200 hover:border-red-300'
                                }`}>
                                  <div className="text-center">
                                    <div className="font-bold text-lg mb-2 text-gray-900">{machine.id}</div>
                                    <div className={`flex items-center justify-center py-2 rounded-lg mb-2 shadow-sm w-full ${
                                      statusInfo.status === 'Tersedia' ? 'bg-green-100 border border-green-200' :
                                      statusInfo.status === 'Hampir Selesai' ? 'bg-yellow-100 border border-yellow-200' :
                                      'bg-red-100 border border-red-200'
                                    }`}>
                                      {statusInfo.status === 'Tersedia' ? (
                                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      ) : statusInfo.status === 'Hampir Selesai' ? (
                                        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-700 font-medium leading-tight">
                                      {statusInfo.status === 'Digunakan'
                                        ? statusInfo.time.replace('Selesai ', 'Selesai ± ')
                                        : statusInfo.time
                                      }
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Modern Action Buttons */}
              <div className="m-4 sm:m-5">
                {customerValidation.visitedBranches && customerValidation.visitedBranches.length > 1 && (
                  <div className="bg-gray-50/80 sm:backdrop-blur-sm rounded-2xl p-4 border border-gray-200/50">
                    <button
                      onClick={handleBackStep}
                      className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Pilih Cabang Lain
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notification UI removed - handled by Service Worker background monitoring */}
      {false && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform animate-in zoom-in-95 duration-300">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-3xl">🔔</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Aktifkan Notifikasi?
              </h3>
              <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                Dapatkan notifikasi ketika mesin hampir selesai atau ada update status laundry Anda.
                Kami akan mengirim notifikasi langsung ke browser Anda.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => handleNotificationPermission(true)}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  ✅ Ya, Aktifkan Notifikasi
                </button>
                <button
                  onClick={() => handleNotificationPermission(false)}
                  className="w-full border border-gray-300 text-gray-700 font-medium py-3 px-6 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Tidak, Terima Kasih
                </button>
              </div>
              
              <p className="text-xs text-gray-500 mt-4">
                Anda dapat mengubah pengaturan notifikasi kapan saja di browser.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerMachineStatusModal