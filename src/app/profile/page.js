"use client"
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { getRoleConfig } from '@/lib/roleConfig'

// Move PasswordInput outside to prevent re-creation on every render
const PasswordInput = ({ label, value, onChange, placeholder, required, field, showPasswords, setShowPasswords }) => {
  const toggleVisibility = () => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="relative">
        <input
          type={showPasswords[field] ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-dwash-red focus:border-transparent outline-none"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={toggleVisibility}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
          tabIndex="-1"
        >
          {showPasswords[field] ? (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.758 6.758M9.878 9.878a3 3 0 00-.007 4.243m4.242-4.242L15.12 15.12m-4.242-4.242a3 3 0 014.243-.007M15.12 15.12l3.12 3.12m-3.12-3.12a3 3 0 01-4.243.007" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  const router = useRouter()

  // Form states
  const [profileData, setProfileData] = useState({
    nama_karyawan: '',
    username: ''
  })
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // Optimized onChange handlers to prevent re-renders
  const handleCurrentPasswordChange = useCallback((e) => {
    setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))
  }, [])

  const handleNewPasswordChange = useCallback((e) => {
    setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))
  }, [])

  const handleConfirmPasswordChange = useCallback((e) => {
    setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))
  }, [])

  useEffect(() => {
    fetchUserProfile()
  }, [])

  const fetchUserProfile = async () => {
    try {
      // Get active worker ID for kasir - try sessionStorage first, then localStorage
      let activeWorkerId = sessionStorage.getItem('active_worker_id')

      // Fallback to localStorage if sessionStorage is empty
      if (!activeWorkerId) {
        const userData = localStorage.getItem('user')
        if (userData) {
          const parsedUser = JSON.parse(userData)
          activeWorkerId = activeWorkerId || parsedUser.active_worker_id
        }
      }
      
      
      const headers = {
        'Content-Type': 'application/json'
      }
      
      if (activeWorkerId) {
        headers['x-active-worker-id'] = activeWorkerId
      }
      

      const response = await fetch('/api/profile', {
        method: 'GET',
        credentials: 'include',
        headers
      })
      
      
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        
        // Set form data based on profile type
        if (userData.is_worker_profile) {
          setProfileData({
            nama_pekerja: userData.nama_pekerja || '',
            is_worker_profile: true
          })
        } else {
          setProfileData({
            nama_karyawan: userData.nama_karyawan || '',
            username: userData.username || '',
            is_worker_profile: false
          })
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Profile fetch failed:', response.status, errorData)
        
        // If unauthorized, redirect to login
        if (response.status === 401 || response.status === 403) {
          console.log('Unauthorized access, redirecting to login')
          router.push('/login')
          return
        }
        
        throw new Error(errorData.message || `Failed to fetch profile (${response.status})`)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      setError('Gagal memuat profil pengguna: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      // Get active worker ID for kasir
      let activeWorkerId = sessionStorage.getItem('active_worker_id')

      // Fallback to localStorage if sessionStorage is empty
      if (!activeWorkerId) {
        const userData = localStorage.getItem('user')
        if (userData) {
          const parsedUser = JSON.parse(userData)
          activeWorkerId = activeWorkerId || parsedUser.active_worker_id
        }
      }
      
      const headers = { 'Content-Type': 'application/json' }
      if (activeWorkerId && profileData.is_worker_profile) {
        headers['x-active-worker-id'] = activeWorkerId
      }

      const response = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: JSON.stringify(profileData)
      })

      if (response.ok) {
        const updatedUser = await response.json()
        setUser(updatedUser)
        
        // Storage update removed - active_worker_name no longer managed here
        
        setSuccess('Profil berhasil diperbarui!')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Gagal memperbarui profil')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      setError('Error: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Password baru dan konfirmasi password tidak cocok')
      return
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password baru minimal 6 karakter')
      return
    }

    setSaving(true)
    setPasswordError('')
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/profile/password', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      })

      if (response.ok) {
        setSuccess('Password berhasil diubah!')
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setShowChangePassword(false)
        setTimeout(() => setSuccess(''), 3000)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Gagal mengubah password')
      }
    } catch (error) {
      console.error('Error changing password:', error)
      setPasswordError('Error: ' + error.message)
    } finally {
      setSaving(false)
    }
  }


  // Password Input Component with show/hide toggle

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dwash-red"></div>
      </div>
    )
  }

  const roleConfig = getRoleConfig(user?.jenis_karyawan)

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-12 h-12 text-2xl text-gray-700 hover:bg-gray-100 rounded-full transition-colors mr-4"
            >
              ←
            </button>
            <div className="text-center flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Profile Settings</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">Kelola informasi profil Anda</p>
            </div>
            <div className="w-12"></div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            ✅ {success}
          </div>
        )}
        
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            ❌ {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 lg:items-start">
          {/* Profile Info Card */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <div className="text-center space-y-4">
                {/* Avatar */}
                <div className={`w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-2xl ${roleConfig.color} ${roleConfig.textColor} flex items-center justify-center text-2xl sm:text-3xl font-bold shadow-lg`}>
                  {user?.is_worker_profile 
                    ? (user?.nama_pekerja ? user.nama_pekerja.charAt(0).toUpperCase() : 'U')
                    : (user?.nama_karyawan ? user.nama_karyawan.charAt(0).toUpperCase() : 'U')
                  }
                </div>
                
                {/* User Info */}
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                    {user?.is_worker_profile ? user?.nama_pekerja : user?.nama_karyawan || 'User'}
                  </h2>
                  <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-lg text-sm font-semibold ${roleConfig.color} ${roleConfig.textColor} mt-2 shadow-md`}>
                    <span>{roleConfig.icon}</span>
                    <span>{user?.is_worker_profile ? 'Pekerja' : roleConfig.name}</span>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="space-y-2 text-sm text-gray-600">
                  {user?.cabang && (
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{user.cabang}</span>
                    </div>
                  )}
                  {user?.shift && (
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Shift {user.shift}</span>
                    </div>
                  )}
                  {!user?.is_worker_profile && user?.terakhir_login && (
                    <div className="text-xs text-gray-500 mt-3">
                      Login terakhir: {new Date(user.terakhir_login).toLocaleString('id-ID')}
                    </div>
                  )}
                  
                  {user?.is_worker_profile && (
                    <div className="text-xs text-gray-500 mt-3">
                      Status: {user.status_aktif === 'aktif' ? '✅ Aktif' : '❌ Tidak Aktif'}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Forms */}
          <div className="lg:col-span-2 space-y-6 flex flex-col">
            {/* Profile Form */}
            <Card className="flex-1">
              <h3 className="text-lg sm:text-xl font-semibold mb-6">
                {user?.is_worker_profile ? 'Informasi Pekerja' : 'Informasi Profil'}
              </h3>
              <form onSubmit={handleProfileUpdate} className="space-y-4 sm:space-y-6">
                {user?.is_worker_profile ? (
                  // Worker profile fields
                  <>
                    <Input
                      label="Nama Pekerja"
                      value={profileData.nama_pekerja || ''}
                      onChange={(e) => setProfileData(prev => ({ ...prev, nama_pekerja: e.target.value }))}
                      required
                      className="text-sm sm:text-base"
                    />
                    
                  </>
                ) : (
                  // Kasir account fields
                  <>
                    <Input
                      label="Nama Lengkap"
                      value={profileData.nama_karyawan || ''}
                      onChange={(e) => setProfileData(prev => ({ ...prev, nama_karyawan: e.target.value }))}
                      required
                      className="text-sm sm:text-base"
                    />
                    
                    <Input
                      label="Username"
                      value={profileData.username || ''}
                      onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                      required
                      className="text-sm sm:text-base"
                    />
                  </>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    type="submit" 
                    disabled={saving}
                    className={user?.is_worker_profile ? "w-full" : "order-2 sm:order-1"}
                  >
                    {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </Button>
                  {!user?.is_worker_profile && (
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => setShowChangePassword(true)}
                      className="order-1 sm:order-2"
                    >
                      🔒 Ubah Password
                    </Button>
                  )}
                </div>
              </form>
            </Card>

          </div>
        </div>

        {/* Change Password Modal - Only for kasir accounts */}
        {!user?.is_worker_profile && (
          <Modal
          isOpen={showChangePassword}
          onClose={() => {
            setShowChangePassword(false)
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
            setPasswordError('')
            setShowPasswords({ current: false, new: false, confirm: false })
          }}
          title="Ubah Password"
          size="md"
        >
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {/* Error Message in Modal */}
            {passwordError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                ❌ {passwordError}
              </div>
            )}
            
            <PasswordInput
              label="Password Saat Ini"
              value={passwordData.currentPassword}
              onChange={handleCurrentPasswordChange}
              placeholder="Masukkan password saat ini"
              required
              field="current"
              showPasswords={showPasswords}
              setShowPasswords={setShowPasswords}
            />

            <PasswordInput
              label="Password Baru"
              value={passwordData.newPassword}
              onChange={handleNewPasswordChange}
              placeholder="Minimal 6 karakter"
              required
              field="new"
              showPasswords={showPasswords}
              setShowPasswords={setShowPasswords}
            />

            <PasswordInput
              label="Konfirmasi Password Baru"
              value={passwordData.confirmPassword}
              onChange={handleConfirmPasswordChange}
              placeholder="Ulangi password baru"
              required
              field="confirm"
              showPasswords={showPasswords}
              setShowPasswords={setShowPasswords}
            />

            <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center">
              <Button
                type="submit"
                disabled={saving}
              >
                {saving ? 'Mengubah...' : 'Ubah Password'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowChangePassword(false)
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
                  setPasswordError('')
                  setShowPasswords({ current: false, new: false, confirm: false })
                }}
              >
                Batal
              </Button>
            </div>
          </form>
        </Modal>
        )}
      </div>
    </div>
  )
}