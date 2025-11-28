// import { NextResponse } from 'next/server'
// import { autoReleaseMachines } from '@/lib/machineManager'
// import { verifyToken } from '@/lib/auth'

// /**
//  * Auto-release machines that have completed their estimated time
//  * This endpoint can be called manually or via cron job
//  */
// export async function POST(request) {
//   try {
//     const token = request.cookies.get('auth-token')?.value
//     if (!token) {
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//     }

//     const user = verifyToken(token)
//     if (!user || !['kasir', 'super_admin', 'owner'].includes(user.role)) {
//       return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
//     }

//     const result = await autoReleaseMachines()

//     return NextResponse.json({
//       success: result.success,
//       releasedCount: result.releasedCount || 0,
//       totalChecked: result.totalChecked || 0,
//       message: result.success 
//         ? `Successfully released ${result.releasedCount} machines out of ${result.totalChecked} checked`
//         : 'Failed to auto-release machines',
//       error: result.error || null
//     })

//   } catch (error) {
//     console.error('Auto-release machines API error:', error)
//     return NextResponse.json({
//       success: false,
//       error: 'Internal server error',
//       message: error.message,
//       debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     }, { status: 500 })
//   }
// }

// /**
//  * Get status of machines that are due for auto-release (without actually releasing them)
//  */
// export async function GET(request) {
//   try {
//     const token = request.cookies.get('auth-token')?.value
//     if (!token) {
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//     }

//     const user = verifyToken(token)
//     if (!user || !['kasir', 'super_admin', 'owner'].includes(user.role)) {
//       return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
//     }

//     const { query } = await import('@/lib/database')

//     // Find machines that should be released (same logic as auto-release but without releasing)
//     const expiredMachines = await query(`
//       SELECT 
//         dtl.id_detail_layanan,
//         dtl.id_mesin,
//         ml.nomor_mesin,
//         ml.jenis_mesin,
//         ml.id_cabang,
//         c.nama_cabang,
//         dtl.estimasi_selesai,
//         dtl.waktu_mulai,
//         TIMESTAMPDIFF(MINUTE, dtl.waktu_mulai, NOW()) as running_minutes,
//         TIMESTAMPDIFF(MINUTE, dtl.estimasi_selesai, NOW()) as overdue_minutes,
//         jl.nama_layanan,
//         t.kode_transaksi,
//         p.nama_pelanggan
//       FROM detail_transaksi_layanan dtl
//       JOIN mesin_laundry ml ON dtl.id_mesin = ml.id_mesin
//       JOIN cabang c ON ml.id_cabang = c.id_cabang
//       JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
//       JOIN transaksi t ON dtl.id_transaksi = t.id_transaksi
//       JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
//       WHERE dtl.id_mesin IS NOT NULL 
//         AND dtl.estimasi_selesai IS NOT NULL
//         AND dtl.estimasi_selesai <= NOW()
//         AND ml.status_mesin = 'digunakan'
//       ORDER BY dtl.estimasi_selesai ASC
//     `)

//     return NextResponse.json({
//       success: true,
//       machinesDueForRelease: expiredMachines,
//       count: expiredMachines.length,
//       message: `Found ${expiredMachines.length} machines due for auto-release`
//     })

//   } catch (error) {
//     console.error('Get auto-release status API error:', error)
//     return NextResponse.json({
//       success: false,
//       error: 'Internal server error',
//       message: error.message,
//       debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     }, { status: 500 })
//   }
// }