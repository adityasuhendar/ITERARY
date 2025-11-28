'use client'

import { useState } from 'react'
import Card from '@/components/ui/Card'

export default function BranchCard({ branch, onViewDetails, isLoading = false, selectedPeriod = 'today', selectedPaymentMethod = 'all' }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0)
  }

  const getPeriodLabel = () => {
    switch(selectedPeriod) {
      case 'week': return '7 hari terakhir'
      case 'month': return '30 hari terakhir'
      default: return 'hari ini'
    }
  }

  const getPaymentMethodLabel = () => {
    if (selectedPaymentMethod === 'all') return ''
    return selectedPaymentMethod === 'tunai' ? ' (Tunai)' : ' (QRIS)'
  }

  const getStatusColor = (percentage) => {
    if (percentage >= 10) return 'text-green-600'
    if (percentage >= 0) return 'text-blue-600'
    return 'text-red-600'
  }

  const getStatusIcon = (percentage) => {
    if (percentage >= 10) return '🚀'
    if (percentage >= 0) return '➡️'
    return '⬇️'
  }

  const handleCardClick = () => {
    console.log('BranchCard clicked:', branch)
    try {
      if (onViewDetails && typeof onViewDetails === 'function') {
        onViewDetails(branch)
      } else {
        console.error('onViewDetails is not a function:', onViewDetails)
      }
    } catch (error) {
      console.error('Error in handleCardClick:', error)
    }
  }

  const handleButtonClick = (e) => {
    e.stopPropagation()
    handleCardClick()
  }

  return (
    <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-[1.02]" onClick={handleCardClick}>
      <div className="p-4 sm:p-6">
        {/* Header - Enhanced Responsive */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 space-y-2 sm:space-y-0">
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{branch.nama_cabang}</h3>
            <p className="text-xs sm:text-sm text-gray-500">ID: {branch.id_cabang}</p>
          </div>
          <div className="flex-shrink-0">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              branch.growth_percentage >= 10 ? 'bg-green-100 text-green-800' :
              branch.growth_percentage >= 0 ? 'bg-blue-100 text-blue-800' :
              'bg-red-100 text-red-800'
            }`}>
              {getStatusIcon(branch.growth_percentage)} {branch.growth_percentage >= 0 ? '+' : ''}{branch.growth_percentage}%
            </span>
          </div>
        </div>

        {/* Revenue - Enhanced Typography */}
        <div className="mb-4">
          <div className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 truncate">
            {formatCurrency(branch.daily_revenue)}
          </div>
          <p className="text-xs sm:text-sm text-gray-600">Pendapatan {getPeriodLabel()}{getPaymentMethodLabel()}</p>
        </div>

        {/* Stats Grid - Mobile Optimized */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4">
          <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
            <div className="text-sm sm:text-lg font-semibold text-blue-600">{branch.daily_transactions}</div>
            <div className="text-xs text-gray-600">Transaksi</div>
          </div>
          <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
            <div className="text-sm sm:text-lg font-semibold text-green-600">{branch.unique_customers || 0}</div>
            <div className="text-xs text-gray-600">Pelanggan</div>
          </div>
        </div>

        {/* Quick Info - Enhanced Mobile */}
        <div className="border-t pt-3">
          <div className="flex justify-between items-center text-xs sm:text-sm">
            <span className="text-gray-600">Status:</span>
            <span className={`font-medium ${
              branch.is_active ? 'text-green-600' : 'text-red-600'
            }`}>
              {branch.is_active ? '🟢 Aktif' : '🔴 Tidak Aktif'}
            </span>
          </div>
        </div>

        {/* Action Button - Mobile Enhanced */}
        <div className="mt-4">
          <button 
            onClick={handleButtonClick}
            disabled={isLoading}
            className={`w-full py-2 sm:py-3 px-4 rounded-lg transition-colors text-xs sm:text-sm font-medium min-h-[40px] flex items-center justify-center ${
              isLoading 
                ? 'bg-gray-400 text-white cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Lihat Detail →</span>
                <span className="sm:hidden">Detail →</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Card>
  )
}