"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import SessionExpired from '@/components/ui/SessionExpired'
import KasirDashboard from '@/components/dashboard/KasirDashboard'
import OwnerDashboard from '@/components/dashboard/OwnerDashboard'
import CollectorDashboard from '@/components/dashboard/CollectorDashboard'
import AdminDashboard from '@/components/dashboard/AdminDashboard'
import InvestorDashboard from '@/components/dashboard/InvestorDashboard'
import { useSessionHandler } from '@/hooks/useSessionHandler'

export default function DashboardPage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [invalidSession, setInvalidSession] = useState(false)
  const router = useRouter()
  const { clearSession } = useSessionHandler()

  const readUserData = () => {
    try {
      // Get user data from localStorage
      const userData = localStorage.getItem('user')
      // console.log('🔍 [Dashboard] Raw localStorage user:', userData)
      // console.log('🔍 [Dashboard] Called from:', new Error().stack.split('\n')[2])

      if (userData && userData !== 'undefined' && userData !== 'null' && userData.trim() !== '') {
        try {
          const parsedUser = JSON.parse(userData)
          console.log('🔍 [Dashboard] Parsed user data:', parsedUser)
          console.log('🔍 [Dashboard] current_shift:', parsedUser.current_shift)
          // console.log('🔍 [Dashboard] shift:', parsedUser.shift)

          if (parsedUser && (parsedUser.id || parsedUser.id_karyawan)) {
            // For kasir, active worker info is now handled via nama_karyawan from login

            setUser(parsedUser)
            setLoading(false)
          } else {
            // Invalid user data structure
            console.error('❌ Invalid user data structure:', parsedUser)
            setInvalidSession(true)
            setLoading(false)
          }
        } catch (error) {
          // Error parsing user data
          console.error('❌ Error parsing user data:', error, 'userData:', userData)
          setInvalidSession(true)
          setLoading(false)
        }
      } else {
        // No valid user data found
        console.error('❌ No valid user data found:', userData)
        setInvalidSession(true)
        setLoading(false)
      }
    } catch (error) {
      // Dashboard loading error
      console.error('❌ Dashboard loading error:', error)
      setInvalidSession(true)
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial read on mount
    readUserData()

    // 🎯 PWA-aware: Re-read when app returns from background to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 [PWA] App visible - re-reading user data')
        readUserData()
      }
    }

    // Re-read when window gets focus (user returns from shift selection)
    const handleFocus = () => {
      // console.log('🔄 [Dashboard] Window focus - re-reading localStorage')
      readUserData()
    }

    // Re-read when localStorage changes (cross-tab sync)
    const handleStorageChange = (e) => {
      if (e.key === 'user') {
        console.log('🔄 [Dashboard] localStorage changed - updating user data')
        readUserData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])


  const renderDashboard = () => {
    if (!user) return null

    switch (user.role) {
      case 'kasir':
        return <KasirDashboard user={user} />
      case 'owner':
        return <OwnerDashboard user={user} />
      case 'collector':
        return <CollectorDashboard user={user} />
      case 'super_admin':
        return <AdminDashboard user={user} />
      case 'investor':
        return <InvestorDashboard user={user} />
      default:
        return <div>Role tidak dikenali</div>
    }
  }

  if (invalidSession) {
    return <SessionExpired 
      title="Sesi Login Bermasalah"
      message="Maaf, data sesi login Anda tidak valid atau telah berakhir. Silakan login kembali untuk melanjutkan."
    />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dwash-red mx-auto mb-4"></div>
          <p className="text-dwash-gray">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const getRoleDisplayName = (role) => {
    const names = {
      'super_admin': 'Super Administrator',
      'owner': 'Owner',
      'collector': 'Collector',
      'kasir': 'Kasir',
      'investor': 'Investor'
    }
    return names[role] || role
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header user={user} />

      {/* Enhanced Main Content - Mobile First */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">

        {/* Role-specific Dashboard - Enhanced Container */}
        <div className="min-h-[60vh]">
          {renderDashboard()}
        </div>
      </main>
    </div>
  )
}