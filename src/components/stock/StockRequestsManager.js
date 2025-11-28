'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

export default function StockRequestsManager({ showHeader = true }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('pending')
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRequests: 0,
    itemsPerPage: 10
  })

  useEffect(() => {
    // Small delay to prevent jarring transition when switching tabs
    const timeoutId = setTimeout(() => {
      fetchRequests(1)
    }, 100)
    
    return () => clearTimeout(timeoutId)
  }, [selectedStatus])

  const fetchRequests = async (page = 1) => {
    try {
      setLoading(true)
      setError('')
      
      const params = new URLSearchParams({
        status: selectedStatus,
        page: page.toString(),
        limit: pagination.itemsPerPage.toString()
      })
      
      // Minimum loading time to prevent flashing
      const [response] = await Promise.all([
        fetch(`/api/stock/request?${params}`),
        new Promise(resolve => setTimeout(resolve, 200))
      ])
      
      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests || [])
        setPagination(prev => ({
          ...prev,
          currentPage: data.currentPage || page,
          totalPages: data.totalPages || 1,
          totalRequests: data.totalRequests || 0
        }))
      } else {
        throw new Error('Failed to fetch requests')
      }
    } catch (err) {
      setError(err.message)
      console.error('Fetch requests error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (newPage) => {
    fetchRequests(newPage)
  }

  const handleViewRequest = (request) => {
    setSelectedRequest(request)
    setShowDetailModal(true)
  }

  const handleApproveReject = async (requestId, action, notes = '') => {
    try {
      setProcessing(true)
      
      const response = await fetch(`/api/stock/request/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          notes
        })
      })

      if (response.ok) {
        const result = await response.json()
        setSuccessMessage(`Request berhasil di${action === 'approve' ? 'setujui' : 'tolak'}!`)
        setShowDetailModal(false)
        setShowSuccessModal(true)
        await fetchRequests(pagination.currentPage) // Refresh list
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || `Failed to ${action} request`)
      }
    } catch (err) {
      alert('Error: ' + err.message)
      console.error(`${action} request error:`, err)
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0)
  }

  const getRequestTypeIcon = (type) => {
    switch (type) {
      case 'update_stock': return '📦'
      case 'update_product': return '✏️'
      case 'delete_product': return '🗑️'
      default: return '❓'
    }
  }

  const getRequestTypeText = (type) => {
    switch (type) {
      case 'update_stock': return 'Update Stock'
      case 'update_product': return 'Update Produk'
      case 'delete_product': return 'Hapus Produk'
      default: return 'Unknown'
    }
  }

  const renderValueComparison = (current, requested, field, format = 'text') => {
    const currentValue = current[field]
    const requestedValue = requested[field]
    
    // Handle undefined/null values and normalize for comparison
    const normalizeValue = (val) => {
      if (val === null || val === undefined) return ''
      // Untuk number, parse dulu baru toString untuk consistency
      if (typeof val === 'number') return val.toString()
      if (typeof val === 'string' && !isNaN(parseFloat(val))) {
        return parseFloat(val).toString() // "3000.00" → 3000 → "3000"
      }
      return val.toString().trim()
    }
    
    const currentNormalized = normalizeValue(currentValue)
    const requestedNormalized = normalizeValue(requestedValue)
    
    if (currentNormalized === requestedNormalized) {
      return <span className="text-gray-600">{format === 'currency' ? formatCurrency(currentValue) : currentValue}</span>
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <span className="text-red-600 line-through text-sm">
            {format === 'currency' ? formatCurrency(currentValue) : currentValue}
          </span>
          <span className="text-xs text-gray-500">→</span>
          <span className="text-green-600 font-medium">
            {format === 'currency' ? formatCurrency(requestedValue) : requestedValue}
          </span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-gray-200 h-8 w-64 rounded"></div>
        <div className="animate-pulse bg-gray-200 h-64 rounded-lg"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center space-x-3">
        <label className="text-sm font-medium text-gray-700">Filter Status:</label>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        >
          <option value="pending">⏳ Pending</option>
          <option value="approved">✅ Approved</option>
          <option value="rejected">❌ Rejected</option>
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="p-6 h-fit">
          <div className="text-center text-red-600">
            <p className="text-lg font-semibold">Error</p>
            <p className="mt-2">{error}</p>
            <Button 
              onClick={() => fetchRequests(1)} 
              className="mt-4"
            >
              Coba Lagi
            </Button>
          </div>
        </Card>
      )}

      {/* Requests Table */}
      <Card className="h-fit">
        {requests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-lg">Tidak ada stock request ditemukan</p>
            <p className="text-sm mt-1">Coba ubah filter status</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Waktu
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kasir
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produk
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipe Request
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requests.map((request) => (
                    <tr key={request.id_audit} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-900">
                          {new Date(request.waktu_aksi).toLocaleDateString('id-ID')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(request.waktu_aksi).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {request.kasir_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {request.nama_cabang}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {request.request_data.product_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center">
                          <span className="mr-2 text-lg">
                            {getRequestTypeIcon(request.request_data.request_type)}
                          </span>
                          <span className="text-sm text-gray-900">
                            {getRequestTypeText(request.request_data.request_type)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          request.approval_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {request.approval_status === 'pending' ? '⏳ Pending' :
                           request.approval_status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewRequest(request)}
                          className="text-blue-600 hover:text-blue-800"
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
            <div className="sm:hidden divide-y divide-gray-200">
              {requests.map((request) => (
                <div key={`mobile-${request.id_audit}`} className="p-4 sm:p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {request.request_data.product_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(request.waktu_aksi)}
                      </div>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      request.approval_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      request.approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {request.approval_status === 'pending' ? '⏳ Pending' :
                       request.approval_status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-3">
                    <div>Kasir: {request.kasir_name}</div>
                    <div>Cabang: {request.nama_cabang}</div>
                    <div>Tipe: {getRequestTypeText(request.request_data.request_type)}</div>
                  </div>

                  {/* Preview Changes - Mobile Only */}
                  <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                    <div className="text-xs font-semibold text-gray-700 mb-2">🔄 Perubahan:</div>
                    <div className="space-y-1">
                      {Object.keys(request.request_data.requested_data).filter((field) => {
                        const currentValue = request.current_data[field]
                        const requestedValue = request.request_data.requested_data[field]
                        
                        const normalizeValue = (val) => {
                          if (val === null || val === undefined) return ''
                          if (typeof val === 'number') return val.toString()
                          if (typeof val === 'string' && !isNaN(parseFloat(val))) {
                            return parseFloat(val).toString()
                          }
                          return val.toString().trim()
                        }
                        
                        return normalizeValue(currentValue) !== normalizeValue(requestedValue)
                      }).slice(0, 2).map((field) => {
                        const currentValue = request.current_data[field]
                        const requestedValue = request.request_data.requested_data[field]
                        const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                        
                        // Calculate difference for numeric fields in mobile view
                        const isNumeric = field === 'stok_tersedia' || field === 'stok_minimum' || field === 'harga'
                        let differenceText = ''
                        
                        if (isNumeric && !isNaN(currentValue) && !isNaN(requestedValue)) {
                          const diff = parseFloat(requestedValue) - parseFloat(currentValue)
                          if (diff > 0) {
                            differenceText = ` (+${diff})`
                          } else if (diff < 0) {
                            differenceText = ` (${diff})`
                          }
                        }
                        
                        return (
                          <div key={field} className="flex items-center justify-between text-xs">
                            <span className="font-medium text-gray-600">{fieldName}:</span>
                            <div className="flex items-center space-x-1">
                              <span className="text-red-600 line-through">
                                {field === 'harga' ? formatCurrency(currentValue) : currentValue}
                              </span>
                              <span className="text-xs text-gray-400">→</span>
                              <span className="text-green-600 font-medium">
                                {field === 'harga' ? formatCurrency(requestedValue) : requestedValue}
                                {differenceText && (
                                  <span className="ml-1 font-bold text-blue-600">{differenceText}</span>
                                )}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                      {Object.keys(request.request_data.requested_data).filter((field) => {
                        const currentValue = request.current_data[field]
                        const requestedValue = request.request_data.requested_data[field]
                        
                        const normalizeValue = (val) => {
                          if (val === null || val === undefined) return ''
                          if (typeof val === 'number') return val.toString()
                          if (typeof val === 'string' && !isNaN(parseFloat(val))) {
                            return parseFloat(val).toString()
                          }
                          return val.toString().trim()
                        }
                        
                        return normalizeValue(currentValue) !== normalizeValue(requestedValue)
                      }).length > 2 && (
                        <div className="text-xs text-blue-600 font-medium text-center">
                          +{Object.keys(request.request_data.requested_data).filter((field) => {
                            const currentValue = request.current_data[field]
                            const requestedValue = request.request_data.requested_data[field]
                            
                            const normalizeValue = (val) => {
                              if (val === null || val === undefined) return ''
                              if (typeof val === 'number') return val.toString()
                              if (typeof val === 'string' && !isNaN(parseFloat(val))) {
                                return parseFloat(val).toString()
                              }
                              return val.toString().trim()
                            }
                            
                            return normalizeValue(currentValue) !== normalizeValue(requestedValue)
                          }).length - 2} perubahan lainnya
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewRequest(request)}
                    >
                      👁️ Detail
                    </Button>
                  </div>
                </div>
              ))}
            </div>

          {/* Pagination */}
{pagination.totalPages > 1 && (
  <div className="bg-white px-4 py-2 border-t border-gray-200 sm:px-6">
    <div className="flex items-center justify-between">
      <div className="hidden sm:flex items-center">
        <p className="text-sm text-gray-700">
          Menampilkan{' '}
          <span className="font-medium">
            {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1}
          </span>{' '}
          hingga{' '}
          <span className="font-medium">
            {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalRequests)}
          </span>{' '}
          dari{' '}
          <span className="font-medium">{pagination.totalRequests}</span> requests
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
        {selectedRequest && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    ⏰ Waktu Request
                  </label>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{formatDate(selectedRequest.waktu_aksi)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    👤 Diajukan Oleh
                  </label>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {selectedRequest.kasir_name}
                  </p>
                  <p className="text-xs text-gray-500">Cabang: {selectedRequest.nama_cabang}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    📦 {selectedRequest.request_data.product_name}
                  </span>
                </div>
                <div>
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    selectedRequest.approval_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    selectedRequest.approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {selectedRequest.approval_status === 'pending' ? '⏳ Pending' :
                     selectedRequest.approval_status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                  </span>
                </div>
              </div>
            </div>

            {/* User-Friendly Content */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">📋 Detail Perubahan</h4>
              
              <div className="space-y-3">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="font-semibold text-orange-800 mb-3">
                    {getRequestTypeIcon(selectedRequest.request_data.request_type)} {getRequestTypeText(selectedRequest.request_data.request_type)}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">🏷️ Produk</label>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {selectedRequest.request_data.product_name}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">📝 Alasan</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedRequest.request_data.reason}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 bg-white rounded-md p-3 border">
                    <div className="text-sm font-medium text-gray-700 mb-3">🔄 Perubahan yang Diajukan:</div>
                    <div className="space-y-2">
                      {Object.keys(selectedRequest.request_data.requested_data).filter((field) => {
                        const currentValue = selectedRequest.current_data[field]
                        const requestedValue = selectedRequest.request_data.requested_data[field]
                        
                        const normalizeValue = (val) => {
                          if (val === null || val === undefined) return ''
                          if (typeof val === 'number') return val.toString()
                          if (typeof val === 'string' && !isNaN(parseFloat(val))) {
                            return parseFloat(val).toString()
                          }
                          return val.toString().trim()
                        }
                        
                        return normalizeValue(currentValue) !== normalizeValue(requestedValue)
                      }).map((field) => {
                        const currentValue = selectedRequest.current_data[field]
                        const requestedValue = selectedRequest.request_data.requested_data[field]
                        const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                        
                        // Calculate difference for numeric fields
                        const isNumeric = field === 'stok_tersedia' || field === 'stok_minimum' || field === 'harga'
                        let differenceText = ''
                        
                        if (isNumeric && !isNaN(currentValue) && !isNaN(requestedValue)) {
                          const diff = parseFloat(requestedValue) - parseFloat(currentValue)
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
                                {field === 'harga' ? formatCurrency(currentValue) : currentValue}
                              </span>
                              <span className="text-2xl">→</span>
                              <span className="inline-block px-2 py-1 text-xs text-green-600 bg-green-100 rounded font-medium">
                                {field === 'harga' ? formatCurrency(requestedValue) : requestedValue}
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
            </div>

            {/* Actions - Input catatan untuk approval */}
            {selectedRequest.approval_status === 'pending' && (
              <div className="space-y-3 pt-4 border-t">
                <div>
                  <label htmlFor="approval-notes" className="block text-sm font-medium text-gray-700 mb-2">
                    💬 Catatan Approval (Opsional)
                  </label>
                  <textarea
                    id="approval-notes"
                    placeholder="Tulis catatan untuk kasir (jika perlu)..."
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                  />
                </div>
                <div className="flex justify-center space-x-3">
                  <Button
                    onClick={() => {
                      const notes = document.getElementById('approval-notes').value
                      handleApproveReject(selectedRequest.id_audit, 'reject', notes)
                    }}
                    disabled={processing}
                    className="bg-red-500 hover:bg-red-600 text-white px-6 py-2"
                  >
                    {processing ? 'Processing...' : '❌ Tolak'}
                  </Button>
                  <Button
                    onClick={() => {
                      const notes = document.getElementById('approval-notes').value
                      handleApproveReject(selectedRequest.id_audit, 'approve', notes)
                    }}
                    disabled={processing}
                    className="bg-green-500 hover:bg-green-600 text-white px-6 py-2"
                  >
                    {processing ? 'Processing...' : '✅ Setujui'}
                  </Button>
                </div>
              </div>
            )}

            {/* Approval Notes - Yang sudah ada (jika sudah di-approve/reject) */}
            {selectedRequest.approval_notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                <h4 className="font-medium text-yellow-900 mb-1 text-sm">📝 Catatan dari Owner</h4>
                <p className="text-yellow-800 text-sm">{selectedRequest.approval_notes}</p>
                <p className="text-xs text-yellow-600 mt-1">
                  Oleh: {selectedRequest.approved_by_name}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="✅ Success"
        size="sm"
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-900 mb-4">{successMessage}</p>
          <Button
            onClick={() => setShowSuccessModal(false)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
          >
            OK
          </Button>
        </div>
      </Modal>
    </div>
  )
}