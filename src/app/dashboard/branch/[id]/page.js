"use client"

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import WeeklyRevenueChart from '@/components/charts/WeeklyRevenueChart'
import FilterLimitModal from '@/components/ui/FilterLimitModal'
import BranchRevenueBreakdown from '@/components/dashboard/BranchRevenueBreakdown'
import ExpenseManagement from '@/components/expenses/ExpenseManagement'

export default function BranchDetailPage({ cacheConfig = { enabled: true, timeout: 60000 } }) {
  const router = useRouter()
  const params = useParams()
  const branchId = params.id

  // Global cache for branch data
  if (typeof window !== 'undefined' && !window.branchDetailCache) {
    window.branchDetailCache = new Map()
  }

  const [branchData, setBranchData] = useState(null)
  const [chartData, setChartData] = useState(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [transactionsSummary, setTransactionsSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  // Header scroll state
  const [showHeader, setShowHeader] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  // Get user data for role checking
  const [user, setUser] = useState(null)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      try {
        setUser(JSON.parse(userData))
      } catch (err) {
        console.error('Error parsing user data:', err)
      }
    }
  }, [])

  // Scroll listener for hiding/showing header
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (currentScrollY < 10) {
        // Always show header when at top
        setShowHeader(true)
      } else if (currentScrollY > lastScrollY) {
        // Scrolling down - hide header
        setShowHeader(false)
      } else {
        // Scrolling up - show header
        setShowHeader(true)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [lastScrollY])

  // Export loading states
  const [pdfLoading, setPdfLoading] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)
  const [stockPdfLoading, setStockPdfLoading] = useState(false)
  const [stockExcelLoading, setStockExcelLoading] = useState(false)

  // Modal states
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [pendingExportType, setPendingExportType] = useState(null) // 'pdf' or 'excel'

  // Revenue breakdown toggle
  const [showBreakdown, setShowBreakdown] = useState(true)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [itemsPerPage] = useState(10)

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  
  // Filter state - default to today
  const [filters, setFilters] = useState({
    dateFrom: today,
    dateTo: today,
    paymentMethod: 'all', // all, tunai, qris
    status: 'all' // all, selesai, pending, dibatalkan
  })

  // Global filter state for Revenue, Expense, and Chart
  const [globalPeriod, setGlobalPeriod] = useState({
    type: 'today', // today, 7days, 30days, custom
    dateFrom: today,
    dateTo: today
  })
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)

  // Local state for custom date (before apply)
  const [customDateTemp, setCustomDateTemp] = useState({
    dateFrom: today,
    dateTo: today
  })

  // Inventory filter state
  const [inventoryFilters, setInventoryFilters] = useState({
    dateFrom: today, // Default to today only
    dateTo: today,
    kategori: 'all', // all, sabun_softener, tas_plastik, minuman, lainnya
    status: 'all', // all, aman, rendah, habis
    search: ''
  })

  useEffect(() => {
    fetchBranchData()
  }, [branchId, globalPeriod])

  useEffect(() => {
    if (branchId) {
      fetchChartData()
    }
  }, [branchId, globalPeriod])

  useEffect(() => {
    if (activeTab === 'transactions') {
      fetchTransactions()
    }
  }, [activeTab, currentPage, filters])

  const fetchBranchData = async (forceRefresh = false) => {
    try {
      setLoading(true)
      setError(null)

      // Create cache key
      const cacheKey = JSON.stringify({
        branchId,
        type: 'branchData',
        dateFrom: globalPeriod.dateFrom,
        dateTo: globalPeriod.dateTo
      })

      // Check cache first (only if enabled and not forcing refresh)
      if (cacheConfig.enabled && !forceRefresh && typeof window !== 'undefined' && window.branchDetailCache) {
        const cached = window.branchDetailCache.get(cacheKey)
        if (cached && Date.now() - cached.timestamp < cacheConfig.timeout) {
          setBranchData(cached.data)
          setChartData(cached.data.weekly_chart)
          setLoading(false)
          return
        }
      }

      const params = new URLSearchParams({
        date_from: globalPeriod.dateFrom,
        date_to: globalPeriod.dateTo
      })

      const response = await fetch(`/api/dashboard/branch/${branchId}?${params}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('user')
          router.push('/')
          return
        }
        throw new Error('Failed to fetch branch data')
      }

      const data = await response.json()

      // Store in cache
      if (cacheConfig.enabled && typeof window !== 'undefined' && window.branchDetailCache) {
        window.branchDetailCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        })

        // Memory management - limit cache size
        if (window.branchDetailCache.size > 50) {
          const oldestKey = window.branchDetailCache.keys().next().value
          window.branchDetailCache.delete(oldestKey)
        }
      }

      setBranchData(data)
      setChartData(data.weekly_chart)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchChartData = async () => {
    try {
      setChartLoading(true)

      // Calculate period for chart
      let period = 7 // default
      if (globalPeriod.type === 'today') {
        period = 7 // show 7 days trend even for today
      } else if (globalPeriod.type === '7days') {
        period = 7
      } else if (globalPeriod.type === '30days') {
        period = 30
      } else if (globalPeriod.type === 'custom') {
        // Calculate days difference
        const start = new Date(globalPeriod.dateFrom)
        const end = new Date(globalPeriod.dateTo)
        period = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
      }

      const response = await fetch(`/api/dashboard/branch/${branchId}?period=${period}&chart_only=true`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch chart data')
      }

      const data = await response.json()
      setChartData(data.weekly_chart)
    } catch (err) {
      console.error('Chart fetch error:', err)
    } finally {
      setChartLoading(false)
    }
  }

  const fetchTransactions = async (forceRefresh = false) => {
    try {
      setTransactionsLoading(true)

      if (!branchId) {
        throw new Error('Branch ID is required')
      }

      // Create cache key
      const cacheKey = JSON.stringify({
        branchId,
        currentPage,
        itemsPerPage,
        filters,
        type: 'transactions'
      })

      // Check cache first (only if enabled and not forcing refresh)
      if (cacheConfig.enabled && !forceRefresh && typeof window !== 'undefined' && window.branchDetailCache) {
        const cached = window.branchDetailCache.get(cacheKey)
        if (cached && Date.now() - cached.timestamp < cacheConfig.timeout) {
          setTransactions(cached.data.transactions || [])
          setTransactionsSummary(cached.data.summary || null)
          setTotalPages(cached.data.totalPages || 1)
          setTotalTransactions(cached.data.totalTransactions || 0)
          setTransactionsLoading(false)
          return
        }
      }

      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        branchId: branchId,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value && value !== 'all')
        )
      })

      const response = await fetch(`/api/dashboard/branch/${branchId}/transactions?${queryParams}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)

        // Handle 3-month period limit error
        if (response.status === 400 && errorData?.error?.includes('Periode terlalu panjang')) {
          alert(`❌ ${errorData.error}\n\nPeriode yang diminta: ${errorData.requestedDays} hari\nMaksimal yang diizinkan: ${errorData.maxDays} hari`)
          return
        }

        const errorText = errorData?.error || 'Unknown error'
        throw new Error(`Failed to fetch transactions: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      // Store in cache
      if (cacheConfig.enabled && typeof window !== 'undefined' && window.branchDetailCache) {
        window.branchDetailCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        })

        // Memory management - limit cache size
        if (window.branchDetailCache.size > 50) {
          const oldestKey = window.branchDetailCache.keys().next().value
          window.branchDetailCache.delete(oldestKey)
        }
      }

      setTransactions(data.transactions || [])
      setTransactionsSummary(data.summary || null)
      setTotalPages(data.totalPages || 1)
      setTotalTransactions(data.totalTransactions || 0)
    } catch (err) {
      console.error('Error fetching transactions:', err)
      setTransactions([])
    } finally {
      setTransactionsLoading(false)
    }
  }

  const handleFilterChange = (key, value) => {
    // Check if date range needs validation
    if (key === 'dateFrom' || key === 'dateTo') {
      const newFilters = { ...filters, [key]: value }

      // If both dates are set, validate the period
      if (newFilters.dateFrom && newFilters.dateTo) {
        const startDate = new Date(newFilters.dateFrom)
        const endDate = new Date(newFilters.dateTo)
        // Calculate inclusive days (both start and end dates count)
        const diffMs = endDate - startDate
        const daysDifference = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1

        if (daysDifference > 90) {
          // Auto-adjust to 90 days from dateTo backwards
          const adjustedStartDate = new Date(endDate)
          adjustedStartDate.setDate(adjustedStartDate.getDate() - 89) // 89 days back + today = 90 days
          const adjustedDateFrom = adjustedStartDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

          // Apply the adjusted filters immediately
          setFilters(prev => ({
            ...prev,
            [key]: value,
            dateFrom: adjustedDateFrom
          }))
          setInventoryFilters(prev => ({
            ...prev,
            [key]: value,
            dateFrom: adjustedDateFrom
          }))
          setCurrentPage(1)

          // Show info modal
          setFilterModalOpen(true)
          return
        }
      }
    }

    setFilters(prev => ({ ...prev, [key]: value }))
    setCurrentPage(1) // Reset to first page when filtering

    // Sync date filters to inventory
    if (key === 'dateFrom' || key === 'dateTo') {
      setInventoryFilters(prev => ({ ...prev, [key]: value }))
    }
  }

  const handleInventoryFilterChange = (key, value) => {
    setInventoryFilters(prev => ({ ...prev, [key]: value }))

    // Sync date filters to transactions
    if (key === 'dateFrom' || key === 'dateTo') {
      setFilters(prev => ({ ...prev, [key]: value }))
      setCurrentPage(1) // Reset transaction page when date changes
    }
  }

  // Filter inventory data based on current filters
  const getFilteredInventory = () => {
    if (!branchData?.inventory) return []

    return branchData.inventory.filter(item => {
      // Search filter
      if (inventoryFilters.search) {
        const searchLower = inventoryFilters.search.toLowerCase()
        if (!item.nama_produk.toLowerCase().includes(searchLower)) {
          return false
        }
      }

      // Category filter
      if (inventoryFilters.kategori !== 'all') {
        if (item.kategori_produk !== inventoryFilters.kategori) {
          return false
        }
      }

      // Status filter
      if (inventoryFilters.status !== 'all') {
        const isLowStock = item.stok_tersedia <= item.stok_minimum
        const isWarning = item.stok_tersedia <= item.stok_minimum * 1.5 && item.stok_tersedia > item.stok_minimum
        const isSafe = item.stok_tersedia > item.stok_minimum * 1.5

        if (inventoryFilters.status === 'habis' && !isLowStock) return false
        if (inventoryFilters.status === 'rendah' && !isWarning) return false
        if (inventoryFilters.status === 'aman' && !isSafe) return false
      }

      return true
    })
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Modal handlers
  const handleFilterModalConfirm = (newDateFrom, newDateTo) => {
    setFilters(prev => ({
      ...prev,
      dateFrom: newDateFrom,
      dateTo: newDateTo
    }))
    setInventoryFilters(prev => ({
      ...prev,
      dateFrom: newDateFrom,
      dateTo: newDateTo
    }))
    setCurrentPage(1)
    setFilterModalOpen(false)
  }

  const handleExportModalConfirm = (confirmedDateFrom, confirmedDateTo) => {
    // Update filters first if they were changed
    const finalFilters = {
      ...filters,
      dateFrom: confirmedDateFrom,
      dateTo: confirmedDateTo
    }

    setFilters(finalFilters)
    setExportModalOpen(false)

    // Proceed with the pending export
    if (pendingExportType === 'pdf') {
      proceedWithPDFExport(finalFilters)
    } else if (pendingExportType === 'excel') {
      proceedWithExcelExport(finalFilters)
    }

    setPendingExportType(null)
  }

  const handleExportPDF = async () => {
    // Prevent multiple clicks
    if (pdfLoading) return

    // Check period limit
    if (filters.dateFrom && filters.dateTo) {
      const startDate = new Date(filters.dateFrom)
      const endDate = new Date(filters.dateTo)
      // Calculate inclusive days (both start and end dates count)
      const diffMs = endDate - startDate
      const daysDifference = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1

      if (daysDifference > 90) {
        // Auto-adjust to 90 days from dateTo backwards
        const adjustedStartDate = new Date(endDate)
        adjustedStartDate.setDate(adjustedStartDate.getDate() - 89) // 89 days back + today = 90 days
        const adjustedDateFrom = adjustedStartDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

        // Update filters with adjusted dates
        setFilters(prev => ({
          ...prev,
          dateFrom: adjustedDateFrom
        }))
        setInventoryFilters(prev => ({
          ...prev,
          dateFrom: adjustedDateFrom
        }))

        // Show info modal then continue with export
        setPendingExportType('pdf')
        setExportModalOpen(true)
        return
      }
    }

    // Proceed directly if period is valid
    proceedWithPDFExport(filters)
  }

  const proceedWithPDFExport = async (exportFilters) => {
    try {
      setPdfLoading(true)

      // Build query params based on current filters
      const queryParams = new URLSearchParams({
        branch_id: branchId,
        ...Object.fromEntries(
          Object.entries(exportFilters).filter(([_, value]) => value && value !== 'all')
        )
      })

      const response = await fetch(`/api/reports/branch/pdf?${queryParams}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url

        // Get filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition')
        const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/)
        a.download = filenameMatch ? filenameMatch[1] : `Laporan_Transaksi_${branchData.branch_info.nama_cabang}.pdf`

        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        throw new Error('Failed to generate PDF')
      }
    } catch (error) {
      alert('Gagal generate PDF: ' + error.message)
    } finally {
      setPdfLoading(false)
    }
  }

  const handleExportExcel = async () => {
    // Prevent multiple clicks
    if (excelLoading) return

    // Check period limit
    if (filters.dateFrom && filters.dateTo) {
      const startDate = new Date(filters.dateFrom)
      const endDate = new Date(filters.dateTo)
      // Calculate inclusive days (both start and end dates count)
      const diffMs = endDate - startDate
      const daysDifference = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1

      if (daysDifference > 90) {
        // Auto-adjust to 90 days from dateTo backwards
        const adjustedStartDate = new Date(endDate)
        adjustedStartDate.setDate(adjustedStartDate.getDate() - 89) // 89 days back + today = 90 days
        const adjustedDateFrom = adjustedStartDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

        // Update filters with adjusted dates
        setFilters(prev => ({
          ...prev,
          dateFrom: adjustedDateFrom
        }))
        setInventoryFilters(prev => ({
          ...prev,
          dateFrom: adjustedDateFrom
        }))

        // Show info modal then continue with export
        setPendingExportType('excel')
        setExportModalOpen(true)
        return
      }
    }

    // Proceed directly if period is valid
    proceedWithExcelExport(filters)
  }

  const proceedWithExcelExport = async (exportFilters) => {
    try {
      setExcelLoading(true)

      // Build query params based on current filters
      const queryParams = new URLSearchParams({
        branch_id: branchId,
        ...Object.fromEntries(
          Object.entries(exportFilters).filter(([_, value]) => value && value !== 'all')
        )
      })

      const response = await fetch(`/api/reports/branch/export?${queryParams}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url

        // Get filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition')
        const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/)
        a.download = filenameMatch ? filenameMatch[1] : `Laporan_Transaksi_${branchData.branch_info.nama_cabang}.xlsx`

        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        throw new Error('Failed to export Excel')
      }
    } catch (error) {
      alert('Gagal export Excel: ' + error.message)
    } finally {
      setExcelLoading(false)
    }
  }

  const handleExportStockPDF = async () => {
    // Prevent multiple clicks
    if (stockPdfLoading) return

    try {
      setStockPdfLoading(true)

      // Build query params for stock report
      const queryParams = new URLSearchParams({
        branch_id: branchId,
        dateFrom: inventoryFilters.dateFrom,
        dateTo: inventoryFilters.dateTo,
        ...(inventoryFilters.kategori !== 'all' && { kategori: inventoryFilters.kategori }),
        ...(inventoryFilters.status !== 'all' && { status: inventoryFilters.status }),
        ...(inventoryFilters.search && { search: inventoryFilters.search })
      })

      const response = await fetch(`/api/reports/stock/pdf?${queryParams}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url

        // Get filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition')
        const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/)
        a.download = filenameMatch ? filenameMatch[1] : `Laporan_Stok_${branchData.branch_info.nama_cabang}.pdf`

        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        throw new Error('Failed to generate stock PDF')
      }
    } catch (error) {
      alert('Gagal generate laporan stok: ' + error.message)
    } finally {
      setStockPdfLoading(false)
    }
  }

  const handleGlobalPeriodChange = (type) => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

    if (type === 'today') {
      setGlobalPeriod({ type: 'today', dateFrom: today, dateTo: today })
      setShowCustomDatePicker(false)
    } else if (type === '7days') {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
      const dateFrom = sevenDaysAgo.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      setGlobalPeriod({ type: '7days', dateFrom, dateTo: today })
      setShowCustomDatePicker(false)
    } else if (type === '30days') {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
      const dateFrom = thirtyDaysAgo.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      setGlobalPeriod({ type: '30days', dateFrom, dateTo: today })
      setShowCustomDatePicker(false)
    } else if (type === 'custom') {
      setShowCustomDatePicker(true)
    }
  }

  const handleCustomDateApply = () => {
    // Apply custom date to globalPeriod
    setGlobalPeriod({
      type: 'custom',
      dateFrom: customDateTemp.dateFrom,
      dateTo: customDateTemp.dateTo
    })
    setShowCustomDatePicker(false)
  }

  // Memoize dateRange to prevent unnecessary re-renders
  const memoizedDateRange = useMemo(() => ({
    from: globalPeriod.dateFrom,
    to: globalPeriod.dateTo
  }), [globalPeriod.dateFrom, globalPeriod.dateTo])

  // Get period label for cards
  const getPeriodLabel = () => {
    if (globalPeriod.type === 'today') return 'Hari Ini'
    if (globalPeriod.type === '7days') return '7 Hari Terakhir'
    if (globalPeriod.type === '30days') return '30 Hari Terakhir'
    if (globalPeriod.type === 'custom') {
      const from = new Date(globalPeriod.dateFrom).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
      const to = new Date(globalPeriod.dateTo).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
      return `${from} - ${to}`
    }
    return 'Hari Ini'
  }

  const handleExportStockExcel = async () => {
    // Prevent multiple clicks
    if (stockExcelLoading) return

    try {
      setStockExcelLoading(true)

      // Build query params for stock Excel report
      const queryParams = new URLSearchParams({
        branch_id: branchId,
        dateFrom: inventoryFilters.dateFrom,
        dateTo: inventoryFilters.dateTo,
        ...(inventoryFilters.kategori !== 'all' && { kategori: inventoryFilters.kategori }),
        ...(inventoryFilters.status !== 'all' && { status: inventoryFilters.status }),
        ...(inventoryFilters.search && { search: inventoryFilters.search })
      })

      const response = await fetch(`/api/reports/stock/excel?${queryParams}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url

        // Get filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition')
        const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/)
        a.download = filenameMatch ? filenameMatch[1] : `Laporan_Stok_${branchData.branch_info.nama_cabang}.xlsx`

        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        throw new Error('Failed to generate stock Excel')
      }
    } catch (error) {
      alert('Gagal generate laporan stok Excel: ' + error.message)
    } finally {
      setStockExcelLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0)
  }

  const formatDateTime = (dateTime) => {
    return new Date(dateTime).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  // Helper function to get period validation status
  const getPeriodValidation = () => {
    if (!filters.dateFrom || !filters.dateTo) return { status: 'valid', days: 0, message: '' }

    const startDate = new Date(filters.dateFrom)
    const endDate = new Date(filters.dateTo)
    // Calculate inclusive days (both start and end dates count)
    const diffMs = endDate - startDate
    const daysDifference = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1

    if (daysDifference > 90) {
      return {
        status: 'invalid',
        days: daysDifference,
        message: `Periode terlalu panjang (${daysDifference} hari). Maksimal 90 hari.`
      }
    } else if (daysDifference > 60) {
      return {
        status: 'warning',
        days: daysDifference,
        message: `Periode cukup panjang (${daysDifference} hari). Rekomendasi maksimal 90 hari.`
      }
    }

    return {
      status: 'valid',
      days: daysDifference,
      message: `Periode valid (${daysDifference} hari)`
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading branch data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg font-medium mb-4">Error: {error}</div>
          <Button onClick={() => router.push('/dashboard')}>
            ← Kembali ke Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (!branchData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 text-lg">Branch not found</div>
          <Button onClick={() => router.push('/dashboard')} className="mt-4">
            ← Kembali ke Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
      {/* Header - with scroll hide/show */}
      <div className={`fixed top-0 left-0 right-0 bg-white shadow-sm z-40 transition-transform duration-300 ${
        showHeader ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="px-4 sm:px-6 py-4 sm:py-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/dashboard')}
              aria-label="Kembali ke Dashboard"
              className="flex items-center justify-center w-12 h-12 text-2xl text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              ←
            </button>
            <div className="text-center flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                {branchData.branch_info.nama_cabang}
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                Detail cabang dan analisis transaksi
              </p>
            </div>
            <div className="w-12"></div>
          </div>
        </div>

        {/* WhatsApp Style Navbar */}
        <div className="hidden sm:flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('overview')}
            className={`relative flex-1 px-4 py-3 text-center font-medium text-sm sm:text-base transition-colors flex items-center justify-center gap-2 focus:outline-none ${
              activeTab === 'overview'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
            </svg>
            <span>Overview</span>
            {activeTab === 'overview' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`relative flex-1 px-4 py-3 text-center font-medium text-sm sm:text-base transition-colors flex items-center justify-center gap-2 focus:outline-none ${
              activeTab === 'transactions'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/>
            </svg>
            <span>Transaksi</span>
            {activeTab === 'transactions' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`relative flex-1 px-4 py-3 text-center font-medium text-sm sm:text-base transition-colors flex items-center justify-center gap-2 focus:outline-none ${
              activeTab === 'inventory'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
            </svg>
            <span>Inventori</span>
            {activeTab === 'inventory' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
            )}
          </button>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-[88px] sm:h-[156px]"></div>

      <div className="px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-8">

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6 sm:space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-green-100 text-xs sm:text-sm font-medium">Pendapatan {getPeriodLabel()}</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 truncate">
                      {formatCurrency(branchData.revenue_breakdown?.total_pendapatan || 0)}
                    </p>
                    <p className="text-green-100 text-xs sm:text-sm mt-1">
                      {branchData.stats.daily_transactions} transaksi
                      {branchData.revenue_breakdown?.fee_kasir > 0 && (
                        <span className="ml-1">• Fee: {formatCurrency(branchData.revenue_breakdown.fee_kasir)}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">💵</div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-blue-100 text-xs sm:text-sm font-medium">Tunai {getPeriodLabel()}</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 truncate">
                      {formatCurrency(branchData.revenue_breakdown?.pendapatan_tunai || 0)}
                    </p>
                    <p className="text-blue-100 text-xs sm:text-sm mt-1">{branchData.stats.daily_tunai_transactions || 0} transaksi</p>
                  </div>
                  <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">💰</div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6 bg-gradient-to-br from-red-500 to-red-600 text-white border-0 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-red-100 text-xs sm:text-sm font-medium">QRIS {getPeriodLabel()}</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 truncate">{formatCurrency(branchData.stats.daily_qris_revenue || 0)}</p>
                    <p className="text-red-100 text-xs sm:text-sm mt-1">{branchData.stats.daily_qris_transactions || 0} transaksi</p>
                  </div>
                  <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">📱</div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-orange-100 text-xs sm:text-sm font-medium">Pertumbuhan</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">
                      {branchData.stats.growth_percentage > 0 ? '+' : ''}{branchData.stats.growth_percentage}%
                    </p>
                    <p className="text-orange-100 text-xs sm:text-sm mt-1">vs kemarin</p>
                  </div>
                  <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">📊</div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-purple-100 text-xs sm:text-sm font-medium">Pelanggan {getPeriodLabel()}</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{branchData.stats.daily_customers}</p>
                    <p className="text-purple-100 text-xs sm:text-sm mt-1 truncate">Rata-rata {formatCurrency(branchData.stats.avg_transaction)}</p>
                  </div>
                  <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">👥</div>
                </div>
              </Card>

            </div>

            {/* Global Period Filter */}
            <Card className="p-4 sm:p-6 shadow-lg border-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Filter Periode</h3>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleGlobalPeriodChange('today')}
                    className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      globalPeriod.type === 'today'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Hari Ini
                  </button>
                  <button
                    onClick={() => handleGlobalPeriodChange('7days')}
                    className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      globalPeriod.type === '7days'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    7 Hari
                  </button>
                  <button
                    onClick={() => handleGlobalPeriodChange('30days')}
                    className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      globalPeriod.type === '30days'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    30 Hari
                  </button>
                  <button
                    onClick={() => handleGlobalPeriodChange('custom')}
                    className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      globalPeriod.type === 'custom'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {/* Custom Date Picker */}
              {showCustomDatePicker && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Dari Tanggal</label>
                      <input
                        type="date"
                        value={customDateTemp.dateFrom}
                        onChange={(e) => setCustomDateTemp(prev => ({ ...prev, dateFrom: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Sampai Tanggal</label>
                      <input
                        type="date"
                        value={customDateTemp.dateTo}
                        onChange={(e) => setCustomDateTemp(prev => ({ ...prev, dateTo: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleCustomDateApply}
                    className="mt-3 w-full sm:w-auto px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Terapkan
                  </button>
                </div>
              )}
            </Card>

            {/* Revenue & Expense - Side by Side on Desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Breakdown */}
              {branchData.revenue_breakdown && (
                <BranchRevenueBreakdown
                  data={branchData.revenue_breakdown}
                  showBreakdown={showBreakdown}
                  onToggle={() => setShowBreakdown(!showBreakdown)}
                />
              )}

              {/* Expense Management */}
              <ExpenseManagement
                cabangId={branchId}
                selectedDate={globalPeriod.dateFrom}
                setSelectedDate={() => {}}
                dateRange={memoizedDateRange}
              />
            </div>

            {/* Chart - Full Width Below */}
            <Card className="p-4 sm:p-6 shadow-lg border-0 flex flex-col">
              <div className="mb-4 sm:mb-6">
                <h3 className="text-lg font-bold text-gray-900">
                  📊 Grafik Revenue Trend
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Mengikuti filter periode di atas
                </p>
              </div>

              {/* Chart Area */}
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 space-y-1 sm:space-y-0">
                  <h4 className="text-sm sm:text-base font-medium text-gray-700">Revenue Trend</h4>
                  <div className="text-xs text-gray-500">
                    <span className="sm:hidden">Tap untuk detail</span>
                    <span className="hidden sm:inline">Hover untuk detail</span>
                  </div>
                </div>
                <div className="w-full h-[300px] sm:h-[400px] relative">
                  {chartLoading && (
                    <div className="absolute inset-0 bg-gray-50 bg-opacity-75 flex items-center justify-center z-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                  <WeeklyRevenueChart data={chartData || null} />
                </div>
              </div>
            </Card>

          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-6">
            {/* Advanced Filters */}
            <Card className="p-4 sm:p-6 shadow-lg border-0">
              <h3 className="text-base sm:text-lg font-semibold mb-4">🔍 Filter & Pencarian</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* Date From */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Periode Filter - Dari</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    max={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
                      getPeriodValidation().status === 'invalid'
                        ? 'border-red-300 focus:ring-red-500'
                        : getPeriodValidation().status === 'warning'
                        ? 'border-yellow-300 focus:ring-yellow-500'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sampai Tanggal</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    min={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
                      getPeriodValidation().status === 'invalid'
                        ? 'border-red-300 focus:ring-red-500'
                        : getPeriodValidation().status === 'warning'
                        ? 'border-yellow-300 focus:ring-yellow-500'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Metode Pembayaran</label>
                  <select
                    value={filters.paymentMethod}
                    onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Semua Metode</option>
                    <option value="tunai">💰 Tunai</option>
                    <option value="qris">📱 QRIS</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Semua Status</option>
                    <option value="selesai">✅ Selesai</option>
                    <option value="pending">⏳ Pending</option>
                    <option value="dibatalkan">❌ Dibatalkan</option>
                  </select>
                </div>
              </div>

              {/* Quick Select Buttons */}
              <div className="mb-4 mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Periode Cepat:</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Hari Ini', startDaysBack: 0 },
                    { label: '7 Hari Terakhir', startDaysBack: 6 },
                    { label: '30 Hari Terakhir', startDaysBack: 29 },
                    { label: '90 Hari Terakhir', startDaysBack: 89 }
                  ].map((preset) => {
                    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
                    const startDate = new Date(Date.now() - (preset.startDaysBack * 24 * 60 * 60 * 1000))
                      .toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

                    return (
                      <button
                        key={preset.label}
                        onClick={() => {
                          setFilters(prev => ({
                            ...prev,
                            dateFrom: startDate,
                            dateTo: today
                          }))
                          setInventoryFilters(prev => ({
                            ...prev,
                            dateFrom: startDate,
                            dateTo: today
                          }))
                          setCurrentPage(1)
                        }}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors"
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Period Validation Message */}
              {filters.dateFrom && filters.dateTo && getPeriodValidation().status !== 'valid' && (
                <div className={`mb-4 p-3 rounded-lg border ${
                  getPeriodValidation().status === 'invalid'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                }`}>
                  <div className="flex items-start space-x-2">
                    <span className="text-sm">
                      {getPeriodValidation().status === 'invalid' ? '⚠️' : '💡'}
                    </span>
                    <div className="text-sm">
                      <p className="font-medium">{getPeriodValidation().message}</p>
                      {getPeriodValidation().status === 'invalid' && (
                        <p className="text-xs mt-1">
                          Silakan pilih periode yang lebih pendek atau gunakan tombol quick select di atas.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Filter Summary & Actions */}
              <div className="mt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  {Object.entries(filters).map(([key, value]) => {
                    if (!value || value === 'all' || (key === 'dateFrom' || key === 'dateTo')) return null
                    return (
                      <span key={key} className="px-3 py-1 bg-blue-100 text-blue-600 text-sm rounded-full">
                        {key === 'paymentMethod' ? (value === 'tunai' ? '💰 Tunai' : '📱 QRIS') :
                         key === 'status' ? `Status: ${value}` : `${key}: ${value}`}
                        <button
                          onClick={() => handleFilterChange(key, 'all')}
                          className="ml-2 text-blue-500 hover:text-blue-700"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                  {Object.entries(filters).some(([key, value]) => value && value !== 'all' && key !== 'dateFrom' && key !== 'dateTo') && (
                    <button
                      onClick={() => setFilters({
                        dateFrom: today, dateTo: today, paymentMethod: 'all',
                        status: 'all'
                      })}
                      className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full hover:bg-gray-200"
                    >
                      Reset ke Hari Ini ×
                    </button>
                  )}
                </div>

                <div className="text-sm text-gray-600 text-center sm:text-right">
                  Periode filter: <strong>{filters.dateFrom}</strong> s/d <strong>{filters.dateTo}</strong>
                </div>
              </div>
            </Card>

            {/* Transactions Table */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 bg-gray-50 border-b">
                <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold">
                      💳 Daftar Transaksi
                    </h3>
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 mt-1">
                      <span className="text-xs sm:text-sm text-gray-600">
                        {totalTransactions} total transaksi
                      </span>
                      <div className="text-xs sm:text-sm text-gray-600">
                        Halaman {currentPage} dari {totalPages}
                      </div>
                    </div>
                  </div>
                  
                  {/* Export Buttons */}
                  <div className="flex space-x-2 justify-center sm:justify-end">
                    <button
                      onClick={handleExportPDF}
                      disabled={pdfLoading || excelLoading}
                      className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-semibold flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-105 ${
                        pdfLoading || excelLoading
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700'
                      }`}
                    >
                      {pdfLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd"/>
                          </svg>
                          <span>PDF</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleExportExcel}
                      disabled={pdfLoading || excelLoading}
                      className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-semibold flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-105 ${
                        pdfLoading || excelLoading
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
                      }`}
                    >
                      {excelLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                            <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h6a1 1 0 001-1V3a2 2 0 012 2v6.586A2 2 0 0115.414 13L12 16.414V17a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm8 4a1 1 0 10-2 0v2.586L8.707 10.293a1 1 0 00-1.414 1.414L9.586 14H8a1 1 0 100 2h4a1 1 0 001-1v-4a1 1 0 00-1-1z" clipRule="evenodd"/>
                          </svg>
                          <span>Excel</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {transactionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                  <span className="text-gray-600">Loading transaksi...</span>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📝</div>
                  <p className="text-gray-500">Tidak ada transaksi ditemukan</p>
                </div>
              ) : (
                <>
                  {/* Mobile-friendly cards for small screens */}
                  <div className="block sm:hidden">
                  <div className="space-y-3 px-2 py-4">
                    {transactions.map((transaction) => (
                      <div key={transaction.id_transaksi} className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                        {/* Header Row */}
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0 pr-3">
                            <h4 className="font-semibold text-gray-900 text-base">{transaction.kode_transaksi}</h4>
                            <p className="text-sm text-gray-500 mt-1">
                              {new Date(transaction.tanggal_transaksi).toLocaleDateString('id-ID', { 
                                timeZone: 'Asia/Jakarta',
                                day: '2-digit',
                                month: '2-digit', 
                                year: 'numeric'
                              })} • {new Date(transaction.tanggal_transaksi).toLocaleTimeString('id-ID', {
                                timeZone: 'Asia/Jakarta',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                              })}
                            </p>
                          </div>
                          <span className={`flex-shrink-0 px-2 py-1 text-xs font-medium rounded-full ${
                            transaction.status_transaksi === 'selesai' ? 'bg-green-100 text-green-600' :
                            transaction.status_transaksi === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                            'bg-red-100 text-red-600'
                          }`}>
                            {transaction.status_transaksi === 'selesai' ? '✅' : 
                             transaction.status_transaksi === 'pending' ? '⏳' : '❌'}
                          </span>
                        </div>
                        
                        {/* Customer & Cashier Info */}
                        <div className="flex gap-6 py-2 border-t border-gray-100">
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 font-medium">Pelanggan</p>
                            <p className="text-sm text-gray-900 font-medium">{transaction.nama_pelanggan}</p>
                          </div>
                          <div className="flex-1 text-right">
                            <p className="text-xs text-gray-500 font-medium">Kasir</p>
                            <p className="text-sm text-gray-900 font-medium">{transaction.nama_pekerja_aktual || transaction.nama_karyawan || '-'}</p>
                          </div>
                        </div>

                        {/* Payment & Total */}
                        <div className="flex justify-between items-center py-2 border-t border-gray-100">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            transaction.metode_pembayaran === 'tunai'
                              ? 'bg-green-100 text-green-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            {transaction.metode_pembayaran === 'tunai' ? '💰 Tunai' : '📱 QRIS'}
                          </span>
                          <span className="font-bold text-green-600">{formatCurrency(transaction.total_keseluruhan)}</span>
                        </div>
                        
                        {/* Services & Products */}
                        <div className="space-y-2">
                          {transaction.services && transaction.services.length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 block mb-1">Layanan:</span>
                              <div className="flex flex-wrap gap-1">
                                {(() => {
                                  const grouped = {}
                                  transaction.services.forEach(service => {
                                    const isFree = parseFloat(service.subtotal) === 0
                                    const serviceName = service.nama_layanan
                                    
                                    if (!grouped[serviceName]) {
                                      grouped[serviceName] = { free: 0, paid: 0 }
                                    }
                                    
                                    if (isFree) {
                                      grouped[serviceName].free += parseInt(service.quantity) || 1
                                    } else {
                                      grouped[serviceName].paid += parseInt(service.quantity) || 1
                                    }
                                  })
                                  
                                  return Object.entries(grouped).map(([name, counts]) => {
                                    if (counts.free > 0 && counts.paid > 0) {
                                      // Mixed: show both as separate badges
                                      return (
                                        <div key={name} className="inline-flex gap-1">
                                          <span className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                                            {counts.paid}x {name}
                                          </span>
                                          <span className="inline-flex px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                                            {counts.free}x {name} (gratis)
                                          </span>
                                        </div>
                                      )
                                    } else if (counts.free > 0) {
                                      // All free
                                      return (
                                        <span key={name} className="inline-flex px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                                          {counts.free}x {name} (gratis)
                                        </span>
                                      )
                                    } else {
                                      // All paid
                                      return (
                                        <span key={name} className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                                          {counts.paid}x {name}
                                        </span>
                                      )
                                    }
                                  })
                                })()}
                              </div>
                            </div>
                          )}
                          
                          {transaction.products && transaction.products.length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-gray-500 block mb-1">Produk:</span>
                              <div className="flex flex-wrap gap-1">
                                {transaction.products.map((product, index) => {
                                  // UPDATED: Read free data directly from transaction, no recalculation
                                  const totalQty = parseInt(product.quantity) || 0
                                  const freeQty = parseInt(product.free_quantity) || 0
                                  const paidQty = totalQty - freeQty

                                  if (freeQty > 0 && paidQty > 0) {
                                    // Mixed: show both as separate badges
                                    return (
                                      <div key={index} className="inline-flex gap-1">
                                        <span className="inline-flex px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                                          {paidQty}{product.satuan} {product.nama_produk}
                                        </span>
                                        <span className="inline-flex px-2 py-1 text-xs bg-pink-100 text-pink-700 rounded-full">
                                          {freeQty}{product.satuan} {product.nama_produk} (promo)
                                        </span>
                                      </div>
                                    )
                                  } else if (freeQty > 0) {
                                    // All free
                                    return (
                                      <span key={index} className="inline-flex px-2 py-1 text-xs bg-pink-100 text-pink-700 rounded-full">
                                        {freeQty}{product.satuan} {product.nama_produk} (promo)
                                      </span>
                                    )
                                  } else {
                                    // All paid
                                    return (
                                      <span key={index} className="inline-flex px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                                        {paidQty}{product.satuan} {product.nama_produk}
                                      </span>
                                    )
                                  }
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Transaksi
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tanggal
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pelanggan
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Kasir
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Layanan
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Produk
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pembayaran
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {transactions.map((transaction) => (
                        <tr key={transaction.id_transaksi} className="hover:bg-gray-50">
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                              {transaction.kode_transaksi}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {new Date(transaction.tanggal_transaksi).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(transaction.tanggal_transaksi).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                              })}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {transaction.nama_pelanggan}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {transaction.nama_pekerja_aktual || transaction.nama_karyawan || '-'}
                            </div>
                            <div className="text-sm text-gray-500">
                              Shift: {transaction.shift_transaksi}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            <div className="text-sm">
                              {transaction.services && transaction.services.length > 0 ? (
                                (() => {
                                  // Group services by nama_layanan and separate free vs paid
                                  const grouped = {}
                                  transaction.services.forEach(service => {
                                    const isFree = parseFloat(service.subtotal) === 0
                                    const serviceName = service.nama_layanan
                                    
                                    if (!grouped[serviceName]) {
                                      grouped[serviceName] = { free: 0, paid: 0 }
                                    }
                                    
                                    if (isFree) {
                                      grouped[serviceName].free += parseInt(service.quantity) || 1
                                    } else {
                                      grouped[serviceName].paid += parseInt(service.quantity) || 1
                                    }
                                  })
                                  
                                  return Object.entries(grouped).map(([name, counts]) => (
                                    <div key={name} className="text-xs text-gray-700 mb-1">
                                      {counts.free > 0 && counts.paid > 0 ? (
                                        // Mixed: both free and paid
                                        <span>
                                          {counts.free + counts.paid}x {name} 
                                          <span className="text-green-600 ml-1">({counts.free} gratis)</span>
                                        </span>
                                      ) : counts.free > 0 ? (
                                        // All free
                                        <span>
                                          {counts.free}x {name} 
                                          <span className="text-green-600 ml-1">(gratis)</span>
                                        </span>
                                      ) : (
                                        // All paid
                                        <span>{counts.paid}x {name}</span>
                                      )}
                                    </div>
                                  ))
                                })()
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            <div className="text-sm">
                              {transaction.products && transaction.products.length > 0 ? (
                                transaction.products.map((product, index) => {
                                  // UPDATED: Read free data directly from transaction, no recalculation
                                  const totalQty = parseInt(product.quantity) || 0
                                  const freeQty = parseInt(product.free_quantity) || 0
                                  const paidQty = totalQty - freeQty

                                  return (
                                    <div key={index} className="text-xs text-gray-700 mb-1">
                                      {freeQty > 0 && paidQty > 0 ? (
                                        // Mixed: both free and paid
                                        <span>
                                          {totalQty}{product.satuan} {product.nama_produk}
                                          <span className="text-green-600 ml-1">({freeQty} gratis promo)</span>
                                        </span>
                                      ) : freeQty > 0 ? (
                                        // All free
                                        <span>
                                          {freeQty}{product.satuan} {product.nama_produk}
                                          <span className="text-green-600 ml-1">(gratis promo)</span>
                                        </span>
                                      ) : (
                                        // All paid
                                        <span>{paidQty}{product.satuan} {product.nama_produk}</span>
                                      )}
                                    </div>
                                  )
                                })
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              transaction.metode_pembayaran === 'tunai' 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-blue-100 text-blue-600'
                            }`}>
                              {transaction.metode_pembayaran === 'tunai' ? '💰 Tunai' : '📱 QRIS'}
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                            {formatCurrency(transaction.total_keseluruhan)}
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              transaction.status_transaksi === 'selesai' ? 'bg-green-100 text-green-600' :
                              transaction.status_transaksi === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                              'bg-red-100 text-red-600'
                            }`}>
                              {transaction.status_transaksi === 'selesai' ? '✅' : 
                               transaction.status_transaksi === 'pending' ? '⏳' : '❌'} 
                              {transaction.status_transaksi}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                    <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                      Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalTransactions)} dari {totalTransactions} transaksi
                    </div>

                    <div className="flex items-center justify-center sm:justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        ← Prev
                      </Button>

                      <div className="flex items-center space-x-1">
                        {[...Array(Math.min(5, totalPages))].map((_, index) => {
                          let pageNum
                          if (totalPages <= 5) {
                            pageNum = index + 1
                          } else if (currentPage <= 3) {
                            pageNum = index + 1
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + index
                          } else {
                            pageNum = currentPage - 2 + index
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`px-3 py-1 text-sm rounded ${
                                currentPage === pageNum
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white text-gray-600 hover:bg-gray-100 border'
                              }`}
                            >
                              {pageNum}
                            </button>
                          )
                        })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Next →
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Footer */}
              {transactionsSummary && transactions.length > 0 && (
                <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-lg font-bold text-center sm:text-left">
                    <span className="text-gray-700 mb-2 sm:mb-0">
                      Total {transactionsSummary.total_transaksi} Transaksi:
                    </span>
                    <span className="text-2xl text-blue-600">
                      {formatCurrency(transactionsSummary.total_pendapatan)}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}


        {activeTab === 'inventory' && (
          <div className="space-y-6">
            {/* Header with Summary */}
            <Card className="p-4 sm:p-6 shadow-lg border-0">
              <div className="flex flex-col space-y-3">
                {/* Title and Action */}
                <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 text-center sm:text-left">📦 Inventori Cabang</h3>
                  <div className="flex space-x-2 justify-center sm:justify-end">
                    <button
                      onClick={handleExportStockPDF}
                      disabled={stockPdfLoading || stockExcelLoading}
                      className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-semibold flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-105 ${
                        stockPdfLoading || stockExcelLoading
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700'
                      }`}
                    >
                      {stockPdfLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd"/>
                          </svg>
                          <span>PDF</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleExportStockExcel}
                      disabled={stockPdfLoading || stockExcelLoading}
                      className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-semibold flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-105 ${
                        stockPdfLoading || stockExcelLoading
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
                      }`}
                    >
                      {stockExcelLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                            <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h6a1 1 0 001-1V3a2 2 0 012 2v6.586A2 2 0 0115.414 13L12 16.414V17a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm8 4a1 1 0 10-2 0v2.586L8.707 10.293a1 1 0 00-1.414 1.414L9.586 14H8a1 1 0 100 2h4a1 1 0 001-1v-4a1 1 0 00-1-1z" clipRule="evenodd"/>
                          </svg>
                          <span>Excel</span>
                        </>
                      )}
                    </button>
                    {user?.role !== 'investor' && (
                      <button
                        onClick={() => router.push('/dashboard?view=stock&tab=overview')}
                        className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-semibold flex items-center justify-center shadow-md hover:shadow-lg transform hover:scale-105 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 whitespace-nowrap"
                      >
                        Kelola Stok
                      </button>
                    )}
                  </div>
                </div>

                {/* Summary Badges - Desktop Only */}
                <div className="hidden sm:flex flex-row gap-2 text-sm">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-center">
                    ✅ {branchData.inventory?.filter(item => item.stok_tersedia > item.stok_minimum * 1.5).length || 0} Stok Aman
                  </span>
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-center">
                    ⚠️ {branchData.inventory?.filter(item => item.stok_tersedia <= item.stok_minimum * 1.5 && item.stok_tersedia > item.stok_minimum).length || 0} Stok Rendah
                  </span>
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-center">
                    🚨 {branchData.inventory?.filter(item => item.stok_tersedia <= item.stok_minimum).length || 0} Stok Habis
                  </span>
                </div>
              </div>
            </Card>

            {/* Filter Section */}
            <Card className="p-4 sm:p-6 shadow-lg border-0">
              <h3 className="text-base sm:text-lg font-semibold mb-4">🔍 Filter Inventori & Laporan</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* Date From */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Periode Laporan - Dari</label>
                  <input
                    type="date"
                    value={inventoryFilters.dateFrom}
                    max={inventoryFilters.dateTo}
                    onChange={(e) => handleInventoryFilterChange('dateFrom', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sampai Tanggal</label>
                  <input
                    type="date"
                    value={inventoryFilters.dateTo}
                    min={inventoryFilters.dateFrom}
                    onChange={(e) => handleInventoryFilterChange('dateTo', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategori Produk</label>
                  <select
                    value={inventoryFilters.kategori}
                    onChange={(e) => handleInventoryFilterChange('kategori', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="all">Semua Kategori</option>
                    <option value="sabun_softener">🧴 Sabun & Softener</option>
                    <option value="tas_plastik">🛍️ Tas Plastik</option>
                    <option value="minuman">🥤 Minuman</option>
                    <option value="lainnya">📦 Lainnya</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status Stok</label>
                  <select
                    value={inventoryFilters.status}
                    onChange={(e) => handleInventoryFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="all">Semua Status</option>
                    <option value="aman">✅ Stok Aman</option>
                    <option value="rendah">⚠️ Stok Rendah</option>
                    <option value="habis">🚨 Stok Habis</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pencarian Produk</label>
                  <input
                    type="text"
                    placeholder="Cari nama produk..."
                    value={inventoryFilters.search}
                    onChange={(e) => handleInventoryFilterChange('search', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Active Filters */}
              <div className="mt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  {Object.entries(inventoryFilters).map(([key, value]) => {
                    if (!value || value === 'all' || (key === 'dateFrom' || key === 'dateTo')) return null
                    return (
                      <span key={key} className="px-3 py-1 bg-purple-100 text-purple-600 text-sm rounded-full">
                        {key === 'kategori' ?
                          (value === 'sabun_softener' ? '🧴 Sabun & Softener' :
                           value === 'tas_plastik' ? '🛍️ Tas Plastik' :
                           value === 'minuman' ? '🥤 Minuman' : '📦 Lainnya') :
                         key === 'status' ?
                          (value === 'aman' ? '✅ Stok Aman' :
                           value === 'rendah' ? '⚠️ Stok Rendah' : '🚨 Stok Habis') :
                         key === 'search' ? `"${value}"` : `${key}: ${value}`}
                        <button
                          onClick={() => handleInventoryFilterChange(key, key === 'search' ? '' : 'all')}
                          className="ml-2 text-purple-500 hover:text-purple-700"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                  {Object.entries(inventoryFilters).some(([key, value]) => value && value !== 'all' && key !== 'dateFrom' && key !== 'dateTo') && (
                    <button
                      onClick={() => setInventoryFilters({
                        ...inventoryFilters,
                        kategori: 'all',
                        status: 'all',
                        search: ''
                      })}
                      className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full hover:bg-gray-200"
                    >
                      Reset Filter ×
                    </button>
                  )}
                </div>

                <div className="text-sm text-gray-600 text-center sm:text-right">
                  Periode laporan: <strong>{inventoryFilters.dateFrom}</strong> s/d <strong>{inventoryFilters.dateTo}</strong>
                </div>
              </div>

              {/* Summary Badges - Mobile Only */}
              <div className="sm:hidden flex flex-col gap-2 text-sm mt-4 pt-4 border-t border-gray-200">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-center">
                  ✅ {branchData.inventory?.filter(item => item.stok_tersedia > item.stok_minimum * 1.5).length || 0} Stok Aman
                </span>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-center">
                  ⚠️ {branchData.inventory?.filter(item => item.stok_tersedia <= item.stok_minimum * 1.5 && item.stok_tersedia > item.stok_minimum).length || 0} Stok Rendah
                </span>
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-center">
                  🚨 {branchData.inventory?.filter(item => item.stok_tersedia <= item.stok_minimum).length || 0} Stok Habis
                </span>
              </div>
            </Card>

            {/* Inventory Data */}
            <Card className="p-4 sm:p-6 shadow-lg border-0">
              {/* Results Counter */}
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-base sm:text-lg font-semibold text-gray-900">
                  Daftar Produk
                </h4>
                <span className="text-sm text-gray-600">
                  Menampilkan {getFilteredInventory().length} dari {branchData.inventory?.length || 0} produk
                </span>
              </div>

              {/* Inventory Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {getFilteredInventory().map((item, index) => (
                  <div key={index} className="relative bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      {item.stok_tersedia <= item.stok_minimum ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          🚨 Habis
                        </span>
                      ) : item.stok_tersedia <= item.stok_minimum * 1.5 ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                          ⚠️ Rendah
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          ✅ Aman
                        </span>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="pr-16 mb-4">
                      <h4 className="font-semibold text-gray-900 text-sm sm:text-base line-clamp-2">{item.nama_produk}</h4>
                      <p className="text-xs sm:text-sm text-gray-500 capitalize mt-1">
                        {item.kategori_produk?.replace(/_/g, ' ')}
                      </p>
                    </div>

                    {/* Stock Info */}
                    <div className="space-y-3">
                      {/* Current Stock */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm text-gray-600">Stok Tersedia</span>
                        <span className={`font-bold text-sm sm:text-base ${
                          item.stok_tersedia <= item.stok_minimum 
                            ? 'text-red-600' 
                            : item.stok_tersedia <= item.stok_minimum * 1.5 
                            ? 'text-yellow-600' 
                            : 'text-green-600'
                        }`}>
                          {item.stok_tersedia} {item.satuan}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            item.stok_tersedia <= item.stok_minimum 
                              ? 'bg-red-500' 
                              : item.stok_tersedia <= item.stok_minimum * 1.5 
                              ? 'bg-yellow-500' 
                              : 'bg-green-500'
                          }`}
                          style={{
                            width: `${Math.min(100, Math.max(10, (item.stok_tersedia / (item.stok_minimum * 2)) * 100))}%`
                          }}
                        ></div>
                      </div>

                      {/* Additional Info */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-center p-2 bg-gray-50 rounded">
                          <div className="text-gray-500">Minimum</div>
                          <div className="font-medium">{item.stok_minimum} {item.satuan}</div>
                        </div>
                        <div className="text-center p-2 bg-gray-50 rounded">
                          <div className="text-gray-500">Harga</div>
                          <div className="font-medium">{formatCurrency(item.harga)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Empty State */}
              {getFilteredInventory().length === 0 && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📦</div>
                  {(!branchData.inventory || branchData.inventory.length === 0) ? (
                    <>
                      <p className="text-gray-500 text-lg mb-2">Tidak ada data inventori</p>
                      <p className="text-gray-400 text-sm">Data inventori cabang belum tersedia</p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-500 text-lg mb-2">Tidak ada produk yang sesuai filter</p>
                      <p className="text-gray-400 text-sm">Coba ubah atau reset filter untuk melihat lebih banyak produk</p>
                    </>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Filter Limit Modal */}
      <FilterLimitModal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        onConfirm={handleFilterModalConfirm}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        type="transactions"
      />

      {/* Export Limit Modal */}
      <FilterLimitModal
        isOpen={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false)
          // Proceed with export after user clicks OK
          if (pendingExportType === 'pdf') {
            proceedWithPDFExport(filters)
          } else if (pendingExportType === 'excel') {
            proceedWithExcelExport(filters)
          }
          setPendingExportType(null)
        }}
        onConfirm={handleExportModalConfirm}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        type="export"
      />

      {/* Fullscreen Loading Overlay for Export */}
      {(pdfLoading || excelLoading || stockPdfLoading || stockExcelLoading) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-sm mx-4 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {pdfLoading ? 'Generating PDF...' :
               excelLoading ? 'Generating Excel...' :
               stockPdfLoading ? 'Generating Stock PDF...' :
               'Generating Stock Excel...'}
            </h3>
            <p className="text-gray-600 text-sm">
              {pdfLoading || excelLoading ?
                'Memproses laporan transaksi. Mohon tunggu...' :
                'Memproses laporan inventori. Mohon tunggu...'
              }
            </p>
            <div className="mt-4 text-xs text-gray-500">
              Proses ini mungkin membutuhkan beberapa menit
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation - Mobile only */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 z-50">
        <div className="flex flex-row">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 flex flex-col items-center justify-center py-2 px-1 border-r border-gray-300 transition-all duration-200 ${
              activeTab === 'overview'
                ? 'text-blue-600'
                : 'text-gray-500'
            }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
            </svg>
            <span className="text-[10px] font-medium mt-0.5">Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 flex flex-col items-center justify-center py-2 px-1 border-r border-gray-300 transition-all duration-200 ${
              activeTab === 'transactions'
                ? 'text-blue-600'
                : 'text-gray-500'
            }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/>
            </svg>
            <span className="text-[10px] font-medium mt-0.5">Transaksi</span>
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 flex flex-col items-center justify-center py-2 px-1 transition-all duration-200 ${
              activeTab === 'inventory'
                ? 'text-blue-600'
                : 'text-gray-500'
            }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
            </svg>
            <span className="text-[10px] font-medium mt-0.5">Inventori</span>
          </button>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  )
}