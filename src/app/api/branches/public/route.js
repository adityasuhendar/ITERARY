import { NextResponse } from 'next/server'
import { query } from '@/lib/database'

/**
 * Get public branch list for customer
 * No authentication required - public endpoint
 */
export async function GET(request) {
  try {
    // Get all active branches with basic info - custom order
    const branches = await query(`
      SELECT 
        id_cabang,
        nama_cabang,
        alamat,
        status_aktif
      FROM cabang 
      WHERE status_aktif = 'aktif'
      ORDER BY 
        CASE nama_cabang
          WHEN 'Tanjung Senang' THEN 1
          WHEN 'Panglima Polim' THEN 2
          WHEN 'Sukarame' THEN 3
          WHEN 'Korpri' THEN 4
          WHEN 'Gedong Meneng' THEN 5
          WHEN 'Untung' THEN 6
          ELSE 99
        END
    `)

    return NextResponse.json({
      success: true,
      branches: branches,
      total: branches.length,
      message: 'Branches retrieved successfully'
    })

  } catch (error) {
    console.error('Get public branches API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Database error',
      message: error.message,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}