import { formatCurrency, formatDateThermal, formatCurrentDateTime } from './formatters'
// Removed: import Printer from 'esc-pos-printer' - not browser compatible

/**
 * Thermal Receipt Printer Utility
 * Complete receipt printing system with multiple formats and platform support
 * Supports 58mm and 80mm thermal printers, mobile/desktop, ESC/POS commands
 */

// Main print handler - detects platform and routes to appropriate method
export const printThermalReceipt = async (transaction, paperSize = '80mm') => {
  try {
    // Fetch detailed data if not available
    let transactionData = transaction
    
    // Check if we have service/product details
    const hasServiceDetails = transaction.services && transaction.services.length > 0
    const hasProductDetails = transaction.products && transaction.products.length > 0
    
    if (!hasServiceDetails && !hasProductDetails && transaction.id_transaksi) {
      try {
        const response = await fetch(`/api/transactions/${transaction.id_transaksi}`)
        if (response.ok) {
          const detailData = await response.json()
          transactionData = { ...transaction, ...detailData }
        }
      } catch (fetchError) {
        console.error('❌ Failed to fetch transaction details:', fetchError)
        // Continue with original data
      }
    }
    
    // Route to platform-specific printer
    await printViaThermalPrinter(transactionData, paperSize)
    
  } catch (error) {
    console.error('Print error:', error)
    alert('❌ Gagal mencetak receipt: ' + error.message)
  }
}

// ESC/POS PRINTER with esc-pos-printer library!
const printViaThermalPrinter = async (transactionData, paperSize = '80mm') => {
  try {
    console.log('🖨️ ESC/POS Thermal Print with library...')
    
    // Try to print directly using the library
    const success = await generateESCPOSWithLibrary(transactionData, paperSize)
    
    if (success) {
      alert('✅ Printed to thermal printer successfully!')
    } else {
      alert('❌ Printer not found or not configured.\n\nPlease install and configure ESC-POS Printer Manager:\nhttps://escpos-printermanager.netlify.app/')
    }
    
  } catch (error) {
    console.error('❌ ESC/POS failed:', error)
    
    // Show helpful error message
    alert(
      '❌ Thermal printing failed!\n\n' +
      'Possible solutions:\n' +
      '• Install ESC-POS Printer Manager\n' + 
      '• Configure your thermal printer\n' +
      '• Check printer connection\n\n' +
      'Visit: https://escpos-printermanager.netlify.app/\n\n' +
      `Error: ${error.message}`
    )
  }
}

// Generate ESC/POS using native Web Bluetooth API - BROWSER COMPATIBLE!
const generateESCPOSWithLibrary = async (transactionData, paperSize) => {
  try {
    // Use Web Bluetooth API for browser compatibility
    console.log('🔄 Using Web Bluetooth API for thermal printing...')
    
    // Generate ESC/POS commands using our custom function
    const escposData = generateESCPOS(transactionData, paperSize)
    
    // Try Bluetooth printing first
    if (navigator.bluetooth) {
      const success = await printViaBluetooth(escposData)
      return success
    }
    
    throw new Error('Bluetooth API not available. Please use a modern browser with Bluetooth support.')
    
  } catch (error) {
    console.error('ESC/POS generation failed:', error)
    throw error
  }
}

// Handle ESC/POS ONLY - NO HTML!
const handleESCPOSOnly = async (escposData, transactionData, paperSize) => {
  const choice = confirm(
    '🖨️ THERMAL PRINTER ESC/POS:\n\n' +
    'OK = Download .pos file for thermal printer\n' +
    'Cancel = Copy ESC/POS data to clipboard\n\n' +
    '⚠️ NO REGULAR PRINTING - ESC/POS ONLY!'
  )
  
  if (choice) {
    // Download ESC/POS file
    const blob = new Blob([escposData], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `thermal-${transactionData.kode_transaksi}.pos`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    alert('📁 ESC/POS file downloaded!\n\nBuka dengan thermal printer software atau kirim ke printer.')
  } else {
    // Copy ESC/POS commands to clipboard
    const escposString = Array.from(new Uint8Array(escposData))
      .map(byte => String.fromCharCode(byte))
      .join('')
    
    await navigator.clipboard.writeText(escposString)
    alert('📋 ESC/POS commands copied!\n\nPaste ke:\n• Thermal printer software\n• Serial terminal\n• POS apps')
  }
}

// Try direct ESC/POS printing using esc-pos-printer library
const tryESCPosThermalPrint = async (transactionData, paperSize) => {
  try {
    // Create ESC/POS printer instance
    const printer = new EscPosPrinter({
      width: paperSize === '58mm' ? 32 : 42,
      characterSet: 'PC437_USA',
      removeSpecialCharacters: false,
      debug: true
    })
    
    // Build receipt using esc-pos-printer methods
    let receiptData = printer
      .init()
      .align('center')
      .size(2, 2)
      .text('DWASH LAUNDRY')
      .size(1, 1)
      .text(transactionData.nama_cabang || 'Self Service Laundry')
      .drawLine()
      .align('left')
      .text(`No: ${transactionData.kode_transaksi}`)
      .text(`Tgl: ${formatDateThermal(transactionData.tanggal_transaksi)}`)
      .text(`Pelanggan: ${transactionData.nama_pelanggan}`)
      .text(`Kasir: ${transactionData.nama_pekerja_aktual || transactionData.active_worker_name || transactionData.nama_karyawan || 'System'}`)
      .drawLine()
    
    // Add services
    const services = transactionData.services || transactionData.detail_layanan || []
    if (services.length > 0) {
      for (const service of services) {
        const serviceName = service.nama_layanan || service.nama_jenis_layanan || 'Layanan'
        const quantity = service.quantity || 1
        const price = service.subtotal || (service.harga_satuan * quantity) || 0
        const priceText = service.isFree || price === 0 ? 'GRATIS' : formatCurrency(price)
        
        receiptData = receiptData
          .tableCustom([
            { text: `${serviceName} x${quantity}`, align: 'LEFT', width: 0.7 },
            { text: priceText, align: 'RIGHT', width: 0.3 }
          ])
      }
    }
    
    // Add products
    const products = transactionData.products || transactionData.detail_produk || []
    if (products.length > 0) {
      for (const product of products) {
        const productName = product.nama_produk || 'Produk'
        const quantity = product.quantity || 1
        const price = product.subtotal || (product.harga_satuan * quantity) || 0
        const priceText = product.isFree || price === 0 ? 'GRATIS' : formatCurrency(price)
        
        receiptData = receiptData
          .tableCustom([
            { text: `${productName} x${quantity}`, align: 'LEFT', width: 0.7 },
            { text: priceText, align: 'RIGHT', width: 0.3 }
          ])
      }
    }
    
    // Add total and footer
    receiptData = receiptData
      .drawLine()
      .size(2, 1)
      .tableCustom([
        { text: 'TOTAL:', align: 'LEFT', width: 0.6, bold: true },
        { text: formatCurrency(transactionData.total_keseluruhan), align: 'RIGHT', width: 0.4, bold: true }
      ])
      .size(1, 1)
      .text(`Bayar: ${transactionData.metode_pembayaran?.toUpperCase() || 'BELUM BAYAR'}`)
    
    if (transactionData.catatan) {
      receiptData = receiptData
        .drawLine()
        .text(`Catatan: ${transactionData.catatan}`)
    }
    
    receiptData = receiptData
      .drawLine()
      .align('center')
      .text('Terima kasih telah menggunakan')
      .text('layanan DWash Laundry!')
      .text('Simpan nota ini sebagai bukti')
    
    if (transactionData.shift_transaksi) {
      receiptData = receiptData.text(`Shift: ${transactionData.shift_transaksi.toUpperCase()}`)
    }
    
    receiptData = receiptData
      .text(`Dicetak: ${formatCurrentDateTime()}`)
      .drawLine()
      .cut('full')
      .cashdraw(2)
    
    // Get ESC/POS commands
    const escposCommands = receiptData.encode()
    
    // Try different methods to send to thermal printer
    if (await sendToThermalPrinter(escposCommands)) {
      alert('✅ Printed successfully to thermal printer!')
      return true
    }
    
    return false
    
  } catch (error) {
    console.error('ESC/POS thermal print failed:', error)
    return false
  }
}

// Send ESC/POS commands to thermal printer
const sendToThermalPrinter = async (escposCommands) => {
  try {
    // Method 1: Try Web Serial API for USB thermal printers
    if (navigator.serial) {
      try {
        const port = await navigator.serial.requestPort({
          filters: [
            { usbVendorId: 0x04b8 }, // Epson
            { usbVendorId: 0x0a2a }, // Star Micronics
            { usbVendorId: 0x0483 }, // STMicroelectronics
            { usbVendorId: 0x1fc9 }, // NXP Semiconductors
          ]
        })
        
        await port.open({ baudRate: 9600 })
        const writer = port.writable.getWriter()
        await writer.write(escposCommands)
        writer.releaseLock()
        await port.close()
        
        return true
      } catch (usbError) {
        console.log('USB printing failed:', usbError)
      }
    }
    
    // Method 2: Try to share/copy ESC/POS data
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
    
    if (isMobile) {
      // Mobile: Try to share ESC/POS file
      const blob = new Blob([escposCommands], { type: 'application/octet-stream' })
      const file = new File([blob], `receipt-${Date.now()}.pos`, { type: 'application/octet-stream' })
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Thermal Receipt',
          text: 'Open with thermal printer app',
          files: [file]
        })
        return true
      }
    }
    
    return false
    
  } catch (error) {
    console.error('Send to thermal printer failed:', error)
    return false
  }
}

// Fallback: Regular print window with thermal formatting
const fallbackThermalPrint = async (transactionData, paperSize) => {
  const thermalText = generatePOSTextReceipt(transactionData, paperSize)
  
  const printWindow = window.open('', '_blank', 'width=320,height=600,scrollbars=no,resizable=no')
  
  if (!printWindow) {
    alert('❌ Popup diblokir! Allow popup dulu ya.')
    return
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Thermal Receipt</title>
        <style>
          @page { 
            size: ${paperSize} auto;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 3mm;
            font-family: 'Courier New', monospace;
            font-size: ${paperSize === '58mm' ? '8px' : '9px'};
            line-height: 1.1;
            color: black;
            background: white;
          }
          .receipt {
            width: 100%;
            white-space: pre-line;
          }
          @media print {
            body { 
              font-size: ${paperSize === '58mm' ? '8px' : '9px'} !important;
              -webkit-print-color-adjust: exact;
            }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align: center; margin-bottom: 10px; padding: 5px; background: #f0f0f0;">
          <strong>🖨️ THERMAL RECEIPT</strong><br>
          <small>Pilih printer thermal atau printer biasa, lalu klik Print</small>
        </div>
        <div class="receipt">${thermalText}</div>
        <script>
          setTimeout(() => {
            window.focus();
            window.print();
          }, 100);
          
          window.onafterprint = function() {
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
    </html>
  `)
  
  printWindow.document.close()
}

// Try direct thermal printing via browser APIs
const tryDirectThermalPrint = async (transactionData, paperSize) => {
  try {
    // Check if we're on mobile with thermal printer apps available
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
    
    if (isMobile) {
      // Generate ESC/POS raw data
      const escposData = generateESCPOS(transactionData, paperSize)
      
      // Try to share ESC/POS data directly to thermal printer apps
      if (navigator.share && navigator.canShare) {
        const blob = new Blob([escposData], { type: 'text/plain' })
        const file = new File([blob], `receipt-${transactionData.kode_transaksi}.txt`, {
          type: 'text/plain'
        })
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Thermal Receipt ${transactionData.kode_transaksi}`,
            text: 'ESC/POS Receipt Data - Open with thermal printer app',
            files: [file]
          })
          alert('✅ ESC/POS data shared! Open with thermal printer app.')
          return true
        }
      }
      
      // Fallback: Copy ESC/POS to clipboard for mobile
      await navigator.clipboard.writeText(escposData)
      alert('📋 ESC/POS data copied!\n\nPaste in thermal printer app:\n• Bluetooth Thermal Printer\n• Thermal Printer Driver\n• POS Printer')
      return true
    }
    
    return false
    
  } catch (error) {
    console.error('Direct thermal print failed:', error)
    return false
  }
}

// Try USB thermal printing via Web Serial API
const tryUSBThermalPrint = async (transactionData, paperSize) => {
  try {
    // Request USB serial port (thermal printers)
    const port = await navigator.serial.requestPort({
      filters: [
        { usbVendorId: 0x04b8 }, // Epson
        { usbVendorId: 0x0a2a }, // Star Micronics  
        { usbVendorId: 0x0483 }, // STMicroelectronics
        { usbVendorId: 0x1fc9 }, // NXP Semiconductors
        { usbVendorId: 0x067b }, // Prolific
      ]
    })
    
    await port.open({
      baudRate: 9600,
      dataBits: 8,
      parity: 'none', 
      stopBits: 1,
      flowControl: 'none'
    })
    
    // Generate ESC/POS commands
    const escposData = generateESCPOS(transactionData, paperSize)
    
    // Convert to bytes and send
    const encoder = new TextEncoder()
    const data = encoder.encode(escposData)
    
    const writer = port.writable.getWriter()
    await writer.write(data)
    writer.releaseLock()
    
    await port.close()
    
    alert('✅ Printed successfully via USB thermal printer!')
    return true
    
  } catch (error) {
    console.error('USB thermal print failed:', error)
    return false
  }
}

// Fallback: Download ESC/POS file or copy to clipboard
const handleESCPOSFallback = async (transactionData, paperSize) => {
  const escposData = generateESCPOS(transactionData, paperSize)
  
  // Show options dialog
  const useDownload = confirm(
    '🖨️ THERMAL PRINTER OPTIONS:\n\n' +
    'OK = Download ESC/POS file for thermal printer\n' +
    'Cancel = Copy ESC/POS data to clipboard\n\n' +
    'Use with thermal printer software or apps'
  )
  
  if (useDownload) {
    // Download ESC/POS file
    const blob = new Blob([escposData], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `thermal-receipt-${transactionData.kode_transaksi}.pos`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    alert('📁 ESC/POS file downloaded!\n\nSend to thermal printer or open with POS software.')
  } else {
    // Copy to clipboard
    await navigator.clipboard.writeText(escposData)
    alert('📋 ESC/POS commands copied!\n\nPaste into:\n• Thermal printer software\n• POS printer apps\n• Serial terminal')
  }
}

// Mobile/PWA printing via share or clipboard
const handleMobilePOSPrint = async (transactionData, paperSize) => {
  try {
    // Generate clean POS text format
    const posText = generatePOSTextReceipt(transactionData, paperSize)
    
    // Try Web Share API first
    if (navigator.share) {
      await navigator.share({
        title: `Receipt ${transactionData.kode_transaksi}`,
        text: posText
      })
    } else {
      // Fallback: Copy to clipboard
      await navigator.clipboard.writeText(posText)
      alert('📋 Receipt copied!\n\nPaste in thermal printer app.')
    }
    
  } catch (error) {
    console.error('Mobile print error:', error)
    // Final fallback: Copy to clipboard
    const posText = generatePOSTextReceipt(transactionData, paperSize)
    await navigator.clipboard.writeText(posText)
    alert('📋 Receipt copied to clipboard!')
  }
}

// USB thermal printing via Web Serial API
const printViaUSB = async (transactionData, paperSize) => {
  try {
    // Request access to serial port
    const port = await navigator.serial.requestPort({
      filters: [
        { usbVendorId: 0x04b8 }, // Epson
        { usbVendorId: 0x0a2a }, // Star Micronics
        { usbVendorId: 0x0421 }, // Nokia/Citizen
        { usbVendorId: 0x0483 }, // STMicroelectronics
      ]
    })
    
    // Open port with correct settings for thermal printers
    await port.open({ 
      baudRate: 9600,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      flowControl: 'none'
    })
    
    // Generate ESC/POS commands
    const escposData = generateESCPOS(transactionData, paperSize)
    
    // Convert string to Uint8Array
    const encoder = new TextEncoder()
    const data = encoder.encode(escposData)
    
    // Send data to printer
    const writer = port.writable.getWriter()
    await writer.write(data)
    writer.releaseLock()
    
    // Close port
    await port.close()
    
    return true
  } catch (error) {
    console.error('USB printing error:', error)
    throw error
  }
}

// Desktop direct print with multiple options
const handleDesktopDirectPrint = async (transactionData, paperSize) => {
  // Show print options dialog
  const choice = confirm(
    '🖨️ THERMAL PRINTER OPTIONS:\n\n' +
    'OK = Try Bluetooth/USB Connection\n' +
    'Cancel = Copy ESC/POS Data to Clipboard\n\n' +
    'For ESC/POS apps like "Bluetooth Thermal Printer"'
  )
  
  if (choice) {
    // User wants direct connection
    try {
      // Try Bluetooth first
      if (navigator.bluetooth) {
        const escposData = generateESCPOS(transactionData, paperSize)
        await printViaBluetooth(escposData)
        alert('✅ Printed via Bluetooth successfully!')
        return
      }
      
      // Try USB if available
      if (navigator.serial) {
        await printViaUSB(transactionData, paperSize)
        alert('✅ Printed via USB successfully!')
        return
      }
      
      throw new Error('No direct printing methods available')
      
    } catch (error) {
      console.error('Direct printing failed:', error)
      // Fallback to clipboard
      const escposData = generateESCPOS(transactionData, paperSize)
      await navigator.clipboard.writeText(escposData)
      alert('📋 Direct printing failed!\n\nESC/POS data copied to clipboard.\nPaste in your thermal printer app.')
    }
  } else {
    // User wants clipboard
    const escposData = generateESCPOS(transactionData, paperSize)
    await navigator.clipboard.writeText(escposData)
    alert('📋 ESC/POS data copied!\n\nPaste into:\n• Bluetooth Thermal Printer\n• POS Printer Driver\n• Any ESC/POS compatible app')
  }
}

// Legacy desktop print function (kept for compatibility)
const handleDesktopPrint = async (transactionData, paperSize) => {
  await handleDesktopDirectPrint(transactionData, paperSize)
}

// Generate HTML receipt and print
const handleDirectThermalPrint = (transactionData, paperSize) => {
  // Generate thermal-optimized text
  const posText = generatePOSTextReceipt(transactionData, paperSize)
  
  // Open print window
  const printWindow = window.open('', '_blank', 'width=400,height=600')
  
  if (!printWindow) {
    alert('❌ Popup blocked! Enable popups and try again.')
    return
  }
  
  // Write thermal-optimized HTML
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${transactionData.kode_transaksi}</title>
        <style>
          @media print {
            @page { 
              size: ${paperSize === '58mm' ? '58mm' : '80mm'} auto; 
              margin: 2mm; 
            }
            body { margin: 0; }
          }
          body {
            font-family: 'Courier New', 'Monaco', monospace;
            font-size: ${paperSize === '58mm' ? '10px' : '11px'};
            line-height: 1.1;
            margin: 0;
            padding: 4px;
            background: white;
            color: black;
            font-weight: bold;
          }
          pre {
            margin: 0;
            font-family: inherit;
            font-size: inherit;
            white-space: pre;
            word-wrap: break-word;
          }
        </style>
      </head>
      <body>
        <pre>${posText}</pre>
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.focus();
              window.print();
              setTimeout(() => window.close(), 1000);
            }, 500);
          }
        </script>
      </body>
    </html>
  `)
  
  printWindow.document.close()
}

// Generate plain text receipt for thermal printers - compatible with Play Store apps
export const generatePOSTextReceipt = (transactionData, paperSize = '80mm') => {
  const width = paperSize === '58mm' ? 32 : 42
  const line = '='.repeat(width)
  const dash = '-'.repeat(width)
  
  let receipt = ''
  
  // Header
  receipt += `${line}\n`
  receipt += `${'DWASH LAUNDRY'.padStart(Math.floor((width + 'DWASH LAUNDRY'.length) / 2))}\n`
  receipt += `${(transactionData.nama_cabang || 'Self Service Laundry').padStart(Math.floor((width + (transactionData.nama_cabang || 'Self Service Laundry').length) / 2))}\n`
  receipt += `${line}\n`
  
  // Transaction info
  receipt += `No: ${transactionData.kode_transaksi}\n`
  receipt += `Tgl: ${formatDateThermal(transactionData.tanggal_transaksi)}\n`
  receipt += `Pelanggan: ${transactionData.nama_pelanggan}\n`
  receipt += `Kasir: ${transactionData.nama_pekerja_aktual || transactionData.active_worker_name || transactionData.nama_karyawan || 'System'}\n`
  receipt += `${dash}\n`
  
  // Services
  const services = transactionData.services || transactionData.detail_layanan || []
  if (services.length > 0) {
    for (const service of services) {
      const serviceName = service.nama_layanan || service.nama_jenis_layanan || 'Layanan'
      const quantity = service.quantity || 1
      const price = service.subtotal || (service.harga_satuan * quantity) || 0
      
      const itemLine = `${serviceName} x${quantity}`
      const priceText = service.isFree || price === 0 ? 'GRATIS' : formatCurrency(price)
      
      if (itemLine.length + priceText.length <= width) {
        receipt += `${itemLine.padEnd(width - priceText.length)}${priceText}\n`
      } else {
        receipt += `${itemLine}\n`
        receipt += `${priceText.padStart(width)}\n`
      }
    }
  }
  
  // Products
  const products = transactionData.products || transactionData.detail_produk || []
  if (products.length > 0) {
    for (const product of products) {
      const productName = product.nama_produk || 'Produk'
      const quantity = product.quantity || 1
      const price = product.subtotal || (product.harga_satuan * quantity) || 0
      
      const itemLine = `${productName} x${quantity}`
      const priceText = product.isFree || price === 0 ? 'GRATIS' : formatCurrency(price)
      
      if (itemLine.length + priceText.length <= width) {
        receipt += `${itemLine.padEnd(width - priceText.length)}${priceText}\n`
      } else {
        receipt += `${itemLine}\n`
        receipt += `${priceText.padStart(width)}\n`
      }
    }
  }
  
  // Total
  receipt += `${dash}\n`
  const totalLine = 'TOTAL:'
  const totalPrice = formatCurrency(transactionData.total_keseluruhan)
  receipt += `${totalLine.padEnd(width - totalPrice.length)}${totalPrice}\n`
  receipt += `Bayar: ${transactionData.metode_pembayaran?.toUpperCase() || 'BELUM BAYAR'}\n`
  
  // Footer
  if (transactionData.catatan) {
    receipt += `${dash}\n`
    receipt += `Catatan: ${transactionData.catatan}\n`
  }
  
  receipt += `${line}\n`
  receipt += `${'Terima kasih telah menggunakan'.padStart(Math.floor((width + 'Terima kasih telah menggunakan'.length) / 2))}\n`
  receipt += `${'layanan DWash Laundry!'.padStart(Math.floor((width + 'layanan DWash Laundry!'.length) / 2))}\n`
  receipt += `${'Simpan nota ini sebagai bukti'.padStart(Math.floor((width + 'Simpan nota ini sebagai bukti'.length) / 2))}\n`
  
  if (transactionData.shift_transaksi) {
    receipt += `\nShift: ${transactionData.shift_transaksi.toUpperCase()}\n`
  }
  
  receipt += `\nDicetak: ${formatCurrentDateTime()}\n`
  receipt += `${line}\n`
  
  return receipt
}

// Generate ESC/POS commands for direct printer communication
export const generateESCPOS = (transaction, paperSize) => {
  const ESC = String.fromCharCode(27)
  const GS = String.fromCharCode(29)
  const width = paperSize === '58mm' ? 32 : 42
  
  let escpos = ''
  
  // Initialize and set high density for better darkness
  escpos += ESC + '@' // Initialize
  escpos += GS + '(' + 'K' + String.fromCharCode(2, 0, 48, 200) // High density
  
  // Header
  escpos += ESC + 'a' + String.fromCharCode(1) // Center align
  escpos += ESC + '!' + String.fromCharCode(16) // Double height
  escpos += "DWASH LAUNDRY\n"
  escpos += ESC + '!' + String.fromCharCode(0) // Normal size
  escpos += (transaction.nama_cabang || 'Self Service Laundry') + '\n'
  escpos += ESC + 'a' + String.fromCharCode(0) // Left align
  escpos += '='.repeat(width) + '\n'
  escpos += `No: ${transaction.kode_transaksi}\n`
  escpos += `Tgl: ${formatDateThermal(transaction.tanggal_transaksi)}\n`
  escpos += `Pelanggan: ${transaction.nama_pelanggan}\n`
  escpos += `Kasir: ${transaction.nama_pekerja_aktual || transaction.active_worker_name || transaction.nama_karyawan || 'System'}\n`
  escpos += '-'.repeat(width) + '\n'
  
  // Services section
  const services = transaction.services || transaction.detail_layanan || []
  const products = transaction.products || transaction.detail_produk || []
  
  if (services.length > 0 || products.length > 0) {
    escpos += '-'.repeat(width) + '\n'
  }
  
  // Process services with consolidation
  const serviceGroups = services.reduce((groups, item) => {
    const serviceName = item.nama_layanan || item.nama_jenis_layanan || 'Layanan'
    const isFreeService = item.isFree || item.freeCount > 0
    const groupKey = `${serviceName}_${isFreeService ? 'free' : 'paid'}`
    const unitPrice = item.harga_satuan || item.harga_layanan || item.harga || 0
    
    if (!groups[groupKey]) {
      groups[groupKey] = {
        name: serviceName,
        isFree: isFreeService,
        quantity: 0,
        unitPrice: unitPrice,
        totalPrice: 0,
        machines: []
      }
    }
    
    groups[groupKey].quantity += (item.quantity || 1)
    groups[groupKey].totalPrice += (item.subtotal || (unitPrice * (item.quantity || 1)))
    if (item.nama_mesin && !groups[groupKey].machines.includes(item.nama_mesin)) {
      groups[groupKey].machines.push(item.nama_mesin)
    }
    return groups
  }, {})
  
  Object.values(serviceGroups).forEach(group => {
    if (paperSize === '58mm') {
      // Compact layout for 58mm
      const serviceName = group.name.length > 16 ? group.name.substring(0, 13) + '...' : group.name
      
      if (group.isFree) {
        escpos += `${serviceName} x${group.quantity}\n`
        escpos += `  GRATIS LOYALTY\n`
      } else {
        // Handle mixed pricing
        const standardPrice = 10000
        const totalValueAtStandardPrice = group.quantity * standardPrice
        
        if (group.totalPrice < totalValueAtStandardPrice && group.totalPrice > 0) {
          const savings = totalValueAtStandardPrice - group.totalPrice
          const estimatedFreeQty = Math.round(savings / standardPrice)
          const paidQty = group.quantity - estimatedFreeQty
          
          if (paidQty > 0) {
            escpos += `${serviceName} x${paidQty}\n`
            escpos += `  ${formatCurrency(group.totalPrice)}\n`
          }
          if (estimatedFreeQty > 0) {
            escpos += `${serviceName} x${estimatedFreeQty}\n`
            escpos += `  GRATIS LOYALTY\n`
          }
        } else {
          escpos += `${serviceName} x${group.quantity}\n`
          escpos += `  ${formatCurrency(group.totalPrice)}\n`
        }
      }
    } else {
      // Column layout for 80mm
      const itemName = group.name.substring(0, Math.floor(width * 0.4) - 1)
      const qtyStr = `${group.quantity}x`
      
      if (group.isFree) {
        const itemLine = itemName.padEnd(Math.floor(width * 0.4)) + 
                        qtyStr.padEnd(4) + 
                        'GRATIS'.padEnd(Math.floor(width * 0.25)) + 
                        'GRATIS'.padStart(Math.floor(width * 0.25))
        escpos += itemLine + '\n'
      } else {
        const unitStr = formatCurrency(group.unitPrice)
        const totalStr = formatCurrency(group.totalPrice)
        
        const itemLine = itemName.padEnd(Math.floor(width * 0.4)) + 
                        qtyStr.padEnd(4) + 
                        unitStr.padEnd(Math.floor(width * 0.25)) + 
                        totalStr.padStart(Math.floor(width * 0.25))
        escpos += itemLine + '\n'
      }
      
      if (group.machines.length > 0) {
        escpos += `  -> Mesin: ${group.machines.join(', ')}\n`
      }
    }
  })
  
  // Process products
  products.forEach(item => {
    const quantity = item.quantity || 1
    const unitPrice = parseFloat(item.harga_satuan || 0) || 0
    const productTotal = parseFloat(item.subtotal || 0) || 0
    const productName = item.nama_produk || 'Produk'
    const unit = item.satuan || 'pcs'
    
    if (paperSize === '58mm') {
      const shortName = productName.length > 14 ? productName.substring(0, 11) + '...' : productName
      
      if (item.isFree || productTotal === 0) {
        escpos += `${shortName} x${quantity} ${unit}\n`
        escpos += `  GRATIS 🎉\n`
      } else if (productTotal < (unitPrice * quantity) && productTotal > 0) {
        // Mixed pricing
        const savings = (unitPrice * quantity) - productTotal
        const estimatedFreeQty = Math.round(savings / unitPrice)
        const paidQty = quantity - estimatedFreeQty
        
        if (paidQty > 0) {
          escpos += `${shortName} x${paidQty} ${unit}\n`
          escpos += `  ${formatCurrency(productTotal)}\n`
        }
        
        if (estimatedFreeQty > 0) {
          escpos += `${shortName} x${estimatedFreeQty} ${unit}\n`
          escpos += `  GRATIS 🎉\n`
        }
        
        escpos += `  @ ${formatCurrency(unitPrice)} per ${unit}\n`
      } else {
        escpos += `${shortName} x${quantity} ${unit}\n`
        escpos += `  ${formatCurrency(productTotal)}\n`
        escpos += `  @ ${formatCurrency(unitPrice)} per ${unit}\n`
      }
    } else {
      // 80mm layout
      const itemName = productName.substring(0, Math.floor(width * 0.4) - 1)
      const qtyStr = `${quantity}x`
      
      if (item.isFree || productTotal === 0) {
        const itemLine = itemName.padEnd(Math.floor(width * 0.4)) + 
                        qtyStr.padEnd(4) + 
                        'GRATIS'.padEnd(Math.floor(width * 0.25)) + 
                        'GRATIS'.padStart(Math.floor(width * 0.25))
        escpos += itemLine + '\n'
      } else {
        const unitStr = formatCurrency(unitPrice)
        const totalStr = formatCurrency(productTotal)
        
        const itemLine = itemName.padEnd(Math.floor(width * 0.4)) + 
                        qtyStr.padEnd(4) + 
                        unitStr.padEnd(Math.floor(width * 0.25)) + 
                        totalStr.padStart(Math.floor(width * 0.25))
        escpos += itemLine + '\n'
      }
    }
  })
  
  // Total section
  escpos += '-'.repeat(width) + '\n'
  escpos += ESC + '!' + String.fromCharCode(16) // Double height for total
  const totalLine = 'TOTAL:'
  const totalPrice = formatCurrency(transaction.total_keseluruhan)
  escpos += `${totalLine.padEnd(width - totalPrice.length)}${totalPrice}\n`
  escpos += ESC + '!' + String.fromCharCode(0) // Normal size
  escpos += `Bayar: ${transaction.metode_pembayaran?.toUpperCase() || 'BELUM BAYAR'}\n`
  
  // Notes
  if (transaction.catatan) {
    escpos += '-'.repeat(width) + '\n'
    escpos += `Catatan: ${transaction.catatan}\n`
  }
  
  // Footer
  escpos += '='.repeat(width) + '\n'
  escpos += ESC + 'a' + String.fromCharCode(1) // Center align
  escpos += 'Terima kasih telah menggunakan\n'
  escpos += 'layanan DWash Laundry!\n'
  escpos += 'Simpan nota ini sebagai bukti\n'
  
  if (transaction.shift_transaksi) {
    escpos += `Shift: ${transaction.shift_transaksi.toUpperCase()}\n`
  }
  
  escpos += `Dicetak: ${formatCurrentDateTime()}\n`
  escpos += '='.repeat(width) + '\n'
  
  // Cut paper
  escpos += GS + 'V' + String.fromCharCode(66, 0) // Partial cut
  
  return escpos
}

// Bluetooth printing (experimental)
export const printViaBluetooth = async (escposData) => {
  try {
    // Request bluetooth device
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { namePrefix: 'MTP' },
        { namePrefix: 'BlueTooth' },
        { namePrefix: 'Thermal' },
        { namePrefix: 'POS' }
      ],
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
    })
    
    // Connect to GATT server
    const server = await device.gatt.connect()
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb')
    const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb')
    
    // Convert ESC/POS string to bytes
    const encoder = new TextEncoder()
    const data = encoder.encode(escposData)
    
    // Send to printer
    await characteristic.writeValue(data)
    
    // Disconnect
    device.gatt.disconnect()
    
  } catch (error) {
    console.error('Bluetooth print error:', error)
    throw error
  }
}

// Generate POS format specifically for Play Store thermal printer apps
export const generatePlayStoreFormat = (transaction, paperSize = '80mm') => {
  // This generates a format optimized for apps like:
  // - Bluetooth Thermal Printer
  // - Thermal Printer Driver
  // - POS Printer Driver
  
  const posText = generatePOSTextReceipt(transaction, paperSize)
  
  // Add ESC/POS commands that are commonly supported
  const ESC = '\x1B'
  const playStoreFormat = `${ESC}@${posText}${ESC}d\x05` // Initialize + content + feed lines
  
  return playStoreFormat
}

// Main export function for easy usage
export const handleThermalPrint = async (transaction, paperSize = '80mm') => {
  return await printThermalReceipt(transaction, paperSize)
}