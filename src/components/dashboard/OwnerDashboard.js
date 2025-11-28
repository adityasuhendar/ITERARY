'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import StatsCard from './StatsCard'
import BranchCard from './BranchCard'
import Card from '@/components/ui/Card'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import SessionExpired from '@/components/ui/SessionExpired'
import PaymentTrendChart from '@/components/charts/PaymentTrendChart'
import EmployeeManagement from '@/components/employees/EmployeeManagement'
import AttendanceReport from '@/components/reports/AttendanceReport'
import StockMonitoring from '@/components/stock/StockMonitoring'
import AuditLog from '@/components/audit/AuditLog'
import CustomerManagement from '@/components/customers/CustomerManagement'
import MachineManagement from '@/components/machines/MachineManagement'
import { useSessionHandler } from '@/hooks/useSessionHandler'

export default function OwnerDashboard({ user }) {
  const router = useRouter()
  const { sessionExpired, handleApiResponse } = useSessionHandler()
  const [showHeader, setShowHeader] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedPeriod, setSelectedPeriod] = useState('today') // today, week, month
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all') // all, tunai, qris
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedDateRange, setSelectedDateRange] = useState({ start: '', end: '' })
  const [filterMode, setFilterMode] = useState('preset')
  const [activeView, setActiveView] = useState('overview') // overview, analytics, customers, accounts, attendance, stock, machines, audit
  const [stockInitialTab, setStockInitialTab] = useState('overview')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    insights: true,
    branches: true,
    machines: false,
    inventory: false
  })
  const [branchDetailLoading, setBranchDetailLoading] = useState(null)

  // Shared cache for analytics data based on state
  const sharedCache = useRef(new Map())

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Cache management functions
  const createCacheKey = (endpoint, params) => {
    const stateParams = {
      period: selectedPeriod,
      paymentMethod: selectedPaymentMethod,
      month: selectedMonth,
      year: selectedYear,
      dateRange: selectedDateRange,
      filterMode: filterMode
    }
    return `${endpoint}_${JSON.stringify({ ...stateParams, ...params })}`
  }

  const getCachedData = (key) => {
    const cached = sharedCache.current.get(key)
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
      return cached.data
    }
    return null
  }

  const setCachedData = (key, data) => {
    sharedCache.current.set(key, {
      data: data,
      timestamp: Date.now()
    })
  }

  // Close mobile menu when view changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [activeView])

  // Handle scroll for header visibility
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (currentScrollY < 10) {
        setShowHeader(true)
      } else if (currentScrollY > lastScrollY) {
        setShowHeader(false)
      } else {
        setShowHeader(true)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  // Function to handle URL parameter processing
  const processUrlParameters = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const view = urlParams.get('view')
      const tab = urlParams.get('tab')
      
      
      if (view === 'stock') {
        setActiveView('stock')
        
        // Set initial tab for StockMonitoring
        if (tab === 'requests') {
          console.log('✅ Setting stockInitialTab to requests')
          setStockInitialTab('requests')
        } else if (tab === 'products') {
          setStockInitialTab('products')
        } else {
          setStockInitialTab('overview')
        }
      }
    }
  }

  // Check URL parameters on mount
  useEffect(() => {
    processUrlParameters()
  }, [])

  // Listen for navigation events (including router.push)
  useEffect(() => {
    const handleRouteChange = () => {
      // Small delay to ensure URL is updated
      setTimeout(processUrlParameters, 50)
    }

    // Listen for both popstate and custom navigation events
    window.addEventListener('popstate', handleRouteChange)
    
    // Create a custom listener for programmatic navigation
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args)
      handleRouteChange()
    }
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args)
      handleRouteChange()
    }

    return () => {
      window.removeEventListener('popstate', handleRouteChange)
      history.pushState = originalPushState
      history.replaceState = originalReplaceState
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [selectedPeriod, selectedPaymentMethod]) // Re-fetch when filters change

  const fetchDashboardData = async (forceRefresh = false) => {
    try {
      // Check if we're in browser environment
      if (typeof window === 'undefined') {
        setError('Not in browser environment')
        return
      }

      // Create cache key including filter parameters
      const cacheKey = createCacheKey('dashboard', {
        period: selectedPeriod,
        payment_method: selectedPaymentMethod
      })
      
      // Check cache first (skip if force refresh)
      if (!forceRefresh) {
        const cachedData = getCachedData(cacheKey)
        
        if (cachedData) {
          setDashboardData(cachedData)
          setError(null)
          return
        }
      }

      // Add filter parameters to API call
      const params = new URLSearchParams({
        period: selectedPeriod,
        payment_method: selectedPaymentMethod
      })
      const response = await fetch(`/api/dashboard/owner?${params}`)

      // Handle session expiration
      const handledResponse = await handleApiResponse(response)
      if (!handledResponse) {
        return // Session expired, handler will show SessionExpired component
      }

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()
      
      // Cache the data
      setCachedData(cacheKey, data)
      
      setDashboardData(data)
      setError(null)
    } catch (err) {
      setError(err.message)
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0)
  }

  const formatCompactCurrency = (amount) => {
    if (!amount) return 'Rp 0'

    if (amount >= 1000000000) { // 1 Miliar+
      return `Rp ${(amount / 1000000000).toFixed(1)}M`
    } else if (amount >= 1000000) { // 1 Juta+
      return `Rp ${(amount / 1000000).toFixed(1)}Jt`
    } else if (amount >= 1000) { // 1 Ribu+
      return `Rp ${(amount / 1000).toFixed(0)}rb`
    } else {
      return `Rp ${amount}`
    }
  }

  const formatResponsiveCurrency = (amount) => {
    // Mobile: format lengkap, Desktop: format compact
    return (
      <>
        <span className="sm:hidden">{formatCurrency(amount)}</span>
        <span className="hidden sm:inline">{formatCompactCurrency(amount)}</span>
      </>
    )
  }

  const handleViewBranchDetails = (branch) => {
    console.log('handleViewBranchDetails called with:', branch)
    try {
      if (router && router.push && branch && branch.id_cabang) {
        setBranchDetailLoading(branch.id_cabang)
        router.push(`/dashboard/branch/${branch.id_cabang}`)
        
        // Fallback timeout to reset loading state after 10 seconds
        setTimeout(() => {
          setBranchDetailLoading(null)
        }, 10000)
      } else {
        console.error('Router or branch data unavailable:', { router, branch })
      }
    } catch (error) {
      console.error('Error in handleViewBranchDetails:', error)
      setBranchDetailLoading(null)
    }
  }

  // Show session expired page if token is invalid
  if (sessionExpired) {
    return <SessionExpired />
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-200 animate-pulse rounded-lg h-32"></div>
          ))}
        </div>
        <div className="bg-gray-200 animate-pulse rounded-lg h-96"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="mb-4">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="text-red-600 text-lg font-medium mb-2">Oops! Ada masalah</div>
          <div className="text-gray-600 mb-4">{error}</div>
        </div>
        {!error.includes('login') && !error.includes('Access denied') && (
          <button 
            onClick={() => fetchDashboardData(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Coba Lagi
          </button>
        )}
      </div>
    )
  }

  if (!dashboardData) return null

  const { daily_stats, monthly_stats, branch_performance, inventory_alerts } = dashboardData

  return (
    <ErrorBoundary>
      <div className="bg-white">
      {/* Mobile Header - Fixed with hide on scroll */}
      <div className={`lg:hidden fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-200 z-40 transition-transform duration-300 ${
        showHeader ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900 text-center">Owner Dashboard</h1>
        </div>
      </div>

      {/* Desktop Header - Static */}
      <div className="hidden lg:block bg-white border-b border-gray-200 mb-8">
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-center overflow-x-auto">
            <div className="flex space-x-6 min-w-max">
                  <button
                    onClick={() => {
                      setActiveView('overview')
                      // Clear URL params and hash
                      window.history.replaceState({}, '', '/dashboard')
                    }}
                    className={`px-3 py-4 text-sm font-medium transition-all duration-200 whitespace-nowrap relative ${
                      activeView === 'overview'
                        ? 'text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📊 Overview
                    {activeView === 'overview' && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('analytics')
                      // Clear URL params and hash
                      window.history.replaceState({}, '', '/dashboard')
                    }}
                    className={`px-3 py-4 text-sm font-medium transition-all duration-200 whitespace-nowrap relative ${
                      activeView === 'analytics'
                        ? 'text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📈 Analytics
                    {activeView === 'analytics' && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('stock')
                      // Keep URL params for stock because it has sub-tabs
                    }}
                    className={`px-3 py-4 text-sm font-medium transition-all duration-200 whitespace-nowrap relative ${
                      activeView === 'stock'
                        ? 'text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📦 Monitoring Stok
                    {activeView === 'stock' && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
                    )}
                    {(() => {
                      if (!inventory_alerts || inventory_alerts.length === 0) return null
                      const criticalItems = inventory_alerts.filter(item =>
                        item.alert_level === 'out_of_stock' || item.alert_level === 'critical'
                      )
                      const lowItems = inventory_alerts.filter(item =>
                        item.alert_level === 'low'
                      )
                      const totalAlerts = criticalItems.length + lowItems.length
                      if (totalAlerts === 0) return null
                      return (
                        <span className="absolute top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {totalAlerts}
                        </span>
                      )
                    })()}
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('customers')
                      // Clear URL params and hash
                      window.history.replaceState({}, '', '/dashboard')
                    }}
                    className={`px-3 py-4 text-sm font-medium transition-all duration-200 whitespace-nowrap relative ${
                      activeView === 'customers'
                        ? 'text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    👥 Pelanggan
                    {activeView === 'customers' && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('accounts')
                      // Clear URL params and hash
                      window.history.replaceState({}, '', '/dashboard')
                    }}
                    className={`px-3 py-4 text-sm font-medium transition-all duration-200 whitespace-nowrap relative ${
                      activeView === 'accounts'
                        ? 'text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🔐 Kelola Akun
                    {activeView === 'accounts' && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('attendance')
                      // Clear URL params and hash
                      window.history.replaceState({}, '', '/dashboard')
                    }}
                    className={`px-3 py-4 text-sm font-medium transition-all duration-200 whitespace-nowrap relative ${
                      activeView === 'attendance'
                        ? 'text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📅 Kehadiran
                    {activeView === 'attendance' && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('machines')
                      // Clear URL params and hash
                      window.history.replaceState({}, '', '/dashboard')
                    }}
                    className={`px-3 py-4 text-sm font-medium transition-all duration-200 whitespace-nowrap relative ${
                      activeView === 'machines'
                        ? 'text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🏭 Kelola Mesin
                    {activeView === 'machines' && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('audit')
                      // Clear URL params and hash
                      window.history.replaceState({}, '', '/dashboard')
                    }}
                    className={`px-3 py-4 text-sm font-medium transition-all duration-200 whitespace-nowrap relative ${
                      activeView === 'audit'
                        ? 'text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🔍 Audit Log
                    {activeView === 'audit' && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
                    )}
                  </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 z-50">
        <div className="overflow-x-auto hide-scrollbar">
          <div className="flex min-w-max px-2 py-2">
            <button
              onClick={() => {
                setActiveView('overview')
                window.history.replaceState({}, '', '/dashboard')
              }}
              className={`flex flex-col items-center justify-center px-4 py-2 min-w-[80px] transition-all ${
                activeView === 'overview'
                  ? 'bg-gray-100 rounded-lg shadow-sm'
                  : 'hover:bg-gray-50 rounded-lg'
              }`}
            >
              <span className="text-xl mb-0.5">📊</span>
              <span className={`text-[11px] font-medium whitespace-nowrap ${
                activeView === 'overview' ? 'text-blue-600' : 'text-gray-600'
              }`}>
                Overview
              </span>
            </button>

            <button
              onClick={() => {
                setActiveView('analytics')
                window.history.replaceState({}, '', '/dashboard')
              }}
              className={`flex flex-col items-center justify-center px-4 py-2 min-w-[80px] transition-all ${
                activeView === 'analytics'
                  ? 'bg-gray-100 rounded-lg shadow-sm'
                  : 'hover:bg-gray-50 rounded-lg'
              }`}
            >
              <span className="text-xl mb-0.5">📈</span>
              <span className={`text-[11px] font-medium whitespace-nowrap ${
                activeView === 'analytics' ? 'text-blue-600' : 'text-gray-600'
              }`}>
                Analytics
              </span>
            </button>

            <button
              onClick={() => setActiveView('stock')}
              className={`flex flex-col items-center justify-center px-4 py-2 min-w-[80px] transition-all relative ${
                activeView === 'stock'
                  ? 'bg-gray-100 rounded-lg shadow-sm'
                  : 'hover:bg-gray-50 rounded-lg'
              }`}
            >
              <span className="text-xl mb-0.5">📦</span>
              <span className={`text-[11px] font-medium whitespace-nowrap ${
                activeView === 'stock' ? 'text-blue-600' : 'text-gray-600'
              }`}>
                Stok
              </span>
              {(() => {
                if (!inventory_alerts || inventory_alerts.length === 0) return null
                const criticalItems = inventory_alerts.filter(item =>
                  item.alert_level === 'out_of_stock' || item.alert_level === 'critical'
                )
                const lowItems = inventory_alerts.filter(item =>
                  item.alert_level === 'low'
                )
                const totalAlerts = criticalItems.length + lowItems.length
                if (totalAlerts === 0) return null
                return (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {totalAlerts}
                  </span>
                )
              })()}
            </button>

            <button
              onClick={() => {
                setActiveView('customers')
                window.history.replaceState({}, '', '/dashboard')
              }}
              className={`flex flex-col items-center justify-center px-4 py-2 min-w-[80px] transition-all ${
                activeView === 'customers'
                  ? 'bg-gray-100 rounded-lg shadow-sm'
                  : 'hover:bg-gray-50 rounded-lg'
              }`}
            >
              <span className="text-xl mb-0.5">👥</span>
              <span className={`text-[11px] font-medium whitespace-nowrap ${
                activeView === 'customers' ? 'text-blue-600' : 'text-gray-600'
              }`}>
                Pelanggan
              </span>
            </button>

            <button
              onClick={() => {
                setActiveView('accounts')
                window.history.replaceState({}, '', '/dashboard')
              }}
              className={`flex flex-col items-center justify-center px-4 py-2 min-w-[80px] transition-all ${
                activeView === 'accounts'
                  ? 'bg-gray-100 rounded-lg shadow-sm'
                  : 'hover:bg-gray-50 rounded-lg'
              }`}
            >
              <span className="text-xl mb-0.5">🔐</span>
              <span className={`text-[11px] font-medium whitespace-nowrap ${
                activeView === 'accounts' ? 'text-blue-600' : 'text-gray-600'
              }`}>
                Akun
              </span>
            </button>

            <button
              onClick={() => {
                setActiveView('attendance')
                window.history.replaceState({}, '', '/dashboard')
              }}
              className={`flex flex-col items-center justify-center px-4 py-2 min-w-[80px] transition-all ${
                activeView === 'attendance'
                  ? 'bg-gray-100 rounded-lg shadow-sm'
                  : 'hover:bg-gray-50 rounded-lg'
              }`}
            >
              <span className="text-xl mb-0.5">📅</span>
              <span className={`text-[11px] font-medium whitespace-nowrap ${
                activeView === 'attendance' ? 'text-blue-600' : 'text-gray-600'
              }`}>
                Kehadiran
              </span>
            </button>

            <button
              onClick={() => {
                setActiveView('machines')
                window.history.replaceState({}, '', '/dashboard')
              }}
              className={`flex flex-col items-center justify-center px-4 py-2 min-w-[80px] transition-all ${
                activeView === 'machines'
                  ? 'bg-gray-100 rounded-lg shadow-sm'
                  : 'hover:bg-gray-50 rounded-lg'
              }`}
            >
              <span className="text-xl mb-0.5">🏭</span>
              <span className={`text-[11px] font-medium whitespace-nowrap ${
                activeView === 'machines' ? 'text-blue-600' : 'text-gray-600'
              }`}>
                Mesin
              </span>
            </button>

            <button
              onClick={() => {
                setActiveView('audit')
                window.history.replaceState({}, '', '/dashboard')
              }}
              className={`flex flex-col items-center justify-center px-4 py-2 min-w-[80px] transition-all ${
                activeView === 'audit'
                  ? 'bg-gray-100 rounded-lg shadow-sm'
                  : 'hover:bg-gray-50 rounded-lg'
              }`}
            >
              <span className="text-xl mb-0.5">🔍</span>
              <span className={`text-[11px] font-medium whitespace-nowrap ${
                activeView === 'audit' ? 'text-blue-600' : 'text-gray-600'
              }`}>
                Audit
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-20 lg:pb-8 space-y-3 lg:space-y-8">
        {/* Conditional Content Based on Active View */}
        {activeView === 'overview' && (
          <>
            {/* Mobile Bubble Filters - Periode Only */}
            <div className="lg:hidden mb-6">
              <div className="flex gap-2 px-4">
                {[
                  { value: 'today', label: 'Hari Ini' },
                  { value: 'week', label: '7 Hari' },
                  { value: 'month', label: '30 Hari' }
                ].map((period) => (
                  <button
                    key={period.value}
                    onClick={() => setSelectedPeriod(period.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      selectedPeriod === period.value
                        ? 'bg-red-500 text-white shadow-sm'
                        : 'bg-white text-gray-600 border border-gray-300 hover:border-red-400 hover:text-red-600 active:bg-gray-50'
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters Section - Desktop Only */}
            <Card className="hidden lg:block p-4 bg-gray-50 border border-gray-200">
              <div className="flex flex-col space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Period Filter */}
                  <div className="flex flex-col">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Periode</label>
                    <select
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="today">Hari Ini</option>
                      <option value="week">7 Hari Terakhir</option>
                      <option value="month">30 Hari Terakhir</option>
                    </select>
                  </div>

                  {/* Payment Method Filter */}
                  <div className="flex flex-col">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Metode Pembayaran</label>
                    <select
                      value={selectedPaymentMethod}
                      onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">Semua Metode</option>
                      <option value="tunai">💰 Tunai</option>
                      <option value="qris">📱 QRIS</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 pt-3 border-t border-gray-200">
                  <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                    Update terakhir: {new Date(dashboardData.last_updated).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                  </div>
                  <button
                    onClick={() => fetchDashboardData(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>
            </Card>

            {/* Enhanced Revenue Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Pendapatan Hari Ini Card */}
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-green-100 text-xs sm:text-sm font-medium">
                      {selectedPeriod === 'today' ? 'Pendapatan Hari Ini' :
                       selectedPeriod === 'week' ? 'Pendapatan 7 Hari' :
                       'Pendapatan 30 Hari'}
                    </p>
                    <div className="relative group">
                      <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 truncate sm:cursor-help">
                        {formatResponsiveCurrency(daily_stats.today_revenue || daily_stats.total_revenue)}
                      </p>
                      <div className="hidden sm:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                        Detail: {formatCurrency(daily_stats.today_revenue || daily_stats.total_revenue)}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                      </div>
                    </div>
                    <p className="text-green-100 text-xs sm:text-sm mt-1">
                      {daily_stats.today_transactions || daily_stats.total_transactions} transaksi
                    </p>
                    {monthly_stats.growth_percentage > 0 && (
                      <div className="flex items-center mt-1 space-x-1">
                        <span className="text-green-200 text-sm">📈</span>
                        <span className="text-green-200 text-xs">+{monthly_stats.growth_percentage}%</span>
                      </div>
                    )}
                  </div>
                  <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">💵</div>
                </div>
              </Card>

              {/* Pendapatan Tunai Card */}
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-blue-100 text-xs sm:text-sm font-medium">
                      {selectedPeriod === 'today' ? 'Tunai Hari Ini' :
                       selectedPeriod === 'week' ? 'Tunai 7 Hari' :
                       'Tunai 30 Hari'}
                    </p>
                    <div className="relative group">
                      <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 sm:cursor-help">
                        {formatResponsiveCurrency(daily_stats.cash_revenue || 0)}
                      </p>
                      <div className="hidden sm:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                        Detail: {formatCurrency(daily_stats.cash_revenue || 0)}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                      </div>
                    </div>
                    <p className="text-blue-100 text-xs sm:text-sm mt-1">
                      {daily_stats.cash_transactions || 0} transaksi
                    </p>
                  </div>
                  <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">💰</div>
                </div>
              </Card>

              {/* Pendapatan QRIS Card */}
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-red-500 to-red-600 text-white border-0 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-red-100 text-xs sm:text-sm font-medium">
                      {selectedPeriod === 'today' ? 'QRIS Hari Ini' :
                       selectedPeriod === 'week' ? 'QRIS 7 Hari' :
                       'QRIS 30 Hari'}
                    </p>
                    <div className="relative group">
                      <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 sm:cursor-help">
                        {formatResponsiveCurrency(daily_stats.qris_revenue || 0)}
                      </p>
                      <div className="hidden sm:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                        Detail: {formatCurrency(daily_stats.qris_revenue || 0)}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                      </div>
                    </div>
                    <p className="text-red-100 text-xs sm:text-sm mt-1">
                      {daily_stats.qris_transactions || 0} transaksi
                    </p>
                  </div>
                  <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">📱</div>
                </div>
              </Card>

              {/* Total Pelanggan Card */}
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-purple-100 text-xs sm:text-sm font-medium">
                      {selectedPeriod === 'today' ? 'Pelanggan Hari Ini' :
                       selectedPeriod === 'week' ? 'Pelanggan 7 Hari' :
                       'Pelanggan 30 Hari'}
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">
                      {daily_stats.unique_customers}
                    </p>
                    <div className="relative group">
                      <p className="text-purple-100 text-xs sm:text-sm mt-1 truncate sm:cursor-help">
                        Avg: {formatResponsiveCurrency(daily_stats.avg_transaction)}
                      </p>
                      <div className="hidden sm:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                        Detail Avg: {formatCurrency(daily_stats.avg_transaction)}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                      </div>
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">👥</div>
                </div>
              </Card>
            </div>
          </>
        )}

        {activeView === 'overview' && (
          <>
            {/* Branch Cards Grid */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-2 sm:space-y-0">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
                    🏪 Performa Cabang
                  </h3>
                </div>
                <div className="flex items-center">
                  <div className="text-xs sm:text-sm text-gray-600 px-3 py-1 bg-gray-100 rounded-full">
                    {branch_performance.length} cabang aktif
                  </div>
                </div>
              </div>

              {/* Mobile: Horizontal Scroll */}
              <div className="lg:hidden overflow-x-auto hide-scrollbar -mx-4 px-4">
                <div className="flex gap-4 pb-2">
                  {branch_performance.map((branch) => (
                    <div key={branch.id_cabang} className="flex-shrink-0 w-[280px]">
                      <BranchCard
                        branch={{
                          ...branch,
                          is_active: true
                        }}
                        onViewDetails={handleViewBranchDetails}
                        isLoading={branchDetailLoading === branch.id_cabang}
                        selectedPeriod={selectedPeriod}
                        selectedPaymentMethod={selectedPaymentMethod}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop: Grid */}
              <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                {branch_performance.map((branch) => (
                  <div key={branch.id_cabang} className="transform hover:scale-105 transition-transform duration-200">
                    <BranchCard
                      branch={{
                        ...branch,
                        is_active: true
                      }}
                      onViewDetails={handleViewBranchDetails}
                      isLoading={branchDetailLoading === branch.id_cabang}
                      selectedPeriod={selectedPeriod}
                      selectedPaymentMethod={selectedPaymentMethod}
                    />
                  </div>
                ))}
              </div>
            </div>


          </>
        )}

        {activeView === 'analytics' && (
          <div className="space-y-6 sm:space-y-8">
            {/* Filters Section - Enhanced Responsive */}
            <Card className="p-3 sm:p-4 lg:p-6 bg-gradient-to-r from-white to-blue-50 border-0 shadow-lg">
              <div className="flex flex-col space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* Period Filter */}
                  <div className="flex flex-col">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Periode</label>
                    <select
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                      className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-xs sm:text-sm min-h-[40px]"
                    >
                      <option value="today">Hari Ini</option>
                      <option value="week">7 Hari Terakhir</option>
                      <option value="month">30 Hari Terakhir</option>
                    </select>
                  </div>

                  {/* Payment Method Filter */}
                  <div className="flex flex-col">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Metode Pembayaran</label>
                    <select
                      value={selectedPaymentMethod}
                      onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                      className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-xs sm:text-sm min-h-[40px]"
                    >
                      <option value="all">Semua Metode</option>
                      <option value="tunai">💰 Tunai</option>
                      <option value="qris">📱 QRIS</option>
                    </select>
                  </div>

                  {/* Month Filter */}
                  <div className="flex flex-col">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Filter Bulan</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-xs sm:text-sm min-h-[40px]"
                    >
                      <option value="">Semua Bulan</option>
                      <option value="01">Januari</option>
                      <option value="02">Februari</option>
                      <option value="03">Maret</option>
                      <option value="04">April</option>
                      <option value="05">Mei</option>
                      <option value="06">Juni</option>
                      <option value="07">Juli</option>
                      <option value="08">Agustus</option>
                      <option value="09">September</option>
                      <option value="10">Oktober</option>
                      <option value="11">November</option>
                      <option value="12">Desember</option>
                    </select>
                  </div>

                  {/* Year Filter */}
                  <div className="flex flex-col">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Filter Tahun</label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-xs sm:text-sm min-h-[40px]"
                    >
                      <option value="">Semua Tahun</option>
                      <option value="2025">2025</option>
                    </select>
                  </div>
                </div>

                {/* Date Range Filter - Only show when custom mode */}
                {filterMode === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="flex flex-col">
                      <label className="text-xs sm:text-sm font-medium text-gray-700 mb-2">📅 Tanggal Mulai</label>
                      <input
                        type="date"
                        value={selectedDateRange.start}
                        onChange={(e) => setSelectedDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-xs sm:text-sm min-h-[40px]"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs sm:text-sm font-medium text-gray-700 mb-2">📅 Tanggal Selesai</label>
                      <input
                        type="date"
                        value={selectedDateRange.end}
                        onChange={(e) => setSelectedDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-xs sm:text-sm min-h-[40px]"
                      />
                    </div>
                  </div>
                )}

              </div>
            </Card>

            {/* Payment Trend Chart - Full Width */}
            <PaymentTrendChart 
              period={selectedPeriod} 
              paymentMethod={selectedPaymentMethod}
              month={selectedMonth}
              year={selectedYear}
              dateRange={selectedDateRange}
              getCachedData={getCachedData}
              setCachedData={setCachedData}
              createCacheKey={createCacheKey}
            />
          </div>
        )}


        {activeView === 'customers' && (
          <div className="space-y-4 sm:space-y-6">
            {/* <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">👥 Kelola Pelanggan</h2>
                <p className="text-gray-600">Manajemen data pelanggan dan loyalty program</p>
              </div>
            </div> */}
            
            <CustomerManagement
              user={user}
              cacheConfig={{ enabled: true, timeout: 120000 }} // 2 minutes cache for owner
            />
          </div>
        )}

        {activeView === 'accounts' && (
          <EmployeeManagement 
            cacheConfig={{ enabled: true, timeout: 300000 }} // 5 minutes cache for owner
          />
        )}

        {activeView === 'attendance' && (
          <AttendanceReport 
            cacheConfig={{ enabled: true, timeout: 120000 }} // 2 minutes cache
          />
        )}


        {activeView === 'stock' && (
          <StockMonitoring initialTab={stockInitialTab} />
        )}

        {activeView === 'machines' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="border-b border-gray-200 pb-4 mb-6">
                <h2 className="text-xl font-semibold text-gray-900">🏭 Kelola Mesin</h2>
                <p className="text-gray-600">Manajemen mesin cuci dan pengering untuk semua cabang</p>
              </div>

              <MachineManagement
                cacheConfig={{ enabled: true, timeout: 180000 }} // 3 minutes cache for machines
              />
            </div>
          </div>
        )}


        {activeView === 'audit' && (
          <AuditLog />
        )}

      </div>
    </div>
    </ErrorBoundary>
  )
}