"use client"
import { useState, useEffect, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import SkeletonLoader from '@/components/ui/SkeletonLoader'
import FloatingActionButton from '@/components/ui/FloatingActionButton'
import BottomSheet from '@/components/ui/BottomSheet'
import { validatePhoneNumber } from '@/lib/security'

export default function CustomerManagement({
  onPayTransaction,
  cacheConfig = { enabled: false, timeout: 0 },
  user = null
}) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [customerDraftTransactions, setCustomerDraftTransactions] = useState([])
  const [deletingCustomer, setDeletingCustomer] = useState(null)
  const [successModal, setSuccessModal] = useState({ show: false, type: '', message: '' })
  const [editTotalCuciModal, setEditTotalCuciModal] = useState({ show: false, customer: null, addValue: 0, newTotal: 0, loading: false, fotoBukti: null, fotoPreview: null, uploading: false, alasan: '', mode: 'add' })
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [historyModal, setHistoryModal] = useState({ show: false, customer: null, transactions: [], loading: false, hasMore: true, offset: 0 })
  const HISTORY_LIMIT = 10
  const [filters, setFilters] = useState({
    loyaltyPoints: 'all', // all, with_points, no_points
    phoneStatus: 'all',   // all, with_phone, no_phone
    sortBy: 'name_asc',   // name_asc, name_desc, points_desc, date_desc
    branchId: 'all'       // all, or specific branch id (owner only)
  })
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCustomers: 0,
    itemsPerPage: 10
  })

  // Branch management for owner
  const [branches, setBranches] = useState([])
  const [loadingBranches, setLoadingBranches] = useState(false)

  // Branch context for kasir and backup kasir
  const showBranchContext = user && (
    user.role === 'kasir' ||
    (user.original_role === 'collector' && user.backup_mode === true)
  )

  // Owner needs branch management
  const isOwner = user && user.role === 'owner'

  // New customer form state
  const [newCustomer, setNewCustomer] = useState({
    nama_pelanggan: '',
    nomor_telepon: '',
    id_cabang: ''  // For owner to select branch
  })

  // Global cache that persists through Fast Refresh (role-based)
  if (typeof window !== 'undefined' && cacheConfig.enabled && !window.customerCache) {
    window.customerCache = new Map()
  }
  
  const customerCache = cacheConfig.enabled && typeof window !== 'undefined' 
    ? { current: window.customerCache }
    : { current: new Map() }

  // Cache management functions
  const createCacheKey = (params = {}) => {
    const cacheParams = {
      page: pagination.currentPage,
      search: searchTerm,
      loyaltyFilter: filters.loyaltyPoints,
      phoneFilter: filters.phoneStatus,
      sortBy: filters.sortBy,
      branchId: filters.branchId,  // Include branch filter
      ...params
    }
    return `customers_${JSON.stringify(cacheParams)}`
  }

  const getCachedData = (key) => {
    if (!cacheConfig.enabled) return null
    
    const cached = customerCache.current.get(key)
    if (cached && Date.now() - cached.timestamp < cacheConfig.timeout) {
      return cached.data
    }
    return null
  }

  const setCachedData = (key, data) => {
    if (!cacheConfig.enabled) return
    
    // Limit cache size
    if (customerCache.current.size > 30) {
      const oldestKey = customerCache.current.keys().next().value
      customerCache.current.delete(oldestKey)
    }
    customerCache.current.set(key, {
      data: data,
      timestamp: Date.now()
    })
  }

  // Fetch branches for owner on mount
  useEffect(() => {
    if (isOwner) {
      fetchBranches()
    }
  }, [isOwner])

  const fetchBranches = async () => {
    setLoadingBranches(true)
    try {
      const response = await fetch('/api/branches')
      if (response.ok) {
        const data = await response.json()
        setBranches(data.branches || [])
      }
    } catch (error) {
      console.error('Error fetching branches:', error)
    } finally {
      setLoadingBranches(false)
    }
  }

  // Smart fetch: debounce search, instant for pagination/filters
  useEffect(() => {
    // If searchTerm changed, debounce it
    if (searchTerm !== '') {
      const timer = setTimeout(() => {
        fetchCustomers()
      }, 500)
      return () => clearTimeout(timer)
    } else {
      // Empty search or pagination/filter change: fetch instantly
      fetchCustomers()
    }
  }, [searchTerm, pagination.currentPage, filters])

  const fetchCustomers = async (forceRefresh = false) => {
    setLoading(true)
    try {
      // Create cache key
      const cacheKey = createCacheKey()
      
      // Check cache first (skip if force refresh or cache disabled)
      if (!forceRefresh && cacheConfig.enabled) {
        const cachedData = getCachedData(cacheKey)
        
        if (cachedData) {
          setCustomers(cachedData.customers)
          setPagination(cachedData.pagination)
          setLoading(false)
          return
        }
      }
      
      const queryParams = new URLSearchParams({
        page: pagination.currentPage.toString(),
        limit: pagination.itemsPerPage.toString(),
        search: searchTerm,
        loyaltyFilter: filters.loyaltyPoints,
        phoneFilter: filters.phoneStatus,
        sortBy: filters.sortBy,
        include_cuci_count: 'true'  // Request cuci count data
      })

      // Add branch filter for owner
      if (isOwner && filters.branchId && filters.branchId !== 'all') {
        queryParams.set('branch_filter', filters.branchId)
      }

      // Add branch context for visual indicators only (kasir)
      if (showBranchContext && user.cabang_id) {
        queryParams.set('branch_id', user.cabang_id.toString())
      }

      const response = await fetch(`/api/customers?${queryParams}`)
      if (response.ok) {
        const data = await response.json()
        
        const responseData = {
          customers: data.customers || [],
          pagination: {
            ...pagination,
            totalPages: data.totalPages || 1,
            totalCustomers: data.totalCustomers || 0
          }
        }
        
        // Cache the data
        setCachedData(cacheKey, responseData)
        
        setCustomers(responseData.customers)
        setPagination(prev => ({
          ...prev,
          totalPages: responseData.pagination.totalPages,
          totalCustomers: responseData.pagination.totalCustomers
        }))
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    setSearchTerm(e.target.value)
    setPagination(prev => ({ ...prev, currentPage: 1 }))
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, currentPage: 1 }))
  }

  const clearFilters = () => {
    setSearchTerm('')
    setFilters({
      loyaltyPoints: 'all',
      phoneStatus: 'all',
      sortBy: 'name_asc',
      branchId: 'all'
    })
    setPagination(prev => ({ ...prev, currentPage: 1 }))
  }

  // Fetch customer draft transactions
  const fetchCustomerDraftTransactions = async (customerId) => {
    try {
      const response = await fetch(`/api/transactions?customer_id=${customerId}&status=pending`)
      console.log('📡 Response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        setCustomerDraftTransactions(data.transactions || [])
      } else {
        const errorData = await response.json()
        console.error('❌ API error:', errorData)
        setCustomerDraftTransactions([])
      }
    } catch (error) {
      console.error('💥 Error fetching draft transactions:', error)
      setCustomerDraftTransactions([])
    }
  }

  // Fetch customer transaction history
  const fetchCustomerHistory = async (customerId, loadMore = false) => {
    try {
      setHistoryModal(prev => ({ ...prev, loading: true }))

      const offset = loadMore ? historyModal.offset : 0
      const response = await fetch(
        `/api/customers/${customerId}/transactions?limit=${HISTORY_LIMIT}&offset=${offset}`
      )

      if (response.ok) {
        const data = await response.json()

        setHistoryModal(prev => ({
          ...prev,
          transactions: loadMore ? [...prev.transactions, ...data.transactions] : data.transactions,
          loading: false,
          hasMore: data.transactions.length === HISTORY_LIMIT,
          offset: offset + data.transactions.length
        }))
      } else {
        console.error('Failed to fetch customer history')
        setHistoryModal(prev => ({ ...prev, loading: false }))
      }
    } catch (error) {
      console.error('Error fetching customer history:', error)
      setHistoryModal(prev => ({ ...prev, loading: false }))
    }
  }

  // Handle view history
  const handleViewHistory = (customer) => {
    setHistoryModal({
      show: true,
      customer: customer,
      transactions: [],
      loading: false,
      hasMore: true,
      offset: 0
    })
    fetchCustomerHistory(customer.id_pelanggan, false)
  }

  // Handle edit Total Cuci
  const handleEditTotalCuci = (customer) => {
    setEditTotalCuciModal({
      show: true,
      customer: customer,
      addValue: 0,
      newTotal: customer.total_cuci || 0,
      fotoBukti: null,
      fotoPreview: null,
      uploading: false,
      alasan: '',
      mode: 'add' // Default mode: tambah
    })
  }

  // Handle foto upload with auto-compression
  const handleFotoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('File harus berupa gambar (JPEG, PNG, WebP)')
      return
    }

    try {
      // Show compressing state
      setEditTotalCuciModal(prev => ({
        ...prev,
        uploading: true
      }))

      // Compression options - aggressive compression for audit
      const options = {
        maxSizeMB: 0.5, // Max 500KB after compression
        maxWidthOrHeight: 1280, // Max dimension 1280px (HD)
        useWebWorker: true, // Use web worker for better performance
        fileType: 'image/jpeg', // Convert to JPEG for better compression
        initialQuality: 0.7 // 70% quality - still good for audit
      }

      console.log(`Original file size: ${(file.size / 1024 / 1024).toFixed(2)} MB`)

      // Compress the image
      const compressedBlob = await imageCompression(file, options)

      console.log(`Compressed file size: ${(compressedBlob.size / 1024 / 1024).toFixed(2)} MB`)
      console.log(`Compression ratio: ${((1 - compressedBlob.size / file.size) * 100).toFixed(1)}%`)

      // Convert Blob to File with proper name
      const compressedFile = new File(
        [compressedBlob],
        `compressed_${Date.now()}.jpg`,
        { type: 'image/jpeg' }
      )

      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setEditTotalCuciModal(prev => ({
          ...prev,
          fotoPreview: reader.result,
          fotoBukti: compressedFile,
          uploading: false
        }))
      }
      reader.readAsDataURL(compressedFile)

    } catch (error) {
      console.error('Error compressing image:', error)
      alert('Gagal memproses gambar. Silakan coba lagi.')
      setEditTotalCuciModal(prev => ({
        ...prev,
        uploading: false
      }))
    }
  }

  // Smart photo upload - detect device and use appropriate method
  const handleSmartPhotoUpload = () => {
    // Detect if mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

    if (isMobile) {
      // Mobile: trigger input with capture (opens camera)
      document.getElementById('foto-bukti-input').click()
    } else {
      // Desktop: just open file picker
      document.getElementById('foto-bukti-input').click()
    }
  }

  // Remove foto
  const handleRemoveFoto = () => {
    setEditTotalCuciModal(prev => ({
      ...prev,
      fotoBukti: null,
      fotoPreview: null
    }))
  }

  const handleSaveTotalCuci = async () => {
    // Validasi alasan wajib diisi HANYA untuk kasir
    if (!isOwner && (!editTotalCuciModal.alasan || editTotalCuciModal.alasan.trim() === '')) {
      alert('⚠️ Alasan penyesuaian wajib diisi untuk audit trail!')
      return
    }

    // Foto bukti sekarang OPSIONAL (tidak wajib)
    // if (!isOwner && !editTotalCuciModal.fotoBukti) {
    //   alert('⚠️ Foto bukti wajib diupload untuk audit trail!')
    //   return
    // }

    try {
      setEditTotalCuciModal(prev => ({ ...prev, loading: true }))

      let fotoUrl = null

      // Upload foto if exists
      if (editTotalCuciModal.fotoBukti) {
        setEditTotalCuciModal(prev => ({ ...prev, uploading: true }))

        const formData = new FormData()
        formData.append('foto', editTotalCuciModal.fotoBukti)

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (!uploadResponse.ok) {
          throw new Error('Gagal mengupload foto bukti')
        }

        const uploadData = await uploadResponse.json()
        fotoUrl = uploadData.url

        setEditTotalCuciModal(prev => ({ ...prev, uploading: false }))
      }

      const response = await fetch(`/api/customers/${editTotalCuciModal.customer.id_pelanggan}/total-cuci`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_total_cuci: parseInt(editTotalCuciModal.newTotal),
          old_total_cuci: editTotalCuciModal.customer.total_cuci || 0,
          foto_bukti: fotoUrl,
          alasan: editTotalCuciModal.alasan.trim()
        })
      })

      if (response.ok) {
        setSuccessModal({
          show: true,
          type: 'edit',
          message: 'Total cuci berhasil diupdate dan dicatat ke log!'
        })
        setEditTotalCuciModal({ show: false, customer: null, addValue: 0, newTotal: 0, loading: false, fotoBukti: null, fotoPreview: null, uploading: false, alasan: '', mode: 'add' })
        fetchCustomers() // Refresh customer data
      } else {
        const error = await response.json()
        alert('Gagal mengupdate total cuci: ' + error.message)
      }
    } catch (error) {
      console.error('Error updating total cuci:', error)
      alert('Terjadi kesalahan saat mengupdate total cuci: ' + error.message)
    } finally {
      setEditTotalCuciModal(prev => ({ ...prev, loading: false, uploading: false }))
    }
  }

  // Handle draft transaction payment via form
  const handlePayDraftTransactionForm = (transaction) => {
    if (onPayTransaction) {
      // Close customer edit modal and open transaction form at payment step
      setEditingCustomer(null)
      onPayTransaction(transaction)
    }
  }

  // Handle draft transaction payment
  const handlePayDraftTransaction = async (transactionId, paymentMethod) => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: paymentMethod,
          is_draft: false // Convert from draft to paid
        })
      })

      if (response.ok) {
        setSuccessModal({
          show: true,
          type: 'payment',
          message: 'Draft transaksi berhasil dibayar!'
        })
        // Refresh draft transactions
        fetchCustomerDraftTransactions(editingCustomer.id_pelanggan)
      } else {
        const error = await response.json()
        alert('Gagal memproses pembayaran: ' + error.message)
      }
    } catch (error) {
      console.error('Error processing payment:', error)
      alert('Terjadi kesalahan saat memproses pembayaran')
    }
  }

  // Handle edit customer with draft check (only for kasir)
  const handleEditCustomerClick = async (customer) => {
    setEditingCustomer(customer)
    
    // Only fetch draft transactions for kasir role
    // Owner doesn't need to see draft transactions
    if (typeof window !== 'undefined') {
      // Check if user is kasir by looking at current path or user context
      const isOwnerDashboard = window.location.pathname.includes('/dashboard') && 
                              !window.location.pathname.includes('/kasir')
      
      if (!isOwnerDashboard) {
        await fetchCustomerDraftTransactions(customer.id_pelanggan)
      } else {
        // Clear draft transactions for owner
        setCustomerDraftTransactions([])
      }
    }
  }

  const handleAddCustomer = async () => {
    if (!newCustomer.nama_pelanggan.trim()) {
      setSuccessModal({
        show: true,
        type: 'error',
        message: 'Nama pelanggan wajib diisi sebelum menyimpan.'
      })
      return
    }

    // For owner, branch selection is required
    if (isOwner && !newCustomer.id_cabang) {
      setSuccessModal({
        show: true,
        type: 'error',
        message: 'Cabang wajib dipilih untuk pelanggan baru.'
      })
      return
    }

    // Validate phone number if provided
    if (newCustomer.nomor_telepon && newCustomer.nomor_telepon.trim()) {
      const phoneValidation = validatePhoneNumber(newCustomer.nomor_telepon)
      if (!phoneValidation.isValid) {
        setSuccessModal({
          show: true,
          type: 'error',
          message: phoneValidation.error
        })
        return
      }
      // Use normalized phone number
      newCustomer.nomor_telepon = phoneValidation.sanitized
    }

    try {
      const requestBody = {
        nama_pelanggan: newCustomer.nama_pelanggan,
        nomor_telepon: newCustomer.nomor_telepon
      }

      // Add id_cabang for owner
      if (isOwner && newCustomer.id_cabang) {
        requestBody.id_cabang = parseInt(newCustomer.id_cabang)
      }

      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        setNewCustomer({ nama_pelanggan: '', nomor_telepon: '', id_cabang: '' })
        setShowAddModal(false)
        fetchCustomers()
        setSuccessModal({
          show: true,
          type: 'add',
          message: 'Pelanggan berhasil ditambahkan!'
        })
      } else {
        const error = await response.json()
        setSuccessModal({
          show: true,
          type: 'error',
          message: error.message || 'Gagal menambah pelanggan.'
        })
      }
    } catch (error) {
      // Don't log expected business errors as console.error
      if (!error.message?.includes('sudah terdaftar') && !error.message?.includes('sudah digunakan')) {
        console.error('Unexpected error adding customer:', error)
      }
      setSuccessModal({
        show: true,
        type: 'error',
        message: 'Terjadi kesalahan saat menambah pelanggan. Silakan coba lagi.'
      })
    }
  }

  const handleEditCustomer = async () => {
    if (!editingCustomer.nama_pelanggan.trim()) {
      setSuccessModal({
        show: true,
        type: 'error',
        message: 'Nama pelanggan wajib diisi sebelum menyimpan.'
      })
      return
    }

    // Validate phone number if provided
    if (editingCustomer.nomor_telepon && editingCustomer.nomor_telepon.trim()) {
      const phoneValidation = validatePhoneNumber(editingCustomer.nomor_telepon)
      if (!phoneValidation.isValid) {
        setSuccessModal({
          show: true,
          type: 'error',
          message: phoneValidation.error
        })
        return
      }
      // Use normalized phone number
      editingCustomer.nomor_telepon = phoneValidation.sanitized
    }

    try {
      const response = await fetch(`/api/customers/${editingCustomer.id_pelanggan}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_pelanggan: editingCustomer.nama_pelanggan,
          nomor_telepon: editingCustomer.nomor_telepon
        })
      })

      if (response.ok) {
        setEditingCustomer(null)
        fetchCustomers()
        setSuccessModal({
          show: true,
          type: 'edit',
          message: 'Data pelanggan berhasil diperbarui!'
        })
      } else {
        const error = await response.json()
        alert('Gagal memperbarui data: ' + error.message)
      }
    } catch (error) {
      console.error('Error updating customer:', error)
      alert('Terjadi kesalahan saat memperbarui data')
    }
  }

  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return

    try {
      const response = await fetch(`/api/customers/${deletingCustomer.id_pelanggan}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const result = await response.json()
        setDeletingCustomer(null)
        fetchCustomers()
        
        if (result.soft_delete) {
          setSuccessModal({
            show: true,
            type: 'deactivate',
            message: 'Pelanggan berhasil dinonaktifkan karena memiliki riwayat transaksi'
          })
        } else {
          setSuccessModal({
            show: true,
            type: 'delete',
            message: 'Pelanggan berhasil dihapus!'
          })
        }
      } else {
        const error = await response.json()
        alert('Gagal menghapus pelanggan: ' + error.message)
      }
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('Terjadi kesalahan saat menghapus pelanggan')
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    , timeZone: 'Asia/Jakarta' })
  }

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, currentPage: page }))
  }

  return (
    <div className="space-y-6">
      {/* Header Actions & Filters */}
      <Card>
        <div className="space-y-3">
          {/* Top Row: Search with Filter Button (Unicorn App Style) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Search Bar with Filter Button - Mobile */}
            <div className="flex-1 flex gap-2 items-center">
              <div className="flex-1 relative">
                <Input
                  type="text"
                  placeholder="🔍 Cari nama pelanggan atau nomor telepon..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="w-full"
                />
              </div>
              {/* Filter Button - Next to Search (Mobile Only) */}
              <button
                onClick={() => setShowFilterSheet(true)}
                className="sm:hidden flex-shrink-0 px-3 py-2 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors relative min-h-[40px]"
                aria-label="Filter"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                {/* Active Filter Badge */}
                {(filters.loyaltyPoints !== 'all' || filters.phoneStatus !== 'all' || filters.sortBy !== 'name_asc' || (isOwner && filters.branchId !== 'all')) && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-semibold shadow-md">
                    {[
                      isOwner && filters.branchId !== 'all' ? 1 : 0,
                      filters.loyaltyPoints !== 'all' ? 1 : 0,
                      filters.phoneStatus !== 'all' ? 1 : 0,
                      filters.sortBy !== 'name_asc' ? 1 : 0
                    ].reduce((a, b) => a + b, 0)}
                  </span>
                )}
              </button>
            </div>
            <Button
              onClick={() => setShowAddModal(true)}
              className="hidden sm:flex bg-orange-500 hover:bg-orange-600 text-white whitespace-nowrap"
            >
              + Tambah Pelanggan
            </Button>
          </div>

          {/* Filter Row - Desktop: Dropdowns */}
          <div className="block sm:hidden">
            {/* Mobile filter button is now next to search bar */}
          </div>

          <div className={`hidden sm:grid gap-3 ${isOwner ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}>
            {/* Branch Filter - Owner Only */}
            {isOwner && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cabang</label>
                <select
                  value={filters.branchId}
                  onChange={(e) => handleFilterChange('branchId', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  disabled={loadingBranches}
                >
                  <option value="all">Semua Cabang</option>
                  {branches.map(branch => (
                    <option key={branch.id_cabang} value={branch.id_cabang}>
                      {branch.nama_cabang}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Loyalty Points Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Loyalty Points</label>
              <select
                value={filters.loyaltyPoints}
                onChange={(e) => handleFilterChange('loyaltyPoints', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">Semua</option>
                <option value="with_points">Punya Points</option>
                <option value="no_points">Tanpa Points</option>
              </select>
            </div>

            {/* Phone Status Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status Telepon</label>
              <select
                value={filters.phoneStatus}
                onChange={(e) => handleFilterChange('phoneStatus', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">Semua</option>
                <option value="with_phone">Ada Telepon</option>
                <option value="no_phone">Tanpa Telepon</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Urutkan</label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="name_asc">Nama A-Z</option>
                <option value="name_desc">Nama Z-A</option>
                <option value="cuci_desc">Cuci Terbanyak</option>
                <option value="points_desc">Points Tertinggi</option>
                <option value="date_desc">Terbaru Bergabung</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full text-sm"
              >
                Reset Filter
              </Button>
            </div>
          </div>

          {/* Active Filters Summary */}
          {(searchTerm || filters.loyaltyPoints !== 'all' || filters.phoneStatus !== 'all' || filters.sortBy !== 'name_asc' || (isOwner && filters.branchId !== 'all')) && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-600">Filter aktif:</span>
              {searchTerm && (
                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                  Pencarian: &quot;{searchTerm}&quot;
                </span>
              )}
              {isOwner && filters.branchId !== 'all' && (
                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                  {branches.find(b => b.id_cabang === parseInt(filters.branchId))?.nama_cabang || 'Cabang'}
                </span>
              )}
              {filters.loyaltyPoints !== 'all' && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {filters.loyaltyPoints === 'with_points' ? 'Punya Points' : 'Tanpa Points'}
                </span>
              )}
              {filters.phoneStatus !== 'all' && (
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                  {filters.phoneStatus === 'with_phone' ? 'Ada Telepon' : 'Tanpa Telepon'}
                </span>
              )}
              {filters.sortBy !== 'name_asc' && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                  {filters.sortBy === 'name_desc' ? 'Z-A' :
                   filters.sortBy === 'cuci_desc' ? 'Cuci ↓' :
                   filters.sortBy === 'points_desc' ? 'Points ↓' : 'Terbaru'}
                </span>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Customer List */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold whitespace-nowrap">
            Daftar Pelanggan
          </h3>
          <div className="text-sm text-gray-600 text-right">
            Total: {pagination.totalCustomers} pelanggan
          </div>
        </div>

        {loading ? (
          <>
            {/* Mobile Skeleton */}
            <div className="block sm:hidden">
              <SkeletonLoader type="card" count={5} />
            </div>
            {/* Desktop Skeleton */}
            <div className="hidden sm:block">
              <SkeletonLoader type="table" count={10} />
            </div>
          </>
        ) : customers.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">👥</div>
            <p className="text-gray-500">
              {searchTerm ? 'Tidak ada pelanggan yang sesuai pencarian' : 'Belum ada data pelanggan'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="block sm:hidden space-y-3">
              {customers.map((customer) => (
                <div key={customer.id_pelanggan} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  {/* Header Row */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 text-base truncate mb-1">
                        {customer.nama_pelanggan}
                      </h4>
                      {isOwner && customer.nama_cabang && (
                        <p className="text-xs text-indigo-700 font-medium">
                          🏢 {customer.nama_cabang}
                        </p>
                      )}
                      <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                        <span>📱</span>
                        <span>{customer.nomor_telepon || 'Tidak ada nomor'}</span>
                      </p>
                    </div>
                    <div className="flex space-x-2 ml-3">
                      <button
                        onClick={() => handleViewHistory(customer)}
                        className="bg-purple-50 text-purple-600 hover:bg-purple-100 p-2 rounded-lg transition-colors"
                        title="Lihat history"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => handleEditCustomerClick(customer)}
                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2 rounded-lg transition-colors"
                        title="Edit pelanggan"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setDeletingCustomer(customer)}
                        className="bg-red-50 text-red-600 hover:bg-red-100 p-2 rounded-lg transition-colors"
                        title="Hapus pelanggan"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  
                  {/* Stats Grid - Row 1 */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">Total Cuci</div>
                      <div className="flex items-center justify-center space-x-2">
                        {customer.total_cuci > 0 ? (
                          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                            🧺 {customer.total_cuci}x
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">0x</span>
                        )}
                        <button
                          onClick={() => handleEditTotalCuci(customer)}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                          title="Edit Total Cuci"
                        >
                          ✏️
                        </button>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">Loyalty Points</div>
                      {customer.loyalty_points > 0 ? (
                        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                          🏆 {customer.loyalty_points}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">0</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Stats Grid - Row 2 */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">Total Redeem</div>
                      {customer.total_redeem > 0 ? (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                          🎁 {customer.total_redeem}x
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">0x</span>
                      )}
                    </div>
                    {showBranchContext && customer.customer_category ? (
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Status</div>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          customer.customer_category === 'local'
                            ? 'bg-green-100 text-green-800'
                            : customer.customer_category === 'new'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {customer.customer_category === 'local'
                            ? '🏠 Cabang Ini'
                            : customer.customer_category === 'new'
                            ? '✨ Customer Baru'
                            : '🌍 Cabang Lain'}
                        </span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Bergabung</div>
                        <div className="text-sm font-medium text-gray-700">
                          📅 {formatDate(customer.dibuat_pada)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nama Pelanggan
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nomor Telepon
                    </th>
                    {isOwner && (
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cabang
                      </th>
                    )}
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Cuci
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Redeem
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Loyalty Points
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bergabung
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customers.map((customer) => (
                    <tr key={customer.id_pelanggan} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {showBranchContext && customer.customer_category && (
                            <span className="mr-2">
                              {customer.customer_category === 'local'
                                ? '🏠'
                                : customer.customer_category === 'new'
                                ? '✨'
                                : '🌍'}
                            </span>
                          )}
                          {customer.nama_pelanggan}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-600">
                          {customer.nomor_telepon || '-'}
                        </div>
                      </td>
                      {isOwner && (
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm text-gray-900">
                            <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-medium">
                              {customer.nama_cabang || 'N/A'}
                            </span>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <div className="text-sm text-gray-900">
                            {customer.total_cuci > 0 ? (
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                🧺 {customer.total_cuci}x
                              </span>
                            ) : (
                              <span className="text-gray-400">0x</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleEditTotalCuci(customer)}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                            title="Edit Total Cuci"
                          >
                            ✏️
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-900">
                          {customer.total_redeem > 0 ? (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                              🎁 {customer.total_redeem}x
                            </span>
                          ) : (
                            <span className="text-gray-400">0x</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-900">
                          {customer.loyalty_points > 0 ? (
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                              🏆 {customer.loyalty_points}
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                        {formatDate(customer.dibuat_pada)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex justify-center space-x-1">
                          <button
                            onClick={() => handleViewHistory(customer)}
                            className="text-purple-600 hover:text-purple-800 p-1 rounded"
                            title="Lihat history"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => handleEditCustomerClick(customer)}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded"
                            title="Edit pelanggan"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => setDeletingCustomer(customer)}
                            className="text-red-600 hover:text-red-800 p-1 rounded"
                            title="Hapus pelanggan"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                <div className="text-sm text-gray-600 order-2 sm:order-1">
                  Menampilkan {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} - {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalCustomers)} dari {pagination.totalCustomers} pelanggan
                </div>
                
                <div className="flex items-center justify-center space-x-2 order-1 sm:order-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={pagination.currentPage === 1}
                    className="px-3 py-1"
                  >
                    ← Prev
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {[...Array(Math.min(3, pagination.totalPages))].map((_, index) => {
                      let pageNum
                      if (pagination.totalPages <= 3) {
                        pageNum = index + 1
                      } else if (pagination.currentPage <= 2) {
                        pageNum = index + 1
                      } else if (pagination.currentPage >= pagination.totalPages - 1) {
                        pageNum = pagination.totalPages - 2 + index
                      } else {
                        pageNum = pagination.currentPage - 1 + index
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1 text-sm rounded min-w-[2.5rem] ${
                            pagination.currentPage === pageNum
                              ? 'bg-orange-600 text-white'
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
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={pagination.currentPage === pagination.totalPages}
                    className="px-3 py-1"
                  >
                    Next →
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Add Customer Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setNewCustomer({ nama_pelanggan: '', nomor_telepon: '', id_cabang: '' })
        }}
        title="Tambah Pelanggan Baru"
      >
        <div className="space-y-4">
          <Input
            label="Nama Pelanggan"
            value={newCustomer.nama_pelanggan}
            onChange={(e) => setNewCustomer(prev => ({
              ...prev, nama_pelanggan: e.target.value
            }))}
            placeholder="Masukkan nama pelanggan"
            required
          />

          {/* Suffix Detection Warning */}
          {newCustomer.nama_pelanggan && /(dw|DW|Dw|dW)\d+/.test(newCustomer.nama_pelanggan) && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-red-600 text-sm">⚠️</span>
                <div className="text-red-800 text-sm">
                  <strong>Jangan tambahkan &quot;dw6&quot; atau suffix cabang!</strong>
                  <br />
                  Sistem otomatis mendeteksi cabang. Gunakan nama asli customer saja.
                </div>
              </div>
            </div>
          )}

          <Input
            label="Nomor Telepon"
            value={newCustomer.nomor_telepon}
            onChange={(e) => setNewCustomer(prev => ({
              ...prev, nomor_telepon: e.target.value
            }))}
            placeholder="Nomor telepon/WhatsApp (opsional)"
          />

          {/* Branch Selection - Owner Only */}
          {isOwner && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cabang <span className="text-red-500">*</span>
              </label>
              <select
                value={newCustomer.id_cabang}
                onChange={(e) => setNewCustomer(prev => ({
                  ...prev, id_cabang: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              >
                <option value="">Pilih Cabang</option>
                {branches.map(branch => (
                  <option key={branch.id_cabang} value={branch.id_cabang}>
                    {branch.nama_cabang}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false)
                setNewCustomer({ nama_pelanggan: '', nomor_telepon: '', id_cabang: '' })
              }}
            >
              Batal
            </Button>
            <Button
              onClick={handleAddCustomer}
              disabled={!newCustomer.nama_pelanggan.trim() || (isOwner && !newCustomer.id_cabang)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Simpan
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal 
        isOpen={!!editingCustomer} 
        onClose={() => {
          setEditingCustomer(null)
          setCustomerDraftTransactions([])
        }}
        title="Edit Data Pelanggan"
      >
        {editingCustomer && (
          <div className="space-y-4">
            <Input
              label="Nama Pelanggan"
              value={editingCustomer.nama_pelanggan}
              onChange={(e) => setEditingCustomer(prev => ({
                ...prev, nama_pelanggan: e.target.value
              }))}
              placeholder="Masukkan nama pelanggan"
              required
            />

            {/* Suffix Detection Warning */}
            {editingCustomer.nama_pelanggan && /(dw|DW|Dw|dW)\d+/.test(editingCustomer.nama_pelanggan) && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-red-600 text-sm">⚠️</span>
                  <div className="text-red-800 text-sm">
                    <strong>Jangan tambahkan &quot;dw6&quot; atau suffix cabang!</strong>
                    <br />
                    Sistem otomatis mendeteksi cabang. Gunakan nama asli customer saja.
                  </div>
                </div>
              </div>
            )}

            <Input
              label="Nomor Telepon"
              value={editingCustomer.nomor_telepon || ''}
              onChange={(e) => setEditingCustomer(prev => ({
                ...prev, nomor_telepon: e.target.value
              }))}
              placeholder="Nomor telepon/WhatsApp (opsional)"
            />
            
            {/* Customer Info */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600">
                {isOwner && editingCustomer.nama_cabang && (
                  <div className="mb-2">
                    <span className="font-medium">Cabang: </span>
                    <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-medium">
                      {editingCustomer.nama_cabang}
                    </span>
                  </div>
                )}
                <div>Bergabung: {formatDate(editingCustomer.dibuat_pada)}</div>
                <div className="mt-1">
                  Total Cuci: <span className="font-semibold text-blue-600">{editingCustomer.total_cuci || 0}x</span>
                  {editingCustomer.total_redeem > 0 && (
                    <span className="ml-3">
                      Total Redeem: <span className="font-semibold text-green-600">{editingCustomer.total_redeem}x</span>
                    </span>
                  )}
                </div>
                {editingCustomer.loyalty_points > 0 && (
                  <div className="mt-1">
                    Loyalty Points: <span className="font-semibold text-yellow-600">{editingCustomer.loyalty_points}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Draft Transactions - Only show for Kasir */}
            {customerDraftTransactions.length > 0 && 
             typeof window !== 'undefined' && 
             !(window.location.pathname.includes('/dashboard') && !window.location.pathname.includes('/kasir')) && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-orange-600">⏰</span>
                  <h4 className="font-semibold text-orange-800">Transaksi Draft ({customerDraftTransactions.length})</h4>
                </div>
                
                <div className="space-y-2">
                  {customerDraftTransactions.map((transaction) => (
                    <div key={transaction.id_transaksi} className="bg-white border border-orange-200 rounded p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium text-gray-900">#{transaction.kode_transaksi}</div>
                          <div className="text-sm text-gray-600">
                            {new Date(transaction.tanggal_transaksi).toLocaleDateString('id-ID')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg text-gray-900">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(transaction.total_keseluruhan)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-end space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Open transaction for editing - redirect to transaction form
                            window.open(`/dashboard?transaction_id=${transaction.id_transaksi}`, '_blank')
                          }}
                        >
                          ✏️ Edit
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-500 hover:bg-green-600 text-white"
                          onClick={() => handlePayDraftTransactionForm(transaction)}
                        >
                          💳 Bayar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setEditingCustomer(null)
                  setCustomerDraftTransactions([])
                }}
              >
                Batal
              </Button>
              <Button 
                onClick={handleEditCustomer}
                disabled={!editingCustomer.nama_pelanggan.trim()}
                className="bg-blue-500 hover:bg-blue-600"
              >
                Perbarui
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={!!deletingCustomer} 
        onClose={() => setDeletingCustomer(null)}
        title="Konfirmasi Hapus Pelanggan"
      >
        {deletingCustomer && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Hapus Pelanggan
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Apakah Anda yakin ingin menghapus pelanggan ini?
                </p>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm">
                <div className="font-semibold text-gray-900">
                  {deletingCustomer.nama_pelanggan}
                </div>
                <div className="text-gray-600 mt-1">
                  {deletingCustomer.nomor_telepon || 'Tidak ada nomor telepon'}
                </div>
                {deletingCustomer.loyalty_points > 0 && (
                  <div className="mt-2">
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                      🏆 {deletingCustomer.loyalty_points} poin
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <span className="text-amber-600 mt-0.5">ℹ️</span>
                <div className="text-sm text-amber-800">
                  <strong>Catatan:</strong> Jika pelanggan memiliki riwayat transaksi, 
                  data akan dinonaktifkan (tidak dihapus permanen) untuk menjaga integritas data.
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setDeletingCustomer(null)}
              >
                Batal
              </Button>
              <Button 
                onClick={handleDeleteCustomer}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Ya, Hapus Pelanggan
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Success Modal */}
      <Modal 
        isOpen={successModal.show} 
        onClose={() => setSuccessModal({ show: false, type: '', message: '' })}
        title={successModal.type === 'error' ? 'Terjadi Kesalahan' : 'Operasi Berhasil'}
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className={`flex-shrink-0 w-12 h-12 ${successModal.type === 'error' ? 'bg-red-100' : 'bg-green-100'} rounded-full flex items-center justify-center`}>
              {successModal.type === 'add' && <span className="text-2xl">➕</span>}
              {successModal.type === 'edit' && <span className="text-2xl">✏️</span>}
              {successModal.type === 'delete' && <span className="text-2xl">🗑️</span>}
              {successModal.type === 'deactivate' && <span className="text-2xl">⏸️</span>}
              {successModal.type === 'payment' && <span className="text-2xl">💰</span>}
              {successModal.type === 'error' && <span className="text-2xl text-red-600">⚠️</span>}
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-medium ${successModal.type === 'error' ? 'text-red-900' : 'text-gray-900'}`}>
                {successModal.type === 'add' && 'Pelanggan Ditambahkan'}
                {successModal.type === 'edit' && 'Data Diperbarui'}
                {successModal.type === 'delete' && 'Pelanggan Dihapus'}
                {successModal.type === 'deactivate' && 'Pelanggan Dinonaktifkan'}
                {successModal.type === 'payment' && 'Pembayaran Berhasil'}
                {successModal.type === 'error' && 'Gagal Memproses'}
              </h3>
              <p className={`text-sm mt-1 ${successModal.type === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
                {successModal.message}
              </p>
            </div>
          </div>
          
          <div className="flex justify-end pt-4">
            <Button 
              onClick={() => setSuccessModal({ show: false, type: '', message: '' })}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              OK
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Total Cuci Modal */}
      <Modal
        isOpen={editTotalCuciModal.show}
        onClose={() => setEditTotalCuciModal({ show: false, customer: null, addValue: 0, newTotal: 0, loading: false, fotoBukti: null, fotoPreview: null, uploading: false, alasan: '', mode: 'add' })}
        title="Penyesuaian Total Cuci"
      >
        {/* Full Screen Loading Overlay */}
        {(editTotalCuciModal.uploading || editTotalCuciModal.loading) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-lg p-6 shadow-xl">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">
                    {editTotalCuciModal.uploading ? 'Memproses foto...' : 'Menyimpan data...'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {editTotalCuciModal.uploading ? 'Mengkompress dan upload foto' : 'Mohon tunggu sebentar'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {editTotalCuciModal.customer && (
            <>
            {/* Header Info */}
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="mb-2">
                <p className="font-semibold text-gray-900">{editTotalCuciModal.customer.nama_pelanggan}</p>
                <p className="text-xs text-gray-500">
                  {editTotalCuciModal.customer.nomor_telepon || 'Tanpa nomor HP'}
                </p>
              </div>

              {/* Sebelum/Sesudah */}
              <div className="bg-white rounded-md p-3 border">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Sebelum</p>
                    <p className="text-lg font-bold text-red-600">{editTotalCuciModal.customer.total_cuci || 0}x</p>
                  </div>

                  <div className="flex-1 flex justify-center">
                    <div className={`rounded-full px-3 py-1 ${
                      editTotalCuciModal.addValue > 0
                        ? (editTotalCuciModal.mode === 'reduce' ? 'bg-red-100' : 'bg-green-100')
                        : 'bg-gray-100'
                    }`}>
                      <span className={`text-xs font-medium ${
                        editTotalCuciModal.addValue > 0
                          ? (editTotalCuciModal.mode === 'reduce' ? 'text-red-700' : 'text-green-700')
                          : 'text-gray-600'
                      }`}>
                        {editTotalCuciModal.addValue > 0
                          ? (editTotalCuciModal.mode === 'reduce' ? `-${editTotalCuciModal.addValue}` : `+${editTotalCuciModal.addValue}`)
                          : '0'
                        }
                      </span>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-gray-500">Sesudah</p>
                    <p className="text-lg font-bold text-green-600">{editTotalCuciModal.newTotal}x</p>
                  </div>
                </div>
              </div>
            </div>
            </>
          )}
          
          {/* Mode Toggle - Owner Only */}
          {isOwner && (
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setEditTotalCuciModal(prev => ({
                    ...prev,
                    mode: 'add',
                    addValue: 0,
                    newTotal: prev.customer?.total_cuci || 0
                  }))
                }}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  editTotalCuciModal.mode === 'add'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                ↑ Tambah
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditTotalCuciModal(prev => ({
                    ...prev,
                    mode: 'reduce',
                    addValue: 0,
                    newTotal: prev.customer?.total_cuci || 0
                  }))
                }}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  editTotalCuciModal.mode === 'reduce'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                ↓ Kurang
              </button>
            </div>
          )}

          {/* Input Tambah/Kurangi Cuci */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isOwner
                ? (editTotalCuciModal.mode === 'add' ? 'Tambah Jumlah Cuci' : 'Kurangi Jumlah Cuci')
                : 'Tambah Jumlah Cuci'
              }
            </label>
            <Input
              type="number"
              min="0"
              value={editTotalCuciModal.addValue === 0 ? '' : editTotalCuciModal.addValue}
              onChange={(e) => {
                const inputValue = parseInt(e.target.value) || 0
                const currentTotal = editTotalCuciModal.customer?.total_cuci || 0
                let newTotal

                if (isOwner && editTotalCuciModal.mode === 'reduce') {
                  // Mode kurangi
                  newTotal = Math.max(0, currentTotal - inputValue)
                } else {
                  // Mode tambah
                  newTotal = currentTotal + inputValue
                }

                setEditTotalCuciModal(prev => ({
                  ...prev,
                  addValue: inputValue,
                  newTotal: newTotal
                }))
              }}
              placeholder="Contoh: 10"
              className="w-full"
            />
          </div>

          {/* Alasan Input - HANYA untuk Kasir */}
          {!isOwner && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alasan <span className="text-red-500">*</span>
              </label>
              <textarea
                value={editTotalCuciModal.alasan}
                onChange={(e) => setEditTotalCuciModal(prev => ({
                  ...prev,
                  alasan: e.target.value
                }))}
                placeholder="Migrasi dari nota kertas, koreksi data, dll."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          )}

          {/* Foto Bukti Upload - HANYA untuk Kasir (OPSIONAL) */}
          {!isOwner && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Foto Bukti <span className="text-gray-400 text-xs">(opsional)</span>
              </label>

              {/* Hidden file input - smart capture for mobile */}
              <input
                id="foto-bukti-input"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFotoChange}
                className="hidden"
              />

              {!editTotalCuciModal.fotoPreview ? (
                <button
                  type="button"
                  onClick={handleSmartPhotoUpload}
                  className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white border border-blue-600 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <span className="text-xl">📷</span>
                  <span>Upload Foto Bukti</span>
                </button>
              ) : (
                <div className="relative border border-gray-300 rounded-lg overflow-hidden">
                  <img
                    src={editTotalCuciModal.fotoPreview}
                    alt="Preview"
                    className="w-full h-40 object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveFoto}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-center space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setEditTotalCuciModal({ show: false, customer: null, addValue: 0, newTotal: 0, loading: false, fotoBukti: null, fotoPreview: null, uploading: false, alasan: '', mode: 'add' })}
              disabled={editTotalCuciModal.loading || editTotalCuciModal.uploading}
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveTotalCuci}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={
                editTotalCuciModal.addValue <= 0 ||
                editTotalCuciModal.loading ||
                editTotalCuciModal.uploading ||
                (!isOwner && !editTotalCuciModal.alasan?.trim())
              }
            >
              {editTotalCuciModal.uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Upload...
                </>
              ) : editTotalCuciModal.loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Menyimpan...
                </>
              ) : (
                'Simpan'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* History Transaction Modal */}
      <Modal
        isOpen={historyModal.show}
        onClose={() => setHistoryModal({ show: false, customer: null, transactions: [], loading: false, hasMore: true, offset: 0 })}
        title="History Transaksi"
        size="lg"
        zIndex="z-[9999]"
      >
        <div className="space-y-4">
          {/* Customer Info - Fixed */}
          {historyModal.customer && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 sticky top-0 z-10">
              <h4 className="font-semibold text-gray-900">{historyModal.customer.nama_pelanggan}</h4>
              <p className="text-sm text-gray-600">{historyModal.customer.nomor_telepon || 'Tanpa nomor HP'}</p>
              {isOwner && historyModal.customer.nama_cabang && (
                <p className="text-xs text-indigo-700 font-medium mt-1">
                  🏢 {historyModal.customer.nama_cabang}
                </p>
              )}
            </div>
          )}

          {/* Transaction List - Scrollable */}
          <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2">
            {historyModal.transactions.length === 0 && !historyModal.loading ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">📋</div>
                <p className="text-gray-500">Belum ada riwayat transaksi</p>
              </div>
            ) : (
              <>
                {historyModal.transactions.map((transaction) => (
                <div key={transaction.id_transaksi} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-semibold text-gray-900">#{transaction.kode_transaksi}</div>
                      <div className="text-sm text-gray-600">
                        {/* Mobile: Vertical */}
                        <div className="flex flex-col sm:hidden">
                          <span>{new Date(transaction.tanggal_formatted).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          }).replace(/\//g, '/')}</span>
                          <span>{new Date(transaction.tanggal_formatted).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                          })} WIB</span>
                        </div>
                        {/* Desktop: Horizontal with bullet */}
                        <div className="hidden sm:flex items-center gap-2">
                          <span>{new Date(transaction.tanggal_formatted).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          }).replace(/\//g, '/')}</span>
                          <span className="text-gray-400">•</span>
                          <span>{new Date(transaction.tanggal_formatted).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                          })} WIB</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-gray-900">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(transaction.total_keseluruhan)}
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.status_transaksi === 'selesai'
                            ? 'bg-green-100 text-green-800'
                            : transaction.status_transaksi === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {transaction.status_transaksi === 'selesai' ? '✅' : transaction.status_transaksi === 'pending' ? '⏳' : '❌'}
                        </span>
                        {transaction.metode_pembayaran && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            transaction.metode_pembayaran === 'tunai'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {transaction.metode_pembayaran === 'tunai' ? '💵 Tunai' : '📱 QRIS'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Layanan */}
                  {transaction.layanan && transaction.layanan.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs font-semibold text-gray-700 mb-1">🧺 Layanan:</div>
                      <div className="space-y-1">
                        {Object.values(
                          transaction.layanan.reduce((acc, layanan) => {
                            const isFree = parseFloat(layanan.subtotal) === 0
                            const key = `${layanan.id_jenis_layanan}_${layanan.nama_layanan}_${isFree ? 'free' : 'paid'}`
                            if (!acc[key]) {
                              acc[key] = {
                                nama_layanan: layanan.nama_layanan,
                                quantity: 0,
                                subtotal: 0,
                                isFree: isFree
                              }
                            }
                            acc[key].quantity += parseInt(layanan.quantity) || 0
                            acc[key].subtotal += parseFloat(layanan.subtotal) || 0
                            return acc
                          }, {})
                        ).map((layanan, idx) => (
                          <div key={idx} className="text-sm text-gray-600 flex justify-between">
                            <span>
                              {layanan.nama_layanan} ({layanan.quantity}x{layanan.isFree ? ' gratis' : ''})
                            </span>
                            <span className="font-medium">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(layanan.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Produk */}
                  {transaction.produk && transaction.produk.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">📦 Produk:</div>
                      <div className="space-y-1">
                        {Object.values(
                          transaction.produk.reduce((acc, produk) => {
                            const key = `${produk.id_produk}_${produk.nama_produk}`
                            if (!acc[key]) {
                              acc[key] = {
                                nama_produk: produk.nama_produk,
                                quantity: 0,
                                subtotal: 0
                              }
                            }
                            acc[key].quantity += parseInt(produk.quantity) || 0
                            acc[key].subtotal += parseFloat(produk.subtotal) || 0
                            return acc
                          }, {})
                        ).map((produk, idx) => (
                          <div key={idx} className="text-sm text-gray-600 flex justify-between">
                            <span>{produk.nama_produk} ({produk.quantity}x)</span>
                            <span className="font-medium">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(produk.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                ))}

                {/* Loading indicator */}
                {historyModal.loading && (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                )}

                {/* Load More Button */}
                {historyModal.hasMore && !historyModal.loading && historyModal.transactions.length > 0 && (
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={() => fetchCustomerHistory(historyModal.customer.id_pelanggan, true)}
                      variant="outline"
                      className="w-full"
                    >
                      Load More
                    </Button>
                  </div>
                )}

                {/* No More Data */}
                {!historyModal.hasMore && historyModal.transactions.length > 0 && (
                  <div className="text-center py-4 text-sm text-gray-500">
                    Semua transaksi telah ditampilkan
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* FAB - Mobile Only */}
      <div className="block sm:hidden">
        <FloatingActionButton
          onClick={() => setShowAddModal(true)}
          label="Tambah Pelanggan"
        />
      </div>

      {/* Bottom Sheet Filters - Mobile Only */}
      <BottomSheet
        isOpen={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        title="Filter Pelanggan"
        height="auto"
      >
        <div className="space-y-6">
          {/* Branch Filter - Owner Only */}
          {isOwner && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Cabang</label>
              <div className="space-y-2">
                <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="branchId"
                    value="all"
                    checked={filters.branchId === 'all'}
                    onChange={(e) => handleFilterChange('branchId', e.target.value)}
                    className="w-4 h-4 text-orange-500"
                  />
                  <span className="ml-3 text-gray-700">Semua Cabang</span>
                </label>
                {branches.map(branch => (
                  <label key={branch.id_cabang} className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="branchId"
                      value={branch.id_cabang}
                      checked={filters.branchId === branch.id_cabang.toString()}
                      onChange={(e) => handleFilterChange('branchId', e.target.value)}
                      className="w-4 h-4 text-orange-500"
                    />
                    <span className="ml-3 text-gray-700">{branch.nama_cabang}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Loyalty Points Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Loyalty Points</label>
            <div className="space-y-2">
              <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="loyaltyPoints"
                  value="all"
                  checked={filters.loyaltyPoints === 'all'}
                  onChange={(e) => handleFilterChange('loyaltyPoints', e.target.value)}
                  className="w-4 h-4 text-orange-500"
                />
                <span className="ml-3 text-gray-700">Semua Pelanggan</span>
              </label>
              <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="loyaltyPoints"
                  value="with_points"
                  checked={filters.loyaltyPoints === 'with_points'}
                  onChange={(e) => handleFilterChange('loyaltyPoints', e.target.value)}
                  className="w-4 h-4 text-orange-500"
                />
                <span className="ml-3 text-gray-700">Punya Points</span>
              </label>
              <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="loyaltyPoints"
                  value="no_points"
                  checked={filters.loyaltyPoints === 'no_points'}
                  onChange={(e) => handleFilterChange('loyaltyPoints', e.target.value)}
                  className="w-4 h-4 text-orange-500"
                />
                <span className="ml-3 text-gray-700">Tanpa Points</span>
              </label>
            </div>
          </div>

          {/* Phone Status Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Status Telepon</label>
            <div className="space-y-2">
              <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="phoneStatus"
                  value="all"
                  checked={filters.phoneStatus === 'all'}
                  onChange={(e) => handleFilterChange('phoneStatus', e.target.value)}
                  className="w-4 h-4 text-orange-500"
                />
                <span className="ml-3 text-gray-700">Semua Status</span>
              </label>
              <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="phoneStatus"
                  value="with_phone"
                  checked={filters.phoneStatus === 'with_phone'}
                  onChange={(e) => handleFilterChange('phoneStatus', e.target.value)}
                  className="w-4 h-4 text-orange-500"
                />
                <span className="ml-3 text-gray-700">Ada Telepon</span>
              </label>
              <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="phoneStatus"
                  value="no_phone"
                  checked={filters.phoneStatus === 'no_phone'}
                  onChange={(e) => handleFilterChange('phoneStatus', e.target.value)}
                  className="w-4 h-4 text-orange-500"
                />
                <span className="ml-3 text-gray-700">Tanpa Telepon</span>
              </label>
            </div>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Urutkan</label>
            <div className="space-y-2">
              <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="sortBy"
                  value="name_asc"
                  checked={filters.sortBy === 'name_asc'}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  className="w-4 h-4 text-orange-500"
                />
                <span className="ml-3 text-gray-700">Nama A-Z</span>
              </label>
              <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="sortBy"
                  value="name_desc"
                  checked={filters.sortBy === 'name_desc'}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  className="w-4 h-4 text-orange-500"
                />
                <span className="ml-3 text-gray-700">Nama Z-A</span>
              </label>
              <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="sortBy"
                  value="cuci_desc"
                  checked={filters.sortBy === 'cuci_desc'}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  className="w-4 h-4 text-orange-500"
                />
                <span className="ml-3 text-gray-700">Cuci Terbanyak</span>
              </label>
              <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="sortBy"
                  value="points_desc"
                  checked={filters.sortBy === 'points_desc'}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  className="w-4 h-4 text-orange-500"
                />
                <span className="ml-3 text-gray-700">Points Tertinggi</span>
              </label>
              <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="sortBy"
                  value="date_desc"
                  checked={filters.sortBy === 'date_desc'}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  className="w-4 h-4 text-orange-500"
                />
                <span className="ml-3 text-gray-700">Terbaru Bergabung</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={clearFilters}
              className="flex-1"
            >
              Reset Filter
            </Button>
            <Button
              onClick={() => setShowFilterSheet(false)}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            >
              Terapkan
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}