'use client'
import { useState } from 'react'
import Button from '@/components/ui/Button'

/**
 * Service Cancel Button Component
 * Provides cancel functionality for individual services with confirmation dialog
 */
export default function ServiceCancelButton({ 
  detailLayananId, 
  serviceName, 
  serviceStatus,
  onCancelSuccess,
  onCancelError,
  className = ""
}) {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Check if service can be cancelled
  const canCancel = ['planned', 'queued', 'active'].includes(serviceStatus)
  
  if (!canCancel) {
    return null // Don't show button for completed or already cancelled services
  }

  const handleCancel = async () => {
    setLoading(true)
    
    try {
      const response = await fetch('/api/services/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detailLayananId,
          reason: 'cancelled_by_kasir'
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        // Success notification
        const message = `✅ ${serviceName} dibatalkan! Hemat ${formatCurrency(data.data.savedAmount)}`
        
        // Show success message
        if (typeof window !== 'undefined' && window.alert) {
          alert(message)
        }
        
        // Callback to parent component
        if (onCancelSuccess) {
          onCancelSuccess({
            detailLayananId,
            serviceName,
            savedAmount: data.data.savedAmount,
            newTotal: data.data.newTotal,
            releasedMachine: data.data.releasedMachine
          })
        }
        
      } else {
        const errorMessage = data.error || 'Gagal membatalkan service'
        
        if (typeof window !== 'undefined' && window.alert) {
          alert(`❌ Error: ${errorMessage}`)
        }
        
        if (onCancelError) {
          onCancelError(errorMessage)
        }
      }
      
    } catch (error) {
      console.error('Cancel service error:', error)
      const errorMessage = 'Tidak dapat terhubung ke server'
      
      if (typeof window !== 'undefined' && window.alert) {
        alert(`❌ ${errorMessage}`)
      }
      
      if (onCancelError) {
        onCancelError(errorMessage)
      }
    } finally {
      setLoading(false)
      setShowConfirm(false)
    }
  }

  if (showConfirm) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-3 ${className}`}>
        <div className="text-sm text-red-800 mb-3">
          <div className="font-medium">Batalkan {serviceName}?</div>
          <div className="text-xs text-red-600 mt-1">
            Mesin akan dilepas dan biaya tidak akan dikenakan
          </div>
        </div>
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowConfirm(false)}
            disabled={loading}
            className="text-gray-600 border-gray-300 hover:bg-gray-50"
          >
            Batal
          </Button>
          <Button
            size="sm"
            onClick={handleCancel}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Proses...
              </span>
            ) : (
              'Ya, Batalkan'
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => setShowConfirm(true)}
      disabled={loading}
      className={`text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400 ${className}`}
    >
      <span className="mr-1">❌</span>
      Batalkan
    </Button>
  )
}

// Helper function to format currency
const formatCurrency = (amount) => {
  if (typeof amount !== 'number') return 'Rp 0'
  
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}