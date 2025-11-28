import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { query } from '@/lib/database'
import * as XLSX from 'xlsx'

export async function GET(request) {
  try {
    // Get token from cookies
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      )
    }

    // Verify JWT token
    let decoded
    try {
      decoded = jwt.verify(token.value, process.env.JWT_SECRET)
    } catch (jwtError) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Check if user is owner or investor
    if (decoded.jenis_karyawan !== 'owner' && decoded.jenis_karyawan !== 'investor') {
      return NextResponse.json(
        { error: 'Access denied. Owner or investor role required.' },
        { status: 403 }
      )
    }

    // Get parameters
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branch_id')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const kategori = searchParams.get('kategori')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      )
    }

    // Set default date range if not provided (today)
    const endDate = dateTo || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    const startDate = dateFrom || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

    // Fetch branch data and stock information
    const [branchInfo, currentStock, stockMovements] = await Promise.all([
      // Branch info
      query('SELECT * FROM cabang WHERE id_cabang = ?', [branchId]),

      // Current stock levels with optional category filter
      query(`
        SELECT
          sc.id_stok,
          sc.stok_tersedia,
          sc.stok_minimum,
          sc.terakhir_update,
          pt.nama_produk,
          pt.satuan,
          pt.kategori_produk,
          pt.harga,
          k.nama_karyawan as updated_by_name
        FROM stok_cabang sc
        JOIN produk_tambahan pt ON sc.id_produk = pt.id_produk
        LEFT JOIN karyawan k ON sc.updated_by_karyawan = k.id_karyawan
        WHERE sc.id_cabang = ?
        ${kategori ? 'AND pt.kategori_produk = ?' : ''}
        ${search ? 'AND pt.nama_produk LIKE ?' : ''}
        ORDER BY pt.kategori_produk, pt.nama_produk
      `, [
        branchId,
        ...(kategori ? [kategori] : []),
        ...(search ? [`%${search}%`] : [])
      ]),

      // Stock movements (based on transactions in date range)
      query(`
        SELECT
          t.tanggal_transaksi,
          t.kode_transaksi,
          dtp.quantity,
          dtp.harga_satuan,
          dtp.subtotal,
          pt.nama_produk,
          pt.satuan,
          pt.kategori_produk,
          dtp.is_free as is_free_promo,
          dtp.free_quantity,
          p.nama_pelanggan,
          k.nama_karyawan as kasir_name
        FROM detail_transaksi_produk dtp
        JOIN transaksi t ON dtp.id_transaksi = t.id_transaksi
        JOIN produk_tambahan pt ON dtp.id_produk = pt.id_produk
        JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
        LEFT JOIN karyawan k ON t.id_karyawan = k.id_karyawan
        WHERE t.id_cabang = ?
        AND DATE(t.tanggal_transaksi) BETWEEN ? AND ?
        AND t.status_transaksi = 'selesai'
        ${kategori ? 'AND pt.kategori_produk = ?' : ''}
        ${search ? 'AND pt.nama_produk LIKE ?' : ''}
        ORDER BY t.tanggal_transaksi DESC, pt.kategori_produk, pt.nama_produk
      `, [
        branchId,
        startDate,
        endDate,
        ...(kategori ? [kategori] : []),
        ...(search ? [`%${search}%`] : [])
      ])
    ])

    if (branchInfo.length === 0) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      )
    }

    const branch = branchInfo[0]

    // Group movements by product with paid vs free breakdown
    const movementsByProduct = stockMovements.reduce((acc, movement) => {
      const key = movement.nama_produk
      if (!acc[key]) {
        acc[key] = {
          nama_produk: movement.nama_produk,
          kategori_produk: movement.kategori_produk,
          satuan: movement.satuan,
          total_quantity: 0,
          paid_quantity: 0,
          free_quantity: 0,
          total_revenue: 0,
          transaction_count: 0
        }
      }

      const quantity = parseInt(movement.quantity) || 0
      const revenue = parseFloat(movement.subtotal)
      const freeQuantity = parseInt(movement.free_quantity) || 0
      const paidQuantity = quantity - freeQuantity

      acc[key].total_quantity += quantity
      acc[key].total_revenue += revenue
      acc[key].transaction_count += 1
      acc[key].paid_quantity += paidQuantity
      acc[key].free_quantity += freeQuantity

      return acc
    }, {})

    // Combine with current stock to calculate starting stock
    const productSummary = currentStock.map(stockItem => {
      const movements = movementsByProduct[stockItem.nama_produk] || {
        total_quantity: 0,
        paid_quantity: 0,
        free_quantity: 0,
        total_revenue: 0,
        transaction_count: 0
      }

      // Calculate estimated starting stock (current + used)
      const stockAwal = stockItem.stok_tersedia + movements.total_quantity

      return {
        nama_produk: stockItem.nama_produk,
        satuan: stockItem.satuan,
        kategori_produk: stockItem.kategori_produk,
        stok_awal: stockAwal,
        stok_sisa: stockItem.stok_tersedia,
        total_dipakai: movements.total_quantity,
        gratis_promo: movements.free_quantity,
        berbayar: movements.paid_quantity,
        total_revenue: movements.total_revenue,
        transaction_count: movements.transaction_count,
        stok_minimum: stockItem.stok_minimum
      }
    })

    // Filter products that had movement or currently have stock
    let filteredProductSummary = productSummary.filter(item =>
      item.total_dipakai > 0 || item.stok_sisa > 0
    )

    // Apply status filter if specified
    if (status) {
      filteredProductSummary = filteredProductSummary.filter(item => {
        const isLowStock = item.stok_sisa <= item.stok_minimum
        const isWarning = item.stok_sisa <= item.stok_minimum * 1.5 && item.stok_sisa > item.stok_minimum
        const isSafe = item.stok_sisa > item.stok_minimum * 1.5

        switch (status) {
          case 'habis':
            return isLowStock
          case 'rendah':
            return isWarning
          case 'aman':
            return isSafe
          default:
            return true
        }
      })
    }

    // Calculate stock statistics
    const stockStats = {
      total_products: filteredProductSummary.length,
      low_stock_items: currentStock.filter(item => item.stok_tersedia <= item.stok_minimum).length,
      total_movements: stockMovements.length,
      total_quantity_sold: filteredProductSummary.reduce((sum, item) => sum + item.total_dipakai, 0),
      total_paid_quantity: filteredProductSummary.reduce((sum, item) => sum + item.berbayar, 0),
      total_free_quantity: filteredProductSummary.reduce((sum, item) => sum + item.gratis_promo, 0),
      total_revenue: filteredProductSummary.reduce((sum, item) => sum + item.total_revenue, 0)
    }

    // Helper functions
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(amount || 0)
    }

    const formatDate = (dateTime) => {
      return new Date(dateTime).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })
    }

    // Prepare Excel data
    const worksheetData = []

    // Header info
    worksheetData.push(['LAPORAN STOK & PERGERAKAN PRODUK'])
    worksheetData.push([`Cabang: ${branch.nama_cabang}`])
    worksheetData.push([`Periode: ${startDate} s/d ${endDate}`])
    worksheetData.push([`Dicetak: ${formatDate(new Date())}`])

    // Show active filters
    let filterText = []
    if (kategori) {
      const kategoriMap = {
        'sabun_softener': 'Sabun & Softener',
        'tas_plastik': 'Tas Plastik',
        'minuman': 'Minuman',
        'lainnya': 'Lainnya'
      }
      filterText.push(`Kategori: ${kategoriMap[kategori] || kategori}`)
    }
    if (status) {
      const statusMap = {
        'aman': 'Stok Aman',
        'rendah': 'Stok Rendah',
        'habis': 'Stok Habis'
      }
      filterText.push(`Status: ${statusMap[status] || status}`)
    }
    if (search) {
      filterText.push(`Pencarian: "${search}"`)
    }

    if (filterText.length > 0) {
      worksheetData.push([`Filter: ${filterText.join(' | ')}`])
    }

    // Note about statistics filter
    worksheetData.push(['Catatan: Statistik ringkasan hanya menghitung transaksi yang selesai'])

    worksheetData.push([]) // Empty row

    // Statistics
    worksheetData.push(['RINGKASAN LAPORAN'])
    worksheetData.push([`Total Produk Bergerak: ${stockStats.total_products}`])
    worksheetData.push([`Produk Stok Rendah: ${stockStats.low_stock_items}`])
    worksheetData.push([`Total Transaksi: ${stockStats.total_movements}`])
    worksheetData.push([`Total Quantity Keluar: ${stockStats.total_quantity_sold}`])
    worksheetData.push([`Berbayar: ${stockStats.total_paid_quantity} | Gratis: ${stockStats.total_free_quantity}`])
    worksheetData.push([`Total Pendapatan: ${formatCurrency(stockStats.total_revenue)}`])
    worksheetData.push([]) // Empty row

    // Current Stock Table
    worksheetData.push(['STOK SAAT INI'])
    worksheetData.push(['Produk', 'Satuan', 'Kategori', 'Stok Tersedia', 'Stok Minimum', 'Status'])

    currentStock.forEach(item => {
      let statusText = 'Aman'
      if (item.stok_tersedia <= item.stok_minimum) {
        statusText = 'Habis'
      } else if (item.stok_tersedia <= item.stok_minimum * 1.5) {
        statusText = 'Rendah'
      }

      worksheetData.push([
        item.nama_produk,
        item.satuan,
        item.kategori_produk.replace('_', ' ').toUpperCase(),
        item.stok_tersedia,
        item.stok_minimum,
        statusText
      ])
    })

    worksheetData.push([]) // Empty row

    // Detailed Movement Table
    worksheetData.push(['RINGKASAN PERGERAKAN PRODUK DETAIL'])
    worksheetData.push(['Produk', 'Satuan', 'Stok Awal*', 'Total Dipakai', 'Gratis Promo', 'Berbayar', 'Stok Sisa', 'Pendapatan'])
    worksheetData.push(['*Stok awal dihitung dari: Stok saat ini + Total yang dipakai dalam periode'])

    filteredProductSummary.forEach(item => {
      worksheetData.push([
        item.nama_produk,
        item.satuan,
        item.stok_awal,
        item.total_dipakai,
        item.gratis_promo,
        item.berbayar,
        item.stok_sisa,
        formatCurrency(item.total_revenue)
      ])
    })

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

    // Set column widths
    const colWidths = [
      { wch: 25 }, // Produk
      { wch: 10 }, // Satuan
      { wch: 15 }, // Kategori/Stok Awal
      { wch: 12 }, // Stok Tersedia/Total Dipakai
      { wch: 12 }, // Stok Minimum/Gratis Promo
      { wch: 12 }, // Status/Berbayar
      { wch: 12 }, // Stok Sisa
      { wch: 15 }  // Pendapatan
    ]
    worksheet['!cols'] = colWidths

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Stok')

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Build filename
    let filename = `Laporan_Stok_${branch.nama_cabang.replace(/\s+/g, '_')}`

    if (startDate === endDate) {
      filename += `_${startDate}`
    } else {
      filename += `_${startDate}_sd_${endDate}`
    }

    filename += '.xlsx'

    return new Response(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('Stock Excel report error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}