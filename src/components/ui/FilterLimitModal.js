"use client"

import { useState, useEffect } from 'react'
import Button from './Button'

const FilterLimitModal = ({
  isOpen,
  onClose,
  onConfirm,
  dateFrom,
  dateTo,
  type = 'transactions' // 'transactions' or 'export'
}) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
    } else {
      setTimeout(() => setIsVisible(false), 150)
    }
  }, [isOpen])

  if (!isVisible) return null

  // Calculate days difference
  const calculateDaysDifference = () => {
    if (!dateFrom || !dateTo) return 0
    const startDate = new Date(dateFrom)
    const endDate = new Date(dateTo)
    // Calculate inclusive days (both start and end dates count)
    const diffMs = endDate - startDate
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1

    return diffDays
  }

  const daysDifference = calculateDaysDifference()
  const maxDays = 90 // 3 months
  const isExceeding = daysDifference > maxDays

  // Generate recommended date ranges
  const getRecommendedRanges = () => {
    const today = new Date()
    const todayStr = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

    return [
      {
        label: 'Hari Ini',
        dateFrom: todayStr,
        dateTo: todayStr,
        days: 1
      },
      {
        label: '7 Hari Terakhir',
        dateFrom: new Date(today.getTime() - (6 * 24 * 60 * 60 * 1000)).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
        dateTo: todayStr,
        days: 7
      },
      {
        label: '30 Hari Terakhir',
        dateFrom: new Date(today.getTime() - (29 * 24 * 60 * 60 * 1000)).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
        dateTo: todayStr,
        days: 30
      },
      {
        label: '90 Hari Terakhir (Maksimal)',
        dateFrom: new Date(today.getTime() - (89 * 24 * 60 * 60 * 1000)).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
        dateTo: todayStr,
        days: 90
      }
    ]
  }

  const handleRangeSelect = (range) => {
    onConfirm(range.dateFrom, range.dateTo)
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-150 ${
          isOpen ? 'opacity-50' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative w-full max-w-lg transform transition-all duration-150 ${
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${
                    isExceeding ? 'bg-red-100' : 'bg-blue-100'
                  }`}>
                    <span className="text-xl">
                      {isExceeding ? '⚠️' : 'ℹ️'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {isExceeding ? 'Periode Terlalu Panjang' : 'Konfirmasi Filter Periode'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {type === 'export' ? 'Export data' : 'Filter transaksi'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              {/* Current Selection Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Periode yang Dipilih:</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dari:</span>
                    <span className="font-medium">{formatDate(dateFrom)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sampai:</span>
                    <span className="font-medium">{formatDate(dateTo)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-200">
                    <span className="text-gray-600">Total Hari:</span>
                    <span className={`font-bold ${
                      isExceeding ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {daysDifference} hari
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-3">
                  <span className="text-blue-600 text-lg">📊</span>
                  <div>
                    <h4 className="font-medium text-blue-900 mb-1">
                      Periode Disesuaikan
                    </h4>
                    <p className="text-sm text-blue-700 mb-2">
                      Periode yang dipilih melebihi batas maksimal <strong>90 hari</strong>, sehingga telah disesuaikan otomatis.
                    </p>
                    <div className="text-xs text-blue-600 bg-blue-100 rounded px-2 py-1">
                      Filter telah disesuaikan menjadi: <strong>90 hari terakhir</strong>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-center">
              <Button
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2"
              >
                OK, Mengerti
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FilterLimitModal