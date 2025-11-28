// Shared utility for attendance window logic
export const ATTENDANCE_WINDOWS = {
  MORNING: {
    START: 5 * 60 + 30,  // 05:30 in minutes
    END: 14 * 60 + 30     // 14:30 in minutes
  },
  EVENING: {
    START: 13 * 60 + 30, // 13:30 in minutes
    END: 22 * 60 + 30    // 22:30 in minutes
  }
}

export const isWithinAttendanceWindow = () => {
  const now = new Date()
  const currentTime = now.toLocaleTimeString('en-US', { 
    timeZone: 'Asia/Jakarta', 
    hour12: false 
  })
  const [hours, minutes] = currentTime.split(':').map(Number)
  const currentMinutes = hours * 60 + minutes

  const isInMorningWindow = currentMinutes >= ATTENDANCE_WINDOWS.MORNING.START && 
                           currentMinutes <= ATTENDANCE_WINDOWS.MORNING.END
  const isInEveningWindow = currentMinutes >= ATTENDANCE_WINDOWS.EVENING.START && 
                           currentMinutes <= ATTENDANCE_WINDOWS.EVENING.END

  console.log('Current time (WIB):', currentTime)
  console.log('Is within attendance window:', isInMorningWindow || isInEveningWindow)
  
  return isInMorningWindow || isInEveningWindow
}

// Helper function to convert minutes to HH:MM format
const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

export const getAttendanceWindowText = () => {
  const morningWindow = `${minutesToTime(ATTENDANCE_WINDOWS.MORNING.START)}-${minutesToTime(ATTENDANCE_WINDOWS.MORNING.END)}`
  const eveningWindow = `${minutesToTime(ATTENDANCE_WINDOWS.EVENING.START)}-${minutesToTime(ATTENDANCE_WINDOWS.EVENING.END)}`
  return `Attendance hanya bisa dicatat dalam jam presensi (${morningWindow} untuk pagi, ${eveningWindow} untuk malam)`
}