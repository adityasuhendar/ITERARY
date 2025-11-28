'use client'

import { useState, useEffect, useRef } from 'react'
import StatsCard from './StatsCard'
import BranchCard from './BranchCard'
import Card from '@/components/ui/Card'
import SessionExpired from '@/components/ui/SessionExpired'
import { useSessionHandler } from '@/hooks/useSessionHandler'

export default function InvestorDashboard({ user }) {
  const { sessionExpired, handleApiResponse } = useSessionHandler()
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedPeriod, setSelectedPeriod] = useState('today')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all')
  const [expandedSections, setExpandedSections] = useState({
    branches: true
  })
  const [branchDetailLoading, setBranchDetailLoading] = useState(null)

  // Login time
  const [loginTime] = useState(new Date())

  // Get allowed branches from dashboard data (API sudah filter)
  const allowedBranches = dashboardData?.branch_performance || []

  // Cache management - sama seperti OwnerDashboard
  const sharedCache = useRef(new Map())

  // Cache functions
  const createCacheKey = (endpoint, params) => {
    const stateParams = {
      period: selectedPeriod,
      paymentMethod: selectedPaymentMethod
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

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleViewBranchDetails = (branch) => {
    setBranchDetailLoading(branch.id_cabang)

    // Redirect to branch detail page
    setTimeout(() => {
      setBranchDetailLoading(null)
      window.location.href = `/dashboard/branch/${branch.id_cabang}`
    }, 500)
  }

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
      const cacheKey = createCacheKey('investor-dashboard', {
        period: selectedPeriod,
        payment_method: selectedPaymentMethod
      })

      // Check cache first (skip if force refresh)
      if (!forceRefresh) {
        const cachedData = getCachedData(cacheKey)

        if (cachedData) {
          setDashboardData(cachedData)
          setError(null)
          return // Return early, no loading state change
        }
      }

      // Don't set loading state during fetch - let data persist
      // setLoading hanya di initial state dan finally

      const queryParams = new URLSearchParams({
        period: selectedPeriod,
        payment_method: selectedPaymentMethod
      })

      const response = await fetch(`/api/dashboard/investor?${queryParams}`)

      // Handle session expiration - sama seperti OwnerDashboard
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

      // Data sudah filtered di API, tidak perlu filter lagi
      setDashboardData(data)
      setError(null)
    } catch (err) {
      setError(err.message)
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Show session expired page if token is invalid - sama seperti OwnerDashboard
  if (sessionExpired) {
    return <SessionExpired />
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

    if (amount >= 1000000000) {
      return `Rp ${(amount / 1000000000).toFixed(1)}M`
    } else if (amount >= 1000000) {
      return `Rp ${(amount / 1000000).toFixed(1)}jt`
    } else if (amount >= 1000) {
      return `Rp ${(amount / 1000).toFixed(0)}rb`
    } else {
      return `Rp ${amount.toLocaleString('id-ID')}`
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

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 animate-pulse rounded-lg h-24 sm:h-32"></div>
          ))}
        </div>
        <div className="bg-gray-200 animate-pulse rounded-lg h-64 sm:h-96"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-6 sm:py-8 px-4">
        <div className="mb-4">
          <svg className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="text-red-600 text-base sm:text-lg font-medium mb-2">Oops! Ada masalah</div>
          <div className="text-gray-600 text-sm sm:text-base mb-4 max-w-md mx-auto">{error}</div>
        </div>
        {!error.includes('login') && !error.includes('Access denied') && (
          <button
            onClick={fetchDashboardData}
            className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
          >
            Coba Lagi
          </button>
        )}
      </div>
    )
  }

  if (!dashboardData) return null

  const { daily_stats, branch_performance } = dashboardData

  return (
    <div className="px-4 sm:px-6 pb-6 sm:pb-8 space-y-6 sm:space-y-8">
      {/* Header tanpa Bell Notification */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Selamat datang {user.name}! 👋</h1>
            <p className="text-sm text-gray-600">
              Cabang {allowedBranches.length > 0
                ? allowedBranches.map(branch => branch.nama_cabang || branch.name).join(', ')
                : 'Loading...'
              }
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-xs text-gray-500">Login pada</div>
              <div className="text-sm font-medium text-gray-900">
                {loginTime.toLocaleString('id-ID', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bubble Filters - Gojek/Tokped Style */}
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
              <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 truncate">
                {formatResponsiveCurrency(daily_stats.total_revenue)}
              </p>
              <p className="text-green-100 text-xs sm:text-sm mt-1">
                {daily_stats.total_transactions} transaksi
              </p>
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
              <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">
                {formatResponsiveCurrency(daily_stats.total_tunai || 0)}
              </p>
              <p className="text-blue-100 text-xs sm:text-sm mt-1">
                {Math.round((daily_stats.total_tunai / daily_stats.total_revenue) * 100) || 0}% dari total
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
              <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">
                {formatResponsiveCurrency(daily_stats.total_qris || 0)}
              </p>
              <p className="text-red-100 text-xs sm:text-sm mt-1">
                {Math.round((daily_stats.total_qris / daily_stats.total_revenue) * 100) || 0}% dari total
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
              <p className="text-purple-100 text-xs sm:text-sm mt-1 truncate">
                Avg: {formatResponsiveCurrency(daily_stats.avg_transaction)}
              </p>
            </div>
            <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">👥</div>
          </div>
        </Card>
      </div>

      {/* Branch Cards Grid */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
              🏪 Performa Cabang
            </h3>
            <button
              onClick={() => toggleSection('branches')}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <span className={`text-lg transition-transform duration-200 ${expandedSections.branches ? 'rotate-90' : ''}`}>
                ▶️
              </span>
            </button>
          </div>
          <div className="flex items-center">
            <div className="text-xs sm:text-sm text-gray-600 px-3 py-1 bg-gray-100 rounded-full">
              {branch_performance.length} cabang aktif
            </div>
          </div>
        </div>
        {expandedSections.branches && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {branch_performance.map((branch) => (
            <div key={branch.id_cabang} className="transform hover:scale-105 transition-transform duration-200">
              <BranchCard
                branch={{
                  ...branch,
                  active_machines: 0, // Investor tidak perlu data mesin detail
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
        )}
      </div>

    </div>
  )
}