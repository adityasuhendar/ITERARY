"use client"

import { forwardRef } from 'react'

const BranchReportPDFTemplate = forwardRef(({ data, filters }, ref) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0)
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateTime) => {
    if (!dateTime) return '-'
    return new Date(dateTime).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!data) return null

  const { branch_info, stats, revenue_breakdown } = data

  return (
    <div ref={ref} className="bg-white" style={{ width: '297mm', minHeight: '210mm', fontFamily: 'Inter, sans-serif' }}>
      {/* Header dengan Gradient */}
      <div className="bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 text-white p-12">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-5xl font-black mb-2 tracking-tight">DWASH LAUNDRY</h1>
            <p className="text-2xl font-light opacity-90">{branch_info?.nama_cabang}</p>
            <p className="text-sm opacity-75 mt-2">{branch_info?.alamat || '-'}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium opacity-75">LAPORAN PENDAPATAN</p>
            <p className="text-2xl font-bold mt-1">
              {filters?.dateFrom === filters?.dateTo
                ? formatDate(filters?.dateFrom)
                : `${formatDate(filters?.dateFrom)} - ${formatDate(filters?.dateTo)}`}
            </p>
            <p className="text-xs opacity-75 mt-2">Dicetak: {formatDateTime(new Date())}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards - 4 Columns */}
      <div className="px-12 -mt-8">
        <div className="grid grid-cols-4 gap-6">
          {/* Card 1: Transaksi */}
          <div className="bg-white rounded-2xl shadow-2xl p-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-2xl">
                📊
              </div>
              <h3 className="font-bold text-gray-800 text-lg">Transaksi</h3>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-3xl font-black text-gray-900">{stats?.daily_transactions || 0}</p>
                <p className="text-xs text-gray-500">Total Transaksi</p>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xl font-bold text-gray-700">{stats?.daily_customers || 0}</p>
                <p className="text-xs text-gray-500">Pelanggan</p>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-600">{formatCurrency(stats?.avg_transaction || 0)}</p>
                <p className="text-xs text-gray-500">Rata-rata</p>
              </div>
            </div>
          </div>

          {/* Card 2: Pendapatan Kotor */}
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl shadow-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-2xl">
                💰
              </div>
              <h3 className="font-bold text-lg">Pendapatan Kotor</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-3xl font-black">{formatCurrency(revenue_breakdown?.total_pendapatan || 0)}</p>
                <p className="text-xs opacity-75">Total Pendapatan</p>
              </div>
              <div className="space-y-2 pt-2 border-t border-white/20">
                <div className="flex justify-between items-center">
                  <span className="text-xs opacity-90">💵 Tunai ({revenue_breakdown?.transaksi_tunai || 0}x)</span>
                  <span className="font-semibold text-sm">{formatCurrency(revenue_breakdown?.pendapatan_tunai || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs opacity-90">📱 QRIS ({revenue_breakdown?.transaksi_qris || 0}x)</span>
                  <span className="font-semibold text-sm">{formatCurrency(revenue_breakdown?.pendapatan_qris || 0)}</span>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-white/20">
                <div className="flex justify-between items-center">
                  <span className="text-xs opacity-90">🧺 Layanan</span>
                  <span className="font-semibold text-sm">{formatCurrency(revenue_breakdown?.pendapatan_layanan || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs opacity-90">📦 Produk</span>
                  <span className="font-semibold text-sm">{formatCurrency(revenue_breakdown?.pendapatan_produk || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Pengeluaran */}
          <div className="bg-white rounded-2xl shadow-2xl p-6 border border-red-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center text-2xl">
                📉
              </div>
              <h3 className="font-bold text-gray-800 text-lg">Pengeluaran</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-600">Fee Jasa Lipat</p>
                <p className="text-xl font-bold text-red-600">- {formatCurrency(revenue_breakdown?.fee_kasir || 0)}</p>
                <p className="text-xs text-gray-500">{revenue_breakdown?.ckl_count || 0} CKL</p>
              </div>

              {revenue_breakdown?.expenses && revenue_breakdown.expenses.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-600 mb-2">Operasional</p>
                  <p className="text-xl font-bold text-red-600 mb-2">- {formatCurrency(revenue_breakdown?.total_expenses || 0)}</p>
                  <div className="space-y-1">
                    {revenue_breakdown.expenses.map((expense, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-gray-500">{expense.kategori}</span>
                        <span className="font-semibold text-gray-700">- {formatCurrency(expense.jumlah)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Bersih */}
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl shadow-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-2xl">
                ✅
              </div>
              <h3 className="font-bold text-lg">Hasil Bersih</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs opacity-75 mb-1">Pendapatan Bersih</p>
                <p className="text-3xl font-black">{formatCurrency(revenue_breakdown?.pendapatan_bersih || 0)}</p>
              </div>
              <div className="pt-2 border-t border-white/20">
                <p className="text-xs opacity-75 mb-1">💵 Tunai Bersih</p>
                <p className="text-2xl font-bold">{formatCurrency(revenue_breakdown?.tunai_bersih || 0)}</p>
              </div>
              <div className="pt-2 border-t border-white/20">
                <p className="text-xs opacity-75 mb-1">📱 QRIS Bersih</p>
                <p className="text-2xl font-bold">{formatCurrency(revenue_breakdown?.pendapatan_qris || 0)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Revenue Bar */}
      <div className="px-12 mt-8">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-8 border border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Breakdown Pendapatan</h3>

          <div className="space-y-4">
            {/* Tunai Bar */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">💵 Tunai</span>
                <span className="text-sm font-bold text-emerald-600">{formatCurrency(revenue_breakdown?.pendapatan_tunai || 0)}</span>
              </div>
              <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-green-600 rounded-full flex items-center justify-end px-4"
                  style={{
                    width: `${(revenue_breakdown?.pendapatan_tunai / revenue_breakdown?.total_pendapatan * 100) || 0}%`
                  }}
                >
                  <span className="text-white text-xs font-bold">
                    {Math.round((revenue_breakdown?.pendapatan_tunai / revenue_breakdown?.total_pendapatan * 100) || 0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* QRIS Bar */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">📱 QRIS</span>
                <span className="text-sm font-bold text-blue-600">{formatCurrency(revenue_breakdown?.pendapatan_qris || 0)}</span>
              </div>
              <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-end px-4"
                  style={{
                    width: `${(revenue_breakdown?.pendapatan_qris / revenue_breakdown?.total_pendapatan * 100) || 0}%`
                  }}
                >
                  <span className="text-white text-xs font-bold">
                    {Math.round((revenue_breakdown?.pendapatan_qris / revenue_breakdown?.total_pendapatan * 100) || 0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-12 mt-8 pb-8">
        <div className="border-t border-gray-200 pt-6 flex justify-between items-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} DWash Laundry - Laporan ini digenerate otomatis</p>
          <p>Halaman 1 dari 1</p>
        </div>
      </div>
    </div>
  )
})

BranchReportPDFTemplate.displayName = 'BranchReportPDFTemplate'

export default BranchReportPDFTemplate
