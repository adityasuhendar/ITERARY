// FILE: src/app/components/transactions/TransactionDetailModal.js
"use client"
import { useState, useEffect } from 'react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { printReceipt } from '@/lib/receiptPrinter'
import { formatCurrency } from '@/lib/formatters'
import TransactionReceipt from '@/components/forms/TransactionReceipt'

export default function TransactionDetailModal({ 
  transactionId, 
  isOpen, 
  onClose, 
  onPrintReceipt,
  currentUser // Add current user prop to get active worker name
}) {
  const [transaction, setTransaction] = useState(null)
  const [loyaltyData, setLoyaltyData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showReceiptModal, setShowReceiptModal] = useState(false)

  useEffect(() => {
    if (isOpen && transactionId) {
      fetchTransactionDetail()
    }
  }, [isOpen, transactionId])

  // Helper function to count paid cuci services in transaction
  const countPaidCuciInTransaction = (services) => {
    return services.filter(service => {
      const serviceName = (service.nama_layanan || '').toLowerCase()
      const subtotal = parseFloat(service.subtotal || 0)
      return serviceName.includes('cuci') && subtotal > 0
    }).reduce((count, service) => {
      return count + (parseInt(service.quantity) || 1)
    }, 0)
  }

  const fetchTransactionDetail = async () => {
    try {
      setLoading(true)
      setError('')
      const startTime = Date.now() // Track loading start time

      const response = await fetch(`/api/transactions/${transactionId}`, {
        credentials: 'same-origin' // Fix auth issue
      })
      if (response.ok) {
        const data = await response.json()

        // If current user is kasir and has active_worker_name, inject it for display
        if (currentUser &&
            currentUser.role === 'kasir' &&
            currentUser.active_worker_name &&
            data.nama_karyawan === currentUser.name) {
          data.active_worker_name = currentUser.active_worker_name
        }

        setTransaction(data)

        // Minimum 300ms loading untuk smooth UX (no janky feel)
        const elapsed = Date.now() - startTime
        const minLoadingTime = 300
        if (elapsed < minLoadingTime) {
          await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsed))
        }

        setLoading(false)

        // Fetch loyalty data
        if (data.id_pelanggan) {
          try {
            console.log('🔍 Fetching loyalty for customer:', data.id_pelanggan, 'at', new Date().toISOString())

            const loyaltyResponse = await fetch(`/api/loyalty?customer_id=${data.id_pelanggan}`, {
              credentials: 'same-origin',
              headers: {
                'Cache-Control': 'no-cache' // Force fresh data
              }
            })
            if (loyaltyResponse.ok) {
              const loyaltyResult = await loyaltyResponse.json()
              if (loyaltyResult.success) {
                console.log('🔍 Loyalty API returned:', {
                  total_cuci: loyaltyResult.loyalty.total_cuci,
                  loyalty_points: loyaltyResult.loyalty.loyalty_points,
                  total_redeem: loyaltyResult.loyalty.total_redeem,
                  api_timestamp: new Date().toISOString()
                })
                // IMPORTANT: Adjust loyalty data to simulate pre-transaction state
                // This is needed for consistent loyalty calculation with TransactionForm
                const paidCuciInThisTransaction = countPaidCuciInTransaction(data.services || [])

                // Debug log removed - loyalty calculation working correctly

                const adjustedLoyaltyData = {
                  ...loyaltyResult,
                  loyalty: {
                    ...loyaltyResult.loyalty,
                    // Only adjust if there are paid cuci in this transaction
                    // Otherwise use original data (for all-free transactions)
                    total_cuci: paidCuciInThisTransaction > 0
                      ? Math.max(0, loyaltyResult.loyalty.total_cuci - paidCuciInThisTransaction)
                      : loyaltyResult.loyalty.total_cuci
                  }
                }
                setLoyaltyData(adjustedLoyaltyData)
              }
            }
          } catch (loyaltyErr) {
            console.log('⚠️ Loyalty data fetch failed:', loyaltyErr.message)
          }
        }
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to fetch transaction detail')
      }
    } catch (err) {
      setError(err.message)
      setLoading(false)
      console.error('Fetch transaction detail error:', err)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPaymentMethodIcon = (method) => {
    if (!method) return '❓'
    return method === 'tunai' ? '💰' : '📱'
  }

  const getPaymentMethodColor = (method) => {
    if (!method) return 'bg-gray-100 text-gray-800 border border-gray-200'
    return method === 'tunai' 
      ? 'bg-green-100 text-green-800 border border-green-200' 
      : 'bg-blue-100 text-blue-800 border border-blue-200'
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'selesai': return 'bg-green-100 text-green-800 border border-green-200'
      case 'pending': return 'bg-yellow-100 text-yellow-800 border border-yellow-200'
      case 'dibatalkan': return 'bg-red-100 text-red-800 border border-red-200'
      default: return 'bg-gray-100 text-gray-800 border border-gray-200'
    }
  }

  const handlePrint = () => {
    setShowReceiptModal(true)
  }

  if (!isOpen) return null

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title="Detail Transaksi" size="md">
      <div className="space-y-3 sm:space-y-4">
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dwash-red mx-auto mb-4"></div>
            <p className="text-gray-600">Memuat detail transaksi...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {!loading && transaction && (
          <>
            {/* Transaction Header - Responsive */}
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border">
              {/* Top Row: Code + Status */}
              <div className="flex justify-between items-start mb-3 sm:mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                    {transaction.kode_transaksi}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
                    {formatDateTime(transaction.tanggal_transaksi)}
                  </p>
                </div>
                <div className={`inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium ml-2 sm:ml-3 ${getStatusColor(transaction.status_transaksi)}`}>
                  {transaction.status_transaksi.charAt(0).toUpperCase() + transaction.status_transaksi.slice(1)}
                </div>
              </div>

              {/* Info Cards - 2 Column Grid */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {/* Customer Info */}
                <div className="bg-white rounded p-2 sm:p-3 border">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Pelanggan</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5 sm:mt-1">{transaction.nama_pelanggan}</p>
                  {transaction.nomor_telepon && (
                    <p className="text-xs text-gray-600 mt-0.5 sm:mt-1">{transaction.nomor_telepon}</p>
                  )}
                </div>

                {/* Kasir & Shift */}
                <div className="bg-white rounded p-2 sm:p-3 border">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Kasir & Shift</p>
                  <p className="text-xs sm:text-sm font-semibold text-gray-900 mt-0.5 sm:mt-1">{transaction.nama_pekerja_aktual || transaction.nama_karyawan}</p>
                  <p className="text-xs text-gray-600 mt-0.5 sm:mt-1">Shift {transaction.shift_transaksi}</p>
                </div>
              </div>
            </div>

            {/* Services Detail - Responsive */}
            {transaction.services && transaction.services.length > 0 && (
              <div className="bg-white border rounded-lg p-3 sm:p-4">
                <h4 className="font-semibold text-gray-900 mb-2 sm:mb-4 flex items-center text-sm sm:text-base">
                  <span className="text-blue-500 mr-1.5 sm:mr-2">🧺</span>
                  Layanan Laundry
                </h4>
                <div className="space-y-2 sm:space-y-3">
                  {(() => {
                    // Group services by nama_layanan
                    const groupedServices = {}
                    transaction.services.forEach(service => {
                      const serviceName = service.nama_layanan
                      const isPaidService = parseFloat(service.subtotal) > 0
                      const serviceHarga = parseFloat(service.harga_satuan) || 0
                      
                      if (groupedServices[serviceName]) {
                        groupedServices[serviceName].totalQuantity += parseInt(service.quantity) || 1
                        groupedServices[serviceName].totalSubtotal += parseFloat(service.subtotal) || 0
                        groupedServices[serviceName].freeCount += !isPaidService ? (parseInt(service.quantity) || 1) : 0
                        groupedServices[serviceName].paidCount += isPaidService ? (parseInt(service.quantity) || 1) : 0
                        
                        // Always use non-zero price from any service (free or paid)
                        if (serviceHarga > 0) {
                          groupedServices[serviceName].harga_satuan = serviceHarga
                        }
                      } else {
                        groupedServices[serviceName] = {
                          nama_layanan: serviceName,
                          durasi_menit: service.durasi_menit,
                          deskripsi: service.deskripsi,
                          harga_satuan: serviceHarga, // Use actual price from service data
                          totalQuantity: parseInt(service.quantity) || 1,
                          totalSubtotal: parseFloat(service.subtotal) || 0,
                          freeCount: !isPaidService ? (parseInt(service.quantity) || 1) : 0,
                          paidCount: isPaidService ? (parseInt(service.quantity) || 1) : 0
                        }
                      }
                    })

                    return Object.values(groupedServices).map((service, index) => (
                      <div key={index} className="p-2 sm:p-3 bg-blue-50 rounded sm:rounded-lg border border-blue-200">
                        {/* Service Header */}
                        <div className="mb-2 sm:mb-3">
                          <h5 className="font-medium text-gray-900 text-sm sm:text-base">
                            {service.totalQuantity}x {service.nama_layanan}
                          </h5>
                        </div>

                        {/* Pricing Breakdown */}
                        <div className="space-y-1 sm:space-y-2">
                          {service.freeCount > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                                {service.freeCount}x GRATIS
                              </span>
                              <span className="text-xs text-green-600 font-medium">Rp 0</span>
                            </div>
                          )}
                          {service.paidCount > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                {service.paidCount}x {formatCurrency(service.harga_satuan)}
                              </span>
                              <span className="text-xs text-gray-600">{formatCurrency(service.paidCount * service.harga_satuan)}</span>
                            </div>
                          )}

                          {/* Total */}
                          <div className="flex justify-between items-center pt-1.5 sm:pt-2 border-t border-blue-200">
                            <span className="text-xs sm:text-sm font-medium text-gray-700">Total</span>
                            <span className="font-semibold text-blue-700 text-sm">
                              {formatCurrency(service.totalSubtotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  })()}
                </div>
                <div className="mt-2 sm:mt-4 pt-2 sm:pt-4 border-t border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700 text-sm sm:text-base">Total Layanan:</span>
                    <span className="font-bold text-blue-700 text-sm sm:text-base">
                      {formatCurrency(transaction.total_layanan)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Products Detail - Responsive */}
            {transaction.products && transaction.products.length > 0 && (
              <div className="bg-white border rounded-lg p-3 sm:p-4">
                <h4 className="font-semibold text-gray-900 mb-2 sm:mb-4 flex items-center text-sm sm:text-base">
                  <span className="text-green-500 mr-1.5 sm:mr-2">📦</span>
                  Produk Tambahan
                </h4>
                <div className="space-y-2 sm:space-y-3">
                  {transaction.products.map((product, index) => {
                    // Read directly from database - no recalculation
                    const quantity = parseInt(product.quantity) || 0
                    const subtotal = parseFloat(product.subtotal) || 0
                    const unitPrice = parseFloat(product.harga_satuan) || 0
                    const freeQuantity = parseInt(product.free_quantity) || 0
                    const paidQuantity = quantity - freeQuantity

                    return (
                      <div key={index} className="p-2 sm:p-3 bg-green-50 rounded sm:rounded-lg border border-green-200">
                        {/* Product Header */}
                        <div className="mb-2 sm:mb-3">
                          <h5 className="font-medium text-gray-900 text-sm sm:text-base">
                            {quantity}{product.satuan} {product.nama_produk}
                          </h5>
                        </div>

                        {/* Pricing Breakdown */}
                        <div className="space-y-1 sm:space-y-2">
                          {/* Free Portion */}
                          {freeQuantity > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                                {freeQuantity}{product.satuan} GRATIS
                              </span>
                              <span className="text-xs text-green-600 font-medium">Rp 0</span>
                            </div>
                          )}

                          {/* Paid Portion */}
                          {paidQuantity > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                {paidQuantity}{product.satuan} × {formatCurrency(unitPrice)}
                              </span>
                              <span className="text-xs text-gray-600">{formatCurrency(paidQuantity * unitPrice)}</span>
                            </div>
                          )}

                          {/* Total */}
                          <div className="flex justify-between items-center pt-1.5 sm:pt-2 border-t border-green-200">
                            <span className="text-xs sm:text-sm font-medium text-gray-700">Total</span>
                            <span className="font-semibold text-green-700 text-sm">
                              {formatCurrency(subtotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 sm:mt-4 pt-2 sm:pt-4 border-t border-green-200">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700 text-sm sm:text-base">Total Produk:</span>
                    <span className="font-bold text-green-700 text-sm sm:text-base">
                      {formatCurrency(transaction.total_produk)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Total & Notes - Responsive */}
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border">
              <div className="space-y-2 sm:space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700 text-sm sm:text-base">Subtotal Layanan:</span>
                  <span className="font-bold text-blue-600 text-sm sm:text-base">
                    {formatCurrency(transaction.total_layanan)}
                  </span>
                </div>

                {transaction.total_produk > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700 text-sm sm:text-base">Subtotal Produk:</span>
                    <span className="font-bold text-green-600 text-sm sm:text-base">
                      {formatCurrency(transaction.total_produk)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700 text-sm sm:text-base">Metode Pembayaran:</span>
                  <div className={`inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getPaymentMethodColor(transaction.metode_pembayaran)}`}>
                    <span className="mr-1">{getPaymentMethodIcon(transaction.metode_pembayaran)}</span>
                    <span>{transaction.metode_pembayaran ? transaction.metode_pembayaran.toUpperCase() : 'BELUM DIBAYAR'}</span>
                  </div>
                </div>

                <div className="border-t border-gray-300 pt-2 sm:pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-900 text-base sm:text-lg">TOTAL:</span>
                    <span className="font-bold text-lg sm:text-xl text-dwash-red">
                      {formatCurrency(transaction.total_keseluruhan)}
                    </span>
                  </div>
                </div>

                {transaction.catatan && (
                  <div className="mt-2 sm:mt-4 pt-2 sm:pt-4 border-t border-gray-200">
                    <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Catatan:</p>
                    <p className="text-xs sm:text-sm text-gray-600 bg-white p-2 sm:p-3 rounded border break-words">
                      {transaction.catatan}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-row gap-2 sm:gap-3 pt-2 sm:pt-4 justify-center">


              <Button
                onClick={handlePrint}
                variant="outline"
                className="text-sm px-4 py-2"
              >
                🖨️ Print
              </Button>

              {transaction.status_transaksi === 'selesai' && (
                <Button
                  onClick={() => {
                    // Copy transaction code to clipboard
                    navigator.clipboard.writeText(transaction.kode_transaksi)
                    alert('Kode transaksi berhasil disalin!')
                  }}
                  variant="outline"
                  className="text-sm px-4 py-2"
                >
                  📋 Kode
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
    
    {/* TransactionReceipt Modal */}
    <Modal 
      isOpen={showReceiptModal} 
      onClose={() => setShowReceiptModal(false)}
      title="Print Receipt"
      size="md"
    >
      {transaction && (
        <TransactionReceipt 
          transaction={transaction}
          onClose={() => setShowReceiptModal(false)}
          onPrint={() => {
            // Thermal printing is handled within TransactionReceipt component
          }}
          isDraft={false}
          services={(() => {
            // Group services by nama_layanan (same logic as UI display)
            const groupedServices = {}
            transaction.services.forEach(service => {
              const serviceName = service.nama_layanan
              const isPaidService = parseFloat(service.subtotal) > 0
              const serviceHarga = parseFloat(service.harga_satuan) || 0
              
              if (groupedServices[serviceName]) {
                // Update quantity correctly
                const currentQuantity = parseInt(service.quantity) || 1
                groupedServices[serviceName].quantity += currentQuantity
                groupedServices[serviceName].totalSubtotal += parseFloat(service.subtotal) || 0

                if (isPaidService) {
                  groupedServices[serviceName].paidCount += currentQuantity
                } else {
                  groupedServices[serviceName].freeCount += currentQuantity
                }

                // Always use non-zero price from any service (free or paid)
                if (serviceHarga > 0) {
                  groupedServices[serviceName].harga_satuan = serviceHarga
                }
              } else {
                const currentQuantity = parseInt(service.quantity) || 1
                groupedServices[serviceName] = {
                  nama_layanan: serviceName,
                  durasi_menit: service.durasi_menit,
                  deskripsi: service.deskripsi,
                  harga_satuan: serviceHarga,
                  quantity: currentQuantity,
                  subtotal: parseFloat(service.subtotal) || 0,
                  totalSubtotal: parseFloat(service.subtotal) || 0,
                  freeCount: !isPaidService ? currentQuantity : 0,
                  paidCount: isPaidService ? currentQuantity : 0
                }
              }
            })
            return Object.values(groupedServices).map(service => ({
              ...service,
              // Ensure consistent structure with TransactionForm
              harga: service.harga_satuan,
              totalQuantity: service.quantity, // For backward compatibility
              subtotal: service.totalSubtotal  // Use totalSubtotal as the main subtotal
            }))
          })()}
          products={transaction.products.map(product => {
            // Read directly from database - no recalculation
            const quantity = parseInt(product.quantity) || 0
            const freeQuantity = parseInt(product.free_quantity) || 0
            const paidQuantity = quantity - freeQuantity

            return {
              ...product,
              freeQuantity,
              paidQuantity,
              harga: product.harga_satuan,
              isFree: product.is_free == 1 || freeQuantity > 0
            }
          })}
          loyaltyData={loyaltyData}
          hideButtons={false}
        />
      )}
    </Modal>
    </>
  )
}
