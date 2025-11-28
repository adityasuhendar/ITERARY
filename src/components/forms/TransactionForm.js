"use client"
import { useState, useEffect, useRef } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { printReceipt } from '@/lib/receiptPrinter'
import { useCSRF, fetchWithCSRF } from '@/hooks/useCSRF'
import { formatCurrency, formatDate, formatCurrentDateTime } from '@/lib/formatters'
import { validatePhoneNumber } from '@/lib/security'
import TransactionReceipt from '@/components/forms/TransactionReceipt'
import CustomerManagement from '@/components/customers/CustomerManagement'
import { detectCurrentShift } from '@/lib/shiftDetection'

// Payment Method Selection Modal
function PaymentMethodModal({ isOpen, onClose, onSelectPayment, loading = false }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pilih Metode Pembayaran" size="sm">
      <div className="space-y-4">
        <p className="text-gray-600 text-sm text-center mb-6">
          Bagaimana customer akan membayar?
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => onSelectPayment('tunai')}
            disabled={loading}
            className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all duration-200 disabled:opacity-50"
          >
            <div className="flex items-center justify-center space-x-3">
              <span className="text-2xl">💰</span>
              <div className="text-left">
                <div className="font-semibold text-gray-900">Tunai</div>
                <div className="text-sm text-gray-500">Cash payment</div>
              </div>
            </div>
          </button>
          
          <button
            onClick={() => onSelectPayment('qris')}
            disabled={loading}
            className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50"
          >
            <div className="flex items-center justify-center space-x-3">
              <span className="text-2xl">📱</span>
              <div className="text-left">
                <div className="font-semibold text-gray-900">QRIS</div>
                <div className="text-sm text-gray-500">Scan QR Code</div>
              </div>
            </div>
          </button>
        </div>
        
        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Memproses pembayaran...</p>
          </div>
        )}
      </div>
    </Modal>
  )
}


// Main Transaction Form Component
export default function TransactionForm({ user, onSuccess, onCancel, editMode = false, existingTransaction = null }) {
  
  // CSRF Protection Hook
  const { csrfToken, loading: csrfLoading, error: csrfError } = useCSRF()
  
  // Determine initial step: 4 if payment mode, 2 if editing, 1 if new
  const initialStep = existingTransaction?._jumpToPayment ? 4 : (editMode ? 2 : 1)
  const [step, setStep] = useState(initialStep)
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Memproses...')
  const [customers, setCustomers] = useState([])
  const [services, setServices] = useState([])
  const [products, setProducts] = useState([])
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [completedTransaction, setCompletedTransaction] = useState(null)
  const [error, setError] = useState('')
  const [errorCountdown, setErrorCountdown] = useState(0)
  const [isDraftTransaction, setIsDraftTransaction] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentConfirmation, setPaymentConfirmation] = useState({ show: false, method: '', transactionData: null })
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorModalData, setErrorModalData] = useState({ title: '', message: '' })
  const [machineAvailability, setMachineAvailability] = useState({})
  const [originalServices, setOriginalServices] = useState([]) // For edit mode comparison
  // REMOVED: freeProducts state - now using full hardcoded rules in autoAddFreeProducts()
  const [showCustomerManagement, setShowCustomerManagement] = useState(false)
  const [loyaltyModal, setLoyaltyModal] = useState({ show: false, customer: '', pointsEarned: 0, totalPoints: 0, totalCuci: 0, message: '' })

  // ========================================
  // 🔧 FEATURE FLAGS - TOGGLE DISINI!
  // ========================================
  const ENABLE_CUCI_FREE_PRODUCTS = true  // ← Ubah jadi false untuk disable auto-add Cuci (1 Softener gratis)
  const ENABLE_CKL_FREE_PRODUCTS = false   // ← Ubah jadi false untuk disable auto-add CKL (2 Softener + 1 Deterjen gratis)
  // ========================================
  // Global cache for machines and services data (8 hours)
  if (typeof window !== 'undefined' && !window.machineCache) {
    window.machineCache = new Map()
  }
  if (typeof window !== 'undefined' && !window.servicesCache) {
    window.servicesCache = new Map()
  }

  // Form state
  const [formData, setFormData] = useState({
    customer: null,
    selectedServices: [],
    selectedProducts: [],
    paymentMethod: 'tunai',
    notes: ''
  })

  // Search state
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    nama_pelanggan: '',
    nomor_telepon: ''
  })

  // Loyalty state
  const [loyaltyData, setLoyaltyData] = useState(null)
  const [showFreeLaundryOffer, setShowFreeLaundryOffer] = useState(false)
  const [isUsingFreeLaundry, setIsUsingFreeLaundry] = useState(false)
  
  // Loading guard to prevent duplicate API calls
  const isLoadingRef = useRef(false)

  useEffect(() => {
    console.log('🔄 [TransactionForm] useEffect triggered - editMode:', editMode, 'existingTransaction:', !!existingTransaction, 'isLoadingRef:', isLoadingRef.current)
    const loadData = async () => {
      if (editMode && existingTransaction && !isLoadingRef.current) { // USE REF GUARD
        console.log('📝 [TransactionForm] EDIT MODE - Loading transaction data...')
        isLoadingRef.current = true // Set ref guard IMMEDIATELY
        try {
          setLoading(true) // Set loading state for edit mode
          setLoadingMessage('Memuat Data Transaksi...')
          // PARALLEL API CALLS for faster performance
          await Promise.all([
            fetchInitialData(),
            loadExistingTransactionData()
          ])
          
          // Jump to payment step if requested
          if (existingTransaction._jumpToPayment) {
            setStep(4)
          }
        } catch (error) {
          console.error('Error loading transaction data:', error)
          setError('Gagal memuat data transaksi')
        } finally {
          setLoading(false) // Clear loading state
          isLoadingRef.current = false // Clear ref guard
        }
        console.log('✅ [TransactionForm] EDIT MODE - Loading completed')
      } else if (!editMode && !isLoadingRef.current) { // USE REF GUARD
        console.log('🆕 [TransactionForm] NORMAL MODE - Loading initial data...')
        // Normal flow - just initial data (only when NOT in edit mode)
        fetchInitialData()
      } else {
        console.log('⏳ [TransactionForm] SKIPPED - isLoadingRef:', isLoadingRef.current, 'editMode:', editMode, 'existingTransaction:', !!existingTransaction)
      }
      // Do nothing if editMode = true but no existingTransaction yet
    }
    
    loadData()
  }, [editMode, existingTransaction?.id_transaksi])

  // 🎯 COMPREHENSIVE FREE PRODUCTS SYNC - Single source of truth
  useEffect(() => {
    console.log('🔄 [FreeProdSync] Triggered - step:', step, 'products:', products.length)

    // Only run on step 3 with products loaded
    if (step !== 3 || products.length === 0) {
      console.log('⏭️ [FreeProdSync] Skipping - not step 3 or no products')
      return
    }

    // Calculate expected quantities with feature flags
    const cuciServices = formData.selectedServices.filter(s =>
      s.nama_layanan === 'Cuci' || s.id === 1
    )
    const cklServices = formData.selectedServices.filter(s =>
      s.nama_layanan?.includes('CKL') || s.id === 4
    )

    const totalCuci = ENABLE_CUCI_FREE_PRODUCTS
      ? cuciServices.reduce((sum, s) => sum + (s.quantity || 0), 0)
      : 0
    const totalCKL = ENABLE_CKL_FREE_PRODUCTS
      ? cklServices.reduce((sum, s) => sum + (s.quantity || 0), 0)
      : 0

    console.log('📊 [FreeProdSync] totalCuci:', totalCuci, 'totalCKL:', totalCKL)

    // If no washing services, remove all free products
    if (totalCuci === 0 && totalCKL === 0) {
      const hasFreeProducts = formData.selectedProducts.some(p => p.isFree === true)
      if (hasFreeProducts) {
        console.log('🗑️ [FreeProdSync] Removing all free products (no washing services)')
        setFormData(prev => ({
          ...prev,
          selectedProducts: prev.selectedProducts.filter(p => !p.isFree)
        }))
      }
      return
    }

    // Calculate expected quantities
    const expectedSoftener = (totalCuci * 1) + (totalCKL * 2)
    const expectedDeterjen = totalCKL * 1

    // Sync products with expected quantities
    setFormData(prev => {
      let updated = [...prev.selectedProducts]

      // Helper to create free reason text
      const getSoftenerReason = () => {
        if (totalCuci > 0 && totalCKL > 0) {
          return `Gratis (${totalCuci} Cuci + ${totalCKL} CKL)`
        } else if (totalCKL > 0) {
          return `Gratis untuk ${totalCKL} CKL`
        } else {
          return `Gratis untuk ${totalCuci} Cuci`
        }
      }

      // === HANDLE SOFTENER ===
      const softenerIdx = updated.findIndex(p =>
        p.id_produk === 2 || p.nama_produk === 'Softener'
      )

      if (softenerIdx >= 0) {
        // Softener exists - UPDATE or REMOVE
        const existing = updated[softenerIdx]
        const paidQty = existing.paidQuantity || 0

        if (expectedSoftener > 0) {
          // UPDATE with new free quantity
          updated[softenerIdx] = {
            ...existing,
            quantity: expectedSoftener + paidQty,  // Always preserve paidQty
            freeQuantity: expectedSoftener,
            paidQuantity: paidQty,
            isFree: paidQty > 0 ? true : true,  // Keep isFree if has any free
            freeReason: getSoftenerReason()
          }
        } else {
          // expectedSoftener = 0 (no Cuci/CKL)
          if (paidQty > 0) {
            // Has paid quantity - convert to non-free
            updated[softenerIdx] = {
              ...existing,
              quantity: paidQty,
              freeQuantity: 0,
              paidQuantity: paidQty,
              isFree: false,
              freeReason: null
            }
          } else {
            // Fully free - REMOVE
            console.log('🗑️ [FreeProdSync] Removing Softener (no longer needed)')
            updated = updated.filter((_, idx) => idx !== softenerIdx)
          }
        }
      } else if (expectedSoftener > 0) {
        // Softener doesn't exist - ADD new
        const softenerProduct = products.find(p =>
          p.id_produk === 2 || p.nama_produk === 'Softener'
        )

        if (softenerProduct) {
          console.log('✅ [FreeProdSync] Adding Softener x', expectedSoftener)
          updated.push({
            id: softenerProduct.id,
            id_produk: softenerProduct.id_produk,
            nama_produk: softenerProduct.nama_produk,
            harga: softenerProduct.harga,
            satuan: softenerProduct.satuan,
            kategori_produk: softenerProduct.kategori_produk,
            stok_tersedia: softenerProduct.stok_tersedia,
            quantity: expectedSoftener,
            isFree: true,
            freeQuantity: expectedSoftener,
            paidQuantity: 0,
            freeReason: getSoftenerReason()
          })
        }
      }

      // === HANDLE DETERJEN ===
      const deterjenIdx = updated.findIndex(p =>
        p.id_produk === 1 || p.nama_produk === 'Deterjen'
      )

      if (deterjenIdx >= 0) {
        // Deterjen exists - UPDATE or REMOVE
        const existing = updated[deterjenIdx]
        const paidQty = existing.paidQuantity || 0

        if (expectedDeterjen > 0) {
          // UPDATE with new free quantity
          updated[deterjenIdx] = {
            ...existing,
            quantity: expectedDeterjen + paidQty,  // Always preserve paidQty
            freeQuantity: expectedDeterjen,
            paidQuantity: paidQty,
            isFree: true,
            freeReason: `Gratis untuk ${totalCKL} CKL`
          }
        } else {
          // expectedDeterjen = 0 (no CKL)
          if (paidQty > 0) {
            // Has paid quantity - convert to non-free
            updated[deterjenIdx] = {
              ...existing,
              quantity: paidQty,
              freeQuantity: 0,
              paidQuantity: paidQty,
              isFree: false,
              freeReason: null
            }
          } else {
            // Fully free - REMOVE
            updated = updated.filter((_, idx) => idx !== deterjenIdx)
          }
        }
      } else if (expectedDeterjen > 0) {
        // Deterjen doesn't exist - ADD new
        const deterjenProduct = products.find(p =>
          p.id_produk === 1 || p.nama_produk === 'Deterjen'
        )

        if (deterjenProduct) {
          updated.push({
            id: deterjenProduct.id,
            id_produk: deterjenProduct.id_produk,
            nama_produk: deterjenProduct.nama_produk,
            harga: deterjenProduct.harga,
            satuan: deterjenProduct.satuan,
            kategori_produk: deterjenProduct.kategori_produk,
            stok_tersedia: deterjenProduct.stok_tersedia,
            quantity: expectedDeterjen,
            isFree: true,
            freeQuantity: expectedDeterjen,
            paidQuantity: 0,
            freeReason: `Gratis untuk ${totalCKL} CKL`
          })
        }
      }

      return {
        ...prev,
        selectedProducts: updated
      }
    })
  }, [step, formData.selectedServices, editMode, products.length])

  const fetchInitialData = async (forceRefresh = false) => {
    console.log('🚀 [TransactionForm] fetchInitialData() called')
    try {
      // Check caches first (8 hours = 28800000ms)
      const machinesCacheKey = `machines_${user.cabang_id}`
      const servicesCacheKey = 'services_all'
      let machinesData = null
      let servicesData = null

      if (!forceRefresh && typeof window !== 'undefined') {
        // Check machines cache
        if (window.machineCache) {
          const cached = window.machineCache.get(machinesCacheKey)
          if (cached && Date.now() - cached.timestamp < 28800000) {
            console.log('✅ Using cached machines data')
            machinesData = cached.data
          }
        }

        // Check services cache
        if (window.servicesCache) {
          const cached = window.servicesCache.get(servicesCacheKey)
          if (cached && Date.now() - cached.timestamp < 28800000) {
            console.log('✅ Using cached services data')
            servicesData = cached.data
          }
        }
      }

      // Fetch services, products, and machine status (if not cached)
      // REMOVED: /api/products/free-active - now using full hardcoded rules
      const fetchPromises = [
        servicesData ? Promise.resolve({ ok: true, json: () => servicesData }) : fetch('/api/services'),
        fetch(`/api/inventory/${user.cabang_id}`),
        machinesData ? Promise.resolve({ ok: true, json: () => machinesData }) : fetch(`/api/machines?cabang_id=${user.cabang_id}`)
      ]

      const [servicesRes, productsRes, machinesRes] = await Promise.all(fetchPromises)
      console.log('✅ [TransactionFiyaorm] fetchInitialData() completed')

      if (servicesRes.ok) {
        let finalServicesData
        if (servicesData) {
          // Use cached data
          finalServicesData = servicesData
        } else {
          // Fresh fetch - cache it
          finalServicesData = await servicesRes.json()
          if (typeof window !== 'undefined' && window.servicesCache) {
            window.servicesCache.set(servicesCacheKey, {
              data: finalServicesData,
              timestamp: Date.now()
            })
            console.log('💾 Cached fresh services data for 8 hours')
          }
        }
        setServices(finalServicesData)
      }
      if (productsRes.ok) {
        const productsData = await productsRes.json()
        setProducts(productsData.inventory || [])
      }
      if (machinesRes.ok) {
        let finalMachinesData
        if (machinesData) {
          // Use cached data
          finalMachinesData = machinesData
        } else {
          // Fresh fetch - cache it
          finalMachinesData = await machinesRes.json()
          if (typeof window !== 'undefined' && window.machineCache) {
            window.machineCache.set(machinesCacheKey, {
              data: finalMachinesData,
              timestamp: Date.now()
            })
            console.log('💾 Cached fresh machines data for 8 hours')
          }
        }

        // Calculate machine availability
        const availability = {}
        finalMachinesData.machines.forEach(machine => {
          const type = machine.jenis_mesin // 'cuci' or 'pengering'
          if (!availability[type]) {
            availability[type] = { available: 0, total: 0 }
          }
          availability[type].total++
          if (machine.status_mesin === 'tersedia') {
            availability[type].available++
          }
        })
        setMachineAvailability(availability)
      }

      // REMOVED: freeProducts fetch handler - now using full hardcoded rules
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Gagal memuat data. Silakan coba lagi.')
    }
  }

  const loadExistingTransactionData = async () => {
    console.log('📄 [TransactionForm] loadExistingTransactionData() called')
    try {
      
      // Skip API call if we already have detailed data
      let transactionData = existingTransaction
      
      // Only fetch if we don't have services/products data
      if (!existingTransaction.services && !existingTransaction.products) {
        const response = await fetch(`/api/transactions/${existingTransaction.id_transaksi}`)
        if (response.ok) {
          transactionData = await response.json()
        } else {
          throw new Error('Failed to load transaction details')
        }
      }
        
        // Set customer data
        const customer = {
          id_pelanggan: existingTransaction.id_pelanggan || transactionData.id_pelanggan,
          nama_pelanggan: existingTransaction.nama_pelanggan || transactionData.nama_pelanggan,
          nomor_telepon: existingTransaction.nomor_telepon || transactionData.nomor_telepon || null
        }

        // Fetch loyalty points for this customer
        try {
          await checkLoyaltyPoints(customer);
        } catch (loyaltyError) {
          console.error('❌ Loyalty error (non-critical):', loyaltyError)
        }
        
        // Set form data with existing transaction
        setFormData({
          customer: customer,
          selectedServices: (() => {
            if (!transactionData.services) return []
            
            // Smart consolidation: handle mixed pricing (free + paid services)
            const serviceMap = {}
            transactionData.services.forEach(service => {
              const serviceId = service.id_jenis_layanan
              const subtotal = parseFloat(service.subtotal) || 0
              const harga_satuan = parseFloat(service.harga_satuan) || 0
              const isFreeService = subtotal === 0
              
              if (serviceMap[serviceId]) {
                // Service already exists, increment quantities
                serviceMap[serviceId].quantity += 1
                if (isFreeService) {
                  serviceMap[serviceId].freeCount = (serviceMap[serviceId].freeCount || 0) + 1
                } else {
                  serviceMap[serviceId].paidCount = (serviceMap[serviceId].paidCount || 0) + 1
                  // Update harga with non-zero price from paid service
                  if (harga_satuan > 0) {
                    serviceMap[serviceId].harga = harga_satuan
                  }
                }
              } else {
                // New service - prioritize non-zero price
                const servicePrice = isFreeService ? 0 : harga_satuan
                serviceMap[serviceId] = {
                  id: serviceId,
                  nama_layanan: service.nama_layanan,
                  harga: servicePrice,
                  quantity: 1,
                  durasi_menit: service.durasi_menit || 15,
                  freeCount: isFreeService ? 1 : 0,
                  paidCount: isFreeService ? 0 : 1
                }
              }
            })
            
            // Second pass: fix harga for services that started with free (harga=0)
            Object.values(serviceMap).forEach(service => {
              if (service.harga === 0 && service.paidCount > 0) {
                // Find a paid service record to get the correct price
                const paidRecord = transactionData.services.find(s => 
                  s.id_jenis_layanan === service.id && parseFloat(s.subtotal) > 0
                )
                if (paidRecord) {
                  service.harga = parseFloat(paidRecord.harga_satuan) || 0
                }
              }
            })
            
            const consolidatedServices = Object.values(serviceMap)
            
            // Check if any cuci service was used with free loyalty
            const hasFreeWashes = consolidatedServices.some(service => 
              service.nama_layanan && 
              service.nama_layanan.toLowerCase().includes('cuci') && 
              service.freeCount > 0
            )
            
            if (hasFreeWashes) {
              setIsUsingFreeLaundry(true)
              setShowFreeLaundryOffer(false) // Don't show offer since already used

              // Mark the specific cuci service as 'isFree' so it can be reset later
              consolidatedServices.forEach(service => {
                if (service.nama_layanan && service.nama_layanan.toLowerCase().includes('cuci') && service.freeCount > 0) {
                  service.isFree = true;
                }
              });
            }
            
            // Store original for comparison in edit mode
            if (editMode) {
              setOriginalServices(consolidatedServices.map(service => ({...service})))
            }
            
            return consolidatedServices
          })(),
          selectedProducts: (() => {
            if (!transactionData.products) return []

            // EDIT MODE: Read is_free and free_quantity directly from database
            return transactionData.products.map(product => {
              const productId = product.id_produk || product.id
              const originalQuantity = parseInt(product.quantity) || 0

              // Read free flags from database (is_free, free_quantity)
              const dbIsFree = product.is_free === 1 || product.is_free === true
              const dbFreeQuantity = parseInt(product.free_quantity) || 0
              const dbPaidQuantity = originalQuantity - dbFreeQuantity

              console.log(`📦 [LoadEdit] ${product.nama_produk}: isFree=${dbIsFree}, freeQty=${dbFreeQuantity}, paidQty=${dbPaidQuantity}, totalQty=${originalQuantity}`)

              // Preserve database values
              return {
                id: productId,
                id_produk: productId,
                nama_produk: product.nama_produk,
                harga: parseFloat(product.harga_satuan),
                quantity: originalQuantity,
                stok_tersedia: product.stok_tersedia || 999,
                isFree: dbIsFree,
                freeQuantity: dbFreeQuantity,
                paidQuantity: dbPaidQuantity,
                freeReason: dbIsFree && dbFreeQuantity > 0
                  ? `Gratis (dari database)`
                  : null
              }
            })
          })(),
          paymentMethod: 'tunai',
          notes: existingTransaction.catatan || transactionData.catatan || ''
        })
        
        console.log('✅ [TransactionForm] loadExistingTransactionData() completed')
    } catch (error) {
      console.error('❌ [TransactionForm] Error loading existing transaction:', error)
      setError('Gagal memuat data transaksi yang dipilih')
      
      // Fallback: use basic transaction data
      const customer = {
        id_pelanggan: existingTransaction.id_pelanggan,
        nama_pelanggan: existingTransaction.nama_pelanggan,
        nomor_telepon: null
      }
      
      setFormData(prev => ({
        ...prev,
        customer: customer,
        notes: existingTransaction.catatan || ''
      }))
    }
  }

  // Format phone number for display (add dashes)
  const formatPhoneDisplay = (phone) => {
    if (!phone) return ''
    const digits = phone.replace(/\D/g, '')

    if (digits.startsWith('62')) {
      // International: 62-812-3456-7890
      if (digits.length > 9) {
        return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`
      } else if (digits.length > 5) {
        return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
      } else if (digits.length > 2) {
        return `${digits.slice(0, 2)}-${digits.slice(2)}`
      }
    } else if (digits.startsWith('0')) {
      // Local: 0812-3456-7890
      if (digits.length > 8) {
        return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`
      } else if (digits.length > 4) {
        return `${digits.slice(0, 4)}-${digits.slice(4)}`
      }
    }

    return phone // Return original if not matching pattern
  }

  // Enhanced search with branch context
  const searchCustomers = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      // Build search URL with branch filter
      let searchUrl = `/api/customers/search?q=${encodeURIComponent(searchTerm)}&limit=10`
      if (user && user.cabang_id) {
        searchUrl += `&branch_id=${user.cabang_id}`
      }

      const response = await fetch(searchUrl)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.customers || [])
      } else {
        setSearchResults([])
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCustomers(customerSearch)
    }, 500)

    return () => clearTimeout(timer)
  }, [customerSearch])

  const handleServiceToggle = (service) => {
    // Check machine availability for this service
    const serviceName = service.nama_layanan.toLowerCase()
    const isCKL = serviceName.includes('ckl') || service.id === 4
    const serviceRequiresMachine = serviceName.includes('cuci') ||
                                  serviceName.includes('bilas') ||
                                  serviceName.includes('pengering') ||
                                  serviceName.includes('kering') ||
                                  isCKL

    if (serviceRequiresMachine) {
      // CKL butuh 2 mesin: cuci + pengering
      if (isCKL) {
        const cuciAvail = machineAvailability['cuci']
        const pengeringAvail = machineAvailability['pengering']

        const minAvailable = Math.min(
          cuciAvail?.available || 0,
          pengeringAvail?.available || 0
        )

        if (minAvailable === 0) {
          const message = `Maaf, CKL membutuhkan 1 mesin cuci dan 1 mesin pengering. Cuci tersedia: ${cuciAvail?.available || 0}/${cuciAvail?.total || 0}, Pengering tersedia: ${pengeringAvail?.available || 0}/${pengeringAvail?.total || 0}`
          alert(message)
          return
        }
      } else {
        // Determine machine type based on service name
        let machineType = 'cuci' // default for 'Cuci' and 'Bilas'
        if (serviceName.includes('kering')) {
          machineType = 'pengering' // 'Kering' uses pengering machines
        }

        const availability = machineAvailability[machineType]

        // Use available machines for both edit and new transactions
        const noMachineAvailable = availability && availability.available === 0

        if (noMachineAvailable) {
          const message = `Maaf, semua mesin ${machineType} sedang digunakan. Tersedia: ${availability.available}/${availability.total}`
          alert(message)
          return
        }
      }
    }
    
    setFormData(prev => {
      const existingService = prev.selectedServices.find(s => s.id === service.id)
      
      if (existingService) {
        // Service exists - remove it
        return {
          ...prev,
          selectedServices: prev.selectedServices.filter(s => s.id !== service.id)
        }
      } else {
        // Service doesn't exist - add with quantity 1
        return {
          ...prev,
          selectedServices: [...prev.selectedServices, { ...service, quantity: 1 }]
        }
      }
    })
    
    // Check if we should show loyalty offering when adding cuci service
    setTimeout(() => {
      if (loyaltyData && loyaltyData.loyalty && loyaltyData.loyalty.remaining_free_washes > 0 && // Has loyalty points
          !isUsingFreeLaundry && // Not already using loyalty
          !showFreeLaundryOffer && // Offering not already shown
          !formData.selectedServices.some(s => s.isFree === true || (s.freeCount !== undefined && s.freeCount > 0))) { // No free services already applied
        
        // Check if this was adding a cuci service (not removing)
        const existingService = formData.selectedServices.find(s => s.id === service.id)
        if (existingService && service.nama_layanan && service.nama_layanan.toLowerCase().includes('cuci')) {
          setShowFreeLaundryOffer(true)
        }
      }
    }, 100) // Small delay to ensure state is updated
  }

  const handleServiceQuantityChange = (serviceId, change) => {
    setFormData(prev => {
      const updatedServices = prev.selectedServices.map(service => {
        if (service.id === serviceId) {
          const newQuantity = Math.max(0, (service.quantity || 1) + change)
          
          // Check machine availability for increases
          if (change > 0) {
            const serviceName = service.nama_layanan.toLowerCase()
            const isCKL = serviceName.includes('ckl') || service.id === 4
            const serviceRequiresMachine = serviceName.includes('cuci') ||
                                          serviceName.includes('bilas') ||
                                          serviceName.includes('pengering') ||
                                          serviceName.includes('kering') ||
                                          isCKL

            if (serviceRequiresMachine) {
              // CKL butuh 2 mesin: cuci + pengering
              if (isCKL) {
                const cuciAvail = machineAvailability['cuci']
                const pengeringAvail = machineAvailability['pengering']

                const maxAllowed = Math.min(
                  cuciAvail?.available || 0,
                  pengeringAvail?.available || 0
                )

                if (newQuantity > maxAllowed) {
                  const message = `Maaf, CKL maksimal ${maxAllowed} (Cuci: ${cuciAvail?.available || 0}, Pengering: ${pengeringAvail?.available || 0})`
                  alert(message)
                  return service // Don't change quantity
                }
              } else {
                let machineType = 'cuci'
                if (serviceName.includes('kering')) {
                  machineType = 'pengering'
                }

                const availability = machineAvailability[machineType]

                // Use available machines for both edit and new transactions
                const maxAllowed = availability?.available


                if (availability && newQuantity > maxAllowed) {
                  const message = `Maaf, hanya ada ${availability.available} mesin ${machineType} yang tersedia`
                  alert(message)
                  return service // Don't change quantity
                }
              }
            }
          }
          
          // Handle loyalty recalculation when quantity changes
          const updatedService = { ...service, quantity: newQuantity }
          
          // If service has freeCount/paidCount from previous loyalty application, recalculate
          if (service.freeCount !== undefined || service.paidCount !== undefined) {
            const availableFreeWashes = loyaltyData?.loyalty?.remaining_free_washes || 0
            const newFreeCount = Math.min(newQuantity, availableFreeWashes)
            const newPaidCount = newQuantity - newFreeCount
            
            updatedService.freeCount = newFreeCount
            updatedService.paidCount = newPaidCount
            updatedService.isFree = newFreeCount >= newQuantity
            
            // CRITICAL FIX: Restore original harga from master service data if needed
            if (newPaidCount > 0 && parseFloat(updatedService.harga) === 0) {
              const originalService = services.find(s => s.id === serviceId)
              if (originalService && originalService.harga > 0) {
                updatedService.harga = originalService.harga
                console.log('🔧 Fixed harga for mixed service:', {
                  service: originalService.nama_layanan,
                  originalHarga: originalService.harga,
                  paidCount: newPaidCount
                })
              }
            }
          }
          
          return updatedService
        }
        return service
      }).filter(service => service.quantity > 0) // Remove services with 0 quantity
      
      // Check if we removed a free cuci service and reset free laundry state
      const hadFreeCuci = prev.selectedServices.some(s => 
        s.isFree === true && s.nama_layanan && s.nama_layanan.toLowerCase().includes('cuci')
      )
      const hasFreeCuci = updatedServices.some(s => 
        s.isFree === true && s.nama_layanan && s.nama_layanan.toLowerCase().includes('cuci')
      )
      
      // If we had free cuci but now we don't, reset the free laundry state
      if (hadFreeCuci && !hasFreeCuci) {
        // Reset free laundry state and show offer again if customer still has free washes
        setIsUsingFreeLaundry(false)
        if (loyaltyData && loyaltyData.loyalty && loyaltyData.loyalty.remaining_free_washes > 0) {
          setShowFreeLaundryOffer(true)
        }
      }
      
      return {
        ...prev,
        selectedServices: updatedServices
      }
    })
    
    // Check if we should show loyalty offering for increased cuci services
    setTimeout(() => {
      if (change > 0 && // Only on increase
          loyaltyData && loyaltyData.loyalty && loyaltyData.loyalty.remaining_free_washes > 0 && // Has loyalty points
          !isUsingFreeLaundry && // Not already using loyalty
          !showFreeLaundryOffer && // Offering not already shown
          !formData.selectedServices.some(s => s.isFree === true || (s.freeCount !== undefined && s.freeCount > 0))) { // No free services already applied
        
        // Check if this service increase was for a cuci service
        const service = formData.selectedServices.find(s => s.id === serviceId)
        if (service && service.nama_layanan && service.nama_layanan.toLowerCase().includes('cuci')) {
          setShowFreeLaundryOffer(true)
        }
      }
    }, 100) // Small delay to ensure state is updated
  }

  const handleProductQuantityChange = (product, quantity) => {
    
    if (quantity > product.stok_tersedia) {
      alert(`Stok tidak mencukupi. Stok tersedia: ${product.stok_tersedia}`)
      return
    }

    setFormData(prev => {
      const existingProduct = prev.selectedProducts.find(p => 
        (p.id != null && product.id != null && p.id === product.id) || 
        (p.id_produk != null && product.id_produk != null && p.id_produk === product.id_produk)
      )
      
      // Check if this is a free product that can't be reduced below free quantity
      if (existingProduct && existingProduct.isFree && existingProduct.freeQuantity) {
        const freeQty = existingProduct.freeQuantity
        if (quantity < freeQty) {
          alert(`Minimum ${freeQty} ${product.nama_produk} (gratis)`)
          return prev // Return unchanged state
        }
      }
      
      return {
        ...prev,
        selectedProducts: quantity > 0
          ? existingProduct
            ? prev.selectedProducts.map(p => {
                if ((p.id != null && product.id != null && p.id === product.id) || 
                    (p.id_produk != null && product.id_produk != null && p.id_produk === product.id_produk)) {
                  const updated = { ...p, quantity }
                  
                  // If this is a free product, maintain free properties
                  if (p.isFree && p.freeQuantity) {
                    const freeQty = p.freeQuantity
                    const paidQty = Math.max(0, quantity - freeQty)
                    updated.paidQuantity = paidQty
                  }
                  
                  return updated
                }
                return p
              })
            : (() => {
                // Check if this product should be free
                // REMOVED: freeProducts check - manual add products are NOT automatically free
                const isConfiguredAsFree = false
                const freeConfig = null
                
                // Only allow free products if there are selected services
                const hasSelectedServices = prev.selectedServices && prev.selectedServices.length > 0
                const shouldBeFree = isConfiguredAsFree && hasSelectedServices
                
                
                return [...prev.selectedProducts, {
                  id: product.id,
                  id_produk: product.id_produk,
                  nama_produk: product.nama_produk,
                  harga: product.harga,
                  satuan: product.satuan,
                  kategori_produk: product.kategori_produk,
                  stok_tersedia: product.stok_tersedia,
                  quantity,
                  isFree: shouldBeFree,
                  freeQuantity: shouldBeFree ? (freeConfig?.free_quantity || 0) : 0,
                  paidQuantity: shouldBeFree ? 
                    Math.max(0, quantity - (freeConfig?.free_quantity || 0)) : 
                    quantity,
                  freeReason: shouldBeFree ? 'Gratis setiap transaksi' : null
                }]
              })()
          : prev.selectedProducts.filter(p => 
              !((p.id != null && product.id != null && p.id === product.id) || 
                (p.id_produk != null && product.id_produk != null && p.id_produk === product.id_produk))
            )
      }
    })
  }

  const calculateTotal = () => {
    const serviceTotal = formData.selectedServices.reduce((sum, service) => {
      // Check if service has pre-calculated free/paid counts (from loaded transaction)
      if (service.freeCount !== undefined && service.paidCount !== undefined) {
        // Use existing free/paid split from loaded transaction
        return sum + (service.harga * service.paidCount)
      }
      
      // If using free laundry and this is a "Cuci" service, calculate partial free
      if (isUsingFreeLaundry && service.nama_layanan &&
          service.nama_layanan.toLowerCase().includes('cuci')) {
        const quantity = service.quantity || 1
        const freeCount = Math.min(quantity, loyaltyData?.loyalty?.remaining_free_washes || 0)
        const paidCount = quantity - freeCount
        return sum + (service.harga * paidCount) // Only charge for paid quantity
      }
      return sum + (service.harga * service.quantity)
    }, 0)
    
    const productTotal = formData.selectedProducts.reduce((sum, product) => {
      // Check if has washing services (Cuci OR CKL)
      const hasWashingServices = formData.selectedServices && formData.selectedServices.some(service =>
        service.nama_layanan === 'Cuci' || service.id === 1 ||
        service.nama_layanan?.includes('CKL') || service.id === 4
      )

      // HARDCODED FREE PRODUCT LOGIC
      // Product is free if it has isFree flag AND there are washing services
      const isFree = product.isFree && hasWashingServices
      const freeQuantity = isFree ? (product.freeQuantity || 0) : 0

      console.log(`💰 [calculateTotal] ${product.nama_produk}: qty=${product.quantity}, isFree=${isFree}, freeQty=${freeQuantity}`)

      if (isFree && freeQuantity > 0) {
        // Only count paid quantity for free products
        const paidQty = Math.max(0, product.quantity - freeQuantity)
        const charge = product.harga * paidQty
        console.log(`💰 [calculateTotal] ${product.nama_produk}: paidQty=${paidQty}, charge=${charge}`)
        return sum + charge
      }

      const charge = product.harga * product.quantity
      console.log(`💰 [calculateTotal] ${product.nama_produk}: regular charge=${charge}`)
      return sum + charge
    }, 0)
    return serviceTotal + productTotal
  }

  const handleCreateCustomer = async () => {
    if (!newCustomer.nama_pelanggan.trim()) {
      setErrorModalData({
        title: 'Data Tidak Lengkap',
        message: 'Nama pelanggan wajib diisi sebelum menyimpan data.'
      })
      setShowErrorModal(true)
      return
    }

    // Validate phone number if provided
    let normalizedPhone = newCustomer.nomor_telepon
    if (newCustomer.nomor_telepon && newCustomer.nomor_telepon.trim()) {
      const phoneValidation = validatePhoneNumber(newCustomer.nomor_telepon)
      if (!phoneValidation.isValid) {
        setErrorModalData({
          title: 'Format Nomor HP Tidak Valid',
          message: phoneValidation.error
        })
        setShowErrorModal(true)
        return
      }
      // Use normalized phone number for API, but DON'T mutate state
      normalizedPhone = phoneValidation.sanitized
    }

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nama_pelanggan: newCustomer.nama_pelanggan,
          nomor_telepon: normalizedPhone
        })
      })

      if (response.ok) {
        const customer = await response.json()
        await handleCustomerSelection(customer)
        setNewCustomer({ nama_pelanggan: '', nomor_telepon: '' })
        setShowCustomerForm(false)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Gagal membuat pelanggan')
      }
    } catch (error) {
      // Don't log expected business errors (like duplicate phone) as console.error
      // Only log if it's an actual system error
      if (!error.message.includes('sudah terdaftar') && !error.message.includes('sudah digunakan')) {
        console.error('Unexpected error creating customer:', error)
      }
      
      // Show professional error modal instead of ugly alert
      setErrorModalData({
        title: 'Gagal Membuat Pelanggan',
        message: (error.message.includes('sudah digunakan') || error.message.includes('sudah terdaftar'))
          ? error.message 
          : 'Terjadi kesalahan saat membuat data pelanggan. Silakan coba lagi.'
      })
      setShowErrorModal(true)
    }
  }

  const handleSubmitTransaction = async (isDraft = false, selectedPaymentMethod = null) => {
    // Check CSRF token availability
    if (!csrfToken) {
      if (csrfLoading) {
        alert('Security token masih dimuat. Mohon tunggu sebentar...')
      } else {
        alert('Security token tidak tersedia. Silakan refresh halaman.')
      }
      return
    }

    // Allow either services OR products (or both)
    const hasServices = (formData.selectedServices || []).filter(s => (s.quantity || 0) > 0).length > 0
    const hasProducts = (formData.selectedProducts || []).filter(p => (p.quantity || 0) > 0).length > 0
    
    if (!hasServices && !hasProducts) {
      alert('Pilih minimal satu layanan atau produk')
      return
    }

    setLoading(true)
    setLoadingMessage(isDraft ? 'Menyimpan Draft...' : 'Memproses Pembayaran...')
    setError('')
    
    try {
      // Validate required data
      if (!formData.customer) {
        setErrorModalData({
          title: 'Pelanggan Belum Dipilih',
          message: 'Silakan pilih pelanggan terlebih dahulu sebelum melanjutkan transaksi.'
        })
        setShowErrorModal(true)
        return
      }

      const customerId = formData.customer.id_pelanggan || formData.customer.id
      if (!customerId) {
        setErrorModalData({
          title: 'Data Pelanggan Tidak Valid',
          message: 'ID pelanggan tidak ditemukan. Silakan pilih pelanggan yang valid.'
        })
        setShowErrorModal(true)
        return
      }


      const transactionData = {
        id_pelanggan: customerId,
        services: (formData.selectedServices || []).filter(s => (s.quantity || 0) > 0).map(s => {
          // Check if this is a loaded transaction with pre-calculated free/paid counts
          if (s.freeCount !== undefined && s.paidCount !== undefined) {
            // Handle loaded transaction with existing free/paid breakdown
            const services = []
            
            // Add free services if any
            if (s.freeCount > 0) {
              services.push({
                ...s,
                quantity: s.freeCount,
                isFree: true,
                freeQuantity: s.freeCount
              })
            }
            
            // Add paid services if any
            if (s.paidCount > 0) {
              services.push({
                ...s,
                quantity: s.paidCount,
                isFree: false,
                freeQuantity: 0
              })
            }
            
            return services
          }
          // Handle services with loyalty applied (either isFree flag or freeCount > 0)
          else if ((s.isFree === true || (s.freeCount !== undefined && s.freeCount > 0)) && s.nama_layanan && s.nama_layanan.toLowerCase().includes('cuci')) {
            // Use existing freeCount/paidCount if available, otherwise calculate
            const quantity = s.quantity || 1
            const freeCount = s.freeCount !== undefined ? s.freeCount : Math.min(quantity, loyaltyData?.loyalty?.remaining_free_washes || 0)
            const paidCount = s.paidCount !== undefined ? s.paidCount : (quantity - freeCount)
            
            // Create separate records: free services and paid services
            const services = []
            
            // Add free services
            if (freeCount > 0) {
              services.push({
                ...s,
                quantity: freeCount,
                isFree: true,
                freeQuantity: freeCount
              })
            }
            
            // Add paid services
            if (paidCount > 0) {
              services.push({
                ...s,
                quantity: paidCount,
                isFree: false,
                freeQuantity: 0
              })
            }
            
            return services
          } else {
            // Non-cuci services or not using free laundry
            return [{
              ...s,
              isFree: false,
              freeQuantity: 0
            }]
          }
        }).flat(),
        products: (formData.selectedProducts || []).filter(p => (p.quantity || 0) > 0).map(p => {
          // UPDATED: Only preserve isFree/freeQuantity from autoAddFreeProducts (hardcoded rules)
          // No fallback to database configuration
          const productData = {
            ...p,
            // Preserve existing isFree/freeQuantity if already set (from autoAddFreeProducts)
            // Otherwise default to false (not free)
            isFree: p.isFree !== undefined ? p.isFree : false,
            freeQuantity: p.freeQuantity !== undefined ? p.freeQuantity : 0
          }

          console.log(`📦 [Submit] ${p.nama_produk}: isFree=${productData.isFree}, freeQty=${productData.freeQuantity}, totalQty=${productData.quantity}`)

          return productData
        }),
        payment_method: isDraft ? null : (selectedPaymentMethod || formData.paymentMethod || 'tunai'),
        notes: formData.notes || '',
        cabang_id: user.cabang_id,
        shift: (() => {
          // Step 1: Coba dari React state
          let finalShift = user.current_shift || user.shift

          // Step 2: Fallback localStorage (PWA bug recovery)
          if (!finalShift) {
            console.warn('⚠️ [PWA Bug] Shift null di React state - fallback localStorage')
            try {
              const userData = localStorage.getItem('user')
              if (userData) {
                const parsed = JSON.parse(userData)
                finalShift = parsed.current_shift || parsed.shift
                if (finalShift) {
                  console.log('✅ Shift recovered dari localStorage:', finalShift)
                }
              }
            } catch (e) {
              console.error('❌ Error parsing localStorage:', e)
            }
          }

          // Step 3: Auto-detect berdasarkan waktu (Smart fallback)
          if (!finalShift) {
            console.warn('⚠️ localStorage juga null - auto-detect dari waktu')
            const detected = detectCurrentShift()
            finalShift = detected.shift
            if (finalShift) {
              console.log('✅ Shift auto-detected:', finalShift)
            } else {
              console.error('❌ Di luar jam operasional (22:00-05:59)')
            }
          }

          return finalShift
        })(),
        // Send active worker name for database storage (string snapshot)
        active_worker_name: user.active_worker_name || null,
        is_draft: isDraft
      }

      console.log('🔍 [TransactionForm] User object received:', user)
      console.log('🔍 [TransactionForm] user.current_shift:', user.current_shift)
      console.log('🔍 [TransactionForm] user.shift:', user.shift)
      console.log('🔍 [TransactionForm] Final shift being sent:', transactionData.shift)

      // Determine API endpoint and method based on edit mode
      let apiUrl = '/api/transactions'
      let method = 'POST'
      
      if (editMode && existingTransaction) {
        apiUrl = `/api/transactions/${existingTransaction.id_transaksi}`
        method = 'PUT'
      }


      const response = await fetchWithCSRF(apiUrl, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData)
      }, csrfToken)

      if (response.ok) {
        const result = await response.json()
        
        // If using free laundry, claim the loyalty points (only for NEW transactions, not edit mode)
        if (isUsingFreeLaundry && !isDraft && !editMode && formData.customer.nomor_telepon) {
          try {
            const loyaltyResponse = await fetch('/api/loyalty/claim', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phone: formData.customer.nomor_telepon,
                services_used: formData.selectedServices
              })
            })
            
            if (loyaltyResponse.ok) {
              const loyaltyResult = await loyaltyResponse.json()
              // Update transaction with remaining free washes for receipt
              result.transaction.remaining_free_washes = loyaltyResult.loyalty.remaining_free_washes
              result.transaction.used_free_laundry = true
              
              // Mark cuci service as free in transaction data for receipt
              if (result.transaction.services) {
                result.transaction.services = result.transaction.services.map(service => {
                  if (service.nama_layanan && service.nama_layanan.toLowerCase().includes('cuci')) {
                    return { ...service, isFree: true, original_price: 10000 }
                  }
                  return service
                })
              }
              
            } else {
              console.error('❌ Failed to claim loyalty points')
            }
          } catch (loyaltyError) {
            console.error('❌ Loyalty claim error:', loyaltyError)
            // Don't fail the transaction if loyalty claim fails
          }
        }

        setCompletedTransaction({
          ...result.transaction,
          nomor_telepon_kasir: user.nomor_telepon || null
        })
        setIsDraftTransaction(isDraft)

        // Check if customer earned new loyalty points and show celebration modal
        if (result.loyaltyAchievement && result.loyaltyAchievement.hasNewPoints && !isDraft) {
          setLoyaltyModal({
            show: true,
            customer: result.loyaltyAchievement.customerName,
            pointsEarned: result.loyaltyAchievement.newPointsEarned,
            totalPoints: result.loyaltyAchievement.totalEarnedPoints,
            totalCuci: result.loyaltyAchievement.totalCuci,
            availablePoints: result.loyaltyAchievement.totalAvailablePoints,
            message: result.loyaltyAchievement.message
          })
        } else {
          setShowSuccessModal(true)
        }
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Gagal membuat transaksi')
      }
    } catch (error) {
      console.error('Error creating transaction:', error)
      setError('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveDraft = () => {
    handleSubmitTransaction(true)
  }

  const handleUpdateDraft = () => {
    handleSubmitTransaction(true) // Update as draft (payment method will be null)
  }

  const handleDirectPayment = (paymentMethod) => {
    // Validate first - allow either services OR products
    const hasServices = (formData.selectedServices || []).filter(s => (s.quantity || 0) > 0).length > 0
    const hasProducts = (formData.selectedProducts || []).filter(p => (p.quantity || 0) > 0).length > 0
    
    if (!hasServices && !hasProducts) {
      alert('Pilih minimal satu layanan atau produk')
      return
    }
    if (!formData.customer) {
      alert('Pelanggan belum dipilih')
      return
    }

    // Show confirmation modal
    setPaymentConfirmation({
      show: true,
      method: paymentMethod,
      transactionData: {
        customer: formData.customer,
        services: formData.selectedServices,
        products: formData.selectedProducts,
        total: calculateTotal()
      }
    })
  }

  const handleConfirmDirectPayment = () => {
    handleSubmitTransaction(false, paymentConfirmation.method)
    setPaymentConfirmation({ show: false, method: '', transactionData: null })
  }

  const handlePaidTransaction = () => {
    setShowPaymentModal(true)
  }

  const handlePaymentMethodSelect = (paymentMethod) => {
    setShowPaymentModal(false)
    handleSubmitTransaction(false, paymentMethod)
  }

  // Check for active draft transactions
  const checkActiveDraft = async (customerId) => {
    try {
      const response = await fetch(`/api/customers/${customerId}/active-draft`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to check for active drafts')
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error checking active draft:', error)
      throw error
    }
  }

  // Check loyalty points when customer is selected
  const checkLoyaltyPoints = async (customer) => {
    // Always check loyalty using customer ID (works for all customers)
    const customerId = customer.id_pelanggan || customer.id
    
    if (!customerId) {
      setLoyaltyData(null)
      setShowFreeLaundryOffer(false)
      return
    }

    try {
      // FIXED: Add cache buster to get fresh loyalty data
      const cacheBuster = Date.now()
      const response = await fetch(`/api/loyalty?customer_id=${customerId}&_=${cacheBuster}`)
      if (response.ok) {
        const data = await response.json()
        console.log('🐛 Full loyalty data structure:', data) // DEBUG: See full structure
        setLoyaltyData(data)
        // Show offer if customer has free washes
        if (data.loyalty && data.loyalty.remaining_free_washes > 0) {
          setShowFreeLaundryOffer(true)
          console.log('🎉 Loyalty offer shown:', data.loyalty.remaining_free_washes, 'free washes')
        } else {
          setShowFreeLaundryOffer(false)
          console.log('❌ No loyalty offer - remaining free washes:', data.loyalty?.remaining_free_washes || 0)
        }
      } else {
        setLoyaltyData(null)
        setShowFreeLaundryOffer(false)
        console.log('❌ Loyalty API error - hiding offer')
      }
    } catch (error) {
      console.error('Error checking loyalty:', error)
      setLoyaltyData(null)
      setShowFreeLaundryOffer(false)
    }
  }

  // Handle customer selection with draft validation
  const handleCustomerSelection = async (customer) => {
    const customerId = customer.id_pelanggan || customer.id
    
    try {
      setLoading(true)
      setLoadingMessage('Memuat Data Customer...')
      setError('')

      // Only check for existing draft when creating NEW transaction (not editing)
      if (!editMode) {
        // PARALLEL API CALLS for better performance
        const [draftCheck] = await Promise.all([
          checkActiveDraft(customerId),
          checkLoyaltyPoints(customer)
        ])
        
        if (draftCheck.hasDraft) {
          setError(`Pelanggan ${customer.nama_pelanggan} masih memiliki transaksi yang belum dibayar (${draftCheck.draft.kode}). Harap selesaikan transaksi tersebut terlebih dahulu.`)
          setLoading(false)
          
          // Start countdown from 5 seconds
          setErrorCountdown(5)
          const countdownInterval = setInterval(() => {
            setErrorCountdown(prev => {
              if (prev <= 1) {
                clearInterval(countdownInterval)
                setError('')
                return 0
              }
              return prev - 1
            })
          }, 1000)
          
          return
        }
        
        // No draft found - customer selection and loyalty already processed in parallel
        setFormData(prev => ({ ...prev, customer }))
        setStep(2)
      } else {
        // Edit mode - just set customer and check loyalty
        setFormData(prev => ({ ...prev, customer }))
        await checkLoyaltyPoints(customer)
        setStep(2)
      }
      
    } catch (error) {
      console.error('Error during customer selection:', error)
      // Only set error if not already set (to avoid overriding draft error message)
      setError(prevError => prevError || 'Gagal memeriksa status transaksi pelanggan. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  // Reset customer and loyalty data when going back to step 1
  const resetCustomerAndLoyalty = () => {
    // Don't reset anything in edit mode - preserve all existing data
    if (!editMode) {
      setFormData(prev => ({ ...prev, customer: null }))
      setLoyaltyData(null)
      setShowFreeLaundryOffer(false)
      setIsUsingFreeLaundry(false)
    }
    setError('')
    setStep(1)
  }

  // Apply free laundry offer
  const handleApplyFreeLaundry = () => {
    setIsUsingFreeLaundry(true)
    setShowFreeLaundryOffer(false)
    
    // Auto-add Cuci service if not already selected
    const cuciService = services.find(service => 
      service.nama_layanan.toLowerCase().includes('cuci')
    )
    
    
    if (cuciService) {
      // Services API returns: { id, nama_layanan, harga, durasi_menit, deskripsi }
      const serviceId = cuciService.id
      
      if (!serviceId) {
        console.error('❌ No valid service ID found:', cuciService)
        alert('Error: Service ID tidak valid untuk cuci gratis')
        return
      }
      
      setFormData(prev => {
        // Check if cuci service already selected
        const alreadySelected = prev.selectedServices.find(s => s.id === serviceId)
        const availableFreeWashes = loyaltyData?.loyalty?.remaining_free_washes || 0
        
        if (alreadySelected) {
          // Apply loyalty to existing service with smart quantity logic
          const currentQuantity = alreadySelected.quantity || 1
          const freeCount = Math.min(currentQuantity, availableFreeWashes)
          const paidCount = currentQuantity - freeCount
          
          return {
            ...prev,
            selectedServices: prev.selectedServices.map(s => 
              s.id === serviceId ? { 
                ...s, 
                freeCount: freeCount,
                paidCount: paidCount,
                isFree: freeCount >= currentQuantity // Only if all quantity is free
              } : s
            )
          }
        } else {
          // Add cuci service - default to 1 free (if available)
          const freeCount = Math.min(1, availableFreeWashes)
          return {
            ...prev,
            selectedServices: [...prev.selectedServices, { 
                ...cuciService, 
                quantity: 1,
                freeCount: freeCount,
                paidCount: 1 - freeCount,
                isFree: freeCount >= 1
              }]
          }
        }
      })
    } else {
      console.error('❌ Cuci service not found in services list')
      alert('Error: Layanan Cuci tidak ditemukan')
    }
  }

  // Dismiss free laundry offer
  const handleDismissFreeLaundry = () => {
    setShowFreeLaundryOffer(false)
  }

  // Check if service has been modified (for edit mode)
  const isServiceModified = (service) => {
    if (!editMode || !originalServices.length) return false
    
    const originalService = originalServices.find(orig => orig.id === service.id)
    if (!originalService) return true // New service added
    
    return originalService.quantity !== service.quantity // Quantity changed
  }

  const handleSuccessClose = () => {
    setShowSuccessModal(false)
    // Reset form for new transaction
    setFormData({
      customer: null,
      selectedServices: [],
      selectedProducts: [],
      paymentMethod: 'tunai',
      notes: ''
    })
    // Reset loyalty state
    setLoyaltyData(null)
    setShowFreeLaundryOffer(false)
    setIsUsingFreeLaundry(false)
    setStep(1)
    setCustomerSearch('')
    setIsDraftTransaction(false)
    // Refresh machine availability for new transaction
    fetchInitialData()
    // Call onSuccess to refresh dashboard
    onSuccess(completedTransaction)
  }


  // EDIT MODE LOADING SCREEN - FIRST PRIORITY
  if (editMode && existingTransaction && loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-dwash-red mb-6"></div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Memuat Data Transaksi</h3>
          <p className="text-gray-600">Mohon tunggu sebentar...</p>
        </div>
      </div>
    )
  }

  // Show CSRF loading state
  // Only show CSRF loading for new transactions, not edit mode
  if (csrfLoading && !editMode) {
    return (
      <div className="max-w-4xl mx-auto px-1 sm:px-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading security token...</span>
        </div>
      </div>
    )
  }

  // Show CSRF error state  
  if (csrfError) {
    return (
      <div className="max-w-4xl mx-auto px-1 sm:px-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <span className="text-red-600 text-2xl mr-3">🚨</span>
            <div>
              <h3 className="font-semibold text-red-800">Security Error</h3>
              <p className="text-red-700 mt-1">{csrfError}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show Customer Management
  if (showCustomerManagement) {
    return (
      <div className="h-screen bg-gray-50 p-2 sm:p-4 overflow-hidden">
        <div className="w-full mx-auto h-full flex flex-col">
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <button
              onClick={() => setShowCustomerManagement(false)}
              className="flex items-center justify-center w-12 h-12 text-2xl text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              ←
            </button>
            <div className="text-center flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Kelola Pelanggan</h1>
              <p className="text-sm text-gray-600">{user.cabang}</p>
            </div>
            <div className="w-12"></div> {/* Spacer for centering */}
          </div>
          <div className="flex-1">
            <CustomerManagement
              user={user}
              cacheConfig={{ enabled: false, timeout: 0 }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-1 sm:px-6">
{/* Header with Back Button and Save Button */}
<div className="mb-4 sm:mb-6">
  <div className="flex items-center justify-between mb-4">
    <button
      onClick={() => {
        if (onCancel) {
          onCancel()
        } else if (window.history.length > 1) {
          window.history.back()
        }
      }}
      className="flex items-center justify-center w-12 h-12 text-2xl text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
    >
      ←
    </button>
    <div className="text-center flex-1">
      <h1 className="text-lg sm:text-xl font-bold text-gray-900">
        {editMode ? 'Edit Transaksi' : 'Buat Transaksi'}
      </h1>
    </div>
    {/* Save Draft Button - Show only in edit mode */}
    {editMode ? (
      <Button
        onClick={handleSaveDraft}
        disabled={loading || !formData.customer || (step === 2 && (!formData.selectedServices || formData.selectedServices.length === 0))}
        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-2 shadow-sm"
      >
        <svg 
          className="w-4 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" 
          />
        </svg>
        <span className="hidden sm:inline">{loading ? 'Menyimpan...' : 'Draft'}</span>
      </Button>
    ) : (
      step === 1 && (
        <button
          onClick={() => {
            setShowCustomerManagement(true)
          }}
          className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 rounded-lg transition-colors border border-orange-200"
        >
          <span>👥</span>
          <span className="hidden sm:inline">Kelola Pelanggan</span>
        </button>
      )
    )}
  </div>

  {/* Edit Mode Header Info */}
  {editMode && existingTransaction && (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            ✏️ Mode Edit
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-orange-900">
            Mengubah Transaksi: {existingTransaction.kode_transaksi}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-orange-600">
            <span>Pelanggan: {existingTransaction.nama_pelanggan}</span>
            <span>•</span>
            <span>
              {new Date(existingTransaction.tanggal_transaksi).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )}
</div>

{/* Progress Bar - Mobile Optimized */}
<div className="mb-4 sm:mb-6">
  <div className="flex items-center justify-between mb-2">
    <span className="text-xs sm:text-sm font-medium text-dwash-dark">
      Langkah {step} dari 4
    </span>
    <span className="text-xs sm:text-sm text-dwash-gray">
      {step === 1 && (editMode ? 'Info Pelanggan' : 'Pilih Pelanggan')}
      {step === 2 && (editMode ? 'Edit Layanan' : 'Pilih Layanan')}  
      {step === 3 && (editMode ? 'Edit Produk' : 'Produk Tambahan')}
      {step === 4 && (editMode ? 'Update Transaksi' : 'Konfirmasi')}
    </span>
  </div>
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div 
      className="bg-dwash-red h-2 rounded-full transition-all duration-300"
      style={{ width: `${(step / 4) * 100}%` }}
    ></div>
  </div>
</div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div>{error}</div>
          {errorCountdown > 0 && (
            <div className="mt-2">
              <div className="w-full bg-red-200 rounded-full h-1">
                <div 
                  className="bg-red-500 h-1 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(errorCountdown / 5) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      )}

      <Card>
        {/* Step 1: Customer Selection */}
        {step === 1 && (
          <div className="relative">
            {/* Loading overlay for step 1 */}
            {loading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dwash-red mb-2"></div>
                  <span className="text-sm text-gray-600">Memproses...</span>
                </div>
              </div>
            )}
            
            <h3 className="text-lg font-semibold mb-4">
              {editMode ? 'Informasi Pelanggan' : 'Pilih Pelanggan'}
            </h3>
            
            
            {editMode ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center space-x-3 mb-3">
                  <span className="text-2xl">👤</span>
                  <div>
                    <h4 className="font-semibold text-blue-900">Customer yang sudah terpilih</h4>
                    <p className="text-sm text-blue-600">Data customer tidak bisa diubah saat edit transaksi</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-blue-600">Nama:</span>
                    <span className="font-medium text-blue-900">
                      {formData.customer?.nama_pelanggan || existingTransaction?.nama_pelanggan || 'Loading...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-blue-600">Telepon:</span>
                    <span className="font-medium text-blue-900">
                      {formData.customer?.nomor_telepon || existingTransaction?.nomor_telepon || 'Tidak ada nomor telepon'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button onClick={() => setStep(2)}>
                    Lanjut ke Layanan →
                  </Button>
                </div>
              </div>
            ) : !showCustomerForm ? (
              <div className="space-y-4">
                <Input
                  label="Cari Pelanggan"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value)
                    // Clear error when user starts searching for another customer
                    if (error) {
                      setError('')
                      setErrorCountdown(0)
                    }
                  }}
                  placeholder="Nama atau nomor telepon..."
                  type="text"
                />

                {customerSearch && (
                  <div className="max-h-80 overflow-y-auto border rounded-lg">
                    {searchLoading ? (
                      <div className="p-3 text-center text-dwash-gray">
                        <div className="flex items-center justify-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-dwash-red"></div>
                          <span>Mencari...</span>
                        </div>
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map(customer => {
                        return (
                          <button
                            key={`customer-${customer.id_pelanggan || customer.id}`}
                            onClick={async () => {
                              await handleCustomerSelection(customer)
                              setCustomerSearch('')
                              setSearchResults([])
                            }}
                            disabled={loading}
                            className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate mb-1">
                                  {customer.nama_pelanggan}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {customer.nomor_telepon ? formatPhoneDisplay(customer.nomor_telepon) : 'Tidak ada nomor telepon'}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-3">
                                <span className="text-xs text-gray-600 whitespace-nowrap">
                                  🏆 {customer.loyalty_points || 0}
                                </span>
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          </button>
                        )
                      })
                    ) : customerSearch.length > 0 ? (
                      <div className="p-3 text-center text-dwash-gray">
                        Pelanggan tidak ditemukan
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowCustomerForm(true)}
                    className="w-full text-xs sm:text-sm px-2 sm:px-4"
                  >
                    + Tambah Pelanggan Baru
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
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
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
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
                </div>
                <Input
                  label="Nomor Telepon"
                  value={newCustomer.nomor_telepon}
                  onChange={(e) => {
                    // Remove non-digits
                    let value = e.target.value.replace(/\D/g, '')

                    // Limit max 15 digits (international phone standard)
                    if (value.length > 15) {
                      value = value.slice(0, 15)
                    }

                    // Format based on first digits
                    let formatted = value
                    if (value.startsWith('62')) {
                      // International: 62-812-3456-7890 (2-3-4-rest)
                      if (value.length > 2 && value.length <= 5) {
                        formatted = value.slice(0, 2) + '-' + value.slice(2)
                      } else if (value.length > 5 && value.length <= 9) {
                        formatted = value.slice(0, 2) + '-' + value.slice(2, 5) + '-' + value.slice(5)
                      } else if (value.length > 9) {
                        formatted = value.slice(0, 2) + '-' + value.slice(2, 5) + '-' + value.slice(5, 9) + '-' + value.slice(9)
                      }
                    } else if (value.startsWith('0')) {
                      // Local: 0812-3456-7890 (4-4-rest)
                      if (value.length > 4 && value.length <= 8) {
                        formatted = value.slice(0, 4) + '-' + value.slice(4)
                      } else if (value.length > 8) {
                        formatted = value.slice(0, 4) + '-' + value.slice(4, 8) + '-' + value.slice(8)
                      }
                    }

                    setNewCustomer(prev => ({ ...prev, nomor_telepon: formatted }))
                  }}
                  placeholder="0812-3456-7890"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9-]*"
                />

                <div className="flex gap-3">
                  <Button 
                    onClick={handleCreateCustomer} 
                    disabled={!newCustomer.nama_pelanggan}
                    className="flex-1 text-xs sm:text-sm px-2 sm:px-4"
                  >
                    Simpan & Lanjut
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCustomerForm(false)}
                    className="flex-1 text-xs sm:text-sm px-2 sm:px-4"
                  >
                    Batal
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Service Selection */}
        {step === 2 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Pilih Layanan</h3>
            
            {/* Free Laundry Offer - Mobile Optimized */}
            {showFreeLaundryOffer && loyaltyData && 
             !formData.selectedServices.some(s => s.isFree === true || (s.freeCount !== undefined && s.freeCount > 0)) && (
              <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 rounded-xl p-3 sm:p-4 mb-6 animate-pulse">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start sm:items-center space-x-3">
                    <span className="text-xl sm:text-2xl flex-shrink-0">🎉</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-green-800 font-bold text-sm sm:text-base leading-tight">
                        Selamat! Anda punya {loyaltyData.loyalty.remaining_free_washes} cuci gratis!
                      </p>
                      <p className="text-green-600 text-xs sm:text-sm mt-1">
                        Hemat Rp 10.000 untuk layanan cuci
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2">
                    <Button 
                      onClick={handleApplyFreeLaundry}
                      className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all text-xs sm:text-sm w-full sm:w-auto"
                    >
                      ✨ Pakai Sekarang
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleDismissFreeLaundry}
                      className="text-green-600 border-green-300 px-3 sm:px-4 py-2 rounded-lg hover:bg-green-50 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      Nanti Aja
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Loyalty Applied Notification - Mobile Optimized */}
            {formData.selectedServices.some(s => 
              s.nama_layanan && s.nama_layanan.toLowerCase().includes('cuci') && 
              (s.isFree === true || (s.freeCount !== undefined && s.freeCount > 0))
            ) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center space-x-2 flex-1">
                    <span className="text-base sm:text-lg flex-shrink-0 mt-0.5 sm:mt-0">✅</span>
                    <p className="text-blue-800 font-medium text-sm sm:text-base leading-tight sm:leading-normal">
                      Cuci gratis telah diterapkan! Layanan &quot;Cuci&quot; akan gratis.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      // Remove free flags from all cuci services (handle both formats)
                      setFormData(prev => ({
                        ...prev,
                        selectedServices: prev.selectedServices.map(s => {
                          if (s.nama_layanan && s.nama_layanan.toLowerCase().includes('cuci')) {
                            // Clean up all loyalty-related properties
                            const cleanService = { ...s }
                            
                            // Handle freeCount/paidCount format (from apply or loaded)
                            if (s.freeCount !== undefined || s.paidCount !== undefined) {
                              const totalQuantity = (s.freeCount || 0) + (s.paidCount || 0)
                              cleanService.quantity = totalQuantity
                            }
                            
                            // Remove all loyalty flags
                            delete cleanService.freeCount
                            delete cleanService.paidCount
                            delete cleanService.loyaltyFreeCount
                            cleanService.isFree = false
                            
                            return cleanService
                          }
                          return s
                        })
                      }))
                      // Reset loyalty state
                      setIsUsingFreeLaundry(false)
                      
                      // Force immediate update by using timeout
                      setTimeout(() => {
                        // Show the offer again if customer still has free washes
                        if (loyaltyData && loyaltyData.loyalty && loyaltyData.loyalty.remaining_free_washes > 0) {
                          setShowFreeLaundryOffer(true)
                        }
                      }, 10)
                    }}
                    className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors flex-shrink-0"
                  >
                    ❌ Batalkan
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {services.map(service => {
                // Check machine availability for this service
                const serviceName = service.nama_layanan.toLowerCase()
                const isCKL = serviceName.includes('ckl') || service.id === 4
                const serviceRequiresMachine = serviceName.includes('cuci') ||
                                              serviceName.includes('bilas') ||
                                              serviceName.includes('pengering') ||
                                              serviceName.includes('kering') ||
                                              isCKL
                let machineType = null
                let availability = null
                let isAvailable = true

                if (serviceRequiresMachine) {
                  // CKL butuh 2 mesin: cuci + pengering
                  if (isCKL) {
                    const cuciAvail = machineAvailability['cuci']
                    const pengeringAvail = machineAvailability['pengering']

                    // CKL availability = minimum dari cuci dan pengering
                    const minAvailable = Math.min(
                      cuciAvail?.available || 0,
                      pengeringAvail?.available || 0
                    )
                    const minTotal = Math.min(
                      cuciAvail?.total || 0,
                      pengeringAvail?.total || 0
                    )

                    availability = { available: minAvailable, total: minTotal }
                    isAvailable = minAvailable > 0
                  } else {
                    // Determine machine type based on service name
                    machineType = 'cuci' // default for 'Cuci' and 'Bilas'
                    if (serviceName.includes('kering')) {
                      machineType = 'pengering' // 'Kering' uses pengering machines
                    }

                    availability = machineAvailability[machineType]
                    // In edit mode, check against total machines, not just available
                    if (editMode) {
                      isAvailable = availability ? availability.available > 0 : true
                    } else {
                      isAvailable = availability ? availability.available > 0 : true
                    }
                  }
                }
                
                const selectedService = formData.selectedServices.find(s => s.id === service.id)
                const isSelected = !!selectedService
                const currentQuantity = selectedService?.quantity || 0
                const isFreeService = selectedService?.isFree === true && (selectedService?.paidCount === undefined || selectedService?.paidCount === 0)
                const hasFreeComponent = selectedService?.freeCount > 0 || selectedService?.loyaltyFreeCount > 0 // For mixed pricing or auto-applied loyalty
                
                return (
                  <div 
                    key={`service-option-${service.id_jenis_layanan || service.id}`}
                    className={`p-4 border rounded-lg transition ${
                      !isAvailable 
                        ? 'border-gray-200 bg-gray-50 opacity-60'
                        : isSelected
                          ? (isFreeService || hasFreeComponent)
                            ? 'border-green-400 bg-green-50'
                            : 'border-dwash-red bg-red-50'
                          : 'border-gray-300 hover:border-dwash-red'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium">{service.nama_layanan}</h4>
                          {serviceRequiresMachine && availability && (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              isAvailable 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {isAvailable 
                                ? `${availability.available}/${availability.total} tersedia`
                                : 'Penuh'
                              }
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-dwash-gray">
                          Durasi: {service.durasi_menit} menit
                        </p>
                        {service.deskripsi && (
                          <p className="text-xs text-dwash-gray mt-1">{service.deskripsi}</p>
                        )}
                        {!isAvailable && (
                          <p className="text-xs text-red-500 mt-1">
                            ⚠️ Semua mesin {machineType} sedang digunakan
                          </p>
                        )}
                      </div>
                      <div className="text-right space-y-2">
                        <div className={`font-bold ${
                          !isAvailable 
                            ? 'text-gray-400'
                            : isFreeService
                              ? 'text-green-600'
                              : 'text-dwash-red'
                        }`}>
                          {isFreeService ? (
                            <>
                              {/* Calculate how many are free vs paid */}
                              {(() => {
                                const freeCount = Math.min(currentQuantity, loyaltyData?.loyalty?.remaining_free_washes || 0)
                                const paidCount = currentQuantity - freeCount
                                
                                return (
                                  <div className="text-right">
                                    {freeCount > 0 && (
                                      <div className="text-green-600 font-bold text-sm">
                                        {freeCount}x GRATIS
                                      </div>
                                    )}
                                    {paidCount > 0 && (
                                      <div className="text-dwash-red text-sm">
                                        {paidCount}x {formatCurrency(service.harga)}
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </>
                          ) : (
                            <>
                              {/* Check if this is a loaded transaction with mixed pricing */}
                              {selectedService?.freeCount !== undefined && selectedService?.paidCount !== undefined ? (
                                <div className="text-right">
                                  {selectedService.freeCount > 0 && (
                                    <div className="text-green-600 font-bold text-sm">
                                      {selectedService.freeCount}x GRATIS
                                    </div>
                                  )}
                                  {selectedService.paidCount > 0 && (
                                    <div className="text-dwash-red text-sm">
                                      {selectedService.paidCount}x {formatCurrency(service.harga)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <>
                                  {formatCurrency(service.harga)}
                                  {currentQuantity > 1 && (
                                    <div className="text-xs text-gray-600 font-normal">
                                      x{currentQuantity} = {formatCurrency(service.harga * currentQuantity)}
                                    </div>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                        
                        {/* Quantity Controls */}
                        {isAvailable && (
                          <div className="space-y-2">
                            {/* Regular quantity controls */}
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleServiceQuantityChange(service.id, -1)
                                }}
                                className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-semibold hover:bg-gray-300 disabled:opacity-50"
                                disabled={currentQuantity === 0}
                              >
                                −
                              </button>
                              <span className="w-8 text-center font-semibold text-sm">
                                {currentQuantity}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (currentQuantity === 0) {
                                    // Add service first
                                    handleServiceToggle(service)
                                  } else {
                                    // Increase quantity
                                    handleServiceQuantityChange(service.id, 1)
                                  }
                                }}
                                className="w-7 h-7 bg-dwash-red text-white rounded-full flex items-center justify-center font-semibold hover:bg-red-600 disabled:opacity-50"
                                disabled={!isAvailable || (serviceRequiresMachine && availability && currentQuantity >= availability.available)}
                            >
                              +
                            </button>
                            </div>
                            
                          </div>
                        )}
                        
                        {/* Service not available message */}
                        {!isAvailable && (
                          <div className="text-xs text-gray-400 text-center">
                            Tidak tersedia
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-3 sm:justify-between mt-6">
              <Button 
                variant="outline" 
                onClick={resetCustomerAndLoyalty}
                className="flex-1 sm:w-auto text-xs sm:text-sm px-2 sm:px-4"
              >
                ← Kembali
              </Button>
              <Button 
                onClick={() => setStep(3)}
                className="flex-1 sm:w-auto text-xs sm:text-sm px-2 sm:px-4"
              >
                Lanjut →
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Product Selection - Mobile Optimized */}
        {step === 3 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Produk Tambahan (Opsional)</h3>
            <div className="space-y-3">
              {products.map(product => {
                const selectedProduct = formData.selectedProducts.find(p =>
                  (p.id != null && product.id != null && p.id === product.id) ||
                  (p.id_produk != null && product.id_produk != null && p.id_produk === product.id_produk)
                )
                const isSelected = !!selectedProduct && selectedProduct.quantity > 0
                // Check if there are washing services (Cuci OR CKL) to qualify for free products
                const hasWashingServices = formData.selectedServices && formData.selectedServices.some(service =>
                  service.nama_layanan === 'Cuci' || service.id === 1 ||
                  service.nama_layanan?.includes('CKL') || service.id === 4
                )
                // HARDCODED: Product is free if it has isFree flag AND there are washing services
                const isFreeProduct = selectedProduct?.isFree === true && hasWashingServices
                
                
                
                return (
                <div 
                  key={`product-option-${product.id_produk || product.id}`} 
                  className={`p-3 sm:p-4 border rounded-lg transition ${
                    isSelected
                      ? isFreeProduct 
                        ? 'border-green-400 bg-green-50' 
                        : 'border-dwash-red bg-red-50'
                      : 'border-gray-300 hover:border-dwash-red'
                  }`}
                >
                  {/* Mobile Layout - Stack Vertically */}
                  <div className="space-y-3 sm:space-y-0 sm:flex sm:justify-between sm:items-center">
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm sm:text-base truncate">{product.nama_produk}</h4>
                        {isFreeProduct && (
                          <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                            GRATIS
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <p className="text-xs sm:text-sm text-dwash-gray">
                          Stok: {product.stok_tersedia} {product.satuan}
                        </p>
                        <span className="text-xs text-gray-400">•</span>
                        <p className="text-xs sm:text-sm text-dwash-gray capitalize">
                          {product.kategori_produk}
                        </p>
                      </div>
                    </div>
                    
                    {/* Price and Quantity Control - Mobile Responsive */}
                    <div className="flex items-center justify-between sm:justify-end sm:space-x-4">
                      {/* Price */}
                      <div className={`font-bold text-sm sm:text-base ${
                        isFreeProduct 
                          ? 'text-green-600' 
                          : 'text-dwash-red'
                      }`}>
                        {isFreeProduct ? (
                          <>
                            {/* Calculate how many are free vs paid */}
                            {(() => {
                              const currentQuantity = selectedProduct?.quantity || 0
                              const freeCount = selectedProduct?.freeQuantity || 0
                              const paidCount = currentQuantity - freeCount
                              
                              return (
                                <div className="text-right">
                                  {freeCount > 0 && (
                                    <div className="text-green-600 font-bold text-sm">
                                      {freeCount}x GRATIS
                                    </div>
                                  )}
                                  {paidCount > 0 && (
                                    <div className="text-dwash-red text-sm">
                                      {paidCount}x {formatCurrency(product.harga)}
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                          </>
                        ) : (
                          formatCurrency(product.harga)
                        )}
                      </div>
                      
                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <button
                          onClick={() => {
                            const current = selectedProduct?.quantity || 0
                            handleProductQuantityChange(product, Math.max(0, current - 1))
                          }}
                          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-semibold ${
                            (product.stok_tersedia === 0 || (isFreeProduct && selectedProduct?.quantity <= selectedProduct?.freeQuantity))
                              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                          disabled={product.stok_tersedia === 0 || (isFreeProduct && selectedProduct?.quantity <= selectedProduct?.freeQuantity)}
                        >
                          −
                        </button>
                        <span className="w-8 sm:w-10 text-center font-semibold text-sm sm:text-base">
                          {selectedProduct?.quantity || 0}
                        </span>
                        <button
                          onClick={() => {
                            const current = selectedProduct?.quantity || 0
                            handleProductQuantityChange(product, current + 1)
                          }}
                          className="w-8 h-8 sm:w-9 sm:h-9 bg-dwash-red text-white rounded-full flex items-center justify-center font-semibold hover:bg-red-600 disabled:bg-gray-300"
                          disabled={product.stok_tersedia === 0}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Out of Stock Warning */}
                  {product.stok_tersedia === 0 && (
                    <div className="mt-2 text-xs text-red-500 bg-red-50 px-2 py-1 rounded">
                      Stok habis
                    </div>
                  )}
                  
                  {/* Free Product Info */}
                  {isFreeProduct && (
                    <div className="mt-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                      ✨ {selectedProduct.freeReason}
                      {selectedProduct.freeQuantity && selectedProduct.quantity > selectedProduct.freeQuantity && (
                        <span className="ml-2 text-gray-600">
                          ({selectedProduct.freeQuantity} gratis + {selectedProduct.quantity - selectedProduct.freeQuantity} bayar)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                )
              })}
              
              {/* Empty State */}
              {products.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📦</div>
                  <p className="text-sm">Tidak ada produk tersedia</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 sm:justify-between mt-6">
              <Button 
                variant="outline" 
                onClick={() => setStep(2)}
                className="flex-1 sm:w-auto text-xs sm:text-sm px-2 sm:px-4"
              >
                ← Kembali
              </Button>
              <Button 
                onClick={() => setStep(4)}
                className="flex-1 sm:w-auto text-xs sm:text-sm px-2 sm:px-4"
              >
                Lanjut →
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Payment & Confirmation */}
        {step === 4 && (
        <div>
            <h3 className="text-lg font-semibold mb-4">Konfirmasi & Pembayaran</h3>
            
            {/* Order Summary - Mobile Optimized */}
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-6">
            <h4 className="font-medium mb-3 text-sm sm:text-base">Ringkasan Pesanan</h4>
            
            {/* Loading state indicator */}
            {loading && (
              <div className="flex items-center justify-center py-4 mb-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-dwash-red mr-3"></div>
                <span className="text-sm text-gray-600">Memuat data transaksi...</span>
              </div>
            )}
            
            {/* Customer & Branch Info */}
            <div className="space-y-1 sm:space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                <span className="font-medium">Pelanggan:</span>
                <span className="truncate ml-2">{formData.customer?.nama_pelanggan}</span>
                </div>
                <div className="flex justify-between">
                <span className="font-medium">Cabang:</span>
                <span className="truncate ml-2">{user.cabang}</span>
                </div>
                <div className="flex justify-between">
                <span className="font-medium">Shift:</span>
                <span className="capitalize">{(() => {
                  // console.log('🔍 [TransactionForm UI] Final display:', user.current_shift || user.shift || 'Fleksibel')
                  return user.current_shift || user.shift || 'Fleksibel'
                })()}</span>
                </div>
            </div>

            {/* Services - Mobile Layout */}
            {formData.selectedServices.length > 0 && (
                <div className="mb-3">
                <div className="flex justify-between items-center mb-2">
                  <h5 className="font-medium text-sm">Layanan:</h5>
                  <button 
                    onClick={() => setStep(2)}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Ubah quantity
                  </button>
                </div>
                <div className="space-y-1">
                    {formData.selectedServices.map((service, index) => {
                      const isModified = isServiceModified(service)
                      return (
                        <div key={`service-${service.id || service.id_jenis_layanan}-${index}`} className={`flex justify-between items-center text-sm p-2 rounded ${
                          isModified ? 'bg-yellow-50 border border-yellow-200' : ''
                        }`}>
                          <span className="truncate pr-2 flex items-center">
                            {isModified && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded mr-2 font-medium">
                                ✏️ DIUBAH
                              </span>
                            )}
                            {service.nama_layanan} 
                            {(service.quantity || 1) > 1 && (
                              <span className="text-xs text-gray-500 ml-1">x{service.quantity || 1}</span>
                            )}
                          </span>
                          <span className="font-medium whitespace-nowrap">
                            {(() => {
                              // Check if service has pre-calculated free/paid counts (from loaded transaction)
                              if (service.freeCount !== undefined && service.paidCount !== undefined) {
                                const totalCharge = service.harga * service.paidCount
                                
                                if (service.paidCount > 0) {
                                  return (
                                    <div className="text-right">
                                      <span className="text-dwash-red">{formatCurrency(totalCharge)}</span>
                                      {service.freeCount > 0 && (
                                        <div className="text-xs text-gray-500">
                                          ({service.freeCount} gratis, {service.paidCount} bayar)
                                        </div>
                                      )}
                                    </div>
                                  )
                                } else {
                                  return <span className="text-green-600 font-semibold">GRATIS</span>
                                }
                              }
                              
                              // Use original loyalty logic for new transactions
                              if (isUsingFreeLaundry && service.nama_layanan && 
                                 service.nama_layanan.toLowerCase().includes('cuci')) {
                                const quantity = service.quantity || 1
                                const freeCount = Math.min(quantity, loyaltyData?.loyalty?.remaining_free_washes || 0)
                                const paidCount = quantity - freeCount
                                const totalCharge = service.harga * paidCount
                                
                                if (paidCount > 0) {
                                  return (
                                    <div className="text-right">
                                      <span className="text-dwash-red">{formatCurrency(totalCharge)}</span>
                                      <div className="text-xs text-gray-500">
                                        ({freeCount} gratis, {paidCount} bayar)
                                      </div>
                                    </div>
                                  )
                                } else {
                                  return <span className="text-green-600 font-semibold">GRATIS</span>
                                }
                              }

                              // Regular service pricing
                              return <span className="text-dwash-red">{formatCurrency(service.harga * (service.quantity || 1))}</span>
                            })()}
                          </span>
                        </div>
                      )
                    })}
                </div>
                </div>
            )}
            {/* Products - Mobile Layout */}
            {formData.selectedProducts.length > 0 && (
                <div className="mb-3">
                <div className="flex justify-between items-center mb-2">
                  <h5 className="font-medium text-sm">Produk:</h5>
                  <button 
                    onClick={() => setStep(3)}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Ubah quantity
                  </button>
                </div>
                <div className="space-y-1">
                    {formData.selectedProducts.map((product, index) => (
                    <div key={`product-${product.id || product.id_produk || index}`} className="flex justify-between text-sm p-2 rounded">
                        <span className="truncate pr-2">
                        {product.nama_produk} x{product.quantity}
                        </span>
                        <span className="font-medium whitespace-nowrap">
                        {product.isFree && product.freeQuantity && formData.selectedServices && formData.selectedServices.some(service =>
                          service.nama_layanan === 'Cuci' || service.id === 1 ||
                          service.nama_layanan?.includes('CKL') || service.id === 4
                        ) ? (
                          // Free product: calculate paid quantity
                          (() => {
                            const paidQty = product.paidQuantity || Math.max(0, product.quantity - product.freeQuantity)
                            const charge = product.harga * paidQty
                            return (
                              <div className="text-right">
                                {paidQty > 0 ? (
                                  <span className="text-dwash-red">{formatCurrency(charge)}</span>
                                ) : (
                                  <span className="text-green-600 font-semibold">GRATIS</span>
                                )}
                                {product.freeQuantity > 0 && paidQty > 0 && (
                                  <div className="text-xs text-gray-500">
                                    ({product.freeQuantity} gratis, {paidQty} bayar)
                                  </div>
                                )}
                              </div>
                            )
                          })()
                        ) : (
                          <span className="text-dwash-red">{formatCurrency(product.harga * product.quantity)}</span>
                        )}
                        </span>
                    </div>
                    ))}
                </div>
                </div>
            )}

            {/* Changes Summary for Edit Mode */}
            {editMode && formData.selectedServices.some(service => isServiceModified(service)) && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-orange-600">⚠️</span>
                  <h6 className="font-medium text-orange-800 text-sm">Ringkasan Perubahan</h6>
                </div>
                <div className="text-xs text-orange-700 space-y-1">
                  {formData.selectedServices.filter(service => isServiceModified(service)).map((service, index) => (
                    <div key={`change-${service.id}-${index}`}>
                      • {service.nama_layanan}: quantity diubah menjadi {service.quantity || 1}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Total - Prominent */}
            <div className="border-t pt-3 mt-3">
                <div className="flex justify-between items-center">
                <span className="font-bold text-lg">Total:</span>
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-dwash-red"></div>
                    <span className="text-gray-500">Menghitung...</span>
                  </div>
                ) : (
                  <span className="font-bold text-xl text-dwash-red">
                      {formatCurrency(calculateTotal())}
                  </span>
                )}
                </div>
            </div>
            </div>


            {/* Notes - Mobile Optimized */}
            <div className="mb-6">
            <label className="block text-sm font-medium text-dwash-dark mb-2">
                Catatan (Opsional)
            </label>
            <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-dwash-red focus:border-transparent outline-none"
                rows="3"
                placeholder="Catatan tambahan..."
            />
            </div>

            {/* Action Buttons - Mobile Stack */}
            <div className="space-y-3">
            <div className="flex gap-3 sm:justify-between">
                <Button 
                variant="outline" 
                onClick={() => setStep(3)}
                className="flex-1 sm:w-auto text-xs sm:text-sm px-2 sm:px-4"
                >
                ← Kembali
                </Button>
                <Button 
                onClick={onCancel}
                className="flex-1 sm:w-auto bg-dwash-red hover:bg-red-600 text-white text-xs sm:text-sm px-2 sm:px-4"
                >
                ✕ Batal
                </Button>
            </div>
            
            {/* Payment Section */}
            {editMode ? (
              /* Edit Mode - Show payment options */
              <div className="space-y-3">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-blue-600">ℹ️</span>
                    <h4 className="font-semibold text-blue-800 text-sm">Pilihan Update Transaksi</h4>
                  </div>
                  <p className="text-xs text-blue-600">
                    Pilih cara menyelesaikan edit transaksi: langsung bayar atau simpan untuk dibayar nanti
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={() => handleDirectPayment('tunai')}
                    disabled={loading || (!formData.selectedServices?.length && !formData.selectedProducts?.length)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm px-2 sm:px-4 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Memproses...</span>
                      </div>
                    ) : '💰 Update & Bayar Tunai'}
                  </Button>
                  
                  <Button 
                    onClick={() => handleDirectPayment('qris')}
                    disabled={loading || (!formData.selectedServices?.length && !formData.selectedProducts?.length)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm px-2 sm:px-4 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Memproses...</span>
                      </div>
                    ) : '📱 Update & Bayar QRIS'}
                  </Button>
                </div>
                
                <Button 
                  onClick={handleUpdateDraft}
                  disabled={loading}
                  variant="outline"
                  className="w-full bg-orange-50 text-orange-600 border-orange-300 hover:bg-orange-100 text-xs sm:text-sm px-2 sm:px-4"
                >
                  {loading ? 'Menyimpan...' : '📝 Simpan Perubahan (Customer Bayar Nanti)'}
                </Button>
              </div>
            ) : (
              /* New Transaction Mode - Payment Options */
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={() => handleDirectPayment('tunai')}
                    disabled={loading || (!formData.selectedServices?.length && !formData.selectedProducts?.length)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm px-2 sm:px-4 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Memproses...</span>
                      </div>
                    ) : '💰 Bayar Tunai'}
                  </Button>
                  
                  <Button 
                    onClick={() => handleDirectPayment('qris')}
                    disabled={loading || (!formData.selectedServices?.length && !formData.selectedProducts?.length)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm px-2 sm:px-4 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Memproses...</span>
                      </div>
                    ) : '📱 Bayar QRIS'}
                  </Button>
                </div>

                <div className="text-center text-gray-400 text-xs">atau</div>
                
                <Button 
                  onClick={handleSaveDraft}
                  disabled={loading}
                  variant="outline"
                  className="w-full bg-orange-50 text-orange-600 border-orange-300 hover:bg-orange-100 text-xs sm:text-sm px-2 sm:px-4"
                >
                  {loading ? 'Menyimpan...' : '📝 Simpan Transaksi (Customer Bayar Nanti)'}
                </Button>
              </div>
            )}
            </div>
        </div>
        )}
      </Card>

      {/* Success Modal */}
      <Modal 
        isOpen={showSuccessModal} 
        onClose={handleSuccessClose}
        title={isDraftTransaction ? "Draft Tersimpan" : "Transaksi Selesai"}
        size="md"
      >
        <TransactionReceipt 
          transaction={completedTransaction}
          onClose={handleSuccessClose}
          onPrint={() => {
            // Thermal printing is handled within TransactionReceipt component
          }}
          isDraft={isDraftTransaction}
          services={formData.selectedServices}
          products={formData.selectedProducts.map(product => {
            // Check if product is actually free based on calculation AND washing services
            const unitPrice = parseFloat(product.harga || 0)
            const quantity = parseInt(product.quantity || 1)
            const totalCharge = unitPrice * quantity
            const hasWashingServices = formData.selectedServices && formData.selectedServices.some(service =>
              service.nama_layanan === 'Cuci' || service.id === 1 ||
              service.nama_layanan?.includes('CKL') || service.id === 4
            )
            const isActuallyFree = (totalCharge === 0 && hasWashingServices) ||
                                   (product.isFree && product.freeQuantity > 0 && hasWashingServices)

            // Calculate proper paid/free quantities
            const freeQuantity = isActuallyFree ? (product.freeQuantity || quantity) : 0
            const paidQuantity = Math.max(0, quantity - freeQuantity)
            const subtotal = unitPrice * paidQuantity

            return {
              ...product,
              // Map database fields properly for TransactionReceipt
              id_produk: product.id_produk || product.id,
              nama_produk: product.nama_produk || product.nama,
              harga_satuan: unitPrice,
              quantity: quantity,
              subtotal: subtotal,
              satuan: product.satuan || 'pcs',
              // Keep legitimate free product metadata, clean the rest
              isFree: isActuallyFree ? true : undefined,
              freeQuantity: freeQuantity > 0 ? freeQuantity : undefined,
              paidQuantity: paidQuantity,
              freeReason: undefined
            }
          })}
          loyaltyData={loyaltyData}
        />
      </Modal>

      {/* Payment Confirmation Modal */}
      <Modal 
        isOpen={paymentConfirmation.show} 
        onClose={() => setPaymentConfirmation({ show: false, method: '', transactionData: null })}
        title="Konfirmasi Pembayaran"
        size="md"
      >
        {paymentConfirmation.transactionData && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">💳</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  {editMode ? 'Konfirmasi Pembayaran Edit Transaksi' : 'Konfirmasi Pembayaran'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Pastikan pembayaran sudah diterima sebelum konfirmasi
                </p>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Pelanggan:</span>
                  <span className="text-sm font-medium">{paymentConfirmation.transactionData.customer.nama_pelanggan}</span>
                </div>
                {paymentConfirmation.transactionData.customer.nomor_telepon && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">No WA:</span>
                    <span className="text-sm text-gray-600">{paymentConfirmation.transactionData.customer.nomor_telepon}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Metode Pembayaran:</span>
                  <span className="text-sm font-medium text-blue-600">
                    {paymentConfirmation.method === 'tunai' ? '💰 TUNAI' : '📱 QRIS'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Layanan ({paymentConfirmation.transactionData.services.length}):</span>
                  <div className="text-right">
                    {paymentConfirmation.transactionData.services.map((service, index) => (
                      <div key={`service-${index}`} className="text-xs text-gray-600">
                        {service.nama_layanan} x{service.quantity || 1} - {formatCurrency((service.harga || service.harga_layanan || 0) * (service.quantity || 1))}
                      </div>
                    ))}
                  </div>
                </div>
                {paymentConfirmation.transactionData.products.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Produk ({paymentConfirmation.transactionData.products.length}):</span>
                    <div className="text-right">
                      {paymentConfirmation.transactionData.products.map((product, index) => (
                        <div key={`product-${index}`} className="text-xs text-gray-600">
                          {product.nama_produk} x{product.quantity} - {formatCurrency((product.harga || product.harga_produk || 0) * product.quantity)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="font-medium text-gray-900">Total:</span>
                  <span className="font-bold text-lg text-green-600">
                    {formatCurrency(paymentConfirmation.transactionData.total)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <span className="text-yellow-600 mt-0.5">⚠️</span>
                <div className="text-sm text-yellow-800">
                  <strong>Perhatian:</strong> Pastikan pembayaran sudah benar-benar diterima. 
                  Setelah dikonfirmasi, transaksi akan langsung selesai dan tidak dapat dibatalkan.
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setPaymentConfirmation({ show: false, method: '', transactionData: null })}
                className="flex-1 text-xs sm:text-sm px-2 sm:px-4"
              >
                ✕ Batal
              </Button>
              <Button
                onClick={handleConfirmDirectPayment}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs sm:text-sm px-2 sm:px-4"
                disabled={loading}
              >
                {loading ? 'Memproses...' : '✓ Bayar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Error Modal */}
      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title={errorModalData.title}
        size="md"
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-3xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {errorModalData.title}
            </h2>
            <div className="text-gray-600 px-4">
              {(errorModalData.message.includes('sudah terdaftar') || errorModalData.message.includes('sudah digunakan')) ? (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="text-sm text-orange-800">
                    {errorModalData.message}
                  </div>
                </div>
              ) : (
                <p>{errorModalData.message}</p>
              )}
            </div>
          </div>
          
          <div className="flex justify-center pt-4">
            <Button 
              onClick={() => setShowErrorModal(false)}
              className="bg-red-500 hover:bg-red-600 text-white px-8"
            >
              ✓ Mengerti
            </Button>
          </div>
        </div>
      </Modal>

      {/* Payment Method Selection Modal - DISABLED for direct payment flow */}
      {false && (
        <PaymentMethodModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSelectPayment={handlePaymentMethodSelect}
          loading={loading}
        />
      )}

      {/* Loyalty Achievement Modal */}
      <Modal
        isOpen={loyaltyModal.show}
        onClose={() => {
          setLoyaltyModal({ show: false, customer: '', pointsEarned: 0, totalPoints: 0, totalCuci: 0, message: '' })
          setShowSuccessModal(true)
        }}
        title=""
        size="md"
      >
        <div className="text-center space-y-6">
          {/* Header Celebration */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-200 via-green-200 to-blue-200 rounded-xl opacity-20"></div>
            <div className="relative py-6">
              <div className="text-6xl animate-bounce mb-2">🎉</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">Selamat!</h2>
              <p className="text-lg text-gray-600">
                <span className="font-semibold text-green-600">{loyaltyModal.customer}</span> mendapat
              </p>
              <div className="text-4xl font-bold text-green-500 animate-pulse mt-2">
                +{loyaltyModal.pointsEarned} Point{loyaltyModal.pointsEarned > 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{loyaltyModal.totalCuci}</div>
              <div className="text-sm text-blue-800 font-medium">Total Cuci</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{loyaltyModal.availablePoints}</div>
              <div className="text-sm text-green-800 font-medium">Total Point</div>
            </div>
          </div>

          {/* Progress to Next Free Wash - Matching page.js design */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 shadow-inner">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center space-x-2">
                <span className="text-lg font-semibold text-gray-700">Progress ke cuci gratis</span>
                {(10 - (loyaltyModal.totalCuci % 10)) <= 3 && (
                  <span className="animate-bounce text-xl">🎯</span>
                )}
              </div>
              <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold text-sm">
                {loyaltyModal.totalCuci % 10}/10
              </span>
            </div>

            <div className="relative w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-red-500 via-red-600 to-red-700 h-4 rounded-full transition-all duration-1000 ease-out relative"
                style={{ width: `${((loyaltyModal.totalCuci % 10) / 10) * 100}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                {(loyaltyModal.totalCuci % 10) >= 8 && (
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 animate-ping"></div>
                )}
              </div>

              {/* Progress milestones */}
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className={`absolute top-0 bottom-0 w-0.5 ${i < (loyaltyModal.totalCuci % 10) ? 'bg-white/50' : 'bg-gray-400/50'}`}
                  style={{ left: `${((i + 1) / 10) * 100}%` }}
                ></div>
              ))}
            </div>

            <div className="mt-3 text-center">
              {(10 - (loyaltyModal.totalCuci % 10)) === 1 ? (
                <p className="text-green-600 font-bold text-sm animate-pulse">
                  🎉 1 CUCI LAGI DAPAT GRATIS! 🎉
                </p>
              ) : (10 - (loyaltyModal.totalCuci % 10)) <= 3 ? (
                <p className="text-orange-600 font-semibold text-sm">
                  🔥 Tinggal {10 - (loyaltyModal.totalCuci % 10)} lagi dapat cuci gratis!
                </p>
              ) : (
                <p className="text-gray-600 text-sm">
                  Cuci {10 - (loyaltyModal.totalCuci % 10)} kali lagi untuk dapat cuci gratis
                </p>
              )}
            </div>
          </div>

          {/* Benefits Reminder */}
          {/* <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <span className="text-xl">💰</span>
              <span className="font-semibold text-yellow-800">Cara Pakai Points</span>
            </div>
            <div className="text-sm text-yellow-700 space-y-1">
              <p>• 1 point = 1 cuci gratis (Rp 10.000)</p>
              <p>• Hemat lebih banyak dengan cuci rutin!</p>
            </div>
          </div> */}

          <Button
            onClick={() => {
              setLoyaltyModal({ show: false, customer: '', pointsEarned: 0, totalPoints: 0, totalCuci: 0, message: '' })
              setShowSuccessModal(true)
            }}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-3 w-full text-lg font-semibold rounded-xl shadow-lg transform transition-all duration-200 hover:scale-105"
          >
            <span className="flex items-center justify-center space-x-2">
              <span>✓</span>
              <span>Lanjutkan ke Receipt</span>
            </span>
          </Button>
        </div>
      </Modal>

      {/* Loading Overlay - Block entire page during processing */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 text-center shadow-xl max-w-sm mx-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{loadingMessage}</h3>
            <p className="text-gray-600 text-sm">Mohon tunggu sebentar...</p>
            <div className="mt-4 text-xs text-gray-500">
              Jangan tutup atau refresh halaman
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

//backuplu