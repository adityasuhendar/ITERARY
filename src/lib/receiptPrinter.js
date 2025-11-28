// Shared Receipt Printer Utility
// Konsisten untuk semua lokasi: TransactionForm, KasirDashboard, TransactionDetailModal

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

export const formatDateThermal = (dateString) => {
  return new Date(dateString).toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const printReceipt = async (transaction) => {
  try {
    
    let transactionData = transaction
    
    // Jika tidak ada detail services/products, fetch dari API
    const hasServiceDetails = transaction.services && transaction.services.length > 0
    const hasProductDetails = transaction.products && transaction.products.length > 0
    
    if (!hasServiceDetails && !hasProductDetails && transaction.id_transaksi) {
      try {
        const response = await fetch(`/api/transactions/${transaction.id_transaksi}`)
        if (response.ok) {
          const detailData = await response.json()
          transactionData = detailData
        }
      } catch (fetchError) {
        // Continue with original data
      }
    }
    
    // Direct print dialog
    const printWindow = window.open('', '_blank')
    
    if (!printWindow) {
      alert('❌ Popup diblokir! Mohon izinkan popup untuk mencetak receipt.')
      return
    }
    
    const receiptHTML = generateReceiptHTML(transactionData)
    const thermalCSS = getThermalCSS()
    
    try {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt - ${transactionData.kode_transaksi}</title>
            <style>${thermalCSS}</style>
          </head>
          <body>
            ${receiptHTML}
            <script>
              window.onload = function() {
                setTimeout(() => {
                  window.print()
                  setTimeout(() => window.close(), 1000)
                }, 500)
              }
            </script>
          </body>
        </html>
      `)
      
      printWindow.document.close()
      printWindow.focus()
      
    } catch (writeError) {
      console.error('Error writing to print window:', writeError)
      printWindow.close()
      alert('❌ Gagal membuka print dialog. Coba lagi.')
    }
    
  } catch (error) {
    console.error('Print error:', error)
    alert('❌ Gagal mencetak receipt: ' + error.message)
  }
}

const generateReceiptHTML = (transaction) => {
  // Get services and products from different possible sources with correct field names
  const services = transaction.services || 
                  transaction.detail_layanan || 
                  transaction.layanan || 
                  []
                  
  const products = transaction.products || 
                  transaction.detail_produk || 
                  []

  
  let itemsHTML = ''
  let subtotal = 0
  let hasFreeService = false
  let loyaltySavings = 0
  
  // Add services - consolidate similar services
  if (services.length > 0) {
    itemsHTML += `<div class="section-title">LAYANAN:</div>`
    
    // Group services by name and free status
    const serviceGroups = services.reduce((groups, item) => {
      const serviceName = item.nama_layanan || 'Layanan Laundry'
      const isFreeService = item.isFree || item.freeCount > 0
      const groupKey = `${serviceName}_${isFreeService ? 'free' : 'paid'}`
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          name: serviceName,
          duration: item.durasi_menit || '',
          isFree: isFreeService,
          quantity: 0,
          total: 0
        }
      }
      
      groups[groupKey].quantity += (item.quantity || 1)
      groups[groupKey].total += parseFloat(item.subtotal || 0) || 0
      return groups
    }, {})
    
    // Display consolidated services with loyalty breakdown
    Object.values(serviceGroups).forEach(group => {
      let serviceDesc = group.name
      if (group.duration) serviceDesc += ` (${group.duration} menit)`
      
      if (group.isFree) {
        // All free services
        hasFreeService = true
        loyaltySavings += 10000 * group.quantity // Standard cuci price per quantity
        itemsHTML += `
          <div class="row">
            <span>${serviceDesc} x${group.quantity}</span>
            <span>GRATIS 🎉</span>
          </div>
          <div class="small">  (Loyalty - Cuci Gratis)</div>
        `
      } else {
        // Check if this service has mixed paid/free based on price difference
        const standardPrice = 10000 // Standard cuci price
        const totalValueAtStandardPrice = group.quantity * standardPrice
        
        if (group.total < totalValueAtStandardPrice && group.total > 0) {
          // Mixed paid/free services
          const savings = totalValueAtStandardPrice - group.total
          const estimatedFreeQty = Math.round(savings / standardPrice)
          const paidQty = group.quantity - estimatedFreeQty
          
          if (paidQty > 0) {
            // Show paid portion
            itemsHTML += `
              <div class="row">
                <span>${serviceDesc} x${paidQty}</span>
                <span>${formatCurrency(group.total)}</span>
              </div>
            `
          }
          
          if (estimatedFreeQty > 0) {
            // Show free portion
            hasFreeService = true
            loyaltySavings += standardPrice * estimatedFreeQty
            itemsHTML += `
              <div class="row">
                <span>${serviceDesc} x${estimatedFreeQty}</span>
                <span>GRATIS 🎉</span>
              </div>
              <div class="small">  (Loyalty - Cuci Gratis)</div>
            `
          }
        } else {
          // All paid services
          itemsHTML += `
            <div class="row">
              <span>${serviceDesc} x${group.quantity}</span>
              <span>${formatCurrency(group.total)}</span>
            </div>
          `
        }
        
        subtotal += group.total
      }
    })
  }
  
  // Add products - handle free products properly
  if (products.length > 0) {
    if (services.length > 0) itemsHTML += `<div class="spacer"></div>`
    itemsHTML += `<div class="section-title">PRODUK TAMBAHAN:</div>`
    
    products.forEach(item => {
      const productName = item.nama_produk || 'Produk'
      const quantity = item.quantity || 1
      const unit = item.satuan || 'pcs'
      const unitPrice = parseFloat(item.harga_satuan || 0) || 0
      const productTotal = parseFloat(item.subtotal || 0) || 0
      const freeQuantity = item.free_quantity || 0
      const isFreePromo = item.is_free_promo === 1 || item.is_free_promo === true
      
      // Calculate if this has free products based on price difference
      const fullPrice = unitPrice * quantity
      const hasDiscount = productTotal < fullPrice && productTotal >= 0
      
      if (hasDiscount && unitPrice > 0) {
        // Calculate estimated free and paid quantities based on price difference
        const savings = fullPrice - productTotal
        const estimatedFreeQty = Math.round(savings / unitPrice)
        const paidQty = quantity - estimatedFreeQty
        
        if (paidQty > 0) {
          // Show paid portion
          itemsHTML += `
            <div class="row">
              <span>${productName} x${paidQty} ${unit}</span>
              <span>${formatCurrency(productTotal)}</span>
            </div>
          `
        }
        
        if (estimatedFreeQty > 0) {
          // Show free portion
          itemsHTML += `
            <div class="row">
              <span>${productName} x${estimatedFreeQty} ${unit}</span>
              <span>GRATIS 🎉</span>
            </div>
          `
        }
        
        itemsHTML += `<div class="small">  @ ${formatCurrency(unitPrice)} per ${unit}</div>`
      } else {
        // No discount or full price
        itemsHTML += `
          <div class="row">
            <span>${productName} x${quantity} ${unit}</span>
            <span>${formatCurrency(productTotal)}</span>
          </div>
          <div class="small">  @ ${formatCurrency(unitPrice)} per ${unit}</div>
        `
      }
      
      subtotal += productTotal
    })
  }
  
  // Jika tidak ada detail service/product, coba fetch dari API
  if (!services.length && !products.length) {
    console.log('⚠️ No service/product details - need to fetch from transaction API')
    itemsHTML = `
      <div class="section-title">TRANSAKSI:</div>
      <div class="row">
        <span>Detail tidak tersedia</span>
        <span>${formatCurrency(transaction.total_keseluruhan || 0)}</span>
      </div>
      <div class="small">  (Gunakan transaksi history untuk detail lengkap)</div>
    `
    subtotal = transaction.total_keseluruhan || 0
  }
  
  return `
    <div class="center bold big">DWASH LAUNDRY</div>
    <div class="center small">${transaction.nama_cabang || 'Cabang Utama'}</div>
    <div class="center small">Self Service Laundry</div>
    <div class="line"></div>
    
    <div class="space">
      <div class="row">
        <span>No. Transaksi:</span>
        <span class="bold">${transaction.kode_transaksi}</span>
      </div>
      <div class="row">
        <span>Tanggal:</span>
        <span>${formatDateThermal(transaction.tanggal_transaksi)}</span>
      </div>
      <div class="row">
        <span>Pelanggan:</span>
        <span>${transaction.nama_pelanggan}</span>
      </div>
      <div class="row">
        <span>Kasir:</span>
        <span>${transaction.nama_pekerja_aktual || transaction.nama_karyawan || transaction.kasir || 'Admin'}</span>
      </div>
    </div>
    
    <div class="line"></div>
    
    <div class="space">
      ${itemsHTML}
    </div>
    
    <div class="line"></div>
    
    ${transaction.biaya_tambahan > 0 ? `
      <div class="row">
        <span>Biaya Tambahan:</span>
        <span>${formatCurrency(transaction.biaya_tambahan)}</span>
      </div>
    ` : ''}
    
    ${transaction.diskon > 0 ? `
      <div class="row">
        <span>Diskon:</span>
        <span>-${formatCurrency(transaction.diskon)}</span>
      </div>
    ` : ''}
    
    <div class="row total-row big">
      <span>TOTAL:</span>
      <span>${formatCurrency(transaction.total_keseluruhan || 0)}</span>
    </div>
    
    <div class="row">
      <span>Pembayaran:</span>
      <span class="bold">${transaction.metode_pembayaran?.toUpperCase() || 'CASH'}</span>
    </div>
    
    ${transaction.status_pembayaran === 'pending' ? `
      <div class="center bold" style="margin: 5px 0;">** BELUM LUNAS **</div>
    ` : ''}
    
    ${hasFreeService ? `
      <div class="line"></div>
      <div class="center small space" style="background: #f0f9ff; padding: 6px; border-radius: 6px; margin: 8px 0;">
        <div class="bold" style="color: #0066cc;">🎉 Selamat! Anda hemat ${formatCurrency(loyaltySavings)} hari ini!</div>
        <div style="color: #0066cc; margin-top: 2px;">
          ${transaction.remaining_free_washes !== undefined ? 
            `Sisa cuci gratis: ${transaction.remaining_free_washes}` : 
            'Terima kasih telah menggunakan loyalty points'}
        </div>
      </div>
    ` : ''}
    
    <div class="line"></div>
    
    <div class="center small space">
      <div>Terima kasih telah menggunakan</div>
      <div>layanan DWash Laundry!</div>
      <div class="space">Simpan nota ini sebagai</div>
      <div>bukti transaksi Anda</div>
    </div>
    
    <div class="center small space" style="margin-top: 8px;">
      <div>Dicetak: ${new Date().toLocaleString('id-ID')}</div>
    </div>
  `
}

const getThermalCSS = () => {
  return `
    @page { 
      size: 80mm auto; 
      margin: 0; 
    }
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.3;
      width: 80mm;
      padding: 3mm;
      background: white;
      color: black;
    }
    .center { 
      text-align: center; 
    }
    .bold { 
      font-weight: bold; 
    }
    .line { 
      border-bottom: 1px dashed #333; 
      margin: 3px 0; 
    }
    .space { 
      margin: 4px 0; 
    }
    .big { 
      font-size: 14px; 
      font-weight: bold;
    }
    .small { 
      font-size: 10px; 
      color: #666;
      margin-left: 8px;
    }
    .section-title {
      font-size: 11px;
      font-weight: bold;
      margin: 4px 0 2px 0;
      color: #333;
    }
    .spacer {
      margin: 6px 0;
    }
    .row { 
      display: flex; 
      justify-content: space-between; 
      margin: 1px 0;
    }
    .total-row { 
      border-top: 1px solid #333;
      border-bottom: 1px solid #333;
      padding: 3px 0;
      margin: 3px 0;
      font-weight: bold;
      font-size: 13px;
    }
    @media print {
      body { 
        -webkit-print-color-adjust: exact; 
      }
    }
  `
}