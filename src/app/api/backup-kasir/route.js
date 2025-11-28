import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { verifyToken, createToken } from '@/lib/auth'
import { logSecurityEvent } from '@/lib/security'

// Get client IP helper
function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIp) return realIp.trim()
  return '127.0.0.1'
}

export async function POST(request) {
  const clientIP = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'Unknown'

  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify current token
    const user = verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    // Only collector can use backup kasir feature
    if (user.jenis_karyawan !== 'collector') {
      logSecurityEvent('BACKUP_KASIR_UNAUTHORIZED_ACCESS', {
        username: user.username?.substring(0, 3) + '***',
        role: user.jenis_karyawan,
        ip: clientIP,
        userAgent
      }, clientIP)

      return NextResponse.json({ 
        error: 'Access denied. Collector role required.' 
      }, { status: 403 })
    }

    const { branchId, branchName, shift, rememberMe = false } = await request.json()

    // Validate required fields
    if (!branchId || !branchName || !shift) {
      return NextResponse.json({ 
        error: 'Branch ID, name, and shift are required' 
      }, { status: 400 })
    }

    // Validate shift value
    if (!['pagi', 'malam'].includes(shift)) {
      return NextResponse.json({ 
        error: 'Invalid shift. Must be pagi or malam' 
      }, { status: 400 })
    }

    // Verify branch exists and is active
    const branchCheck = await query(`
      SELECT id_cabang, nama_cabang, status_aktif 
      FROM cabang 
      WHERE id_cabang = ? AND status_aktif = 'aktif'
    `, [branchId])

    if (branchCheck.length === 0) {
      logSecurityEvent('BACKUP_KASIR_INVALID_BRANCH', {
        username: user.username?.substring(0, 3) + '***',
        branchId: branchId,
        ip: clientIP,
        userAgent
      }, clientIP)

      return NextResponse.json({ 
        error: 'Invalid or inactive branch' 
      }, { status: 400 })
    }

    const branch = branchCheck[0]

    // Get collector's full data for backup kasir session
    const collectorData = await query(`
      SELECT k.*, c.nama_cabang as original_cabang, r.nama_role
      FROM karyawan k 
      LEFT JOIN cabang c ON k.id_cabang = c.id_cabang
      JOIN role_permissions r ON k.id_role = r.id_role
      WHERE k.id_karyawan = ? AND k.status_aktif = 'aktif'
    `, [user.id])

    if (collectorData.length === 0) {
      return NextResponse.json({ 
        error: 'Collector data not found' 
      }, { status: 404 })
    }

    const collector = collectorData[0]

    // Create backup kasir session data
    const backupKasirSessionData = {
      id: collector.id_karyawan,
      username: collector.username || '',
      name: collector.nama_karyawan || '',
      jenis_karyawan: 'kasir', // Transform to kasir!
      role: 'kasir', // Transform to kasir!
      cabang: branch.nama_cabang,
      cabang_id: branch.id_cabang,
      shift: shift, // Use selected shift (pagi/malam)
      
      // Backup kasir specific fields for audit and identification
      original_role: 'collector',
      backup_mode: true,
      selected_branch_id: branch.id_cabang,
      selected_branch_name: branch.nama_cabang,
      original_cabang: collector.original_cabang || null,
      backup_session_started: new Date().toISOString()
    }

    console.log('Creating backup kasir session:', {
      collector_id: collector.id_karyawan,
      collector_name: collector.nama_karyawan,
      selected_branch: branch.nama_cabang,
      backup_mode: true
    })

    // Create new JWT token with kasir role and selected branch
    const newToken = createToken(backupKasirSessionData, rememberMe)

    // Log backup kasir session creation
    logSecurityEvent('BACKUP_KASIR_SESSION_CREATED', {
      collector_username: collector.username?.substring(0, 3) + '***',
      collector_id: collector.id_karyawan,
      selected_branch_id: branch.id_cabang,
      selected_branch_name: branch.nama_cabang,
      original_cabang: collector.original_cabang,
      ip: clientIP,
      userAgent,
      remember_me: rememberMe
    }, clientIP)

    // Set new JWT cookie
    const response = NextResponse.json({
      success: true,
      message: 'Backup kasir session created successfully',
      user: backupKasirSessionData,
      branch: {
        id: branch.id_cabang,
        name: branch.nama_cabang
      }
    })

    // Set cookie duration based on rememberMe - LONGER for backup kasir
    const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 12 * 60 * 60 // 30 days vs 12 hours (extended for backup kasir)

    response.cookies.set('auth-token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: cookieMaxAge
    })

    return response

  } catch (error) {
    console.error('Backup kasir API error:', error)
    
    logSecurityEvent('BACKUP_KASIR_ERROR', {
      error: error.message,
      ip: clientIP,
      userAgent
    }, clientIP)
    
    return NextResponse.json({
      error: 'Failed to create backup kasir session',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}