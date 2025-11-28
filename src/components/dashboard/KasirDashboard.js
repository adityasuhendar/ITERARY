"use client"
import { useState, useEffect } from 'react'
import StatsCard from './StatsCard'
import QuickAction from './QuickAction'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import TransactionForm from '@/components/forms/TransactionForm'
import StockManagement from '@/components/inventory/StockManagement'
import { InventoryAlert } from '@/components/inventory/InventoryAlert'
import MachineStatusModal from '@/components/machines/MachineStatusModal'
import TransactionDetailModal from '@/components/transactions/TransactionDetailModal'
import ShiftReport from '@/components/reports/ShiftReport'
import FinancialReport from '@/components/reports/FinancialReport'
import CustomerManagement from '@/components/customers/CustomerManagement'
import ExpenseManagement from '@/components/expenses/ExpenseManagement'
import Modal from '@/components/ui/Modal'
import NotificationDropdown from '@/components/notifications/NotificationDropdown'
import FeedbackModal from '@/components/feedback/FeedbackModal'
import { printReceipt } from '@/lib/receiptPrinter'

// PaymentMethodModal Component (sama seperti di TransactionForm)
function PaymentMethodModal({ isOpen, onClose, onSelectPayment, loading = false, transaction = null }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

return (
  <Modal isOpen={isOpen} onClose={onClose} title="Konfirmasi Pembayaran" size="md">
    <div className="space-y-4 px-1">
      {/* Customer Identity Section */}
      {transaction && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h4 className="font-semibold text-blue-900 text-sm">Detail Customer</h4>
            <span className="text-xs text-blue-600 font-mono bg-blue-100 px-2 py-1 rounded self-start sm:self-auto">
              {transaction.kode_transaksi}
            </span>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-blue-600 font-medium text-xs mb-1">Nama Pelanggan</p>
              <p className="text-blue-900 font-semibold text-base break-words">
                {transaction.nama_pelanggan}
              </p>
            </div>
            
            <div>
              <p className="text-blue-600 font-medium text-xs mb-1">Total Pembayaran</p>
              <p className="text-blue-900 font-bold text-lg">
                {formatCurrency(transaction.total_keseluruhan)}
              </p>
            </div>
            
            {transaction.nomor_telepon && (
              <div>
                <p className="text-blue-600 font-medium text-xs mb-1">No. Telepon</p>
                <p className="text-blue-900 text-sm">{transaction.nomor_telepon}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="text-center px-2">
        <p className="text-gray-600 text-sm mb-1">
          Bagaimana customer akan membayar?
        </p>
        <p className="text-xs text-gray-500 mb-4">
          Pastikan identitas customer sudah benar sebelum konfirmasi
        </p>
      </div>
      
      {/* Payment Options */}
      <div className="space-y-3">
        <button
          onClick={() => onSelectPayment('tunai')}
          disabled={loading}
          className="w-full p-3 sm:p-4 border-2 border-gray-200 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all duration-200 disabled:opacity-50 active:scale-95"
        >
          <div className="flex items-center space-x-3">
            <span className="text-xl sm:text-2xl flex-shrink-0">💰</span>
            <div className="text-left min-w-0">
              <div className="font-semibold text-gray-900 text-sm sm:text-base">Tunai</div>
              <div className="text-xs sm:text-sm text-gray-500">Cash payment</div>
            </div>
          </div>
        </button>
        
        <button
          onClick={() => onSelectPayment('qris')}
          disabled={loading}
          className="w-full p-3 sm:p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 active:scale-95"
        >
          <div className="flex items-center space-x-3">
            <span className="text-xl sm:text-2xl flex-shrink-0">📱</span>
            <div className="text-left min-w-0">
              <div className="font-semibold text-gray-900 text-sm sm:text-base">QRIS</div>
              <div className="text-xs sm:text-sm text-gray-500">Scan QR Code</div>
            </div>
          </div>
        </button>
      </div>
      
      {/* Loading State */}
      {loading && (
        <div className="text-center py-3">
          <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-red-600 mx-auto"></div>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">Memproses pembayaran...</p>
        </div>
      )}
    </div>
  </Modal>
)
}

// TransactionReceipt Component
function TransactionReceipt({ transaction, onClose, onPrint }) {

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateThermal = (dateString) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleThermalPrint = async (transaction, paperSize) => {
    try {
      // Direct print dialog - no USB detection
      const printWindow = window.open('', '_blank')
      
      if (!printWindow) {
        alert('❌ Popup diblokir! Mohon izinkan popup untuk mencetak receipt.')
        return
      }
      
      const thermalCSS = getThermalCSS(paperSize)
      const receiptHTML = generateThermalHTML(transaction, paperSize)
      
      try {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Receipt - ${transaction.kode_transaksi}</title>
              <style>${thermalCSS}</style>
            </head>
            <body>
              ${receiptHTML}
              <script>
                window.onload = function() {
                  setTimeout(() => {
                    window.print()
                    setTimeout(() => window.close(), 1000)
                  }, 500)
                }
              </script>
            </body>
          </html>
        `)
        
        printWindow.document.close()
        printWindow.focus()
        
      } catch (writeError) {
        console.error('Error writing to print window:', writeError)
        printWindow.close()
        alert('❌ Gagal membuka print dialog. Coba lagi.')
      }
      
    } catch (error) {
      console.error('Print error:', error)
      alert('❌ Gagal mencetak receipt: ' + error.message)
    }
  }

  const generateESCPOS = (transaction, paperSize) => {
    const ESC = String.fromCharCode(27)
    const GS = String.fromCharCode(29)
    const width = paperSize === '58mm' ? 32 : 42
    
    let escpos = ''
    escpos += ESC + '@' // Initialize
    escpos += ESC + 'a' + String.fromCharCode(1) // Center align
    escpos += ESC + '!' + String.fromCharCode(16) // Double height
    escpos += "DWASH LAUNDRY\\n"
    escpos += ESC + '!' + String.fromCharCode(0) // Normal size
    escpos += (transaction.nama_cabang || 'Cabang Utama') + '\\n'
    escpos += 'Self Service Laundry\\n'
    escpos += ESC + 'a' + String.fromCharCode(0) // Left align
    escpos += '='.repeat(width) + '\\n'
    escpos += `No: ${transaction.kode_transaksi}\\n`
    escpos += `Tgl: ${formatDateThermal(transaction.tanggal_transaksi)}\\n`
    escpos += `Pelanggan: ${transaction.nama_pelanggan}\\n`
    escpos += '-'.repeat(width) + '\\n'
    
    transaction.detail_layanan?.forEach(item => {
      const itemLine = `${item.nama_layanan}`.padEnd(width - 12) + `${formatCurrency(item.harga_layanan)}`.padStart(12)
      escpos += itemLine + '\\n'
      if (item.nama_mesin) {
        escpos += `  Mesin: ${item.nama_mesin}\\n`
      }
    })
    
    escpos += '-'.repeat(width) + '\\n'
    escpos += ESC + '!' + String.fromCharCode(16) // Double height
    escpos += `TOTAL: ${formatCurrency(transaction.total_keseluruhan)}\\n`
    escpos += ESC + '!' + String.fromCharCode(0) // Normal size
    escpos += `Bayar: ${transaction.metode_pembayaran?.toUpperCase() || 'CASH'}\\n`
    escpos += '='.repeat(width) + '\\n'
    escpos += ESC + 'a' + String.fromCharCode(1) // Center align
    escpos += 'Terima kasih telah menggunakan\\n'
    escpos += "layanan DWash Laundry!\\n\\n"
    escpos += `Dicetak: ${new Date().toLocaleString('id-ID')}\\n`
    escpos += GS + 'V' + String.fromCharCode(1) // Partial cut
    
    return escpos
  }

  const getThermalCSS = (paperSize) => {
    const width = paperSize === '58mm' ? '58mm' : '80mm'
    return `
      @page { size: ${width} auto; margin: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Courier New', monospace;
        font-size: ${paperSize === '58mm' ? '11px' : '12px'};
        line-height: 1.2;
        width: ${width};
        padding: 2mm;
        background: white;
        color: black;
      }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .line { border-bottom: 1px dashed #333; margin: 2px 0; }
      .space { margin: 3px 0; }
      .big { font-size: ${paperSize === '58mm' ? '13px' : '14px'}; }
      .small { font-size: ${paperSize === '58mm' ? '9px' : '10px'}; }
      .row { display: flex; justify-content: space-between; }
      .total-row { 
        border-top: 1px solid #333;
        border-bottom: 1px solid #333;
        padding: 2px 0;
        margin: 2px 0;
        font-weight: bold;
      }
    `
  }

  const generateThermalHTML = (transaction, paperSize) => {
    // Debug transaction data
    
    // Get services from different possible sources
    const services = transaction.detail_layanan || 
                    transaction.services || 
                    transaction.layanan || 
                    []
    
    let servicesHTML = ''
    if (services.length > 0) {
      servicesHTML = services.map(item => `
        <div class="row">
          <span>${item.nama_layanan || item.nama_jenis_layanan || 'Layanan'}</span>
          <span>${formatCurrency(item.harga_layanan || item.total_harga || 0)}</span>
        </div>
        ${item.nama_mesin || item.mesin ? `<div class="small">  Mesin: ${item.nama_mesin || item.mesin}</div>` : ''}
      `).join('')
    } else {
      // Fallback: show total as single service line
      servicesHTML = `
        <div class="row">
          <span>Layanan Laundry</span>
          <span>${formatCurrency(transaction.total_keseluruhan)}</span>
        </div>
      `
    }
    
    return `
      <div class="center bold big">DWASH LAUNDRY</div>
      <div class="center small">${transaction.nama_cabang || 'Cabang Utama'}</div>
      <div class="center small">Self Service Laundry</div>
      <div class="line"></div>
      <div class="space">
        <div class="row"><span>No. Transaksi:</span><span class="bold">${transaction.kode_transaksi}</span></div>
        <div class="row"><span>Tanggal:</span><span>${formatDateThermal(transaction.tanggal_transaksi)}</span></div>
        <div class="row"><span>Pelanggan:</span><span>${transaction.nama_pelanggan}</span></div>
      </div>
      <div class="line"></div>
      <div class="space">
        ${servicesHTML}
      </div>
      <div class="line"></div>
      <div class="row total-row big"><span>TOTAL:</span><span>${formatCurrency(transaction.total_keseluruhan)}</span></div>
      <div class="row"><span>Pembayaran:</span><span class="bold">${transaction.metode_pembayaran?.toUpperCase() || 'CASH'}</span></div>
      <div class="line"></div>
      <div class="center small space">
        <div>Terima kasih telah menggunakan</div>
        <div>layanan DWash Laundry!</div>
        <div class="space">Simpan nota ini sebagai bukti transaksi</div>
      </div>
      <div class="center small space" style="margin-top: 8px;">
        <div>Dicetak: ${new Date().toLocaleString('id-ID')}</div>
      </div>
    `
  }

  return (
  <div className="space-y-4 px-1">
    {/* Success Message */}
    <div className="text-center">
      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <span className="text-green-600 text-xl sm:text-2xl">✓</span>
      </div>
      <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
        Pembayaran Berhasil!
      </h2>
      <p className="text-sm sm:text-base text-gray-600 px-2">
        Transaksi telah lunas dan tersimpan ke sistem
      </p>
    </div>

    {/* Receipt Details */}
    <div className="bg-gray-50 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
      <div className="text-center border-b pb-3">
        <h3 className="font-bold text-base sm:text-lg">DWash Laundry</h3>
        <p className="text-xs sm:text-sm text-gray-600">Self Service Laundry</p>
      </div>

      <div className="space-y-2 text-xs sm:text-sm">
        <div className="flex justify-between items-start">
          <span className="text-gray-600 flex-shrink-0">Kode Transaksi:</span>
          <span className="font-mono font-bold text-right break-all ml-2">
            {transaction.kode_transaksi}
          </span>
        </div>
        
        <div className="flex justify-between items-start">
          <span className="text-gray-600 flex-shrink-0">Tanggal:</span>
          <span className="text-right ml-2">{formatDate(transaction.tanggal_transaksi)}</span>
        </div>
        
        <div className="flex justify-between items-start">
          <span className="text-gray-600 flex-shrink-0">Pelanggan:</span>
          <span className="text-right ml-2 break-words">{transaction.nama_pelanggan}</span>
        </div>
        
        <div className="flex justify-between items-start">
          <span className="text-gray-600 flex-shrink-0">Pembayaran:</span>
          <span className="uppercase text-right ml-2">
            {transaction.metode_pembayaran || 'BELUM DIBAYAR'}
          </span>
        </div>
      </div>

      <div className="border-t pt-3">
        <div className="flex justify-between items-center">
          <span className="font-bold text-sm sm:text-base">Total:</span>
          <span className="font-bold text-base sm:text-lg text-dwash-red">
            {formatCurrency(transaction.total_keseluruhan)}
          </span>
        </div>
      </div>

      <div className="text-center text-xs text-gray-500 border-t pt-3">
        <p className="mb-1">Terima kasih telah menggunakan layanan DWash!</p>
        {/* <p>Simpan nota ini sebagai bukti transaksi</p> */}
      </div>
    </div>

    {/* Action Buttons */}
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
      <Button 
        variant="outline" 
        onClick={() => printReceipt(transaction)}
        className="flex-1 text-sm sm:text-base py-2 sm:py-3"
      >
        <span className="mr-2">🖨️</span>
        Print Receipt
      </Button>

    </div>
  </div>
)
}

export default function KasirDashboard({ user }) {
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [loginTime] = useState(new Date()) // Real login time, tidak update
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  
  const [pendingTransactions, setPendingTransactions] = useState([])
  const [showPendingModal, setShowPendingModal] = useState(false)
  const [pendingPage, setPendingPage] = useState(1)
  const PENDING_PER_PAGE = 3
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false)
  const [selectedPendingTransaction, setSelectedPendingTransaction] = useState(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [completedPaymentTransaction, setCompletedPaymentTransaction] = useState(null)
  const [paymentConfirmation, setPaymentConfirmation] = useState({ show: false, method: '', transaction: null })
  const [cancelConfirmation, setCancelConfirmation] = useState({ show: false, transaction: null, loading: false })
  const [cancelSuccess, setCancelSuccess] = useState({ show: false, transactionCode: '' })
  const [showTransactionHistory, setShowTransactionHistory] = useState(false)
  const [showStockManagement, setShowStockManagement] = useState(false)
  const [showMachineModal, setShowMachineModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showShiftReport, setShowShiftReport] = useState(false)
  const [showCustomerManagement, setShowCustomerManagement] = useState(false)
  const [showExpenseManagement, setShowExpenseManagement] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [selectedTransactionId, setSelectedTransactionId] = useState(null)
  const [makeAllAvailableLoading, setMakeAllAvailableLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [transactionHistory, setTransactionHistory] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }))
  const [selectedShift, setSelectedShift] = useState('semua')

  useEffect(() => {
    if (showTransactionHistory) {
      fetchTransactionHistory()
    }
  }, [selectedDate, selectedShift, showTransactionHistory])

  const getMinDate = () => {
    const today = new Date()
    const minDate = new Date(today)
    minDate.setDate(today.getDate() - 4) // 4 hari ke belakang
    return minDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  }

  const getMaxDate = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) // Hari ini (tidak bisa ke depan)
  }

  const [transactionPagination, setTransactionPagination] = useState({
    currentPage: 1,
    itemsPerPage: 20, // Mobile-friendly pagination
    totalItems: 0
  })
  const [selectedNotificationRequest, setSelectedNotificationRequest] = useState(null)

  useEffect(() => {
    fetchDashboardData()
    fetchPendingTransactions()

    // Preload CSRF token in background for faster transaction form
    preloadCSRFToken()

    // Auto-refresh disabled

    // Auto-release is now handled by machine status API, no need for separate interval

    // 🔒 PREVENT BACK TO LOGIN: Push initial dashboard state to create history barrier
    if (typeof window !== 'undefined') {
      // Replace current state to clear any previous state (from login page)
      window.history.replaceState({
        view: 'dashboard',
        pathname: window.location.pathname
      }, '', window.location.href)

      // Then push a new state to create a barrier against going back
      window.history.pushState({
        view: 'dashboard',
        pathname: window.location.pathname
      }, '', window.location.href)
    }

    // Handle browser back button
    const handlePopState = (event) => {
      // Always clear all modals first to prevent stale state
      setShowTransactionHistory(false)
      setShowTransactionForm(false)
      setShowStockManagement(false)
      setShowShiftReport(false)
      setShowCustomerManagement(false)

      const state = event.state

      // 🔒 PREVENT GOING BACK TO LOGIN: If no valid state or dashboard state, stay in dashboard
      if (!state || !state.view || state.view === 'dashboard') {
        // Push dashboard state again to prevent leaving dashboard
        window.history.pushState({
          view: 'dashboard',
          pathname: window.location.pathname
        }, '', window.location.href)
        return // Don't process modal states
      }

      // Only process if we have a valid modal state and are still on the same page
      if (state && state.view && window.location.pathname === state.pathname) {
        // Small delay to ensure state is cleared before setting new state
        setTimeout(() => {
          switch (state.view) {
            case 'transaction-history':
              setShowTransactionHistory(true)
              break
            case 'transaction-form':
              setShowTransactionForm(true)
              break
            case 'stock-management':
              setShowStockManagement(true)
              break
            case 'shift-report':
              setShowShiftReport(true)
              break
            case 'customer-management':
              setShowCustomerManagement(true)
              break
            // Default case already handled by clearing all states above
          }
        }, 0)
      }
    }

    window.addEventListener('popstate', handlePopState)
    
    // Listen for notification clicks to open stock request
    const handleOpenStockRequest = (event) => {
      const { requestId, notification } = event.detail
      
      // Open stock management
      setShowStockManagement(true)
      // Ensure requestId is number for consistent comparison
      setSelectedNotificationRequest(parseInt(requestId))
      
      // Add to browser history
      if (typeof window !== 'undefined') {
        const currentState = window.history.state
        if (currentState && currentState.view) {
          window.history.replaceState({ 
            view: 'stock-management',
            requestId: requestId,
            pathname: window.location.pathname 
          }, '', window.location.href)
        } else {
          window.history.pushState({ 
            view: 'stock-management',
            requestId: requestId,
            pathname: window.location.pathname 
          }, '', window.location.href)
        }
      }
    }
    
    window.addEventListener('openStockRequest', handleOpenStockRequest)

    // Listen for messages from service worker (push notification clicks)
    const handleServiceWorkerMessage = (event) => {
      if (event.data && event.data.type === 'OPEN_STOCK_REQUEST') {
        handleOpenStockRequest({ detail: event.data })
      }
    }
    
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('openStockRequest', handleOpenStockRequest)
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
    }
  }, [])

  // Background CSRF token preloading for faster transaction form
  const preloadCSRFToken = async () => {
    try {
      // Silently preload CSRF token and store in cookie
      await fetch('/api/csrf-token', {
        credentials: 'include'
      })
    } catch (error) {
      // Silent fail - don't show error to user
      console.warn('CSRF token preload failed:', error.message)
    }
  }

  const fetchDashboardData = async () => {
    try {
      // Get current shift from localStorage (updated by ShiftSelectionModal)
      const userData = localStorage.getItem('user')
      const currentShift = userData ? JSON.parse(userData).current_shift || 'pagi' : 'pagi'
      console.log('🔍 [KasirDashboard] Fresh localStorage for dashboard:', userData ? JSON.parse(userData) : null)
      console.log('🔍 [KasirDashboard] Fresh current_shift:', currentShift)
      
      const response = await fetch(`/api/dashboard/kasir?shift=${currentShift}`)
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }
      const data = await response.json()
      
      // Fetch enhanced machine status with assignments - DISABLED
      // try {
      //   const machineResponse = await fetch('/api/machines/status', {
      //     credentials: 'include', // Include cookies for auth
      //     headers: {
      //       'Content-Type': 'application/json'
      //     }
      //   })
      //   if (machineResponse.ok) {
      //     const machineData = await machineResponse.json()
      //     // Replace basic machine data with enhanced data
      //     data.machines = machineData.machines || data.machines
      //   } else {
      //     console.warn('Machine status API returned error:', machineResponse.status)
      //   }
      // } catch (machineErr) {
      //   console.warn('Machine status unavailable:', machineErr.message)
      // }
      
      setDashboardData(data)
      setError(null)
    } catch (err) {
      setError(err.message)
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingTransactions = async () => {
    try {
      const response = await fetch(`/api/transactions?status=pending&cabang_id=${user.cabang_id}&limit=20`)
      if (response.ok) {
        const data = await response.json()
        setPendingTransactions(data.transactions || [])
        setPendingPage(1) // Reset to page 1 when data refreshes
      }
    } catch (error) {
      console.error('Error fetching pending transactions:', error)
      setPendingTransactions([])
    }
  }

  const fetchTransactionHistory = async () => {
    try {
      if (selectedShift === 'semua') {
        const [pagiResponse, malamResponse] = await Promise.all([
          fetch(`/api/transactions?cabang_id=${user.cabang_id}&date=${selectedDate}&shift=pagi`),
          fetch(`/api/transactions?cabang_id=${user.cabang_id}&date=${selectedDate}&shift=malam`)
        ]);

        const pagiData = pagiResponse.ok ? await pagiResponse.json() : { transactions: [] };
        const malamData = malamResponse.ok ? await malamResponse.json() : { transactions: [] };

        const combinedTransactions = [...(pagiData.transactions || []), ...(malamData.transactions || [])];
        combinedTransactions.sort((a, b) => new Date(b.tanggal_transaksi) - new Date(a.tanggal_transaksi));

        setTransactionHistory(combinedTransactions);
      } else {
        let url = `/api/transactions?cabang_id=${user.cabang_id}&date=${selectedDate}&shift=${selectedShift}`
        
        const response = await fetch(url)
        
        if (response.ok) {
          const data = await response.json()
          setTransactionHistory(data.transactions || [])
        } else {
          const errorText = await response.text()
          console.error('Error fetching transaction history:', errorText)
          setTransactionHistory([])
        }
      }
    } catch (error) {
      console.error('Error fetching transaction history:', error)
      setTransactionHistory([])
    }
  }

  const handleNewTransaction = () => {
    // Clear all other modals first
    setShowTransactionHistory(false)
    setShowStockManagement(false)
    setShowShiftReport(false)
    setShowCustomerManagement(false)
    
    // CRITICAL: Clear selected pending transaction for new transaction
    setSelectedPendingTransaction(null)
    
    setShowTransactionForm(true)
    // Clear any existing modal states from history, then push new one
    if (typeof window !== 'undefined') {
      // If we're already in a modal, replace the current state instead of adding to stack
      const currentState = window.history.state
      if (currentState && currentState.view) {
        window.history.replaceState({ 
          view: 'transaction-form', 
          pathname: window.location.pathname 
        }, '', window.location.href)
      } else {
        window.history.pushState({ 
          view: 'transaction-form', 
          pathname: window.location.pathname 
        }, '', window.location.href)
      }
    }
  }

  const handleTransactionSuccess = (result) => {
    setShowTransactionForm(false)
    fetchDashboardData()
    fetchPendingTransactions() // Refresh pending list
  }

  const handleTransactionCancel = () => {
    setShowTransactionForm(false)
  }

  const handleViewHistory = () => {
    // Clear all other modals first
    setShowTransactionForm(false)
    setShowStockManagement(false)
    setShowShiftReport(false)
    setShowCustomerManagement(false)
    
    fetchTransactionHistory()
    setShowTransactionHistory(true)
    // Clear any existing modal states from history, then push new one
    if (typeof window !== 'undefined') {
      // If we're already in a modal, replace the current state instead of adding to stack
      const currentState = window.history.state
      if (currentState && currentState.view) {
        window.history.replaceState({ 
          view: 'transaction-history', 
          pathname: window.location.pathname 
        }, '', window.location.href)
      } else {
        window.history.pushState({ 
          view: 'transaction-history', 
          pathname: window.location.pathname 
        }, '', window.location.href)
      }
    }
  }

  const handleUpdateMachine = (machine) => {
    setSelectedMachine(machine)
    setShowMachineModal(true)
  }

  const handleMakeAllAvailable = async () => {
    try {
      setMakeAllAvailableLoading(true)
      
      const response = await fetch('/api/machines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'make_all_available',
          cabang_id: user.cabang_id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to make all machines available')
      }

      if (data.success) {
        // Show success modal
        setShowSuccessModal(true)

        // Clear machines cache after bulk update
        if (typeof window !== 'undefined' && window.machineCache) {
          const machinesCacheKey = `machines_${user.cabang_id}`
          window.machineCache.delete(machinesCacheKey)
          console.log('🗑️ Cleared machines cache after bulk update')
        }

        // Refresh dashboard data to show updated machine status
        await fetchDashboardData()
      } else {
        throw new Error(data.message || 'Unknown error occurred')
      }
    } catch (error) {
      console.error('Make all available error:', error)
      alert(`❌ Gagal membuat semua mesin tersedia: ${error.message}`)
    } finally {
      setMakeAllAvailableLoading(false)
    }
  }

  const handleMachineUpdateSuccess = () => {
    setShowMachineModal(false)
    setSelectedMachine(null)

    // Clear machines cache after update
    if (typeof window !== 'undefined' && window.machineCache) {
      const machinesCacheKey = `machines_${user.cabang_id}`
      window.machineCache.delete(machinesCacheKey)
      console.log('🗑️ Cleared machines cache after status update')
    }

    fetchDashboardData()
  }

  const handleUpdateStock = () => {
    // Clear all other modals first
    setShowTransactionForm(false)
    setShowTransactionHistory(false)
    setShowShiftReport(false)
    setShowCustomerManagement(false)
    
    setShowStockManagement(true)
    // Clear any existing modal states from history, then push new one
    if (typeof window !== 'undefined') {
      // If we're already in a modal, replace the current state instead of adding to stack
      const currentState = window.history.state
      if (currentState && currentState.view) {
        window.history.replaceState({ 
          view: 'stock-management', 
          pathname: window.location.pathname 
        }, '', window.location.href)
      } else {
        window.history.pushState({ 
          view: 'stock-management', 
          pathname: window.location.pathname 
        }, '', window.location.href)
      }
    }
  }

  const handleStockManagementClose = () => {
    setShowStockManagement(false)
    setSelectedNotificationRequest(null) // Clear selected request

    window.history.replaceState(null, '', window.location.pathname)
  }

  const handleStockManagementSuccess = () => {
    setShowStockManagement(false)
    fetchDashboardData()
  }

  const handleEditPendingTransaction = (transaction) => {
    // Set transaction for editing and close pending modal
    setSelectedPendingTransaction(transaction)
    setShowPendingModal(false)
    
    // Open transaction form in edit mode
    setShowTransactionForm(true)
    
    // Add to browser history for back button support
    if (typeof window !== 'undefined') {
      const currentState = window.history.state
      if (currentState && currentState.view) {
        window.history.replaceState({ 
          view: 'transaction-form', 
          editMode: true,
          transactionId: transaction.id_transaksi,
          pathname: window.location.pathname 
        }, '', window.location.href)
      } else {
        window.history.pushState({ 
          view: 'transaction-form', 
          editMode: true,
          transactionId: transaction.id_transaksi,
          pathname: window.location.pathname 
        }, '', window.location.href)
      }
    }
  }

  const handlePayPendingTransactionForm = (transaction) => {
    // Set transaction for payment and close pending modal
    setSelectedPendingTransaction({...transaction, _jumpToPayment: true})
    setShowPendingModal(false)
    
    // Open transaction form in edit mode, will jump to step 4 (payment)
    setShowTransactionForm(true)
    
    // Add to browser history for back button support
    if (typeof window !== 'undefined') {
      const currentState = window.history.state
      if (currentState && currentState.view) {
        window.history.replaceState({ 
          view: 'transaction-form', 
          editMode: true,
          paymentMode: true,
          transactionId: transaction.id_transaksi,
          pathname: window.location.pathname 
        }, '', window.location.href)
      } else {
        window.history.pushState({ 
          view: 'transaction-form', 
          editMode: true,
          paymentMode: true,
          transactionId: transaction.id_transaksi,
          pathname: window.location.pathname 
        }, '', window.location.href)
      }
    }
  }

  // Handle cancel pending transaction - show confirmation modal
  const handleCancelPendingTransaction = (transaction) => {
    setCancelConfirmation({
      show: true,
      transaction: transaction,
      loading: false
    })
  }

  // Confirm cancel transaction
  const confirmCancelTransaction = async () => {
    const transaction = cancelConfirmation.transaction

    setCancelConfirmation(prev => ({ ...prev, loading: true }))

    try {
      const response = await fetch(`/api/transactions/${transaction.id_transaksi}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status_transaksi: 'dibatalkan'
        })
      })

      if (response.ok) {
        // Close modal
        setCancelConfirmation({ show: false, transaction: null, loading: false })

        // Refresh pending transactions list
        await fetchPendingTransactions()
        await fetchDashboardData()

        // Show success modal
        setCancelSuccess({ show: true, transactionCode: transaction.kode_transaksi })
      } else {
        const error = await response.json()
        setCancelConfirmation(prev => ({ ...prev, loading: false }))
        alert(`❌ Gagal membatalkan transaksi: ${error.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error canceling transaction:', error)
      setCancelConfirmation(prev => ({ ...prev, loading: false }))
      alert(`❌ Terjadi kesalahan: ${error.message}`)
    }
  }

  // Handle direct payment for pending transaction
  const handlePayPendingTransaction = async (transactionId, paymentMethod) => {
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
        // Refresh dashboard data to remove from pending list
        await fetchDashboardData()

        // Show success message
        alert(`✅ Transaksi berhasil dibayar dengan ${paymentMethod.toUpperCase()}!`)
      } else {
        const error = await response.json()
        alert(`❌ Gagal memproses pembayaran: ${error.message}`)
      }
    } catch (error) {
      console.error('Error processing payment:', error)
      alert(`❌ Terjadi kesalahan saat memproses pembayaran: ${error.message}`)
    }
  }

  // Handle payment via modal (keep existing function for other flows)  
  const handlePayPendingTransactionModal = (transaction) => {
    setSelectedPendingTransaction(transaction)
    setShowPendingModal(false)
    setShowPaymentMethodModal(true)
  }

  const handlePaymentMethodSelect = (paymentMethod) => {
    setPaymentConfirmation({
      show: true,
      method: paymentMethod,
      transaction: selectedPendingTransaction
    })
    setShowPaymentMethodModal(false)
  }

  const handleConfirmPayment = async () => {
    try {
      const response = await fetch(`/api/transactions/${paymentConfirmation.transaction.id_transaksi}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status_transaksi: 'selesai',
          metode_pembayaran: paymentConfirmation.method
        })
      })

      if (response.ok) {
        // Get updated transaction data for receipt
        const updatedTransaction = {
          ...paymentConfirmation.transaction,
          status_transaksi: 'selesai',
          metode_pembayaran: paymentConfirmation.method
        }
        
        setCompletedPaymentTransaction(updatedTransaction)
        setPaymentConfirmation({ show: false, method: '', transaction: null })
        setShowReceiptModal(true)
        
        // Refresh data
        fetchPendingTransactions()
        fetchDashboardData()
      } else {
        throw new Error('Gagal mengkonfirmasi pembayaran')
      }
    } catch (error) {
      console.error('Error confirming payment:', error)
      alert('Error: ' + error.message)
    }
  }

  const handleShiftReport = () => {
    // Clear all other modals first
    setShowTransactionForm(false)
    setShowTransactionHistory(false)
    setShowStockManagement(false)
    setShowCustomerManagement(false)
    
    setShowShiftReport(true)
    // Clear any existing modal states from history, then push new one
    if (typeof window !== 'undefined') {
      // If we're already in a modal, replace the current state instead of adding to stack
      const currentState = window.history.state
      if (currentState && currentState.view) {
        window.history.replaceState({ 
          view: 'shift-report', 
          pathname: window.location.pathname 
        }, '', window.location.href)
      } else {
        window.history.pushState({ 
          view: 'shift-report', 
          pathname: window.location.pathname 
        }, '', window.location.href)
      }
    }
  }

  const handleShowTransactionDetail = (transactionId) => {
    setSelectedTransactionId(transactionId)
    setShowDetailModal(true)
  }

  const handleCloseDetailModal = () => {
    setShowDetailModal(false)
    setSelectedTransactionId(null)
  }

  const handlePrintReceipt = (transaction) => {
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${transaction.kode_transaksi}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; margin: 20px; max-width: 300px; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .line { border-bottom: 1px dashed #000; margin: 10px 0; }
          .right { text-align: right; }
          .flex { display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="center bold">
          <h2>DWASH LAUNDRY</h2>
          <p>${transaction.nama_cabang}</p>
          <p>Self Service Laundry</p>
        </div>
        <div class="line"></div>
        <p><strong>Kode:</strong> ${transaction.kode_transaksi}</p>
        <p><strong>Tanggal:</strong> ${new Date(transaction.tanggal_transaksi).toLocaleString('id-ID')}</p>
        <p><strong>Pelanggan:</strong> ${transaction.nama_pelanggan}</p>
        <p><strong>Kasir:</strong> ${transaction.nama_karyawan}</p>
        <p><strong>Pembayaran:</strong> ${transaction.metode_pembayaran ? transaction.metode_pembayaran.toUpperCase() : 'BELUM DIBAYAR'}</p>
        <div class="line"></div>
        ${transaction.services?.map(service => `
          <div class="flex">
            <span>${service.nama_layanan} x${service.quantity}</span>
            <span>${service.subtotal.toLocaleString('id-ID', {style: 'currency', currency: 'IDR', minimumFractionDigits: 0})}</span>
          </div>
        `).join('') || ''}
        ${transaction.products?.map(product => `
          <div class="flex">
            <span>${product.nama_produk} x${product.quantity}</span>
            <span>${product.subtotal.toLocaleString('id-ID', {style: 'currency', currency: 'IDR', minimumFractionDigits: 0})}</span>
          </div>
        `).join('') || ''}
        <div class="line"></div>
        <div class="flex bold">
          <span>TOTAL:</span>
          <span>${transaction.total_keseluruhan.toLocaleString('id-ID', {style: 'currency', currency: 'IDR', minimumFractionDigits: 0})}</span>
        </div>
        <div class="line"></div>
        <p class="center">Terima kasih!</p>
        <p class="center">Simpan nota ini sebagai bukti</p>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
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
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStockStatusColor = (status) => {
    switch (status) {
      case 'critical': return 'bg-red-50 text-red-600'
      case 'warning': return 'bg-yellow-50 text-yellow-600'
      case 'low': return 'bg-orange-50 text-orange-600'
      default: return 'bg-gray-50 text-gray-600'
    }
  }

  const getMachineStatusColor = (status) => {
    switch (status) {
      case 'tersedia': return 'bg-green-50 border-green-200 text-green-600'
      case 'rusak': return 'bg-red-50 border-red-200 text-red-600'
      default: return 'bg-gray-50 border-gray-200 text-gray-600'
    }
  }

  const getMachineStatusText = (status) => {
    switch (status) {
      case 'tersedia': return 'Tersedia'
      case 'rusak': return 'Rusak'
      default: return status
    }
  }

  const getPaymentMethodBadge = (method) => {
    const colors = {
      'tunai': 'bg-green-100 text-green-800',
      'qris': 'bg-blue-100 text-blue-800'
    }
    return `px-2 py-1 rounded-full text-xs font-medium ${colors[method] || 'bg-gray-100 text-gray-800'}`
  }

  // Show Transaction Form
  if (showTransactionForm) {
    console.log('🔍 [KasirDashboard] Sending user to TransactionForm:', user)
    console.log('🔍 [KasirDashboard] user.current_shift:', user.current_shift)
    console.log('🔍 [KasirDashboard] user.shift:', user.shift)

    return (
      <TransactionForm
        user={user}
        onSuccess={handleTransactionSuccess}
        onCancel={handleTransactionCancel}
        editMode={selectedPendingTransaction ? true : false}
        existingTransaction={selectedPendingTransaction}
      />
    )
  }

  // Show Stock Management
  if (showStockManagement) {
    return (
      <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
        <div className="w-full mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleStockManagementClose}
              className="flex items-center justify-center w-12 h-12 text-2xl text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              ←
            </button>
            <div className="text-center flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Manajemen Stok</h1>
              <p className="text-sm text-gray-600">{user.cabang}</p>
            </div>
            <div className="w-10"></div> {/* Spacer for centering */}
          </div>
          <StockManagement
            user={user}
            selectedNotificationRequest={selectedNotificationRequest}
            onClearSelectedRequest={() => setSelectedNotificationRequest(null)}
          />
        </div>
      </div>
    )
  }

  // Show Shift Report
  if (showShiftReport) {
    return (
      <div className="bg-gray-50 p-2 sm:p-4">
        <div className="w-full mx-auto flex flex-col">
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <button
              onClick={() => setShowShiftReport(false)}
              className="flex items-center justify-center w-12 h-12 text-2xl text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              ←
            </button>
            <div className="text-center flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Laporan Keuangan</h1>
              <p className="text-sm text-gray-600">{user.cabang}</p>
            </div>
            <div className="w-12"></div>
          </div>
          <div className="flex-1">
            <FinancialReport user={user} onClose={() => setShowShiftReport(false)} />
          </div>
        </div>
      </div>
    )
  }

  // Show Customer Management
  if (showCustomerManagement) {
    return (
      <div className="bg-gray-50 p-2 sm:p-4">
        <div className="w-full mx-auto flex flex-col">
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <button
              onClick={() => {
                setShowCustomerManagement(false)
                // Clear browser history entry
                if (typeof window !== 'undefined') {
                  window.history.replaceState(null, '', window.location.pathname)
                }
              }}
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
              onPayTransaction={handlePayPendingTransactionForm}
              cacheConfig={{ enabled: false, timeout: 0 }} // No cache for kasir - always fresh data
              user={user}
            />
          </div>
        </div>
      </div>
    )
  }


  // Show Transaction History
  if (showTransactionHistory) {
    return (
      <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
        <div className="w-full mx-auto">
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <button
              onClick={() => {
                setShowTransactionHistory(false)
                // Go back in browser history if possible
                if (window.history.length > 1) {
                  window.history.back()
                }
              }}
              className="flex items-center justify-center w-12 h-12 text-2xl text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              ←
            </button>
            <div className="text-center flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Riwayat Transaksi</h1>
              <p className="text-sm text-gray-600">{user.cabang}</p>
            </div>
            <div className="w-12"></div> {/* Spacer for centering */}
          </div>
          <div className="space-y-4 sm:space-y-6">

        <Card>
          <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-base sm:text-lg font-semibold">Riwayat Transaksi</h3>
              <div className="text-xs sm:text-sm text-dwash-gray">
                Total: {transactionHistory.length} transaksi
              </div>
            </div>

            {/* Date Filter Controls - Mobile Optimized */}
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={getMinDate()}
                    max={getMaxDate()}
                    className="w-full h-11 px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-dwash-red focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Shift</label>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value)}
                    className="w-full h-11 px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-dwash-red focus:border-transparent"
                  >
                    <option value="semua">Semua Shift</option>
                    <option value="pagi">Shift Pagi</option>
                    <option value="malam">Shift Malam</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {transactionHistory.length > 0 ? (
            <div className="space-y-4">
              {/* Pagination Info */}
              <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg">
                <span>
                  📊 Menampilkan {Math.min(transactionPagination.itemsPerPage, transactionHistory.length)} dari {transactionHistory.length} transaksi
                </span>
                <span className="text-dwash-red font-medium">
                  Halaman {transactionPagination.currentPage}
                </span>
              </div>
              
              <div className="space-y-2 sm:space-y-3">
                {transactionHistory
                  .slice(
                    (transactionPagination.currentPage - 1) * transactionPagination.itemsPerPage,
                    transactionPagination.currentPage * transactionPagination.itemsPerPage
                  )
                  .map((transaction) => (
                <div 
                  key={transaction.id_transaksi} 
                  className="p-3 sm:p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors duration-200 active:bg-gray-100"
                  onClick={() => handleShowTransactionDetail(transaction.id_transaksi)}
                  title="Klik untuk melihat detail transaksi"
                >
                  {/* Mobile Layout - Stack Vertically */}
                  <div className="space-y-2 sm:space-y-0">
                    {/* Top Row - Code and Amount */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs sm:text-sm font-medium text-dwash-dark">
                        {transaction.kode_transaksi}
                      </span>
                      <span className="font-bold text-dwash-red text-sm sm:text-base">
                        {formatCurrency(transaction.total_keseluruhan)}
                      </span>
                    </div>
                    
                    {/* Middle Row - Customer and Payment Badge */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-dwash-gray truncate pr-2">
                        👤 {transaction.nama_pelanggan}
                      </span>
                      <span className={`${getPaymentMethodBadge(transaction.metode_pembayaran)} text-xs px-2 py-1 rounded-full whitespace-nowrap`}>
                        {transaction.metode_pembayaran ? transaction.metode_pembayaran.toUpperCase() : 'BELUM DIBAYAR'}
                      </span>
                    </div>
                    
                    {/* Bottom Row - Date and View Icon */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      <span className="text-xs text-dwash-gray">
                        🕒 {formatDateTime(transaction.tanggal_transaksi)}
                      </span>
                      <span className="text-gray-400 text-xs">👁️ Lihat Detail</span>
                    </div>
                  </div>
                </div>
                ))}
              </div>
              
              {/* Pagination Controls */}
              {transactionHistory.length > transactionPagination.itemsPerPage && (
                <div className="flex flex-col sm:flex-row items-center justify-between border-t pt-4 space-y-3 sm:space-y-0">
                  <button
                    onClick={() => setTransactionPagination(prev => ({
                      ...prev,
                      currentPage: Math.max(1, prev.currentPage - 1)
                    }))}
                    disabled={transactionPagination.currentPage === 1}
                    className="flex items-center px-3 py-2 text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded-lg transition-colors w-full sm:w-auto justify-center"
                  >
                    ← Sebelumnya
                  </button>
                  
                  <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto pb-2 sm:pb-0">
                    {Array.from({ 
                      length: Math.min(5, Math.ceil(transactionHistory.length / transactionPagination.itemsPerPage)) 
                    }, (_, i) => {
                      const totalPages = Math.ceil(transactionHistory.length / transactionPagination.itemsPerPage)
                      let pageNumber
                      
                      if (totalPages <= 5) {
                        pageNumber = i + 1
                      } else if (transactionPagination.currentPage <= 3) {
                        pageNumber = i + 1
                      } else if (transactionPagination.currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i
                      } else {
                        pageNumber = transactionPagination.currentPage - 2 + i
                      }
                      
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => setTransactionPagination(prev => ({
                            ...prev,
                            currentPage: pageNumber
                          }))}
                          className={`w-8 h-8 sm:w-10 sm:h-10 text-xs sm:text-sm rounded-lg transition-colors flex-shrink-0 ${
                            pageNumber === transactionPagination.currentPage
                              ? 'bg-dwash-red text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      )
                    })}
                  </div>
                  
                  <button
                    onClick={() => setTransactionPagination(prev => ({
                      ...prev,
                      currentPage: Math.min(
                        Math.ceil(transactionHistory.length / prev.itemsPerPage),
                        prev.currentPage + 1
                      )
                    }))}
                    disabled={transactionPagination.currentPage >= Math.ceil(transactionHistory.length / transactionPagination.itemsPerPage)}
                    className="flex items-center px-3 py-2 text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded-lg transition-colors w-full sm:w-auto justify-center"
                  >
                    Selanjutnya →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-dwash-gray">
              <span className="text-4xl mb-4 block">📝</span>
              <p>Belum ada transaksi hari ini</p>
            </div>
          )}
        </Card>

        {/* Transaction Detail Modal - Tambahkan di Transaction History juga */}
        <TransactionDetailModal
          transactionId={selectedTransactionId}
          isOpen={showDetailModal}
          onClose={handleCloseDetailModal}
          onPrintReceipt={handlePrintReceipt}
          currentUser={user}
        />
          </div>
        </div>
      </div>
    )
  }

  // Loading State
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dwash-red"></div>
      </div>
    )
  }

  // Error State
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error: {error}</p>
        <button 
          onClick={fetchDashboardData}
          className="mt-2 text-sm text-red-600 underline"
        >
          Coba lagi
        </button>
      </div>
    )
  }

  if (!dashboardData) {
    return <div>No data available</div>
  }

  const { stats, machines, inventory } = dashboardData

  // Main Dashboard - Enhanced Responsive
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Feedback Alert Banner */}
      <div className="sticky top-0 z-40 bg-blue-50 border-b border-blue-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-1">
            <span className="text-blue-600 text-lg">💬</span>
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-blue-800">
                Luangin waktu sebentar yuk buat review aplikasi ini 😊
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowFeedbackModal(true)}
            className="ml-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm rounded-lg transition-colors whitespace-nowrap"
          >
            <span className="hidden sm:inline">Kirim Feedback</span>
            <span className="sm:hidden">Feedback</span>
          </button>
        </div>
      </div>

{/* Header dengan Notification Bell */} <div className="bg-white border-b border-gray-200 px-4 py-1 sm:px-6 sm:py-3 shadow-sm rounded-lg"> <div className="flex items-center justify-between"> <div> <h1 className="text-lg sm:text-xl font-bold text-gray-900">Dashboard Kasir</h1> <p className="text-sm text-gray-600">{user.name} - {user.cabang}</p> </div> <div className="flex items-center space-x-3"> <NotificationDropdown /> <div className="text-right"> <div className="text-xs text-gray-500">Login pada</div> <div className="text-sm font-medium text-gray-900"> {loginTime.toLocaleString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} </div> </div> </div> </div> </div> {/* ENHANCED TRANSACTION BUTTON - Mobile First */} <div className="px-4"> <Button onClick={handleNewTransaction} size="lg" className="w-full bg-dwash-red hover:bg-red-600 active:bg-red-700 text-white font-bold py-3 sm:py-4 px-4 sm:px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 min-h-[48px] sm:min-h-[56px]" > <span className="text-xl sm:text-2xl mr-2 sm:mr-3">+</span> <span className="text-sm sm:text-lg font-semibold">TRANSAKSI BARU</span> </Button> </div>


      {/* Enhanced Pending Transactions Alert - Mobile Optimized */}
      {pendingTransactions.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-orange-400 p-3 sm:p-4 mb-4 sm:mb-6 rounded-lg shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start sm:items-center">
              <div className="bg-orange-200 rounded-full p-2 mr-3 flex-shrink-0">
                <span className="text-orange-700 text-base sm:text-lg">⏰</span>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-orange-800 text-xs sm:text-sm lg:text-base leading-tight">
                  {pendingTransactions.length} Transaksi Menunggu Pembayaran
                </h4>
                <p className="text-xs text-orange-600 mt-1">
                  Total: {formatCurrency(pendingTransactions.reduce((sum, t) => sum + parseFloat(t.total_keseluruhan || 0), 0))}
                </p>
              </div>
            </div>
            <Button 
              size="sm" 
              onClick={() => setShowPendingModal(true)}
              className="bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg shadow-md w-full sm:w-auto flex-shrink-0 min-h-[40px]"
            >
              <span className="sm:hidden">💳 Bayar ({pendingTransactions.length})</span>
              <span className="hidden sm:inline">👀 Lihat & Bayar</span>
            </Button>
          </div>
        </div>
      )}

      {/* Enhanced Stats Cards - Mobile First Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <StatsCard
          title="Pendapatan Cabang"
          value={formatCurrency(stats.revenue || 0)}
          subtitle={`${stats.transactions || 0} transaksi`}
          icon="💰"
          color="green"
        />
        <StatsCard
          title="Pendapatan Tunai"
          value={formatCurrency(stats.revenue_breakdown?.tunai || 0)}
          subtitle={`${stats.revenue_breakdown?.tunai_count || 0} transaksi`}
          icon="💵"
          color="blue"
          warning={(stats.fee_kasir_shift || 0) > (stats.revenue_breakdown?.tunai || 0)}
          warningMessage="⚠️ Fee Jasa Lipat lebih besar dari Pendapatan Tunai"
        />
        <StatsCard
          title="Pendapatan QRIS"
          value={formatCurrency(stats.revenue_breakdown?.qris || 0)}
          subtitle={`${stats.revenue_breakdown?.qris_count || 0} transaksi`}
          icon="📱"
          color="purple"
        />
        <StatsCard
          title="Fee Jasa Lipat"
          value={formatCurrency(stats.fee_kasir_shift || 0)}
          subtitle={`dari ${stats.ckl_count || 0} CKL`}
          icon="🧺"
          color="orange"
        />
      </div>

      {/* Inventory Alert */}
      {inventory && inventory.length > 0 && (
        <InventoryAlert 
          inventory={inventory}
          onClick={handleUpdateStock}
        />
      )}


      {/* Simple Quick Actions */}
      <Card>
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Menu Utama</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => {
              // Clear all other modals first
              setShowTransactionForm(false)
              setShowTransactionHistory(false)
              setShowStockManagement(false)
              setShowShiftReport(false)
              
              setShowCustomerManagement(true)
              // Clear any existing modal states from history, then push new one
              if (typeof window !== 'undefined') {
                // If we're already in a modal, replace the current state instead of adding to stack
                const currentState = window.history.state
                if (currentState && currentState.view) {
                  window.history.replaceState({ 
                    view: 'customer-management', 
                    pathname: window.location.pathname 
                  }, '', window.location.href)
                } else {
                  window.history.pushState({ 
                    view: 'customer-management', 
                    pathname: window.location.pathname 
                  }, '', window.location.href)
                }
              }
            }}
            className="h-24 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex flex-col items-center justify-center space-y-2 transition-colors duration-200 font-medium"
          >
            <span className="text-2xl">👥</span>
            <span className="text-sm">Kelola Pelanggan</span>
          </button>
          
          <button
            onClick={handleViewHistory}
            className="h-24 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex flex-col items-center justify-center space-y-2 transition-colors duration-200 font-medium"
          >
            <span className="text-2xl">📋</span>
            <span className="text-sm">Transaksi</span>
          </button>
          
          <button
            onClick={handleUpdateStock}
            className="h-24 bg-green-500 hover:bg-green-600 text-white rounded-lg flex flex-col items-center justify-center space-y-2 transition-colors duration-200 font-medium"
          >
            <span className="text-2xl">📦</span>
            <span className="text-sm">Kelola Stok</span>
          </button>
          
          <button
            onClick={handleShiftReport}
            className="h-24 bg-purple-500 hover:bg-purple-600 text-white rounded-lg flex flex-col items-center justify-center space-y-2 transition-colors duration-200 font-medium"
          >
            <span className="text-2xl">📊</span>
            <span className="text-sm">Laporan</span>
          </button>
        </div>
      </Card>

      {/* Machine Status & Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Stok Produk</h3>
            <button
              onClick={handleUpdateStock}
              className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded font-medium transition-colors duration-200"
            >
              Kelola Stok
            </button>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {inventory && inventory.length > 0 ? (
              inventory.map((item, index) => (
                <div 
                  key={item.id || index}
                  className={`flex items-center justify-between p-3 rounded-lg ${getStockStatusColor(item.status)}`}
                >
                  <span>{item.nama_produk}</span>
                  <div className="text-right">
                    <span className="font-medium">
                      {item.stok_tersedia} {item.satuan}
                    </span>
                    {item.status !== 'good' && (
                      <span className="ml-2">
                        {item.status === 'critical' ? '⚠️⚠️' : 
                         item.status === 'low' ? '⚠️' : '⚠️'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-dwash-gray">
                Tidak ada data stok
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Status Mesin - {user.cabang}</h3>
            <div className="flex gap-2">
              <button 
                onClick={handleMakeAllAvailable}
                disabled={makeAllAvailableLoading}
                className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded font-medium transition-colors duration-200 disabled:opacity-50"
              >
                {makeAllAvailableLoading ? '⏳' : '🔓'} Tersedia Semua
              </button>
            </div>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {machines && machines.length > 0 ? (
              machines.map((machine, index) => (
                  <div 
                    key={machine.id || index}
                    className={`p-3 rounded-lg border ${getMachineStatusColor(machine.status_mesin)}`}
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${
                          machine.status_mesin === 'tersedia' ? 'bg-green-500' :
                          machine.status_mesin === 'rusak' ? 'bg-red-500' : 'bg-gray-500'
                        }`}></div>
                        <span className="font-medium">
                          {machine.jenis_mesin === 'cuci' ? 'Cuci' : 'Pengering'} {machine.nomor_mesin}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUpdateMachine(machine)}
                        className="text-xs bg-dwash-red hover:bg-red-600 text-white px-3 py-1 rounded font-medium transition-colors duration-200"
                      >
                        Update
                      </button>
                    </div>

                    {/* Status Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-600">
                          {getMachineStatusText(machine.status_mesin)}
                        </span>
                      </div>
                    </div>
                  </div>
              ))
            ) : (
              <div className="text-center py-4 text-dwash-gray">
                Tidak ada data mesin
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Transactions - Clickable */}
      {dashboardData.recent_transactions && dashboardData.recent_transactions.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Transaksi Terbaru</h3>
            <button
              onClick={handleViewHistory}
              className="text-sm text-dwash-red hover:text-red-600"
            >
              Lihat Semua →
            </button>
          </div>
          <div className="space-y-3">
            {dashboardData.recent_transactions.slice(0, 3).map((transaction) => (
              <div 
                key={transaction.code || transaction.id} 
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors duration-200"
                onClick={() => {
                  // Gunakan transaction.id atau transaction.id_transaksi atau transaction.transaction_id
                  const transactionId = transaction.id || transaction.id_transaksi || transaction.transaction_id
                  handleShowTransactionDetail(transactionId)
                }}
                title="Klik untuk melihat detail transaksi"
              >
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-sm">{transaction.code}</span>
                  <span className="text-sm text-dwash-gray">{transaction.customer}</span>
                </div>
                <div className="text-right">
                  <div className="font-medium text-dwash-red">
                    {formatCurrency(transaction.amount)}
                  </div>
                  <div className="text-xs text-dwash-gray">
                    {formatDateTime(transaction.date)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modals */}
      <MachineStatusModal
        machine={selectedMachine}
        isOpen={showMachineModal}
        onClose={() => setShowMachineModal(false)}
        onUpdateSuccess={handleMachineUpdateSuccess}
      />

      <TransactionDetailModal
        transactionId={selectedTransactionId}
        isOpen={showDetailModal}
        onClose={handleCloseDetailModal}
        onPrintReceipt={handlePrintReceipt}
        currentUser={user}
      />

      {/* Pending Transactions Modal */}
      <Modal
        isOpen={showPendingModal}
        onClose={() => {
          setShowPendingModal(false)
          setPendingPage(1) // Reset page saat close
        }}
        title={`${pendingTransactions.length} Transaksi Menunggu Pembayaran`}
        size="md"
      >
        <div className="space-y-3">
          {(() => {
            const totalPages = Math.ceil(pendingTransactions.length / PENDING_PER_PAGE)
            const startIndex = (pendingPage - 1) * PENDING_PER_PAGE
            const endIndex = startIndex + PENDING_PER_PAGE
            const paginatedTransactions = pendingTransactions.slice(startIndex, endIndex)

            return (
              <>
                {paginatedTransactions.map((transaction) => (
            <div key={transaction.id_transaksi} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {/* Mobile Layout - Optimized */}
              <div className="block sm:hidden">
                {/* Header Section - Kode & Tanggal */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-gray-900 text-sm">
                        {transaction.kode_transaksi}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {(() => {
                          const date = new Date(transaction.tanggal_transaksi);
                          const day = date.getDate();
                          const month = date.toLocaleString('id-ID', { month: 'long', timeZone: 'Asia/Jakarta' });
                          const year = date.getFullYear();
                          const hours = date.toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta', hour12: false }).replace(':', '.');
                          return `${day} ${month} ${year}, ${hours} WIB`;
                        })()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancelPendingTransaction(transaction)}
                      className="hover:bg-red-50 active:scale-95 text-red-600 text-xl p-2 rounded-lg transition-all"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Customer & Amount Section */}
                <div className="px-4 py-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 mb-0.5">Pelanggan</div>
                      <div className="font-medium text-gray-900 text-sm truncate">
                        {transaction.nama_pelanggan}
                      </div>
                    </div>
                    <div className="ml-3 text-right">
                      <div className="text-xs text-gray-500 mb-0.5">Total</div>
                      <div className="font-bold text-base text-red-600">
                        {formatCurrency(transaction.total_keseluruhan)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="px-4 pb-3 pt-2 border-t border-gray-100">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditPendingTransaction(transaction)}
                      className="flex-1 bg-orange-50 border-2 border-orange-500 hover:bg-orange-100 active:scale-95 text-orange-700 text-xs font-semibold py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"
                    >
                      <span>✏️</span>
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handlePayPendingTransactionForm(transaction)}
                      className="flex-1 bg-green-50 border-2 border-green-500 hover:bg-green-100 active:scale-95 text-green-700 text-xs font-semibold py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"
                    >
                      <span>💳</span>
                      <span>Bayar</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Desktop Layout */}
              <div className="hidden sm:block">
                {/* Header Section - Kode & Tanggal */}
                <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-gray-900 text-base">
                        {transaction.kode_transaksi}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {(() => {
                          const date = new Date(transaction.tanggal_transaksi);
                          const day = date.getDate();
                          const month = date.toLocaleString('id-ID', { month: 'long', timeZone: 'Asia/Jakarta' });
                          const year = date.getFullYear();
                          const hours = date.toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta', hour12: false }).replace(':', '.');
                          return `${day} ${month} ${year}, ${hours} WIB`;
                        })()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancelPendingTransaction(transaction)}
                      className="hover:bg-red-50 active:scale-95 text-red-600 text-2xl p-2 rounded-lg transition-all"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Customer & Amount Section */}
                <div className="px-5 py-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-500 mb-0.5">Pelanggan</div>
                      <div className="font-medium text-gray-900 text-base truncate">
                        {transaction.nama_pelanggan}
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-sm text-gray-500 mb-0.5">Total</div>
                      <div className="font-bold text-xl text-red-600">
                        {formatCurrency(transaction.total_keseluruhan)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="px-5 pb-3 pt-2 border-t border-gray-100">
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleEditPendingTransaction(transaction)}
                      className="flex-1 bg-orange-50 border-2 border-orange-500 hover:bg-orange-100 active:scale-95 text-orange-700 text-sm font-semibold py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>✏️</span>
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handlePayPendingTransactionForm(transaction)}
                      className="flex-1 bg-green-50 border-2 border-green-500 hover:bg-green-100 active:scale-95 text-green-700 text-sm font-semibold py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>💳</span>
                      <span>Bayar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
                ))}

                {paginatedTransactions.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    Tidak ada transaksi pending
                  </div>
                )}

                {/* Pagination - Only show if more than 3 transactions */}
                {pendingTransactions.length > PENDING_PER_PAGE && (
                  <div className="flex items-center justify-center space-x-2 pt-4 border-t border-gray-200">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPendingPage(prev => Math.max(1, prev - 1))}
                      disabled={pendingPage === 1}
                      className="px-3 py-1"
                    >
                      ← Prev
                    </Button>

                    <div className="flex items-center space-x-1">
                      {[...Array(Math.min(5, totalPages))].map((_, index) => {
                        let pageNum
                        if (totalPages <= 5) {
                          pageNum = index + 1
                        } else if (pendingPage <= 3) {
                          pageNum = index + 1
                        } else if (pendingPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + index
                        } else {
                          pageNum = pendingPage - 2 + index
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPendingPage(pageNum)}
                            className={`px-3 py-1 text-sm rounded min-w-[2.5rem] ${
                              pendingPage === pageNum
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
                      onClick={() => setPendingPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={pendingPage === totalPages}
                      className="px-3 py-1"
                    >
                      Next →
                    </Button>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </Modal>

      {/* Success Modal for Make All Available */}
      <Modal 
        isOpen={showSuccessModal} 
        onClose={() => setShowSuccessModal(false)}
        title="Berhasil!"
        size="md"
      >
        <div className="text-center py-4">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-xl font-semibold text-green-700 mb-2">
            Semua Mesin Berhasil Dibuat Tersedia!
          </h3>
          <p className="text-gray-600 mb-6">
            Status semua mesin di cabang {user.cabang} telah diubah menjadi tersedia.
          </p>
          <button
            onClick={() => setShowSuccessModal(false)}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            OK
          </button>
        </div>
      </Modal>

      {/* Payment Method Selection Modal */}
      <PaymentMethodModal 
        isOpen={showPaymentMethodModal}
        onClose={() => setShowPaymentMethodModal(false)}
        onSelectPayment={handlePaymentMethodSelect}
        loading={false}
        transaction={selectedPendingTransaction}
      />

      {/* Payment Confirmation Modal */}
      <Modal 
        isOpen={paymentConfirmation.show} 
        onClose={() => setPaymentConfirmation({ show: false, method: '', transaction: null })}
        title="Konfirmasi Pembayaran"
        size="md"
      >
        {paymentConfirmation.transaction && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">💳</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Konfirmasi Pembayaran
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Pastikan pembayaran sudah diterima sebelum konfirmasi
                </p>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Kode Transaksi:</span>
                  <span className="font-mono text-sm font-semibold">{paymentConfirmation.transaction.kode_transaksi}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Pelanggan:</span>
                  <span className="text-sm font-medium">{paymentConfirmation.transaction.nama_pelanggan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Metode Pembayaran:</span>
                  <span className="text-sm font-medium text-blue-600">
                    {paymentConfirmation.method === 'tunai' ? '💰 TUNAI' : '📱 QRIS'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="font-medium text-gray-900">Total:</span>
                  <span className="font-bold text-lg text-green-600">
                    {formatCurrency(paymentConfirmation.transaction.total_keseluruhan)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <span className="text-yellow-600 mt-0.5">⚠️</span>
                <div className="text-sm text-yellow-800">
                  <strong>Perhatian:</strong> Pastikan pembayaran sudah benar-benar diterima. 
                  Setelah dikonfirmasi, transaksi tidak dapat dibatalkan.
                </div>
              </div>
            </div>
            
            <div className="flex justify-center space-x-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setPaymentConfirmation({ show: false, method: '', transaction: null })}
              >
                Batal
              </Button>
              <Button 
                onClick={handleConfirmPayment}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                ✓ Ya, Konfirmasi Pembayaran
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Transaction Confirmation Modal */}
      <Modal
        isOpen={cancelConfirmation.show}
        onClose={() => !cancelConfirmation.loading && setCancelConfirmation({ show: false, transaction: null, loading: false })}
        title="Batalkan Transaksi?"
        size="md"
      >
        {cancelConfirmation.transaction && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Konfirmasi Pembatalan
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Transaksi ini akan dibatalkan dan tidak dapat dipulihkan
                </p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Kode Transaksi:</span>
                  <span className="font-mono text-sm font-semibold">{cancelConfirmation.transaction.kode_transaksi}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Pelanggan:</span>
                  <span className="text-sm font-medium">{cancelConfirmation.transaction.nama_pelanggan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Tanggal:</span>
                  <span className="text-sm">
                    {new Date(cancelConfirmation.transaction.tanggal_transaksi).toLocaleString('id-ID', {
                      timeZone: 'Asia/Jakarta',
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="font-medium text-gray-900">Total:</span>
                  <span className="font-bold text-lg text-red-600">
                    {formatCurrency(cancelConfirmation.transaction.total_keseluruhan)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <span className="text-red-600 mt-0.5">🚫</span>
                <div className="text-sm text-red-800">
                  <strong>Peringatan:</strong> Status transaksi akan diubah menjadi &quot;DIBATALKAN&quot;.
                  Tindakan ini tidak dapat dibatalkan.
                </div>
              </div>
            </div>

            <div className="flex justify-center space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setCancelConfirmation({ show: false, transaction: null, loading: false })}
                disabled={cancelConfirmation.loading}
              >
                Tidak, Kembali
              </Button>
              <Button
                onClick={confirmCancelTransaction}
                disabled={cancelConfirmation.loading}
                className="bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
              >
                {cancelConfirmation.loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Membatalkan...
                  </>
                ) : (
                  '✓ Ya, Batalkan Transaksi'
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Success Modal */}
      <Modal
        isOpen={cancelSuccess.show}
        onClose={() => setCancelSuccess({ show: false, transactionCode: '' })}
        title="Pembatalan Berhasil"
        size="sm"
      >
        <div className="text-center py-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <span className="text-4xl">✅</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Transaksi Berhasil Dibatalkan
          </h3>
          <p className="text-sm text-gray-600 mb-1">
            Transaksi <span className="font-mono font-semibold">{cancelSuccess.transactionCode}</span>
          </p>
          <p className="text-sm text-gray-600 mb-6">
            telah dibatalkan dan dihapus dari daftar pending
          </p>
          <Button
            onClick={() => setCancelSuccess({ show: false, transactionCode: '' })}
            className="bg-green-500 hover:bg-green-600 text-white px-8"
          >
            OK
          </Button>
        </div>
      </Modal>

      {/* Receipt Modal after Payment */}
      <Modal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        title="Pembayaran Berhasil"
        size="md"
      >
        {completedPaymentTransaction && (
          <TransactionReceipt
            transaction={completedPaymentTransaction}
            onClose={() => setShowReceiptModal(false)}
          />
        )}
      </Modal>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        user={user}
      />
    </div>
  )
}
