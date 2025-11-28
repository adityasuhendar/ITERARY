// Auto-cleanup stuck machines every 5 minutes
import { query } from '@/lib/database'

export async function autoCleanupStuckMachines() {
  try {
    // Find and fix stuck machines automatically
    const stuckMachines = await query(`
      SELECT 
        ml.id_mesin,
        ml.nomor_mesin,
        ml.jenis_mesin
      FROM mesin_laundry ml
      WHERE ml.status_mesin = 'digunakan'
        AND ml.id_cabang = 1
        AND NOT EXISTS (
          SELECT 1 
          FROM detail_transaksi_layanan dtl 
          WHERE dtl.id_mesin = ml.id_mesin
            AND dtl.service_status IN ('planned', 'active', 'queued')
            AND (dtl.estimasi_selesai IS NULL OR dtl.estimasi_selesai > NOW())
        )
    `)
    
    if (stuckMachines.length > 0) {
      const machineIds = stuckMachines.map(m => m.id_mesin)
      
      await query(`
        UPDATE mesin_laundry 
        SET status_mesin = 'tersedia',
            updated_by_karyawan = NULL,
            estimasi_selesai = NULL
        WHERE id_mesin IN (${machineIds.map(() => '?').join(',')})
      `, machineIds)
      
      console.log(`🔧 Auto-fixed ${stuckMachines.length} stuck machines: ${stuckMachines.map(m => m.nomor_mesin).join(', ')}`)
    }
    
    return { success: true, fixedCount: stuckMachines.length }
  } catch (error) {
    console.error('Auto-cleanup error:', error)
    return { success: false, error: error.message }
  }
}