'use client'
import { useState, useEffect } from 'react'
import ServiceStatusBadge from './ServiceStatusBadge'
import ServiceCancelButton from './ServiceCancelButton'  
import ServiceAddButton from './ServiceAddButton'

/**
 * Service Management Component
 * Complete service management for transactions including status display, cancel, and add functionality
 */
export default function ServiceManagement({ 
  transactionId,
  onServicesChange,
  className = ""
}) {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Fetch services with status
  useEffect(() => {
    if (transactionId) {
      fetchServices()
    }
  }, [transactionId])

  const fetchServices = async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(`/api/services/status?transactionId=${transactionId}`)
      const data = await response.json()
      
      if (response.ok && data.success) {
        setServices(data.services || [])
      } else {
        setError(data.error || 'Gagal memuat data services')
      }
    } catch (err) {
      console.error('Error fetching services:', err)
      setError('Tidak dapat terhubung ke server')
    } finally {
      setLoading(false)
    }
  }

  const handleServiceCancel = (cancelData) => {
    // Update services list
    setServices(prevServices => 
      prevServices.map(service => 
        service.id_detail_layanan === cancelData.detailLayananId
          ? { ...service, service_status: 'cancelled', cancelled_at: new Date().toISOString() }
          : service
      )
    )
    
    // Notify parent component
    if (onServicesChange) {
      onServicesChange({
        type: 'cancel',
        data: cancelData
      })
    }
  }

  const handleServiceAdd = (addData) => {
    // Refresh services list to include new service
    fetchServices()
    
    // Notify parent component
    if (onServicesChange) {
      onServicesChange({
        type: 'add',
        data: addData
      })
    }
  }

  const handleCancelError = (error) => {
    setError(error)
    setTimeout(() => setError(''), 5000) // Clear error after 5 seconds
  }

  const handleAddError = (error) => {
    setError(error)
    setTimeout(() => setError(''), 5000)
  }

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="text-red-800 text-sm">
          ❌ {error}
        </div>
        <button 
          onClick={fetchServices}
          className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
        >
          Coba lagi
        </button>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Services List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Services ({services.length})
          </h3>
          <ServiceAddButton
            transactionId={transactionId}
            onAddSuccess={handleServiceAdd}
            onAddError={handleAddError}
          />
        </div>

        {services.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Tidak ada services dalam transaksi ini
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <ServiceItem
                key={service.id_detail_layanan}
                service={service}
                onCancel={handleServiceCancel}
                onCancelError={handleCancelError}
              />
            ))}
          </div>
        )}
      </div>

      {/* Services Summary */}
      <ServicesSummary services={services} />
    </div>
  )
}

/**
 * Individual Service Item Component
 */
function ServiceItem({ service, onCancel, onCancelError }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h4 className="font-medium text-gray-900">
              {service.nama_layanan}
            </h4>
            <ServiceStatusBadge status={service.service_status} />
          </div>
          
          <div className="text-sm text-gray-600 space-y-1">
            <div>Harga: {formatCurrency(service.harga_satuan)}</div>
            
            {service.nomor_mesin && (
              <div>Mesin: {service.nomor_mesin} ({service.jenis_mesin})</div>
            )}
            
            
            {service.service_status === 'cancelled' && service.cancelled_by_name && (
              <div className="text-red-600">
                Dibatalkan oleh: {service.cancelled_by_name}
              </div>
            )}
          </div>
        </div>
        
        <div className="ml-4">
          <ServiceCancelButton
            detailLayananId={service.id_detail_layanan}
            serviceName={service.nama_layanan}
            serviceStatus={service.service_status}
            onCancelSuccess={onCancel}
            onCancelError={onCancelError}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Services Summary Component
 */
function ServicesSummary({ services }) {
  const summary = {
    total: services.length,
    planned: services.filter(s => s.service_status === 'planned').length,
    active: services.filter(s => s.service_status === 'active').length,
    queued: services.filter(s => s.service_status === 'queued').length,
    completed: services.filter(s => s.service_status === 'completed').length,
    cancelled: services.filter(s => s.service_status === 'cancelled').length
  }

  const activeServices = services.filter(s => 
    ['planned', 'active', 'queued'].includes(s.service_status)
  )
  
  const totalActive = activeServices.reduce((sum, service) => 
    sum + (service.harga_satuan * service.quantity), 0
  )

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0)
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="font-medium text-gray-900 mb-3">Ringkasan Services</h4>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-gray-600">Total Services</div>
          <div className="font-semibold">{summary.total}</div>
        </div>
        
        <div>
          <div className="text-gray-600">Aktif</div>
          <div className="font-semibold text-blue-600">
            {summary.planned + summary.active + summary.queued}
          </div>
        </div>
        
        <div>
          <div className="text-gray-600">Selesai</div>
          <div className="font-semibold text-green-600">{summary.completed}</div>
        </div>
        
        <div>
          <div className="text-gray-600">Dibatalkan</div>
          <div className="font-semibold text-red-600">{summary.cancelled}</div>
        </div>
        
        <div className="md:col-span-2">
          <div className="text-gray-600">Total Aktif</div>
          <div className="font-semibold text-lg">{formatCurrency(totalActive)}</div>
        </div>
      </div>
    </div>
  )
}