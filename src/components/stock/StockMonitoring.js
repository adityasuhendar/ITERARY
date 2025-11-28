"use client"
import { useState, useEffect } from 'react'
import StockBranchCard from './StockBranchCard'
import StockDetail from './StockDetail'
import StockRequestsManager from './StockRequestsManager'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

export default function StockMonitoring({ initialTab = 'overview', hideRequestsTab = false }) {
  const [stockData, setStockData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [refreshInterval, setRefreshInterval] = useState(null)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [showInactiveProductsModal, setShowInactiveProductsModal] = useState(false)
  const [newProduct, setNewProduct] = useState({
    nama_produk: '',
    harga: '',
    satuan: 'pcs',
    kategori_produk: 'sabun_softener',
    stok_tersedia: '',
    stok_minimum: '10',
    cabang_id: ''
  })
  const [selectedBranches, setSelectedBranches] = useState([])
  const [addingProduct, setAddingProduct] = useState(false)
  const [branchList, setBranchList] = useState([])
  const [inactiveProducts, setInactiveProducts] = useState([])
  const [inactiveBranchProducts, setInactiveBranchProducts] = useState([])
  const [loadingInactive, setLoadingInactive] = useState(false)
  const [inactiveTab, setInactiveTab] = useState('global') // 'global' or 'branch'
  const [selectedInactiveBranch, setSelectedInactiveBranch] = useState('')
  const [showReactivateModal, setShowReactivateModal] = useState(false)
  const [selectedProductToReactivate, setSelectedProductToReactivate] = useState(null)
  const [selectedReactivateBranches, setSelectedReactivateBranches] = useState([])
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [productToDelete, setProductToDelete] = useState(null)
  const [availableUnits, setAvailableUnits] = useState(['pcs'])

  // Update activeTab when initialTab changes
  useEffect(() => {
    
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab)
      window.location.hash = `#${initialTab}`
    }
  }, [initialTab])

  useEffect(() => {
    fetchStockOverview()
    fetchBranches()
    fetchAvailableUnits()

    // Check for hash fragment to auto-switch tab (only if no explicit initialTab provided)
    if (initialTab === 'overview') {
      const hash = window.location.hash
      if (hash === '#requests') {
        setActiveTab('requests')
      } else if (hash === '#products') {
        setActiveTab('products')
        fetchInactiveProducts() // Auto-fetch when tab is products
      } else if (hash === '#overview') {
        setActiveTab('overview')
      }
    }
    // If initialTab is explicitly provided (like 'requests'), prioritize it over hash
    if (initialTab === 'products') {
      fetchInactiveProducts() // Auto-fetch when initialTab is products
    }

    // Set up auto-refresh every 5 minutes
    const interval = setInterval(fetchStockOverview, 5 * 60 * 1000)
    setRefreshInterval(interval)

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [])

  // Listen for hash changes to switch tabs (only if no explicit initialTab routing)
  useEffect(() => {
    // Skip hash listening if we got explicit initialTab from routing
    if (initialTab !== 'overview') {
      return
    }

    const handleHashChange = () => {
      const hash = window.location.hash
      if (hash === '#requests') {
        setActiveTab('requests')
      } else if (hash === '#products') {
        setActiveTab('products')
      } else if (hash === '#overview' || !hash) {
        setActiveTab('overview')
      }
    }

    // Also listen to hashchange events
    window.addEventListener('hashchange', handleHashChange)
    
    // Trigger once on mount to handle initial hash
    handleHashChange()
    
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [initialTab])

  const fetchStockOverview = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/stock/monitoring')
      const data = await response.json()
      
      if (response.ok) {
        setStockData(data)
      } else {
        console.error('Error fetching stock overview:', data.error)
      }
    } catch (error) {
      console.error('Error fetching stock overview:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetail = (branch) => {
    setSelectedBranch(branch)
  }

  const handleBackToOverview = () => {
    setSelectedBranch(null)
    fetchStockOverview()
  }

  const handleRefresh = () => {
    fetchStockOverview()
  }

  const fetchBranches = async () => {
    try {
      const response = await fetch('/api/branches')
      if (response.ok) {
        const data = await response.json()
        setBranchList(data.branches || [])
      }
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  const fetchAvailableUnits = async () => {
    try {
      const timestamp = Date.now()
      const response = await fetch(`/api/products/units?t=${timestamp}&r=${Math.random()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      if (response.ok) {
        const data = await response.json()
        setAvailableUnits(data.units || ['pcs'])
      } else {
        console.error('❌ StockMonitoring - Units API failed:', response.status)
      }
    } catch (error) {
      console.error('❌ StockMonitoring - Error fetching units:', error)
      // Keep default units if fetch fails
    }
  }

  const handleAddProduct = async (e) => {
    e.preventDefault()
    
    if (selectedBranches.length === 0) {
      alert('Pilih minimal satu cabang untuk produk ini!')
      return
    }
    
    try {
      setAddingProduct(true)

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProduct,
          harga: parseFloat(newProduct.harga),
          stok_tersedia: parseInt(newProduct.stok_tersedia),
          stok_minimum: parseInt(newProduct.stok_minimum),
          cabang_tersedia: selectedBranches
        })
      })

      if (response.ok) {
        alert('Produk berhasil ditambahkan!')
        setShowAddProductModal(false)
        setNewProduct({
          nama_produk: '',
          harga: '',
          satuan: 'pcs',
          kategori_produk: 'sabun_softener',
          stok_tersedia: '',
          stok_minimum: '10',
          cabang_id: ''
        })
        setSelectedBranches([])
        fetchStockOverview()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Gagal menambahkan produk')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setAddingProduct(false)
    }
  }

  const fetchInactiveProducts = async () => {
    try {
      setLoadingInactive(true)
      
      // Fetch global inactive products
      const globalResponse = await fetch('/api/products?status=nonaktif')
      if (globalResponse.ok) {
        const globalData = await globalResponse.json()
        setInactiveProducts(globalData.products || [])
      }
      
      // Fetch branch-specific inactive products if branch selected
      if (selectedInactiveBranch) {
        const branchResponse = await fetch(`/api/products?status=nonaktif_cabang&cabang_id=${selectedInactiveBranch}`)
        if (branchResponse.ok) {
          const branchData = await branchResponse.json()
          setInactiveBranchProducts(branchData.products || [])
        }
      }
      
    } catch (error) {
      console.error('Error fetching inactive products:', error)
    } finally {
      setLoadingInactive(false)
    }
  }

  const fetchBranchInactiveProducts = async (branchId) => {
    if (!branchId) return
    
    try {
      setLoadingInactive(true)
      const response = await fetch(`/api/products?status=nonaktif_cabang&cabang_id=${branchId}`)
      
      if (response.ok) {
        const data = await response.json()
        setInactiveBranchProducts(data.products || [])
      }
    } catch (error) {
      console.error('Error fetching branch inactive products:', error)
    } finally {
      setLoadingInactive(false)
    }
  }

  const handleReactivateProduct = async (productId) => {
    // Find product details
    const product = inactiveProducts.find(p => p.id_produk === productId)
    setSelectedProductToReactivate(product)
    setSelectedReactivateBranches([]) // Reset selection
    setShowReactivateModal(true)
  }

  const handleConfirmReactivate = async () => {
    if (!selectedProductToReactivate || selectedReactivateBranches.length === 0) {
      alert('Pilih minimal satu cabang untuk reaktivasi!')
      return
    }
    
    try {
      const response = await fetch(`/api/products`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reactivate_multiple',
          product_id: selectedProductToReactivate.id_produk,
          cabang_ids: selectedReactivateBranches,
          stok_tersedia: 0,
          stok_minimum: 10
        })
      })

      if (response.ok) {
        const result = await response.json()
        setSuccessMessage(`Produk "${selectedProductToReactivate.nama_produk}" berhasil diaktifkan di ${selectedReactivateBranches.length} cabang!`)
        setShowReactivateModal(false)
        setSelectedProductToReactivate(null)
        setSelectedReactivateBranches([])
        setShowSuccessModal(true)
        fetchInactiveProducts()
        fetchStockOverview()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Gagal mengaktifkan produk')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleBranchToggle = (branchId) => {
    setSelectedReactivateBranches(prev => {
      if (prev.includes(branchId)) {
        return prev.filter(id => id !== branchId)
      } else {
        return [...prev, branchId]
      }
    })
  }

  const handleSelectAllBranches = () => {
    if (selectedReactivateBranches.length === branchList.length) {
      setSelectedReactivateBranches([])
    } else {
      setSelectedReactivateBranches(branchList.map(b => b.id_cabang))
    }
  }

  const handleDeleteProduct = (product) => {
    setProductToDelete(product)
    setShowDeleteConfirmModal(true)
  }

  const handleConfirmDelete = async () => {
    if (!productToDelete) return

    try {
      const response = await fetch(`/api/products/${productToDelete.id_produk}?cabang_id=1`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const result = await response.json()
        setSuccessMessage(`Produk "${productToDelete.nama_produk}" berhasil dihapus!`)
        setShowDeleteConfirmModal(false)
        setProductToDelete(null)
        setShowDeleteSuccessModal(true)
        fetchInactiveProducts()
        fetchStockOverview()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Gagal menghapus produk')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleAddToBranch = async (productId, branchId) => {
    const stokTersedia = prompt('Masukkan stok awal untuk produk ini:', '0')
    if (stokTersedia === null) return
    
    const stokMinimum = prompt('Masukkan stok minimum:', '10')
    if (stokMinimum === null) return
    
    try {
      const response = await fetch(`/api/products`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_to_branch',
          product_id: productId,
          cabang_id: branchId,
          stok_tersedia: parseInt(stokTersedia) || 0,
          stok_minimum: parseInt(stokMinimum) || 10
        })
      })

      if (response.ok) {
        const result = await response.json()
        setSuccessMessage(result.message || 'Produk berhasil ditambahkan ke cabang!')
        setShowSuccessModal(true)
        fetchBranchInactiveProducts(branchId)
        fetchStockOverview()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Gagal menambahkan produk ke cabang')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  // Loading state
  if (loading && !stockData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show detail view if branch is selected
  if (selectedBranch) {
    return (
      <StockDetail 
        branchId={selectedBranch.id_cabang}
        onBack={handleBackToOverview}
      />
    )
  }

  // Error state
  if (!stockData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😵</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Gagal Memuat Data</h3>
          <p className="text-gray-600 mb-4">Terjadi kesalahan saat mengambil data monitoring stok.</p>
          <Button onClick={fetchStockOverview}>
            Coba Lagi
          </Button>
        </div>
      </div>
    )
  }

  const { branches, critical_items } = stockData

  // Calculate global statistics
  const globalStats = branches.reduce((acc, branch) => {
    acc.total_products += branch.total_products
    acc.out_of_stock += branch.stock_status.out_of_stock
    acc.critical += branch.stock_status.critical
    acc.low += branch.stock_status.low
    acc.good += branch.stock_status.good
    return acc
  }, { total_products: 0, out_of_stock: 0, critical: 0, low: 0, good: 0 })

  const totalIssues = globalStats.out_of_stock + globalStats.critical + globalStats.low
  const healthPercentage = globalStats.total_products > 0 ? 
    ((globalStats.good / globalStats.total_products) * 100).toFixed(1) : 100

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    ...(hideRequestsTab ? [] : [{ id: 'requests', label: 'Stock Requests', icon: '📋' }]),
    { id: 'products', label: 'Produk', icon: '📦' }
  ]

  return (
    <>
        {/* Tab Navigation - Mobile Optimized */}
        <Card className="mb-4 sm:mb-6 p-2 sm:p-4 bg-gray-50 border border-gray-200">
          <div className="grid grid-cols-3 gap-1 sm:gap-2 sm:flex sm:flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  window.location.hash = tab.id
                }}
                className={`flex items-center justify-center px-1 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium transition-all relative ${
                  activeTab === tab.id
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="sm:hidden text-lg">{tab.icon}</span>
                <span className="hidden sm:inline">
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </span>
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
                )}
              </button>
            ))}
          </div>
        </Card>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            
            {/* Statistics Cards - Consistent with Multi-Branch Style */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-blue-100 text-xs sm:text-sm font-medium">Total Produk</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{globalStats.total_products}</p>
                  </div>
                  <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">📦</div>
                </div>
              </Card>
              
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-red-500 to-red-600 text-white border-0 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-red-100 text-xs sm:text-sm font-medium">Habis</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{globalStats.out_of_stock}</p>
                  </div>
                  <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">❌</div>
                </div>
              </Card>
              
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-orange-100 text-xs sm:text-sm font-medium">Kritis</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{globalStats.critical}</p>
                  </div>
                  <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">🔥</div>
                </div>
              </Card>
              
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-yellow-500 to-yellow-600 text-white border-0 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-yellow-100 text-xs sm:text-sm font-medium">Menipis</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{globalStats.low}</p>
                  </div>
                  <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">⚡</div>
                </div>
              </Card>
              
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-green-100 text-xs sm:text-sm font-medium">Aman</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{globalStats.good}</p>
                  </div>
                  <div className="text-2xl sm:text-3xl lg:text-4xl opacity-80 ml-2">✅</div>
                </div>
              </Card>
            </div>

            {/* Health Status - Consistent Card Style */}
            <Card className="p-6 shadow-lg border-0 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className={`text-3xl mr-4`}>
                    {totalIssues > 0 ? '🚨' : '✅'}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {totalIssues > 0 ? 'Perhatian Diperlukan' : 'Semua Stok Sehat'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {totalIssues > 0 
                        ? `${totalIssues} produk dari ${branches.length} cabang memerlukan perhatian`
                        : `Semua stok di ${branches.length} cabang dalam kondisi baik`
                      }
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${
                    healthPercentage >= 80 ? 'text-green-600' : 
                    healthPercentage >= 60 ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}>
                    {healthPercentage}%
                  </div>
                  <div className="text-xs text-gray-500">Kesehatan Global</div>
                </div>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div 
                  className={`h-4 rounded-full transition-all duration-500 ${
                    healthPercentage >= 80 ? 'bg-green-500' : 
                    healthPercentage >= 60 ? 'bg-yellow-500' : 
                    'bg-red-500'
                  }`}
                  style={{ width: `${healthPercentage}%` }}
                ></div>
              </div>
            </Card>

            {/* Critical Items Alert - Consistent Card Style */}
            {critical_items.length > 0 && (
              <Card className="p-6 shadow-lg border-0 overflow-hidden">
                <div className="flex items-start">
                  <div className="text-red-500 text-2xl mr-4">⚠️</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      Alert: {critical_items.length} Produk Prioritas Tinggi
                    </h3>
                    <div className="space-y-2">
                      {critical_items.slice(0, 5).map((item, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          {/* Mobile Layout */}
                          <div className="block sm:hidden">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 text-sm leading-tight">
                                  {item.nama_produk}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  🏪 {item.nama_cabang}
                                </div>
                              </div>
                              <div className="ml-2 flex-shrink-0">
                                {item.alert_level === 'out_of_stock' && (
                                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                    HABIS
                                  </span>
                                )}
                                {item.alert_level === 'critical' && (
                                  <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                                    {item.stok_tersedia} tersisa
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Desktop Layout */}
                          <div className="hidden sm:flex items-center justify-between">
                            <div>
                              <span className="font-medium text-gray-900">{item.nama_produk}</span>
                              <span className="text-gray-600 ml-2">di {item.nama_cabang}</span>
                            </div>
                            <div>
                              {item.alert_level === 'out_of_stock' && (
                                <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                  HABIS
                                </span>
                              )}
                              {item.alert_level === 'critical' && (
                                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                                  {item.stok_tersedia} tersisa
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {critical_items.length > 5 && (
                        <div className="text-center p-2 text-gray-700 font-medium">
                          +{critical_items.length - 5} produk lainnya memerlukan perhatian
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Branch Cards */}
            <Card className="p-3 sm:p-6 shadow-lg border-0">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h2 className="text-base sm:text-xl font-bold text-gray-900">
                  📊 Status Stok Per Cabang
                </h2>
                <p className="text-xs text-gray-500 md:hidden">👈 Geser</p>
              </div>
              <div className="overflow-x-auto -mx-3 sm:mx-0 scrollbar-hide">
                <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 px-3 sm:px-0 sm:gap-6 pb-4 md:pb-0">
                  {branches.map((branch) => (
                    <div key={branch.id_cabang} className="flex-shrink-0 w-[75vw] md:w-auto">
                      <StockBranchCard
                        branch={branch}
                        onViewDetail={handleViewDetail}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {branches.length === 0 && (
              <Card className="p-12 shadow-lg border-0 text-center">
                <div className="text-4xl mb-4">🏪</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Belum Ada Cabang</h3>
                <p className="text-gray-600">Tidak ada data cabang yang tersedia untuk ditampilkan</p>
              </Card>
            )}
          </div>
        )}

        {/* Stock Requests Tab */}
        {activeTab === 'requests' && (
          <Card className="shadow-lg border-0">
            <StockRequestsManager />
          </Card>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Header with Add Button */}
            <Card className="p-4 sm:p-6 shadow-lg border-0">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">📦 Manajemen Produk</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    Kelola produk nonaktif dan tambahkan produk ke cabang baru
                  </p>
                </div>
                <Button
                  onClick={() => setShowAddProductModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base whitespace-nowrap w-full sm:w-auto"
                >
                  + Tambah Produk
                </Button>
              </div>
            </Card>

            {/* Inactive Products Section */}
            <Card className="p-4 sm:p-6 shadow-lg border-0">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                  <span>🗑️</span>
                  <span>Produk yang Sudah Dihapus</span>
                </h4>
                <Button
                  onClick={fetchInactiveProducts}
                  className="bg-gray-500 hover:bg-gray-600 text-white text-xs sm:text-sm px-3 py-1"
                >
                  🔄 Refresh
                </Button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 text-lg flex-shrink-0">ℹ️</span>
                  <div className="text-xs text-blue-800 flex-1">
                    <p className="font-medium mb-1">Produk dihapus tapi pernah dipakai di transaksi</p>
                    <p>Data tetap tersimpan untuk integritas transaksi. Bisa diaktifkan kembali kapan saja.</p>
                  </div>
                </div>
              </div>

              {loadingInactive ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Loading...</p>
                </div>
              ) : inactiveProducts.length > 0 ? (
                <div className="space-y-2">
                  {inactiveProducts.map((product) => (
                    <div key={product.id_produk} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <h5 className="font-semibold text-sm text-gray-900">{product.nama_produk}</h5>
                          <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-600">
                            <span>Rp {parseFloat(product.harga).toLocaleString('id-ID')} / {product.satuan}</span>
                            <span>•</span>
                            <span className="capitalize">{product.kategori_produk?.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleReactivateProduct(product.id_produk)}
                            className="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1"
                          >
                            🔄 Aktifkan
                          </Button>
                          <Button
                            onClick={() => handleDeleteProduct(product)}
                            className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1"
                          >
                            🗑️ Hapus
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <span className="text-4xl mb-2 block">🎉</span>
                  <h5 className="font-medium text-gray-900 mb-1">Tidak Ada Produk Nonaktif</h5>
                  <p className="text-sm text-gray-600">Semua produk masih aktif</p>
                </div>
              )}
            </Card>

            {/* Products Not in Branch Section */}
            <Card className="p-4 sm:p-6 shadow-lg border-0">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm sm:text-base font-bold text-gray-900">
                  Produk Belum Ada di Cabang Tertentu
                </h4>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <span className="text-yellow-600 text-lg flex-shrink-0">💡</span>
                  <div className="text-xs text-yellow-800 flex-1">
                    <p className="font-medium mb-1">Tambahkan produk existing ke cabang baru</p>
                    <p>Contoh: &quot;Aqua 600ml&quot; dijual di Cabang A, tapi Cabang B belum punya. Bisa ditambahkan tanpa bikin produk baru.</p>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Pilih Cabang:
                </label>
                <select
                  value={selectedInactiveBranch}
                  onChange={(e) => {
                    setSelectedInactiveBranch(e.target.value)
                    if (e.target.value) {
                      fetchBranchInactiveProducts(e.target.value)
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Pilih Cabang --</option>
                  {branchList.map((branch) => (
                    <option key={branch.id_cabang} value={branch.id_cabang}>
                      {branch.nama_cabang}
                    </option>
                  ))}
                </select>
              </div>

              {selectedInactiveBranch ? (
                loadingInactive ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading...</p>
                  </div>
                ) : inactiveBranchProducts.length > 0 ? (
                  <div className="space-y-2">
                    {inactiveBranchProducts.map((product) => (
                      <div key={product.id_produk} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1">
                            <h5 className="font-semibold text-sm text-gray-900">{product.nama_produk}</h5>
                            <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-600">
                              <span>Rp {parseFloat(product.harga).toLocaleString('id-ID')} / {product.satuan}</span>
                              <span>•</span>
                              <span className="capitalize">{product.kategori_produk?.replace(/_/g, ' ')}</span>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleAddToBranch(product.id_produk, selectedInactiveBranch)}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 whitespace-nowrap"
                          >
                            + Tambah ke Cabang Ini
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <span className="text-4xl mb-2 block">✅</span>
                    <h5 className="font-medium text-gray-900 mb-1">Semua Produk Sudah Tersedia</h5>
                    <p className="text-sm text-gray-600">Cabang ini sudah punya semua produk aktif</p>
                  </div>
                )
              ) : (
                <div className="text-center py-8">
                  <span className="text-4xl mb-2 block">🏢</span>
                  <h5 className="font-medium text-gray-900 mb-1">Pilih Cabang</h5>
                  <p className="text-sm text-gray-600">Pilih cabang di atas untuk melihat produk yang belum tersedia</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Add Product Modal */}
        <Modal
          isOpen={showAddProductModal}
          onClose={() => {
            setShowAddProductModal(false)
            setNewProduct({
              nama_produk: '',
              harga: '',
              satuan: 'pcs',
              kategori_produk: 'sabun_softener',
              stok_tersedia: '',
              stok_minimum: '10',
              cabang_id: ''
            })
            setSelectedBranches([])
          }}
          title="Tambah Produk Baru"
          size="lg"
        >
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Produk *
              </label>
              <input
                type="text"
                required
                value={newProduct.nama_produk}
                onChange={(e) => setNewProduct(prev => ({ ...prev, nama_produk: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Contoh: Sabun Cuci Premium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Harga (Rp) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={newProduct.harga}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, harga: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="5000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Satuan *
                </label>
                <input
                  type="text"
                  list="satuan-options-add"
                  required
                  value={newProduct.satuan}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, satuan: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ketik atau pilih: pcs, botol, sachet, liter..."
                />
                <datalist id="satuan-options-add">
                  {availableUnits.map(unit => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
                <div className="flex flex-wrap gap-1 mt-2">
                  {availableUnits.slice(0, 6).map(unit => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setNewProduct(prev => ({ ...prev, satuan: unit }))}
                      className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border transition-colors"
                    >
                      {unit}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  💡 Ketik satuan baru atau pilih dari tombol di atas
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategori *
              </label>
              <select
                required
                value={newProduct.kategori_produk}
                onChange={(e) => setNewProduct(prev => ({ ...prev, kategori_produk: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="sabun_softener">Sabun & Softener</option>
                <option value="tas_plastik">Tas Plastik</option>
                <option value="minuman">Minuman</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cabang yang Akan Memiliki Produk Ini *
              </label>
              <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                {branchList.length > 0 ? (
                  branchList.map((branch) => (
                    <label key={branch.id_cabang} className="flex items-center space-x-2 mb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBranches.includes(branch.id_cabang.toString())}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBranches(prev => [...prev, branch.id_cabang.toString()])
                            if (selectedBranches.length === 0) {
                              setNewProduct(prev => ({ ...prev, cabang_id: branch.id_cabang.toString() }))
                            }
                          } else {
                            setSelectedBranches(prev => prev.filter(id => id !== branch.id_cabang.toString()))
                            if (newProduct.cabang_id === branch.id_cabang.toString()) {
                              const remaining = selectedBranches.filter(id => id !== branch.id_cabang.toString())
                              setNewProduct(prev => ({ ...prev, cabang_id: remaining[0] || '' }))
                            }
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{branch.nama_cabang}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">Loading cabang...</p>
                )}
              </div>
              {selectedBranches.length > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  ✓ {selectedBranches.length} cabang dipilih
                </p>
              )}
            </div>

            {selectedBranches.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cabang untuk Stok Awal *
                </label>
                <select
                  required
                  value={newProduct.cabang_id}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, cabang_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Pilih cabang untuk stok awal</option>
                  {branchList
                    .filter(branch => selectedBranches.includes(branch.id_cabang.toString()))
                    .map((branch) => (
                      <option key={branch.id_cabang} value={branch.id_cabang}>
                        {branch.nama_cabang}
                      </option>
                    ))
                  }
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Stok awal akan ditambahkan ke cabang ini. Cabang lain akan dimulai dengan stok 0.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stok Awal *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={newProduct.stok_tersedia}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, stok_tersedia: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stok Minimum *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newProduct.stok_minimum}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, stok_minimum: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="10"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                variant="outline"
                disabled={addingProduct}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={addingProduct}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                {addingProduct ? 'Menyimpan...' : 'Tambah Produk'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Inactive Products Modal */}
        <Modal
          isOpen={showInactiveProductsModal}
          onClose={() => {
            setShowInactiveProductsModal(false)
            setInactiveProducts([])
            setInactiveBranchProducts([])
            setSelectedInactiveBranch('')
            setInactiveTab('global')
          }}
          title="Kelola Produk Nonaktif"
          size="xl"
        >
          <div className="space-y-4">
            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => {
                  setInactiveTab('global')
                  fetchInactiveProducts()
                }}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  inactiveTab === 'global'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🌐 Non Aktif Global
              </button>
              <button
                onClick={() => {
                  setInactiveTab('branch')
                  // Auto-select first branch if none selected
                  if (!selectedInactiveBranch && branchList.length > 0) {
                    const firstBranchId = branchList[0].id_cabang
                    setSelectedInactiveBranch(firstBranchId)
                    fetchBranchInactiveProducts(firstBranchId)
                  }
                }}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  inactiveTab === 'branch'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🏢 Non Aktif Per Cabang
              </button>
            </div>

            {/* Branch Selector for branch tab */}
            {inactiveTab === 'branch' && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pilih Cabang:
                </label>
                <select
                  value={selectedInactiveBranch}
                  onChange={(e) => {
                    setSelectedInactiveBranch(e.target.value)
                    if (e.target.value) {
                      fetchBranchInactiveProducts(e.target.value)
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Pilih Cabang --</option>
                  {branchList.map((branch) => (
                    <option key={branch.id_cabang} value={branch.id_cabang}>
                      {branch.nama_cabang}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {loadingInactive ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading produk nonaktif...</p>
              </div>
            ) : (
              <>
                {/* Global Inactive Products */}
                {inactiveTab === 'global' && (
                  <>
                    {inactiveProducts.length > 0 ? (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-blue-600 text-lg">ℹ️</span>
                        <div className="text-sm text-blue-800">
                          <strong>Info:</strong> Produk nonaktif adalah produk yang telah dihapus namun masih tersimpan 
                          untuk menjaga integritas data transaksi. Anda dapat mengaktifkan kembali produk ini.
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Produk
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Kategori
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Aksi
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {inactiveProducts.map((product) => (
                              <tr key={product.id_produk} className="hover:bg-gray-50">
                                <td className="px-4 py-4">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {product.nama_produk}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      Rp {product.harga?.toLocaleString('id-ID')} / {product.satuan}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-900">
                                  {product.kategori_produk?.replace(/_/g, ' ')}
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex space-x-2">
                                    <Button
                                      onClick={() => handleReactivateProduct(product.id_produk)}
                                      className="bg-green-500 hover:bg-green-600 text-white text-sm"
                                    >
                                      Aktifkan
                                    </Button>
                                    <Button
                                      onClick={() => handleDeleteProduct(product)}
                                      className="bg-red-500 hover:bg-red-600 text-white text-sm"
                                    >
                                      Hapus
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                      <div className="text-center text-sm text-gray-500 mt-4">
                        Total {inactiveProducts.length} produk nonaktif global ditemukan
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <span className="text-6xl mb-4 block">🎉</span>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak Ada Produk Nonaktif Global</h3>
                      <p className="text-gray-600">Semua produk masih aktif secara global.</p>
                    </div>
                  )}
                  </>
                )}

                {/* Branch Inactive Products */}
                {inactiveTab === 'branch' && (
                  <>
                    {selectedInactiveBranch ? (
                      <>
                        {inactiveBranchProducts.length > 0 ? (
                          <>
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                              <div className="flex items-center space-x-2">
                                <span className="text-yellow-600 text-lg">💡</span>
                                <div className="text-sm text-yellow-800">
                                  <strong>Info:</strong> Produk di bawah ini aktif secara global, namun tidak tersedia 
                                  di cabang ini. Anda dapat menambahkannya ke cabang ini.
                                </div>
                              </div>
                            </div>
                            <div className="bg-white rounded-lg border overflow-hidden">
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Produk
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Kategori
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Harga
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Aksi
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {inactiveBranchProducts.map((product) => (
                                      <tr key={product.id_produk} className="hover:bg-gray-50">
                                        <td className="px-4 py-4">
                                          <div>
                                            <div className="text-sm font-medium text-gray-900">
                                              {product.nama_produk}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                              {product.satuan} - {product.dibuat_pada && new Date(product.dibuat_pada).toLocaleDateString('id-ID')}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-4 py-4">
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                            {product.kategori_produk?.replace('_', ' ') || 'N/A'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-900">
                                          Rp {parseFloat(product.harga).toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-4 py-4">
                                          <button
                                            onClick={() => handleAddToBranch(product.id_produk, selectedInactiveBranch)}
                                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-xs font-medium transition-colors"
                                          >
                                            + Tambah ke Cabang Ini
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <div className="text-center text-sm text-gray-500 mt-4">
                              Total {inactiveBranchProducts.length} produk dapat ditambahkan ke cabang ini
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-12">
                            <span className="text-6xl mb-4 block">✅</span>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Semua Produk Tersedia</h3>
                            <p className="text-gray-600">
                              Semua produk aktif sudah tersedia di cabang ini.
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <span className="text-4xl mb-4 block">🏢</span>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Pilih Cabang</h3>
                        <p className="text-gray-600">
                          Pilih cabang di atas untuk melihat produk yang tidak tersedia di cabang tersebut.
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowInactiveProductsModal(false)}
                  >
                    Tutup
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>

        {/* Reactivate Product Modal */}
        <Modal
          isOpen={showReactivateModal}
          onClose={() => {
            setShowReactivateModal(false)
            setSelectedProductToReactivate(null)
          }}
          title="Pilih Cabang untuk Reaktivasi Produk"
          size="md"
        >
          {selectedProductToReactivate && (
            <div className="space-y-6">
              {/* Product Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">📦</span>
                  <div>
                    <h3 className="font-semibold text-blue-900">
                      {selectedProductToReactivate.nama_produk}
                    </h3>
                    <p className="text-sm text-blue-700">
                      Rp {parseFloat(selectedProductToReactivate.harga).toLocaleString('id-ID')} / {selectedProductToReactivate.satuan}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Kategori: {selectedProductToReactivate.kategori_produk?.replace('_', ' ') || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Important Notice */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <span className="text-green-600 text-lg">✅</span>
                  <div>
                    <h4 className="font-medium text-green-800 mb-1">Reaktivasi Multi-Cabang:</h4>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• Pilih <strong>SATU ATAU LEBIH CABANG</strong> untuk reaktivasi</li>
                      <li>• Produk akan aktif di semua cabang yang dipilih dengan stok awal 0</li>
                      <li>• Anda bisa langsung memilih semua cabang sekaligus</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Branch Selection */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Pilih Cabang untuk Reaktivasi:
                  </label>
                  <button
                    onClick={handleSelectAllBranches}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {selectedReactivateBranches.length === branchList.length ? 'Hapus Semua' : 'Pilih Semua'}
                  </button>
                </div>
                
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {branchList.map((branch) => {
                    const isSelected = selectedReactivateBranches.includes(branch.id_cabang)
                    return (
                      <label
                        key={branch.id_cabang}
                        className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-green-50 border-green-300 text-green-900' 
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleBranchToggle(branch.id_cabang)}
                          className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                        />
                        <span className="text-lg">🏢</span>
                        <div className="flex-1">
                          <div className="font-medium">
                            {branch.nama_cabang}
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: {branch.id_cabang}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="text-green-600 text-sm font-medium">
                            ✓ Dipilih
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
                
                {selectedReactivateBranches.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm text-blue-800">
                      <strong>{selectedReactivateBranches.length} cabang dipilih:</strong>
                      <div className="mt-1">
                        {selectedReactivateBranches.map(branchId => {
                          const branch = branchList.find(b => b.id_cabang === branchId)
                          return branch ? branch.nama_cabang : `ID: ${branchId}`
                        }).join(', ')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center space-x-4 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowReactivateModal(false)
                    setSelectedProductToReactivate(null)
                    setSelectedReactivateBranches([])
                  }}
                  className="px-6 py-2 min-w-[120px]"
                >
                  Batal
                </Button>
                <Button
                  onClick={handleConfirmReactivate}
                  disabled={selectedReactivateBranches.length === 0}
                  className={`px-6 py-2 min-w-[200px] ${
                    selectedReactivateBranches.length === 0 
                      ? 'bg-gray-300 cursor-not-allowed' 
                      : 'bg-green-600 hover:bg-green-700'
                  } text-white`}
                >
                  Aktifkan di {selectedReactivateBranches.length > 0 ? selectedReactivateBranches.length : '0'} Cabang
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Success Modal */}
        <Modal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          title="Berhasil!"
          size="sm"
        >
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-4xl">✅</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Operasi Berhasil
              </h3>
              <p className="text-gray-600">
                {successMessage}
              </p>
            </div>
            <div className="pt-4">
              <Button
                onClick={() => setShowSuccessModal(false)}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 min-w-[120px] mx-auto block"
              >
                OK
              </Button>
            </div>
          </div>
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
            <div className="space-y-6">
              {/* Warning */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <span className="text-red-600 text-2xl">⚠️</span>
                  <div>
                    <h4 className="font-semibold text-red-800 mb-2">Peringatan!</h4>
                    <p className="text-sm text-red-700">
                      Anda akan menghapus produk secara permanen. Tindakan ini tidak dapat dibatalkan.
                    </p>
                  </div>
                </div>
              </div>

              {/* Product Info */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">📦</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {productToDelete.nama_produk}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Rp {parseFloat(productToDelete.harga).toLocaleString('id-ID')} / {productToDelete.satuan}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Kategori: {productToDelete.kategori_produk?.replace('_', ' ') || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Confirmation Text */}
              <div className="text-center">
                <p className="text-gray-700">
                  Apakah Anda yakin ingin menghapus produk <strong>&quot;{productToDelete.nama_produk}&quot;</strong>?
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center space-x-4 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirmModal(false)
                    setProductToDelete(null)
                  }}
                  className="px-6 py-2 min-w-[120px]"
                >
                  Batal
                </Button>
                <Button
                  onClick={handleConfirmDelete}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 min-w-[160px]"
                >
                  Ya, Hapus Produk
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Delete Success Modal */}
        <Modal
          isOpen={showDeleteSuccessModal}
          onClose={() => setShowDeleteSuccessModal(false)}
          title="Produk Berhasil Dihapus"
          size="sm"
        >
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-4xl">🗑️</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Berhasil Dihapus
              </h3>
              <p className="text-gray-600">
                {successMessage}
              </p>
            </div>
            <div className="pt-4">
              <Button
                onClick={() => setShowDeleteSuccessModal(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-2 min-w-[120px] mx-auto block"
              >
                OK
              </Button>
            </div>
          </div>
        </Modal>

    </>
  )
}