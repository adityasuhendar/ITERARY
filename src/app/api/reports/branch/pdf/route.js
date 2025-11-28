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
    const paymentMethod = searchParams.get('paymentMethod')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      )
    }

    // Build dynamic WHERE conditions
    let whereConditions = ['t.id_cabang = ?']
    let queryParams = [branchId]

    // Date filters
    if (dateFrom && dateTo) {
      whereConditions.push('DATE(t.tanggal_transaksi) BETWEEN ? AND ?')
      queryParams.push(dateFrom, dateTo)
    } else if (dateFrom) {
      whereConditions.push('DATE(t.tanggal_transaksi) >= ?')
      queryParams.push(dateFrom)
    } else if (dateTo) {
      whereConditions.push('DATE(t.tanggal_transaksi) <= ?')
      queryParams.push(dateTo)
    } else {
      // Default: last 30 days if no date filter is specified
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      whereConditions.push('DATE(t.tanggal_transaksi) BETWEEN DATE_SUB(?, INTERVAL 29 DAY) AND ?')
      queryParams.push(today, today)
    }

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      whereConditions.push('t.metode_pembayaran = ?')
      queryParams.push(paymentMethod)
    }

    // Status filter
    if (status && status !== 'all') {
      whereConditions.push('t.status_transaksi = ?')
      queryParams.push(status)
    }

    // Search filter
    if (search) {
      whereConditions.push('(t.kode_transaksi LIKE ? OR p.nama_pelanggan LIKE ?)')
      queryParams.push(`%${search}%`, `%${search}%`)
    }

    const whereClause = whereConditions.join(' AND ')

    // Fetch branch data
    const [branchInfo, branchStats, transactionData, feeKasirData, expensesData] = await Promise.all([
      // Branch info
      query('SELECT * FROM cabang WHERE id_cabang = ?', [branchId]),

      // Branch statistics - ONLY SELESAI transactions for summary
      query(`
        SELECT
          COUNT(*) as total_transactions,
          COALESCE(SUM(t.total_keseluruhan), 0) as total_revenue,
          COUNT(DISTINCT t.id_pelanggan) as unique_customers,
          AVG(t.total_keseluruhan) as avg_transaction,
          COUNT(CASE WHEN t.metode_pembayaran = 'tunai' THEN 1 END) as tunai_count,
          COUNT(CASE WHEN t.metode_pembayaran = 'qris' THEN 1 END) as qris_count,
          COALESCE(SUM(CASE WHEN t.metode_pembayaran = 'tunai' THEN t.total_keseluruhan END), 0) as tunai_revenue,
          COALESCE(SUM(CASE WHEN t.metode_pembayaran = 'qris' THEN t.total_keseluruhan END), 0) as qris_revenue
        FROM transaksi t
        LEFT JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
        WHERE ${whereClause}
        AND t.status_transaksi = 'selesai'
      `, queryParams),

      // Transaction details with dynamic filters
      query(`
        SELECT
          t.id_transaksi,
          t.kode_transaksi,
          t.tanggal_transaksi,
          t.total_keseluruhan,
          t.metode_pembayaran,
          t.status_transaksi,
          t.nama_pekerja_aktual,
          t.shift_transaksi,
          p.nama_pelanggan,
          k.nama_karyawan
        FROM transaksi t
        LEFT JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
        LEFT JOIN karyawan k ON t.id_karyawan = k.id_karyawan
        WHERE ${whereClause}
        ORDER BY t.tanggal_transaksi DESC
        LIMIT 1000
      `, queryParams),

      // Fee kasir data (CKL services) - ONLY SELESAI transactions
      query(`
        SELECT
          COALESCE(SUM(dtl.fee_kasir), 0) as fee_kasir,
          COUNT(DISTINCT CASE WHEN dtl.id_jenis_layanan = 4 AND dtl.fee_kasir > 0 THEN dtl.id_detail_layanan END) as ckl_count
        FROM detail_transaksi_layanan dtl
        JOIN transaksi t ON dtl.id_transaksi = t.id_transaksi
        LEFT JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan
        WHERE ${whereClause}
        AND t.status_transaksi = 'selesai'
        AND dtl.fee_kasir > 0
      `, queryParams),

      // Expenses data for the period - Individual items with dates
      query(`
        SELECT
          kategori,
          jumlah,
          DATE_FORMAT(tanggal, '%d/%m/%Y') as tanggal_formatted
        FROM pengeluaran
        WHERE id_cabang = ?
        AND DATE(tanggal) BETWEEN ? AND ?
        ORDER BY tanggal DESC, kategori
      `, [branchId, dateFrom || today, dateTo || today])
    ])

    if (branchInfo.length === 0) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      )
    }

    const branch = branchInfo[0]
    const stats = branchStats[0]

    // Calculate fee kasir and expenses
    const feeKasir = parseFloat(feeKasirData[0]?.fee_kasir || 0)
    const cklCount = parseInt(feeKasirData[0]?.ckl_count || 0)

    // Calculate total expenses
    const totalExpenses = expensesData.reduce((sum, exp) => sum + parseFloat(exp.jumlah), 0)

    // Calculate net revenue (Kotor - Fee - Expenses)
    const pendapatanBersih = stats.total_revenue - feeKasir - totalExpenses
    const tunaiBersih = stats.tunai_revenue - feeKasir - totalExpenses
    const qrisBersih = stats.qris_revenue // QRIS tidak kena potongan

    // OPTIMIZED: Batch queries instead of N+1 problem
    if (transactionData.length > 0) {
      const transactionIds = transactionData.map(t => t.id_transaksi)
      const placeholders = transactionIds.map(() => '?').join(',')

      // Batch get ALL services for all transactions
      const allServices = await query(`
        SELECT
          dtl.id_transaksi,
          dtl.quantity,
          dtl.harga_satuan,
          dtl.subtotal,
          jl.nama_layanan
        FROM detail_transaksi_layanan dtl
        JOIN jenis_layanan jl ON dtl.id_jenis_layanan = jl.id_jenis_layanan
        WHERE dtl.id_transaksi IN (${placeholders})
        ORDER BY dtl.id_transaksi, dtl.id_detail_layanan
      `, transactionIds)

      // Batch get ALL products for all transactions
      const allProducts = await query(`
        SELECT
          dtp.id_transaksi,
          dtp.quantity,
          dtp.harga_satuan,
          dtp.subtotal,
          pt.nama_produk,
          pt.satuan,
          dtp.is_free as is_free_promo,
          dtp.free_quantity
        FROM detail_transaksi_produk dtp
        JOIN produk_tambahan pt ON dtp.id_produk = pt.id_produk
        WHERE dtp.id_transaksi IN (${placeholders})
        ORDER BY dtp.id_transaksi, dtp.id_detail_produk
      `, transactionIds)

      // Group services and products by transaction ID
      const servicesByTransaction = {}
      const productsByTransaction = {}

      allServices.forEach(service => {
        if (!servicesByTransaction[service.id_transaksi]) {
          servicesByTransaction[service.id_transaksi] = []
        }
        servicesByTransaction[service.id_transaksi].push(service)
      })

      allProducts.forEach(product => {
        if (!productsByTransaction[product.id_transaksi]) {
          productsByTransaction[product.id_transaksi] = []
        }
        productsByTransaction[product.id_transaksi].push(product)
      })

      // Assign grouped data to transactions
      transactionData.forEach(transaction => {
        transaction.services = servicesByTransaction[transaction.id_transaksi] || []
        transaction.products = productsByTransaction[transaction.id_transaksi] || []
      })
    }

    // Create PDF dengan A4 landscape 
    const doc = new jsPDF('landscape', 'mm', 'a4')
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

    const formatTime = (dateTime) => {
      return new Date(dateTime).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Jakarta'
      })
    }

    // Helper function to format services breakdown
    const formatServicesBreakdown = (services) => {
      if (!services || services.length === 0) return '-'
      
      const grouped = {}
      services.forEach(service => {
        const isFree = parseFloat(service.subtotal) === 0
        const serviceName = service.nama_layanan
        
        if (!grouped[serviceName]) {
          grouped[serviceName] = { free: 0, paid: 0 }
        }
        
        if (isFree) {
          grouped[serviceName].free += parseInt(service.quantity) || 1
        } else {
          grouped[serviceName].paid += parseInt(service.quantity) || 1
        }
      })
      
      return Object.entries(grouped).map(([name, counts]) => {
        if (counts.free > 0 && counts.paid > 0) {
          return `${counts.paid + counts.free}x ${name} (${counts.free} gratis)`
        } else if (counts.free > 0) {
          return `${counts.free}x ${name} (gratis)`
        } else {
          return `${counts.paid}x ${name}`
        }
      }).join(', ')
    }

    // Helper function to format products breakdown
    const formatProductsBreakdown = (products) => {
      if (!products || products.length === 0) return '-'

      return products.map(product => {
        // UPDATED: Read free data directly from transaction, no recalculation
        const totalQty = parseInt(product.quantity) || 0
        const freeQty = parseInt(product.free_quantity) || 0
        const paidQty = totalQty - freeQty

        if (freeQty > 0 && paidQty > 0) {
          return `${totalQty}${product.satuan} ${product.nama_produk} (${freeQty} gratis)`
        } else if (freeQty > 0) {
          return `${freeQty}${product.satuan} ${product.nama_produk} (gratis)`
        } else {
          return `${paidQty}${product.satuan} ${product.nama_produk}`
        }
      }).join(', ')
    }

    // SMART TEXT WRAPPING FUNCTION
    const wrapText = (text, maxWidth, fontSize = 7) => {
      doc.setFontSize(fontSize)
      const lines = doc.splitTextToSize(text, maxWidth)
      return lines.slice(0, 3) // Max 3 lines
    }

    // CLEAN HEADER (A4 landscape)
    const drawHeader = () => {
      // Header background - A4 landscape width = 297mm
      doc.setFillColor(220, 53, 69)
      doc.rect(0, 0, 297, 30, 'F')

      // Company info
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text("DWASH LAUNDRY", 15, 18)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Cabang: ${branch.nama_cabang}`, 15, 25)

      // Filter info (top right, above "Dicetak")
      const hasFilters = (dateFrom && dateFrom !== '') ||
                        (dateTo && dateTo !== '') ||
                        (paymentMethod && paymentMethod !== 'all') ||
                        (status && status !== 'all') ||
                        (search && search !== '')

      if (hasFilters) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text('FILTER DITERAPKAN:', 282, 10, { align: 'right' })

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)

        // Helper to format date to "2 Oktober 2025"
        const formatDateID = (dateString) => {
          const [year, month, day] = dateString.split('-')
          const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                         'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
          return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`
        }

        let filters = []
        if (dateFrom && dateTo) {
          if (dateFrom === dateTo) {
            filters.push(`Periode: ${formatDateID(dateFrom)}`)
          } else {
            filters.push(`Periode: ${formatDateID(dateFrom)} s/d ${formatDateID(dateTo)}`)
          }
        } else if (dateFrom) {
          filters.push(`Dari: ${formatDateID(dateFrom)}`)
        } else if (dateTo) {
          filters.push(`Sampai: ${formatDateID(dateTo)}`)
        }

        if (paymentMethod && paymentMethod !== 'all') filters.push(`Pembayaran: ${paymentMethod.toUpperCase()}`)
        if (status && status !== 'all') filters.push(`Status: ${status.toUpperCase()}`)
        if (search) filters.push(`Pencarian: "${search}"`)

        doc.text(filters.join(' | '), 282, 15, { align: 'right' })
      }

      // Date and page
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}`, 282, 22, { align: 'right' })
      // doc.text(`Halaman ${currentPage}`, 220, 25)
    }

    // STATISTICS SUMMARY
    const drawStats = () => {
      let yPos = 38

      // Title
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('RINGKASAN LAPORAN', 15, yPos)

      yPos += 6

      // Calculate dynamic height based on expenses
      const expenseLines = expensesData.length
      // Minimum 42mm untuk konten dasar, tambah 4mm per expense line
      const boxHeight = 42 + (expenseLines > 0 ? (expenseLines * 4) : 0)

      // Stats grid (A4 width) - Dynamic height
      doc.setFillColor(248, 249, 250)
      doc.rect(15, yPos, 262, boxHeight, 'F')
      doc.setDrawColor(220, 220, 220)
      doc.rect(15, yPos, 262, boxHeight, 'S')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)

      // Left column - Stats + Payment Breakdown
      doc.text(`Total Transaksi: ${stats.total_transactions}`, 20, yPos + 7)
      doc.text(`Total Pelanggan: ${stats.unique_customers}`, 20, yPos + 13)
      doc.text(`Rata-rata: ${formatCurrency(stats.avg_transaction)}`, 20, yPos + 19)

      // Payment method breakdown (moved from column 3)
      doc.text(`TUNAI: ${formatCurrency(stats.tunai_revenue || 0)} (${stats.tunai_count || 0} transaksi)`, 20, yPos + 28)
      doc.text(`QRIS: ${formatCurrency(stats.qris_revenue || 0)} (${stats.qris_count || 0} transaksi)`, 20, yPos + 34)

      // Middle column - Revenue Kotor, Fee, Expenses (NO NET RESULTS)
      let midY = yPos + 7
      doc.text(`Pendapatan Kotor: ${formatCurrency(stats.total_revenue)}`, 120, midY)

      midY += 6
      doc.setTextColor(255, 111, 0)
      doc.text(`Fee Jasa Lipat: ${formatCurrency(feeKasir)} (${cklCount} CKL)`, 120, midY)

      midY += 6
      if (expensesData.length > 0) {
        doc.setTextColor(220, 53, 69)
        doc.text(`Pengeluaran: ${formatCurrency(totalExpenses)}`, 120, midY)
        midY += 4
        doc.setFontSize(7)
        doc.setTextColor(100, 100, 100)
        expensesData.forEach((expense) => {
          doc.text(`  - ${expense.kategori} (${expense.tanggal_formatted}): ${formatCurrency(parseFloat(expense.jumlah))}`, 120, midY)
          midY += 4
        })
        doc.setFontSize(9)
      } else {
        doc.setTextColor(220, 53, 69)
        doc.text(`Pengeluaran: Rp 0`, 120, midY)
      }

      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')

      // Right column - Net Results ONLY (moved from column 2)
      doc.setTextColor(0, 128, 0)
      doc.setFont('helvetica', 'bold')
      doc.text(`Pendapatan Bersih: ${formatCurrency(pendapatanBersih)}`, 220, yPos + 7)
      doc.text(`Tunai Bersih: ${formatCurrency(tunaiBersih)}`, 220, yPos + 13)
      doc.setTextColor(13, 110, 253)
      doc.text(`QRIS Bersih: ${formatCurrency(qrisBersih)}`, 220, yPos + 19)

      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')

      return yPos + boxHeight + 7
    }

    // FULL TABLE LAYOUT - ALL COLUMNS LIKE WEB
    const drawTable = (startY) => {
      let yPos = startY + 3

      // Table title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('DAFTAR TRANSAKSI LENGKAP', 20, yPos)
      yPos += 8
      
      // Column positions untuk A4 landscape (297mm width) - COMPACT
      const cols = {
        no: { x: 18, w: 10 },
        kode: { x: 28, w: 24 },
        tanggal: { x: 52, w: 20 },
        waktu: { x: 72, w: 16 },
        pelanggan: { x: 88, w: 32 },
        kasir: { x: 120, w: 19 },
        layanan: { x: 139, w: 39 },
        produk: { x: 178, w: 48 },
        metode: { x: 226, w: 16 },
        total: { x: 242, w: 20 },
        status: { x: 262, w: 15 }
      }
      
      // Table header dengan semua kolom
      doc.setFillColor(52, 58, 64)
      doc.rect(15, yPos, 262, 10, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      
      doc.text('NO', cols.no.x + 1, yPos + 7)
      doc.text('KODE', cols.kode.x + 1, yPos + 7)
      doc.text('TANGGAL', cols.tanggal.x + 1, yPos + 7)
      doc.text('WAKTU', cols.waktu.x + 1, yPos + 7)
      doc.text('PELANGGAN', cols.pelanggan.x + 1, yPos + 7)
      doc.text('KASIR', cols.kasir.x + 1, yPos + 7)
      doc.text('LAYANAN', cols.layanan.x + 1, yPos + 7)
      doc.text('PRODUK', cols.produk.x + 1, yPos + 7)
      doc.text('BAYAR', cols.metode.x + 1, yPos + 7)
      doc.text('TOTAL', cols.total.x + 1, yPos + 7)
      doc.text('STATUS', cols.status.x + 1, yPos + 7)
      
      yPos += 12
      
      // Table rows dengan SEMUA KOLOM
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      
      transactionData.forEach((transaction, index) => {
        // Page break check untuk A4
        if (yPos > 185) {
          // Footer
          doc.setFontSize(7)
          doc.setTextColor(128, 128, 128)
          doc.text("DWash Laundry - Laporan Transaksi Cabang", 15, 200)
          doc.text(`Halaman ${currentPage}`, 240, 200)
          
          doc.addPage()
          currentPage++
          drawHeader()
          yPos = 38
          
          // Repeat table header on new page
          doc.setFillColor(52, 58, 64)
          doc.rect(15, yPos, 262, 10, 'F')
          
          doc.setTextColor(255, 255, 255)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
          
          doc.text('NO', cols.no.x + 1, yPos + 7)
          doc.text('KODE', cols.kode.x + 1, yPos + 7)
          doc.text('TANGGAL', cols.tanggal.x + 1, yPos + 7)
          doc.text('WAKTU', cols.waktu.x + 1, yPos + 7)
          doc.text('PELANGGAN', cols.pelanggan.x + 1, yPos + 7)
          doc.text('KASIR', cols.kasir.x + 1, yPos + 7)
          doc.text('LAYANAN', cols.layanan.x + 1, yPos + 7)
          doc.text('PRODUK', cols.produk.x + 1, yPos + 7)
          doc.text('BAYAR', cols.metode.x + 1, yPos + 7)
          doc.text('TOTAL', cols.total.x + 1, yPos + 7)
          doc.text('STATUS', cols.status.x + 1, yPos + 7)
          
          yPos += 15
          doc.setTextColor(0, 0, 0)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
        }
        
        // Alternating row colors - PROPER ALIGNMENT
        if (index % 2 === 0) {
          doc.setFillColor(248, 249, 250)
          doc.rect(15, yPos - 2, 262, 15, 'F')
        }
        
        // Row data LENGKAP
        doc.setTextColor(0, 0, 0)
        
        // NO
        doc.text((index + 1).toString(), cols.no.x + 2, yPos + 6)
        
        // KODE TRANSAKSI FULL
        doc.text(transaction.kode_transaksi, cols.kode.x + 2, yPos + 6)
        
        // TANGGAL
        doc.text(formatDate(transaction.tanggal_transaksi), cols.tanggal.x + 2, yPos + 6)
        
        // WAKTU
        doc.text(formatTime(transaction.tanggal_transaksi), cols.waktu.x + 2, yPos + 6)
        
        // PELANGGAN
        const customerName = transaction.nama_pelanggan.length > 18 
          ? transaction.nama_pelanggan.substring(0, 16) + '..'
          : transaction.nama_pelanggan
        doc.text(customerName, cols.pelanggan.x + 2, yPos + 6)
        
        // KASIR
        const kasirName = transaction.nama_pekerja_aktual || transaction.nama_karyawan || '-'
        const kasir = kasirName.length > 15 
          ? kasirName.substring(0, 13) + '..'
          : kasirName
        doc.text(kasir, cols.kasir.x + 2, yPos + 6)
        
        // LAYANAN DETAIL - PROPER TEXT WRAPPING
        const layanan = formatServicesBreakdown(transaction.services)
        const layananLines = wrapText(layanan, cols.layanan.w - 4)
        if (layananLines.length === 1) {
          // Single line - center vertically
          doc.text(layananLines[0], cols.layanan.x + 2, yPos + 6)
        } else {
          // Multiple lines - start from top
          layananLines.forEach((line, i) => {
            doc.text(line, cols.layanan.x + 2, yPos + 4 + (i * 3))
          })
        }
        
        // PRODUK DETAIL - PROPER TEXT WRAPPING
        const produk = formatProductsBreakdown(transaction.products)
        const produkLines = wrapText(produk, cols.produk.w - 4)
        if (produkLines.length === 1) {
          // Single line - center vertically
          doc.text(produkLines[0], cols.produk.x + 2, yPos + 6)
        } else {
          // Multiple lines - start from top
          produkLines.forEach((line, i) => {
            doc.text(line, cols.produk.x + 2, yPos + 4 + (i * 3))
          })
        }
        
        // METODE PEMBAYARAN
        if (transaction.metode_pembayaran === 'tunai') {
          doc.setTextColor(25, 135, 84)
          doc.text('TUNAI', cols.metode.x + 2, yPos + 6)
        } else {
          doc.setTextColor(13, 110, 253)
          doc.text('QRIS', cols.metode.x + 2, yPos + 6)
        }

        // TOTAL
        doc.setTextColor(25, 135, 84)
        doc.setFont('helvetica', 'bold')
        const amount = formatCurrency(transaction.total_keseluruhan)
        doc.text(amount, cols.total.x + 2, yPos + 6)

        // STATUS
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'normal')
        if (transaction.status_transaksi === 'selesai') {
          doc.setTextColor(25, 135, 84)
          doc.text('Selesai', cols.status.x + 2, yPos + 6)
        } else if (transaction.status_transaksi === 'pending') {
          doc.setTextColor(255, 193, 7)
          doc.text('Pending', cols.status.x + 2, yPos + 6)
        } else if (transaction.status_transaksi === 'dibatalkan') {
          doc.setTextColor(220, 53, 69)
          doc.text('Batal', cols.status.x + 2, yPos + 6)
        }
        
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'normal')
        yPos += 15 // Extra space untuk multi-line
      })
      
      // Final footer
      doc.setFontSize(8)
      doc.setTextColor(128, 128, 128)
      doc.text("DWash Laundry - Laporan Transaksi Cabang", 20, 285)
      doc.text(`Halaman ${currentPage}`, 350, 285)
    }

    // Generate PDF
    drawHeader()
    let currentY = drawStats()
    drawTable(currentY)

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    // Build filename with filters
    let filename = `Laporan_Transaksi_${branch.nama_cabang.replace(/\s+/g, '_')}`

    // Add date range if provided
    if (dateFrom && dateTo) {
      if (dateFrom === dateTo) {
        filename += `_${dateFrom}`
      } else {
        filename += `_${dateFrom}_sd_${dateTo}`
      }
    } else if (dateFrom) {
      filename += `_dari_${dateFrom}`
    } else if (dateTo) {
      filename += `_sampai_${dateTo}`
    }

    // Add payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      filename += `_${paymentMethod}`
    }

    // Add status filter
    if (status && status !== 'all') {
      filename += `_${status}`
    }

    // Add search filter
    if (search) {
      filename += `_search_${search.replace(/\s+/g, '_')}`
    }

    filename += '.pdf'

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('Branch PDF report error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}