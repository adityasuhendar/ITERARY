"use client"
import Card from '@/components/ui/Card'

export default function StockBranchCard({ branch, onViewDetail }) {
  const { nama_cabang, total_products, stock_status } = branch
  const { out_of_stock, critical, low, good } = stock_status

  // Calculate health percentage
  const totalIssues = out_of_stock + critical + low
  const healthPercentage = total_products > 0 ? ((good / total_products) * 100).toFixed(1) : 100

  // Determine card status for background color
  const getCardStatus = () => {
    if (out_of_stock > 0 || critical > 0) return 'critical'
    if (low > 0) return 'warning'
    return 'good'
  }

  const cardStatus = getCardStatus()

  const statusConfig = {
    critical: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200', 
      badgeColor: 'bg-red-100 text-red-800',
      icon: '🚨',
      label: 'Perlu Perhatian'
    },
    warning: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      badgeColor: 'bg-yellow-100 text-yellow-800', 
      icon: '⚡',
      label: 'Monitoring'
    },
    good: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      badgeColor: 'bg-green-100 text-green-800',
      icon: '✅',
      label: 'Stok Sehat'
    }
  }

  const config = statusConfig[cardStatus]

  return (
    <Card className={`${config.bgColor} ${config.borderColor} hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-[1.02] h-full`} onClick={() => onViewDetail(branch)}>
      <div className="p-3 sm:p-4 flex flex-col h-full">
        {/* Header - mirip BranchCard */}
        <div className="mb-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex-1 pr-2">{nama_cabang}</h3>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${config.badgeColor}`}>
              {config.icon}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs sm:text-sm text-gray-500">ID: {branch.id_cabang}</p>
            <p className="text-xs text-gray-500">{config.label}</p>
          </div>
        </div>

        {/* Health percentage - mirip revenue di BranchCard */}
        <div className="mb-4">
          <div className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
            {healthPercentage}%
          </div>
          <p className="text-xs sm:text-sm text-gray-600">Kesehatan stok</p>
        </div>

        {/* Stats Grid - mirip BranchCard */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4">
          <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
            <div className="text-sm sm:text-lg font-semibold text-blue-600">{total_products}</div>
            <div className="text-xs text-gray-600">Total Produk</div>
          </div>
          <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
            <div className="text-sm sm:text-lg font-semibold text-green-600">{good}</div>
            <div className="text-xs text-gray-600">Stok Aman</div>
          </div>
        </div>

        {/* Problem indicators - kompact */}
        {totalIssues > 0 && (
          <div className="mb-4">
            <div className="grid grid-cols-3 gap-1">
              {out_of_stock > 0 && (
                <div className="text-center p-2 bg-red-100 rounded">
                  <div className="text-sm font-bold text-red-800">{out_of_stock}</div>
                  <div className="text-xs text-red-600">Habis</div>
                </div>
              )}
              {critical > 0 && (
                <div className="text-center p-2 bg-orange-100 rounded">
                  <div className="text-sm font-bold text-orange-800">{critical}</div>
                  <div className="text-xs text-orange-600">Kritis</div>
                </div>
              )}
              {low > 0 && (
                <div className="text-center p-2 bg-yellow-100 rounded">
                  <div className="text-sm font-bold text-yellow-800">{low}</div>
                  <div className="text-xs text-yellow-600">Menipis</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Info - mirip BranchCard */}
        <div className="border-t pt-3 mb-4">
          <div className="flex justify-between items-center text-xs sm:text-sm">
            <span className="text-gray-600">Status Stok:</span>
            <span className={`font-medium ${
              totalIssues === 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {totalIssues === 0 ? '🟢 Sehat' : `🔴 ${totalIssues} Masalah`}
            </span>
          </div>
        </div>

        {/* Action Button - mirip BranchCard */}
        <div className="mt-auto">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onViewDetail(branch)
            }}
            className="w-full bg-blue-600 text-white py-2 sm:py-3 px-4 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors text-xs sm:text-sm font-medium min-h-[40px] flex items-center justify-center"
          >
            <span className="hidden sm:inline">Lihat Detail Stok →</span>
            <span className="sm:hidden">Detail →</span>
          </button>
        </div>
      </div>
    </Card>
  )
}