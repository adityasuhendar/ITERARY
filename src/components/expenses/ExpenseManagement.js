'use client'

import { useState, useEffect } from 'react'
import imageCompression from 'browser-image-compression'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

const KATEGORI_OPTIONS = [
  'Listrik',
  'Air',
  'Kebersihan',
  'Servis',
  'Galon',
  'Jaga malam',
  'Lainnya'
]

export default function ExpenseManagement({ cabangId, selectedDate, setSelectedDate, dateRange }) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState({ title: '', message: '', icon: '' })
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [expenseToDelete, setExpenseToDelete] = useState(null)

  // Filters
  const [filterKategori, setFilterKategori] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    kategori: '',
    jumlah: '',
    keterangan: '',
    foto_bukti: null
  })

  const [displayJumlah, setDisplayJumlah] = useState('')
  const [photoPreview, setPhotoPreview] = useState(null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [lightboxImage, setLightboxImage] = useState(null)

  useEffect(() => {
    if (cabangId) {
      fetchExpenses()
    }
  }, [cabangId, selectedDate, filterKategori, dateRange?.from, dateRange?.to])

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        cabang_id: cabangId,
        start_date: dateRange?.from || selectedDate,
        end_date: dateRange?.to || selectedDate
      })

      if (filterKategori) {
        params.append('kategori', filterKategori)
      }

      const response = await fetch(`/api/expenses?${params}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setExpenses(data.expenses || [])
      } else {
        console.error('Failed to fetch expenses')
      }
    } catch (error) {
      console.error('Error fetching expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      let fotoUrl = null

      // Upload foto if exists
      if (formData.foto_bukti) {
        setUploadingPhoto(true)

        const uploadFormData = new FormData()
        uploadFormData.append('foto', formData.foto_bukti)

        const uploadResponse = await fetch('/api/expenses/upload', {
          method: 'POST',
          body: uploadFormData
        })

        if (!uploadResponse.ok) {
          throw new Error('Gagal mengupload foto bukti')
        }

        const uploadData = await uploadResponse.json()
        fotoUrl = uploadData.url

        setUploadingPhoto(false)
      }

      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          id_cabang: cabangId,
          tanggal: formData.tanggal,
          kategori: formData.kategori,
          jumlah: formData.jumlah,
          keterangan: formData.keterangan,
          foto_bukti: fotoUrl
        })
      })

      if (response.ok) {
        setShowAddModal(false)
        resetForm()
        fetchExpenses()
        setSuccessMessage({
          title: 'Berhasil!',
          message: 'Pengeluaran berhasil ditambahkan',
          icon: '✅'
        })
        setShowSuccessModal(true)
      } else {
        const error = await response.json()
        alert(`Gagal menambahkan pengeluaran: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating expense:', error)
      alert('Terjadi kesalahan saat menambahkan pengeluaran')
      setUploadingPhoto(false)
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()

    try {
      const response = await fetch(`/api/expenses/${selectedExpense.id_pengeluaran}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setShowEditModal(false)
        setSelectedExpense(null)
        resetForm()
        fetchExpenses()
        setSuccessMessage({
          title: 'Berhasil!',
          message: 'Pengeluaran berhasil diupdate',
          icon: '✅'
        })
        setShowSuccessModal(true)
      } else {
        const error = await response.json()
        alert(`Gagal update pengeluaran: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating expense:', error)
      alert('Terjadi kesalahan saat update pengeluaran')
    }
  }

  const handleDeleteClick = (expense) => {
    setExpenseToDelete(expense)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!expenseToDelete) return

    try {
      const response = await fetch(`/api/expenses/${expenseToDelete.id_pengeluaran}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        fetchExpenses()
        setShowDeleteModal(false)
        setExpenseToDelete(null)
        setSuccessMessage({
          title: 'Berhasil!',
          message: 'Pengeluaran berhasil dihapus',
          icon: '✅'
        })
        setShowSuccessModal(true)
      } else {
        const error = await response.json()
        alert(`Gagal menghapus pengeluaran: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting expense:', error)
      alert('Terjadi kesalahan saat menghapus pengeluaran')
    }
  }

  const handleJumlahChange = (e) => {
    const value = e.target.value.replace(/\D/g, '') // Remove non-digits
    setFormData({ ...formData, jumlah: value })
    setDisplayJumlah(value ? parseInt(value).toLocaleString('id-ID') : '')
  }

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('File harus berupa gambar (JPEG, PNG, WebP)')
      return
    }

    try {
      // Show compressing state
      setUploadingPhoto(true)

      // Compression options - aggressive compression for expense receipts
      const options = {
        maxSizeMB: 0.5, // Max 500KB after compression
        maxWidthOrHeight: 1280, // Max dimension 1280px (HD)
        useWebWorker: true, // Use web worker for better performance
        fileType: 'image/jpeg', // Convert to JPEG for better compression
        initialQuality: 0.7 // 70% quality - still good for receipts
      }

      console.log(`Original file size: ${(file.size / 1024 / 1024).toFixed(2)} MB`)

      // Compress the image
      const compressedBlob = await imageCompression(file, options)

      console.log(`Compressed file size: ${(compressedBlob.size / 1024 / 1024).toFixed(2)} MB`)
      console.log(`Compression ratio: ${((1 - compressedBlob.size / file.size) * 100).toFixed(1)}%`)

      // Convert Blob to File with proper name
      const compressedFile = new File(
        [compressedBlob],
        `compressed_${Date.now()}.jpg`,
        { type: 'image/jpeg' }
      )

      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result)
        setFormData({ ...formData, foto_bukti: compressedFile })
        setUploadingPhoto(false)
      }
      reader.readAsDataURL(compressedFile)

    } catch (error) {
      console.error('Error compressing image:', error)
      alert('Gagal memproses gambar. Silakan coba lagi.')
      setUploadingPhoto(false)
    }
  }

  const removePhoto = () => {
    setPhotoPreview(null)
    setFormData({ ...formData, foto_bukti: null })
  }

  const viewPhoto = (photoUrl) => {
    setSelectedPhoto(photoUrl)
    setShowPhotoModal(true)
  }

  const resetForm = () => {
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      kategori: '',
      jumlah: '',
      keterangan: '',
      foto_bukti: null
    })
    setDisplayJumlah('')
    setPhotoPreview(null)
    setUploadingPhoto(false)
  }

  const openEditModal = (expense) => {
    setSelectedExpense(expense)
    // Format tanggal ke YYYY-MM-DD untuk input date
    const dateObj = new Date(expense.tanggal)
    const formattedDate = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000))
      .toISOString()
      .split('T')[0]

    const jumlahValue = Math.round(parseFloat(expense.jumlah)).toString()
    setFormData({
      tanggal: formattedDate,
      kategori: expense.kategori,
      jumlah: jumlahValue,
      keterangan: expense.keterangan || '',
      foto_bukti: expense.foto_bukti || null
    })
    setDisplayJumlah(parseInt(jumlahValue).toLocaleString('id-ID'))
    setPhotoPreview(expense.foto_bukti || null)
    setShowEditModal(true)
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.jumlah), 0)

  return (
    <div className="h-full flex flex-col">
      {/* Filters & Expenses List */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center text-lg sm:text-xl">
                💰
              </div>
              <div className="text-left">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Pengeluaran</h3>
                <p className="text-[10px] sm:text-xs text-gray-500">Detail pengeluaran operasional</p>
              </div>
            </div>
            <Button
              onClick={() => setShowAddModal(true)}
              className="w-full sm:w-auto flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Pengeluaran
            </Button>
          </div>

          {/* Filters */}
          <div className="mb-6 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategori
              </label>
              <select
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Semua Kategori</option>
                {KATEGORI_OPTIONS.map(kat => (
                  <option key={kat} value={kat}>{kat}</option>
                ))}
              </select>
            </div>

            {/* Summary */}
            <div className="pt-3 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Pengeluaran:</span>
                <span className="text-lg font-bold text-red-600">
                  Rp {totalExpenses.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* Expenses List */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading...</p>
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-gray-600">Belum ada pengeluaran</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kategori
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jumlah
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Keterangan
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenses.map((expense) => (
                  <tr
                    key={expense.id_pengeluaran}
                    className={`hover:bg-gray-50 ${expense.foto_bukti ? 'cursor-pointer' : ''}`}
                    onClick={() => expense.foto_bukti && viewPhoto(expense.foto_bukti)}
                    title={expense.foto_bukti ? 'Klik untuk lihat foto bukti' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      {new Date(expense.tanggal).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${expense.foto_bukti ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                        {expense.foto_bukti && '📷 '}{expense.kategori}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-red-600">
                      Rp {parseFloat(expense.jumlah).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-600">
                      {expense.keterangan || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => openEditModal(expense)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteClick(expense)}
                          className="text-red-600 hover:text-red-800"
                          title="Hapus"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </Card>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          resetForm()
        }}
        title="Tambah Pengeluaran"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal *
            </label>
            <input
              type="date"
              value={formData.tanggal}
              onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategori *
            </label>
            <input
              type="text"
              list="kategori-options"
              value={formData.kategori}
              onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Ketik atau pilih kategori"
              required
            />
            <datalist id="kategori-options">
              {KATEGORI_OPTIONS.map(kat => (
                <option key={kat} value={kat} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jumlah (Rp) *
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={displayJumlah}
              onChange={handleJumlahChange}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="0"
              required
            />
            {displayJumlah && (
              <p className="text-xs text-gray-500 mt-1">Rp {displayJumlah}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Keterangan
            </label>
            <textarea
              value={formData.keterangan}
              onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows="3"
              placeholder="Catatan tambahan (opsional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Foto Bukti (Opsional)
            </label>
            {uploadingPhoto ? (
              <div className="w-full h-40 border rounded-lg flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Mengkompress foto...</p>
                </div>
              </div>
            ) : photoPreview ? (
              <div className="space-y-2">
                <div className="relative w-full h-40 border rounded-lg overflow-hidden">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={removePhoto}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  🗑️ Hapus Foto
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            )}
            <p className="text-xs text-gray-500 mt-1">Auto-compress ke max 500KB (JPG, PNG, WebP)</p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              onClick={() => {
                setShowAddModal(false)
                resetForm()
              }}
              variant="outline"
              className="flex-1"
            >
              Batal
            </Button>
            <Button type="submit" className="flex-1">
              Simpan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedExpense(null)
          resetForm()
        }}
        title="Edit Pengeluaran"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal *
            </label>
            <input
              type="date"
              value={formData.tanggal}
              onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategori *
            </label>
            <input
              type="text"
              list="kategori-options"
              value={formData.kategori}
              onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Ketik atau pilih kategori"
              required
            />
            <datalist id="kategori-options">
              {KATEGORI_OPTIONS.map(kat => (
                <option key={kat} value={kat} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jumlah (Rp) *
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={displayJumlah}
              onChange={handleJumlahChange}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="0"
              required
            />
            {displayJumlah && (
              <p className="text-xs text-gray-500 mt-1">Rp {displayJumlah}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Keterangan
            </label>
            <textarea
              value={formData.keterangan}
              onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows="3"
              placeholder="Catatan tambahan (opsional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Foto Bukti (Opsional)
            </label>
            {uploadingPhoto ? (
              <div className="w-full h-40 border rounded-lg flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Mengkompress foto...</p>
                </div>
              </div>
            ) : photoPreview ? (
              <div className="space-y-2">
                <div className="relative w-full h-40 border rounded-lg overflow-hidden">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={removePhoto}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  🗑️ Hapus Foto
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            )}
            <p className="text-xs text-gray-500 mt-1">Auto-compress ke max 500KB (JPG, PNG, WebP)</p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              onClick={() => {
                setShowEditModal(false)
                setSelectedExpense(null)
                resetForm()
              }}
              variant="outline"
              className="flex-1"
            >
              Batal
            </Button>
            <Button type="submit" className="flex-1">
              Update
            </Button>
          </div>
        </form>
      </Modal>

      {/* Photo View Modal */}
      <Modal
        isOpen={showPhotoModal}
        onClose={() => {
          setShowPhotoModal(false)
          setSelectedPhoto(null)
        }}
        title="Foto Bukti"
      >
        <div className="w-full">
          <img
            src={selectedPhoto}
            alt="Foto Bukti"
            className="w-full h-auto max-h-[70vh] object-contain cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => {
              setLightboxImage(selectedPhoto)
              setShowPhotoModal(false)
            }}
          />
          <p className="text-center text-gray-500 text-sm mt-2">
            Klik gambar untuk memperbesar
          </p>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setExpenseToDelete(null)
        }}
        title="Konfirmasi Hapus"
      >
        <div className="space-y-4">
          <div className="text-center py-4">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Yakin ingin menghapus pengeluaran ini?
            </h3>
            {expenseToDelete && (
              <div className="bg-gray-50 rounded-lg p-4 mt-4 text-left">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">Tanggal:</div>
                  <div className="font-medium">
                    {new Date(expenseToDelete.tanggal).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="text-gray-600">Kategori:</div>
                  <div className="font-medium">{expenseToDelete.kategori}</div>
                  <div className="text-gray-600">Jumlah:</div>
                  <div className="font-medium text-red-600">
                    Rp {parseInt(expenseToDelete.jumlah).toLocaleString('id-ID')}
                  </div>
                  {expenseToDelete.keterangan && (
                    <>
                      <div className="text-gray-600">Keterangan:</div>
                      <div className="font-medium">{expenseToDelete.keterangan}</div>
                    </>
                  )}
                </div>
              </div>
            )}
            <p className="text-sm text-gray-500 mt-4">
              Data yang dihapus tidak dapat dikembalikan.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => {
                setShowDeleteModal(false)
                setExpenseToDelete(null)
              }}
              variant="outline"
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              Ya, Hapus
            </Button>
          </div>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={successMessage.title}
      >
        <div className="text-center py-6">
          <div className="text-6xl mb-4">{successMessage.icon}</div>
          <p className="text-lg text-gray-700">{successMessage.message}</p>
          <Button
            onClick={() => setShowSuccessModal(false)}
            className="mt-6 px-8"
          >
            OK
          </Button>
        </div>
      </Modal>

      {/* Lightbox for fullscreen view */}
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
