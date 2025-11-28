// import { NextResponse } from 'next/server'
// import { autoReleaseMachines, autoReleaseExpiredMachines } from '@/lib/machineManager'
// import { query } from '@/lib/database'

// /**
//  * Cron job endpoint for auto-releasing machines
//  * This should be called periodically by a cron service every 5 minutes
//  */
// export async function GET(request) {
//   try {
//     // For Vercel Cron, skip auth check since it's internal
//     // For external cron services, you can add auth back if needed
//     const isVercelCron = request.headers.get('user-agent')?.includes('vercel')
    
//     if (!isVercelCron) {
//       // Optional: Add basic auth or API key for external cron security
//       const authHeader = request.headers.get('authorization')
//       const expectedAuth = process.env.CRON_SECRET || 'dwash-cron-secret'
      
//       if (authHeader && authHeader !== `Bearer ${expectedAuth}`) {
//         return NextResponse.json({ 
//           error: 'Unauthorized cron access',
//           message: 'Invalid authorization header'
//         }, { status: 401 })
//       }
//     }

//     // Step 1: Clean up inconsistent data (machines that are 'tersedia' but have expired assignments)
//     // DISABLED: This cleanup is too aggressive and removes valid assignments during edits
//     // const cleanupResult = await query(`
//     //   UPDATE detail_transaksi_layanan dtl
//     //   JOIN mesin_laundry ml ON dtl.id_mesin = ml.id_mesin
//     //   SET dtl.estimasi_selesai = NULL
//     //   WHERE ml.status_mesin = 'tersedia' 
//     //     AND dtl.estimasi_selesai IS NOT NULL
//     //     AND dtl.estimasi_selesai <= NOW()
//     // `)
//     const cleanupResult = { affectedRows: 0 } // Placeholder
    
//     // Step 2: Get all active branches and run auto-release for each
//     const branches = await query('SELECT id_cabang FROM cabang WHERE status_aktif = "aktif"')
    
//     let totalReleased = 0
//     let totalChecked = 0
    
//     for (const branch of branches) {
//       const result = await autoReleaseExpiredMachines(branch.id_cabang)
//       if (result.success) {
//         totalReleased += result.releasedCount
//         totalChecked += result.totalChecked
//       }
//     }
    
//     // Build message for response
//     let logMessage = 'Auto-release completed'
    
//     // Only log when there's activity (cleanup or releases)
//     if (cleanupResult.affectedRows > 0 || totalReleased > 0) {
//       logMessage = 'Auto-release activity: '
//       if (cleanupResult.affectedRows > 0) {
//         logMessage += `🧹 ${cleanupResult.affectedRows} cleanup, `
//       }
//       logMessage += `⚡ ${totalReleased}/${totalChecked} machines released`
//       console.log(logMessage)
//     }

//     return NextResponse.json({
//       success: true,
//       releasedCount: totalReleased,
//       totalChecked: totalChecked,
//       cleanupRecords: cleanupResult.affectedRows,
//       branchesProcessed: branches.length,
//       timestamp: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z',
//       message: logMessage,
//       cronJob: true
//     })

//   } catch (error) {
//     console.error('Auto-release machines cron job error:', error)
    
//     return NextResponse.json({
//       success: false,
//       error: 'Cron job failed',
//       message: error.message,
//       timestamp: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '.000Z',
//       cronJob: true
//     }, { status: 500 })
//   }
// }

// // Also support POST for manual trigger
// export async function POST(request) {
//   return GET(request)
// }