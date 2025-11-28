import { NextResponse } from 'next/server'
import { updateServiceStatus, getTransactionServicesWithStatus } from '@/lib/machineManager'
import { getUserFromToken } from '@/lib/auth'

/**
 * Update service status
 * PUT /api/services/status
 */
export async function PUT(request) {
  try {
    // 1. Authentication check
    const user = await getUserFromToken(request)
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }
    
    // 2. Authorization check
    const allowedRoles = ['kasir', 'collector', 'owner', 'super_admin']
    if (!allowedRoles.includes(user.jenis_karyawan)) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions to update service status'
      }, { status: 403 })
    }
    
    // 3. Parse request body
    const body = await request.json()
    const { detailLayananId, status } = body
    
    // 4. Validate required fields
    if (!detailLayananId || !status) {
      return NextResponse.json({
        success: false,
        error: 'detailLayananId and status are required'
      }, { status: 400 })
    }
    
    const validStatuses = ['planned', 'active', 'queued', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      }, { status: 400 })
    }
    
    // 5. Call update status function
    const result = await updateServiceStatus(
      detailLayananId,
      status,
      user.id_karyawan
    )
    
    // 6. Return result
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data,
        timestamp: new Date().toISOString()
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Update service status API error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to update service status. Please try again.',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * Get services with status for a transaction
 * GET /api/services/status?transactionId=123
 */
export async function GET(request) {
  try {
    // Authentication check
    const user = await getUserFromToken(request)
    if (!user) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 })
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transactionId')
    
    if (!transactionId) {
      return NextResponse.json({
        error: 'transactionId parameter is required'
      }, { status: 400 })
    }
    
    // Get services with status
    const services = await getTransactionServicesWithStatus(parseInt(transactionId))
    
    // Calculate summary statistics
    const summary = {
      total: services.length,
      planned: services.filter(s => s.service_status === 'planned').length,
      active: services.filter(s => s.service_status === 'active').length,
      queued: services.filter(s => s.service_status === 'queued').length,
      completed: services.filter(s => s.service_status === 'completed').length,
      cancelled: services.filter(s => s.service_status === 'cancelled').length
    }
    
    return NextResponse.json({
      success: true,
      services,
      summary,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Get service status API error:', error)
    
    return NextResponse.json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}