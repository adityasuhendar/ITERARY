'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function MachineManagement({ cacheConfig = { enabled: true, timeout: 180000 } }) {
  const [machines, setMachines] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingMachine, setEditingMachine] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    id_cabang: '',
    nomor_mesin: '',
    jenis_mesin: 'cuci',
    status_mesin: 'tersedia'
  })

  // Global cache for machine data
  if (typeof window !== 'undefined' && !window.machineCache) {
    window.machineCache = new Map()
  }

  useEffect(() => {
    fetchBranches()
    fetchMachines()
  }, [])

  const fetchBranches = async (forceRefresh = false) => {
    try {
      // Create cache key for branches
      const branchCacheKey = 'branches_list'

      // Check cache first (branches change rarely, longer timeout)
      if (cacheConfig.enabled && !forceRefresh && typeof window !== 'undefined' && window.machineCache) {
        const cached = window.machineCache.get(branchCacheKey)
        if (cached && Date.now() - cached.timestamp < 600000) { // 10 minutes cache for branches
          setBranches(cached.data.branches || [])
          return
        }
      }

      const response = await fetch('/api/branches', {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success) {
        // Store branches in cache
        if (cacheConfig.enabled && typeof window !== 'undefined' && window.machineCache) {
          window.machineCache.set(branchCacheKey, {
            data,
            timestamp: Date.now()
          })
        }

        setBranches(data.branches || [])
      }
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  const fetchMachines = async (forceRefresh = false) => {
    try {
      setLoading(true)
      setError('')

      // Create cache key
      const cacheKey = 'machines_list'

      // Check cache first (only if enabled and not forcing refresh)
      if (cacheConfig.enabled && !forceRefresh && typeof window !== 'undefined' && window.machineCache) {
        const cached = window.machineCache.get(cacheKey)
        if (cached && Date.now() - cached.timestamp < cacheConfig.timeout) {
          setMachines(cached.data.machines || [])
          setLoading(false)
          return
        }
      }

      const response = await fetch('/api/machines/list', {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success) {
        // Store in cache
        if (cacheConfig.enabled && typeof window !== 'undefined' && window.machineCache) {
          window.machineCache.set(cacheKey, {
            data,
            timestamp: Date.now()
          })

          // Memory management - limit cache size
          if (window.machineCache.size > 10) {
            const oldestKey = window.machineCache.keys().next().value
            window.machineCache.delete(oldestKey)
          }
        }

        setMachines(data.machines || [])
      } else {
        setError(data.message || 'Gagal memuat data mesin')
      }
    } catch (error) {
      console.error('Error fetching machines:', error)
      setError('Terjadi kesalahan saat memuat data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.id_cabang || !formData.nomor_mesin.trim()) {
      setError('Cabang dan nomor mesin harus diisi')
      return
    }

    try {
      const url = editingMachine
        ? `/api/machines/${editingMachine.id_mesin}`
        : '/api/machines/create'

      const method = editingMachine ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        // Clear cache after successful CRUD operation
        if (typeof window !== 'undefined' && window.machineCache) {
          window.machineCache.clear()
        }

        await fetchMachines(true) // Force refresh
        resetForm()
        setShowAddModal(false)
        setEditingMachine(null)
        setError('')
      } else {
        setError(data.message || 'Gagal menyimpan data mesin')
      }
    } catch (error) {
      console.error('Error saving machine:', error)
      setError('Terjadi kesalahan saat menyimpan data')
    }
  }

  const handleEdit = (machine) => {
    setEditingMachine(machine)
    setFormData({
      id_cabang: machine.id_cabang,
      nomor_mesin: machine.nomor_mesin,
      jenis_mesin: machine.jenis_mesin,
      status_mesin: machine.status_mesin
    })
    setShowAddModal(true)
    setError('')
  }

  const handleDelete = async (machine) => {
    try {
      const response = await fetch(`/api/machines/${machine.id_mesin}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        // Clear cache after successful delete
        if (typeof window !== 'undefined' && window.machineCache) {
          window.machineCache.clear()
        }

        await fetchMachines(true) // Force refresh
        setDeleteConfirm(null)
        setError('')
      } else {
        setError(data.message || 'Gagal menghapus mesin')
      }
    } catch (error) {
      console.error('Error deleting machine:', error)
      setError('Terjadi kesalahan saat menghapus mesin')
    }
  }

  const resetForm = () => {
    setFormData({
      id_cabang: '',
      nomor_mesin: '',
      jenis_mesin: 'cuci',
      status_mesin: 'tersedia'
    })
  }

  const filteredMachines = selectedBranch === 'all'
    ? machines
    : machines.filter(m => m.id_cabang.toString() === selectedBranch)

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Memuat data mesin...</p>
      </div>
    )
  }

  // Group machines by branch
  const branchesWithMachines = branches.map(branch => {
    const branchMachines = machines.filter(m => m.id_cabang === branch.id_cabang)
    const cuciMachines = branchMachines.filter(m => m.jenis_mesin === 'cuci')
    const pengeringMachines = branchMachines.filter(m => m.jenis_mesin === 'pengering')

    return {
      ...branch,
      machines: branchMachines,
      cuciMachines,
      pengeringMachines
    }
  }).filter(branch => selectedBranch === 'all' || branch.id_cabang.toString() === selectedBranch)

  // Get machine visual pattern based on status
  const getMachinePattern = (machine) => {
    switch (machine.status_mesin) {
      case 'tersedia': return '░░░'  // Light pattern - Available
      case 'rusak': return 'XXX'    // Cross pattern - Broken
      default: return '░░░'
    }
  }

  const getMachineColor = (machine) => {
    switch (machine.status_mesin) {
      case 'tersedia': return 'text-green-600 bg-green-50 border-green-200'
      case 'rusak': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'tersedia': return 'TERSEDIA'
      case 'rusak': return 'RUSAK'
      default: return 'UNKNOWN'
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <span className="text-red-500">⚠️</span>
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex justify-center sm:justify-start items-center gap-4">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
          >
            <option value="all">Semua Cabang ({machines.length} mesin)</option>
            {branches.map(branch => {
              const count = machines.filter(m => m.id_cabang === branch.id_cabang).length
              return (
                <option key={branch.id_cabang} value={branch.id_cabang}>
                  {branch.nama_cabang} ({count} mesin)
                </option>
              )
            })}
          </select>
        </div>

        <button
          onClick={() => {
            setShowAddModal(true)
            setEditingMachine(null)
            resetForm()
            setError('')
          }}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Tambah Mesin
        </button>
      </div>

      {/* Machine Visual Grid by Branch */}
      <div className="space-y-8">
        {branchesWithMachines.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {selectedBranch === 'all' ? 'Belum ada data mesin' : 'Tidak ada mesin di cabang ini'}
          </div>
        ) : (
          branchesWithMachines.map(branch => (
            <div key={branch.id_cabang} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Branch Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {branch.nama_cabang}
                  </h3>
                  <div className="text-sm text-gray-600">
                    {branch.machines.length} mesin total
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Washing Machines Section */}
                {branch.cuciMachines.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <h4 className="font-medium text-gray-900">MESIN CUCI</h4>
                      <span className="text-xs text-gray-500">({branch.cuciMachines.length} unit)</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
                      {branch.cuciMachines.map(machine => (
                        <div
                          key={machine.id_mesin}
                          className={`
                            relative border-2 rounded-lg p-4 text-center cursor-pointer transition-all hover:scale-105
                            ${getMachineColor(machine)}
                          `}
                          onClick={() => handleEdit(machine)}
                          title={`${machine.nomor_mesin} - ${getStatusLabel(machine.status_mesin)}`}
                        >
                          {/* Visual Pattern */}
                          <div className="font-mono text-lg mb-2 select-none">
                            {getMachinePattern(machine)}
                          </div>

                          {/* Machine Number */}
                          <div className="font-bold text-sm mb-1">
                            {machine.nomor_mesin}
                          </div>

                          {/* Status */}
                          <div className="text-xs font-medium">
                            {getStatusLabel(machine.status_mesin)}
                          </div>

                          {/* Edit/Delete buttons */}
                          <div className="absolute top-1 right-1">
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEdit(machine)
                                }}
                                className="w-6 h-6 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                title="Edit"
                              >
                                ✏
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteConfirm(machine)
                                }}
                                className="w-6 h-6 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                title="Hapus"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dryer Machines Section */}
                {branch.pengeringMachines.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <h4 className="font-medium text-gray-900">MESIN PENGERING</h4>
                      <span className="text-xs text-gray-500">({branch.pengeringMachines.length} unit)</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
                      {branch.pengeringMachines.map(machine => (
                        <div
                          key={machine.id_mesin}
                          className={`
                            relative border-2 rounded-lg p-4 text-center cursor-pointer transition-all hover:scale-105
                            ${getMachineColor(machine)}
                          `}
                          onClick={() => handleEdit(machine)}
                          title={`${machine.nomor_mesin} - ${getStatusLabel(machine.status_mesin)}`}
                        >
                          {/* Visual Pattern */}
                          <div className="font-mono text-lg mb-2 select-none">
                            {getMachinePattern(machine)}
                          </div>

                          {/* Machine Number */}
                          <div className="font-bold text-sm mb-1">
                            {machine.nomor_mesin}
                          </div>

                          {/* Status */}
                          <div className="text-xs font-medium">
                            {getStatusLabel(machine.status_mesin)}
                          </div>

                          {/* Edit/Delete buttons */}
                          <div className="absolute top-1 right-1">
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEdit(machine)
                                }}
                                className="w-6 h-6 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                title="Edit"
                              >
                                ✏
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteConfirm(machine)
                                }}
                                className="w-6 h-6 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                title="Hapus"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state for branch */}
                {branch.machines.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">🏭</div>
                    <p>Belum ada mesin di cabang ini</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>


      {/* Add/Edit Modal */}
      {showAddModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingMachine ? 'Edit Mesin' : 'Tambah Mesin Baru'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cabang
                </label>
                <select
                  value={formData.id_cabang}
                  onChange={(e) => setFormData({...formData, id_cabang: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Pilih Cabang</option>
                  {branches.map(branch => (
                    <option key={branch.id_cabang} value={branch.id_cabang}>
                      {branch.nama_cabang}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nomor Mesin
                </label>
                <input
                  type="text"
                  value={formData.nomor_mesin}
                  onChange={(e) => setFormData({...formData, nomor_mesin: e.target.value})}
                  placeholder="Contoh: C1, P1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jenis Mesin
                </label>
                <select
                  value={formData.jenis_mesin}
                  onChange={(e) => setFormData({...formData, jenis_mesin: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="cuci">🧺 Cuci</option>
                  <option value="pengering">🌀 Pengering</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status Mesin
                </label>
                <select
                  value={formData.status_mesin}
                  onChange={(e) => setFormData({...formData, status_mesin: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="tersedia">✅ Tersedia</option>
                  <option value="rusak">❌ Rusak</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingMachine(null)
                    resetForm()
                    setError('')
                  }}
                  className="flex-1 py-2 px-4 text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  {editingMachine ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <span className="text-red-600 text-xl">⚠️</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Hapus Mesin
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Yakin ingin menghapus mesin <strong>{deleteConfirm.nomor_mesin}</strong> di cabang <strong>{deleteConfirm.nama_cabang}</strong>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2 px-4 text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}