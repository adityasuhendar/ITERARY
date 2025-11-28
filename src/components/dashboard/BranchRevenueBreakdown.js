"use client"

export default function BranchRevenueBreakdown({ data, showBreakdown = true, onToggle }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  if (!data) return null

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden h-full flex flex-col">
      <div className="p-4 sm:p-6">
        {/* Header with toggle */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between group hover:bg-gray-50 -mx-2 px-2 py-2 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-xl">
              📈
            </div>
            <div className="text-left">
              <h3 className="text-lg font-bold text-gray-900">Ringkasan Pendapatan</h3>
              <p className="text-xs text-gray-500">Detail perhitungan revenue</p>
            </div>
          </div>
          <span className={`text-gray-400 transition-transform duration-200 ${showBreakdown ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {/* Breakdown Content */}
        <div className={`overflow-hidden transition-all duration-300 ${showBreakdown ? 'max-h-[1000px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 space-y-3 border border-blue-100">

            {/* Pendapatan Kotor */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm sm:text-base font-medium text-gray-700">Pendapatan Kotor</span>
              </div>
              <span className="text-base sm:text-lg font-bold text-gray-900">
                {formatCurrency(data.total_pendapatan)}
              </span>
            </div>

            {/* Payment Breakdown */}
            <div className="space-y-2 bg-white/50 rounded-lg p-3 border border-blue-200">
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">💵</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-600">Tunai</span>
                  <span className="text-xs sm:text-sm text-gray-400">({data.transaksi_tunai}x)</span>
                </div>
                <span className="text-sm sm:text-base font-semibold text-gray-700">
                  {formatCurrency(data.pendapatan_tunai)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">📱</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-600">QRIS</span>
                  <span className="text-xs sm:text-sm text-gray-400">({data.transaksi_qris}x)</span>
                </div>
                <span className="text-sm sm:text-base font-semibold text-gray-700">
                  {formatCurrency(data.pendapatan_qris)}
                </span>
              </div>
            </div>

            {/* Service/Product Breakdown */}
            <div className="space-y-2 bg-white/50 rounded-lg p-3 border border-blue-200">
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">🧺</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-600">Layanan</span>
                </div>
                <span className="text-sm sm:text-base font-semibold text-gray-700">
                  {formatCurrency(data.pendapatan_layanan)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className="text-purple-600">📦</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-600">Produk</span>
                </div>
                <span className="text-sm sm:text-base font-semibold text-gray-700">
                  {formatCurrency(data.pendapatan_produk)}
                </span>
              </div>
            </div>

            {/* Fee Jasa Lipat */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-xs sm:text-base font-medium text-gray-700">Fee Jasa Lipat</span>
                </div>
                <span className="text-[10px] sm:text-sm text-gray-500 bg-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full border border-gray-200">
                  {data.ckl_count} CKL
                </span>
              </div>
              <span className="text-sm sm:text-lg font-bold text-orange-600">
                - {formatCurrency(data.fee_kasir)}
              </span>
            </div>

            {/* Pengeluaran Operasional */}
            {data.expenses && data.expenses.length > 0 && (
              <>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs sm:text-base font-medium text-gray-700">Pengeluaran Operasional</span>
                  </div>
                  <span className="text-sm sm:text-lg font-bold text-red-600">
                    - {formatCurrency(data.total_expenses)}
                  </span>
                </div>
                {/* Expense Breakdown */}
                <div className="space-y-2 bg-white/50 rounded-lg p-3 border border-blue-200">
                  {data.expenses.map((expense, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1">
                      <span className="text-xs sm:text-sm font-medium text-gray-600">{expense.kategori}</span>
                      <span className="text-sm sm:text-base font-semibold text-gray-700">
                        - {formatCurrency(expense.jumlah)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="border-t-2 border-dashed border-blue-200 my-2"></div>

            {/* Pendapatan Bersih */}
            <div className="flex items-center justify-between py-2 sm:py-3 bg-white rounded-lg px-3 sm:px-4 shadow-sm">
              <span className="text-xs sm:text-base font-bold text-gray-900">Pendapatan Bersih</span>
              <span className="text-sm sm:text-lg font-bold text-green-600">
                {formatCurrency(data.pendapatan_bersih)}
              </span>
            </div>

            {/* Tunai Bersih */}
            <div className="flex items-center justify-between py-2 sm:py-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg px-3 sm:px-4 border border-green-200">
              <span className="text-xs sm:text-base font-bold text-green-900">Tunai Bersih</span>
              <span className="text-sm sm:text-lg font-bold text-green-700">
                {formatCurrency(data.tunai_bersih)}
              </span>
            </div>

            {/* Info Footer */}
            <div className="mt-4 pt-3 border-t border-blue-200">
              <p className="text-xs text-gray-500 text-center">
                Total {data.total_transaksi} transaksi • Fee CKL: Rp 2.000/layanan
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
