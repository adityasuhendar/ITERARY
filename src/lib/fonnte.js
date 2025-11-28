/**
 * Fonnte WhatsApp Integration Service
 * untuk automatic receipt dan customer notifications
 */

import { formatCurrency, formatDateWhatsApp } from './formatters'

/**
 * Send WhatsApp message via Fonnte API
 */
export async function sendFontteMessage(target, message, options = {}) {
  try {
    console.log('📱 Sending WhatsApp message to:', target)

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': process.env.FONNTE_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target: target,
        message: message,
        countryCode: '62', // Indonesia
        ...options
      })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(`Fonnte API error: ${result.reason || 'Unknown error'}`)
    }

    console.log('✅ WhatsApp message sent successfully:', result)
    return { success: true, data: result }

  } catch (error) {
    console.error('❌ Fonnte send message error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Format transaction receipt untuk WhatsApp
 */
export function formatTransactionReceipt(transaction, services = [], products = []) {
  const {
    kode_transaksi,
    tanggal_transaksi,
    total_keseluruhan,
    payment_method,
    nama_pelanggan,
    nama_cabang
  } = transaction

  // Format services list
  const servicesList = services.length > 0
    ? services.map(service =>
        `• ${service.nama_layanan} x${service.quantity} - ${formatCurrency(service.harga * service.quantity)}`
      ).join('\n')
    : ''

  // Format products list
  const productsList = products.length > 0
    ? products.map(product => {
        const qty = product.quantity || 1
        const isFree = product.isFree && product.freeQuantity > 0
        const freeQty = product.freeQuantity || 0
        const paidQty = Math.max(0, qty - freeQty)

        if (isFree && freeQty > 0) {
          return paidQty > 0
            ? `• ${product.nama_produk} x${qty} (${freeQty} gratis) - ${formatCurrency(product.harga * paidQty)}`
            : `• ${product.nama_produk} x${qty} - GRATIS`
        }
        return `• ${product.nama_produk} x${qty} - ${formatCurrency(product.harga * qty)}`
      }).join('\n')
    : ''

  // Payment method emoji
  const paymentEmoji = payment_method === 'qris' ? '📱' : '💰'
  const paymentText = payment_method === 'qris' ? 'QRIS' : 'TUNAI'

  // Build receipt message
  const receipt = `\`\`\`
🧺 STRUK PEMBAYARAN DWASH LAUNDRY

📋 Detail Transaksi:
Kode     : ${kode_transaksi}
Tanggal  : ${formatDateWhatsApp(tanggal_transaksi)}
Cabang   : ${nama_cabang}
Pelanggan: ${nama_pelanggan}
______________________

${servicesList ? `👕 Layanan:\n${servicesList}\n______________________\n\n` : ''}${productsList ? `🧴 Produk:\n${productsList}\n______________________\n\n` : ''}💳 Pembayaran:
Metode: ${paymentEmoji} ${paymentText}
Total : ${formatCurrency(total_keseluruhan)}
Status: LUNAS ✅
______________________

📍 Terima kasih telah menggunakan layanan DWash Laundry!

🕐 Jam operasional: 06:00 - 22:00
📞 Untuk informasi lebih lanjut hubungi cabang ${nama_cabang}

Struk digital ini sah sebagai bukti pembayaran

⚠️ Pesan ini dikirim otomatis oleh sistem
\`\`\`
`.trim()

  return receipt
}

/**
 * Send automatic receipt after transaction success
 */
export async function sendTransactionReceipt(transaction, services = [], products = []) {
  try {
    // Validate phone number
    const phone = transaction.nomor_telepon
    if (!phone) {
      console.warn('⚠️ No phone number found for customer:', transaction.nama_pelanggan)
      return { success: false, error: 'No phone number' }
    }

    // Clean and format phone number (remove +62, 0, spaces, dashes)
    const cleanPhone = phone.replace(/[\s\-\+]/g, '')
                           .replace(/^62/, '')
                           .replace(/^0/, '')
    const formattedPhone = `62${cleanPhone}`

    console.log('📱 Sending receipt to:', formattedPhone, 'for transaction:', transaction.kode_transaksi)

    // Format receipt message
    const receiptMessage = formatTransactionReceipt(transaction, services, products)

    // Send via Fonnte
    const result = await sendFontteMessage(formattedPhone, receiptMessage)

    if (result.success) {
      console.log('✅ Transaction receipt sent successfully to:', formattedPhone)
      return { success: true, phone: formattedPhone }
    } else {
      console.error('❌ Failed to send receipt:', result.error)
      return { success: false, error: result.error }
    }

  } catch (error) {
    console.error('❌ Send transaction receipt error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send transaction status update
 */
export async function sendTransactionUpdate(phone, message) {
  const cleanPhone = phone.replace(/[\s\-\+]/g, '')
                          .replace(/^62/, '')
                          .replace(/^0/, '')
  const formattedPhone = `62${cleanPhone}`

  return await sendFontteMessage(formattedPhone, message)
}