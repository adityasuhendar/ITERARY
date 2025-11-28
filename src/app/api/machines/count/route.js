import { NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request) {
  // Using customer pool via parameter
  
  try {
    const { searchParams } = new URL(request.url)
    const cabangId = searchParams.get('cabang_id')

    if (!cabangId) {
      return NextResponse.json({ error: 'cabang_id parameter required' }, { status: 400 })
    }

    // Get all machines with their status
    const machineList = await query(`
      SELECT 
        id_mesin,
        nomor_mesin,
        jenis_mesin,
        status_mesin
      FROM mesin_laundry 
      WHERE id_cabang = ?
      ORDER BY jenis_mesin, nomor_mesin
    `, [cabangId], 'customer')

    // Format response with detailed machine info
    const machineData = {
      cuci: [],
      pengering: []
    }

    // Group machines by type
    machineList.forEach(machine => {
      if (machine.jenis_mesin === 'cuci') {
        machineData.cuci.push({
          id: machine.nomor_mesin,
          nomor_mesin: machine.nomor_mesin,
          status: machine.status_mesin,
          id_mesin: machine.id_mesin
        })
      } else if (machine.jenis_mesin === 'pengering') {
        machineData.pengering.push({
          id: machine.nomor_mesin,
          nomor_mesin: machine.nomor_mesin,
          status: machine.status_mesin,
          id_mesin: machine.id_mesin
        })
      }
    })

    return NextResponse.json({
      success: true,
      cabang_id: parseInt(cabangId),
      machines: machineData,
      counts: {
        cuci: machineData.cuci.length,
        pengering: machineData.pengering.length
      },
      last_updated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Machine count API error:', error)
    
    return NextResponse.json({
      error: 'Database error',
      message: error.message
    }, { status: 500 })
  }
}