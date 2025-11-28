// import { NextResponse } from 'next/server'
// import { getMachineStatusWithAssignments, autoActivatePlannedServices, autoReleaseMachines } from '@/lib/machineManager'
// import { verifyToken } from '@/lib/auth'

// /**
//  * Get enhanced machine status with active assignments and customer info
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

//     // Get cabang_id from query params or user
//     const { searchParams } = new URL(request.url)
//     const cabangId = searchParams.get('cabang_id') || user.cabang_id

//     if (!cabangId) {
//       return NextResponse.json({ 
//         error: 'Branch ID required',
//         message: 'Please provide cabang_id parameter or ensure user has branch assignment'
//       }, { status: 400 })
//     }

//     // Auto-activate planned services and complete expired services (includes machine release)
//     const activationResult = await autoActivatePlannedServices(cabangId)
    
//     const machines = await getMachineStatusWithAssignments(cabangId)

//     // Format response with additional status info
//     const formattedMachines = machines.map(machine => {
//       // Machine is active if it has status 'digunakan' OR has an active service assignment
//       const hasActiveService = machine.id_detail_layanan && machine.nama_pelanggan
//       const isActive = (machine.status_mesin === 'digunakan' || hasActiveService) && machine.estimasi_selesai
//       const now = new Date()
      
//       let timeInfo = null
//       if (isActive && machine.estimasi_selesai) {
//         const estimatedFinish = new Date(machine.estimasi_selesai)
//         const timeRemaining = Math.max(0, Math.floor((estimatedFinish - now) / (1000 * 60))) // minutes
//         const isOverdue = estimatedFinish < now
        
//         timeInfo = {
//           waktu_mulai: machine.waktu_mulai || machine.diupdate_pada, // Use machine update time for manual assignments
//           estimasi_selesai: machine.estimasi_selesai,
//           time_remaining_minutes: isOverdue ? 0 : timeRemaining,
//           is_overdue: isOverdue,
//           overdue_minutes: isOverdue ? Math.floor((now - estimatedFinish) / (1000 * 60)) : 0,
//           assignment_type: machine.assignment_type || 'unknown' // 'automatic', 'manual', or unknown
//         }
//       }

//       return {
//         id_mesin: machine.id_mesin,
//         id_cabang: machine.id_cabang,
//         nomor_mesin: machine.nomor_mesin,
//         jenis_mesin: machine.jenis_mesin,
//         status_mesin: machine.status_mesin,
//         updated_by_karyawan: machine.updated_by_karyawan,
//         diupdate_pada: machine.diupdate_pada,
        
//         // Active assignment info (if machine is in use)
//         active_assignment: isActive ? {
//           id_detail_layanan: machine.id_detail_layanan,
//           nama_layanan: machine.nama_layanan,
//           nama_pelanggan: machine.nama_pelanggan,
//           kode_transaksi: machine.kode_transaksi,
//           ...timeInfo
//         } : null,
        
//         // Status indicators for UI
//         status_indicator: {
//           color: machine.status_mesin === 'tersedia' ? 'green' :
//                  machine.status_mesin === 'digunakan' ? 'blue' :
//                  machine.status_mesin === 'maintenance' ? 'yellow' : 'gray',
          
//           text: machine.status_mesin === 'tersedia' ? 'Tersedia' :
//                 machine.status_mesin === 'digunakan' ? 'Digunakan' :
//                 machine.status_mesin === 'maintenance' ? 'Maintenance' : 'Rusak',
                
//           can_auto_release: isActive && timeInfo && timeInfo.is_overdue
//         }
//       }
//     })

//     // Summary statistics
//     const stats = {
//       total_machines: machines.length,
//       tersedia: machines.filter(m => m.status_mesin === 'tersedia').length,
//       digunakan: machines.filter(m => m.status_mesin === 'digunakan').length,
//       maintenance: machines.filter(m => m.status_mesin === 'maintenance').length,
//       rusak: machines.filter(m => m.status_mesin === 'rusak').length,
//       overdue_count: formattedMachines.filter(m => 
//         m.active_assignment && m.active_assignment.is_overdue
//       ).length
//     }

//     return NextResponse.json({
//       success: true,
//       machines: formattedMachines,
//       stats,
//       cabang_id: parseInt(cabangId),
//       timestamp: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z'
//     })

//   } catch (error) {
//     console.error('Get machine status API error:', error)
//     return NextResponse.json({
//       success: false,
//       error: 'Internal server error',
//       message: error.message,
//       debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     }, { status: 500 })
//   }
// }