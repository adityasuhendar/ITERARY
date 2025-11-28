// import { NextResponse } from 'next/server'
// import { query } from '@/lib/database'
// import { verifyToken } from '@/lib/auth'

// export async function POST(request) {
//   try {
//     console.log('🔥 [CLAIM API] DIPANGGIL! Trace dimana:', new Error().stack)

//     // Verify authentication (hanya kasir yang bisa claim loyalty)
//     const token = request.cookies.get('auth-token')?.value
//     if (!token) {
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//     }

//     const user = verifyToken(token)
//     if (!user || user.role !== 'kasir') {
//       return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
//     }

//     const { phone, customer_id, services_used } = await request.json()
//     console.log('🔥 [CLAIM API] Request data:', { phone, customer_id, services_used })

//     if (!phone && !customer_id) {
//       return NextResponse.json({ error: 'Phone number or customer ID required' }, { status: 400 })
//     }

//     // Get customer data
//     let customerQuery, queryParams
    
//     if (customer_id) {
//       // Lookup by customer ID (preferred for customers without phones)
//       customerQuery = `
//         SELECT id_pelanggan, nama_pelanggan 
//         FROM pelanggan 
//         WHERE id_pelanggan = ? AND status_aktif = 'aktif'
//       `
//       queryParams = [customer_id]
//     } else {
//       // Lookup by phone (legacy support)
//       customerQuery = `
//         SELECT id_pelanggan, nama_pelanggan 
//         FROM pelanggan 
//         WHERE nomor_telepon = ? AND status_aktif = 'aktif'
//       `
//       queryParams = [phone]
//     }
    
//     const customer = await query(customerQuery, queryParams)

//     if (customer.length === 0) {
//       return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
//     }

//     const customerId = customer[0].id_pelanggan

//     // Get current loyalty status - count PAID cuci services only
//     const cuciServicesQuery = `
//       SELECT COUNT(*) as total_paid_cuci_services
//       FROM detail_transaksi_layanan dtl
//       JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
//       JOIN transaksi t ON dtl.id_transaksi = t.id_transaksi
//       WHERE t.id_pelanggan = ? 
//       AND t.status_transaksi = 'selesai'
//       AND jl.nama_layanan LIKE '%cuci%'
//       AND dtl.subtotal > 0
//     `
//     const cuciCount = await query(cuciServicesQuery, [customerId])
//     const totalCuci = cuciCount[0].total_paid_cuci_services || 0

//     // Calculate loyalty metrics
//     const freeWashesEarned = Math.floor(totalCuci / 10)
    
//     // Count free washes used (transactions with total = 0)
//     const freeUsedQuery = `
//       SELECT COUNT(*) as free_used
//       FROM transaksi 
//       WHERE id_pelanggan = ? AND total_keseluruhan = 0 AND status_transaksi = 'selesai'
//     `
//     const freeUsedCount = await query(freeUsedQuery, [customerId])
//     const freeWashesUsed = freeUsedCount[0].free_used

//     const remainingFreeWashes = Math.max(0, freeWashesEarned - freeWashesUsed)
//     console.log('🔥 [CLAIM API] Calculation:', {
//       totalCuci,
//       freeWashesEarned,
//       freeWashesUsed,
//       remainingFreeWashes
//     })

//     // Check if customer has free washes available
//     if (remainingFreeWashes <= 0) {
//       console.log('🔥 [CLAIM API] REJECTED - No free washes!')
//       return NextResponse.json({
//         error: 'No free washes available',
//         remaining: remainingFreeWashes
//       }, { status: 400 })
//     }

//     // Check if "Cuci" service is being used
//     const hasCuciService = services_used && services_used.some(service => 
//       service.nama_layanan && service.nama_layanan.toLowerCase().includes('cuci')
//     )

//     if (!hasCuciService) {
//       return NextResponse.json({ 
//         error: 'Free wash can only be applied to "Cuci" service' 
//       }, { status: 400 })
//     }

//     // Success - return updated loyalty status
//     const newRemaining = remainingFreeWashes - 1

//     return NextResponse.json({
//       success: true,
//       message: 'Free wash claimed successfully',
//       loyalty: {
//         total_cuci: totalCuci,
//         free_washes_earned: freeWashesEarned,
//         free_washes_used: freeWashesUsed + 1,
//         remaining_free_washes: newRemaining,
//         progress_to_next_free: totalCuci % 10,
//         next_free_in: 10 - (totalCuci % 10)
//       },
//       customer: {
//         id: customerId,
//         nama: customer[0].nama_pelanggan
//       }
//     })

//   } catch (error) {
//     console.error('Loyalty claim error:', error)
//     return NextResponse.json({
//       error: 'Database error',
//       message: error.message
//     }, { status: 500 })
//   }
// }