"use client"
import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

export default function StockDetail({ branchId, onBack }) {
  const [stockData, setStockData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('problems') // problems, all
  const [showEditModal, setShowEditModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [availableUnits, setAvailableUnits] = useState(['pcs'])

  useEffect(() => {
    fetchStockDetail()
    fetchAvailableUnits()
  }, [branchId])

  const fetchAvailableUnits = async () => {
    try {
      const timestamp = Date.now()
      const response = await fetch(`/api/products/units?t=${timestamp}&r=${Math.random()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      if (response.ok) {
        const data = await response.json()
        console.log('🔄 StockDetail - Fresh Units API response:', data)
        console.log('🔄 StockDetail - Units array:', data.units)
        setAvailableUnits(data.units || ['pcs'])
        console.log('✅ StockDetail - Available units set to:', data.units || ['pcs'])
      } else {
        console.error('❌ StockDetail - Units API failed:', response.status)
      }
    } catch (error) {
      console.error('❌ StockDetail - Error fetching units:', error)
      // Keep default units if fetch fails
    }
  }

  const fetchStockDetail = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/stock/monitoring?branch_id=${branchId}`)
      const data = await response.json()
      
      if (response.ok) {
        setStockData(data)
      } else {
        console.error('Error fetching stock detail:', data.error)
      }
    } catch (error) {
      console.error('Error fetching stock detail:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEditStock = (item) => {
    setEditItem({
      id_produk: item.id_produk || '',
      nama_produk: item.nama_produk || '',
      harga: item.harga || '',
      satuan: item.satuan || 'pcs',
      kategori_produk: item.kategori_produk || 'lainnya',
      stok_tersedia: item.stok_tersedia || 0,
      stok_minimum: item.stok_minimum || 10
    })
    setShowEditModal(true)
  }

  const handleUpdateStock = async (e) => {
    e.preventDefault()
    try {
      setUpdating(true)
      
      // Debug data yang akan dikirim
      const updateData = {
        nama_produk: editItem.nama_produk || '',
        harga: parseFloat(editItem.harga) || 0,
        satuan: editItem.satuan || 'pcs',
        kategori_produk: editItem.kategori_produk || 'lainnya',
        stok_tersedia: parseInt(editItem.stok_tersedia) || 0,
        stok_minimum: parseInt(editItem.stok_minimum) || 1,
        cabang_id: branchId || ''
      }

      // Update product info via existing endpoint
      const response = await fetch(`/api/products/${editItem.id_produk}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        setSuccessMessage(`Produk "${editItem.nama_produk}" berhasil diupdate!`)
        setShowEditModal(false)
        setShowSuccessModal(true)
        fetchStockDetail() // Refresh data
      } else {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        throw new Error(errorData.error || errorData.message || 'Gagal update produk')
      }
    } catch (error) {
      alert('Error: ' + error.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteStock = (item) => {
    setItemToDelete(item)
    setShowDeleteConfirmModal(true)
  }

  const handleConfirmDeleteStock = async () => {
    if (!itemToDelete) return
    
    try {
      const response = await fetch(`/api/products/${itemToDelete.id_produk}?cabang_id=${branchId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const result = await response.json()
        setSuccessMessage(result.message || `${itemToDelete.nama_produk} berhasil dihapus dari cabang ini!`)
        setShowDeleteConfirmModal(false)
        setItemToDelete(null)
        setShowSuccessModal(true)
        fetchStockDetail() // Refresh data
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Gagal hapus produk')
      }
    } catch (error) {
      alert('Error: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-24 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!stockData) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">😵</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Data tidak ditemukan</h3>
        <p className="text-gray-600 mb-4">Tidak dapat memuat data stok untuk cabang ini</p>
        <Button onClick={onBack} variant="outline">
          Kembali
        </Button>
      </div>
    )
  }

  const { branch_info, stock_summary, stock_details } = stockData
  const problemItems = [
    ...stock_details.out_of_stock,
    ...stock_details.critical,
    ...stock_details.low
  ]

  const allItems = [
    ...stock_details.out_of_stock,
    ...stock_details.critical,
    ...stock_details.low,
    ...stock_details.good
  ]

  const getStatusConfig = (status) => {
    const configs = {
      out_of_stock: {
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-200',
        icon: '❌',
        label: 'Habis'
      },
      critical: {
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        borderColor: 'border-orange-200',
        icon: '🔥',
        label: 'Kritis'
      },
      low: {
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-200',
        icon: '⚡',
        label: 'Menipis'
      },
      good: {
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        borderColor: 'border-green-200',
        icon: '✅',
        label: 'Aman'
      }
    }
    return configs[status] || configs.good
  }

  const renderStockItem = (item) => {
    const config = getStatusConfig(item.status)
    const lastUpdate = new Date(item.terakhir_update).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })

    return (
      <div key={item.id_produk} className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 hover:shadow-md transition-shadow`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 mr-3">
            <div className="flex items-center mb-2">
              <span className="text-lg mr-2">{config.icon}</span>
              <h4 className="text-sm font-bold text-gray-900 truncate">{item.nama_produk}</h4>
            </div>
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
              {config.label}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold text-gray-900">{item.stok_tersedia}</div>
            <div className="text-xs text-gray-600">{item.satuan}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Harga:</span>
            <span className="font-medium text-green-600">
              Rp {(() => {
                try {
                  const price = parseFloat(item.harga || 0)
                  return isNaN(price) ? '0' : price.toLocaleString('id-ID')
                } catch (error) {
                  console.error('Error formatting price:', error, 'item.harga:', item.harga)
                  return '0'
                }
              })()} / {item.satuan}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Minimum:</span>
            <span className="font-medium">{item.stok_minimum} {item.satuan}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Kategori:</span>
            <span className="font-medium">{item.kategori_produk}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Update:</span>
            <span className="font-medium">{lastUpdate}</span>
          </div>
        </div>

        {/* Stock Level Bar */}
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                item.stok_tersedia === 0 ? 'bg-red-500' :
                item.stok_tersedia <= item.stok_minimum ? 'bg-orange-500' :
                item.stok_tersedia <= (item.stok_minimum * 1.5) ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ 
                width: `${Math.min(100, (item.stok_tersedia / (item.stok_minimum * 2)) * 100)}%` 
              }}
            ></div>
          </div>
        </div>

        {/* Owner Actions */}
        <div className="mt-3 flex justify-end space-x-2">
          <button
            onClick={() => handleEditStock(item)}
            className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
            title="Edit produk"
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => handleDeleteStock(item)}
            className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
            title="Hapus produk"
          >
            🗑️ Hapus
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center mb-2">
            <Button onClick={onBack} variant="outline" className="mr-4">
              ← Kembali
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{branch_info.nama_cabang}</h1>
              <p className="text-gray-600">{branch_info.alamat}</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Terakhir diperbarui:</div>
          <div className="text-sm font-medium">
            {new Date(stockData.last_updated).toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-center">
            <div className="text-2xl mb-1">❌</div>
            <div className="text-2xl font-bold text-red-800">{stock_summary.out_of_stock}</div>
            <div className="text-xs text-red-600">Habis</div>
          </div>
        </Card>
        
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="text-center">
            <div className="text-2xl mb-1">🔥</div>
            <div className="text-2xl font-bold text-orange-800">{stock_summary.critical}</div>
            <div className="text-xs text-orange-600">Kritis</div>
          </div>
        </Card>
        
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="text-center">
            <div className="text-2xl mb-1">⚡</div>
            <div className="text-2xl font-bold text-yellow-800">{stock_summary.low}</div>
            <div className="text-xs text-yellow-600">Menipis</div>
          </div>
        </Card>
        
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="text-center">
            <div className="text-2xl mb-1">✅</div>
            <div className="text-2xl font-bold text-green-800">{stock_summary.good}</div>
            <div className="text-xs text-green-600">Aman</div>
          </div>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('problems')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'problems'
              ? 'bg-white text-red-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🚨 Perlu Perhatian ({problemItems.length})
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'all'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📦 Semua Produk ({allItems.length})
        </button>
      </div>

      {/* Stock Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeTab === 'problems' ? (
          problemItems.length > 0 ? (
            problemItems.map(renderStockItem)
          ) : (
            <div className="col-span-full text-center py-8">
              <div className="text-4xl mb-4">🎉</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Semua Stok Aman!</h3>
              <p className="text-gray-600">Tidak ada produk yang memerlukan perhatian khusus</p>
            </div>
          )
        ) : (
          allItems.length > 0 ? (
            allItems.map(renderStockItem)
          ) : (
            <div className="col-span-full text-center py-8">
              <div className="text-4xl mb-4">📦</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak Ada Data</h3>
              <p className="text-gray-600">Belum ada data stok untuk cabang ini</p>
            </div>
          )
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Produk"
        size="md"
      >
        {editItem && (
          <form onSubmit={handleUpdateStock} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Produk *
              </label>
              <input
                type="text"
                required
                value={editItem.nama_produk || ''}
                onChange={(e) => setEditItem(prev => ({ ...prev, nama_produk: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Harga *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editItem.harga || ''}
                  onChange={(e) => setEditItem(prev => ({ ...prev, harga: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Satuan *
                </label>
                <input
                  type="text"
                  list="satuan-options-edit"
                  required
                  value={editItem.satuan || 'pcs'}
                  onChange={(e) => setEditItem(prev => ({ ...prev, satuan: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ketik atau pilih: pcs, botol, sachet, liter..."
                />
                <datalist id="satuan-options-edit">
                  {availableUnits.map(unit => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
                <div className="flex flex-wrap gap-1 mt-2">
                  {availableUnits.slice(0, 6).map(unit => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setEditItem(prev => ({ ...prev, satuan: unit }))}
                      className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border transition-colors"
                    >
                      {unit}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  💡 Ketik satuan baru atau pilih dari tombol di atas
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategori *
              </label>
              <select
                required
                value={editItem.kategori_produk || 'lainnya'}
                onChange={(e) => setEditItem(prev => ({ ...prev, kategori_produk: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="sabun_softener">Sabun & Softener</option>
                <option value="tas_plastik">Tas Plastik</option>
                <option value="minuman">Minuman</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stok Tersedia *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editItem.stok_tersedia || ''}
                  onChange={(e) => setEditItem(prev => ({ ...prev, stok_tersedia: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stok Minimum *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editItem.stok_minimum || ''}
                  onChange={(e) => setEditItem(prev => ({ ...prev, stok_minimum: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-center space-x-4 pt-6 border-t">
              <Button
                type="button"
                onClick={() => setShowEditModal(false)}
                variant="outline"
                disabled={updating}
                className="px-6 py-2 min-w-[120px]"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={updating}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 min-w-[160px]"
              >
                {updating ? 'Menyimpan...' : '✓ Simpan Perubahan'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirmModal}
        onClose={() => {
          setShowDeleteConfirmModal(false)
          setItemToDelete(null)
        }}
        title="Konfirmasi Hapus Produk dari Cabang"
        size="md"
      >
        {itemToDelete && (
          <div className="space-y-6">
            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <span className="text-yellow-600 text-2xl">⚠️</span>
                <div>
                  <h4 className="font-semibold text-yellow-800 mb-2">Perhatian!</h4>
                  <p className="text-sm text-yellow-700">
                    Produk akan dihapus dari cabang ini saja. Produk masih tersedia di cabang lain (jika ada).
                  </p>
                </div>
              </div>
            </div>

            {/* Product Info */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">📦</span>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {itemToDelete.nama_produk}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Stok Saat Ini: {itemToDelete.stok_tersedia} {itemToDelete.satuan}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Kategori: {itemToDelete.kategori_produk?.replace('_', ' ') || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Confirmation Text */}
            <div className="text-center">
              <p className="text-gray-700">
                Yakin ingin menghapus <strong>&quot;{itemToDelete.nama_produk}&quot;</strong> dari cabang ini?
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirmModal(false)
                  setItemToDelete(null)
                }}
                className="px-6 py-2 min-w-[120px]"
              >
                Batal
              </Button>
              <Button
                onClick={handleConfirmDeleteStock}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 min-w-[180px]"
              >
                Ya, Hapus dari Cabang
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Berhasil!"
        size="sm"
      >
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-4xl">✅</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Operasi Berhasil
            </h3>
            <p className="text-gray-600">
              {successMessage}
            </p>
          </div>
          <div className="pt-4">
            <Button
              onClick={() => setShowSuccessModal(false)}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 min-w-[120px] mx-auto block"
            >
              OK
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}