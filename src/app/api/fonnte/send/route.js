import { NextResponse } from 'next/server'
import { formatCurrency, formatDateWhatsApp } from '@/lib/formatters'

/**
 * Select Fonnte token based on transaction code prefix
 * Cabang Korpri (KP) uses TOKEN_2, others use TOKEN_1
 */
function selectTokenByBranch(transaction) {
  const kodeTransaksi = transaction?.kode_transaksi || ''

  // Extract prefix (2 first letters)
  const prefix = kodeTransaksi.substring(0, 2).toUpperCase()

  // Cabang Korpri (prefix KP) uses Token 2
  if (prefix === 'KP') {
    console.log('🔑 Using FONNTE_TOKEN_2 for branch Korpri (KP)')
    return process.env.FONNTE_TOKEN_2 || process.env.FONNTE_TOKEN_1 || process.env.FONNTE_TOKEN
  }

  // Other branches use Token 1
  console.log(`🔑 Using FONNTE_TOKEN_1 for branch prefix: ${prefix}`)
  return process.env.FONNTE_TOKEN_1 || process.env.FONNTE_TOKEN
}

/**
 * Send WhatsApp message via Fonnte API (server-side only)
 */
async function sendFontteMessage(target, message, options = {}, transaction = null) {
  try {
    console.log('📱 Sending WhatsApp message to:', target)

    // Select token based on branch (if transaction data available)
    const token = transaction
      ? selectTokenByBranch(transaction)
      : (process.env.FONNTE_TOKEN_1 || process.env.FONNTE_TOKEN)

    // Add timeout untuk Fonnte API (10 detik)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target: target,
        message: message,
        countryCode: '62', // Indonesia
        ...options
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    const result = await response.json()

    console.log('🔍 Fonnte API raw response:', {
      status: response.status,
      statusText: response.statusText,
      result: result
    })

    // Handle specific error codes
    if (!response.ok) {
      let errorMessage = 'Sistem WhatsApp sedang bermasalah. Silakan hubungi pihak management.'

      // Log technical details for debugging
      console.error('🔍 Fonnte API technical error:', {
        status: response.status,
        reason: result.reason,
        message: result.message,
        detail: result.detail
      })

      throw new Error(errorMessage)
    }

    // Check if message actually sent
    if (result.status === false || result.detail === 'Pesan tidak terkirim') {
      // Log technical details
      console.error('🔍 Fonnte message not sent:', {
        reason: result.reason,
        message: result.message,
        detail: result.detail
      })

      throw new Error('Sistem WhatsApp sedang bermasalah. Silakan hubungi pihak management.')
    }

    console.log('✅ WhatsApp message sent successfully:', result)
    return { success: true, data: result }

  } catch (error) {
    console.error('❌ Fonnte send message error:', error)

    // Handle network errors
    if (error.name === 'AbortError') {
      console.error('🔍 Fonnte timeout error')
      return {
        success: false,
        error: 'Sistem WhatsApp sedang bermasalah. Silakan hubungi pihak management.'
      }
    }

    if (error.message.includes('fetch') || error.message.includes('network')) {
      console.error('🔍 Fonnte network error:', error)
      return {
        success: false,
        error: 'Sistem WhatsApp sedang bermasalah. Silakan hubungi pihak management.'
      }
    }

    return { success: false, error: error.message }
  }
}

/**
 * Capitalize first letter of each word
 */
function toTitleCase(str) {
  if (!str) return str
  return str.toLowerCase().split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

/**
 * Format loyalty message untuk WhatsApp
 */
function formatLoyaltyMessage(loyalty, services = []) {
  let loyaltyMessage = ''

  // Count free services used in current transaction
  const freeServicesUsed = services.filter(service =>
    service.isFree || service.freeCount > 0
  ).reduce((count, service) => count + (service.freeCount || 1), 0)

  // // Adjust remaining free washes based on current transaction
  // const adjustedFreeWashes = Math.max(0, loyalty.remaining_free_washes - freeServicesUsed)

  // // Show available free washes if any (after adjustment)
  // if (adjustedFreeWashes > 0) {
  //   loyaltyMessage += `Kamu memiliki ${adjustedFreeWashes} cucian gratis!\n\n`
  // }

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

  // Check if customer just earned a new free wash
  const earnedNewFreeWash = paidCuciCount > 0 && updatedProgress === 0

  // COMMENTED OUT: Loyalty progress message tidak ditampilkan di struk WA
  // if (earnedNewFreeWash) {
  //   // Customer just earned a free wash!
  //   loyaltyMessage += `🎉 Selamat! Kamu baru saja mendapat 1 cucian GRATIS!\n`
  // } else if (updatedNextFreeIn > 0 && updatedNextFreeIn <= 10) {
  //   // Show progress to next free wash
  //   if (updatedNextFreeIn === 1) {
  //     loyaltyMessage += `⭐ *HEBAT!* 1 kali cuci lagi untuk mendapat cucian *GRATIS!* (${updatedProgress}/10)\n`
  //   } else {
  //     loyaltyMessage += `💪 ${updatedNextFreeIn} kali cuci lagi untuk mendapat cucian *GRATIS!* (${updatedProgress}/10)\n`
  //   }
  // }

  return loyaltyMessage
}

/**
 * Format transaction receipt untuk WhatsApp
 */
function formatTransactionReceipt(transaction, services = [], products = [], loyaltyData = null) {
  const {
    kode_transaksi,
    tanggal_transaksi,
    total_keseluruhan,
    metode_pembayaran,
    nama_pelanggan,
    nama_cabang
  } = transaction

  // Format services list with free/paid breakdown
  const servicesList = services.length > 0
    ? services.map(service => {
        const quantity = service.quantity || 1
        const freeCount = service.freeCount || 0
        const paidCount = service.paidCount !== undefined ? service.paidCount : Math.max(0, quantity - freeCount)
        const unitPrice = parseFloat(service.harga_satuan || service.harga) || 0
        const serviceName = service.nama_layanan || service.layanan || 'Layanan'

        // If service has both free and paid portions
        if (freeCount > 0 && paidCount > 0) {
          return `• ${serviceName} x${quantity} (${freeCount} gratis) - ${formatCurrency(unitPrice * paidCount)}`
        }
        // If service is completely free (only if explicitly marked as free)
        else if (freeCount > 0 || service.isFree) {
          return `• ${serviceName} x${quantity} - GRATIS`
        }
        // If service is completely paid
        else {
          return `• ${serviceName} x${paidCount} - ${formatCurrency(unitPrice * paidCount)}`
        }
      }).join('\n')
    : ''

  // Format products list
  const productsList = products.length > 0
    ? products.map(product => {
        const qty = product.quantity || 1
        const isFree = product.isFree && product.freeQuantity > 0
        const freeQty = product.freeQuantity || 0
        const paidQty = Math.max(0, qty - freeQty)

        const unitPrice = parseFloat(product.harga_satuan || product.harga) || 0

        if (isFree && freeQty > 0) {
          return paidQty > 0
            ? `• ${product.nama_produk} x${qty} (${freeQty} gratis) - ${formatCurrency(unitPrice * paidQty)}`
            : `• ${product.nama_produk} x${qty} - GRATIS`
        }
        return `• ${product.nama_produk} x${qty} - ${formatCurrency(unitPrice * qty)}`
      }).join('\n')
    : ''

  // Payment method emoji
  const paymentEmoji = metode_pembayaran === 'qris' ? '📱' : '💰'
  const paymentText = metode_pembayaran === 'qris' ? 'QRIS' : 'TUNAI'

  // Calculate subtotals
  const serviceSubtotal = services.reduce((sum, service) => {
    // Use actual subtotal from database if available, otherwise calculate
    if (service.subtotal !== undefined) {
      return sum + parseFloat(service.subtotal || 0)
    }

    // Fallback calculation for paid portion only
    const paidCount = service.paidCount !== undefined ? service.paidCount : Math.max(0, (service.quantity || 1) - (service.freeCount || 0))
    const unitPrice = parseFloat(service.harga_satuan || service.harga) || 0
    return sum + (unitPrice * paidCount)
  }, 0)

  const productSubtotal = products.reduce((sum, product) => {
    // Use actual subtotal from database if available, otherwise calculate
    if (product.subtotal !== undefined) {
      return sum + parseFloat(product.subtotal || 0)
    }

    // Fallback calculation for paid portion only
    const qty = product.quantity || 1
    const freeQty = product.freeQuantity || 0
    const paidQty = Math.max(0, qty - freeQty)
    const unitPrice = parseFloat(product.harga_satuan || product.harga) || 0
    return sum + (unitPrice * paidQty)
  }, 0)

  // Build receipt message
  const receipt = `\`\`\`
🧺 STRUK PEMBAYARAN DWASH LAUNDRY 🧺

📋 Detail Transaksi:
Kode     : ${kode_transaksi}
Tanggal  : ${formatDateWhatsApp(tanggal_transaksi)} WIB
Cabang   : ${nama_cabang}
Pelanggan: ${nama_pelanggan}
Kasir    : ${toTitleCase(transaction.nama_pekerja_aktual || transaction.active_worker_name || transaction.nama_karyawan || 'System')}
WA Kasir : ${transaction.nomor_telepon_kasir ? `+62${transaction.nomor_telepon_kasir.replace(/^0/, '')}` : 'N/A'}
______________________

${servicesList ? `👕 Layanan:\n${servicesList}\n______________________\n\n` : ''}${productsList ? `🧴 Produk:\n${productsList}\n______________________\n\n` : ''}${servicesList || productsList ? `Subtotal Layanan: ${formatCurrency(serviceSubtotal)}\nSubtotal Produk: ${formatCurrency(productSubtotal)}\n______________________\n\n` : ''}💳 Pembayaran:
Metode: ${paymentEmoji} ${paymentText}
Total : ${formatCurrency(total_keseluruhan)}
Status: LUNAS ✅
______________________

🔍 Cek status cucian & loyalty point (masukkan no hp mu untuk login):

https://dwashlaundry.com
______________________

Nb: Jika ada yang ingin ditanyakan bisa klik WA kasir diatas. Mohon tidak bertanya status cucian ke nomor ini karena ini admin semua cabang.

Terima kasih telah menggunakan layanan DWash Laundry!
\`\`\`
⚠️ *Pesan ini dikirim otomatis oleh sistem*
`.trim()

  return receipt
}

/**
 * POST /api/fonnte/send
 * Send WhatsApp receipt after transaction completion OR send custom message
 */
export async function POST(request) {
  try {
    const body = await request.json()

    // Check if this is a simple message send (for feedback, etc)
    if (body.target && body.message && !body.transaction) {
      console.log('📱 [API] Sending custom WhatsApp message to:', body.target)

      const result = await sendFontteMessage(body.target, body.message, {}, null)

      if (result.success) {
        console.log('✅ Custom message sent successfully to:', body.target)
        return NextResponse.json({
          success: true,
          phone: body.target,
          message: 'WhatsApp message sent successfully'
        })
      } else {
        console.error('❌ Failed to send message:', result.error)
        return NextResponse.json({
          success: false,
          error: result.error
        }, { status: 500 })
      }
    }

    // Original transaction receipt logic
    const { transaction, services = [], products = [], loyaltyData = null } = body

    console.log('📱 [API] Sending WhatsApp receipt for transaction:', transaction.kode_transaksi)

    // Validate phone number
    const phone = transaction.nomor_telepon
    if (!phone) {
      console.warn('⚠️ No phone number found for customer:', transaction.nama_pelanggan)
      return NextResponse.json({
        success: false,
        error: 'No phone number'
      }, { status: 400 })
    }

    // Clean and format phone number (remove +62, 0, spaces, dashes)
    const cleanPhone = phone.replace(/[\s\-\+]/g, '')
                           .replace(/^62/, '')
                           .replace(/^0/, '')
    const formattedPhone = `62${cleanPhone}`

    console.log('📱 Sending receipt to:', formattedPhone)

    // Format receipt message
    const receiptMessage = formatTransactionReceipt(transaction, services, products, loyaltyData)

    // Send via Fonnte with transaction data for branch-specific token selection
    const result = await sendFontteMessage(formattedPhone, receiptMessage, {}, transaction)

    if (result.success) {
      console.log('✅ Transaction receipt sent successfully to:', formattedPhone)
      return NextResponse.json({
        success: true,
        phone: formattedPhone,
        message: 'WhatsApp receipt sent successfully'
      })
    } else {
      console.error('❌ Failed to send receipt:', result.error)
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ [API] Send receipt error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}