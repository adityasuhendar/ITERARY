// Shift detection logic using existing attendance window system
import { ATTENDANCE_WINDOWS } from '@/lib/attendanceWindow'

// Helper function to convert minutes to HH:MM format
const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

export const detectCurrentShift = () => {
  const now = new Date()
  const currentTime = now.toLocaleTimeString('en-US', { 
    timeZone: 'Asia/Jakarta', 
    hour12: false 
  })
  const [hours, minutes] = currentTime.split(':').map(Number)
  const currentMinutes = hours * 60 + minutes

  // Use same time windows as attendance system for presensi detection
  const isInMorningWindow = currentMinutes >= ATTENDANCE_WINDOWS.MORNING.START &&
                           currentMinutes <= ATTENDANCE_WINDOWS.MORNING.END
  const isInEveningWindow = currentMinutes >= ATTENDANCE_WINDOWS.EVENING.START &&
                           currentMinutes <= ATTENDANCE_WINDOWS.EVENING.END

  // Single shift logic - determine shift and availability
  const isPagiTime = (hours === 5 && minutes >= 30) || (hours >= 6 && hours < 14) || (hours === 14 && minutes <= 30)  // 05:30-14:30
  const isMalamTime = (hours === 13 && minutes >= 30) || (hours >= 14 && hours < 22) || (hours === 22 && minutes <= 30) // 13:30-22:30

  // Shift availability (when shift can be selected)
  const pagiAvailable = isPagiTime
  const malamAvailable = isMalamTime

  // Determine current shift
  if (isPagiTime) {
    return {
      shift: 'pagi',
      canPresensi: isInMorningWindow,
      timeRange: '05:30-14:30',
      icon: '🌅',
      currentTime: currentTime,
      pagiAvailable,
      malamAvailable
    }
  } else if (isMalamTime) {
    return {
      shift: 'malam',
      canPresensi: isInEveningWindow,
      timeRange: '13:30-22:30',
      icon: '🌙',
      currentTime: currentTime,
      pagiAvailable,
      malamAvailable
    }
  } else {
    // Should never reach here with new logic, but keeping as fallback
    return {
      shift: null,
      canPresensi: false,
      timeRange: 'Di luar jam operasional',
      icon: '🌛',
      currentTime: currentTime,
      pagiAvailable: isPagiTime,
      malamAvailable: isMalamTime
    }
  }
}

export const getShiftInfo = (shift) => {
  // Auto-generate presensi windows from ATTENDANCE_WINDOWS
  const morningPresensi = `${minutesToTime(ATTENDANCE_WINDOWS.MORNING.START)}-${minutesToTime(ATTENDANCE_WINDOWS.MORNING.END)}`
  const eveningPresensi = `${minutesToTime(ATTENDANCE_WINDOWS.EVENING.START)}-${minutesToTime(ATTENDANCE_WINDOWS.EVENING.END)}`
  
  const shifts = {
    pagi: {
      label: 'Shift Pagi',
      timeRange: '05:30-14:30',
      icon: '🌅',
      presensiWindow: morningPresensi,
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-500',
      textColor: 'text-orange-900'
    },
    malam: {
      label: 'Shift Malam',
      timeRange: '13:30-22:30',
      icon: '🌙',
      presensiWindow: eveningPresensi,
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-500',
      textColor: 'text-purple-900'
    }
  }
  return shifts[shift] || shifts.pagi
}

export const formatCurrentTime = () => {
  return new Date().toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit'
  })
}