'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'

export default function BranchDetailModal({ branch, isOpen, onClose }) {
  const [branchDetail, setBranchDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('transactions')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen && branch) {
      fetchBranchDetail()
    }
  }, [isOpen, branch])

  const fetchBranchDetail = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/dashboard/branch/${branch.id_cabang}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error:', response.status, response.statusText, errorData)
        
        if (response.status === 401) {
          // Token expired or not found, redirect to login
          localStorage.removeItem('user')
          window.location.href = '/'
          return
        }
        
        throw new Error(`API Error ${response.status}: ${errorData.error || response.statusText}`)
      }
      
      const data = await response.json()
      console.log('Branch detail data:', data)
      setBranchDetail(data)
    } catch (err) {
      console.error('Error fetching branch detail:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0)
  }

  const formatDateTime = (dateTime) => {
    return new Date(dateTime).toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatTime = (dateTime) => {
    return new Date(dateTime).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{branch?.nama_cabang}</h2>
            <p className="text-gray-600">Detail Cabang - ID: {branch?.id_cabang}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'transactions'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📋 Transaksi Hari Ini
          </button>
          <button
            onClick={() => setActiveTab('machines')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'machines'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🏭 Status Mesin
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'inventory'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📦 Inventori
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'stats'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📊 Statistik
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 mb-4">{error}</div>
              <button
                onClick={fetchBranchDetail}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Coba Lagi
              </button>
            </div>
          ) : branchDetail ? (
            <>
              {/* Transactions Tab */}
              {activeTab === 'transactions' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Transaksi Hari Ini</h3>
                    <span className="text-sm text-gray-600">
                      Total: {branchDetail.transactions?.length || 0} transaksi
                    </span>
                  </div>
                  
                  {branchDetail.transactions?.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Belum ada transaksi hari ini</p>
                  ) : (
                    <div className="space-y-3">
                      {branchDetail.transactions?.map((transaction) => (
                        <Card key={transaction.id_transaksi} className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-semibold text-blue-600">{transaction.kode_transaksi}</h4>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  transaction.status_transaksi === 'selesai' ? 'bg-green-100 text-green-800' :
                                  transaction.status_transaksi === 'proses' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {transaction.status_transaksi?.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-gray-700 font-medium">{transaction.nama_pelanggan}</p>
                              <p className="text-sm text-gray-600">Shift: {transaction.shift_transaksi}</p>
                              <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                                <div>
                                  <span className="text-gray-500">Waktu Transaksi:</span>
                                  <p className="font-medium">{formatDateTime(transaction.tanggal_transaksi)}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Dibuat:</span>
                                  <p className="font-medium">{formatDateTime(transaction.dibuat_pada)}</p>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-600">
                                {formatCurrency(transaction.total_keseluruhan)}
                              </div>
                              <p className="text-sm text-gray-600">{transaction.metode_pembayaran?.toUpperCase()}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Machines Tab */}
              {activeTab === 'machines' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Status Mesin Laundry</h3>
                  
                  {branchDetail.machines?.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Tidak ada data mesin</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {branchDetail.machines?.map((machine) => (
                        <Card key={machine.id_mesin} className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-semibold">{machine.nomor_mesin}</h4>
                              <p className="text-sm text-gray-600">{machine.jenis_mesin} - ID: {machine.id_mesin}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              machine.status_mesin === 'tersedia' ? 'bg-green-100 text-green-800' :
                              machine.status_mesin === 'digunakan' ? 'bg-blue-100 text-blue-800' :
                              machine.status_mesin === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {machine.status_mesin?.toUpperCase()}
                            </span>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            {machine.terakhir_maintenance && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Maintenance Terakhir:</span>
                                <span className="font-medium">{new Date(machine.terakhir_maintenance).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-gray-600">Update Terakhir:</span>
                              <span className="font-medium">{formatDateTime(machine.diupdate_pada)}</span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Inventory Tab */}
              {activeTab === 'inventory' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Inventori Cabang</h3>
                  
                  {branchDetail.inventory?.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Tidak ada data inventori</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {branchDetail.inventory?.map((item, index) => (
                        <Card key={index} className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-semibold">{item.nama_produk}</h4>
                              <p className="text-sm text-gray-600">{item.kategori_produk}</p>
                              
                              <div className="mt-3 space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Stok Tersedia:</span>
                                  <span className={`font-medium ${
                                    item.stok_tersedia <= item.stok_minimum 
                                      ? 'text-red-600' 
                                      : item.stok_tersedia <= item.stok_minimum * 1.5 
                                      ? 'text-yellow-600' 
                                      : 'text-green-600'
                                  }`}>
                                    {item.stok_tersedia} {item.satuan}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Minimum:</span>
                                  <span className="font-medium">{item.stok_minimum} {item.satuan}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Harga:</span>
                                  <span className="font-medium">{formatCurrency(item.harga)}/{item.satuan}</span>
                                </div>
                              </div>
                            </div>
                            
                            {item.stok_tersedia <= item.stok_minimum && (
                              <span className="ml-3 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                                ⚠️ Stok Habis
                              </span>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Stats Tab */}
              {activeTab === 'stats' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Statistik Cabang</h3>
                  
                  {/* Revenue Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600 mb-2">
                        {formatCurrency(branchDetail.stats?.daily_revenue || 0)}
                      </div>
                      <p className="text-gray-600">Pendapatan Hari Ini</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600 mb-2">
                        {branchDetail.stats?.daily_transactions || 0}
                      </div>
                      <p className="text-gray-600">Transaksi Hari Ini</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600 mb-2">
                        {branchDetail.stats?.daily_customers || 0}
                      </div>
                      <p className="text-gray-600">Pelanggan Hari Ini</p>
                    </Card>
                  </div>

                  {/* Machine Summary */}
                  <Card className="p-6">
                    <h4 className="font-semibold mb-4">Ringkasan Mesin</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-600">
                          {branchDetail.stats?.machines_available || 0}
                        </div>
                        <p className="text-sm text-gray-600">Tersedia</p>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-blue-600">
                          {branchDetail.stats?.machines_in_use || 0}
                        </div>
                        <p className="text-sm text-gray-600">Digunakan</p>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-yellow-600">
                          {branchDetail.stats?.machines_maintenance || 0}
                        </div>
                        <p className="text-sm text-gray-600">Maintenance</p>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-red-600">
                          {branchDetail.stats?.machines_broken || 0}
                        </div>
                        <p className="text-sm text-gray-600">Rusak</p>
                      </div>
                    </div>
                  </Card>

                  {/* Performance Comparison */}
                  <Card className="p-6">
                    <h4 className="font-semibold mb-4">Perbandingan Performa</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Growth vs Kemarin:</span>
                        <span className={`font-semibold ${
                          (branchDetail.stats?.growth_percentage || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {(branchDetail.stats?.growth_percentage || 0) >= 0 ? '+' : ''}
                          {branchDetail.stats?.growth_percentage || 0}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Rata-rata per Transaksi:</span>
                        <span className="font-semibold">
                          {formatCurrency(branchDetail.stats?.avg_transaction || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Mesin:</span>
                        <span className="font-semibold">
                          {branchDetail.stats?.total_machines || 0} unit
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}