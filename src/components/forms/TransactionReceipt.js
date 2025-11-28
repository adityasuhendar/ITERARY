"use client"
import { useState, useEffect, useRef } from 'react'
import Button from '@/components/ui/Button'
import { formatCurrency, formatDate, formatDateThermal, formatCurrentDateTime, formatDateOnly, formatTimeOnly, formatDateThermalOnly, formatTimeThermalOnly } from '@/lib/formatters'
import toast, { Toaster } from 'react-hot-toast'

// Receipt Component
export default function TransactionReceipt({ transaction, onClose, onPrint, isDraft = false, services = [], products = [], loyaltyData = null, hideButtons = false }) {
  const [sendingWA, setSendingWA] = useState(false)
  const [showWASuccessModal, setShowWASuccessModal] = useState(false)
  const [waSuccessData, setWASuccessData] = useState(null)

  const handleSendWhatsApp = async () => {
    if (sendingWA) return

    setSendingWA(true)
    try {
      console.log('📱 Sending WhatsApp receipt for transaction:', transaction.kode_transaksi)
      console.log('🔍 Loyalty data being sent to WhatsApp API:', loyaltyData)
      console.log('🔍 Services data being sent:', services)

      const response = await fetch('/api/fonnte/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction: transaction,
          services: services || [],
          products: products || [],
          loyaltyData: loyaltyData || null
        })
      })

      const result = await response.json()

      if (result.success) {
        console.log('✅ WhatsApp receipt sent successfully to:', result.phone)
        setWASuccessData({
          phone: result.phone,
          transactionCode: transaction.kode_transaksi
        })
        setShowWASuccessModal(true)
      } else {
        console.warn('⚠️ WhatsApp receipt failed:', result.error)
        toast.error(result.error, {
          duration: 4000,
          position: 'top-center',
        })
      }
    } catch (error) {
      console.error('❌ WhatsApp receipt API error:', error)
      toast.error(`Gagal mengirim struk WhatsApp: ${error.message}`, {
        duration: 4000,
        position: 'top-center',
      })
    } finally {
      setSendingWA(false)
    }
  }

  const handleThermalPrint = async (transaction, paperSize = '80mm') => {
    // --- [ENHANCED VERSION] CROSS-DEVICE BLUETOOTH PRINTING ---
    if (!('bluetooth' in navigator)) {
      alert('L Web Bluetooth tidak didukung di browser ini.\nGunakan Chrome, Edge, atau Opera terbaru.');
      return;
    }

    try {
      console.log(`=
 Mencari thermal printer untuk kertas ${paperSize}...`);
      
      // Show loading notification
      const notification = document.createElement('div');
      notification.id = 'print-notification';
      notification.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: #3B82F6; color: white; padding: 12px 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; font-family: system-ui; font-size: 14px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 16px; height: 16px; border: 2px solid white; border-top: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <span>Menghubungkan ke printer ${paperSize}...</span>
          </div>
        </div>
        <style>
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      `;
      document.body.appendChild(notification);
      
      // Simple device selection - works on all browsers with Web Bluetooth
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Your working service
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e', 
          '0000ffe0-0000-1000-8000-00805f9b34fb'
        ]
      });

      // Update notification
      notification.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: #3B82F6; color: white; padding: 12px 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; font-family: system-ui; font-size: 14px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 16px; height: 16px; border: 2px solid white; border-top: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <span>Terhubung ke ${device.name || 'Printer'}...</span>
          </div>
        </div>
      `;

      // Connect to the device
      console.log(`=� Found: ${device.name || 'Unknown Device'}, connecting...`);
      const server = await device.gatt.connect();
      console.log(' Connected to printer, finding service...');

      const commonServiceUuids = [
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Standard thermal printer service
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service  
        '0000ffe0-0000-1000-8000-00805f9b34fb', // Common BLE serial service
        '000018f0-0000-1000-8000-00805f9b34fb'  // Alternative service
      ];

      let printerService = null;
      for (const uuid of commonServiceUuids) {
        try {
          const service = await server.getPrimaryService(uuid);
          console.log(` Service yang cocok ditemukan: ${uuid}`);
          printerService = service;
          break; 
        } catch (error) {
          console.log(`Service ${uuid} tidak ditemukan, mencoba selanjutnya...`);
        }
      }

      if (!printerService) {
        throw new Error('Tidak ada service yang kompatibel ditemukan.');
      }

      const characteristics = await printerService.getCharacteristics();
      console.log('Available characteristics:', characteristics.map(c => c.uuid));
      
      // Try specific thermal printer characteristic first
      let writableCharacteristic = characteristics.find(c => 
        c.uuid === '49535343-8841-43f4-a8d4-ecbe34729bb3' || // Standard thermal printer write characteristic
        c.uuid === '6e400002-b5a3-f393-e0a9-e50e24dcca9e' || // Nordic UART TX
        c.uuid === '0000ffe1-0000-1000-8000-00805f9b34fb'    // Common BLE write characteristic
      );
      
      // Fallback to any writable characteristic
      if (!writableCharacteristic) {
        writableCharacteristic = characteristics.find(
          c => c.properties.write || c.properties.writeWithoutResponse
        );
      }

      if (!writableCharacteristic) {
        throw new Error('Tidak ada characteristic yang bisa untuk menulis data.');
      }
      
      console.log('Using characteristic:', writableCharacteristic.uuid);

      // Update notification to show printing progress
      notification.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: #3B82F6; color: white; padding: 12px 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; font-family: system-ui; font-size: 14px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 16px; height: 16px; border: 2px solid white; border-top: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <span>Mencetak struk ${paperSize}...</span>
          </div>
        </div>
      `;

      console.log('=� Printing...');
      const escposData = generateESCPOS(transaction, paperSize, services, products, loyaltyData);
      console.log('ESC/POS Data Length:', escposData.length);
      
      const encoder = new TextEncoder();
      const data = encoder.encode(escposData);
      console.log('Encoded data length:', data.length);

      // --- STABLE DATA TRANSMISSION LOGIC ---
      const chunkSize = 20; // Send in very small chunks
      let totalSent = 0;
      
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.subarray(i, i + chunkSize);
        
        try {
          if (writableCharacteristic.properties.writeWithoutResponse) {
            await writableCharacteristic.writeValueWithoutResponse(chunk);
          } else {
            await writableCharacteristic.writeValue(chunk);
          }
          totalSent += chunk.length;
          
          // Update progress in notification
          const progress = Math.round((totalSent / data.length) * 100);
          if (totalSent % 200 === 0) {
            notification.innerHTML = `
              <div style="position: fixed; top: 20px; right: 20px; background: #3B82F6; color: white; padding: 12px 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; font-family: system-ui; font-size: 14px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div style="width: 16px; height: 16px; border: 2px solid white; border-top: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                  <span>Mencetak... ${progress}%</span>
                </div>
              </div>
            `;
          }
        } catch (writeError) {
          console.error('Write error at chunk:', i, writeError);
          throw writeError;
        }
        
        // Add a small delay between chunks to prevent buffer overflow
        await new Promise(resolve => setTimeout(resolve, 40));
      }
      
      console.log(` All data sent: ${totalSent} bytes`);
      // --- END OF STABLE LOGIC ---

      // Show success notification
      notification.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: #10B981; color: white; padding: 12px 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; font-family: system-ui; font-size: 14px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="font-size: 16px;"></div>
            <span>Struk ${paperSize} berhasil dicetak!</span>
          </div>
        </div>
      `;
      
      // Remove notification after 3 seconds
      setTimeout(() => {
        const notif = document.getElementById('print-notification');
        if (notif) notif.remove();
      }, 3000);

      console.log(' Print completed!');
      // Keep connection alive for next print
      // await device.gatt.disconnect();

    } catch (error) {
      // Show error notification
      const notification = document.getElementById('print-notification');
      if (notification) {
        notification.innerHTML = `
          <div style="position: fixed; top: 20px; right: 20px; background: #EF4444; color: white; padding: 12px 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; font-family: system-ui; font-size: 14px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="font-size: 16px;">L</div>
              <span>Gagal mencetak: ${error.message}</span>
            </div>
          </div>
        `;
        
        setTimeout(() => {
          const notif = document.getElementById('print-notification');
          if (notif) notif.remove();
        }, 5000);
      }
      
      console.error('Print error:', error);
      alert(`L Gagal mencetak struk ${paperSize}:\n${error.message}\n\nPastikan:\n1. Printer thermal sudah menyala\n2. Bluetooth sudah aktif\n3. Printer sudah di-pair dengan device ini`);
    }
  }

  // Simple currency formatter for thermal printing
  const formatThermalCurrency = (amount) => {
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(amount)
  }

  // Generate QR Code for ESC/POS printing
  const generateQRCodeESCPOS = (text) => {
    const GS = String.fromCharCode(29)
    
    // ESC/POS QR Code commands
    let qrCommands = ''
    
    // Set QR Code model (Model 2)
    qrCommands += GS + '(k' + String.fromCharCode(4, 0) + String.fromCharCode(49, 65) + String.fromCharCode(50, 0)
    
    // Set QR Code size (module size)
    qrCommands += GS + '(k' + String.fromCharCode(3, 0) + String.fromCharCode(49, 67) + String.fromCharCode(3) // Size 3
    
    // Set error correction level (Level M - 15%)
    qrCommands += GS + '(k' + String.fromCharCode(3, 0) + String.fromCharCode(49, 69) + String.fromCharCode(49)
    
    // Store QR Code data
    const dataLength = text.length
    const pL = dataLength % 256
    const pH = Math.floor(dataLength / 256)
    qrCommands += GS + '(k' + String.fromCharCode(pL + 3, pH) + String.fromCharCode(49, 80, 48) + text
    
    // Print QR Code
    qrCommands += GS + '(k' + String.fromCharCode(3, 0) + String.fromCharCode(49, 81, 48)
    
    return qrCommands
  }

  const generateESCPOS = (transaction, paperSize, services = [], products = [], loyaltyData = null) => {
    const ESC = String.fromCharCode(27)
    const GS = String.fromCharCode(29)
    const width = paperSize === '58mm' ? 32 : 42
    
    let escpos = ''
    
    // =% PROPER ESC/POS INITIALIZATION - FIXED
    escpos += ESC + '@' // Initialize printer
    escpos += ESC + 'R' + String.fromCharCode(0) // Set international character set
    escpos += ESC + 'M' + String.fromCharCode(0) // Select character font A
    escpos += ESC + '2' // Use default line spacing (adaptive per printer)
    
    // HEADER - Center aligned
    escpos += ESC + 'a' + String.fromCharCode(1) // Center align
    escpos += ESC + '!' + String.fromCharCode(16) // Double height
    escpos += "DWASH LAUNDRY\n"
    escpos += ESC + '!' + String.fromCharCode(0) // Normal size
    escpos += (transaction.nama_cabang || 'Self Service Laundry') + '\n'
    escpos += 'Self Service Laundry\n'
    escpos += '='.repeat(width) + '\n'
    
    // TRANSACTION INFO - Left aligned
    escpos += ESC + 'a' + String.fromCharCode(0) // Left align
    escpos += `No: ${transaction.kode_transaksi}\n`
    escpos += `Tgl: ${formatDateThermalOnly(transaction.tanggal_transaksi)}\n`
    escpos += `Pukul: ${formatTimeThermalOnly(transaction.tanggal_transaksi)}\n`
    escpos += `Customer: ${transaction.nama_pelanggan}\n`
    escpos += `Kasir: ${transaction.nama_pekerja_aktual || transaction.active_worker_name || transaction.nama_karyawan || 'System'}\n`
    escpos += '-'.repeat(width) + '\n'
    
    // DEBUG: Log transaction data to understand structure
    console.log('= Transaction data for printing:', transaction)
    console.log('= Services passed to print:', services)
    console.log('= Products passed to print:', products)
    
    // Initialize service counters at function level for scope access
    let cuciDetails = { count: 0, total: 0 }
    let keringDetails = { count: 0, total: 0 }
    let otherServices = []

    // SERVICES SECTION - DETAILED BREAKDOWN
    // Use passed services parameter, fallback to transaction data
    const serviceData = services || transaction.services || transaction.detail_layanan || []
    const productData = products || transaction.products || transaction.detail_produk || []
    
    console.log('= Services array:', serviceData)
    console.log('= Products array:', productData)
    console.log('🔍 DETAILED PRODUCTS DEBUG:')
    console.log('🔍 DATA SOURCE - products param:', products ? 'FROM_CALLER' : 'NULL')
    console.log('🔍 DATA SOURCE - transaction.products:', transaction.products ? 'FROM_TRANSACTION' : 'NULL')
    console.log('🔍 DATA SOURCE - transaction.detail_produk:', transaction.detail_produk ? 'FROM_DETAIL' : 'NULL')

    productData.forEach((product, index) => {
      console.log(`Product ${index + 1}:`, {
        nama_produk: product.nama_produk,
        quantity: product.quantity,
        harga_satuan: product.harga_satuan,
        subtotal: product.subtotal,
        isFree: product.isFree,
        freeQuantity: product.freeQuantity,
        paidQuantity: product.paidQuantity,
        dataSource: products ? 'FROM_CALLER' : (transaction.products ? 'FROM_TRANSACTION' : 'FROM_DETAIL')
      })
    })

    if (serviceData && serviceData.length > 0) {
      console.log('= Processing services...')
      // Count different service types and their actual prices
      // Move to function level scope
      cuciDetails = { count: 0, total: 0 }
      keringDetails = { count: 0, total: 0 }
      otherServices = []
      
      serviceData.forEach(service => {
        console.log('= Processing service:', service)
        const serviceName = (service.nama_layanan || service.nama_jenis_layanan || service.layanan || '').toLowerCase()
        const quantity = service.quantity || service.qty || 1
        const freeCount = service.freeCount || 0
        const paidCount = service.paidCount || (quantity - freeCount)
        const subtotal = parseFloat(service.subtotal || service.total || service.harga || (service.harga * paidCount) || 0)
        const isFreeService = service.isFree || freeCount > 0
        
        console.log(`= Service: ${serviceName}, Total Qty: ${quantity}, Free: ${freeCount}, Paid: ${paidCount}, Subtotal: ${subtotal}, isFree: ${isFreeService}`)
        
        if (serviceName.includes('cuci')) {
          cuciDetails.count += quantity
          const serviceHarga = parseFloat(service.harga_satuan || service.harga) || 0
          cuciDetails.total += serviceHarga * paidCount
          // Track free cuci separately
          if (freeCount > 0) {
            cuciDetails.freeCount = (cuciDetails.freeCount || 0) + freeCount
            cuciDetails.paidCount = (cuciDetails.paidCount || 0) + paidCount
          } else {
            cuciDetails.paidCount = (cuciDetails.paidCount || 0) + quantity
          }
        } else if (serviceName.includes('kering') || serviceName.includes('pengering')) {
          keringDetails.count += quantity
          const serviceHarga = parseFloat(service.harga_satuan || service.harga) || 0
          keringDetails.total += serviceHarga * paidCount
        } else {
          const serviceHarga = parseFloat(service.harga_satuan || service.harga) || 0
          otherServices.push({
            name: service.nama_layanan || service.nama_jenis_layanan || service.layanan || 'Layanan',
            quantity: quantity,
            price: serviceHarga * paidCount,
            freeCount: freeCount,
            paidCount: paidCount
          })
        }
      })
      
      escpos += 'LAYANAN:\n'
      escpos += '-'.repeat(width) + '\n'
      
      // Display service summary with free/paid breakdown
      if (cuciDetails.count > 0) {
        if (cuciDetails.paidCount > 0) {
          const itemLine = `Cuci x${cuciDetails.paidCount}`
          const priceText = formatThermalCurrency(cuciDetails.total)
          const spacing = Math.max(1, width - itemLine.length - priceText.length)
          escpos += itemLine + ' '.repeat(spacing) + priceText + '\n'
        }
        
        if (cuciDetails.freeCount > 0) {
          const freeItemLine = `Cuci x${cuciDetails.freeCount}`
          const freeText = 'GRATIS'
          const freeSpacing = Math.max(1, width - freeItemLine.length - freeText.length)
          escpos += freeItemLine + ' '.repeat(freeSpacing) + freeText + '\n'
        }
      }
      
      if (keringDetails.count > 0) {
        const itemLine = `Kering x${keringDetails.count}`
        const priceText = formatThermalCurrency(keringDetails.total)
        const spacing = Math.max(1, width - itemLine.length - priceText.length)
        escpos += itemLine + ' '.repeat(spacing) + priceText + '\n'
      }
      
      // Display other services with free/paid breakdown
      otherServices.forEach(service => {
        if (service.paidCount > 0) {
          const itemLine = `${service.name} x${service.paidCount}`
          const priceText = formatThermalCurrency(service.price)
          const spacing = Math.max(1, width - itemLine.length - priceText.length)
          escpos += itemLine + ' '.repeat(spacing) + priceText + '\n'
        }
        
        if (service.freeCount > 0) {
          const freeItemLine = `${service.name} x${service.freeCount}`
          const freeText = 'GRATIS'
          const freeSpacing = Math.max(1, width - freeItemLine.length - freeText.length)
          escpos += freeItemLine + ' '.repeat(freeSpacing) + freeText + '\n'
        }
      })
      
      // Calculate total layanan from displayed service totals
      const calculatedTotalLayanan = cuciDetails.total + keringDetails.total + otherServices.reduce((sum, svc) => sum + svc.price, 0)
      const totalLayananText = `Subtotal Layanan:`
      const totalLayananPrice = formatThermalCurrency(calculatedTotalLayanan)
      const layananSpacing = Math.max(1, width - totalLayananText.length - totalLayananPrice.length)
      escpos += '-'.repeat(width) + '\n'
      escpos += totalLayananText + ' '.repeat(layananSpacing) + totalLayananPrice + '\n'
    }
    
    // PRODUCTS SECTION - DETAILED
    if (productData && productData.length > 0) {
      console.log('= Processing products...')
      escpos += '\nPRODUK TAMBAHAN:\n'
      escpos += '-'.repeat(width) + '\n'
      
      productData.forEach(item => {
        console.log('= Processing product:', item)
        const quantity = item.quantity || item.qty || 1
        const freeQuantity = item.freeQuantity || 0
        const unitPrice = parseFloat(item.harga_satuan || item.harga || item.price || 0) || 0
        const subtotal = parseFloat(item.subtotal || 0)
        const paidQuantity = item.paidQuantity !== undefined ? parseInt(item.paidQuantity) : Math.max(0, quantity - freeQuantity)

        const productTotal = unitPrice * paidQuantity
        const productName = (item.nama_produk || item.name || item.produk || 'Produk').substring(0, width - 15)
        const unit = item.satuan || item.unit || 'pcs'
        const isFreeProduct = parseFloat(item.subtotal || 0) === 0
        
        console.log(`= Product: ${productName}, Total Qty: ${quantity}, Free: ${freeQuantity}, Paid: ${paidQuantity}, isFree: ${isFreeProduct}`)
        
        // Display paid quantity if any
        if (paidQuantity > 0) {
          const itemLine = `${productName} x${paidQuantity} ${unit}`
          const priceText = formatThermalCurrency(productTotal)
          const spacing = Math.max(1, width - itemLine.length - priceText.length)
          escpos += itemLine + ' '.repeat(spacing) + priceText + '\n'
          escpos += ` @ ${formatThermalCurrency(unitPrice)} per ${unit}\n`
        }
        
        // Display free quantity if any
        if (freeQuantity > 0) {
          const freeItemLine = `${productName} x${freeQuantity} ${unit}`
          const freeText = 'GRATIS'
          const freeSpacing = Math.max(1, width - freeItemLine.length - freeText.length)
          escpos += freeItemLine + ' '.repeat(freeSpacing) + freeText + '\n'
          escpos += ` @ Gratis (promosi)\n`
        }
        
        // If completely free product (old logic fallback)
        if (isFreeProduct && freeQuantity === 0 && productTotal === 0) {
          const itemLine = `${productName} x${quantity} ${unit}`
          const freeText = 'GRATIS'
          const spacing = Math.max(1, width - itemLine.length - freeText.length)
          escpos += itemLine + ' '.repeat(spacing) + freeText + '\n'
          escpos += ` @ Gratis (promosi)\n`
        }
      })
      
      // Show total produk - calculate from products array
      const calculatedTotalProduk = products.reduce((sum, product) => {
        const harga = parseFloat(product.harga_satuan || product.harga) || 0
        const paidQty = product.paidQuantity !== undefined ? parseInt(product.paidQuantity) : Math.max(0, parseInt(product.quantity) - parseInt(product.freeQuantity || 0))
        return sum + (harga * paidQty)
      }, 0)
      const totalProdukText = `Subtotal Produk:`
      const totalProdukPrice = formatThermalCurrency(calculatedTotalProduk)
      const produkSpacing = Math.max(1, width - totalProdukText.length - totalProdukPrice.length)
      escpos += '-'.repeat(width) + '\n'
      escpos += totalProdukText + ' '.repeat(produkSpacing) + totalProdukPrice + '\n'
    }
    
    // TOTAL SECTION WITH BREAKDOWN
    escpos += '='.repeat(width) + '\n'
    
    // Show breakdown if both services and products exist
    if (services.length > 0 && products.length > 0) {
      // Calculate from displayed service totals
      const calculatedTotalLayanan = cuciDetails.total + keringDetails.total + otherServices.reduce((sum, svc) => sum + svc.price, 0)
      const layananText = `Total Layanan:`
      const layananPrice = formatThermalCurrency(calculatedTotalLayanan)
      const layananSpacing = Math.max(1, width - layananText.length - layananPrice.length)
      escpos += layananText + ' '.repeat(layananSpacing) + layananPrice + '\n'
      
      const calculatedTotalProduk = products.reduce((sum, product) => {
        const harga = parseFloat(product.harga_satuan || product.harga) || 0
        const paidQty = product.paidQuantity !== undefined ? parseInt(product.paidQuantity) : Math.max(0, parseInt(product.quantity) - parseInt(product.freeQuantity || 0))
        return sum + (harga * paidQty)
      }, 0)
      const produkText = `Total Produk:`
      const produkPrice = formatThermalCurrency(calculatedTotalProduk)
      const produkSpacing = Math.max(1, width - produkText.length - produkPrice.length)
      escpos += produkText + ' '.repeat(produkSpacing) + produkPrice + '\n'
      
      escpos += '-'.repeat(width) + '\n'
    }
    
    const totalLabel = 'TOTAL BAYAR:'
    const totalAmount = formatThermalCurrency(parseFloat(transaction.total_keseluruhan || 0))
    const totalSpacing = Math.max(1, width - totalLabel.length - totalAmount.length)
    
    escpos += ESC + '!' + String.fromCharCode(16) // Double height for total
    escpos += totalLabel + ' '.repeat(totalSpacing) + totalAmount + '\n'
    escpos += ESC + '!' + String.fromCharCode(0) // Normal size
    
    // Payment method - center aligned with line break
    const paymentMethod = transaction.metode_pembayaran?.toUpperCase() || 'BELUM BAYAR'
    escpos += '\n' // Extra line break after total
    escpos += ESC + 'a' + String.fromCharCode(1) // Center align
    escpos += `Pembayaran: ${paymentMethod}\n`
    escpos += ESC + 'a' + String.fromCharCode(0) // Back to left align
    
    // NOTES (if any)
    if (transaction.catatan) {
      escpos += '\n' + '-'.repeat(width) + '\n'
      escpos += `Catatan:\n${transaction.catatan}\n`
    }
    
    // FOOTER
    escpos += '='.repeat(width) + '\n'
    
    // LOYALTY PROGRESS MESSAGE
    if (loyaltyData && loyaltyData.loyalty) {
      const loyalty = loyaltyData.loyalty
      escpos += ESC + 'a' + String.fromCharCode(1) // Center align
      
      // Count free services used in current transaction
      const freeServicesUsed = services.filter(service =>
        service.isFree || service.freeCount > 0
      ).reduce((count, service) => count + (service.freeCount || 1), 0)
      
      // Adjust remaining free washes based on current transaction
      const adjustedFreeWashes = Math.max(0, loyalty.remaining_free_washes - freeServicesUsed)
      
      // Show available free washes if any (after adjustment)
      if (adjustedFreeWashes > 0) {
        escpos += `SELAMAT! Anda memiliki ${adjustedFreeWashes} cucian gratis!\n`
        escpos += `Gunakan di transaksi berikutnya\n`
        escpos += '\n'
      }
      
      // Calculate updated progress based on current transaction
      // Count paid cuci services in current transaction
      const paidCuciCount = services.filter(service => {
        const serviceName = (service.nama_layanan || '').toLowerCase()
        return serviceName.includes('cuci')
      }).reduce((count, service) => {
        // For cuci services, count only paid portion
        if (service.paidCount !== undefined) {
          return count + service.paidCount
        }

        // Fallback: if has freeCount, calculate paid as quantity - freeCount
        const quantity = service.quantity || 1
        const freeCount = service.freeCount || 0
        const paidCount = Math.max(0, quantity - freeCount)
        return count + paidCount
      }, 0)

      // Calculate updated total_cuci
      const currentTotalCuci = (loyalty.total_cuci || 0) + paidCuciCount
      const updatedProgress = currentTotalCuci % 10
      const updatedNextFreeIn = updatedProgress === 0 ? 10 : 10 - updatedProgress


      // Show loyalty progress
      if (updatedNextFreeIn > 0 && updatedNextFreeIn <= 10) {
        if (updatedNextFreeIn === 1) {
          escpos += `HEBAT! 1 kali cuci lagi untuk\n`
          escpos += `mendapat cucian GRATIS! (${updatedProgress}/10)\n`
        } else {
          escpos += `${updatedNextFreeIn} kali cuci lagi untuk\n`
          escpos += `mendapat cucian GRATIS! (${updatedProgress}/10)\n`
        }
      }

      escpos += '-'.repeat(width) + '\n'
    }
    
    // QR CODE SECTION
    escpos += ESC + 'a' + String.fromCharCode(1) // Center align
    escpos += 'Scan QR untuk cek status mesin / point:\n'
    escpos += '\n'
    
    // Generate QR Code for website
    const websiteURL = 'https://dwashlaundry.com'
    escpos += generateQRCodeESCPOS(websiteURL)

    escpos += '\n'
    escpos += 'dwashlaundry.com\n'
    escpos += '\n'
    
    escpos += ESC + 'a' + String.fromCharCode(1) // Center align
    escpos += 'Terima kasih telah menggunakan\n'
    escpos += 'layanan DWash Laundry!\n\n'
    // Cut paper - HEMAT KERTAS
    escpos += GS + 'V' + String.fromCharCode(1) // Partial cut (minimal feed)
    
    return escpos
  }

  return (
    <>
      <Toaster />
      <div className="space-y-6">
        {/* Success Message */}
      <div className="text-center">
        <div className={`w-16 h-16 ${isDraft ? 'bg-orange-100' : 'bg-green-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <span className={`${isDraft ? 'text-orange-600' : 'text-green-600'} text-2xl`}>
            {isDraft ? '📝' : '✅'}
          </span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {isDraft ? 'Draft Tersimpan!' : 'Transaksi Berhasil!'}
        </h2>
        <p className="text-gray-600">
          {isDraft 
            ? 'Mesin telah dimulai. Customer bisa bayar nanti di kasir.'
            : 'Transaksi telah dibuat dan disimpan ke sistem'
          }
        </p>
      </div>

      {/* Receipt Details */}
      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <div className="text-center border-b pb-4">
          <h3 className="font-bold text-lg">DWash Laundry</h3>
          <p className="text-sm text-gray-600">{transaction.nama_cabang}</p>
          <p className="text-sm text-gray-600">Self Service Laundry</p>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Kode Transaksi:</span>
            <span className="font-mono font-bold text-right">{transaction.kode_transaksi}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Tanggal:</span>
            <span className="text-right">{formatDateOnly(transaction.tanggal_transaksi)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Pukul:</span>
            <span className="text-right">{formatTimeOnly(transaction.tanggal_transaksi)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Pelanggan:</span>
            <span className="text-right">{transaction.nama_pelanggan}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Pembayaran:</span>
            <span className="uppercase text-right">
              {isDraft ? 'BELUM DIBAYAR' : transaction.metode_pembayaran}
            </span>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="font-bold">Total:</span>
            <span className="font-bold text-lg text-dwash-red">
              {formatCurrency(transaction.total_keseluruhan)}
            </span>
          </div>
        </div>

        <div className="text-center text-xs text-gray-500 border-t pt-4">
          <p>Terima kasih telah menggunakan layanan DWash!</p>
          <p>Simpan nota ini sebagai bukti transaksi</p>
        </div>
      </div>

      {/* Action Buttons */}
      {!hideButtons && !isDraft && (
        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => handleThermalPrint(transaction, '58mm')}
            className="bg-green-50 text-green-700 border-green-300 hover:bg-green-100 py-2 px-3 text-sm"
            title="Cetak dengan kertas thermal 58mm (sempit, hemat kertas)"
          >
            🖨️ Cetak
          </Button>
          <Button
            variant="outline"
            onClick={handleSendWhatsApp}
            disabled={sendingWA || !transaction.nomor_telepon}
            className="bg-pink-50 text-pink-700 border-pink-300 hover:bg-pink-100 disabled:bg-gray-50 disabled:text-gray-400 py-2 px-3 text-sm"
            title={!transaction.nomor_telepon ? "Nomor WhatsApp tidak tersedia" : "Kirim struk digital via WhatsApp"}
          >
            {sendingWA ? '⏳ Mengirim...' : '📱 Kirim WA'}
          </Button>
        </div>
      )}

      {/* WhatsApp Success Modal */}
      {showWASuccessModal && waSuccessData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-green-600 text-3xl">📱</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Struk Berhasil Dikirim!
              </h3>
              <p className="text-gray-600 mb-4">
                Struk transaksi <span className="font-mono font-semibold">{waSuccessData.transactionCode}</span> telah berhasil dikirim ke WhatsApp:
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <p className="text-green-800 font-semibold text-lg">
                  📞 {waSuccessData.phone}
                </p>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Customer akan menerima struk digital lengkap dengan detail transaksi di WhatsApp mereka.
              </p>
              <Button
                onClick={() => setShowWASuccessModal(false)}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                ✅ Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  )
}