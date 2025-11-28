// import { NextResponse } from 'next/server'
// import { query } from '@/lib/database'

// export async function GET(request) {
//   try {
//     const { searchParams } = new URL(request.url)
//     const limit = parseInt(searchParams.get('limit')) || 5

//     // Get recent customers based on latest transaction or visit
//     const customers = await query(`
//       SELECT DISTINCT
//         p.id_pelanggan,
//         p.nama_pelanggan,
//         p.nomor_telepon,
//         p.total_cuci,
//         p.loyalty_points,
//         p.terakhir_datang as last_visit,
//         DATEDIFF(NOW(), p.terakhir_datang) as days_since_last_visit
//       FROM pelanggan p
//       WHERE p.status_aktif = 'aktif'
//         AND p.terakhir_datang IS NOT NULL
//       ORDER BY p.terakhir_datang DESC
//       LIMIT ?
//     `, [limit])

//     return NextResponse.json({
//       success: true,
//       customers: customers,
//       total: customers.length
//     })

//   } catch (error) {
//     console.error('Recent customers error:', error)
//     return NextResponse.json(
//       { error: 'Internal server error', details: error.message },
//       { status: 500 }
//     )
//   }
// }