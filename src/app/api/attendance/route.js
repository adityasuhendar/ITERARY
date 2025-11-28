import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import jwt from 'jsonwebtoken'
import { isWithinAttendanceWindow, getAttendanceWindowText } from '@/lib/attendanceWindow'

// Helper function to clean shift values
function cleanShiftValue(shift) {
  if (!shift) return 'unknown'
  
  const shiftStr = shift.toString().toLowerCase()
  
  // Direct matches
  if (shiftStr === 'pagi') return 'pagi'
  if (shiftStr === 'malam') return 'malam'
  
  // Pattern-based detection for numeric codes
  // Assuming: numbers ending with 0 = pagi, numbers ending with 1 = malam
  if (/^\d+$/.test(shiftStr)) {
    if (shiftStr.includes('0') && !shiftStr.includes('1')) return 'pagi'
    if (shiftStr.includes('1') && !shiftStr.includes('0')) return 'malam'
    // Mixed numbers - use last digit
    const lastDigit = shiftStr.slice(-1)
    return lastDigit === '0' ? 'pagi' : 'malam'
  }
  
  // Contains text
  if (shiftStr.includes('pagi')) return 'pagi'
  if (shiftStr.includes('malam')) return 'malam'
  
  return 'unknown'
}

export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || (decoded.jenis_karyawan !== 'owner' && decoded.jenis_karyawan !== 'super_admin')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // Format: YYYY-MM
    const branchId = searchParams.get('branch_id')
    const date = searchParams.get('date') // Format: YYYY-MM-DD
    
    // Default to current month if not specified
    const currentDate = new Date()
    const targetMonth = month || currentDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(0, 7)
    
    let whereConditions = []
    let queryParams = []
    
    // Date filter - prioritize specific date over month
    if (date) {
      whereConditions.push('DATE(a.tanggal) = ?')
      queryParams.push(date)
    } else {
      whereConditions.push('DATE_FORMAT(a.tanggal, "%Y-%m") = ?')
      queryParams.push(targetMonth)
    }
    
    if (branchId) {
      whereConditions.push('a.id_cabang = ?')
      queryParams.push(branchId)
    }

    
    
    
    
    // Get attendance data for the month
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    const attendanceData = await query(`
      SELECT 
        a.*,
        k.nama_karyawan as nama_akun_shift,
        c.nama_cabang,
        DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal_formatted,
        DATE_FORMAT(a.waktu_mulai, '%H:%i') as jam_mulai,
        DATE_FORMAT(a.waktu_selesai, '%H:%i') as jam_selesai
      FROM attendance_harian a
      LEFT JOIN karyawan k ON a.id_karyawan_akun = k.id_karyawan
      LEFT JOIN cabang c ON a.id_cabang = c.id_cabang
      ${whereClause}
      ORDER BY a.tanggal DESC, a.shift ASC
    `, queryParams)
    
    
    

    // Get raw summary data and clean it in JavaScript
    const rawSummaryData = await query(`
      SELECT 
        a.nama_pekerja,
        c.nama_cabang,
        a.shift,
        COUNT(*) as count_per_shift
      FROM attendance_harian a
      LEFT JOIN cabang c ON a.id_cabang = c.id_cabang
      ${whereClause}
      GROUP BY a.nama_pekerja, c.nama_cabang, a.shift
      ORDER BY a.nama_pekerja, c.nama_cabang
    `, queryParams)

    // Clean and aggregate the data in JavaScript
    const summaryMap = {}
    rawSummaryData.forEach(row => {
      const key = `${row.nama_pekerja}_${row.nama_cabang}`
      if (!summaryMap[key]) {
        summaryMap[key] = {
          nama_pekerja: row.nama_pekerja,
          nama_cabang: row.nama_cabang,
          total_hari: 0,
          shift_pagi: 0,
          shift_malam: 0
        }
      }
      
      // Clean shift value
      const cleanShift = cleanShiftValue(row.shift)
      summaryMap[key].total_hari += row.count_per_shift
      
      if (cleanShift === 'pagi') {
        summaryMap[key].shift_pagi += row.count_per_shift
      } else if (cleanShift === 'malam') {
        summaryMap[key].shift_malam += row.count_per_shift
      }
    })

    const summaryData = Object.values(summaryMap).sort((a, b) => b.total_hari - a.total_hari)

    return NextResponse.json({
      success: true,
      attendance: attendanceData,
      summary: summaryData,
      month: targetMonth
    })

  } catch (error) {
    console.error('Attendance GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    console.log('POST /api/attendance - Token:', token ? 'Present' : 'Missing')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - No token' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log('POST /api/attendance - Decoded token:', { id: decoded.id, jenis_karyawan: decoded.jenis_karyawan })
    
    if (!decoded || (decoded.jenis_karyawan !== 'kasir' && decoded.jenis_karyawan !== 'collector')) {
      return NextResponse.json({
        error: 'Only kasir or backup collector can record attendance',
        current_role: decoded?.jenis_karyawan
      }, { status: 403 })
    }

    const body = await request.json()
    const { shift, auto_presensi = false } = body

    if (!shift || !['pagi', 'malam'].includes(shift)) {
      return NextResponse.json({ error: 'Shift tidak valid. Pilih pagi atau malam.' }, { status: 400 })
    }

    // Get current user data using ID from token
    const userId = decoded.id || decoded.id_karyawan
    console.log('POST /api/attendance - Looking for user ID:', userId)
    
    const currentUser = await query(`
      SELECT id_karyawan, nama_karyawan, id_cabang 
      FROM karyawan 
      WHERE id_karyawan = ?
    `, [userId])

    if (currentUser.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { nama_karyawan, id_cabang: originalCabangId } = currentUser[0]

    // For backup kasir, use the selected branch from JWT token, not original branch
    const isBackupMode = decoded.backup_mode === true
    const hasBackupCabang = decoded.cabang_id !== undefined && decoded.cabang_id !== null
    const finalCabangId = isBackupMode && hasBackupCabang ? decoded.cabang_id : originalCabangId

    console.log('=== ATTENDANCE DEBUG ===')
    console.log('User ID:', userId)
    console.log('User name:', nama_karyawan)
    console.log('Original cabang ID:', originalCabangId)
    console.log('JWT full decoded:', JSON.stringify(decoded, null, 2))
    console.log('JWT cabang ID:', decoded.cabang_id)
    console.log('JWT backup mode:', decoded.backup_mode)
    console.log('Is backup mode?', isBackupMode)
    console.log('Has backup cabang?', hasBackupCabang)
    console.log('Final cabang ID used:', finalCabangId)
    console.log('========================')

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

    // Check if within attendance window
    if (!isWithinAttendanceWindow()) {
      return NextResponse.json({ 
        error: getAttendanceWindowText()
      }, { status: 400 })
    }

    // Check if attendance already recorded for this specific shift today
    const existingAttendance = await query(`
      SELECT id_attendance
      FROM attendance_harian
      WHERE id_karyawan_akun = ? AND tanggal = ? AND shift = ?
    `, [userId, today, shift])

    if (existingAttendance.length > 0) {
      return NextResponse.json({ 
        error: `Attendance sudah tercatat untuk shift ${shift} hari ini` 
      }, { status: 400 })
    }

    // Insert new attendance record (personal account system - no id_pekerja needed)
    const result = await query(`
      INSERT INTO attendance_harian (
        id_karyawan_akun, nama_pekerja, tanggal, shift, id_cabang
      ) VALUES (?, ?, ?, ?, ?)
    `, [userId, nama_karyawan, today, shift, finalCabangId])

    return NextResponse.json({
      success: true,
      message: 'Presensi berhasil dicatat',
      attendance_id: result.insertId,
      data: {
        nama_pekerja: nama_karyawan,
        tanggal: today,
        shift: shift,
        auto_presensi: auto_presensi
      }
    })

  } catch (error) {
    console.error('Attendance POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || (decoded.jenis_karyawan !== 'kasir' && decoded.jenis_karyawan !== 'collector')) {
      return NextResponse.json({ error: 'Only kasir or backup collector can update attendance' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body // 'finish' for ending shift

    if (action === 'finish') {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      
      // Update attendance to finished
      await query(`
        UPDATE attendance_harian 
        SET status = 'selesai', waktu_selesai = CURRENT_TIMESTAMP
        WHERE id_karyawan_akun = ? AND tanggal = ? AND status = 'aktif'
      `, [decoded.id_karyawan, today])

      return NextResponse.json({
        success: true,
        message: 'Shift selesai dicatat'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Attendance PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}