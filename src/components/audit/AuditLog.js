"use client"
import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'

export default function AuditLog({ cacheConfig = { enabled: true, timeout: 60000 } }) {
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    table: 'all', // all, customer_total_cuci_manual, mesin_laundry, etc.
    action: 'all', // all, INSERT, UPDATE, DELETE
    dateFrom: '',
    dateTo: '',
    user: ''
  })
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalLogs: 0,
    itemsPerPage: 20
  })
  const [selectedLog, setSelectedLog] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [lightboxImage, setLightboxImage] = useState(null)

  // Global cache for audit logs
  if (typeof window !== 'undefined' && !window.auditLogCache) {
    window.auditLogCache = new Map()
  }

  const fetchAuditLogs = async (page = 1, forceRefresh = false) => {
    try {
      setLoading(true)
      setError(null)
      
      // Create cache key
      const cacheKey = JSON.stringify({ page, limit: pagination.itemsPerPage, ...filters })
      
      // Check cache first (only if enabled and not forcing refresh)
      if (cacheConfig.enabled && !forceRefresh && typeof window !== 'undefined' && window.auditLogCache) {
        const cached = window.auditLogCache.get(cacheKey)
        if (cached && Date.now() - cached.timestamp < cacheConfig.timeout) {
          setAuditLogs(cached.data.logs || [])
          setPagination(prev => ({
            ...prev,
            currentPage: cached.data.currentPage || page,
            totalPages: cached.data.totalPages || 1,
            totalLogs: cached.data.totalLogs || 0
          }))
          setLoading(false)
          return
        }
      }
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.itemsPerPage.toString(),
        ...filters
      })
      
      const response = await fetch(`/api/audit-logs?${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Store in cache
      if (cacheConfig.enabled && typeof window !== 'undefined' && window.auditLogCache) {
        window.auditLogCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        })
        
        // Memory management - limit cache size
        if (window.auditLogCache.size > 50) {
          const oldestKey = window.auditLogCache.keys().next().value
          window.auditLogCache.delete(oldestKey)
        }
      }
      
      setAuditLogs(data.logs || [])
      setPagination(prev => ({
        ...prev,
        currentPage: data.currentPage || page,
        totalPages: data.totalPages || 1,
        totalLogs: data.totalLogs || 0
      }))
      
    } catch (error) {
      console.error('Error fetching audit logs:', error)
      setError(error.message)
      setAuditLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAuditLogs(1)
  }, [filters])

  const handlePageChange = (newPage) => {
    fetchAuditLogs(newPage)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getActionBadgeColor = (action) => {
    switch(action) {
      case 'INSERT': return 'bg-green-100 text-green-800'
      case 'UPDATE': return 'bg-yellow-100 text-yellow-800'  
      case 'DELETE': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTableDisplayName = (tableName) => {
    switch(tableName) {
      case 'stock_request': return 'Stock Requests'
      case 'customer_total_cuci_manual': return 'Manual Total Cuci'
      case 'mesin_laundry': return 'Mesin Laundry'
      case 'detail_transaksi_layanan': return 'Service Status'
      case 'pelanggan': return 'Customer Data'
      case 'karyawan': return 'Employee Data'
      case 'transaksi': return 'Transaksi'
      default: return tableName
    }
  }

  const getEmployeeName = (log) => {
    // Use only logged-in user identity from karyawan table
    if (log?.nama_karyawan) {
      // Convert system names to user-friendly names
      switch(log.nama_karyawan.toLowerCase()) {
        case 'shift pagi': return 'Kasir Pagi'
        case 'shift malam': return 'Kasir Malam'
        case 'system administrator': return 'Admin Sistem'
        case 'owner': return 'Owner'
        case 'collector': return 'Collector'
        default: return log.nama_karyawan
      }
    }
    
    return log?.requested_by || null
  }

  const renderUserFriendlyContent = (log) => {
    try {
      const oldData = log.data_lama ? JSON.parse(log.data_lama) : null
      const newData = log.data_baru ? JSON.parse(log.data_baru) : null
      
      // Handle different types of audit logs
      switch(log.tabel_diubah) {
        case 'stock_request':
          return renderStockRequestChange(oldData, newData, log)
        case 'customer_total_cuci_manual':
          return renderTotalCuciAdjustment(oldData, newData, log)
        case 'mesin_laundry':
          return renderMachineStatusChange(oldData, newData, log)
        case 'detail_transaksi_layanan':
          return renderServiceStatusChange(oldData, newData, log)
        default:
          return renderGenericChange(oldData, newData, log.tabel_diubah, log)
      }
    } catch (error) {
      return (
        <div className="text-sm text-gray-600">
          <p>Data tidak dapat ditampilkan dalam format yang mudah dibaca.</p>
        </div>
      )
    }
  }

  const renderTotalCuciAdjustment = (oldData, newData, log) => {
    if (!newData) return null

    return (
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-3">Penyesuaian Total Cuci Customer</h4>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Customer</label>
              <p className="mt-1 text-sm font-semibold text-gray-900">{newData.customer_name}</p>
              <p className="text-xs text-gray-500">{newData.customer_phone || `ID: ${newData.customer_id}`}</p>
            </div>

            <div className="text-right">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Diubah Oleh</label>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {getEmployeeName(log) || newData.adjusted_by || 'Sistem Otomatis'}
              </p>
            </div>
          </div>

          <div className="mt-4 bg-white rounded-md p-3 border">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-xs text-gray-500">Sebelum</p>
                <p className="text-lg font-bold text-red-600">{oldData?.old_total_cuci || newData.old_total_cuci}x</p>
              </div>

              <div className="flex-1 flex justify-center">
                <div className="bg-gray-100 rounded-full px-3 py-1">
                  <span className="text-xs font-medium text-gray-600">
                    {newData.difference > 0 ? `+${newData.difference}` : newData.difference}
                  </span>
                </div>
              </div>

              <div className="text-center">
                <p className="text-xs text-gray-500">Sesudah</p>
                <p className="text-lg font-bold text-green-600">{newData.new_total_cuci}x</p>
              </div>
            </div>
          </div>

          {newData.reason && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700">Alasan</label>
              <p className="mt-1 text-sm text-gray-600 bg-gray-50 rounded p-2">{newData.reason}</p>
            </div>
          )}

          {log.foto_bukti && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">Foto Bukti</label>
              <div
                className="relative border-2 border-blue-300 rounded-lg overflow-hidden bg-white cursor-pointer hover:border-blue-400 transition-colors group"
                onClick={() => setLightboxImage(log.foto_bukti)}
              >
                <img
                  src={log.foto_bukti}
                  alt="Foto bukti penyesuaian total cuci"
                  className="w-full h-auto max-h-96 object-contain group-hover:opacity-90 transition-opacity"
                  title="Klik untuk melihat ukuran penuh"
                />
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded pointer-events-none">
                  🔍 Klik untuk memperbesar
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderMachineStatusChange = (oldData, newData, log) => {
    if (!newData) return null
    
    const getStatusColor = (status) => {
      switch(status) {
        case 'tersedia': return 'text-green-600 bg-green-100'
        case 'digunakan': return 'text-blue-600 bg-blue-100'  
        case 'maintenance': return 'text-yellow-600 bg-yellow-100'
        case 'rusak': return 'text-red-600 bg-red-100'
        default: return 'text-gray-600 bg-gray-100'
      }
    }

    const getStatusText = (status) => {
      switch(status) {
        case 'tersedia': return 'Tersedia'
        case 'digunakan': return 'Sedang Digunakan'
        case 'maintenance': return 'Maintenance'
        case 'rusak': return 'Rusak'
        default: return status
      }
    }
    
    return (
      <div className="space-y-3">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h4 className="font-semibold text-orange-800 mb-3">🔧 Perubahan Status Mesin</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">🏷️ Mesin</label>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {newData.machine_number || `Mesin ID ${newData.machine_id}`}
              </p>
              <p className="text-xs text-gray-500">{newData.machine_type || 'Tipe tidak diketahui'}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">⏰ Jenis Perubahan</label>
              <p className="mt-1 text-sm text-gray-900">
                {newData.auto_assigned ? '🤖 Otomatis (Sistem)' : 
                 newData.auto_release ? '⏰ Auto Release' : '👨‍💼 Manual'}
              </p>
            </div>
          </div>

          <div className="mt-4 bg-white rounded-md p-3 border">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-xs text-gray-500">Status Sebelum</p>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(newData.old_status)}`}>
                  {getStatusText(newData.old_status)}
                </span>
              </div>
              
              <div className="flex-1 flex justify-center">
                <span className="text-2xl">→</span>
              </div>
              
              <div className="text-center">
                <p className="text-xs text-gray-500">Status Sesudah</p>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(newData.new_status)}`}>
                  {getStatusText(newData.new_status)}
                </span>
              </div>
            </div>
          </div>

          {newData.estimated_finish && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700">⏳ Estimasi Selesai</label>
              <p className="mt-1 text-sm text-gray-600">
                {formatDate(newData.estimated_finish)}
              </p>
            </div>
          )}

          {newData.notes && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700">📝 Catatan</label>
              <p className="mt-1 text-sm text-gray-600 bg-gray-50 rounded p-2">{newData.notes}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderServiceStatusChange = (oldData, newData, log) => {
    if (!newData) return null
    
    const getServiceStatusColor = (status) => {
      switch(status) {
        case 'planned': return 'text-yellow-600 bg-yellow-100'
        case 'active': return 'text-blue-600 bg-blue-100'
        case 'completed': return 'text-green-600 bg-green-100'
        case 'cancelled': return 'text-red-600 bg-red-100'
        default: return 'text-gray-600 bg-gray-100'
      }
    }

    const getServiceStatusText = (status) => {
      switch(status) {
        case 'planned': return 'Direncanakan'
        case 'active': return 'Sedang Berjalan'
        case 'completed': return 'Selesai'
        case 'cancelled': return 'Dibatalkan'
        default: return status
      }
    }
    
    return (
      <div className="space-y-3">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-purple-800 mb-3">🔄 Perubahan Status Layanan</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">🧾 Transaksi</label>
              <p className="mt-1 text-sm font-semibold text-gray-900">ID {newData.transaction_id}</p>
              <p className="text-xs text-gray-500">Detail Layanan ID: {newData.detail_layanan_id}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">🏷️ Mesin</label>
              <p className="mt-1 text-sm text-gray-900">Mesin ID {newData.machine_id}</p>
            </div>
          </div>

          <div className="mt-4 bg-white rounded-md p-3 border">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-xs text-gray-500">Status Sebelum</p>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getServiceStatusColor(newData.old_status)}`}>
                  {getServiceStatusText(newData.old_status)}
                </span>
              </div>
              
              <div className="flex-1 flex justify-center">
                <span className="text-2xl">→</span>
              </div>
              
              <div className="text-center">
                <p className="text-xs text-gray-500">Status Sesudah</p>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getServiceStatusColor(newData.new_status)}`}>
                  {getServiceStatusText(newData.new_status)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderStockRequestChange = (oldData, newData, log) => {
    if (!newData) return null
    
    const getStatusColor = (status) => {
      switch(status) {
        case 'pending': return 'text-yellow-600 bg-yellow-100'
        case 'approved': return 'text-green-600 bg-green-100'
        case 'rejected': return 'text-red-600 bg-red-100'
        default: return 'text-gray-600 bg-gray-100'
      }
    }

    const getStatusText = (status) => {
      switch(status) {
        case 'pending': return 'Menunggu Persetujuan'
        case 'approved': return 'Disetujui'
        case 'rejected': return 'Ditolak'
        default: return status
      }
    }

    const getRequestTypeIcon = (type) => {
      switch(type) {
        case 'update_stock': return '📦'
        case 'update_product': return '✏️'
        case 'delete_product': return '🗑️'
        default: return '❓'
      }
    }

    const getRequestTypeText = (type) => {
      switch(type) {
        case 'update_stock': return 'Update Stock'
        case 'update_product': return 'Update Produk'
        case 'delete_product': return 'Hapus Produk'
        default: return type
      }
    }
    
    return (
      <div className="space-y-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <h4 className="font-semibold text-emerald-800 mb-3">
            {getRequestTypeIcon(newData.request_type)} Stock Request - {getRequestTypeText(newData.request_type)}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">📦 Produk</label>
              <p className="mt-1 text-sm font-semibold text-gray-900">{newData.product_name}</p>
              <p className="text-xs text-gray-500">ID: {newData.id_produk}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">👤 Kasir</label>
              <p className="mt-1 text-sm text-gray-900">{newData.kasir_name}</p>
              <p className="text-xs text-gray-500">System: {newData.system_account}</p>
            </div>

            {log.nama_cabang && (
              <div>
                <label className="block text-sm font-medium text-gray-700">🏢 Cabang</label>
                <p className="mt-1 text-sm font-semibold text-gray-900">{log.nama_cabang}</p>
              </div>
            )}
          </div>

          {/* Status Badge */}
          <div className="mt-4">
            <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(log.approval_status)}`}>
              {getStatusText(log.approval_status)}
            </span>
          </div>

          {/* Changes Summary */}
          {newData.current_data && newData.requested_data && (
            <div className="mt-4 bg-white rounded-md p-3 border">
              <div className="text-sm font-medium text-gray-700 mb-3">🔄 Perubahan yang Diminta:</div>
              <div className="space-y-2">
                {Object.keys(newData.requested_data).filter(field => {
                  const current = newData.current_data[field]
                  const requested = newData.requested_data[field]
                  return current !== requested
                }).map(field => {
                  const currentValue = newData.current_data[field]
                  const requestedValue = newData.requested_data[field]
                  const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                  
                  return (
                    <div key={field} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-700">{fieldName}:</span>
                      <div className="flex items-center space-x-2">
                        <span className="inline-block px-2 py-1 text-xs text-red-600 bg-red-100 rounded line-through">
                          {field === 'harga' ? `Rp ${parseInt(currentValue).toLocaleString()}` : currentValue}
                        </span>
                        <span className="text-2xl">→</span>
                        <span className="inline-block px-2 py-1 text-xs text-green-600 bg-green-100 rounded font-medium">
                          {field === 'harga' ? `Rp ${parseInt(requestedValue).toLocaleString()}` : requestedValue}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Reason */}
          {newData.reason && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700">💬 Alasan</label>
              <p className="mt-1 text-sm text-gray-600 bg-gray-50 rounded p-2">{newData.reason}</p>
            </div>
          )}

          {/* Approval Info */}
          {log.approval_status !== 'pending' && log.approved_by_name && (
            <div className="mt-3 pt-3 border-t border-emerald-200">
              <div className="text-sm">
                <span className="font-medium text-gray-700">
                  {log.approval_status === 'approved' ? '✅ Disetujui' : '❌ Ditolak'} oleh: 
                </span>
                <span className="text-gray-900 ml-1">{log.approved_by_name}</span>
                {log.approved_at && (
                  <span className="text-gray-500 text-xs ml-2">
                    pada {formatDate(log.approved_at)}
                  </span>
                )}
              </div>
              {log.approval_notes && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600 bg-gray-50 rounded p-2 italic">
                    &quot;💬 {log.approval_notes}&quot;
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderWorkerProfileUpdate = (oldData, newData, log) => {
    if (!newData) return null
    
    return (
      <div className="space-y-3">
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <h4 className="font-semibold text-indigo-800 mb-3">👤 Edit Profil Pekerja</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">👤 Pekerja</label>
              <p className="mt-1 text-sm font-semibold text-gray-900">{newData.old_worker_name}</p>
              <p className="text-xs text-gray-500">Mengedit profil sendiri</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">💻 Via Akun</label>
              <p className="mt-1 text-sm text-gray-900">{newData.updated_by}</p>
              <p className="text-xs text-gray-500">Kasir login account</p>
            </div>
          </div>

          {newData.old_worker_name !== newData.worker_name && (
            <div className="mt-4 bg-white rounded-md p-3 border">
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Nama Sebelum</p>
                  <p className="text-sm font-semibold text-gray-700">{newData.old_worker_name}</p>
                </div>
                
                <div className="flex-1 flex justify-center">
                  <span className="text-2xl">→</span>
                </div>
                
                <div className="text-center">
                  <p className="text-xs text-gray-500">Nama Sesudah</p>
                  <p className="text-sm font-semibold text-indigo-600">{newData.worker_name}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-3">
            <label className="block text-xs text-gray-500">Field yang diubah:</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {newData.fields_updated?.map(field => (
                <span key={field} className="inline-block bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded">
                  {field === 'nama_pekerja' ? 'Nama' : field === 'nomor_telepon' ? 'No. Telepon' : field}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderGenericChange = (oldData, newData, tableName, log) => {
    // Special handling for stok_cabang to make it more user-friendly
    if (tableName === 'stok_cabang' && oldData && newData) {
      // Check if it's from approval or direct edit based on approval_notes
      const isDirectEdit = log.approval_notes && (
        log.approval_notes.includes('Direct') ||
        log.approval_notes.includes('Collector backup kasir')
      )
      const title = isDirectEdit ? '📝 Edit Stok Langsung' : '✅ Update Stok (Hasil Approval)'

      // Get branch name from JSON data, not from JOIN
      const namaCabang = newData.nama_cabang || log.nama_cabang
      const namaProduk = newData.nama_produk

      return (
        <div className="space-y-3">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-semibold text-purple-800 mb-3">{title}</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {namaProduk && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">📦 Produk</label>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{namaProduk}</p>
                </div>
              )}

              {namaCabang && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">🏢 Cabang</label>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{namaCabang}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">👤 Diubah Oleh</label>
                <p className="mt-1 text-sm font-semibold text-gray-900">{log.nama_karyawan || 'Unknown'}</p>
              </div>
            </div>

            <div className="bg-white rounded-md p-3 border">
              <div className="text-sm font-medium text-gray-700 mb-3">🔄 Perubahan Stok:</div>
              <div className="space-y-2">
                {Object.keys(newData).map(field => {
                  // Skip metadata fields
                  if (['nama_cabang', 'nama_produk', 'id_cabang', 'id_produk'].includes(field)) {
                    return null
                  }

                  const oldValue = oldData[field]
                  const newValue = newData[field]
                  const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

                  // Skip if values are the same
                  if (oldValue === newValue) return null

                  // Calculate difference for numeric fields
                  const isNumeric = !isNaN(oldValue) && !isNaN(newValue)
                  let differenceText = ''

                  if (isNumeric) {
                    const diff = parseFloat(newValue) - parseFloat(oldValue)
                    if (diff > 0) {
                      differenceText = ` (+${diff})`
                    } else if (diff < 0) {
                      differenceText = ` (${diff})`
                    }
                  }

                  return (
                    <div key={field} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-700">{fieldName}:</span>
                      <div className="flex items-center space-x-2">
                        <span className="inline-block px-2 py-1 text-xs text-red-600 bg-red-100 rounded line-through">
                          {oldValue}
                        </span>
                        <span className="text-2xl">→</span>
                        <span className="inline-block px-2 py-1 text-xs text-green-600 bg-green-100 rounded font-medium">
                          {newValue}
                          {differenceText && (
                            <span className="ml-1 font-bold text-blue-600">{differenceText}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Special handling for produk_tambahan to make it more user-friendly
    if (tableName === 'produk_tambahan' && oldData && newData) {
      const namaProduk = newData.nama_produk || oldData.nama_produk

      return (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-3">📝 Edit Informasi Produk</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {namaProduk && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">📦 Produk</label>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{namaProduk}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">👤 Diubah Oleh</label>
                <p className="mt-1 text-sm font-semibold text-gray-900">{log.nama_karyawan || 'Unknown'}</p>
              </div>
            </div>

            <div className="bg-white rounded-md p-3 border">
              <div className="text-sm font-medium text-gray-700 mb-3">🔄 Perubahan Data:</div>
              <div className="space-y-2">
                {Object.keys(newData).map(field => {
                  // Skip metadata fields
                  if (['id_produk'].includes(field)) {
                    return null
                  }

                  const oldValue = oldData[field]
                  const newValue = newData[field]
                  const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

                  // Skip if values are the same
                  if (oldValue === newValue) return null

                  // Format currency for harga
                  const displayOldValue = field === 'harga' ? `Rp ${parseInt(oldValue).toLocaleString('id-ID')}` : oldValue
                  const displayNewValue = field === 'harga' ? `Rp ${parseInt(newValue).toLocaleString('id-ID')}` : newValue

                  return (
                    <div key={field} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-700">{fieldName}:</span>
                      <div className="flex items-center space-x-2">
                        <span className="inline-block px-2 py-1 text-xs text-red-600 bg-red-100 rounded line-through">
                          {displayOldValue}
                        </span>
                        <span className="text-2xl">→</span>
                        <span className="inline-block px-2 py-1 text-xs text-green-600 bg-green-100 rounded font-medium">
                          {displayNewValue}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Default generic rendering for other tables
    return (
      <div className="space-y-3">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-3">📊 Perubahan Data {getTableDisplayName(tableName)}</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">👤 Diubah Oleh</label>
              <p className="mt-1 text-sm font-semibold text-gray-900">{log.nama_karyawan || 'Unknown'}</p>
            </div>

            {log.nama_cabang && (
              <div>
                <label className="block text-sm font-medium text-gray-700">🏢 Cabang</label>
                <p className="mt-1 text-sm font-semibold text-gray-900">{log.nama_cabang}</p>
              </div>
            )}
          </div>

          <p className="text-sm text-gray-600 mb-3">
            Terjadi perubahan pada tabel <code className="bg-gray-200 px-2 py-1 rounded text-xs">{tableName}</code>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {oldData && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Sebelum</label>
                <pre className="bg-white p-3 rounded text-xs overflow-x-auto border max-h-32">
                  {JSON.stringify(oldData, null, 2)}
                </pre>
              </div>
            )}

            {newData && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Sesudah</label>
                <pre className="bg-white p-3 rounded text-xs overflow-x-auto border max-h-32">
                  {JSON.stringify(newData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const handleViewDetail = (log) => {
    setSelectedLog(log)
    setShowDetailModal(true)
  }

  if (loading && auditLogs.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Memuat audit log...</p>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p className="text-lg font-semibold">Error</p>
          <p className="mt-2">{error}</p>
          <Button 
            onClick={() => fetchAuditLogs(1)} 
            className="mt-4"
          >
            Coba Lagi
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tabel
            </label>
            <select
              value={filters.table}
              onChange={(e) => setFilters(prev => ({ ...prev, table: e.target.value }))}
              className="w-full h-10 border border-gray-300 rounded-md px-3 py-0 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">Semua Tabel</option>
              <option value="stock_request">Stock Requests</option>
              <option value="customer_total_cuci_manual">Manual Total Cuci</option>
              <option value="mesin_laundry">Mesin Laundry</option>
              <option value="detail_transaksi_layanan">Service Status</option>
              <option value="pelanggan">Customer Data</option>
              <option value="karyawan">Employee Data</option>
              <option value="transaksi">Transaksi</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aksi
            </label>
            <select
              value={filters.action}
              onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
              className="w-full h-10 border border-gray-300 rounded-md px-3 py-0 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">Semua Aksi</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal Dari
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              className="w-full h-10 border border-gray-300 rounded-md px-3 py-0 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal Hingga
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              className="w-full h-10 border border-gray-300 rounded-md px-3 py-0 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({
                table: 'all',
                action: 'all',
                dateFrom: '',
                dateTo: '',
                user: ''
              })}
              className="w-full h-10 border border-red-500 rounded-md px-3 py-0 bg-red-500 hover:bg-red-600 transition-colors text-sm font-medium text-white"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card className="overflow-hidden">
        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-lg">Tidak ada audit log ditemukan</p>
            <p className="text-sm mt-1">Coba ubah filter atau periode waktu</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Waktu
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tabel
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {auditLogs.map((log, index) => (
                    <tr key={`${log.id_audit}-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(log.waktu_aksi)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {getEmployeeName(log) || 'AUTO_SYSTEM'}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {log.id_karyawan || 'System'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {getTableDisplayName(log.tabel_diubah)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {log.tabel_diubah}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionBadgeColor(log.aksi)}`}>
                          {log.aksi}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.ip_address}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetail(log)}
                        >
                          👁️ Lihat
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-gray-200">
              {auditLogs.map((log, index) => (
                <div key={`mobile-${log.id_audit}-${index}`} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {getTableDisplayName(log.tabel_diubah)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(log.waktu_aksi)}
                      </div>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionBadgeColor(log.aksi)}`}>
                      {log.aksi}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-2">
                    <div>User: {getEmployeeName(log) || 'AUTO_SYSTEM'}</div>
                    <div>IP: {log.ip_address}</div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDetail(log)}
                    >
                      👁️ Lihat Detail
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-white px-3 py-3 border-t border-gray-200 sm:px-6">
                {/* Mobile Layout */}
                <div className="block sm:hidden space-y-3">
                  {/* Mobile Info */}
                  <div className="text-center">
                    <p className="text-xs text-gray-600">
                      Hal {pagination.currentPage} dari {pagination.totalPages}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      ({((pagination.currentPage - 1) * pagination.itemsPerPage) + 1}-{Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalLogs)} dari {pagination.totalLogs} entries)
                    </p>
                  </div>
                  
                  {/* Mobile Navigation */}
                  <div className="flex items-center justify-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={pagination.currentPage === 1}
                      className="flex-1 max-w-[80px] text-xs py-2"
                    >
                      ← Prev
                    </Button>
                    
                    {/* Mobile Page Numbers - Show fewer pages */}
                    <div className="flex items-center space-x-1">
                      {[...Array(Math.min(3, pagination.totalPages))].map((_, index) => {
                        let pageNum
                        if (pagination.totalPages <= 3) {
                          pageNum = index + 1
                        } else if (pagination.currentPage <= 2) {
                          pageNum = index + 1
                        } else if (pagination.currentPage >= pagination.totalPages - 1) {
                          pageNum = pagination.totalPages - 2 + index
                        } else {
                          pageNum = pagination.currentPage - 1 + index
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-2 py-1 text-xs rounded min-w-[28px] ${
                              pagination.currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                      
                      {/* Show dots if there are more pages */}
                      {pagination.totalPages > 3 && pagination.currentPage < pagination.totalPages - 1 && (
                        <span className="text-xs text-gray-400 px-1">...</span>
                      )}
                      
                      {/* Show last page if not already shown */}
                      {pagination.totalPages > 3 && pagination.currentPage < pagination.totalPages - 1 && (
                        <button
                          onClick={() => handlePageChange(pagination.totalPages)}
                          className={`px-2 py-1 text-xs rounded min-w-[28px] ${
                            pagination.currentPage === pagination.totalPages
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                          }`}
                        >
                          {pagination.totalPages}
                        </button>
                      )}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={pagination.currentPage === pagination.totalPages}
                      className="flex-1 max-w-[80px] text-xs py-2"
                    >
                      Next →
                    </Button>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:flex items-center justify-between">
                  <div className="flex items-center">
                    <p className="text-sm text-gray-700">
                      Menampilkan{' '}
                      <span className="font-medium">
                        {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1}
                      </span>{' '}
                      hingga{' '}
                      <span className="font-medium">
                        {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalLogs)}
                      </span>{' '}
                      dari{' '}
                      <span className="font-medium">{pagination.totalLogs}</span> entries
                    </p>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={pagination.currentPage === 1}
                    >
                      ← Prev
                    </Button>
                    
                    <div className="flex items-center space-x-1">
                      {[...Array(Math.min(5, pagination.totalPages))].map((_, index) => {
                        let pageNum
                        if (pagination.totalPages <= 5) {
                          pageNum = index + 1
                        } else if (pagination.currentPage <= 3) {
                          pageNum = index + 1
                        } else if (pagination.currentPage >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + index
                        } else {
                          pageNum = pagination.currentPage - 2 + index
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-1 text-sm rounded ${
                              pagination.currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-100 border'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={pagination.currentPage === pagination.totalPages}
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Detail Modal */}
      <Modal 
        isOpen={showDetailModal} 
        onClose={() => setShowDetailModal(false)}
        title="Detail Perubahan"
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-4 sm:space-y-6">
            {/* Header Info */}
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border">
              {/* Top Row: Time + User */}
              <div className="flex justify-between items-start mb-3 sm:mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">
                    {getEmployeeName(selectedLog) || 'Sistem Otomatis'}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    {formatDate(selectedLog.waktu_aksi)}
                  </p>
                  <p className="text-xs text-gray-400">IP: {selectedLog.ip_address}</p>
                </div>
              </div>

              {/* Badges Row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    📊 {getTableDisplayName(selectedLog.tabel_diubah)}
                  </span>
                </div>
                <div>
                  <span className={`inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-medium rounded-full ${getActionBadgeColor(selectedLog.aksi)}`}>
                    {selectedLog.aksi === 'INSERT' ? '➕ Tambah Data' :
                     selectedLog.aksi === 'UPDATE' ? '✏️ Ubah Data' :
                     selectedLog.aksi === 'DELETE' ? '🗑️ Hapus Data' : selectedLog.aksi}
                  </span>
                </div>
              </div>
            </div>

            {/* User-Friendly Content */}
            <div>
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">📋 Detail Perubahan</h4>
              {renderUserFriendlyContent(selectedLog)}
            </div>

            {/* Technical Details (Collapsible) */}
            <details className="border rounded-lg">
              <summary className="cursor-pointer p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <span className="text-sm sm:text-base font-medium text-gray-700">🔧 Informasi Teknis (Klik untuk melihat)</span>
              </summary>

              <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <label className="block font-medium text-gray-700">ID Audit</label>
                    <p className="text-gray-600 mt-0.5">{selectedLog.id_audit}</p>
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">Tabel Database</label>
                    <p className="text-gray-600 mt-0.5">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">{selectedLog.tabel_diubah}</code>
                    </p>
                  </div>
                </div>

                {selectedLog.data_lama && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      📥 Data Mentah - Sebelum
                    </label>
                    <pre className="bg-gray-50 p-2 sm:p-3 rounded-md text-xs overflow-x-auto border max-h-32 sm:max-h-40">
                      {JSON.stringify(JSON.parse(selectedLog.data_lama), null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.data_baru && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      📤 Data Mentah - Sesudah
                    </label>
                    <pre className="bg-gray-50 p-2 sm:p-3 rounded-md text-xs overflow-x-auto border max-h-32 sm:max-h-40">
                      {JSON.stringify(JSON.parse(selectedLog.data_baru), null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.approval_notes && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">
                      📝 Catatan Sistem
                    </label>
                    <p className="mt-1 text-xs sm:text-sm text-gray-600 bg-yellow-50 rounded p-2 border border-yellow-200">
                      {selectedLog.approval_notes}
                    </p>
                  </div>
                )}
              </div>
            </details>
          </div>
        )}
      </Modal>

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed bg-black bg-opacity-90 z-[9999] flex items-center justify-center p-4"
          style={{ top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: '1rem' }}
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 z-10"
            aria-label="Close"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="relative max-w-7xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxImage}
              alt="Zoom foto bukti"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <p className="text-center text-white text-sm mt-4 opacity-75">
              Klik di luar gambar untuk menutup
            </p>
          </div>
        </div>
      )}

    </div>
  )
}