import { NextResponse } from 'next/server'
import { cancelService } from '@/lib/machineManager'
import { getUserFromToken } from '@/lib/auth'

/**
 * Cancel a specific service (e.g., kering cancellation)
 * POST /api/services/cancel
 */
export async function POST(request) {
  try {
    // 1. Authentication check
    const user = await getUserFromToken(request)
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }
    
    // 2. Authorization check - only kasir and above can cancel services
    const allowedRoles = ['kasir', 'collector', 'owner', 'super_admin']
    if (!allowedRoles.includes(user.jenis_karyawan)) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions to cancel services'
      }, { status: 403 })
    }
    
    // 3. Parse request body
    const body = await request.json()
    const { detailLayananId, reason } = body
    
    // 4. Validate required fields
    if (!detailLayananId) {
      return NextResponse.json({
        success: false,
        error: 'detailLayananId is required'
      }, { status: 400 })
    }
    
    if (typeof detailLayananId !== 'number' || detailLayananId <= 0) {
      return NextResponse.json({
        success: false,
        error: 'detailLayananId must be a positive number'
      }, { status: 400 })
    }
    
    // 5. Call service cancellation function
    const result = await cancelService(
      detailLayananId,
      user.id_karyawan,
      reason || 'cancelled_by_kasir'
    )
    
    // 6. Return result
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: {
          detailLayananId: result.data.detailLayananId,
          serviceName: result.data.serviceName,
          releasedMachine: result.data.releasedMachine,
          savedAmount: result.data.savedAmount,
          newTotal: result.data.newTotal,
          transactionCode: result.data.transactionCode
        },
        timestamp: new Date().toISOString()
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        details: result.details
      }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Cancel service API error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to cancel service. Please try again.',
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          message: error.message,
          stack: error.stack
        }
      })
    }, { status: 500 })
  }
}

/**
 * Get cancellable services for a transaction
 * GET /api/services/cancel?transactionId=123
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
    
    // Get services that can be cancelled (not completed, not already cancelled)
    const { query } = await import('@/lib/database')
    
    const services = await query(`
      SELECT 
        dtl.id_detail_layanan,
        dtl.service_status,
        dtl.id_mesin,
        jl.nama_layanan,
        jl.id_jenis_layanan,
        ml.nomor_mesin,
        dtl.harga_satuan,
        dtl.quantity,
        CASE 
          WHEN dtl.service_status IN ('planned', 'queued') THEN true
          WHEN dtl.service_status = 'active' AND dtl.id_mesin IS NOT NULL THEN true
          ELSE false
        END as can_cancel
      FROM detail_transaksi_layanan dtl
      JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
      LEFT JOIN mesin_laundry ml ON dtl.id_mesin = ml.id_mesin
      WHERE dtl.id_transaksi = ?
        AND dtl.service_status NOT IN ('completed', 'cancelled')
      ORDER BY dtl.id_detail_layanan
    `, [transactionId])
    
    return NextResponse.json({
      success: true,
      services,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Get cancellable services API error:', error)
    
    return NextResponse.json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}