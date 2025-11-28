"use client"
import { useState, useEffect, useRef } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function MultiBranchReport() {
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Global cache that persists through Fast Refresh
  if (typeof window !== 'undefined' && !window.multiBranchCache) {
    window.multiBranchCache = new Map()
    window.multiBranchExportCache = new Map()
  }
  
  const sharedCache = typeof window !== 'undefined' 
    ? { current: window.multiBranchCache }
    : { current: new Map() }
  const exportCache = typeof window !== 'undefined'
    ? { current: window.multiBranchExportCache } 
    : { current: new Map() }

  // Cache management functions
  const createCacheKey = (endpoint, params = {}) => {
    const stateParams = {
      period: selectedPeriod,
      paymentMethod: selectedPaymentMethod,
      month: selectedMonth,
      year: selectedYear,
      dateRange: selectedDateRange,
      filterMode: filterMode,
      page: currentPage,
      sort: sortBy
    }
    return `${endpoint}_${JSON.stringify({ ...stateParams, ...params })}`
  }

  const getCachedData = (key) => {
    const cached = sharedCache.current.get(key)
    if (cached && Date.now() - cached.timestamp < 120000) { // 2 minute cache
      return cached.data
    }
    return null
  }

  const setCachedData = (key, data) => {
    // Limit cache size to prevent memory issues
    if (sharedCache.current.size > 50) {
      const oldestKey = sharedCache.current.keys().next().value
      sharedCache.current.delete(oldestKey)
    }
    sharedCache.current.set(key, {
      data: data,
      timestamp: Date.now()
    })
  }

  const getCachedExport = (key) => {
    const cached = exportCache.current.get(key)
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minute cache for exports
      return cached.data
    }
    return null
  }

  const setCachedExport = (key, data) => {
    // Limit export cache size
    if (exportCache.current.size > 20) {
      const oldestKey = exportCache.current.keys().next().value
      exportCache.current.delete(oldestKey)
    }
    exportCache.current.set(key, {
      data: data,
      timestamp: Date.now()
    })
  }

  useEffect(() => {
    fetchReportData()
  }, [])

  const fetchReportData = async (forceRefresh = false) => {
    try {
      setLoading(true)
      setError('')

      // Create cache key
      const cacheKey = 'multi-branch-report-today'

      // Check cache first (skip if force refresh)
      if (!forceRefresh) {
        const cachedData = getCachedData(cacheKey)

        if (cachedData) {
          setReportData(cachedData)
          setError('')
          setLoading(false)
          return
        }
      }

      console.log('📊 [MultiBranchReport] Fetching optimized data...')
      const response = await fetch('/api/dashboard/multi-branch')

      if (!response.ok) {
        throw new Error('Failed to fetch multi-branch data')
      }

      const data = await response.json()
      console.log('📊 [MultiBranchReport] Data fetched successfully:', data)

      // Cache the data
      setCachedData(cacheKey, data)

      setReportData(data)
    } catch (err) {
      setError(err.message)
      console.error('Multi-branch report error:', err)
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


  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
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
          <div className="text-red-600 text-lg font-medium mb-2">Error loading report</div>
          <div className="text-gray-600 mb-4">{error}</div>
        </div>
        <Button onClick={() => fetchReportData(true)}>
          Coba Lagi
        </Button>
      </div>
    )
  }

  if (!reportData) return null

  const { summary, branches, pagination, charts } = reportData

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Simplified Report Header */}
      <div className="space-y-4">
        <div className="text-center sm:text-left">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            🏢 Multi-Branch Performance Report
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 text-sm text-gray-600">
            <span>📅 Periode: <strong>Hari Ini</strong></span>
            <span>💳 Pembayaran: <strong>Semua Metode</strong></span>
            <span>🕒 Update: <strong>{new Date(reportData.last_updated).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</strong></span>
          </div>
        </div>

        {/* Simple Refresh Control */}
        <Card className="p-4 bg-gray-50 border border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Menampilkan data transaksi hari ini untuk semua cabang
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-600">
                Cache: {sharedCache.current.size} items
              </span>
              <button
                onClick={() => fetchReportData(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                🔄 Refresh Data
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Revenue */}
        <Card className="p-4 sm:p-6 bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-green-100 text-xs sm:text-sm font-medium">Total Pendapatan</p>
              <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 truncate">
                {formatCompactCurrency(summary.total_revenue)}
              </p>
              <p className="text-green-100 text-xs sm:text-sm mt-1">
                {summary.total_transactions} transaksi
              </p>
            </div>
            <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">💰</div>
          </div>
        </Card>

        {/* Active Branches */}
        <Card className="p-4 sm:p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-blue-100 text-xs sm:text-sm font-medium">Cabang Aktif</p>
              <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">
                {summary.active_branches} / {summary.total_branches}
              </p>
              <p className="text-blue-100 text-xs sm:text-sm mt-1">cabang beroperasi</p>
            </div>
            <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">🏪</div>
          </div>
        </Card>

        {/* Total Customers */}
        <Card className="p-4 sm:p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-purple-100 text-xs sm:text-sm font-medium">Total Pelanggan</p>
              <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">
                {summary.total_customers}
              </p>
              <p className="text-purple-100 text-xs sm:text-sm mt-1 truncate">
                Avg: {formatCompactCurrency(summary.avg_transaction_all)}
              </p>
            </div>
            <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">👥</div>
          </div>
        </Card>

        {/* Average per Branch */}
        <Card className="p-4 sm:p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-orange-100 text-xs sm:text-sm font-medium">Rata-rata per Cabang</p>
              <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 truncate">
                {formatCompactCurrency(summary.avg_per_branch)}
              </p>
              <p className="text-orange-100 text-xs sm:text-sm mt-1">pendapatan</p>
            </div>
            <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">📊</div>
          </div>
        </Card>
      </div>

      {/* Branch Comparison Table */}
      <Card className="shadow-lg border-0 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 bg-gray-50 border-b">
          <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                📊 Perbandingan Cabang
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 mt-1">
                <span className="text-xs sm:text-sm text-gray-600">
                  {pagination.totalBranches} total cabang
                </span>
                <div className="text-xs sm:text-sm text-gray-600">
                  Halaman {pagination.currentPage} dari {pagination.totalPages}
                </div>
              </div>
            </div>
            
            {/* Simple info display */}
            <div className="text-sm text-gray-600">
              Diurutkan berdasarkan pendapatan tertinggi
            </div>
          </div>
        </div>

        {/* Enhanced Mobile Cards View */}
        <div className="block sm:hidden">
          <div className="space-y-3 p-3">
            {branches.map((branch) => (
              <div key={branch.id_cabang} className="bg-white border border-gray-200 rounded-lg p-3 space-y-3 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-600">#{branch.rank}</span>
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm truncate">{branch.nama_cabang}</h4>
                    </div>
                    <p className="text-xs text-gray-600 truncate ml-8">{branch.alamat}</p>
                  </div>
                  <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ${
                    branch.growth_percentage >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {branch.growth_percentage >= 0 ? '+' : ''}{branch.growth_percentage}%
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-green-50 p-2 rounded">
                    <span className="text-gray-500 block">Pendapatan:</span>
                    <div className="font-bold text-green-600 text-sm truncate">{formatCompactCurrency(branch.current_revenue)}</div>
                  </div>
                  <div className="bg-blue-50 p-2 rounded">
                    <span className="text-gray-500 block">Transaksi:</span>
                    <div className="font-bold text-blue-600 text-sm">{branch.current_transactions}</div>
                  </div>
                  <div className="bg-purple-50 p-2 rounded">
                    <span className="text-gray-500 block">Pelanggan:</span>
                    <div className="font-bold text-purple-600 text-sm">{branch.current_customers}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank & Cabang
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pendapatan
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaksi
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pelanggan
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Growth
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {branches.map((branch) => (
                <tr key={branch.id_cabang} className="hover:bg-gray-50">
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-sm font-bold text-blue-600">#{branch.rank}</span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {branch.nama_cabang}
                        </div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {branch.alamat}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-green-600">
                      {formatCompactCurrency(branch.current_revenue)}
                    </div>
                    <div className="text-sm text-gray-500">
                      Avg: {formatCompactCurrency(branch.avg_transaction)}
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {branch.current_transactions}
                    </div>
                    <div className="text-sm text-gray-500">
                      vs {branch.prev_transactions} sebelumnya
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {branch.current_customers}
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      branch.growth_percentage >= 0 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {branch.growth_percentage >= 0 ? '+' : ''}{branch.growth_percentage}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </Card>

      {/* Charts Section */}
      {charts && charts.revenueByBranch && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Bar Chart */}
          <Card className="p-4 sm:p-6 shadow-lg border-0">
            <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Pendapatan per Cabang</h3>
            <div className="space-y-3">
              {charts.revenueByBranch.slice(0, 5).map((branch, index) => {
                const maxRevenue = Math.max(...charts.revenueByBranch.map(b => b.revenue))
                const percentage = maxRevenue > 0 ? (branch.revenue / maxRevenue) * 100 : 0
                
                return (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-24 text-sm font-medium text-gray-700 truncate">
                      {branch.nama_cabang}
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-gray-200 rounded-full h-4">
                        <div 
                          className="bg-gradient-to-r from-blue-400 to-blue-600 h-4 rounded-full flex items-center px-2" 
                          style={{ width: `${Math.max(percentage, 5)}%` }}
                        >
                          <span className="text-xs text-white font-medium truncate">
                            {formatCompactCurrency(branch.revenue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Top Performers */}
          <Card className="p-4 sm:p-6 shadow-lg border-0">
            <h3 className="text-lg font-bold text-gray-900 mb-4">🏆 Top Performers</h3>
            <div className="space-y-4">
              {branches.slice(0, 3).map((branch, index) => (
                <div key={branch.id_cabang} className="flex items-center space-x-4 p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg border">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                    index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'
                  }`}>
                    #{index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">{branch.nama_cabang}</h4>
                    <p className="text-sm text-gray-600">{formatCompactCurrency(branch.current_revenue)}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${
                      branch.growth_percentage >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {branch.growth_percentage >= 0 ? '+' : ''}{branch.growth_percentage}%
                    </div>
                    <div className="text-xs text-gray-500">{branch.current_transactions} transaksi</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}