'use client'
import { useState, useEffect } from 'react'
import Button from '@/components/ui/Button'

/**
 * Service Add Button Component
 * Allows adding additional services to existing transaction (e.g., bilas after cuci)
 */
export default function ServiceAddButton({ 
  transactionId,
  onAddSuccess,
  onAddError,
  className = ""
}) {
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [availableServices, setAvailableServices] = useState([])
  const [selectedService, setSelectedService] = useState('')

  // Fetch available services when dialog opens
  useEffect(() => {
    if (showDialog && transactionId) {
      fetchAvailableServices()
    }
  }, [showDialog, transactionId])

  const fetchAvailableServices = async () => {
    try {
      const response = await fetch(`/api/services/add?transactionId=${transactionId}`)
      const data = await response.json()
      
      if (response.ok && data.success) {
        setAvailableServices(data.availableServices || [])
      } else {
        console.error('Failed to fetch available services:', data.error)
      }
    } catch (error) {
      console.error('Error fetching available services:', error)
    }
  }

  const handleAddService = async () => {
    if (!selectedService) {
      alert('Pilih service yang ingin ditambahkan')
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch('/api/services/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: parseInt(transactionId),
          jenisLayananId: parseInt(selectedService),
          reason: 'added_by_kasir'
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        // Success notification
        const message = `✅ ${data.data.serviceName} berhasil ditambahkan! +${formatCurrency(data.data.servicePrice)}`
        
        if (typeof window !== 'undefined' && window.alert) {
          alert(message)
        }
        
        // Callback to parent component
        if (onAddSuccess) {
          onAddSuccess({
            detailLayananId: data.data.detailLayananId,
            serviceName: data.data.serviceName,
            servicePrice: data.data.servicePrice,
            newTotal: data.data.newTotal
          })
        }
        
        // Reset form
        setSelectedService('')
        setShowDialog(false)
        
      } else {
        const errorMessage = data.error || 'Gagal menambahkan service'
        
        if (typeof window !== 'undefined' && window.alert) {
          alert(`❌ Error: ${errorMessage}`)
        }
        
        if (onAddError) {
          onAddError(errorMessage)
        }
      }
      
    } catch (error) {
      console.error('Add service error:', error)
      const errorMessage = 'Tidak dapat terhubung ke server'
      
      if (typeof window !== 'undefined' && window.alert) {
        alert(`❌ ${errorMessage}`)
      }
      
      if (onAddError) {
        onAddError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  if (showDialog) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="text-sm text-green-800 mb-3">
          <div className="font-medium">Tambah Service</div>
        </div>
        
        {availableServices.length > 0 ? (
          <>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pilih Service:
              </label>
              <select 
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                disabled={loading}
              >
                <option value="">-- Pilih Service --</option>
                {availableServices.map(service => (
                  <option key={service.id_jenis_layanan} value={service.id_jenis_layanan}>
                    {service.nama_layanan} - {formatCurrency(service.harga)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowDialog(false)
                  setSelectedService('')
                }}
                disabled={loading}
                className="text-gray-600 border-gray-300 hover:bg-gray-50"
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleAddService}
                disabled={loading || !selectedService}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Menambah...
                  </span>
                ) : (
                  'Tambah Service'
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-600 mb-3">
            Tidak ada service yang bisa ditambahkan
          </div>
        )}
      </div>
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => setShowDialog(true)}
      disabled={loading}
      className={`text-green-600 border-green-300 hover:bg-green-50 hover:border-green-400 ${className}`}
    >
      <span className="mr-1">➕</span>
      Tambah Service
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