"use client"
import { useState, useEffect } from 'react'

export default function BranchSelectionModal({ isOpen, onClose, onConfirm, userData }) {
  const [selectedBranch, setSelectedBranch] = useState('')
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)
  const [fetchingBranches, setFetchingBranches] = useState(false)
  const [error, setError] = useState('')

  // Fetch branches when modal opens and reset states
  useEffect(() => {
    if (isOpen) {
      console.log('🔍 [BranchSelectionModal] Modal opened - fetching branches')
      // Reset states when modal opens
      setLoading(false)
      setError('')
      setSelectedBranch('')
      fetchBranches()
    }
  }, [isOpen])

  const fetchBranches = async () => {
    try {
      setFetchingBranches(true)
      setError('')
      
      const response = await fetch('/api/branches', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch branches')
      }

      const data = await response.json()
      
      if (data.success && data.branches) {
        setBranches(data.branches)
        // Auto-select first branch if available
        if (data.branches.length > 0) {
          setSelectedBranch(data.branches[0].id_cabang.toString())
        }
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('Error fetching branches:', error)
      setError('Gagal memuat data cabang. Silakan coba lagi.')
    } finally {
      setFetchingBranches(false)
    }
  }

  const handleBranchConfirm = async () => {
    if (!selectedBranch) {
      setError('Pilih cabang terlebih dahulu')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const selectedBranchData = branches.find(b => b.id_cabang.toString() === selectedBranch)
      
      if (!selectedBranchData) {
        throw new Error('Data cabang tidak ditemukan')
      }

      await onConfirm({
        branchId: parseInt(selectedBranch),
        branchName: selectedBranchData.nama_cabang,
        branchData: selectedBranchData
      })
    } catch (error) {
      console.error('Error during branch confirmation:', error)
      setError(error.message || 'Terjadi kesalahan. Silakan coba lagi.')
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999]">
      <div className="relative z-10 h-full flex items-center justify-center p-2">
        <div className="w-full max-w-[80%] sm:max-w-xs lg:max-w-sm mx-auto max-h-[98vh]">
s          <div className="bg-white/95 backdrop-blur-sm shadow-2xl rounded-2xl border-0 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Pilih Cabang Backup Kasir
          </h2>
        </div>

        {/* Content */}
        <div className="px-4 pt-3 pb-0 flex-1">
          {error && (
            <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 flex items-center gap-1">
              <span>⚠️</span>
              {error}
            </div>
          )}

          {fetchingBranches ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500 mx-auto mb-2"></div>
              <p className="text-xs text-gray-600">Memuat data cabang...</p>
            </div>
          ) : (
            <>
              {/* Branch List - Compact height with scroll */}
              <div className="max-h-80 overflow-y-auto space-y-2 mb-3 -mr-4 pr-4">
                {branches.length > 0 ? (
                  branches.map((branch) => (
                    <label
                      key={branch.id_cabang}
                      className={`flex items-center p-2 rounded border cursor-pointer transition-colors ${
                        selectedBranch === branch.id_cabang.toString()
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-red-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="branch"
                        value={branch.id_cabang}
                        checked={selectedBranch === branch.id_cabang.toString()}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="sr-only"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {branch.nama_cabang}
                        </div>
                      </div>
                      {selectedBranch === branch.id_cabang.toString() && (
                        <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </label>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-xs">Tidak ada cabang tersedia</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Fixed Actions at Bottom */}
        {!fetchingBranches && branches.length > 0 && (
          <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 rounded-b-2xl">
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2 px-3 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 bg-white border border-gray-300 rounded transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleBranchConfirm}
                disabled={!selectedBranch || loading}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded transition-all ${
                  selectedBranch && !loading
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-1">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                    <span>Proses...</span>
                  </div>
                ) : (
                  'Mulai'
                )}
              </button>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  )
}