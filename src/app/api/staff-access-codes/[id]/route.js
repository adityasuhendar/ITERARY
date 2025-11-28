import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { 
  logSecurityEvent,
  getClientIP 
} from '@/lib/security'

// PUT - Update staff access code (for editing and status changes)
export async function PUT(request, { params }) {
  const clientIP = getClientIP(request)
  const { id } = params
  
  try {
    const body = await request.json()
    const { access_code, allowed_role, description, expires_at, status } = body

    // Check if code exists
    const existingCode = await query(`
      SELECT id, access_code FROM staff_access_codes 
      WHERE id = ?
    `, [id], 'internal')

    if (existingCode.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Kode akses tidak ditemukan'
      }, { status: 404 })
    }

    // If updating status only
    if (status && !access_code && !allowed_role && !description && !expires_at) {
      const allowedStatuses = ['active', 'inactive']
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json({
          success: false,
          error: 'Status tidak valid'
        }, { status: 400 })
      }

      await query(`
        UPDATE staff_access_codes 
        SET status = ?
        WHERE id = ?
      `, [status, id], 'internal')

      logSecurityEvent('STAFF_ACCESS_CODE_STATUS_UPDATED', {
        code: existingCode[0].access_code.substring(0, 3) + '***',
        status: status,
        action: 'update_status'
      }, clientIP)

      return NextResponse.json({
        success: true,
        message: status === 'active' ? 'Kode akses berhasil diaktifkan' : 'Kode akses berhasil dinonaktifkan'
      })
    }

    // Full update (edit mode)
    if (access_code || allowed_role || description !== undefined || expires_at !== undefined) {
      // Validate access code if provided
      if (access_code) {
        const { validateStaffCode, sanitizeInput } = await import('@/lib/security')
        const validation = validateStaffCode(access_code)
        if (!validation.isValid) {
          return NextResponse.json({
            success: false,
            error: validation.error
          }, { status: 400 })
        }

        const sanitizedCode = validation.sanitized

        // Check if new access code already exists (but not for current record)
        const duplicateCheck = await query(`
          SELECT id FROM staff_access_codes 
          WHERE access_code = ? AND id != ?
        `, [sanitizedCode, id], 'internal')

        if (duplicateCheck.length > 0) {
          return NextResponse.json({
            success: false,
            error: 'Kode akses sudah digunakan'
          }, { status: 409 })
        }
      }

      // Validate role if provided
      if (allowed_role) {
        const allowedRoles = ['owner', 'kasir', 'collector', 'super_admin']
        if (!allowedRoles.includes(allowed_role)) {
          return NextResponse.json({
            success: false,
            error: 'Role tidak valid'
          }, { status: 400 })
        }
      }

      // Prepare expires_at
      const expiresAt = expires_at ? new Date(expires_at) : null

      // Build dynamic update query
      const updateFields = []
      const updateValues = []

      if (access_code) {
        const { validateStaffCode } = await import('@/lib/security')
        const validation = validateStaffCode(access_code)
        updateFields.push('access_code = ?')
        updateValues.push(validation.sanitized)
      }
      
      if (allowed_role) {
        updateFields.push('allowed_role = ?')
        updateValues.push(allowed_role)
      }
      
      if (description !== undefined) {
        updateFields.push('description = ?')
        updateValues.push(description || '')
      }
      
      if (expires_at !== undefined) {
        updateFields.push('expires_at = ?')
        updateValues.push(expiresAt)
      }

      updateValues.push(id) // for WHERE clause

      // Update code details
      await query(`
        UPDATE staff_access_codes 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, updateValues, 'internal')

      logSecurityEvent('STAFF_ACCESS_CODE_UPDATED', {
        code: (access_code || existingCode[0].access_code).substring(0, 3) + '***',
        role: allowed_role,
        action: 'update_details'
      }, clientIP)

      return NextResponse.json({
        success: true,
        message: 'Kode akses berhasil diupdate'
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Data update tidak valid'
    }, { status: 400 })

  } catch (error) {
    console.error('Staff access code update error:', error)
    
    logSecurityEvent('STAFF_ACCESS_CODE_ERROR', {
      error: error.message,
      action: 'update',
      id: id
    }, clientIP)

    return NextResponse.json({
      success: false,
      error: 'Gagal mengupdate kode akses'
    }, { status: 500 })
  }
}

// DELETE - Delete staff access code (hard delete)
export async function DELETE(request, { params }) {
  const clientIP = getClientIP(request)
  const { id } = params
  
  try {
    // Check if code exists
    const existingCode = await query(`
      SELECT id, access_code FROM staff_access_codes 
      WHERE id = ?
    `, [id], 'internal')

    if (existingCode.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Kode akses tidak ditemukan'
      }, { status: 404 })
    }

    // Delete code
    await query(`
      DELETE FROM staff_access_codes 
      WHERE id = ?
    `, [id], 'internal')

    logSecurityEvent('STAFF_ACCESS_CODE_DELETED', {
      code: existingCode[0].access_code.substring(0, 3) + '***',
      action: 'delete'
    }, clientIP)

    return NextResponse.json({
      success: true,
      message: 'Kode akses berhasil dihapus'
    })

  } catch (error) {
    console.error('Staff access code delete error:', error)
    
    logSecurityEvent('STAFF_ACCESS_CODE_ERROR', {
      error: error.message,
      action: 'delete',
      id: id
    }, clientIP)

    return NextResponse.json({
      success: false,
      error: 'Gagal menghapus kode akses'
    }, { status: 500 })
  }
}