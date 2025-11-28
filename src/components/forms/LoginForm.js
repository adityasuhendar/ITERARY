"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import ShiftSelectionModal from '@/components/modals/ShiftSelectionModal'
import RoleSelectionModal from '@/components/modals/RoleSelectionModal'
import BranchSelectionModal from '@/components/modals/BranchSelectionModal'
import SuccessModal from '@/components/modals/SuccessModal'
import { sanitizeInput, sanitizeOutput, validateUsername, validatePassword } from '@/lib/xssProtection'
import { pushManager } from '@/lib/pushNotifications'

export default function LoginForm() {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessingShift, setIsProcessingShift] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [showRoleSelectionModal, setShowRoleSelectionModal] = useState(false)
  const [showBranchSelectionModal, setShowBranchSelectionModal] = useState(false)
  const [showBackupShiftModal, setShowBackupShiftModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [userData, setUserData] = useState(null)
  const [selectedBranchData, setSelectedBranchData] = useState(null)
  
  const router = useRouter()

  // Request push notifications with appropriate context
  const requestPushNotifications = async (user) => {
    try {
      const context = {
        title: user.jenis_karyawan === 'kasir' ? 'Notifikasi Request'
               : user.jenis_karyawan === 'collector' ? 'Notifikasi Stock'
               : 'Notifikasi Management',
        message: user.jenis_karyawan === 'kasir'
          ? 'Dapatkan notifikasi saat request stock Anda disetujui atau ditolak'
          : user.jenis_karyawan === 'collector'
          ? 'Dapatkan notifikasi untuk monitoring stock requests dan approval status'
          : 'Dapatkan notifikasi saat ada request baru dari kasir yang perlu disetujui'
      }
      
      const result = await pushManager.enableNotifications(context)
      if (result.success) {
      } else {
      }
    } catch (error) {
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // Client-side validation and sanitization
    const sanitizedUsername = sanitizeInput(credentials.username.trim())
    const sanitizedPassword = sanitizeInput(credentials.password)

    // Validate input format
    if (!validateUsername(sanitizedUsername)) {
      setError('Username tidak valid. Gunakan huruf, angka, underscore, atau titik saja (3-50 karakter).')
      setIsLoading(false)
      return
    }

    if (!validatePassword(sanitizedPassword)) {
      setError('Password harus 6-100 karakter.')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: sanitizedUsername,
          password: sanitizedPassword,
          rememberMe: false
        })
      })

      const data = await response.json()

      if (data.success) {
        // Store user data in localStorage for client-side access
        // Token is automatically stored in httpOnly cookie by the API
        localStorage.setItem('user', JSON.stringify(data.user))
        
        // Remember Me feature removed
        
        // Request push notifications for owner and collector (kasir will be handled after attendance selection)
        if (data.user.jenis_karyawan === 'owner' || data.user.jenis_karyawan === 'collector') {
          requestPushNotifications(data.user)
        }
        
        // Check if user is kasir (shift worker)
        if (data.user.jenis_karyawan === 'kasir') {
          // For kasir, go to shift selection first
          setUserData(data.user)
          setIsProcessingShift(true)
          // Show shift modal immediately
          setShowShiftModal(true)
          // Keep loading until shift selection is complete
        } else if (data.user.jenis_karyawan === 'collector') {
          // For collector, show role selection modal (collector vs backup kasir)
          console.log('🔍 [LoginForm] Collector login - showing role selection modal')
          setUserData(data.user)
          setShowRoleSelectionModal(true)
          setIsLoading(false) // Stop loading to allow role selection
        } else {
          // For owner/super_admin users, show success modal then go to dashboard
          setShowSuccessModal(true)
          setTimeout(() => {
            setShowSuccessModal(false)
            router.push('/dashboard')
          }, 2000)
          setIsLoading(false)
        }
      } else {
        // Sanitize error message to prevent XSS
        setError(sanitizeOutput(data.message || 'Login gagal'))
        setIsLoading(false)
      }
    } catch (error) {
      setError('Terjadi kesalahan. Silakan coba lagi.')
      setIsLoading(false)
    }
  }

  const handleBackToHome = () => {
    router.push('/')
  }


  const handleShiftConfirm = (selectedShift) => {
    
    // Update user data with selected shift
    const userData = localStorage.getItem('user')
    if (userData) {
      const parsedUser = JSON.parse(userData)
      parsedUser.current_shift = selectedShift
      parsedUser.shift_time = selectedShift === 'pagi' ? '06:00-14:00' : '14:00-22:00'
      localStorage.setItem('user', JSON.stringify(parsedUser))
      
      // Request push notifications for kasir after shift selection
      if (parsedUser.jenis_karyawan === 'kasir') {
        requestPushNotifications(parsedUser)
      }
    }
    
    // Close shift modal and show success modal
    setShowShiftModal(false)
    setIsLoading(false) // Stop loading after shift confirmed
    setIsProcessingShift(false) // Stop shift processing
    setShowSuccessModal(true)
    setTimeout(() => {
      // Double-check localStorage before navigation
      const verifyData = localStorage.getItem('user')
      const verifyParsed = verifyData ? JSON.parse(verifyData) : null
      console.log('🔍 [LoginForm] Pre-navigation localStorage check:', verifyParsed?.current_shift)

      setShowSuccessModal(false)
      router.push('/dashboard')
    }, 2000)
  }

  const handleShiftModalClose = () => {
    setShowShiftModal(false)
    setIsLoading(false) // Stop loading if user cancels
    setIsProcessingShift(false) // Stop shift processing
    // Reset form if user cancels
    setCredentials({
      username: '',
      password: ''
    })
    setUserData(null)
  }

  const handleRoleSelection = async (role) => {
    console.log('🎯 handleRoleSelection called with role:', role)
    console.log('🎯 Time:', new Date().toISOString())
    console.log('🎯 showRoleSelectionModal state:', showRoleSelectionModal)
    console.log('🎯 Current userData:', userData)

    // Prevent auto-navigation during Fast Refresh
    if (!role || typeof role !== 'string') {
      console.warn('🚨 Invalid role selection - preventing auto-navigation')
      return
    }

    try {
      if (role === 'collector') {
        console.log('🎯 Processing collector role selection')
        // Regular collector mode - go to collector dashboard
        setShowRoleSelectionModal(false)
        setShowSuccessModal(true)
        setTimeout(() => {
          console.log('🚨 [LoginForm] Collector auto-redirect after 2 seconds')
          setShowSuccessModal(false)
          router.push('/dashboard')
        }, 2000)
      } else if (role === 'backup_kasir') {
        // Backup kasir mode - show branch selection
        console.log('🎯 Processing backup kasir - showing branch selection modal')
        // Add flag to prevent auto-navigation during backup kasir flow
        if (typeof window !== 'undefined') {
          window.backupKasirFlowActive = true
        }
        setShowRoleSelectionModal(false)
        setShowBranchSelectionModal(true)
      }
    } catch (error) {
      console.error('Role selection error:', error)
      setError('Terjadi kesalahan saat memilih role.')
    }
  }

  const handleBranchSelection = async (branchData) => {
    try {
      // Save branch data and proceed to shift selection
      setSelectedBranchData(branchData)
      setShowBranchSelectionModal(false)
      setShowBackupShiftModal(true)
    } catch (error) {
      console.error('Branch selection error:', error)
      setError(`Error: ${error.message}`)
    }
  }

  const handleBackupShiftConfirm = async (selectedShift) => {
    try {
      setIsLoading(true)
      
      // Call backup kasir API to transform JWT token with selected shift
      const response = await fetch('/api/backup-kasir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: selectedBranchData.branchId,
          branchName: selectedBranchData.branchName,
          shift: selectedShift,
          rememberMe: false
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create backup kasir session')
      }

      const data = await response.json()
      
      if (data.success) {
        // Update localStorage with new user data (now as kasir with shift)
        const userDataWithShift = {
          ...data.user,
          current_shift: selectedShift,
          shift_time: selectedShift === 'pagi' ? '06:00-14:00' : '14:00-22:00'
        }
        localStorage.setItem('user', JSON.stringify(userDataWithShift))

        // NOW do presensi after JWT is transformed (within attendance window)
        const now = new Date()
        const currentHour = now.getHours()
        const isInAttendanceWindow = (currentHour >= 6 && currentHour <= 14) || (currentHour >= 14 && currentHour <= 22)

        if (isInAttendanceWindow) {
          try {
            const attendanceResponse = await fetch('/api/attendance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                shift: selectedShift,
                auto_presensi: true
              })
            })

            if (attendanceResponse.ok) {
              const attendanceData = await attendanceResponse.json()
            } else {
              const errorData = await attendanceResponse.json()
              console.warn('❌ Backup kasir presensi failed:', errorData)
            }
          } catch (error) {
            console.error('❌ Backup kasir presensi network error:', error)
          }
        }

        // Close modals and show success
        setShowBackupShiftModal(false)
        setShowSuccessModal(true)

        setTimeout(() => {
          setShowSuccessModal(false)
          router.push('/dashboard') // Will now redirect to kasir dashboard
        }, 2000)
      } else {
        throw new Error(data.message || 'Failed to create backup kasir session')
      }
    } catch (error) {
      console.error('Backup shift selection error:', error)
      setError(`Error: ${error.message}`)
      setIsLoading(false)
    }
  }

  const handleRoleModalClose = () => {
    setShowRoleSelectionModal(false)
    // Reset form if user cancels
    setCredentials({
      username: '',
      password: ''
    })
    setUserData(null)
  }

  const handleBranchModalClose = () => {
    setShowBranchSelectionModal(false)
    // Reset any pending states to prevent auto-actions
    setSelectedBranchData(null)
    setError('')
    setIsLoading(false)
    // Don't remove localStorage - let user stay in collector dashboard
    // Go back to role selection without auto-selection
    setShowRoleSelectionModal(true)
  }

  const handleBackupShiftModalClose = () => {
    setShowBackupShiftModal(false)
    // Reset loading states to prevent stuck buttons
    setIsLoading(false)
    setError('')
    // Don't remove localStorage - let user stay in collector dashboard
    // Go back to branch selection
    setShowBranchSelectionModal(true)
    setSelectedBranchData(null)
  }

  return (
    <div className="w-full">
      {/* Back to Home Button - Mobile Enhanced */}
      <div className="mb-4 sm:mb-6">
        <button
          onClick={handleBackToHome}
          className="flex items-center text-dwash-gray hover:text-dwash-red transition-colors duration-200 group min-h-[44px] p-2 -m-2"
        >
          <svg 
            className="w-4 h-4 sm:w-5 sm:h-5 mr-2 transform group-hover:-translate-x-1 transition-transform duration-200" 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          <span className="font-medium text-sm sm:text-base">Kembali ke Home</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4">
          <Input
            label="Username"
            type="text"
            value={credentials.username}
            onChange={(e) => setCredentials({...credentials, username: sanitizeInput(e.target.value)})}
            placeholder="Masukkan username"
            required
            className="text-base"
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              value={credentials.password}
              onChange={(e) => setCredentials({...credentials, password: sanitizeInput(e.target.value)})}
              placeholder="Masukkan password"
              required
              className="text-base pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 mt-3 text-dwash-gray hover:text-dwash-dark transition-colors duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              {showPassword ? (
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                  <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
        </div>


        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg text-sm animate-shake">
            <div className="flex items-start">
              <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="break-words">{error}</span>
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={isLoading || isProcessingShift}
          className="w-full bg-dwash-red hover:bg-red-600 active:bg-red-700 text-white py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 min-h-[48px] text-base"
        >
          <div className="flex items-center justify-center">
            {(isLoading || isProcessingShift) && (
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {showShiftModal && isProcessingShift ? 'Memuat Pilihan Shift...' : 
             isLoading ? 'Memproses...' : 'Login'}
          </div>
        </Button>
      </form>

      {/* Login Info */}
      <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-200">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 sm:p-4 rounded-lg border border-blue-200">
          <div className="flex items-start">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 mt-0.5 mr-2 sm:mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-semibold text-blue-800 mb-1 sm:mb-2">Butuh Akses Login?</h4>
              <p className="text-xs sm:text-sm text-blue-700 leading-relaxed">
                Hubungi management untuk mendapatkan kredensial login staff.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Login Berhasil!"
        message="Anda akan diarahkan ke dashboard..."
        icon="🎉"
        autoClose={true}
        autoCloseDelay={2000}
      />

      {/* Shift Selection Modal */}
      <ShiftSelectionModal
        isOpen={showShiftModal}
        onClose={handleShiftModalClose}
        onConfirm={handleShiftConfirm}
        userData={userData}
      />

      {/* Role Selection Modal - Collector Mode Choice */}
      <RoleSelectionModal
        isOpen={showRoleSelectionModal}
        onClose={handleRoleModalClose}
        onSelectRole={handleRoleSelection}
        userData={userData}
      />

      {/* Branch Selection Modal - Backup Kasir Branch Choice */}
      <BranchSelectionModal
        isOpen={showBranchSelectionModal}
        onClose={handleBranchModalClose}
        onConfirm={handleBranchSelection}
        userData={userData}
      />

      {/* Backup Shift Selection Modal - Same as kasir shift selection */}
      <ShiftSelectionModal
        isOpen={showBackupShiftModal}
        onClose={handleBackupShiftModalClose}
        onConfirm={handleBackupShiftConfirm}
        userData={userData}
        selectedBranch={selectedBranchData}
      />
    </div>
  )
}