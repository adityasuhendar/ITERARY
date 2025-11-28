'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function BranchRevenueReport() {
  const [revenueData, setRevenueData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [cache, setCache] = useState({})
  const [expandedBranches, setExpandedBranches] = useState([])
  const [sortBy, setSortBy] = useState('id') // 'id', 'revenue', 'transactions', 'name'
  const [sortOrder, setSortOrder] = useState('asc') // 'asc', 'desc'
  const [filterExpanded, setFilterExpanded] = useState(true)

  // Set default date to today (WIB timezone)
  useEffect(() => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    setSelectedDate(today)
  }, [])

  // Fetch revenue data when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchRevenueData()
    }
  }, [selectedDate])

  const fetchRevenueData = async () => {
    // Check cache first
    if (cache[selectedDate]) {
      setRevenueData(cache[selectedDate])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams({
        date: selectedDate
      })

      const response = await fetch(`/api/reports/branch-revenue?${params}`)

      if (response.ok) {
        const data = await response.json()
        const revenue = data.revenue || []
        setRevenueData(revenue)
        // Save to cache
        setCache(prev => ({ ...prev, [selectedDate]: revenue }))
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch revenue data')
      }
    } catch (err) {
      setError(err.message)
      console.error('Error fetching revenue data:', err)
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Jakarta'
    })
  }

  const getTotalRevenue = () => {
    return revenueData.reduce((total, item) => total + (item.net_revenue || 0), 0)
  }

  const getTotalTransactions = () => {
    return revenueData.reduce((total, item) => total + (item.total_transactions || 0), 0)
  }

  const getTotalTukarNota = () => {
    return revenueData.reduce((total, item) => total + (item.tukar_nota_count || 0), 0)
  }

  const getTotalQRIS = () => {
    return revenueData.reduce((total, item) => total + (item.qris_revenue || 0), 0)
  }

  const getTotalCKL = () => {
    return revenueData.reduce((total, item) => total + (item.ckl_count || 0), 0)
  }

  const getTunaiNetto = () => {
    return revenueData.reduce((total, item) => total + ((item.tunai_revenue || 0) - (item.fee_kasir || 0)), 0)
  }

  // Sort functionality
  const getSortedData = () => {
    const sorted = [...revenueData].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'id':
          comparison = a.id_cabang - b.id_cabang
          break
        case 'revenue':
          comparison = b.net_revenue - a.net_revenue
          break
        case 'transactions':
          comparison = b.total_transactions - a.total_transactions
          break
        case 'name':
          comparison = a.nama_cabang.localeCompare(b.nama_cabang)
          break
        default:
          comparison = 0
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
    return sorted
  }

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const toggleBranch = (branchId) => {
    setExpandedBranches(prev =>
      prev.includes(branchId)
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    )
  }


  // Generate date options for last 5 days
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

  if (loading && revenueData.length === 0) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters - Sticky on Mobile */}
      <Card className="sticky top-16 z-10 sm:relative sm:top-0 p-4 sm:p-6 bg-gray-50 border border-gray-200 shadow-sm sm:shadow-none">
        <div className="flex flex-col gap-4">
          {/* Date Filter Bubbles */}
          <div>
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
          </div>

        </div>
      </Card>

      {error && (
        <Card className="p-4 bg-red-50 border border-red-200">
          <div className="flex items-center space-x-2">
            <span className="text-red-500 text-lg">⚠️</span>
            <p className="text-red-700">{error}</p>
          </div>
        </Card>
      )}

      {/* Summary Cards */}
      {revenueData.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-3 sm:p-4 bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
            <div className="text-center">
              <div className="text-2xl mb-2">💰</div>
              <p className="text-green-100 text-xs font-medium mb-1">Total Pendapatan (Bersih)</p>
              <p className="text-lg sm:text-xl font-bold">
                {formatCurrency(getTotalRevenue())}
              </p>
            </div>
          </Card>

          <Card className="p-3 sm:p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
            <div className="text-center">
              <div className="text-2xl mb-2">💵</div>
              <p className="text-blue-100 text-xs font-medium mb-1">Pendapatan Tunai (Bersih)</p>
              <p className="text-lg sm:text-xl font-bold">
                {formatCurrency(getTunaiNetto())}
              </p>
            </div>
          </Card>

          <Card className="p-3 sm:p-4 bg-gradient-to-br from-red-500 to-red-600 text-white border-0 shadow-lg">
            <div className="text-center">
              <div className="text-2xl mb-2">📱</div>
              <p className="text-red-100 text-xs font-medium mb-1">Pendapatan QRIS</p>
              <p className="text-lg sm:text-xl font-bold">
                {formatCurrency(getTotalQRIS())}
              </p>
            </div>
          </Card>

          <Card className="p-3 sm:p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-lg">
            <div className="text-center">
              <div className="text-2xl mb-2">📝</div>
              <p className="text-orange-100 text-xs font-medium mb-1">Tukar Nota Kertas</p>
              <p className="text-lg sm:text-xl font-bold">
                {getTotalTukarNota()}x
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Branch Revenue List/Table */}
      {revenueData.length > 0 && (
        <Card className="p-3 sm:p-6 shadow-lg border-0">
          <h2 className="text-base sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">
            💰 Pendapatan Per Cabang
          </h2>

          {/* Mobile Accordion */}
          <div className="sm:hidden space-y-3">
            {getSortedData().map((branch) => (
              <div
                key={branch.id_cabang}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleBranch(branch.id_cabang)}
                  className="w-full p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left flex justify-between items-center"
                >
                  <div>
                    <div className="font-semibold text-gray-900">{branch.nama_cabang}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {formatCurrency(branch.net_revenue)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                      Dw : {branch.id_cabang}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${
                        expandedBranches.includes(branch.id_cabang) ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {expandedBranches.includes(branch.id_cabang) && (
                  <div className="p-4 bg-white space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">📝 Tukar Nota Kertas</span>
                      <span className="font-medium">{branch.tukar_nota_count || 0}x</span>
                    </div>
                    <div className="border-t border-gray-200 pt-3 flex justify-between">
                      <span className="text-gray-600">💰 Pendapatan Kotor</span>
                      <span className="font-medium">{formatCurrency(branch.total_revenue)}</span>
                    </div>
                    <div className="flex justify-between text-orange-600">
                      <span>🧺 Fee Jasa Lipat</span>
                      <span className="font-medium">- {formatCurrency(branch.fee_kasir || 0)}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-3 flex justify-between text-green-600 font-semibold">
                      <span>✅ Pendapatan Bersih</span>
                      <span>{formatCurrency(branch.net_revenue)}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">💵 Tunai Kotor</span>
                        <span className="font-medium">{formatCurrency(branch.tunai_revenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">📱 QRIS</span>
                        <span className="font-medium">{formatCurrency(branch.qris_revenue)}</span>
                      </div>
                      <div className="bg-green-100 rounded-lg px-3 py-2 -mx-2 flex justify-between text-green-700 font-semibold">
                        <span>💵 Tunai Bersih</span>
                        <span>{formatCurrency(branch.tunai_revenue - branch.fee_kasir)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Nama Cabang
                      {sortBy === 'name' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tukar Nota Kertas
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pendapatan Kotor
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fee Jasa Lipat
                  </th>
                  <th
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('revenue')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Pendapatan Bersih
                      {sortBy === 'revenue' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tunai Kotor
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    QRIS
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tunai Bersih
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getSortedData().map((branch) => (
                  <tr key={branch.id_cabang} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {branch.nama_cabang}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                        📝 {branch.tukar_nota_count || 0}x
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(branch.total_revenue)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-orange-600 font-medium">
                        - {formatCurrency(branch.fee_kasir || 0)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                        {formatCurrency(branch.net_revenue)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(branch.tunai_revenue)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(branch.qris_revenue)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                        {formatCurrency(branch.tunai_revenue - branch.fee_kasir)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className="px-6 py-4 text-center text-sm text-gray-900">
                    TOTAL
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-orange-200 text-orange-900 px-2 py-1 rounded-full text-xs font-bold">
                      📝 {getTotalTukarNota()}x
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-900">
                    {formatCurrency(getTotalRevenue() + revenueData.reduce((sum, b) => sum + (b.fee_kasir || 0), 0))}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-orange-600">
                    - {formatCurrency(revenueData.reduce((sum, b) => sum + (b.fee_kasir || 0), 0))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-green-200 text-green-900 px-2 py-1 rounded-full text-xs font-bold">
                      {formatCurrency(getTotalRevenue())}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-900">
                    {formatCurrency(revenueData.reduce((sum, b) => sum + (b.tunai_revenue || 0), 0))}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-900">
                    {formatCurrency(getTotalQRIS())}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-green-200 text-green-900 px-2 py-1 rounded-full text-xs font-bold">
                      {formatCurrency(getTunaiNetto())}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

    </div>
  )
}