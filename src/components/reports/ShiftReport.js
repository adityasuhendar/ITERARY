"use client"
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function ShiftReport({ user, onClose, selectedDate, setSelectedDate }) {
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedShift, setSelectedShift] = useState('semua')
  const [currentPage, setCurrentPage] = useState(1)
  const [transactionsPerPage] = useState(20)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)
  const [stokLoading, setStokLoading] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(true)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showShiftPicker, setShowShiftPicker] = useState(false)
  const [expenses, setExpenses] = useState([])
  const [expensesLoading, setExpensesLoading] = useState(false)

  useEffect(() => {
    fetchReportData()
    fetchExpenses()
    setCurrentPage(1)
  }, [selectedDate, selectedShift])

  const fetchReportData = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch(`/api/reports/shift?cabang_id=${user.cabang_id}&date=${selectedDate}&shift=${selectedShift}`)
      if (response.ok) {
        const data = await response.json()
        setReportData(data)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to fetch report data')
      }
    } catch (err) {
      setError(err.message)
      console.error('Fetch report error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchExpenses = async () => {
    try {
      setExpensesLoading(true)
      const params = new URLSearchParams({
        cabang_id: user.cabang_id,
        start_date: selectedDate,
        end_date: selectedDate
      })
      const response = await fetch(`/api/expenses?${params}`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setExpenses(data.expenses || [])
      } else {
        console.error('Failed to fetch expenses')
        setExpenses([])
      }
    } catch (error) {
      console.error('Error fetching expenses:', error)
      setExpenses([])
    } finally {
      setExpensesLoading(false)
    }
  }

  // Pagination logic
  const totalTransactions = reportData?.transactions?.length || 0
  const totalPages = Math.ceil(totalTransactions / transactionsPerPage)
  const startIndex = (currentPage - 1) * transactionsPerPage
  const endIndex = startIndex + transactionsPerPage
  const currentTransactions = reportData?.transactions?.slice(startIndex, endIndex) || []

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
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

  const formatDateOnly = (dateString) => {
    const date = new Date(dateString)
    const weekday = date.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long' })
    const fullDate = date.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'long', day: 'numeric' })
    return { weekday, fullDate }
  }

  const formatDateShort = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Get min and max date for date picker
  const getMinDate = () => {
    const today = new Date()
    const minDate = new Date(today)
    minDate.setDate(today.getDate() - 4) // 4 hari ke belakang
    return minDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  }

  const getMaxDate = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) // Hari ini (tidak bisa ke depan)
  }

  const handleDownloadPDF = async () => {
    if (pdfLoading) return
    try {
      setPdfLoading(true)
      const response = await fetch(`/api/reports/shift/pdf?cabang_id=${user.cabang_id}&date=${selectedDate}&shift=${selectedShift}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const contentDisposition = response.headers.get('Content-Disposition')
        const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/)
        a.download = filenameMatch ? filenameMatch[1] : `Laporan_Shift_${selectedDate}_${selectedShift}.pdf`
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
    if (excelLoading) return
    try {
      setExcelLoading(true)
      const response = await fetch(`/api/reports/shift/export?cabang_id=${user.cabang_id}&date=${selectedDate}&shift=${selectedShift}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const contentDisposition = response.headers.get('Content-Disposition')
        const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/)
        a.download = filenameMatch ? filenameMatch[1] : `Laporan_Shift_${selectedDate}_${selectedShift}.xlsx`
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

  const handleExportStok = async () => {
    if (stokLoading) return
    try {
      setStokLoading(true)
      const response = await fetch(`/api/reports/stock/pdf?branch_id=${user.cabang_id}&dateFrom=${selectedDate}&dateTo=${selectedDate}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const contentDisposition = response.headers.get('Content-Disposition')
        const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/)
        a.download = filenameMatch ? filenameMatch[1] : `Laporan_Stok_${user.cabang_id}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        throw new Error('Failed to export stock report')
      }
    } catch (error) {
      alert('Gagal export laporan stok: ' + error.message)
    } finally {
      setStokLoading(false)
    }
  }

  return (
    <div className="space-y-4">
        {/* Revenue Breakdown */}
        {reportData && (
          <Card className="overflow-hidden">
            <div className="p-3 sm:p-4 md:p-6">
              {/* Header with toggle */}
              <button
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="w-full flex items-center justify-between group hover:bg-gray-50 -mx-1 sm:-mx-2 px-1 sm:px-2 py-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-lg sm:text-xl">
                    📈
                  </div>
                  <div className="text-left">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900">Ringkasan Pendapatan</h3>
                    <p className="text-[10px] sm:text-xs text-gray-500">Detail perhitungan revenue</p>
                  </div>
                </div>
                <span className={`text-gray-400 transition-transform duration-200 ${showBreakdown ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {/* Inline Filters - Below Header */}
              <div className="mt-3 flex flex-wrap gap-2 sm:gap-3">
                {/* Date Picker */}
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">📅 Tanggal</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={getMinDate()}
                    max={getMaxDate()}
                    className="w-full h-11 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Shift Picker */}
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">⏰ Shift</label>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value)}
                    className="w-full h-11 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="semua">Semua Shift</option>
                    <option value="pagi">🌅 Shift Pagi</option>
                    <option value="malam">🌙 Shift Malam</option>
                  </select>
                </div>
              </div>
              <div className={`overflow-hidden transition-all duration-300 ${showBreakdown ? 'max-h-[800px] opacity-100 mt-3 sm:mt-4' : 'max-h-0 opacity-0'}`}>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-2.5 sm:p-3 md:p-4 space-y-2 sm:space-y-2.5 md:space-y-3 border border-blue-100">

                  {/* Report Info */}
                  <div className="bg-white/60 rounded-lg p-3 sm:p-2.5 md:p-3 border border-blue-200">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-2.5 md:gap-3">
                      <div>
                        <p className="text-[10px] sm:text-[10px] md:text-xs text-blue-600 font-medium mb-0.5">CABANG</p>
                        <p className="text-xs sm:text-xs md:text-sm font-bold text-blue-900 truncate">{reportData.info.cabang}</p>
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-[10px] md:text-xs text-blue-600 font-medium mb-0.5">SHIFT</p>
                        <p className="text-xs sm:text-xs md:text-sm font-bold text-blue-900 uppercase">{reportData.info.shift}</p>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <p className="text-[10px] sm:text-[10px] md:text-xs text-blue-600 font-medium mb-0.5">TANGGAL</p>
                        <div className="text-xs sm:text-xs md:text-sm font-bold text-blue-900">
                          <div className="sm:hidden md:block">
                            <div>{formatDateOnly(reportData.info.tanggal).weekday},</div>
                            <div>{formatDateOnly(reportData.info.tanggal).fullDate}</div>
                          </div>
                          <div className="hidden sm:block md:hidden">{formatDateShort(reportData.info.tanggal)}</div>
                        </div>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <p className="text-[10px] sm:text-[10px] md:text-xs text-blue-600 font-medium mb-0.5">KASIR</p>
                        <p className="text-xs sm:text-xs md:text-sm font-bold text-blue-900 truncate">{reportData.info.kasir}</p>
                      </div>
                    </div>
                  </div>

                  {/* Gross Revenue */}
                  <div className="flex items-center justify-between py-1 sm:py-2">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Pendapatan Kotor</span>
                    </div>
                    <span className="text-xs sm:text-base md:text-xl font-bold text-gray-900">
                      {formatCurrency(reportData.summary.total_pendapatan)}
                    </span>
                  </div>
                  {/* Payment Breakdown */}
                  <div className="ml-2 sm:ml-3 md:ml-5 space-y-1.5 sm:space-y-2 bg-white/50 rounded-lg p-2 sm:p-2.5 md:p-3 border border-blue-200">
                    <div className="flex items-center justify-between py-0.5 sm:py-1">
                      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                        <span className="text-green-600 text-xs sm:text-sm">💵</span>
                        <span className="text-[11px] sm:text-xs font-medium text-gray-600">Tunai</span>
                        <span className="text-[9px] sm:text-[10px] md:text-xs text-gray-400">({reportData.summary.transaksi_tunai}x)</span>
                      </div>
                      <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-gray-700">
                        {formatCurrency(reportData.summary.pendapatan_tunai || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-0.5 sm:py-1">
                      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                        <span className="text-blue-600 text-xs sm:text-sm">📱</span>
                        <span className="text-[11px] sm:text-xs font-medium text-gray-600">QRIS</span>
                        <span className="text-[9px] sm:text-[10px] md:text-xs text-gray-400">({reportData.summary.transaksi_qris}x)</span>
                      </div>
                      <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-gray-700">
                        {formatCurrency(reportData.summary.pendapatan_qris || 0)}
                      </span>
                    </div>
                  </div>
                  {/* Service/Product Breakdown */}
                  <div className="ml-2 sm:ml-3 md:ml-5 space-y-1.5 sm:space-y-2 bg-white/50 rounded-lg p-2 sm:p-2.5 md:p-3 border border-blue-200">
                    <div className="flex items-center justify-between py-0.5 sm:py-1">
                      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                        <span className="text-blue-600 text-xs sm:text-sm">🧺</span>
                        <span className="text-[11px] sm:text-xs font-medium text-gray-600">Layanan</span>
                      </div>
                      <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-gray-700">
                        {formatCurrency(reportData.summary.pendapatan_layanan || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-0.5 sm:py-1">
                      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                        <span className="text-purple-600 text-xs sm:text-sm">📦</span>
                        <span className="text-[11px] sm:text-xs font-medium text-gray-600">Produk</span>
                      </div>
                      <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-gray-700">
                        {formatCurrency(reportData.summary.pendapatan_produk || 0)}
                      </span>
                    </div>
                  </div>
                  {/* Fee Jasa Lipat */}
                  <div className="flex items-center justify-between py-1 sm:py-2">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className="text-xs sm:text-sm font-medium text-gray-700">Fee Jasa Lipat</span>
                      </div>
                      <span className="text-[10px] sm:text-xs text-gray-500 bg-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full border border-gray-200">
                        {reportData.summary.ckl_count || 0} CKL
                      </span>
                    </div>
                    <span className="text-sm sm:text-lg font-bold text-orange-600 shrink-0">
                      - {formatCurrency(reportData.summary.fee_kasir || 0)}
                    </span>
                  </div>

                  {/* Pengeluaran Operasional */}
                  {expenses.length > 0 && (
                    <>
                      <div className="flex items-center justify-between py-1 sm:py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span className="text-xs sm:text-sm font-medium text-gray-700">Pengeluaran Operasional</span>
                        </div>
                        <span className="text-sm sm:text-lg font-bold text-red-600 shrink-0">
                          - {formatCurrency(expenses.reduce((sum, exp) => sum + parseFloat(exp.jumlah), 0))}
                        </span>
                      </div>
                      {/* Expense Breakdown */}
                      <div className="ml-2 sm:ml-3 md:ml-5 space-y-1.5 sm:space-y-2 bg-white/50 rounded-lg p-2 sm:p-2.5 md:p-3 border border-blue-200">
                        {expenses.reduce((acc, expense) => {
                          const existing = acc.find(item => item.kategori === expense.kategori)
                          if (existing) {
                            existing.jumlah += parseFloat(expense.jumlah)
                          } else {
                            acc.push({ kategori: expense.kategori, jumlah: parseFloat(expense.jumlah) })
                          }
                          return acc
                        }, []).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between py-0.5 sm:py-1">
                            <span className="text-[11px] sm:text-xs font-medium text-gray-600">{item.kategori}</span>
                            <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-gray-700">
                              - {formatCurrency(item.jumlah)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="border-t-2 border-dashed border-blue-200 my-1 sm:my-2"></div>
                  {/* Net Revenue */}
                  <div className="flex items-center justify-between py-2 sm:py-2.5 md:py-3 bg-white rounded-lg px-3 sm:px-3 md:px-4 shadow-sm">
                    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center text-[10px] sm:text-xs md:text-sm">
                        ✓
                      </div>
                      <span className="text-xs sm:text-sm md:text-base font-bold text-gray-900">Pendapatan Bersih</span>
                    </div>
                    <span className="text-xs sm:text-base md:text-xl font-bold text-green-600 shrink-0">
                      {formatCurrency(
                        (reportData.summary.total_pendapatan || 0) -
                        (reportData.summary.fee_kasir || 0) -
                        expenses.reduce((sum, exp) => sum + parseFloat(exp.jumlah), 0)
                      )}
                    </span>
                  </div>

                  {/* Net Cash */}
                  <div className="flex items-center justify-between py-2 sm:py-2.5 md:py-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg px-2.5 sm:px-3 md:px-4 border border-green-200">
                    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 bg-gradient-to-br from-green-500 to-green-700 rounded-lg flex items-center justify-center text-[10px] sm:text-xs md:text-sm">
                        💵
                      </div>
                      <span className="text-xs sm:text-sm md:text-base font-bold text-green-900">Tunai Bersih</span>
                    </div>
                    <span className="text-xs sm:text-base md:text-xl font-bold text-green-700 shrink-0">
                      {formatCurrency((reportData.summary.pendapatan_tunai || 0) - (reportData.summary.fee_kasir || 0) - (reportData.summary.total_pengeluaran || 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dwash-red mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Memuat laporan...</p>
          </div>
        )}

        {error && (
          <Card className="mb-6">
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
              <p className="font-medium">❌ Error:</p>
              <p>{error}</p>
            </div>
          </Card>
        )}

        {reportData && (
          <div className="space-y-6">
            {/* Latest Transactions */}
            <Card>
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 sm:mb-0">📋 Transaksi Terbaru</h3>
                  <div className="flex flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={handleDownloadPDF}
                      size="sm"
                      disabled={pdfLoading || excelLoading}
                      className="w-full sm:w-auto bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-none shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      <span className="flex items-center justify-center space-x-1">
                        <span>{pdfLoading ? '⏳' : '📄'}</span>
                        <span>{pdfLoading ? 'Generating...' : 'Eksport Transaksi'}</span>
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleExportStok}
                      size="sm"
                      disabled={pdfLoading || stokLoading}
                      className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-none shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      <span className="flex items-center justify-center space-x-1">
                        <span>{stokLoading ? '⏳' : '📦'}</span>
                        <span>{stokLoading ? 'Exporting...' : 'Export Stok'}</span>
                      </span>
                    </Button>
                  </div>
                </div>

                {/* Mobile Card View */}
                <div className="block sm:hidden">
                  {currentTransactions.length > 0 ? (
                    <div className="space-y-2">
                      {currentTransactions.map((transaction, index) => (
                        <div key={index} className="bg-gray-50 rounded p-3 border">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-mono text-xs font-bold text-red-600">
                              {transaction.kode_transaksi}
                            </span>
                            <span className="font-bold text-sm">
                              {formatCurrency(transaction.total_keseluruhan)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="truncate mr-2">
                              {transaction.nama_pelanggan}
                            </span>
                            <span className="text-gray-500 shrink-0">
                              {transaction.metode_pembayaran?.toUpperCase() || 'BELUM'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500">
                              🕒 {formatDateTime(transaction.tanggal_transaksi)}
                            </span>
                            {selectedShift === 'semua' && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                transaction.shift_transaksi === 'pagi'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}>
                                {transaction.shift_transaksi === 'pagi' ? 'PAGI' : 'MALAM'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                      <div className="text-3xl mb-2">📝</div>
                      <p className="text-sm">Tidak ada transaksi pada periode ini</p>
                    </div>
                  )}
                  {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
                      <div className="text-xs text-gray-500">
                        Halaman {currentPage} dari {totalPages} ({totalTransactions} transaksi)
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => goToPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-2 py-1 text-xs"
                        >
                          ←
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => goToPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="px-2 py-1 text-xs"
                        >
                          →
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Kode Transaksi
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Waktu
                        </th>
                        {selectedShift === 'semua' && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Shift
                          </th>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pelanggan
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pembayaran
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentTransactions.length > 0 ? (
                        currentTransactions.map((transaction, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-dwash-red font-semibold">
                              {transaction.kode_transaksi}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDateTime(transaction.tanggal_transaksi)}
                            </td>
                            {selectedShift === 'semua' && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  transaction.shift_transaksi === 'pagi'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}>
                                  {transaction.shift_transaksi === 'pagi' ? 'PAGI' : 'MALAM'}
                                </span>
                              </td>
                            )}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                              {transaction.nama_pelanggan}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                transaction.metode_pembayaran === 'tunai'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {transaction.metode_pembayaran ? transaction.metode_pembayaran.toUpperCase() : 'BELUM DIBAYAR'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right text-gray-900">
                              {formatCurrency(transaction.total_keseluruhan)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={selectedShift === 'semua' ? "6" : "5"} className="px-6 py-12 text-center text-gray-500">
                            <div className="text-4xl mb-2">📝</div>
                            <p>Tidak ada transaksi pada periode ini</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {totalPages > 1 && (
                    <div className="mt-4 mb-6">
                      <div className="flex justify-center items-center">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 h-8 flex items-center justify-center"
                          >
                            ← Sebelumnya
                          </Button>
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum
                            if (totalPages <= 5) {
                              pageNum = i + 1
                            } else if (currentPage <= 3) {
                              pageNum = i + 1
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i
                            } else {
                              pageNum = currentPage - 2 + i
                            }
                            return (
                              <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => goToPage(pageNum)}
                                className="w-8 h-8 flex items-center justify-center text-sm"
                              >
                                {pageNum}
                              </Button>
                            )
                          })}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 h-8 flex items-center justify-center"
                          >
                            Selanjutnya →
                          </Button>
                        </div>
                      </div>
                      <div className="text-center text-xs text-gray-500 mt-2">
                        Menampilkan {startIndex + 1}-{Math.min(endIndex, totalTransactions)} dari {totalTransactions} transaksi
                      </div>
                    </div>
                  )}
                </div>
                {/* Summary Footer */}
                {reportData.transactions && reportData.transactions.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-200 bg-gray-50 rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-lg font-bold text-center sm:text-left">
                      <span className="text-gray-700 mb-2 sm:mb-0">
                        Total {reportData.summary.total_transaksi} Transaksi:
                      </span>
                      <span className="text-2xl text-dwash-red">
                        {formatCurrency(reportData.summary.total_pendapatan)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

      {/* Fullscreen Loading Overlay for Export - Using Portal */}
      {(pdfLoading || stokLoading) && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-white rounded-lg p-8 max-w-sm mx-4 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {pdfLoading ? 'Generating PDF Transaksi...' : 'Generating PDF Stok...'}
            </h3>
            <p className="text-gray-600 text-sm">
              {pdfLoading ? 'Memproses laporan transaksi. Mohon tunggu...' : 'Memproses laporan stok. Mohon tunggu...'}
            </p>
            <div className="mt-4 text-xs text-gray-500">
              Proses ini mungkin membutuhkan beberapa menit
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}