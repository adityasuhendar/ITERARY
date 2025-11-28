// import { NextResponse } from 'next/server'
// import { query } from '@/lib/database'
// import { getMachineStatusWithAssignments } from '@/lib/machineManager'

// /**
//  * Get machine status for customer with phone verification
//  * Public endpoint with basic validation
//  */
// export async function POST(request) {
//   try {
//     const { phone, cabang_id } = await request.json()

//     // Basic validation
//     if (!phone || !cabang_id) {
//       return NextResponse.json({
//         success: false,
//         error: 'Nomor HP dan cabang wajib diisi'
//       }, { status: 400 })
//     }

//     // Validate phone format (Indonesian format)
//     const phoneRegex = /^(08|62)[0-9]{8,12}$/
//     if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
//       return NextResponse.json({
//         success: false,
//         error: 'Format nomor HP tidak valid'
//       }, { status: 400 })
//     }

//     // Check if phone number is registered in database
//     const customerCheck = await query(`
//       SELECT id_pelanggan, nama_pelanggan, nomor_telepon 
//       FROM pelanggan 
//       WHERE nomor_telepon = ? AND status_aktif = 'aktif'
//     `, [phone])

//     if (customerCheck.length === 0) {
//       return NextResponse.json({
//         success: false,
//         error: 'Nomor HP tidak terdaftar. Silakan daftar terlebih dahulu atau hubungi kasir untuk registrasi.',
//         code: 'CUSTOMER_NOT_FOUND'
//       }, { status: 404 })
//     }

//     const customerInfo = customerCheck[0]

//     // Validate branch exists and is active
//     const branchCheck = await query(`
//       SELECT id_cabang, nama_cabang, alamat 
//       FROM cabang 
//       WHERE id_cabang = ? AND status_aktif = 'aktif'
//     `, [cabang_id])

//     if (branchCheck.length === 0) {
//       return NextResponse.json({
//         success: false,
//         error: 'Cabang tidak ditemukan atau tidak aktif'
//       }, { status: 404 })
//     }

//     const branchInfo = branchCheck[0]

//     // Customer inquiry logging removed for performance optimization

//     // Get machine status with assignments
//     const machines = await getMachineStatusWithAssignments(cabang_id)

//     // Format machines for customer view (hide sensitive info)
//     const customerMachines = machines.map(machine => {
//       const isActive = machine.status_mesin === 'digunakan'
//       const hasAssignment = machine.active_assignment || (machine.estimasi_selesai && isActive)
      
//       let timeInfo = null
//       if (hasAssignment) {
//         const now = new Date()
//         const estimatedFinish = new Date(machine.active_assignment?.estimasi_selesai || machine.estimasi_selesai)
//         const timeRemaining = Math.max(0, Math.floor((estimatedFinish - now) / (1000 * 60))) // minutes
//         const isOverdue = estimatedFinish < now
        
//         timeInfo = {
//           estimasi_selesai: machine.active_assignment?.estimasi_selesai || machine.estimasi_selesai,
//           time_remaining_minutes: isOverdue ? 0 : timeRemaining,
//           is_overdue: isOverdue,
//           overdue_minutes: isOverdue ? Math.floor((now - estimatedFinish) / (1000 * 60)) : 0
//         }
//       }

//       return {
//         id_mesin: machine.id_mesin,
//         nomor_mesin: machine.nomor_mesin,
//         jenis_mesin: machine.jenis_mesin,
//         status_mesin: machine.status_mesin,
        
//         // Active assignment info (customer view - limited info)
//         active_assignment: hasAssignment ? {
//           nama_pelanggan: machine.active_assignment?.nama_pelanggan || 'Customer',
//           ...timeInfo
//         } : null,
        
//         // Status indicators for UI
//         status_indicator: {
//           color: machine.status_mesin === 'tersedia' ? 'green' :
//                  machine.status_mesin === 'digunakan' ? 'blue' :
//                  machine.status_mesin === 'maintenance' ? 'yellow' : 'red',
          
//           text: machine.status_mesin === 'tersedia' ? 'Tersedia' :
//                 machine.status_mesin === 'digunakan' ? 'Digunakan' :
//                 machine.status_mesin === 'maintenance' ? 'Maintenance' : 'Rusak'
//         }
//       }
//     })

//     // Calculate stats
//     const stats = {
//       total_machines: machines.length,
//       tersedia: machines.filter(m => m.status_mesin === 'tersedia').length,
//       digunakan: machines.filter(m => m.status_mesin === 'digunakan').length,
//       maintenance: machines.filter(m => m.status_mesin === 'maintenance').length,
//       rusak: machines.filter(m => m.status_mesin === 'rusak').length
//     }

//     return NextResponse.json({
//       success: true,
//       machines: customerMachines,
//       stats,
//       cabang_info: {
//         id_cabang: branchInfo.id_cabang,
//         nama_cabang: branchInfo.nama_cabang,
//         alamat: branchInfo.alamat
//       },
//       customer_info: {
//         nama_pelanggan: customerInfo.nama_pelanggan,
//         nomor_telepon: customerInfo.nomor_telepon
//       },
//       timestamp: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z',
//       message: `Halo ${customerInfo.nama_pelanggan}! Status mesin ${branchInfo.nama_cabang} berhasil diambil`
//     })

//   } catch (error) {
//     console.error('Customer machine status API error:', error)
//     return NextResponse.json({
//       success: false,
//       error: 'Terjadi kesalahan sistem',
//       message: 'Silakan coba lagi dalam beberapa saat',
//       debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     }, { status: 500 })
//   }
// }