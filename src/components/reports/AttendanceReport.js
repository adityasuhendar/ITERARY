"use client"
import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function AttendanceReport({ cacheConfig = { enabled: false, timeout: 0 } }) {
  const [attendanceData, setAttendanceData] = useState([])
  const [summaryData, setSummaryData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [viewMode, setViewMode] = useState('daily') // 'daily' or 'monthly'
  const [branches, setBranches] = useState([])

  // Cache setup
  if (typeof window !== 'undefined' && cacheConfig.enabled && !window.attendanceCache) {
    window.attendanceCache = new Map()
  }
  const cache = cacheConfig.enabled && typeof window !== 'undefined' 
    ? { current: window.attendanceCache } : { current: new Map() }

  const getCachedData = (key) => {
    if (!cacheConfig.enabled) return null
    const cached = cache.current.get(key)
    if (cached && Date.now() - cached.timestamp < cacheConfig.timeout) {
      return cached.data
    }
    return null
  }

  const setCachedData = (key, data) => {
    if (!cacheConfig.enabled) return
    if (cache.current.size > 20) {
      const oldestKey = cache.current.keys().next().value
      cache.current.delete(oldestKey)
    }
    cache.current.set(key, { data, timestamp: Date.now() })
  }

  useEffect(() => {
    // Set default to today's date for daily view, current month for monthly view
    const currentDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) // YYYY-MM-DD
    const currentMonth = currentDate.slice(0, 7) // YYYY-MM for month filter
    
    setSelectedMonth(currentMonth)
    setSelectedDate(currentDate) // Set default to today for daily view
    fetchBranches()
  }, [])

  useEffect(() => {
    if (selectedMonth) {
      fetchAttendanceData()
    }
  }, [selectedMonth, selectedBranch, selectedDate, viewMode])

  const fetchBranches = async () => {
    try {
      const cacheKey = `branches_attendance`
      const cachedData = getCachedData(cacheKey)
      if (cachedData) {
        setBranches(cachedData)
        return
      }

      const response = await fetch('/api/branches')
      if (response.ok) {
        const data = await response.json()
        const branchesData = data.branches || []
        setCachedData(cacheKey, branchesData)
        setBranches(branchesData)
      }
    } catch (err) {
      console.error('Error fetching branches:', err)
    }
  }

  const fetchAttendanceData = async (forceRefresh = false) => {
    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams({ month: selectedMonth })
      if (selectedBranch) {
        params.append('branch_id', selectedBranch)
      }
      // Only send date param in daily mode, let API use month filter in monthly mode
      if (viewMode === 'daily' && selectedDate) {
        params.append('date', selectedDate)
      }

      // Create cache key
      const cacheKey = `attendance_${params.toString()}_${viewMode}`

      // Check cache first (only if enabled and not forcing refresh)
      if (cacheConfig.enabled && !forceRefresh && typeof window !== 'undefined' && window.attendanceCache) {
        const cached = window.attendanceCache.get(cacheKey)
        if (cached && Date.now() - cached.timestamp < cacheConfig.timeout) {
          setAttendanceData(cached.data.attendance || [])
          setSummaryData(cached.data.summary || [])
          setLoading(false)
          return
        }
      }

      const response = await fetch(`/api/attendance?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch attendance data')
      }

      const data = await response.json()

      // Store in cache
      if (cacheConfig.enabled && typeof window !== 'undefined' && window.attendanceCache) {
        window.attendanceCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        })

        // Memory management - limit cache size
        if (window.attendanceCache.size > 20) {
          const oldestKey = window.attendanceCache.keys().next().value
          window.attendanceCache.delete(oldestKey)
        }
      }

      setAttendanceData(data.attendance || [])
      setSummaryData(data.summary || [])

    } catch (err) {
      setError(err.message)
      console.error('Attendance fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams({ month: selectedMonth, view_mode: viewMode, format: 'excel' })
      if (selectedBranch) {
        params.append('branch_id', selectedBranch)
      }
      if (viewMode === 'daily' && selectedDate) {
        params.append('date', selectedDate)
      }
      
      const response = await fetch(`/api/reports/attendance/export?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const filename = viewMode === 'daily' 
          ? `Laporan_Kehadiran_${selectedDate || 'today'}.xlsx`
          : `Laporan_Kehadiran_${selectedMonth}.xlsx`
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        throw new Error('Failed to export Excel')
      }
    } catch (error) {
      alert('Gagal export Excel: ' + error.message)
    }
  }

  const handleExportPDF = async () => {
    try {
      const params = new URLSearchParams({ month: selectedMonth, view_mode: viewMode, format: 'pdf' })
      if (selectedBranch) {
        params.append('branch_id', selectedBranch)
      }
      if (viewMode === 'daily' && selectedDate) {
        params.append('date', selectedDate)
      }
      
      const response = await fetch(`/api/reports/attendance/export?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const filename = viewMode === 'daily' 
          ? `Laporan_Kehadiran_${selectedDate || 'today'}.pdf`
          : `Laporan_Kehadiran_${selectedMonth}.pdf`
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        throw new Error('Failed to export PDF')
      }
    } catch (error) {
      alert('Gagal export PDF: ' + error.message)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatTime = (timeString) => {
    return timeString || '-'
  }

  const getShiftIcon = (shift) => {
    return shift === 'pagi' ? '🌅' : '🌙'
  }

  const formatShift = (shift) => {
    if (!shift) return 'N/A'
    
    // Clean up shift value - remove numbers and normalize
    const cleanShift = shift.toString().toLowerCase().replace(/[0-9]/g, '').trim()
    
    switch (cleanShift) {
      case 'pagi':
        return 'pagi'
      case 'malam':
        return 'malam'
      case 'keliling':
        return 'keliling'  
      case 'full':
        return 'full'
      default:
        // If it contains 'pagi' or 'malam' in the string
        if (shift.toString().toLowerCase().includes('pagi')) return 'pagi'
        if (shift.toString().toLowerCase().includes('malam')) return 'malam'
        // Default based on common patterns
        return shift.toString().replace(/[0-9]/g, '').trim() || 'N/A'
    }
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      aktif: 'bg-green-100 text-green-800 border-green-200',
      selesai: 'bg-blue-100 text-blue-800 border-blue-200'
    }
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${statusConfig[status] || statusConfig.selesai}`}>
        {status === 'aktif' ? '🟢 Hadir' : '✅ Selesai'}
      </span>
    )
  }

  // Group attendance by date and branch for better display
  const groupedAttendance = attendanceData.reduce((acc, item) => {
    const date = item.tanggal_formatted
    const cabang = item.nama_cabang || 'Unknown'
    const key = `${date}_${cabang}`
    const cleanShift = formatShift(item.shift) // Clean the shift value
    
    if (!acc[key]) {
      acc[key] = { 
        date: date,
        cabang: cabang,
        pagi: null, 
        malam: null 
      }
    }
    acc[key][cleanShift] = item
    return acc
  }, {})

  const monthOptions = []
  for (let i = 11; i >= 0; i--) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const value = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(0, 7)
    const label = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
    monthOptions.push({ value, label })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Professional Header */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-6 lg:space-y-0">
          {/* Title Section */}
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-lg">📅</span>
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Laporan Kehadiran
                </h2>
                <p className="text-gray-600 text-sm sm:text-base">
                  Monitoring kehadiran karyawan per shift - {viewMode === 'daily' ? 'Tampilan Harian' : 'Tampilan Bulanan'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Panel */}
          <div className="flex flex-col space-y-4 lg:min-w-[400px]">
            {/* View Mode Toggle */}
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Mode Tampilan
              </label>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('daily')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    viewMode === 'daily' 
                      ? 'bg-white text-blue-600 shadow-md' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  📅 Harian
                </button>
                <button
                  onClick={() => setViewMode('monthly')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    viewMode === 'monthly' 
                      ? 'bg-white text-blue-600 shadow-md' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  📊 Bulanan
                </button>
              </div>
            </div>

            {/* Export Actions */}
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Export Data
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={handleExportExcel}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 text-sm font-semibold flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-105"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h6a1 1 0 001-1V3a2 2 0 012 2v6.586A2 2 0 0115.414 13L12 16.414V17a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm8 4a1 1 0 10-2 0v2.586L8.707 10.293a1 1 0 00-1.414 1.414L9.586 14H8a1 1 0 100 2h4a1 1 0 001-1v-4a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  <span>Excel</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 text-sm font-semibold flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-105"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd"/>
                  </svg>
                  <span>PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Professional Filter Panel */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd"/>
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900">Filter Data</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Month Filter */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Periode Bulan
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full h-10 px-3 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium bg-white hover:border-gray-300 transition-colors"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Cabang
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full h-10 px-3 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium bg-white hover:border-gray-300 transition-colors"
            >
              <option value="">🏢 Semua Cabang</option>
              {branches.map((branch) => (
                <option key={branch.id_cabang} value={branch.id_cabang}>
                  📍 {branch.nama_cabang}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter - Only for Daily Mode */}
          {viewMode === 'daily' && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Tanggal Spesifik
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full h-10 px-3 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium bg-white hover:border-gray-300 transition-colors"
              />
            </div>
          )}
          
          {/* Reset Actions */}
          {((viewMode === 'daily' && selectedDate !== new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })) || selectedBranch) && (
            <div className="space-y-2 flex flex-col justify-end">
              <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Reset Filter
              </label>
              <button
                onClick={() => {
                  if (viewMode === 'daily') {
                    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
                    setSelectedDate(today)
                  }
                  setSelectedBranch('')
                }}
                className="h-10 px-3 py-0 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-200 text-sm font-semibold flex items-center justify-center space-x-2 shadow-md hover:shadow-lg"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
                </svg>
                <span>{viewMode === 'daily' ? 'Hari Ini' : 'Reset'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Professional Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-blue-600">{summaryData.length}</div>
              <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Total Pekerja</div>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
              </svg>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xs text-gray-500">Periode {viewMode === 'daily' ? 'Harian' : 'Bulanan'}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-green-600">
                {summaryData.reduce((sum, item) => sum + item.total_hari, 0)}
              </div>
              <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Total Kehadiran</div>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xs text-gray-500">Hari kerja tercatat</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-orange-600">
                {summaryData.reduce((sum, item) => sum + item.shift_pagi, 0)}
              </div>
              <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Shift Pagi</div>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-xl">🌅</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xs text-gray-500">Total shift pagi</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-purple-600">
                {summaryData.reduce((sum, item) => sum + item.shift_malam, 0)}
              </div>
              <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Shift Malam</div>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-xl">🌙</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xs text-gray-500">Total shift malam</span>
          </div>
        </div>
      </div>

      {/* Professional Summary per Pekerja */}
      {summaryData.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Ringkasan Kehadiran Pekerja</h3>
              <p className="text-sm text-gray-600">Detail kehadiran per pekerja dalam periode {viewMode === 'daily' ? 'harian' : 'bulanan'}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {summaryData.map((pekerja, index) => (
              <div key={index} className="bg-gradient-to-br from-gray-50 to-white p-5 rounded-xl border border-gray-200 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 text-lg">{pekerja.nama_pekerja}</h4>
                    <div className="flex items-center space-x-1 text-sm text-indigo-600 font-medium">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                      </svg>
                      <span>{pekerja.nama_cabang}</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-lg">#{index + 1}</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">Total Hari</span>
                    </div>
                    <span className="text-lg font-bold text-green-600">{pekerja.total_hari}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                      <div className="flex items-center space-x-1">
                        <span className="text-lg">🌅</span>
                        <span className="text-xs font-medium text-gray-600">Pagi</span>
                      </div>
                      <span className="text-sm font-bold text-orange-600">{pekerja.shift_pagi}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                      <div className="flex items-center space-x-1">
                        <span className="text-lg">🌙</span>
                        <span className="text-xs font-medium text-gray-600">Malam</span>
                      </div>
                      <span className="text-sm font-bold text-purple-600">{pekerja.shift_malam}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Professional Attendance Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-slate-500 to-slate-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Detail Kehadiran Harian</h3>
              <p className="text-sm text-gray-600">
                {Object.keys(groupedAttendance).length} entri kehadiran dalam periode {viewMode === 'daily' ? 'harian' : 'bulanan'}
              </p>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="mx-6 my-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              <p className="text-red-700 font-medium">{error}</p>
            </div>
            <Button onClick={fetchAttendanceData} className="mt-3" size="sm">
              🔄 Coba Lagi
            </Button>
          </div>
        )}

        {Object.keys(groupedAttendance).length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Data</h3>
            <p className="text-gray-600 mb-4">Tidak ada data kehadiran untuk periode yang dipilih</p>
            <div className="text-sm text-gray-500">
              Coba ubah filter atau periode untuk melihat data yang tersedia
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block sm:hidden">
              <div className="space-y-6 p-4">
                {Object.entries(groupedAttendance)
                  .sort(([a], [b]) => new Date(b.split('_')[0]) - new Date(a.split('_')[0]))
                  .map(([key, shifts], index) => (
                    <div key={key} className="relative">
                      {/* Date Separator */}
                      <div className="flex items-center mb-4">
                        <div className="flex-1 border-t-2 border-gray-200"></div>
                        <div className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full shadow-md">
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                            </svg>
                            <span className="text-sm font-bold">
                              {formatDate(shifts.date)}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 border-t-2 border-gray-200"></div>
                      </div>
                      
                      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4 shadow-sm">
                        {/* Branch Info */}
                        <div className="flex items-center justify-center pb-3 border-b border-gray-100">
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                            </svg>
                            <span className="text-sm font-semibold text-gray-900">{shifts.cabang}</span>
                          </div>
                        </div>
                      
                      {/* Shifts Grid */}
                      <div className="grid grid-cols-1 gap-3">
                        {/* Shift Pagi */}
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-lg">🌅</span>
                            <span className="text-sm font-semibold text-gray-700">Shift Pagi</span>
                          </div>
                          {shifts.pagi ? (
                            <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-bold text-orange-900">
                                  {shifts.pagi.nama_pekerja}
                                </div>
                                {getStatusBadge(shifts.pagi.status)}
                              </div>
                              <div className="text-xs text-orange-700 font-medium">
                                🕐 Mulai: {formatTime(shifts.pagi.jam_mulai)}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-50 rounded-lg p-3 text-center">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-1">
                                <span className="text-gray-400 text-xs">−</span>
                              </div>
                              <span className="text-xs text-gray-400">Tidak ada</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Shift Malam */}
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-lg">🌙</span>
                            <span className="text-sm font-semibold text-gray-700">Shift Malam</span>
                          </div>
                          {shifts.malam ? (
                            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-bold text-purple-900">
                                  {shifts.malam.nama_pekerja}
                                </div>
                                {getStatusBadge(shifts.malam.status)}
                              </div>
                              <div className="text-xs text-purple-700 font-medium">
                                🕐 Mulai: {formatTime(shifts.malam.jam_mulai)}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-50 rounded-lg p-3 text-center">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-1">
                                <span className="text-gray-400 text-xs">−</span>
                              </div>
                              <span className="text-xs text-gray-400">Tidak ada</span>
                            </div>
                          )}
                        </div>
                      </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-left">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Tanggal</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Cabang</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">🌅</span>
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Shift Pagi</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">🌙</span>
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Shift Malam</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(groupedAttendance)
                    .sort(([a], [b]) => new Date(b.split('_')[0]) - new Date(a.split('_')[0]))
                    .map(([key, shifts], index) => (
                      <tr key={key} className={`hover:bg-blue-50 transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <span className="text-blue-600 font-bold text-sm">
                                {new Date(shifts.date).getDate()}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900">
                                {formatDate(shifts.date)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(shifts.date).toLocaleDateString('id-ID', { weekday: 'long' })}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                            <span className="text-sm font-semibold text-gray-900">{shifts.cabang}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 w-1/4">
                          <div className="h-20 flex items-center">
                            {shifts.pagi ? (
                              <div className="bg-orange-50 rounded-lg p-3 border border-orange-200 w-full">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm font-bold text-orange-900">
                                    {shifts.pagi.nama_pekerja}
                                  </div>
                                  {getStatusBadge(shifts.pagi.status)}
                                </div>
                                <div className="text-xs text-orange-700 font-medium">
                                  🕐 Mulai: {formatTime(shifts.pagi.jam_mulai)}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-4 w-full">
                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-1">
                                  <span className="text-gray-400 text-xs">−</span>
                                </div>
                                <span className="text-xs text-gray-400">Tidak ada</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 w-1/4">
                          <div className="h-20 flex items-center">
                            {shifts.malam ? (
                              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200 w-full">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm font-bold text-purple-900">
                                    {shifts.malam.nama_pekerja}
                                  </div>
                                  {getStatusBadge(shifts.malam.status)}
                                </div>
                                <div className="text-xs text-purple-700 font-medium">
                                  🕐 Mulai: {formatTime(shifts.malam.jam_mulai)}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-4 w-full">
                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-1">
                                  <span className="text-gray-400 text-xs">−</span>
                                </div>
                                <span className="text-xs text-gray-400">Tidak ada</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}