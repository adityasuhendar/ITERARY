"use client"
import { useState, useEffect } from 'react'

// Helper function to get cookie value
const getCookie = (name) => {
  if (typeof window === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop().split(';').shift()
  return null
}

// Helper function to parse cookie expiry and calculate remaining time
const getStaffAccessInfo = () => {
  const granted = getCookie('staff-access-granted')
  if (granted !== 'true') return null
  
  // Since cookies don't store creation time, we'll show a generic message
  // In real implementation, you might want to add creation timestamp to cookie
  return {
    granted: true,
    status: 'Aktif sampai logout atau ekspired'
  }
}

export default function StaffAccessInfo() {
  const [accessInfo, setAccessInfo] = useState(null)

  useEffect(() => {
    // Update access info every minute
    const updateInfo = () => {
      const info = getStaffAccessInfo()
      setAccessInfo(info)
    }

    updateInfo()
    const interval = setInterval(updateInfo, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  const handleClearAccess = () => {
    if (window.confirm('Yakin ingin clear staff access? Anda perlu input kode lagi untuk akses halaman staff.')) {
      // Clear all staff access cookies
      document.cookie = 'staff-access-granted=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
      document.cookie = 'staff-access-role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
      setAccessInfo(null)
      
      // Refresh page to update UI
      window.location.reload()
    }
  }

  if (!accessInfo) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-green-600 text-lg">🔑</span>
          <div className="text-sm">
            <div className="font-medium text-green-800">
              Staff Access Aktif
            </div>
            <div className="text-green-600">
              {accessInfo.status}
            </div>
          </div>
        </div>
        
        <button
          onClick={handleClearAccess}
          className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
          title="Clear staff access"
        >
          Clear
        </button>
      </div>
    </div>
  )
}