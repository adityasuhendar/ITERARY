import { NextResponse } from 'next/server'
import { handleJWTAuth } from '@/lib/jwtHandler'
import { query } from '@/lib/database'

export async function GET(request) {
  try {
    // Check authentication
    const { decoded, errorResponse } = handleJWTAuth(request, ['owner', 'super_admin'])
    if (errorResponse) return errorResponse

    // Get all machines with branch info, ordered by DW1-DW6
    const machines = await query(`
      SELECT
        ml.*,
        c.nama_cabang,
        CASE c.nama_cabang
          WHEN 'Tanjung Senang' THEN 1
          WHEN 'Panglima Polim' THEN 2
          WHEN 'Sukarame' THEN 3
          WHEN 'Korpri' THEN 4
          WHEN 'Gedong Meneng' THEN 5
          WHEN 'Untung' THEN 6
          ELSE 99
        END as sort_order
      FROM mesin_laundry ml
      JOIN cabang c ON ml.id_cabang = c.id_cabang
      ORDER BY sort_order ASC, ml.jenis_mesin ASC, CAST(SUBSTRING(ml.nomor_mesin, 2) AS UNSIGNED) ASC
    `)

    return NextResponse.json({
      success: true,
      machines: machines || [],
      total: machines.length
    })

  } catch (error) {
    console.error('Error fetching machines:', error)
    return NextResponse.json({
      success: false,
      message: 'Gagal memuat data mesin',
      error: error.message
    }, { status: 500 })
  }
}