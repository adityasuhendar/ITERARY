import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { 
  sanitizeInput, 
  validateStaffCode, 
  logSecurityEvent,
  getClientIP 
} from '@/lib/security'

// GET - Fetch all staff access codes
export async function GET(request) {
  const clientIP = getClientIP(request)
  
  try {
    logSecurityEvent('STAFF_ACCESS_CODES_VIEW', {
      action: 'fetch_all'
    }, clientIP)

    const codes = await query(`
      SELECT 
        id,
        access_code,
        allowed_role,
        description,
        status,
        created_at,
        expires_at,
        last_used_at,
        usage_count
      FROM staff_access_codes 
      ORDER BY created_at DESC
    `, [], 'internal')

    return NextResponse.json({
      success: true,
      accessCodes: codes
    })

  } catch (error) {
    console.error('Staff access codes fetch error:', error)
    
    logSecurityEvent('STAFF_ACCESS_CODES_ERROR', {
      error: error.message,
      action: 'fetch_all'
    }, clientIP)

    return NextResponse.json({
      success: false,
      error: 'Gagal mengambil data kode akses'
    }, { status: 500 })
  }
}

// POST - Create new staff access code
export async function POST(request) {
  const clientIP = getClientIP(request)
  
  try {
    const body = await request.json()
    const { access_code, allowed_role, description, expires_at } = body

    // Validate access code
    const validation = validateStaffCode(access_code)
    if (!validation.isValid) {
      logSecurityEvent('STAFF_ACCESS_CODE_INVALID_INPUT', {
        error: validation.error,
        action: 'create'
      }, clientIP)

      return NextResponse.json({
        success: false,
        error: validation.error
      }, { status: 400 })
    }

    const sanitizedCode = validation.sanitized

    // Validate role
    const allowedRoles = ['owner', 'kasir', 'collector', 'super_admin']
    if (!allowedRoles.includes(allowed_role)) {
      return NextResponse.json({
        success: false,
        error: 'Role tidak valid'
      }, { status: 400 })
    }

    // Check if code already exists
    const existingCodes = await query(`
      SELECT id FROM staff_access_codes 
      WHERE access_code = ?
    `, [sanitizedCode], 'internal')

    if (existingCodes.length > 0) {
      logSecurityEvent('STAFF_ACCESS_CODE_DUPLICATE', {
        code: sanitizedCode.substring(0, 3) + '***',
        action: 'create'
      }, clientIP)

      return NextResponse.json({
        success: false,
        error: 'Kode akses sudah digunakan'
      }, { status: 409 })
    }

    // Prepare expires_at
    const expiresAt = expires_at ? new Date(expires_at) : null

    // Insert new code
    await query(`
      INSERT INTO staff_access_codes 
      (access_code, allowed_role, description, expires_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `, [
      sanitizedCode,
      allowed_role,
      sanitizeInput(description || ''),
      expiresAt,
      2 // Assuming created by owner/admin
    ], 'internal')

    logSecurityEvent('STAFF_ACCESS_CODE_CREATED', {
      code: sanitizedCode.substring(0, 3) + '***',
      role: allowed_role,
      action: 'create'
    }, clientIP)

    return NextResponse.json({
      success: true,
      message: 'Kode akses berhasil dibuat'
    })

  } catch (error) {
    console.error('Staff access code creation error:', error)
    
    logSecurityEvent('STAFF_ACCESS_CODE_ERROR', {
      error: error.message,
      action: 'create'
    }, clientIP)

    return NextResponse.json({
      success: false,
      error: 'Gagal membuat kode akses'
    }, { status: 500 })
  }
}