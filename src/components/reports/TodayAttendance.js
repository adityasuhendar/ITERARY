"use client"
import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'

export default function TodayAttendance() {
  const [todayAttendance, setTodayAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTodayAttendance()
    // Refresh every 1 minute for real-time updates
    const interval = setInterval(fetchTodayAttendance, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchTodayAttendance = async () => {
    try {
      setLoading(true)
      setError('')
      
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) // YYYY-MM-DD
      const response = await fetch(`/api/attendance/today`)

      if (!response.ok) {
        throw new Error('Failed to fetch attendance data')
      }

      const data = await response.json()
      setTodayAttendance(data.attendance || [])
    } catch (err) {
      console.error('Fetch today attendance error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timeString) => {
    if (!timeString) return '-'
    return new Date(timeString).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getShiftIcon = (shift) => {
    return shift === 'pagi' ? '🌅' : '🌙'
  }

  const getShiftLabel = (shift) => {
    return shift === 'pagi' ? 'Pagi' : 'Malam'
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="text-red-600 mb-4">❌ Error: {error}</div>
          <button 
            onClick={fetchTodayAttendance}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Coba Lagi
          </button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            📊 Kehadiran Hari Ini
          </h3>
          <p className="text-gray-600 text-sm">
            {new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        <button
          onClick={fetchTodayAttendance}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          title="Refresh data"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="space-y-4">
        {todayAttendance.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">👤</div>
            <p>Belum ada yang masuk hari ini</p>
            <p className="text-sm mt-1">Kasir akan muncul setelah login pertama kali</p>
          </div>
        ) : (
          todayAttendance.map((attendance, index) => (
            <div 
              key={`attendance-${attendance.id_attendance || index}`}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
            >
              <div className="flex items-center space-x-4">
                <div className="text-2xl">
                  {getShiftIcon(attendance.shift)}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {attendance.nama_pekerja}
                  </h4>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <span>Shift {getShiftLabel(attendance.shift)}</span>
                    <span>•</span>
                    <span>{attendance.nama_cabang || 'Cabang Utama'}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center space-x-2">
                  <span className="text-green-600 font-medium">✅ Masuk</span>
                  <span className="text-lg font-mono text-gray-900">
                    {formatTime(attendance.waktu_mulai)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Akun: {attendance.nama_akun_shift || 'N/A'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {todayAttendance.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-2">
            <span className="text-blue-600 text-lg">💡</span>
            <div className="text-sm text-blue-700">
              <p className="font-medium">Total yang masuk: {todayAttendance.length} orang</p>
              <p>Data diupdate otomatis setiap 1 menit</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}