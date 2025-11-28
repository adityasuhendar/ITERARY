'use client'
import { useState, useEffect } from 'react'
import ServiceStatusBadge from '@/components/services/ServiceStatusBadge'

/**
 * Enhanced Machine Card Component
 * Shows machine status with detailed service information including service status
 */
export default function EnhancedMachineCard({ 
  machine, 
  onUpdate, 
  onServiceUpdate,
  className = "" 
}) {
  const [serviceDetails, setServiceDetails] = useState(null)
  const [loading, setLoading] = useState(false)

  const isActive = machine.status_mesin === 'digunakan'
  
  // Fetch service details if machine has active assignment
  useEffect(() => {
    if (isActive && machine.active_assignment?.id_transaksi) {
      fetchServiceDetails(machine.active_assignment.id_transaksi)
    }
  }, [isActive, machine.active_assignment?.id_transaksi])

  const fetchServiceDetails = async (transactionId) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/services/status?transactionId=${transactionId}`)
      const data = await response.json()
      
      if (response.ok && data.success) {
        // Find service that's using this machine
        const machineService = data.services.find(service => 
          service.id_mesin === machine.id_mesin && 
          service.service_status === 'active'
        )
        setServiceDetails(machineService)
      }
    } catch (error) {
      console.error('Error fetching service details:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMachineStatusText = (status) => {
    switch (status) {
      case 'tersedia': return 'Tersedia'
      case 'digunakan': return 'Sedang Digunakan'
      case 'maintenance': return 'Maintenance'
      case 'rusak': return 'Rusak'
      default: return 'Unknown'
    }
  }

  const getMachineStatusColor = (status) => {
    switch (status) {
      case 'tersedia': return 'bg-green-500'
      case 'digunakan': return 'bg-blue-500'
      case 'maintenance': return 'bg-yellow-500'
      case 'rusak': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow ${className}`}>
      {/* Machine Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-3 ${getMachineStatusColor(machine.status_mesin)}`}></div>
          <span className="font-medium text-gray-900">
            {machine.jenis_mesin === 'cuci' ? 'Cuci' : 'Pengering'} {machine.nomor_mesin}
          </span>
        </div>
        <button
          onClick={() => onUpdate && onUpdate(machine)}
          className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded font-medium transition-colors duration-200"
        >
          Update
        </button>
      </div>

      {/* Status Information */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">
            {getMachineStatusText(machine.status_mesin)}
          </span>
          
          {/* Service Status Badge */}
          {serviceDetails && (
            <ServiceStatusBadge 
              status={serviceDetails.service_status}
              className="text-xs"
            />
          )}
        </div>

        {/* Active Assignment Information */}
        {isActive && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            {/* Customer Info */}
            {machine.active_assignment && (
              <div className="text-sm">
                <span className="font-medium text-gray-700">Customer: </span>
                <span className="text-gray-600">
                  {machine.active_assignment.nama_pelanggan || 'Manual assignment'}
                </span>
              </div>
            )}

            {/* Service Details */}
            {serviceDetails && (
              <div className="text-sm space-y-1">
                <div>
                  <span className="font-medium text-gray-700">Service: </span>
                  <span className="text-gray-600">{serviceDetails.nama_layanan}</span>
                </div>
                
                {serviceDetails.durasi_menit && (
                  <div>
                    <span className="font-medium text-gray-700">Durasi: </span>
                    <span className="text-gray-600">{serviceDetails.durasi_menit} menit</span>
                  </div>
                )}
              </div>
            )}


            {/* Assignment Type */}
            <div className="text-xs text-gray-500 border-t pt-2">
              {machine.active_assignment ? (
                <span>🤖 Automatic assignment</span>
              ) : machine.estimasi_selesai ? (
                <span>👤 Manual assignment</span>
              ) : (
                <span>⚠️ In use (no timer)</span>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && isActive && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span className="text-sm text-gray-600">Loading service details...</span>
            </div>
          </div>
        )}

        {/* Available State */}
        {!isActive && machine.status_mesin === 'tersedia' && (
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-sm text-green-700 font-medium">
              ✅ Ready untuk assignment baru
            </div>
          </div>
        )}

        {/* Maintenance/Rusak State */}
        {(machine.status_mesin === 'maintenance' || machine.status_mesin === 'rusak') && (
          <div className={`rounded-lg p-3 ${
            machine.status_mesin === 'maintenance' ? 'bg-yellow-50' : 'bg-red-50'
          }`}>
            <div className={`text-sm font-medium ${
              machine.status_mesin === 'maintenance' ? 'text-yellow-700' : 'text-red-700'
            }`}>
              {machine.status_mesin === 'maintenance' ? '🔧 Under maintenance' : '❌ Out of order'}
            </div>
            {machine.terakhir_maintenance && (
              <div className="text-xs text-gray-600 mt-1">
                Last maintenance: {new Date(machine.terakhir_maintenance).toLocaleDateString()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}