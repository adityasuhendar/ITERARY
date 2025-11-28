"use client"
import { useState, useEffect, memo } from 'react'

function RoleSelectionModal({ isOpen, onClose, onSelectRole, userData }) {
  const [loading, setLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState('')

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('🔍 [RoleSelectionModal] Modal opened - resetting state')
      setLoading(false)
      setSelectedRole('')
    }
  }, [isOpen])

  const handleRoleSelect = async (role, event) => {
    console.log('🔍 handleRoleSelect called with role:', role)
    console.log('🔍 Event type:', event?.type)
    console.log('🔍 Event isTrusted:', event?.isTrusted)
    console.log('🔍 Current loading state:', loading)
    console.log('🔍 Current selectedRole:', selectedRole)

    // Prevent auto-clicks during initial render
    if (!event?.isTrusted) {
      console.warn('🚨 Ignoring non-trusted event (auto-click)')
      return
    }

    setLoading(true)
    setSelectedRole(role)

    try {
      await onSelectRole(role)
    } catch (error) {
      console.error('Role selection error:', error)
      setLoading(false)
      setSelectedRole('')
    }
  }

  if (!isOpen) {
    return null
  }

  console.log('🔍 [RoleSelectionModal] Modal is open - rendering')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
      <div className="relative z-10 h-full flex items-center justify-center p-2 overflow-hidden">
        <div className="w-full max-w-[90%] sm:max-w-sm lg:max-w-md mx-auto max-h-[95vh] overflow-y-auto">
          <div className="bg-white/95 backdrop-blur-sm shadow-2xl rounded-2xl p-4 sm:p-6 lg:p-8 border-0">
            <div className="text-center mb-4 sm:mb-6">
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">👋</div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 sm:mb-2">
                Selamat datang, {userData?.name || userData?.nama_karyawan}!
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
                Pilih mode kerja untuk hari ini ({new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })})
              </p>
            </div>

            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              {/* Collector Mode Option */}
              <div 
                className={`p-4 sm:p-5 border-2 rounded-lg transition-all cursor-pointer ${
                  loading && selectedRole === 'collector' 
                    ? 'border-blue-500 bg-blue-50 opacity-75' 
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                }`}
                onClick={(e) => !loading && handleRoleSelect('collector', e)}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-3xl sm:text-4xl">📊</span>
                  <div className="flex-1">
                    <div className="font-bold text-gray-900 text-base sm:text-lg">
                      Sebagai Collector
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Akses monitoring semua cabang & laporan lengkap
                    </div>
                    <div className="text-xs text-blue-600 font-medium mt-2">
                      ✨ Mode supervisor dengan dashboard analytics
                    </div>
                  </div>
                  {loading && selectedRole === 'collector' && (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  )}
                </div>
              </div>

              {/* Backup Kasir Mode Option */}
              <div 
                className={`p-4 sm:p-5 border-2 rounded-lg transition-all cursor-pointer ${
                  loading && selectedRole === 'backup_kasir' 
                    ? 'border-orange-500 bg-orange-50 opacity-75' 
                    : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                }`}
                onClick={(e) => !loading && handleRoleSelect('backup_kasir', e)}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-3xl sm:text-4xl">🏪</span>
                  <div className="flex-1">
                    <div className="font-bold text-gray-900 text-base sm:text-lg">
                      Backup Kasir
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Operasional kasir di cabang tertentu
                    </div>
                    <div className="text-xs text-orange-600 font-medium mt-2">
                      🛒 Mode operasional dengan POS system lengkap
                    </div>
                  </div>
                  {loading && selectedRole === 'backup_kasir' && (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
                  )}
                </div>
              </div>
            </div>

            {/* Info Section */}
            {/* <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
              <div className="flex items-start space-x-2">
                <span className="text-lg">💡</span>
                <div className="text-xs sm:text-sm text-gray-700">
                  <p className="font-medium mb-1">Tips:</p>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Mode Collector: Lihat semua data, buat laporan</li>
                    <li>• Mode Backup Kasir: Transaksi, kelola stok, presensi</li>
                  </ul>
                </div>
              </div>
            </div> */}

            {loading && (
              <div className="mt-4 text-center">
                <div className="text-sm text-gray-600">
                  {selectedRole === 'collector' ? 'Memuat dashboard collector...' : 'Memuat pilihan cabang...'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Memoize component to prevent unnecessary re-renders
export default memo(RoleSelectionModal)