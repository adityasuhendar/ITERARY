"use client"
import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'

export default function PaymentTrendChart({ period = 'week', branchId = null, paymentMethod = 'all', month = '', year = '', dateRange = { start: '', end: '' }, getCachedData, setCachedData, createCacheKey }) {
  const [chartData, setChartData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPaymentTrendData()
  }, [period, branchId, paymentMethod, month, year, dateRange])

  const fetchPaymentTrendData = async () => {
    try {
      setLoading(true)
      setError('')
      
      // Check cache first if cache functions are available
      if (getCachedData && createCacheKey) {
        const cacheKey = createCacheKey('payment-trends', { branchId })
        const cachedData = getCachedData(cacheKey)
        
        if (cachedData) {
          setChartData(cachedData)
          setLoading(false)
          return
        }
      }
      
      let url = '/api/dashboard/payment-trends'
      const params = new URLSearchParams({
        period: period
      })
      
      if (branchId) {
        params.append('branch_id', branchId)
      }
      
      if (paymentMethod && paymentMethod !== 'all') {
        params.append('payment_method', paymentMethod)
      }
      
      if (month) {
        params.append('month', month)
      }
      
      if (year) {
        params.append('year', year)
      }
      
      if (dateRange.start) {
        params.append('start_date', dateRange.start)
      }
      
      if (dateRange.end) {
        params.append('end_date', dateRange.end)
      }


      const response = await fetch(`${url}?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch payment trend data')
      }

      const data = await response.json()
      
      // Cache the data if cache functions are available
      if (setCachedData && createCacheKey) {
        const cacheKey = createCacheKey('payment-trends', { branchId })
        setCachedData(cacheKey, data)
      }
      
      setChartData(data)
    } catch (err) {
      setError(err.message)
      // Payment trend chart error
      // Mock data for development
      setChartData(generateMockData())
    } finally {
      setLoading(false)
    }
  }

  const generateMockData = () => {
    const days = []
    const today = new Date()
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      
      days.push({
        date: date.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', 
          day: '2-digit', 
          month: 'short' 
        }),
        tunai: Math.floor(Math.random() * 50) + 10,
        qris: Math.floor(Math.random() * 80) + 20,
        tunai_amount: Math.floor(Math.random() * 2000000) + 500000,
        qris_amount: Math.floor(Math.random() * 3000000) + 1000000
      })
    }
    
    return {
      trends: days,
      summary: {
        tunai_percentage: 35,
        qris_percentage: 65,
        total_transactions: days.reduce((sum, day) => sum + day.tunai + day.qris, 0),
        total_amount: days.reduce((sum, day) => sum + day.tunai_amount + day.qris_amount, 0)
      }
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatCompactCurrency = (amount) => {
    if (!amount) return 'Rp 0'
    
    if (amount >= 1000000000) { // 1 Miliar+
      return `Rp ${(amount / 1000000000).toFixed(1)}M`
    } else if (amount >= 1000000) { // 1 Juta+
      return `Rp ${(amount / 1000000).toFixed(1)}Jt`
    } else if (amount >= 1000) { // 1 Ribu+
      return `Rp ${(amount / 1000).toFixed(0)}rb`
    } else {
      return `Rp ${amount}`
    }
  }

  const getPeriodLabel = (period) => {
    switch (period) {
      case 'today': return 'Hari Ini'
      case 'week': return '7 Hari Terakhir'
      case 'month': return '30 Hari Terakhir'
      case 'year': return '12 Bulan Terakhir'
      default: return period
    }
  }

  const getPaymentMethodLabel = (method) => {
    switch (method) {
      case 'tunai': return 'Hanya Tunai'
      case 'qris': return 'Hanya QRIS'
      default: return 'Semua Metode'
    }
  }

  if (loading) {
    return (
      <Card className="p-4 sm:p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-4 sm:p-6">
        <div className="text-center text-red-600">
          <p className="mb-2">❌ Gagal memuat data trend pembayaran</p>
          <p className="text-sm text-gray-500">{error}</p>
          <button 
            onClick={fetchPaymentTrendData}
            className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      </Card>
    )
  }

  if (!chartData) return null

  const { trends, summary } = chartData
  const maxTransactions = Math.max(...trends.map(day => day.tunai + day.qris))

  return (
    <div className="space-y-6">
      {/* Summary Cards - Full Width Top */}
      <Card className="p-4 sm:p-6 shadow-lg border-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center">
              📊 Statistik Pembayaran
            </h3>
            <p className="text-sm text-gray-600">
              {getPeriodLabel(period)} • {getPaymentMethodLabel(paymentMethod)}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="text-xs text-green-600 font-medium">💰 Tunai</div>
            <div className="text-2xl font-bold text-green-700">{summary.tunai_percentage}%</div>
            <div className="text-sm text-green-600 mt-1">{summary.tunai_transactions} transaksi</div>
            <div className="text-xs text-gray-500">{formatCompactCurrency(summary.tunai_amount)}</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="text-xs text-blue-600 font-medium">📱 QRIS</div>
            <div className="text-2xl font-bold text-blue-700">{summary.qris_percentage}%</div>
            <div className="text-sm text-blue-600 mt-1">{summary.qris_transactions} transaksi</div>
            <div className="text-xs text-gray-500">{formatCompactCurrency(summary.qris_amount)}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-600 font-medium">Total Transaksi</div>
            <div className="text-2xl font-bold text-gray-700">{summary.total_transactions}</div>
            <div className="text-sm text-gray-600">transaksi</div>
            <div className="text-xs text-gray-500">{getPeriodLabel(period)}</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <div className="text-xs text-purple-600 font-medium">Total Nilai</div>
            <div className="text-xl sm:text-2xl font-bold text-purple-700">{formatCompactCurrency(summary.total_amount)}</div>
            <div className="text-sm text-purple-600">pendapatan</div>
            <div className="text-xs text-gray-500">keseluruhan</div>
          </div>
        </div>
      </Card>

      {/* Chart - Full Width Bottom */}
      <Card className="p-4 sm:p-6 shadow-lg border-0">
        <div className="mb-4">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">
            💳 Trend Pembayaran
          </h3>
          <p className="text-sm text-gray-600">
            {getPeriodLabel(period)} • {getPaymentMethodLabel(paymentMethod)}
          </p>
        </div>
        {/* Chart Area */}
        <div className="bg-gray-50 p-4 rounded-lg">
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Jumlah Transaksi Harian ({getPeriodLabel(period)})
          </h4>
          
          {/* Chart Legend */}
          <div className="flex items-center space-x-4 mb-4 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-gray-600">Tunai</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-gray-600">QRIS</span>
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="space-y-3">
          {trends.map((day, index) => {
            const totalDay = day.tunai + day.qris
            const tunaiPercentage = totalDay > 0 ? (day.tunai / totalDay) * 100 : 0
            const qrisPercentage = totalDay > 0 ? (day.qris / totalDay) * 100 : 0
            const barHeight = maxTransactions > 0 ? (totalDay / maxTransactions) * 100 : 0

            return (
              <div key={index} className="flex items-center space-x-3">
                <div className="w-12 text-xs text-gray-600 font-medium">
                  {day.date}
                </div>
                
                <div className="flex-1">
                  <div className="relative bg-gray-200 rounded-full h-6 overflow-hidden">
                    {/* Tunai bar */}
                    <div 
                      className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${tunaiPercentage}%` }}
                    ></div>
                    {/* QRIS bar */}
                    <div 
                      className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-300"
                      style={{ 
                        left: `${tunaiPercentage}%`,
                        width: `${qrisPercentage}%` 
                      }}
                    ></div>
                    
                    {/* Total label */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-semibold text-white drop-shadow">
                        {totalDay}
                      </span>
                    </div>
                  </div>
                  
                  {/* Amount breakdown */}
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>💰 {day.tunai} ({formatCurrency(day.tunai_amount)})</span>
                    <span>📱 {day.qris} ({formatCurrency(day.qris_amount)})</span>
                  </div>
                </div>
                
                <div className="w-8 text-right text-xs text-gray-600">
                  {totalDay}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">💡 Insight Pembayaran</h4>
        <div className="space-y-2 text-sm text-blue-700">
          {summary.qris_percentage > 60 && (
            <p>✅ Digitalisasi pembayaran sangat baik - {summary.qris_percentage}% transaksi menggunakan QRIS</p>
          )}
          {summary.qris_percentage <= 40 && (
            <p>⚠️ Perlu edukasi penggunaan QRIS - hanya {summary.qris_percentage}% yang digital</p>
          )}
          {trends.length > 3 && (
            <p>📈 Trend {trends[trends.length-1].qris > trends[0].qris ? 'naik' : 'turun'} untuk pembayaran digital</p>
          )}
        </div>
        </div>
      </Card>
    </div>
  )
}