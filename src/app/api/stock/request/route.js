import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { handleJWTAuth } from '@/lib/jwtHandler'
import jwt from 'jsonwebtoken'
import { sendPushNotificationDirect } from '@/lib/pushNotificationHelper'

// Submit stock change request (Kasir)
export async function POST(request) {
  try {
    // Handle JWT authentication with role check
    const { decoded, errorResponse } = handleJWTAuth(request, ['kasir'])
    if (errorResponse) {
      return errorResponse
    }

    const body = await request.json()
    const { id_produk, request_type, current_data, requested_data, reason } = body

    // Validation
    if (!id_produk || !request_type || !current_data || !requested_data || !reason?.trim()) {
      return NextResponse.json({ 
        error: 'Missing required fields: id_produk, request_type, current_data, requested_data, reason' 
      }, { status: 400 })
    }

    if (!['update_stock', 'update_product', 'delete_product'].includes(request_type)) {
      return NextResponse.json({ error: 'Invalid request_type' }, { status: 400 })
    }

    // Get kasir info
    const kasirInfo = await query(`
      SELECT id_karyawan, id_cabang, nama_karyawan, shift 
      FROM karyawan 
      WHERE id_karyawan = ?
    `, [decoded.id])

    if (kasirInfo.length === 0) {
      return NextResponse.json({ error: 'Kasir not found' }, { status: 404 })
    }

    const { nama_karyawan, shift } = kasirInfo[0]
    const id_cabang = decoded.cabang_id || kasirInfo[0].id_cabang  // Prioritas dari JWT token untuk collector backup kasir

    // Get today's attendance to find actual worker name
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    const attendanceInfo = await query(`
      SELECT nama_pekerja 
      FROM attendance_harian 
      WHERE id_karyawan_akun = ? 
        AND tanggal = ?
        AND shift = ?
      LIMIT 1
    `, [decoded.id, today, shift])

    // Use actual worker name if attendance exists, fallback to system account name
    const actualWorkerName = attendanceInfo.length > 0 ? attendanceInfo[0].nama_pekerja : nama_karyawan

    // Get product info for context
    const productInfo = await query(`
      SELECT pt.nama_produk, sc.stok_tersedia, sc.stok_minimum
      FROM produk_tambahan pt
      LEFT JOIN stok_cabang sc ON pt.id_produk = sc.id_produk AND sc.id_cabang = ?
      WHERE pt.id_produk = ?
    `, [id_cabang, id_produk])

    if (productInfo.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Check for existing pending request for this product by this kasir
    const existingRequest = await query(`
      SELECT id_audit, data_baru
      FROM audit_log 
      WHERE id_karyawan = ? 
        AND tabel_diubah = 'stock_request'
        AND aksi = 'UPDATE'
        AND approval_status = 'pending'
        AND JSON_EXTRACT(data_baru, '$.id_produk') = ?
    `, [decoded.id, parseInt(id_produk)])

    if (existingRequest.length > 0) {
      const existingData = typeof existingRequest[0].data_baru === 'string' 
        ? JSON.parse(existingRequest[0].data_baru) 
        : existingRequest[0].data_baru

      return NextResponse.json({ 
        error: 'Produk ini sudah memiliki request yang sedang menunggu persetujuan',
        message: `Request untuk "${existingData.product_name}" dengan tipe "${existingData.request_type}" masih pending. Tunggu approval terlebih dahulu.`,
        existing_request_id: existingRequest[0].id_audit,
        existing_request_type: existingData.request_type
      }, { status: 409 })
    }

    // Create request entry in audit_log with pending status
    const requestData = {
      request_type,
      id_produk: parseInt(id_produk),
      id_cabang,
      kasir_name: actualWorkerName,
      system_account: nama_karyawan, // Keep track of which system account was used
      product_name: productInfo[0].nama_produk,
      current_data,
      requested_data,
      reason: reason.trim(),
      timestamp: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z'
    }

    const result = await query(`
      INSERT INTO audit_log (
        id_karyawan, 
        requested_by,
        tabel_diubah, 
        aksi, 
        data_lama, 
        data_baru, 
        approval_status,
        ip_address
      ) VALUES (?, ?, 'stock_request', 'UPDATE', ?, ?, 'pending', ?)
    `, [
      decoded.id,
      decoded.id, // Set requested_by sama dengan id_karyawan untuk stock requests
      JSON.stringify(current_data),
      JSON.stringify(requestData),
      request.headers.get('x-forwarded-for') || 'unknown'
    ])

    // Send push notification to owner and collector
    try {
      const notificationData = {
        title: '📋 Request Baru Masuk!',
        body: `${actualWorkerName} request ${request_type === 'update_stock' ? 'tambah stok' : 'update produk'} untuk ${productInfo[0].nama_produk}`,
        icon: '📋',
        tag: `new-stock-request-${result.insertId}`,
        url: '/dashboard?view=stock&tab=requests',
        data: {
          requestId: result.insertId,
          requestType: request_type,
          productName: productInfo[0].nama_produk,
          kasirName: actualWorkerName
        }
      }

      // Send to owner
      const ownerResult = await sendPushNotificationDirect({
        targetUserType: 'owner',
        notification: notificationData
      })

      // Send to collector
      const collectorResult = await sendPushNotificationDirect({
        targetUserType: 'collector',
        notification: notificationData
      })

      if (ownerResult.success) {
        console.log(`✅ Push notification sent to owner for new request`)
      } else {
        console.log(`⚠️ Push notification to owner failed`)
      }

      if (collectorResult.success) {
        console.log(`✅ Push notification sent to collector for new request`)
      } else {
        console.log(`⚠️ Push notification to collector failed`)
      }
    } catch (pushError) {
      console.error('Push notification error:', pushError)
      // Don't fail the main request if push fails
    }

    return NextResponse.json({
      success: true,
      request_id: result.insertId,
      message: 'Stock change request submitted successfully. Waiting for owner approval.',
      status: 'pending'
    })

  } catch (error) {
    console.error('Stock request error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 })
  }
}

// Get pending requests (Owner)
export async function GET(request) {
  try {
    // Handle JWT authentication with role check
    const { decoded, errorResponse } = handleJWTAuth(request, ['owner', 'collector', 'super_admin'])
    if (errorResponse) {
      return errorResponse
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const page = parseInt(searchParams.get('page')) || 1
    const limit = parseInt(searchParams.get('limit')) || 20
    const offset = (page - 1) * limit

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM audit_log al
      JOIN karyawan k ON al.id_karyawan = k.id_karyawan
      WHERE al.tabel_diubah = 'stock_request'
      AND al.aksi = 'UPDATE'
      AND al.approval_status = ?
    `, [status])

    const totalRequests = countResult[0].total
    const totalPages = Math.ceil(totalRequests / limit)

    // Get requests with status filter and pagination
    const requests = await query(`
      SELECT 
        al.id_audit,
        al.id_karyawan,
        al.data_lama as current_data,
        al.data_baru as request_data,
        al.approval_status,
        al.approved_by,
        al.approval_notes,
        al.waktu_aksi,
        k.nama_karyawan as kasir_name,
        c.nama_cabang,
        approver.nama_karyawan as approved_by_name
      FROM audit_log al
      JOIN karyawan k ON al.id_karyawan = k.id_karyawan
      LEFT JOIN cabang c ON k.id_cabang = c.id_cabang
      LEFT JOIN karyawan approver ON al.approved_by = approver.id_karyawan
      WHERE al.tabel_diubah = 'stock_request'
      AND al.aksi = 'UPDATE'
      AND al.approval_status = ?
      ORDER BY al.waktu_aksi DESC
      LIMIT ? OFFSET ?
    `, [status, limit, offset])

    // Parse JSON data - handle both string and object cases
    const parsedRequests = await Promise.all(requests.map(async req => {
      const parsed = {
        ...req,
        current_data: typeof req.current_data === 'string' ? JSON.parse(req.current_data) : req.current_data,
        request_data: typeof req.request_data === 'string' ? JSON.parse(req.request_data) : req.request_data
      }
      
      // For collector backup kasir requests, get branch name from request data if not available from JOIN
      if (!parsed.nama_cabang && parsed.request_data && parsed.request_data.id_cabang) {
        try {
          const branchResult = await query(`SELECT nama_cabang FROM cabang WHERE id_cabang = ?`, [parsed.request_data.id_cabang])
          if (branchResult.length > 0) {
            parsed.nama_cabang = branchResult[0].nama_cabang
          }
        } catch (error) {
          console.warn('Failed to get branch name for request:', parsed.id_audit, error)
        }
      }
      
      return parsed
    }))

    return NextResponse.json({
      requests: parsedRequests,
      currentPage: page,
      totalPages,
      totalRequests,
      itemsPerPage: limit,
      status
    })

  } catch (error) {
    console.error('Get stock requests error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 })
  }
}