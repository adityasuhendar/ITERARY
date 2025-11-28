'use client'

import { useState, useEffect, useRef } from 'react'
import StatsCard from './StatsCard'
import Card from '@/components/ui/Card'
import StockRequestsManager from '@/components/stock/StockRequestsManager'
import StockMonitoring from '@/components/stock/StockMonitoring'
import BranchRevenueBreakdown from '@/components/dashboard/BranchRevenueBreakdown'
import ExpenseManagement from '@/components/expenses/ExpenseManagement'

export default function CollectorDashboard({ user }) {
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeView, setActiveView] = useState('dashboard')
  const [loginTime] = useState(new Date())

  // State for branch detail view
  const [selectedBranchId, setSelectedBranchId] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }))
  const [branchData, setBranchData] = useState(null)
  const [branchLoading, setBranchLoading] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(true)

  // Helper to change view and clear hash
  const changeView = (view) => {
    setActiveView(view)
    if (view !== 'stock-monitoring') {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }

  // Notification states
  const [showNotifications, setShowNotifications] = useState(false)
  const [pendingRequests, setPendingRequests] = useState(0)
  const [recentRequests, setRecentRequests] = useState([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const notificationRef = useRef(null)

  // Visited branches tracking
  const [visitedBranches, setVisitedBranches] = useState(() => {
    if (typeof window !== 'undefined') {
      const today = new Date().toISOString().split('T')[0]
      const stored = localStorage.getItem('visitedBranches')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.date === today) {
          return parsed.branches
        }
      }
    }
    return []
  })
  const [showCompletionModal, setShowCompletionModal] = useState(false)

  useEffect(() => {
    fetchDashboardData()
    // AUTO REFRESH DISABLED - preventing forced logout on token expiry
    // const interval = setInterval(fetchDashboardData, 120000)
    // return () => clearInterval(interval)
  }, [])

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch notifications for collector
  useEffect(() => {
    if (user && user.jenis_karyawan === 'collector') {
      fetchNotifications()
      // Auto refresh every 5 minutes
      const interval = setInterval(fetchNotifications, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [user?.id, user?.jenis_karyawan])

  // Fetch branch data when branch selected or date changed
  useEffect(() => {
    if (selectedBranchId && selectedDate && activeView === 'branch-revenue') {
      fetchBranchData()
    }
  }, [selectedBranchId, selectedDate, activeView])

  const fetchBranchData = async () => {
    try {
      setBranchLoading(true)
      const params = new URLSearchParams({
        date_from: selectedDate,
        date_to: selectedDate
      })

      const response = await fetch(`/api/dashboard/branch/${selectedBranchId}?${params}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch branch data')
      }

      const data = await response.json()
      setBranchData(data)
    } catch (err) {
      console.error('Error fetching branch data:', err)
      setBranchData(null)
    } finally {
      setBranchLoading(false)
    }
  }

  // Generate date options for last 5 days (including today)
  const getDateOptions = () => {
    const dates = []
    const now = new Date()
    for (let i = 0; i <= 4; i++) {
      const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000))
      const dateString = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      let label
      if (i === 0) {
        label = 'Hari Ini'
      } else if (i === 1) {
        label = 'Kemarin'
      } else {
        label = date.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          timeZone: 'Asia/Jakarta'
        })
      }
      dates.push({ value: dateString, label })
    }
    return dates
  }

  const fetchDashboardData = async () => {
    try {
      // Check if we're in browser environment
      if (typeof window === 'undefined') {
        setError('Not in browser environment')
        return
      }

      const response = await fetch('/api/dashboard/collector')

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('user')
          window.location.href = '/'
          throw new Error('Session expired. Please login again.')
        }
        if (response.status === 403) {
          throw new Error('Access denied. Collector role required.')
        }
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()
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

  const formatLoginTime = (date) => {
    return date.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    })
  }

  const getCurrentShift = () => {
    const hour = new Date().getHours()
    return hour < 14 ? 'pagi' : 'malam'
  }

  const toggleBranchVisit = (branchName) => {
    const newVisited = visitedBranches.includes(branchName)
      ? visitedBranches.filter(b => b !== branchName)
      : [...visitedBranches, branchName]

    setVisitedBranches(newVisited)

    // Save to localStorage
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem('visitedBranches', JSON.stringify({
      date: today,
      branches: newVisited
    }))

    // Check if all branches visited
    if (newVisited.length === branches.length) {
      setShowCompletionModal(true)
      // Auto reset after showing completion modal
      setTimeout(() => {
        resetVisitedBranches()
      }, 1000) // Reset after 1 second
    }
  }

  const resetVisitedBranches = () => {
    setVisitedBranches([])
    localStorage.removeItem('visitedBranches')
  }

  const branches = [
    { name: 'Tanjung Senang', url: 'https://share.google/whjLF2wMOFzMbD8vL' },
    { name: 'Panglima Polim', url: 'https://share.google/I5JWmhMD1bww5LIzZ' },
    { name: 'Sukarame', url: 'https://share.google/zgddrTY1NG0C6s7eL' },
    { name: 'Korpri', url: 'https://share.google/9NueEMn8IjJEowlze' },
    { name: 'Gedong Meneng', url: 'https://share.google/n5nw7o9PPAUWUhIXE' },
    { name: 'Untung', url: 'https://share.google/QsQqsOt9gT5Fs7wsC' },
    { name: 'Komarudin', url: 'https://maps.app.goo.gl/example' }
  ]

  const getCriticalStockCount = () => {
    if (!dashboardData?.stock_alerts) return 0
    const criticalItems = dashboardData.stock_alerts.filter(item =>
      item.status === 'out_of_stock' || item.status === 'critical'
    )
    return criticalItems.length
  }

  const fetchNotifications = async () => {
    try {
      setLoadingNotifications(true)
      // Use endpoint for pending requests (collector can see what needs approval)
      const response = await fetch('/api/notifications/pending-requests')

      if (response.ok) {
        const data = await response.json()
        setPendingRequests(data.total || 0)
        setRecentRequests(data.recent || [])
      }
    } catch (error) {
      console.error('Error fetching collector notifications:', error)
    } finally {
      setLoadingNotifications(false)
    }
  }

  const getStockStatusColor = (status) => {
    switch (status) {
      case 'out_of_stock': return 'bg-red-50 border-red-200 text-red-800'
      case 'critical': return 'bg-orange-50 border-orange-200 text-orange-800'
      case 'low': return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      default: return 'bg-gray-50 border-gray-200 text-gray-600'
    }
  }

  const getStockStatusIcon = (status) => {
    switch (status) {
      case 'out_of_stock': return '🚨'
      case 'critical': return '⚠️' 
      case 'low': return '📉'
      default: return '📦'
    }
  }

  const getStockStatusText = (status) => {
    switch (status) {
      case 'out_of_stock': return 'Habis'
      case 'critical': return 'Kritis'
      case 'low': return 'Menipis'
      default: return 'Baik'
    }
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

  const { revenue_by_shift, stock_alerts, branch_summary, daily_stats } = dashboardData

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Container */}
      <div className="bg-white shadow-md mx-2 sm:mx-4 mt-2 sm:mt-4 mb-2 sm:mb-4 rounded-lg">

        {/* User Info Section */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-gray-900 text-lg">Dashboard Collector</h1>
              <p className="text-sm text-gray-600">{user?.nama_karyawan || 'Collector'} - {user?.nama_cabang || 'Collector'}</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Notification Bell Icon */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Notifikasi"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>

                  {/* Badge */}
                  {pendingRequests > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                      {pendingRequests > 9 ? '9+' : pendingRequests}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {showNotifications && (
                  <div className="fixed sm:absolute left-1/2 sm:left-auto right-auto sm:right-0 transform -translate-x-1/2 sm:translate-x-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white rounded-lg shadow-lg border border-gray-200 z-[9999]">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">Notifikasi</h3>
                        <span className="text-xs text-gray-500">
                          {loadingNotifications ? 'Loading...' : `${pendingRequests} pending`}
                        </span>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {loadingNotifications ? (
                        <div className="px-4 py-8 text-center text-gray-500">
                          <div className="animate-pulse">Loading...</div>
                        </div>
                      ) : recentRequests.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <span className="text-3xl mb-2 block">✅</span>
                          <p className="text-xs text-gray-500">No pending requests</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {recentRequests.map((request, index) => (
                            <div key={index} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                              <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 mt-1">
                                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-900 font-medium leading-tight">
                                    Request {request.product_name || 'Produk'} - Update Stok
                                  </p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    oleh {request.kasir_name || 'Kasir'} - {request.branch_name || 'Cabang'}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {request.created_at ?
                                      new Date(request.created_at).toLocaleString('id-ID', {
                                        day: '2-digit',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }) :
                                      'Baru saja'
                                    }
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-3 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setShowNotifications(false)
                          changeView('stock-requests')
                        }}
                        className="w-full text-center text-xs text-dwash-red hover:text-red-700 font-medium"
                      >
                        View All Requests ({pendingRequests})
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Login Time */}
              <div className="text-right">
                <div className="text-xs text-gray-500">Login pada</div>
                <div className="text-sm font-medium text-gray-900">
                  {formatLoginTime(loginTime)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Section - Desktop Only */}
        <div className="hidden lg:block px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Desktop Tab Navigation */}
            <div className="flex flex-1 justify-center border-b border-gray-200">
              <div className="flex gap-2">
                <button
                  onClick={() => changeView('dashboard')}
                  className={`px-6 py-3 font-medium text-sm transition-all duration-200 whitespace-nowrap relative ${
                    activeView === 'dashboard'
                      ? 'text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📊 Dashboard
                  {activeView === 'dashboard' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-blue-600"></span>
                  )}
                </button>
                <button
                  onClick={() => changeView('branch-revenue')}
                  className={`px-6 py-3 font-medium text-sm transition-all duration-200 whitespace-nowrap relative ${
                    activeView === 'branch-revenue'
                      ? 'text-purple-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  💰 Pendapatan Cabang
                  {activeView === 'branch-revenue' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-purple-600"></span>
                  )}
                </button>
                <button
                  onClick={() => changeView('stock-monitoring')}
                  className={`px-6 py-3 font-medium text-sm transition-all duration-200 whitespace-nowrap relative ${
                    activeView === 'stock-monitoring'
                      ? 'text-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    📦 Monitoring Stok
                    {getCriticalStockCount() > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {getCriticalStockCount()}
                      </span>
                    )}
                  </span>
                  {activeView === 'stock-monitoring' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-orange-600"></span>
                  )}
                </button>
                <button
                  onClick={() => changeView('stock-requests')}
                  className={`px-6 py-3 font-medium text-sm transition-all duration-200 whitespace-nowrap relative ${
                    activeView === 'stock-requests'
                      ? 'text-red-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    📋 Stock Requests
                    {pendingRequests > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {pendingRequests}
                      </span>
                    )}
                  </span>
                  {activeView === 'stock-requests' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-red-600"></span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-2 sm:p-4 pb-20 lg:pb-6 space-y-8">

      {/* Conditional Content */}
      {activeView === 'dashboard' && (
        <>
      {/* Kunjungan & Lokasi Cabang */}
      <Card className="shadow-sm border border-gray-200">
        <div className="p-4 sm:p-6">
          {/* Header with Progress */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">Kunjungan Cabang</h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="bg-gray-200 rounded-full h-2 w-32 flex-shrink-0">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(visitedBranches.length / branches.length) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
                    {visitedBranches.length}/{branches.length}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={resetVisitedBranches}
              className="px-4 py-2 border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Reset</span>
            </button>
          </div>

          {/* Branch Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {branches.map((branch) => {
              const isVisited = visitedBranches.includes(branch.name)
              return (
                <div key={branch.name} className="relative h-full">
                  {/* Visit Checkbox Indicator */}
                  <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all pointer-events-none"
                    style={{
                      backgroundColor: isVisited ? '#16a34a' : '#fff',
                      border: isVisited ? 'none' : '2px solid #d1d5db'
                    }}
                  >
                    {isVisited && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  {/* Location Card - Click to toggle visit */}
                  <div
                    onClick={() => toggleBranchVisit(branch.name)}
                    className={`h-full bg-white rounded-lg p-4 border transition-all cursor-pointer hover:shadow-md ${
                      isVisited ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="h-full flex flex-col items-center justify-between text-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                        isVisited ? 'bg-green-600' : 'bg-blue-600'
                      }`}>
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1 flex items-center">
                        <h4 className="font-medium text-gray-900 text-sm">{branch.name}</h4>
                      </div>
                      <a
                        href={branch.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`inline-block text-xs font-medium hover:underline ${isVisited ? 'text-green-600' : 'text-blue-600'}`}
                      >
                        {isVisited ? '✓ Dikunjungi' : 'Buka Maps →'}
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 transform animate-bounce">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                🎉 Selamat!
              </h2>
              <p className="text-lg text-gray-700 mb-6">
                Semua cabang telah dikunjungi hari ini!
              </p>
              <div className="flex items-center justify-center space-x-2 mb-6 text-sm text-gray-600">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">{branches.length}/{branches.length} Cabang Selesai</span>
              </div>
              <button
                onClick={() => setShowCompletionModal(false)}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

        </>
      )}

      {/* Stock Monitoring Tab */}
      {activeView === 'stock-monitoring' && (
        <StockMonitoring hideRequestsTab={true} hideFreeProductsTab={true} />
      )}

      {/* Stock Requests Tab */}
      {activeView === 'stock-requests' && (
        <StockRequestsManager showHeader={false} />
      )}

      {/* Branch Revenue Tab - REUSE BranchRevenueBreakdown */}
      {activeView === 'branch-revenue' && (
        <div className="space-y-6">
          {/* Branch Selector */}
          <Card className="p-4 sm:p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              🏢 Pilih Cabang untuk Melihat Detail
            </label>
            <select
              value={selectedBranchId || ''}
              onChange={(e) => setSelectedBranchId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Pilih Cabang --</option>
              {branches.map((branch, idx) => (
                <option key={idx} value={idx + 1}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Card>

          {selectedBranchId && (
            <>
              {/* Date Filter Bubbles */}
              <Card className="p-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  📅 Pilih Tanggal
                </label>
                <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                  {getDateOptions().map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedDate(option.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                        selectedDate === option.value
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </Card>

              {/* Loading State */}
              {branchLoading && (
                <Card className="p-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Memuat data cabang...</p>
                </Card>
              )}

              {/* Revenue Breakdown - REUSE COMPONENT */}
              {!branchLoading && branchData?.revenue_breakdown && (
                <BranchRevenueBreakdown
                  data={branchData.revenue_breakdown}
                  showBreakdown={showBreakdown}
                  onToggle={() => setShowBreakdown(!showBreakdown)}
                />
              )}

              {/* Expense Management - READ ONLY */}
              {!branchLoading && branchData && (
                <Card className="p-4 sm:p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">💸 Pengeluaran Operasional</h3>
                  <p className="text-sm text-gray-600 mb-4">Collector dapat melihat pengeluaran cabang (read-only)</p>
                  <ExpenseManagement
                    cabangId={selectedBranchId}
                    selectedDate={selectedDate}
                    dateRange={{
                      start: selectedDate,
                      end: selectedDate
                    }}
                  />
                </Card>
              )}
            </>
          )}

          {!selectedBranchId && (
            <Card className="p-12 text-center">
              <div className="text-6xl mb-4">🏢</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Pilih Cabang</h3>
              <p className="text-gray-600">
                Pilih cabang di atas untuk melihat detail pendapatan, grafik, dan pengeluaran
              </p>
            </Card>
          )}
        </div>
      )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 z-50">
        <div className="overflow-x-auto hide-scrollbar">
          <div className="flex justify-around px-2 py-2">
            <button
              onClick={() => changeView('dashboard')}
              className={`flex flex-col items-center justify-center px-4 py-2 min-w-[80px] transition-all ${
                activeView === 'dashboard'
                  ? 'bg-gray-100 rounded-lg shadow-sm'
                  : 'hover:bg-gray-50 rounded-lg'
              }`}
            >
              <span className={`text-2xl mb-0.5 ${activeView === 'dashboard' ? 'text-blue-600' : 'text-gray-600'}`}>📊</span>
              <span className={`text-[11px] font-medium whitespace-nowrap ${
                activeView === 'dashboard' ? 'text-blue-600' : 'text-gray-600'
              }`}>
                Dashboard
              </span>
            </button>

            <button
              onClick={() => changeView('branch-revenue')}
              className={`flex flex-col items-center justify-center px-4 py-2 min-w-[80px] transition-all ${
                activeView === 'branch-revenue'
                  ? 'bg-gray-100 rounded-lg shadow-sm'
                  : 'hover:bg-gray-50 rounded-lg'
              }`}
            >
              <span className={`text-2xl mb-0.5 ${activeView === 'branch-revenue' ? 'text-purple-600' : 'text-gray-600'}`}>💰</span>
              <span className={`text-[11px] font-medium whitespace-nowrap ${
                activeView === 'branch-revenue' ? 'text-purple-600' : 'text-gray-600'
              }`}>
                Cabang
              </span>
            </button>

            <button
              onClick={() => changeView('stock-monitoring')}
              className={`flex flex-col items-center justify-center px-4 py-2 min-w-[80px] transition-all relative ${
                activeView === 'stock-monitoring'
                  ? 'bg-gray-100 rounded-lg shadow-sm'
                  : 'hover:bg-gray-50 rounded-lg'
              }`}
            >
              {getCriticalStockCount() > 0 && (
                <span className="absolute top-1 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {getCriticalStockCount()}
                </span>
              )}
              <span className={`text-2xl mb-0.5 ${activeView === 'stock-monitoring' ? 'text-orange-600' : 'text-gray-600'}`}>📦</span>
              <span className={`text-[11px] font-medium whitespace-nowrap ${
                activeView === 'stock-monitoring' ? 'text-orange-600' : 'text-gray-600'
              }`}>
                Stok
              </span>
            </button>

            <button
              onClick={() => changeView('stock-requests')}
              className={`flex flex-col items-center justify-center px-4 py-2 min-w-[80px] transition-all relative ${
                activeView === 'stock-requests'
                  ? 'bg-gray-100 rounded-lg shadow-sm'
                  : 'hover:bg-gray-50 rounded-lg'
              }`}
            >
              {pendingRequests > 0 && (
                <span className="absolute top-1 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {pendingRequests}
                </span>
              )}
              <span className={`text-2xl mb-0.5 ${activeView === 'stock-requests' ? 'text-red-600' : 'text-gray-600'}`}>📋</span>
              <span className={`text-[11px] font-medium whitespace-nowrap ${
                activeView === 'stock-requests' ? 'text-red-600' : 'text-gray-600'
              }`}>
                Requests
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}