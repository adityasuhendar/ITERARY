import { NextResponse } from 'next/server'
import { addServiceToTransaction } from '@/lib/machineManager'
import { getUserFromToken } from '@/lib/auth'

/**
 * Add additional service to existing transaction (e.g., bilas after cuci)
 * POST /api/services/add
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
    
    // 2. Authorization check
    const allowedRoles = ['kasir', 'collector', 'owner', 'super_admin']
    if (!allowedRoles.includes(user.jenis_karyawan)) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions to add services'
      }, { status: 403 })
    }
    
    // 3. Parse request body
    const body = await request.json()
    const { transactionId, jenisLayananId, reason } = body
    
    // 4. Validate required fields
    if (!transactionId || !jenisLayananId) {
      return NextResponse.json({
        success: false,
        error: 'transactionId and jenisLayananId are required'
      }, { status: 400 })
    }
    
    if (typeof transactionId !== 'number' || transactionId <= 0) {
      return NextResponse.json({
        success: false,
        error: 'transactionId must be a positive number'
      }, { status: 400 })
    }
    
    if (typeof jenisLayananId !== 'number' || jenisLayananId <= 0) {
      return NextResponse.json({
        success: false,
        error: 'jenisLayananId must be a positive number'
      }, { status: 400 })
    }
    
    // 5. Call add service function
    const result = await addServiceToTransaction(
      transactionId,
      jenisLayananId,
      user.id_karyawan,
      reason || 'added_by_kasir'
    )
    
    // 6. Return result
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: {
          detailLayananId: result.data.detailLayananId,
          serviceName: result.data.serviceName,
          servicePrice: result.data.servicePrice,
          newTotal: result.data.newTotal
        },
        timestamp: new Date().toISOString()
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Add service API error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to add service. Please try again.',
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
 * Get available services that can be added to a transaction
 * GET /api/services/add?transactionId=123
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
    
    const { query } = await import('@/lib/database')
    
    // Get all available services
    const allServices = await query(`
      SELECT 
        id_jenis_layanan,
        nama_layanan,
        harga,
        durasi_menit,
        deskripsi
      FROM jenis_layanan 
      WHERE status_aktif = 'aktif'
      ORDER BY id_jenis_layanan
    `)
    
    // Get existing services in transaction (excluding cancelled)
    const existingServices = await query(`
      SELECT id_jenis_layanan
      FROM detail_transaksi_layanan 
      WHERE id_transaksi = ? 
        AND service_status != 'cancelled'
    `, [transactionId])
    
    const existingServiceIds = existingServices.map(s => s.id_jenis_layanan)
    
    // Filter available services (exclude already existing ones)
    const availableServices = allServices.filter(service => 
      !existingServiceIds.includes(service.id_jenis_layanan)
    )
    
    return NextResponse.json({
      success: true,
      availableServices,
      existingServiceIds,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Get available services API error:', error)
    
    return NextResponse.json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}