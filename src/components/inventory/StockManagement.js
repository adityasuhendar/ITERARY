// FILE: src/app/components/inventory/StockManagement.js
"use client"
import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'

export default function StockManagement({ user, selectedNotificationRequest, onClearSelectedRequest }) {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [stockUpdates, setStockUpdates] = useState({})
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalProducts: 0,
    itemsPerPage: 10
  })
  const [showEditProductModal, setShowEditProductModal] = useState(false)
  const [editProduct, setEditProduct] = useState({
    id: null,
    nama_produk: '',
    harga: '',
    satuan: 'pcs',
    kategori_produk: 'sabun_softener',
    stok_tersedia: '',
    stok_minimum: '10'
  })
  const [editingProduct, setEditingProduct] = useState(false)
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false)
  const [productToDelete, setProductToDelete] = useState(null)
  const [deletingProduct, setDeletingProduct] = useState(false)
  const [deleteResult, setDeleteResult] = useState(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successData, setSuccessData] = useState(null)
  const [showStockUpdateModal, setShowStockUpdateModal] = useState(false)
  const [stockUpdateReason, setStockUpdateReason] = useState('')
  const [submittingStockUpdate, setSubmittingStockUpdate] = useState(false)
  const [showRequestHistory, setShowRequestHistory] = useState(false)
  const [requestHistory, setRequestHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showAllRequests, setShowAllRequests] = useState(false)
  const [requestPagination, setRequestPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRequests: 0,
    itemsPerPage: 5
  })
  const [pendingRequests, setPendingRequests] = useState(new Set()) // Track products with pending requests
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [warningMessage, setWarningMessage] = useState('')

  useEffect(() => {
    const loadData = async () => {
      await fetchPendingRequests()  // Fetch pending first
      await fetchInventory()        // Then fetch inventory
    }
    loadData()
  }, [user.cabang_id, pagination.currentPage, searchTerm, filterCategory, filterStatus])

  // Fetch pending requests to check for duplicates
  const fetchPendingRequests = async () => {
    try {
      const response = await fetch('/api/stock/my-requests', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        const pendingProductIds = new Set(
          data.requests
            ?.filter(req => {
              return req.approval_status === 'pending' && 
                     (req.request_data?.request_type === 'update_product' || req.request_data?.request_type === 'update_stock')
            })
            ?.map(req => req.id_produk || req.request_data?.id_produk)
            ?.filter(id => id !== undefined && id !== null) || []
        )
        setPendingRequests(pendingProductIds)
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error)
    }
  }

  // Auto-open request history if coming from notification
  useEffect(() => {
    if (selectedNotificationRequest) {
      setShowRequestHistory(true)
      setShowAllRequests(false)
      fetchRequestHistory(1, false)
    }
  }, [selectedNotificationRequest])

  // Auto-scroll to highlighted request
  useEffect(() => {
    if (selectedNotificationRequest && requestHistory.length > 0) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        const element = document.querySelector(`[data-request-id="${selectedNotificationRequest}"]`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 300)
    }
  }, [selectedNotificationRequest, requestHistory])

  const fetchRequestHistory = async (page = 1, loadMore = false) => {
    try {
      setLoadingHistory(true)
      const limit = 20 // Load 20 items per request
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })

      const response = await fetch(`/api/stock/my-requests?${params}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        // If loading more, append to existing data
        setRequestHistory(prev => loadMore ? [...prev, ...(data.requests || [])] : (data.requests || []))
        setRequestPagination(prev => ({
          ...prev,
          currentPage: data.currentPage || page,
          totalPages: data.totalPages || 1,
          totalRequests: data.totalRequests || 0
        }))
      } else {
        console.error('Failed to fetch request history')
        if (!loadMore) setRequestHistory([])
      }
    } catch (error) {
      console.error('Error fetching request history:', error)
      if (!loadMore) setRequestHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const fetchInventory = async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams({
        page: pagination.currentPage.toString(),
        limit: pagination.itemsPerPage.toString(),
        search: searchTerm,
        category: filterCategory,
        status: filterStatus
      })
      
      const response = await fetch(`/api/inventory/${user.cabang_id}?${queryParams}`)
      
      if (response.ok) {
        const data = await response.json()
        setInventory(data.inventory)
        setPagination(prev => ({
          ...prev,
          totalPages: data.totalPages || 1,
          totalProducts: data.totalProducts || 0
        }))
        // Initialize stock updates with current values, preserve pending resets
        setStockUpdates(prev => {
          const updates = {}
          data.inventory.forEach(item => {
            // If item has pending request, keep it at original stock (reset value)
            // Otherwise use previous value or default to current stock
            if (pendingRequests.has(item.id)) {
              updates[item.id] = item.stok_tersedia
            } else {
              updates[item.id] = prev[item.id] !== undefined ? prev[item.id] : item.stok_tersedia
            }
          })
          return updates
        })
        setError('')
      } else {
        throw new Error('Failed to fetch inventory')
      }
    } catch (err) {
      setError(err.message)
      console.error('Fetch inventory error:', err)
    } finally {
      setLoading(false)
    }
  }


  const handleStockChange = (productId, newValue) => {
    // Handle empty string and convert to number properly
    if (newValue === '') {
      setStockUpdates(prev => ({
        ...prev,
        [productId]: ''
      }))
      return
    }
    
    const value = parseInt(newValue) || 0
    setStockUpdates(prev => ({
      ...prev,
      [productId]: Math.max(0, value)
    }))
  }

  const handleUpdateStock = (singleItemId = null) => {
    // For collector backup kasir - use direct update instead of request approval
    if (user?.backup_mode && user?.original_role === 'collector') {
      handleDirectStockUpdate()
      return
    }
    
    // For individual item, check pending first
    if (singleItemId) {
      const item = inventory.find(item => item.id === singleItemId)
      if (item && pendingRequests.has(item.id)) {
        setWarningMessage(`Produk "${item.nama_produk}" sudah memiliki request yang sedang menunggu persetujuan. Tunggu hingga di-approve atau di-reject terlebih dahulu.`)
        setShowWarningModal(true)
        // Force reset input immediately
        setStockUpdates(prev => ({
          ...prev,
          [singleItemId]: item.stok_tersedia
        }))
        return
      }
    }

    // For bulk operations, check if any pending items are being changed
    if (!singleItemId) {
      const pendingChangedItems = inventory.filter(item => {
        const newStock = stockUpdates[item.id]
        return newStock !== undefined && 
               parseInt(newStock) !== item.stok_tersedia && 
               pendingRequests.has(item.id)
      })

      if (pendingChangedItems.length > 0) {
        const message = `${pendingChangedItems.length} produk tidak dapat di-request karena sudah memiliki request pending:\n\n${pendingChangedItems.map(item => `• ${item.nama_produk}`).join('\n')}\n\nSilakan tunggu approval terlebih dahulu, atau ubah hanya produk yang tidak pending.`
        setWarningMessage(message)
        setShowWarningModal(true)
        
        // Reset all pending items immediately
        setStockUpdates(prev => {
          const newUpdates = {...prev}
          pendingChangedItems.forEach(item => {
            newUpdates[item.id] = item.stok_tersedia
          })
          return newUpdates
        })
        return
      }
    }
    
    // Find items that have changed (excluding pending ones for bulk)
    const updates = []
    const itemsToCheck = singleItemId ? [inventory.find(item => item.id === singleItemId)].filter(Boolean) : inventory
    
    itemsToCheck.forEach(item => {
      const newStock = stockUpdates[item.id]
      const currentStock = parseInt(item.stok_tersedia)
      const updatedStock = parseInt(newStock)
      
      // Skip products with pending requests for bulk operations
      if (pendingRequests.has(item.id) && !singleItemId) {
        return
      }
      
      if (newStock !== undefined && !isNaN(updatedStock) && updatedStock !== currentStock) {
        updates.push({
          product_id: item.id,
          product_name: item.nama_produk,
          old_stock: currentStock,
          new_stock: updatedStock
        })
      }
    })

    if (updates.length === 0) {
      const message = 'Tidak ada perubahan stok untuk diupdate'
      setWarningMessage(message)
      setShowWarningModal(true)
      return
    }

    // Show modal for reason
    setShowStockUpdateModal(true)
  }

  const handleSubmitStockUpdateRequest = async () => {
    if (!stockUpdateReason.trim()) {
      setError('Alasan perubahan stok wajib diisi')
      return
    }

    // Check for pending items first
    const hasPendingItems = inventory.some(item => {
      const newStock = stockUpdates[item.id]
      return newStock !== undefined && newStock !== '' && 
             parseInt(newStock) !== item.stok_tersedia && 
             pendingRequests.has(item.id)
    })

    // If there are pending items, show warning and stop
    if (hasPendingItems) {
      const pendingProductNames = inventory
        .filter(item => {
          const newStock = stockUpdates[item.id]
          return newStock !== undefined && newStock !== '' && 
                 parseInt(newStock) !== item.stok_tersedia && 
                 pendingRequests.has(item.id)
        })
        .map(item => item.nama_produk)
      
      const message = `${pendingProductNames.length} produk tidak dapat di-request karena sudah memiliki request pending:\n\n${pendingProductNames.map(item => `• ${item}`).join('\n')}\n\nSilakan tunggu approval terlebih dahulu, atau ubah hanya produk yang tidak pending.`
      setWarningMessage(message)
      setShowWarningModal(true)
      
      // Force reset ALL pending items immediately
      console.log('DEBUG: pendingRequests Set:', Array.from(pendingRequests))
      console.log('DEBUG: inventory items:', inventory.map(item => ({id: item.id, nama: item.nama_produk})))
      setStockUpdates(prev => {
        const newUpdates = {...prev}
        inventory.forEach(item => {
          if (pendingRequests.has(item.id)) {
            console.log(`DEBUG: Resetting ${item.nama_produk} (${item.id}) from ${prev[item.id]} to ${item.stok_tersedia}`)
            newUpdates[item.id] = item.stok_tersedia
          }
        })
        return newUpdates
      })
      return
    }

    // Find items that have changed (no pending items at this point)
    const changedItems = []
    inventory.forEach(item => {
      const newStock = stockUpdates[item.id]
      if (newStock !== undefined && newStock !== '' && parseInt(newStock) !== item.stok_tersedia) {
        changedItems.push({
          item,
          newStock: parseInt(newStock)
        })
      }
    })

    if (changedItems.length === 0) {
      setError('Tidak ada perubahan stok untuk diupdate')
      return
    }

    try {
      setSubmittingStockUpdate(true)
      setError('')

      // Send individual requests like edit product does
      const results = []
      for (const { item, newStock } of changedItems) {
        const currentData = {
          stok_tersedia: item.stok_tersedia
        }

        const requestedData = {
          stok_tersedia: newStock
        }

        const response = await fetch('/api/stock/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_produk: item.id,
            request_type: 'update_stock',
            current_data: currentData,
            requested_data: requestedData,
            reason: stockUpdateReason.trim()
          })
        })

        if (response.ok) {
          const result = await response.json()
          results.push({ success: true, product: item.nama_produk })
        } else {
          const errorData = await response.json()
          
          // Special handling for duplicate (409) vs other errors
          const errorType = response.status === 409 ? 'duplicate' : 'error'
          results.push({ 
            success: false, 
            product: item.nama_produk, 
            error: errorData.message || errorData.error,
            errorType: errorType
          })
        }
      }

      // Check results
      const successCount = results.filter(r => r.success).length
      const failedCount = results.filter(r => !r.success).length
      const duplicateCount = results.filter(r => !r.success && r.errorType === 'duplicate').length
      const realErrorCount = results.filter(r => !r.success && r.errorType !== 'duplicate').length

      if (successCount > 0) {
        let message = `Request perubahan ${successCount} produk telah dikirim ke Owner untuk persetujuan.`
        if (duplicateCount > 0) {
          message += ` ${duplicateCount} produk dilewati (sudah ada request pending).`
        }
        if (realErrorCount > 0) {
          message += ` ${realErrorCount} produk gagal karena error.`
        }

        setSuccessData({
          type: 'request',
          title: 'Request Update Stok Berhasil Dikirim!',
          message: message,
          status: 'pending'
        })
        
        // Add successful products to pending requests
        const successfulProductIds = results.filter(r => r.success).map(r => {
          const product = changedItems.find(item => item.item.nama_produk === r.product)
          return product ? product.item.id : null
        }).filter(Boolean)
        
        setPendingRequests(prev => {
          const newSet = new Set(prev)
          successfulProductIds.forEach(id => newSet.add(id))
          return newSet
        })
        
        setShowStockUpdateModal(false)
        setStockUpdateReason('')
        setShowSuccessModal(true)
        
        // Reset stock updates to original values
        const resetUpdates = {}
        inventory.forEach(item => {
          resetUpdates[item.id] = item.stok_tersedia
        })
        setStockUpdates(resetUpdates)
      } else {
        // All failed - differentiate between duplicates and real errors
        if (duplicateCount === failedCount) {
          setWarningMessage(`Semua ${failedCount} produk sudah memiliki request yang sedang menunggu persetujuan. Tidak ada request baru yang dikirim.`)
          setShowWarningModal(true)
        } else {
          throw new Error('Semua request gagal dikirim')
        }
      }
        
    } catch (err) {
      setError(err.message)
      console.error('Stock update request error:', err)
    } finally {
      setSubmittingStockUpdate(false)
    }
  }


  const handleEditProduct = (item) => {
    // Check if this product already has a pending request
    if (pendingRequests.has(item.id)) {
      setWarningMessage(`Produk "${item.nama_produk}" sudah memiliki request yang sedang menunggu persetujuan. Tunggu hingga di-approve atau di-reject terlebih dahulu.`)
      setShowWarningModal(true)
      return
    }
    
    setEditProduct({
      id: item.id,
      nama_produk: item.nama_produk,
      harga: item.harga.toString(),
      satuan: item.satuan,
      kategori_produk: item.kategori_produk,
      stok_tersedia: item.stok_tersedia.toString(),
      stok_minimum: item.stok_minimum.toString(),
      originalStock: item.stok_tersedia // Simpan stok original
    })
    setShowEditProductModal(true)
  }

  const handleUpdateProduct = async (e) => {
    e.preventDefault()
    
    // Check if reason is provided (add reason field to form)
    const reason = document.getElementById('edit-reason')?.value?.trim()
    if (!reason) {
      setError('Alasan perubahan wajib diisi')
      return
    }

    // For collector backup kasir - use direct update if only stock changed
    if (user?.backup_mode && user?.original_role === 'collector') {
      const stockChange = parseInt(editProduct.stok_tersedia) - editProduct.originalStock
      if (stockChange !== 0) {
        await handleDirectStockEditProduct(reason)
        return
      }
    }
    
    try {
      setEditingProduct(true)
      setError('')

      // Find current product data
      const currentProduct = inventory.find(item => item.id === editProduct.id)
      if (!currentProduct) {
        throw new Error('Product not found')
      }

      // Prepare current and requested data - only send stock change (same as bulk update)
      const currentData = {
        stok_tersedia: currentProduct.stok_tersedia
      }

      const requestedData = {
        stok_tersedia: parseInt(editProduct.stok_tersedia)
      }

      // Submit request
      const response = await fetch('/api/stock/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_produk: editProduct.id,
          request_type: 'update_stock',
          current_data: currentData,
          requested_data: requestedData,
          reason: reason
        })
      })

      if (response.ok) {
        const result = await response.json()
        
        // Add product to pending requests
        setPendingRequests(prev => {
          const newSet = new Set(prev)
          newSet.add(editProduct.id)
          return newSet
        })
        
        // Set success data for request submitted
        setSuccessData({
          type: 'request',
          title: 'Request Berhasil Dikirim!',
          message: `Request perubahan produk "${editProduct.nama_produk}" telah dikirim ke Owner untuk persetujuan.`,
          status: 'pending'
        })
        
        setShowEditProductModal(false)
        setShowSuccessModal(true)
        // Don't refresh inventory immediately - changes will apply after approval
      } else {
        const errorData = await response.json()
        
        // Handle duplicate request specifically
        if (response.status === 409) {
          setWarningMessage(errorData.message || 'Produk ini sudah memiliki request yang sedang menunggu persetujuan')
          setShowWarningModal(true)
          setShowEditProductModal(false)
          return
        }
        
        throw new Error(errorData.message || 'Gagal mengirim request')
      }
    } catch (err) {
      setError(err.message)
      console.error('Update product request error:', err)
      alert('Error: ' + err.message)
    } finally {
      setEditingProduct(false)
    }
  }

  // Direct stock update for collector backup kasir
  const handleDirectStockUpdate = async () => {
    // Get items that have changes
    const changedItems = inventory.filter(item => {
      const currentStock = item.stok_tersedia
      const newStock = stockUpdates[item.id]
      return newStock !== undefined && newStock !== '' && parseInt(newStock) !== currentStock
    })

    if (changedItems.length === 0) {
      setWarningMessage('Tidak ada perubahan stok yang perlu disimpan.')
      setShowWarningModal(true)
      return
    }

    // For collector backup kasir, use default reason if not provided
    const updateReason = stockUpdateReason.trim() || 'Direct stock update by collector backup kasir'

    try {
      setSubmittingStockUpdate(true)
      setError('')

      // Prepare stock updates data
      const stockUpdatesData = {}
      changedItems.forEach(item => {
        stockUpdatesData[item.id] = parseInt(stockUpdates[item.id])
      })

      const response = await fetch('/api/stock/direct-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockUpdates: stockUpdatesData,
          reason: updateReason
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccessData({
          message: data.message,
          updatedItems: data.results || [],
          type: 'direct_update'
        })
        setShowSuccessModal(true)
        setStockUpdateReason('')
        
        // Clear stock updates
        setStockUpdates({})
        
        // Refresh inventory
        await fetchInventory()
      } else {
        throw new Error(data.error || 'Gagal mengupdate stok')
      }
    } catch (err) {
      setError(err.message)
      console.error('Direct stock update error:', err)
    } finally {
      setSubmittingStockUpdate(false)
    }
  }

  // Direct stock edit for individual product (collector backup kasir)
  const handleDirectStockEditProduct = async (reason) => {
    try {
      setEditingProduct(true)
      setError('')

      // Prepare stock update for single product
      const stockUpdatesData = {
        [editProduct.id]: parseInt(editProduct.stok_tersedia)
      }

      const response = await fetch('/api/stock/direct-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockUpdates: stockUpdatesData,
          reason: reason
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccessData({
          message: `Stok produk "${editProduct.nama_produk}" berhasil diupdate langsung.`,
          updatedItems: data.results || [],
          type: 'direct_update'
        })
        setShowSuccessModal(true)
        
        // Close edit modal
        setShowEditProductModal(false)
        
        // Refresh inventory
        await fetchInventory()
      } else {
        throw new Error(data.error || 'Gagal mengupdate stok')
      }
    } catch (err) {
      setError(err.message)
      console.error('Direct stock edit error:', err)
    } finally {
      setEditingProduct(false)
    }
  }

  const handleDeleteProduct = (item) => {
    setProductToDelete(item)
    setShowDeleteConfirmModal(true)
  }

  const handleConfirmDelete = async () => {
    if (!productToDelete) return
    
    try {
      setDeletingProduct(true)
      setError('')

      const response = await fetch(`/api/products/${productToDelete.id}?cabang_id=${user.cabang_id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const result = await response.json()
        setDeleteResult(result)
        setShowDeleteConfirmModal(false)
        setShowDeleteSuccessModal(true)
        
        // Refresh inventory list
        await fetchInventory()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Gagal menghapus produk')
      }
    } catch (err) {
      setError(err.message)
      console.error('Delete product error:', err)
      alert('Error: ' + err.message)
    } finally {
      setDeletingProduct(false)
    }
  }


  const getStatusColor = (status) => {
    switch (status) {
      case 'out_of_stock': return 'bg-red-500 text-white'
      case 'critical': return 'bg-red-400 text-white'
      case 'low': return 'bg-yellow-400 text-white'
      case 'good': return 'bg-green-500 text-white'
      default: return 'bg-gray-400 text-white'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'out_of_stock': return 'Habis'
      case 'critical': return 'Kritis'
      case 'low': return 'Menipis'
      case 'good': return 'Baik'
      default: return status
    }
  }

  const categories = [...new Set(inventory.map(item => item.kategori_produk))]
  const filteredInventory = inventory.filter(item => {
    const categoryMatch = filterCategory === 'all' || item.kategori_produk === filterCategory
    const statusMatch = filterStatus === 'all' || item.status === filterStatus
    return categoryMatch && statusMatch
  })

  const hasChanges = inventory.some(item => {
    const currentValue = stockUpdates[item.id]
    return currentValue !== undefined && currentValue !== '' && parseInt(currentValue) !== item.stok_tersedia
  })

  return (
    <>
      <div className="h-full flex flex-col space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter Kategori
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-dwash-red focus:border-transparent"
            >
              <option value="all">Semua Kategori</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-dwash-red focus:border-transparent"
            >
              <option value="all">Semua Status</option>
              <option value="out_of_stock">Habis</option>
              <option value="critical">Kritis</option>
              <option value="low">Menipis</option>
              <option value="good">Baik</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dwash-red mx-auto mb-4"></div>
            <p className="text-gray-600">Loading inventory...</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="block sm:hidden space-y-3">
              {filteredInventory.map((item) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  {/* Header Row */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900 text-base truncate">
                          {item.nama_produk}
                        </h4>
                        {pendingRequests.has(item.id) && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full whitespace-nowrap">
                            🕰️ Pending
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        💰 Rp {item.harga.toLocaleString('id-ID')} / {item.satuan}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        📦 {item.kategori_produk.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                    </div>
                    <div className="flex space-x-2 ml-3">
                      <button
                        onClick={() => handleEditProduct(item)}
                        className="p-2 rounded-lg transition-colors bg-blue-50 text-blue-600 hover:bg-blue-100"
                        title="Edit stok produk"
                      >
                        ✏️
                      </button>
                    </div>
                  </div>
                  
                  {/* Stats Grid - Row 1 */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">Stok Saat Ini</div>
                      <div className="font-medium text-gray-900">
                        {item.stok_tersedia} {item.satuan}
                      </div>
                      <div className="text-xs text-gray-500">
                        Min: {item.stok_minimum}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-green-600 mb-1 font-medium">📝 Tambah Stok</div>
                      <input
                        type="number"
                        min="0"
                        placeholder="+0"
                        value={stockUpdates[item.id] === undefined ? '' : (stockUpdates[item.id] - item.stok_tersedia) === 0 ? '' : (stockUpdates[item.id] - item.stok_tersedia)}
                        onChange={(e) => {
                          const addValue = parseInt(e.target.value) || 0
                          const newTotal = item.stok_tersedia + addValue
                          handleStockChange(item.id, newTotal.toString())
                        }}
                        className="w-20 px-2 py-1 text-sm border-2 border-green-300 bg-green-50 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center font-medium"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Total: {stockUpdates[item.id] || item.stok_tersedia}
                      </div>
                    </div>
                  </div>
                  
                  {/* Stats Grid - Row 2 */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">Status</div>
                      <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-lg ${getStatusColor(item.status)}`}>
                        {getStatusText(item.status)}
                      </span>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">Aksi</div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleUpdateStock(item.id);
                        }}
                        disabled={
                          stockUpdates[item.id] === undefined || 
                          stockUpdates[item.id] === '' || 
                          parseInt(stockUpdates[item.id]) === item.stok_tersedia
                        }
                        className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-lg transition-colors text-xs font-medium"
                        title={user?.backup_mode && user?.original_role === 'collector' ? "Update stok langsung" : "Request tambah stok item ini"}
                      >
                        {user?.backup_mode && user?.original_role === 'collector' ? '💾 Update' : '📦 Request'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block bg-white rounded-lg border overflow-hidden flex-1 min-h-0">
              <div className="overflow-x-auto h-full">
                <table className="min-w-full divide-y divide-gray-200 h-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Produk
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kategori
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stok Saat Ini
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-green-600 uppercase tracking-wider bg-green-50">
                        📦 Tambah Stok
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredInventory.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="text-sm font-medium text-gray-900">
                              {item.nama_produk}
                            </div>
                            <div className="text-xs text-gray-500">
                              Rp {item.harga.toLocaleString('id-ID')} / {item.satuan}
                            </div>
                            {pendingRequests.has(item.id) && (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                                🕰️ Pending
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm text-gray-900">
                            {item.kategori_produk.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-gray-900">
                            {item.stok_tersedia} {item.satuan}
                          </div>
                          <div className="text-xs text-gray-500">
                            Min: {item.stok_minimum}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="space-y-1">
                            <input
                              type="number"
                              min="0"
                              placeholder="+0"
                              value={stockUpdates[item.id] === undefined ? '' : (stockUpdates[item.id] - item.stok_tersedia) === 0 ? '' : (stockUpdates[item.id] - item.stok_tersedia)}
                              onChange={(e) => {
                                const addValue = parseInt(e.target.value) || 0
                                const newTotal = item.stok_tersedia + addValue
                                handleStockChange(item.id, newTotal.toString())
                              }}
                              className="w-20 px-2 py-1 text-sm border-2 border-green-300 bg-green-50 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center font-medium"
                            />
                            <div className="text-xs text-gray-600">
                              Total: {stockUpdates[item.id] || item.stok_tersedia}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                            {getStatusText(item.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex justify-center space-x-1">
                            <button
                              onClick={() => handleEditProduct(item)}
                              className="p-1 rounded transition-colors text-blue-600 hover:text-blue-800"
                              title="Edit stok produk"
                            >
                              ✏️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredInventory.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-4">📦</div>
                  <p className="text-gray-500">
                    {searchTerm || filterCategory !== 'all' || filterStatus !== 'all' 
                      ? 'Tidak ada produk yang sesuai filter' 
                      : 'Belum ada data inventory'
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 flex-shrink-0">
              <Button
                onClick={fetchInventory}
                variant="outline"
                disabled={loading}
                className="hidden sm:flex flex-1 sm:flex-none"
              >
                🔄 Refresh
              </Button>
              <div className="flex gap-2 sm:gap-3 flex-1">
                <Button
                  onClick={() => {
                    setShowRequestHistory(true)
                    setShowAllRequests(false)
                    fetchRequestHistory(1, false)
                  }}
                  variant="outline"
                  className="flex-1 text-xs sm:text-sm py-2 sm:py-3"
                >
                  <span className="sm:hidden">📋 Riwayat</span>
                  <span className="hidden sm:inline">📋 Riwayat Request</span>
                </Button>
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    handleUpdateStock();
                  }}
                  disabled={submittingStockUpdate || !hasChanges}
                  className="flex-1 text-xs sm:text-sm py-2 sm:py-3"
                >
                  {user?.backup_mode && user?.original_role === 'collector'
                    ? (hasChanges ? (
                      <>
                        <span className="sm:hidden">💾 Update ({inventory.filter(item => stockUpdates[item.id] !== item.stok_tersedia).length})</span>
                        <span className="hidden sm:inline">💾 Update Stok Langsung ({inventory.filter(item => stockUpdates[item.id] !== item.stok_tersedia).length})</span>
                      </>
                    ) : 'Tidak Ada Perubahan')
                    : (hasChanges ? (
                      <>
                        <span className="sm:hidden">📝 Request ({inventory.filter(item => stockUpdates[item.id] !== item.stok_tersedia).length})</span>
                        <span className="hidden sm:inline">📝 Request Update Stok ({inventory.filter(item => stockUpdates[item.id] !== item.stok_tersedia).length})</span>
                      </>
                    ) : 'Tidak Ada Perubahan')}
                </Button>
              </div>
            </div>

            {hasChanges && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="text-yellow-400">⚠️</span>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Ada perubahan yang belum disimpan
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      Anda memiliki {inventory.filter(item => stockUpdates[item.id] !== item.stok_tersedia).length} perubahan stok yang belum disimpan.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>



      {/* Edit Product Modal */}
      <Modal 
        isOpen={showEditProductModal} 
        onClose={() => {
          setShowEditProductModal(false)
          setEditProduct({
            id: null,
            nama_produk: '',
            harga: '',
            satuan: 'pcs',
            kategori_produk: 'sabun_softener',
            stok_tersedia: '',
            stok_minimum: '10'
          })
        }}
        title="Tambah Stok Produk"
        size="md"
      >
        <form onSubmit={handleUpdateProduct} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Nama Produk (View Only)
            </label>
            <input
              type="text"
              value={editProduct.nama_produk}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              placeholder="Contoh: Sabun Cuci Premium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Harga (View Only)
              </label>
              <input
                type="text"
                value={`Rp ${parseInt(editProduct.harga).toLocaleString('id-ID')}`}
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Satuan (View Only)
              </label>
              <input
                type="text"
                value={editProduct.satuan}
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Kategori Produk (View Only)
            </label>
            <input
              type="text"
              value={editProduct.kategori_produk?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-green-700 mb-1">
                📝 Tambah Stok *
              </label>
              <div className="space-y-2">
                <input
                  type="number"
                  required
                  min="0"
                  value={(parseInt(editProduct.stok_tersedia) - editProduct.originalStock) === 0 ? '' : (parseInt(editProduct.stok_tersedia) - editProduct.originalStock)}
                  onChange={(e) => {
                    const addValue = parseInt(e.target.value) || 0
                    const newTotal = editProduct.originalStock + addValue
                    setEditProduct(prev => ({ ...prev, stok_tersedia: newTotal.toString() }))
                  }}
                  className="w-full px-3 py-2 border-2 border-green-300 bg-green-50 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-medium"
                  placeholder="0"
                />
                <div className="text-xs text-gray-600">
                  Stok Saat Ini: {editProduct.originalStock} → Total: {editProduct.stok_tersedia}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Stok Minimum (View Only)
              </label>
              <input
                type="text"
                value={`${editProduct.stok_minimum} ${editProduct.satuan}`}
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alasan Penambahan Stok *
              </label>
              <textarea
                id="edit-reason"
                required
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Jelaskan alasan penambahan stok ini (contoh: barang datang, stock opname, dll)..."
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 Alasan akan dilihat oleh Owner untuk persetujuan
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <div className="flex items-start space-x-2">
              <span className="text-blue-600 mt-0.5">💡</span>
              <div className="text-sm text-blue-800">
                <strong>Info:</strong> Anda hanya dapat menambah stok produk. Detail produk lainnya tidak dapat diubah oleh kasir. 
                Penambahan stok memerlukan persetujuan Owner.
              </div>
            </div>
          </div>

          <div className="flex justify-center space-x-3 pt-4">
            <Button 
              type="button"
              variant="outline" 
              onClick={() => setShowEditProductModal(false)}
              disabled={editingProduct}
            >
              Batal
            </Button>
            <Button 
              type="submit"
              disabled={editingProduct || parseInt(editProduct.stok_tersedia) === editProduct.originalStock}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white"
            >
              {editingProduct 
                ? (user?.backup_mode && user?.original_role === 'collector' ? 'Mengupdate Stok...' : 'Mengirim Request...')
                : (user?.backup_mode && user?.original_role === 'collector' ? '💾 Update Stok Langsung' : '📦 Request Tambah Stok')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={showDeleteConfirmModal} 
        onClose={() => {
          setShowDeleteConfirmModal(false)
          setProductToDelete(null)
        }}
        title="Konfirmasi Hapus Produk"
        size="md"
      >
        {productToDelete && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Hapus Produk?
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Tindakan ini tidak dapat dibatalkan
                </p>
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-red-600 font-medium">Nama Produk:</span>
                  <span className="text-sm font-semibold text-red-900">{productToDelete.nama_produk}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-red-600 font-medium">Kategori:</span>
                  <span className="text-sm text-red-900">
                    {productToDelete.kategori_produk?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-red-600 font-medium">Stok Saat Ini:</span>
                  <span className="text-sm text-red-900">{productToDelete.stok_tersedia} {productToDelete.satuan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-red-600 font-medium">Harga:</span>
                  <span className="text-sm text-red-900">
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                      minimumFractionDigits: 0
                    }).format(productToDelete.harga)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <span className="text-yellow-600 mt-0.5">💡</span>
                <div className="text-sm text-yellow-800">
                  <strong>Catatan:</strong> Jika produk ini pernah digunakan dalam transaksi, 
                  produk akan dinonaktifkan (tidak dihapus permanen) untuk menjaga integritas data.
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowDeleteConfirmModal(false)
                  setProductToDelete(null)
                }}
                disabled={deletingProduct}
              >
                Batal
              </Button>
              <Button 
                onClick={handleConfirmDelete}
                disabled={deletingProduct}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {deletingProduct ? 'Menghapus...' : '🗑️ Ya, Hapus Produk'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Success Modal */}
      <Modal 
        isOpen={showDeleteSuccessModal} 
        onClose={() => {
          setShowDeleteSuccessModal(false)
          setDeleteResult(null)
          setProductToDelete(null)
        }}
        title="Produk Berhasil Dihapus"
        size="md"
      >
        {deleteResult && productToDelete && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-green-600 text-3xl">✓</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {deleteResult.action === 'deleted' ? 'Produk Dihapus!' : 'Produk Dinonaktifkan!'}
              </h2>
              <p className="text-gray-600 px-4">
                {deleteResult.message}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Nama Produk:</span>
                  <span className="text-sm font-semibold">{productToDelete.nama_produk}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Aksi:</span>
                  <span className={`text-sm font-medium ${
                    deleteResult.action === 'deleted' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {deleteResult.action === 'deleted' ? '🗑️ Dihapus Permanen' : '🚫 Dinonaktifkan'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Waktu:</span>
                  <span className="text-sm">{new Date().toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            {deleteResult.action === 'deactivated' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <span className="text-blue-600 mt-0.5">ℹ️</span>
                  <div className="text-sm text-blue-800">
                    <strong>Info:</strong> Produk tidak dihapus permanen karena masih terhubung dengan data transaksi. 
                    Produk kini berstatus nonaktif dan tidak akan muncul di daftar produk aktif.
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-center pt-4">
              <Button 
                onClick={() => {
                  setShowDeleteSuccessModal(false)
                  setDeleteResult(null)
                  setProductToDelete(null)
                }}
                className="bg-green-500 hover:bg-green-600 text-white px-6"
              >
                ✓ Tutup
              </Button>
            </div>
          </div>
        )}
      </Modal>


      {/* Universal Success Modal */}
      <Modal 
        isOpen={showSuccessModal} 
        onClose={() => {
          setShowSuccessModal(false)
          setSuccessData(null)
        }}
        title={successData?.type === 'direct_update' ? 'Stok Berhasil Diupdate!' : 'Operasi Berhasil'}
        size="md"
      >
        {successData && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-green-600 text-3xl">
                  {successData.type === 'add' ? '➕' : 
                   successData.type === 'edit' ? '✏️' : 
                   successData.type === 'direct_update' ? '💾' :
                   successData.type === 'reactivate' || successData.type === 'reactivate_from_list' ? '🔄' : '✓'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {successData.title}
              </h2>
              <p className="text-gray-600 px-4">
                {successData.message}
              </p>
            </div>

            {successData.product && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-800 mb-3">Detail Produk:</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Nama:</span>
                    <span className="text-sm font-semibold">{successData.product.nama_produk}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Harga:</span>
                    <span className="text-sm font-medium">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        minimumFractionDigits: 0
                      }).format(successData.product.harga)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Satuan:</span>
                    <span className="text-sm">{successData.product.satuan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Kategori:</span>
                    <span className="text-sm">
                      {successData.product.kategori_produk?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Stok:</span>
                    <span className="text-sm font-medium">
                      {successData.product.stok_tersedia} {successData.product.satuan}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Stok Minimum:</span>
                    <span className="text-sm">
                      {successData.product.stok_minimum} {successData.product.satuan}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className={`rounded-lg p-3 ${successData.type === 'direct_update' ? 'bg-blue-50 border border-blue-200' : 'bg-green-50 border border-green-200'}`}>
              <div className="flex items-start space-x-2">
                <span className={`mt-0.5 ${successData.type === 'direct_update' ? 'text-blue-600' : 'text-green-600'}`}>
                  {successData.type === 'direct_update' ? '💾' : '✅'}
                </span>
                <div className={`text-sm ${successData.type === 'direct_update' ? 'text-blue-800' : 'text-green-800'}`}>
                  {successData.type === 'direct_update' ? (
                    <span><strong>Stok Langsung Tersimpan!</strong> Stok telah diupdate langsung tanpa perlu persetujuan Owner.</span>
                  ) : (
                    <span><strong>Request Berhasil Dikirim!</strong> Request Anda telah dikirim ke Owner untuk ditinjau dan disetujui.</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-center pt-4">
              <Button 
                onClick={() => {
                  setShowSuccessModal(false)
                  setSuccessData(null)
                }}
                className={successData.type === 'direct_update' 
                  ? "bg-blue-500 hover:bg-blue-600 text-white px-8" 
                  : "bg-green-500 hover:bg-green-600 text-white px-8"}
              >
                {successData.type === 'direct_update' ? '💾 Tutup' : '✓ Tutup'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Stock Update Request Modal */}
      <Modal 
        isOpen={showStockUpdateModal} 
        onClose={() => {
          setShowStockUpdateModal(false)
          setStockUpdateReason('')
          setError('')
        }}
        title="Request Update Stok"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <span className="text-blue-600 text-lg">💡</span>
              <div className="text-sm text-blue-800">
                <strong>Info:</strong> Perubahan stok memerlukan persetujuan Owner. 
                Request Anda akan dikirim untuk ditinjau.
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-3">Perubahan yang akan di-request:</h4>
            <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
              {inventory
                .filter(item => stockUpdates[item.id] !== item.stok_tersedia)
                .map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.nama_produk}</div>
                      <div className="text-xs text-gray-500">{item.kategori_produk?.replace(/_/g, ' ')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">
                        <span className="text-red-600 font-medium">{item.stok_tersedia}</span>
                        <span className="mx-2 text-gray-400">→</span>
                        <span className="text-green-600 font-medium">{stockUpdates[item.id]}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {stockUpdates[item.id] > item.stok_tersedia ? 
                          `+${stockUpdates[item.id] - item.stok_tersedia}` : 
                          `${stockUpdates[item.id] - item.stok_tersedia}`
                        } {item.satuan}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alasan Perubahan Stok *
            </label>
            <textarea
              value={stockUpdateReason}
              onChange={(e) => setStockUpdateReason(e.target.value)}
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Jelaskan alasan perubahan stok ini (contoh: Stock opname harian, ada barang rusak, penyesuaian fisik, dll)..."
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 Alasan yang jelas akan mempercepat persetujuan Owner
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <span className="text-yellow-600 mt-0.5">⚠️</span>
              <div className="text-sm text-yellow-800">
                <strong>Perhatian:</strong> Request Anda akan dikirim ke Owner untuk disetujui. 
                Stok baru akan bertambah setelah Owner approve.
              </div>
            </div>
          </div>

          <div className="flex justify-center space-x-3 pt-4 border-t">
            <Button 
              type="button"
              variant="outline" 
              onClick={() => {
                setShowStockUpdateModal(false)
                setStockUpdateReason('')
                setError('')
              }}
              disabled={submittingStockUpdate}
            >
              Batal
            </Button>
            <Button 
              onClick={handleSubmitStockUpdateRequest}
              disabled={submittingStockUpdate || !stockUpdateReason.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {submittingStockUpdate ? 'Mengirim Request...' : '📤 Kirim Request'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Request History Modal */}
      <Modal
        isOpen={showRequestHistory}
        onClose={() => {
          setShowRequestHistory(false)
          setShowAllRequests(false)
          if (onClearSelectedRequest) {
            onClearSelectedRequest()
          }
        }}
        title="📋 Riwayat Stock Request Cabang"
        size="lg"
      >
        <div className="space-y-4">
          {loadingHistory ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading riwayat request...</p>
            </div>
          ) : requestHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-4">📝</div>
              <p className="text-lg font-medium mb-2">Belum ada request</p>
              <p className="text-sm">Request stock update Anda akan muncul di sini</p>
            </div>
          ) : (
            <div
              className="max-h-[60vh] overflow-y-auto overflow-x-auto"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#E53E3E #F3F4F6'
              }}
            >
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipe Request
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produk
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Perubahan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kasir
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Waktu
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Catatan
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requestHistory.map((request) => {
                    const isHighlighted = selectedNotificationRequest === request.id_audit
                    
                    const requestType = request.request_data?.request_type
                    const currentData = request.current_data
                    const requestedData = request.request_data?.requested_data

                    // Get product name from request_data
                    const productName = request.request_data?.product_name || 'N/A'
                    
                    // Build changes summary
                    const changes = []
                    if (currentData && requestedData) {
                      Object.keys(requestedData).forEach(field => {
                        const oldValue = currentData[field]
                        const newValue = requestedData[field]
                        if (oldValue !== newValue) {
                          const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                          let displayOld = oldValue
                          let displayNew = newValue
                          
                          if (field === 'harga') {
                            displayOld = `Rp ${parseInt(oldValue).toLocaleString()}`
                            displayNew = `Rp ${parseInt(newValue).toLocaleString()}`
                          }
                          
                          changes.push(`${fieldName}: ${displayOld} → ${displayNew}`)
                        }
                      })
                    }
                    
                    return (
                      <tr 
                        key={request.id_audit}
                        data-request-id={request.id_audit}
                        className={`hover:bg-gray-50 transition-colors ${
                          isHighlighted ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                        }`}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            {isHighlighted && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                            )}
                            {request.approval_status === 'approved' ? (
                              <span className="text-green-600 text-lg">✅</span>
                            ) : request.approval_status === 'rejected' ? (
                              <span className="text-red-600 text-lg">❌</span>
                            ) : (
                              <span className="text-yellow-600 text-lg">⏳</span>
                            )}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              request.approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                              request.approval_status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {request.approval_status === 'approved' ? 'DISETUJUI' :
                               request.approval_status === 'rejected' ? 'DITOLAK' : 'MENUNGGU'}
                            </span>
                          </div>
                        </td>
                        
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {requestType === 'update_stock' ? '📦 Update Stok' :
                             requestType === 'update_product' ? '✏️ Update Produk' :
                             requestType === 'delete_product' ? '🗑️ Hapus Produk' :
                             'Request'}
                          </span>
                        </td>
                        
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900">{productName}</div>
                          {currentData?.kategori_produk && (
                            <div className="text-xs text-gray-500">
                              {currentData.kategori_produk.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </div>
                          )}
                        </td>
                        
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900 max-w-xs">
                            {currentData && requestedData ? (
                              <div className="space-y-2">
                                {Object.keys(requestedData).filter(field => currentData[field] !== requestedData[field]).slice(0, 2).map(field => {
                                  const oldValue = currentData[field]
                                  const newValue = requestedData[field]
                                  
                                  const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                                  
                                  return (
                                    <div key={field} className="text-xs">
                                      <div className="font-medium text-gray-600 mb-1">{fieldName}:</div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-red-600 line-through">
                                          {field === 'harga' 
                                            ? `Rp ${parseInt(oldValue).toLocaleString()}` 
                                            : field.includes('stok') || field.includes('minimum')
                                              ? `${oldValue}`
                                              : oldValue
                                          }
                                        </span>
                                        <span className="text-gray-400">→</span>
                                        <span className="text-green-600 font-medium">
                                          {field === 'harga' 
                                            ? `Rp ${parseInt(newValue).toLocaleString()}` 
                                            : field.includes('stok') || field.includes('minimum')
                                              ? `${newValue}`
                                              : newValue
                                          }
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                                {Object.keys(requestedData).filter(field => currentData[field] !== requestedData[field]).length > 2 && (
                                  <div className="text-xs text-gray-500">
                                    +{Object.keys(requestedData).filter(field => currentData[field] !== requestedData[field]).length - 2} perubahan lainnya
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-500 text-xs">-</span>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {request.request_data?.kasir_name || '-'}
                          </div>
                        </td>
                        
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(request.waktu_aksi).toLocaleDateString('id-ID')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(request.waktu_aksi).toLocaleTimeString('id-ID')}
                          </div>
                          {request.approved_by_name && request.approved_at && (
                            <div className="text-xs text-gray-500 mt-1">
                              oleh {request.approved_by_name}
                            </div>
                          )}
                        </td>
                        
                        <td className="px-4 py-4">
                          {request.approval_notes && request.approval_notes.trim() ? (
                            <div className="text-sm text-gray-700 max-w-xs">
                              <div className="text-xs text-blue-600 font-medium mb-1">💬 Owner:</div>
                              <div className="text-xs italic">&quot;{request.approval_notes}&quot;</div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Load More Button */}
          {requestPagination.currentPage < requestPagination.totalPages && (
            <div className="border-t pt-4">
              <div className="text-center">
                <Button
                  onClick={() => fetchRequestHistory(requestPagination.currentPage + 1, true)}
                  variant="outline"
                  disabled={loadingHistory}
                  className="px-6 py-2 text-sm"
                >
                  {loadingHistory ? '⏳ Loading...' : '📋 Load More'}
                </Button>
                <div className="text-xs text-gray-500 mt-2">
                  {requestHistory.length} dari {requestPagination.totalRequests} requests
                </div>
              </div>
            </div>
          )}

        </div>
      </Modal>

      {/* Warning Modal */}
      <Modal 
        isOpen={showWarningModal} 
        onClose={() => {
          setShowWarningModal(false)
          setWarningMessage('')
        }}
        title="Peringatan"
        size="md"
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-yellow-600 text-3xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Tidak Dapat Memproses Request
            </h2>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-sm text-yellow-800 whitespace-pre-line">
              {warningMessage}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <span className="text-blue-600 mt-0.5">💡</span>
              <div className="text-sm text-blue-800">
                <strong>Tips:</strong> Anda dapat mengecek status request di menu &quot;Request Cabang&quot; 
                untuk melihat request yang masih pending.
              </div>
            </div>
          </div>
          
          <div className="flex justify-center pt-4">
            <Button 
              onClick={() => {
                setShowWarningModal(false)
                setWarningMessage('')
              }}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-8"
            >
              ✓ Mengerti
            </Button>
          </div>
        </div>
      </Modal>

    </>
  )
}

