import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { query } from '@/lib/database'
import jsPDF from 'jspdf'

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

    // Check if user is owner, investor, or kasir
    if (decoded.jenis_karyawan !== 'owner' && decoded.jenis_karyawan !== 'investor' && decoded.jenis_karyawan !== 'kasir') {
      return NextResponse.json(
        { error: 'Access denied. Owner, investor, or kasir role required.' },
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

    // Set default date range if not provided (last 30 days)
    const endDate = dateTo || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    const startDate = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

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

    // Create PDF dengan A4 portrait untuk stock report
    const doc = new jsPDF('portrait', 'mm', 'a4')
    let currentPage = 1

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

    const formatDateTime = (dateTime) => {
      return new Date(dateTime).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    // HEADER
    const drawHeader = () => {
      // Calculate header height based on content
      const hasFilters = kategori || status || search
      const headerHeight = hasFilters ? 40 : 35

      // Header background
      doc.setFillColor(220, 53, 69)
      doc.rect(0, 0, 210, headerHeight, 'F')

      // Company info
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text("DWASH LAUNDRY", 15, 20)

      doc.setFontSize(12)
      doc.text("LAPORAN STOK & PERGERAKAN PRODUK", 15, 27)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Cabang: ${branch.nama_cabang}`, 15, 32)

      // Date and page
      doc.setFontSize(9)
      doc.text(`Periode: ${startDate === endDate ? startDate : `${startDate} s/d ${endDate}`}`, 120, 20)
      doc.text(`Dicetak: ${formatDate(new Date())}`, 120, 25)
      doc.text(`Halaman ${currentPage}`, 120, 30)

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
        doc.setFontSize(8)
        doc.setTextColor(255, 255, 255) // Keep white text for filter
        doc.text(`Filter: ${filterText.join(' | ')}`, 15, 37)
      }
    }

    // STATISTICS SUMMARY
    const drawStats = () => {
      // Adjust Y position based on whether filters are shown
      const hasFilters = kategori || status || search
      let yPos = hasFilters ? 55 : 50

      // Title
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('RINGKASAN LAPORAN', 15, yPos)

      yPos += 8

      // Stats grid
      doc.setFillColor(248, 249, 250)
      doc.rect(15, yPos, 180, 25, 'F')
      doc.setDrawColor(220, 220, 220)
      doc.rect(15, yPos, 180, 25, 'S')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)

      doc.text(`Total Produk Bergerak: ${stockStats.total_products}`, 20, yPos + 7)
      doc.text(`Produk Stok Rendah: ${stockStats.low_stock_items}`, 20, yPos + 13)
      doc.text(`Total Transaksi: ${stockStats.total_movements}`, 20, yPos + 19)

      doc.text(`Total Quantity Keluar: ${stockStats.total_quantity_sold}`, 105, yPos + 7)
      doc.text(`Berbayar: ${stockStats.total_paid_quantity} | Gratis: ${stockStats.total_free_quantity}`, 105, yPos + 13)
      doc.text(`Total Pendapatan: ${formatCurrency(stockStats.total_revenue)}`, 105, yPos + 19)

      return yPos + 32
    }

    // CURRENT STOCK TABLE
    const drawCurrentStock = (startY) => {
      let yPos = startY

      // Title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('STOK SAAT INI', 15, yPos)
      yPos += 8

      // Table header
      doc.setFillColor(52, 58, 64)
      doc.rect(15, yPos, 180, 8, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)

      doc.text('PRODUK', 18, yPos + 6)
      doc.text('KATEGORI', 80, yPos + 6)
      doc.text('STOK', 120, yPos + 6)
      doc.text('MIN', 140, yPos + 6)
      doc.text('STATUS', 155, yPos + 6)

      yPos += 10

      // Table rows
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)

      currentStock.forEach((item, index) => {
        // Page break check
        if (yPos > 260) {
          doc.addPage()
          currentPage++
          drawHeader()
          // Adjust Y position based on whether filters are shown
          const hasFilters = kategori || status || search
          yPos = hasFilters ? 60 : 55

          // Repeat table header
          doc.setFillColor(52, 58, 64)
          doc.rect(15, yPos, 180, 8, 'F')
          doc.setTextColor(255, 255, 255)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
          doc.text('PRODUK', 18, yPos + 6)
          doc.text('KATEGORI', 80, yPos + 6)
          doc.text('STOK', 120, yPos + 6)
          doc.text('MIN', 140, yPos + 6)
          doc.text('STATUS', 155, yPos + 6)
          yPos += 10
          doc.setTextColor(0, 0, 0)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
        }

        // Alternating row colors
        if (index % 2 === 0) {
          doc.setFillColor(248, 249, 250)
          doc.rect(15, yPos - 1, 180, 7, 'F')
        }

        // Row data
        doc.text(`${item.nama_produk} (${item.satuan})`, 18, yPos + 4)
        doc.text(item.kategori_produk.replace('_', ' ').toUpperCase(), 80, yPos + 4)
        doc.text(item.stok_tersedia.toString(), 125, yPos + 4)
        doc.text(item.stok_minimum.toString(), 143, yPos + 4)

        // Status with color
        if (item.stok_tersedia <= item.stok_minimum) {
          doc.setTextColor(220, 53, 69)
          doc.text('RENDAH', 157, yPos + 4)
        } else if (item.stok_tersedia <= item.stok_minimum * 2) {
          doc.setTextColor(255, 193, 7)
          doc.text('PERINGATAN', 157, yPos + 4)
        } else {
          doc.setTextColor(25, 135, 84)
          doc.text('AMAN', 157, yPos + 4)
        }

        doc.setTextColor(0, 0, 0)
        yPos += 7
      })

      return yPos + 10
    }

    // DETAILED STOCK MOVEMENT TABLE
    const drawDetailedMovementTable = (startY) => {
      if (filteredProductSummary.length === 0) return startY

      let yPos = startY

      // Title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('RINGKASAN PERGERAKAN PRODUK DETAIL', 15, yPos)
      yPos += 8

      // Note
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text('*Stok awal dihitung dari: Stok saat ini + Total yang dipakai dalam periode', 15, yPos)
      yPos += 8

      // Table header
      doc.setFillColor(52, 58, 64)
      doc.rect(15, yPos, 180, 10, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)

      doc.text('PRODUK', 18, yPos + 4)
      doc.text('SATUAN', 18, yPos + 7)

      doc.text('STOK', 50, yPos + 4)
      doc.text('AWAL*', 50, yPos + 7)

      doc.text('TOTAL', 70, yPos + 4)
      doc.text('DIPAKAI', 70, yPos + 7)

      doc.text('GRATIS', 90, yPos + 4)
      doc.text('PROMO', 90, yPos + 7)

      doc.text('BER-', 110, yPos + 4)
      doc.text('BAYAR', 110, yPos + 7)

      doc.text('STOK', 130, yPos + 4)
      doc.text('SISA', 130, yPos + 7)

      doc.text('PENDAPATAN', 155, yPos + 6)

      yPos += 12

      // Table rows
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)

      filteredProductSummary.forEach((item, index) => {
        // Page break check
        if (yPos > 255) {
          doc.addPage()
          currentPage++
          drawHeader()
          // Adjust Y position based on whether filters are shown
          const hasFilters = kategori || status || search
          yPos = hasFilters ? 60 : 55

          // Repeat table header
          doc.setFillColor(52, 58, 64)
          doc.rect(15, yPos, 180, 10, 'F')

          doc.setTextColor(255, 255, 255)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7)

          doc.text('PRODUK', 18, yPos + 4)
          doc.text('SATUAN', 18, yPos + 7)
          doc.text('STOK', 50, yPos + 4)
          doc.text('AWAL*', 50, yPos + 7)
          doc.text('TOTAL', 70, yPos + 4)
          doc.text('DIPAKAI', 70, yPos + 7)
          doc.text('GRATIS', 90, yPos + 4)
          doc.text('PROMO', 90, yPos + 7)
          doc.text('BER-', 110, yPos + 4)
          doc.text('BAYAR', 110, yPos + 7)
          doc.text('STOK', 130, yPos + 4)
          doc.text('SISA', 130, yPos + 7)
          doc.text('PENDAPATAN', 155, yPos + 6)

          yPos += 12
          doc.setTextColor(0, 0, 0)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
        }

        // Alternating row colors
        if (index % 2 === 0) {
          doc.setFillColor(248, 249, 250)
          doc.rect(15, yPos - 1, 180, 9, 'F')
        }

        // Row data
        doc.text(item.nama_produk, 18, yPos + 3)
        doc.text(`(${item.satuan})`, 18, yPos + 6)

        doc.text(item.stok_awal.toString(), 53, yPos + 5)
        doc.text(item.total_dipakai.toString(), 73, yPos + 5)
        doc.text(item.gratis_promo.toString(), 93, yPos + 5)
        doc.text(item.berbayar.toString(), 113, yPos + 5)

        // Stock sisa with color
        if (item.stok_sisa <= item.stok_minimum) {
          doc.setTextColor(220, 53, 69)
        } else if (item.stok_sisa <= item.stok_minimum * 1.5) {
          doc.setTextColor(255, 193, 7)
        } else {
          doc.setTextColor(25, 135, 84)
        }
        doc.text(item.stok_sisa.toString(), 133, yPos + 5)

        // Revenue
        doc.setTextColor(0, 0, 0)
        doc.text(formatCurrency(item.total_revenue), 157, yPos + 5)

        yPos += 9
      })

      return yPos + 10
    }

    // Generate PDF
    drawHeader()
    let currentY = drawStats()
    currentY = drawCurrentStock(currentY)
    drawDetailedMovementTable(currentY)

    // Footer
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text("DWash Laundry - Laporan Stok & Pergerakan Produk", 15, 285)
    doc.text(`Halaman ${currentPage}`, 170, 285)

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Laporan_Stok_${branch.nama_cabang.replace(/\s+/g, '_')}_${startDate}_${endDate}.pdf"`
      }
    })

  } catch (error) {
    console.error('Stock PDF report error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}