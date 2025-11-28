"use client"
import { useState, useEffect, useRef } from 'react'
import { detectCurrentShift, getShiftInfo, formatCurrentTime } from '@/lib/shiftDetection'
import { isWithinAttendanceWindow } from '@/lib/attendanceWindow'

export default function ShiftSelectionModal({ isOpen, onClose, onConfirm, userData, selectedBranch = null }) {
  const [selectedShift, setSelectedShift] = useState('')
  const [shiftDetection, setShiftDetection] = useState(null)
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState('')
  const [attendanceStatus, setAttendanceStatus] = useState(null)
  const [attendanceByShift, setAttendanceByShift] = useState({ pagi: null, malam: null })
  const [shiftConflicts, setShiftConflicts] = useState({ pagi: null, malam: null })
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const initialized = useRef(false)

  // Check if user already has attendance today (personal endpoint)
  const checkAttendanceStatus = async () => {
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      const branchId = userData?.cabang_id || userData?.id_cabang
      
      // Check both shifts in parallel
      const [pagiResponse, malamResponse] = await Promise.all([
        fetch(`/api/attendance/check-shift?date=${today}&shift=pagi&branch=${branchId}&checkSelf=true`),
        fetch(`/api/attendance/check-shift?date=${today}&shift=malam&branch=${branchId}&checkSelf=true`)
      ])
      
      const pagiData = pagiResponse.ok ? await pagiResponse.json() : { hasAttendance: false }
      const malamData = malamResponse.ok ? await malamResponse.json() : { hasAttendance: false }
      
      // Set attendance status per shift
      setAttendanceByShift({
        pagi: pagiData.hasAttendance ? pagiData : null,
        malam: malamData.hasAttendance ? malamData : null
      })
      
      // Keep legacy attendanceStatus for backward compatibility
      const hasAnyAttendance = pagiData.hasAttendance || malamData.hasAttendance
      setAttendanceStatus(hasAnyAttendance ? (pagiData || malamData) : null)
      
    } catch (error) {
      console.warn('Failed to check attendance status:', error)
      setAttendanceStatus(null)
      setAttendanceByShift({ pagi: null, malam: null })
    }
  }

  // Check if shifts are already taken by others (conflict prevention)
  const checkShiftConflicts = async () => {
    setCheckingConflicts(true)
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      // For backup kasir, use selected branch. For normal kasir, use user's assigned branch
      const branchId = selectedBranch?.branchId || userData?.cabang_id || userData?.id_cabang


      // Check both shifts in parallel
      const [pagiResponse, malamResponse] = await Promise.all([
        fetch(`/api/attendance/check-shift?date=${today}&shift=pagi&branch=${branchId}`),
        fetch(`/api/attendance/check-shift?date=${today}&shift=malam&branch=${branchId}`)
      ])
      
      const pagiData = pagiResponse.ok ? await pagiResponse.json() : { hasAttendance: false }
      const malamData = malamResponse.ok ? await malamResponse.json() : { hasAttendance: false }
      
      // Add delay for smoother transition
      await new Promise(resolve => setTimeout(resolve, 800))
      
      // Only consider as conflict if taken by someone else (not current user)
      const currentUserId = userData?.id || userData?.id_karyawan
      setShiftConflicts({
        pagi: pagiData.hasAttendance && pagiData.workerId !== currentUserId ? pagiData.workerName : null,
        malam: malamData.hasAttendance && malamData.workerId !== currentUserId ? malamData.workerName : null
      })
      
      // console.log('Shift conflicts:', { 
      //   pagi: pagiData.hasAttendance ? pagiData.workerName : 'Available',
      //   malam: malamData.hasAttendance ? malamData.workerName : 'Available'
      // })
      
    } catch (error) {
      console.warn('Failed to check shift conflicts:', error)
      setShiftConflicts({ pagi: null, malam: null })
    } finally {
      setCheckingConflicts(false)
    }
  }

  // Main effect - run once when modal opens
  useEffect(() => {
    if (isOpen) {
      const detected = detectCurrentShift()
      setShiftDetection(detected)
      
      // Check existing attendance and shift conflicts
      checkAttendanceStatus()
      checkShiftConflicts()
      
      setCurrentTime(formatCurrentTime())
    }
  }, [isOpen])

  // Auto-select shift - run once after shift detection is set
  useEffect(() => {
    if (isOpen && shiftDetection && !selectedShift) {
      // Auto-select available shift, prefer detected shift if available
      if (shiftDetection.shift === 'pagi' && shiftDetection.pagiAvailable) {
        setSelectedShift('pagi')
      } else if (shiftDetection.shift === 'malam' && shiftDetection.malamAvailable) {
        setSelectedShift('malam')
      } else if (shiftDetection.pagiAvailable) {
        setSelectedShift('pagi')
      } else if (shiftDetection.malamAvailable) {
        setSelectedShift('malam')
      } else {
        setSelectedShift('') // No available shifts
      }
    }
  }, [isOpen, shiftDetection])

  // Time update interval - separate from main logic
  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        setCurrentTime(formatCurrentTime())
        // Update shift detection for time display only (don't trigger state changes)
        const updatedDetection = detectCurrentShift()
        setShiftDetection(updatedDetection)
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [isOpen])

  const handleShiftConfirm = async (shift, withPresensi = false) => {
    setLoading(true)
    
    try {
      // Skip presensi for backup kasir (will be handled after JWT transform)
      const isBackupKasirFlow = selectedBranch !== null

      // Optional: Record attendance if in presensi window (only for normal kasir)
      if (withPresensi && shiftDetection?.canPresensi && !isBackupKasirFlow) {

        try {
          const response = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shift: shift,
              auto_presensi: true
            })
          })


          if (!response.ok) {
            const errorData = await response.json()
            console.error('❌ Presensi failed:', errorData)
            // Continue anyway - presensi failure shouldn't block login
          } else {
            const successData = await response.json()
          }
        } catch (error) {
          console.error('❌ Presensi network error:', error)
        }
      } else {
      }

      // Continue with shift assignment
      onConfirm(shift)
    } catch (error) {
      console.error('Error during shift confirmation:', error)
      // Continue even if presensi fails
      onConfirm(shift)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const pagiInfo = getShiftInfo('pagi')
  const malamInfo = getShiftInfo('malam')
  const canPresensi = shiftDetection?.canPresensi || false
  const hasAttendanceToday = attendanceByShift.pagi !== null || attendanceByShift.malam !== null
  const hasAttendanceForSelectedShift = selectedShift && attendanceByShift[selectedShift] !== null
  const hasShiftConflict = selectedShift && shiftConflicts[selectedShift]
  // Get branch name from existing attendance records
  const existingAttendanceBranch = attendanceByShift.pagi?.nama_cabang || attendanceByShift.malam?.nama_cabang
  const currentBranch = selectedBranch ? selectedBranch.branchName : (userData?.nama_cabang || userData?.cabang || userData?.cabang_name)
  const isBlockedByAttendance = hasAttendanceToday && existingAttendanceBranch && currentBranch && existingAttendanceBranch !== currentBranch
  const isWithinPresensiWindow = canPresensi && !isBlockedByAttendance && !hasShiftConflict

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
      <div className="relative z-10 h-full flex items-center justify-center p-2 overflow-hidden">
        <div className="w-full max-w-[90%] sm:max-w-sm lg:max-w-md mx-auto max-h-[95vh] overflow-y-auto">
        <div className="bg-white/95 backdrop-blur-sm shadow-2xl rounded-2xl p-4 sm:p-6 lg:p-8 border-0 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors"
          title="Tutup"
        >
          <span className="text-lg font-medium">×</span>
        </button>

        <div className="text-center mb-4 sm:mb-6">
          <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">👋</div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 sm:mb-2">
            Selamat datang, {userData?.name || userData?.nama_karyawan}!
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
            Pilih shift untuk hari ini ({new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })})
          </p>
        </div>

        <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
          {/* Shift Pagi Option */}
          <div 
            className={`p-3 sm:p-4 border-2 rounded-lg transition-all ${
              !shiftDetection?.pagiAvailable || shiftConflicts.pagi
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60' 
                : selectedShift === 'pagi' 
                  ? 'border-orange-500 bg-orange-50 cursor-pointer' 
                  : 'border-gray-200 hover:border-orange-300 cursor-pointer'
            }`}
            onClick={() => shiftDetection?.pagiAvailable && !shiftConflicts.pagi && setSelectedShift('pagi')}
          >
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{pagiInfo.icon}</span>
              <div className="flex-1">
                <div className={`font-semibold ${!shiftDetection?.pagiAvailable ? 'text-gray-500' : 'text-gray-900'}`}>
                  {pagiInfo.label}
                </div>
                <div className={`text-sm ${!shiftDetection?.pagiAvailable ? 'text-gray-400' : 'text-gray-600'}`}>
                  {pagiInfo.timeRange}
                </div>
                {!shiftDetection?.pagiAvailable && (
                  <div className="text-xs text-red-500 font-medium mt-1">
                    ⏰ Tidak tersedia di jam ini (tersedia 05:30-14:30)
                  </div>
                )}
                {attendanceByShift.pagi && (
                  <div className={`text-xs font-medium mt-1 ${
                    attendanceByShift.pagi.nama_cabang === currentBranch
                      ? 'text-green-600'
                      : 'text-blue-500'
                  }`}>
                    ✅ Anda sudah presensi hari ini di {attendanceByShift.pagi.nama_cabang ? `Cabang ${attendanceByShift.pagi.nama_cabang}` : 'cabang lain'} ({new Date(attendanceByShift.pagi.waktu_mulai || attendanceByShift.pagi.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })})
                    <br />
                    <span className="text-xs text-gray-500">
                      {attendanceByShift.pagi.nama_cabang === currentBranch
                        ? ''
                        : (userData?.jenis_karyawan === 'collector' || (userData?.backup_mode && userData?.original_role === 'collector'))
                          ? 'Collector hanya boleh backup kasir 1 shift per hari.'
                          : 'Sudah presensi di cabang lain hari ini.'
                      }
                    </span>
                  </div>
                )}
                {shiftConflicts.pagi && (
                  <div className="text-xs text-red-500 font-medium mt-1">
                    🔒 Shift sudah diambil oleh {shiftConflicts.pagi}
                  </div>
                )}
              </div>
              {selectedShift === 'pagi' && shiftDetection?.pagiAvailable && (
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">✓</span>
                </div>
              )}
              {!shiftDetection?.pagiAvailable && (
                <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-gray-500 text-sm">🔒</span>
                </div>
              )}
            </div>
          </div>

          {/* Shift Malam Option */}
          <div 
            className={`p-3 sm:p-4 border-2 rounded-lg transition-all ${
              !shiftDetection?.malamAvailable || shiftConflicts.malam
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60' 
                : selectedShift === 'malam' 
                  ? 'border-purple-500 bg-purple-50 cursor-pointer' 
                  : 'border-gray-200 hover:border-purple-300 cursor-pointer'
            }`}
            onClick={() => shiftDetection?.malamAvailable && !shiftConflicts.malam && setSelectedShift('malam')}
          >
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{malamInfo.icon}</span>
              <div className="flex-1">
                <div className={`font-semibold ${!shiftDetection?.malamAvailable ? 'text-gray-500' : 'text-gray-900'}`}>
                  {malamInfo.label}
                </div>
                <div className={`text-sm ${!shiftDetection?.malamAvailable ? 'text-gray-400' : 'text-gray-600'}`}>
                  {malamInfo.timeRange}
                </div>
                {!shiftDetection?.malamAvailable && (
                  <div className="text-xs text-red-500 font-medium mt-1">
                    ⏰ Tidak tersedia di jam ini (tersedia 13:30-22:30)
                  </div>
                )}
                {attendanceByShift.malam && (
                  <div className={`text-xs font-medium mt-1 ${
                    attendanceByShift.malam.nama_cabang === currentBranch
                      ? 'text-green-600'
                      : 'text-blue-500'
                  }`}>
                    ✅ Anda sudah presensi hari ini di {attendanceByShift.malam.nama_cabang ? `Cabang ${attendanceByShift.malam.nama_cabang}` : 'cabang lain'} ({new Date(attendanceByShift.malam.waktu_mulai || attendanceByShift.malam.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })})
                    <br />
                    <span className="text-xs text-gray-500">
                      {attendanceByShift.malam.nama_cabang === currentBranch
                        ? ''
                        : (userData?.jenis_karyawan === 'collector' || (userData?.backup_mode && userData?.original_role === 'collector'))
                          ? 'Collector hanya boleh backup kasir 1 shift per hari.'
                          : 'Sudah presensi di cabang lain hari ini.'
                      }
                    </span>
                  </div>
                )}
                {shiftConflicts.malam && (
                  <div className="text-xs text-red-500 font-medium mt-1">
                    🔒 Shift sudah diambil oleh {shiftConflicts.malam}
                  </div>
                )}
              </div>
              {selectedShift === 'malam' && shiftDetection?.malamAvailable && (
                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">✓</span>
                </div>
              )}
              {!shiftDetection?.malamAvailable && (
                <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-gray-500 text-sm">🔒</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Single Smart Button */}
        <div className="space-y-2 sm:space-y-3">
          {/* Single dynamic button */}
          <button
            onClick={() => handleShiftConfirm(selectedShift, isWithinPresensiWindow)}
            disabled={!selectedShift || loading || hasShiftConflict || checkingConflicts || isBlockedByAttendance}
            className={`w-full py-3 sm:py-4 rounded-lg font-semibold text-sm sm:text-base transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              hasShiftConflict || isBlockedByAttendance
                ? 'bg-gray-400 text-gray-600'
                : isWithinPresensiWindow && !hasAttendanceForSelectedShift
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {loading ? 'Memproses...' :
             checkingConflicts ? 'Memeriksa...' :
             hasShiftConflict
               ? '🔒 Shift Sudah Diambil'
               : isBlockedByAttendance
                 ? '🚫 Tidak Bisa - Cabang Berbeda'
                 : hasAttendanceForSelectedShift && !isBlockedByAttendance
                   ? '👋 Selamat Datang Kembali'
                   : isWithinPresensiWindow && !hasAttendanceForSelectedShift
                     ? '✅ Masuk + Catat Presensi'
                     : '🚀 Masuk Dashboard'
            }
          </button>
          
          {/* Status indicator below button */}
          <div className="text-center">
            
            {/* {!hasAttendanceToday && !canPresensi && (
              <div className="flex items-center justify-center space-x-2 text-sm">
                <span className="text-2xl">🟡</span>
                <div className="text-gray-600">
                  <div className="font-medium">Di luar jam presensi</div>
                  <div className="text-xs text-gray-500">Login operasional saja</div>
                </div>
              </div>
            )} */}
            
              {/* {hasShiftConflict && (
                <div className="flex items-center justify-center space-x-2 text-sm">
                  <span className="text-2xl">🔒</span>
                  <div className="text-red-700">
                    <div className="font-medium">Shift sudah diambil oleh {shiftConflicts[selectedShift]}</div>
                  </div>
                </div>
              )} */}

            {!hasAttendanceForSelectedShift && !hasShiftConflict && canPresensi && (
              <div className="text-center text-sm">
                <div className="text-green-700">
                  <div className="font-medium">Dalam jam presensi</div>
                  <div className="text-xs text-green-600">Bisa langsung catat kehadiran</div>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
        </div>
      </div>
    </div>
  )
}