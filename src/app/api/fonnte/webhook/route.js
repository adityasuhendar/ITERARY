import { NextResponse } from 'next/server'

/**
 * Fonnte Webhook Endpoint
 * Handles incoming WhatsApp messages and delivery status
 */
export async function POST(request) {
  try {
    console.log('📨 [Fonnte Webhook] Incoming request')

    const data = await request.json()
    console.log('📨 [Fonnte Webhook] Data received:', JSON.stringify(data, null, 2))

    const {
      message,
      sender,
      device,
      type,
      status,
      key
    } = data

    // Handle different message types
    if (type === 'text' && message) {
      console.log(`📱 [Fonnte] Text message from ${sender}: ${message}`)

      // Handle customer replies to receipts
      await handleCustomerMessage(sender, message, device)

    } else if (type === 'image' || type === 'document') {
      console.log(`📷 [Fonnte] Media message from ${sender}`)

      // Handle media messages if needed
      await handleMediaMessage(sender, type, data)

    } else if (status) {
      console.log(`📊 [Fonnte] Status update: ${status} for key: ${key}`)

      // Handle delivery status updates
      await handleStatusUpdate(status, key, data)
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully'
    })

  } catch (error) {
    console.error('❌ [Fonnte Webhook] Error:', error)

    return NextResponse.json({
      success: false,
      error: 'Webhook processing failed',
      message: error.message
    }, { status: 500 })
  }
}

/**
 * Handle GET requests (for webhook verification)
 */
export async function GET(request) {
  console.log('🔍 [Fonnte Webhook] GET request - webhook verification')

  const { searchParams } = new URL(request.url)
  const challenge = searchParams.get('hub.challenge')

  if (challenge) {
    console.log('✅ [Fonnte Webhook] Verification challenge:', challenge)
    return new Response(challenge, { status: 200 })
  }

  return NextResponse.json({
    status: 'D\'Wash Laundry Fonnte Webhook Active',
    timestamp: new Date().toISOString()
  })
}

/**
 * Handle incoming customer messages
 */
async function handleCustomerMessage(sender, message, device) {
  try {
    const lowerMessage = message.toLowerCase().trim()

    // Auto-replies untuk common questions
    if (lowerMessage.includes('jam') || lowerMessage.includes('buka')) {
      // Reply jam operasional
      await sendAutoReply(sender, `
🕐 *JAM OPERASIONAL DWASH LAUNDRY*

📅 Setiap Hari: 06:00 - 22:00 WIB

📍 Lokasi cabang dan info lebih lanjut:
Silakan hubungi cabang terdekat

Terima kasih! 😊
      `.trim())

    } else if (lowerMessage.includes('harga') || lowerMessage.includes('tarif')) {
      // Reply info harga
      await sendAutoReply(sender, `
💰 *INFO HARGA LAYANAN*

🔧 Layanan tersedia:
• Cuci saja (Rp. 10.000/7kg)
• Cuci + Kering (Rp. 20.000/7kg)
• Cuci + Kering + Lipat (Rp. 26.000/7kg)
• Bilas (Rp. 5000/7kg)

📞 Untuk info harga detail, silakan hubungi cabang atau datang langsung

Terima kasih! 😊
      `.trim())

    } else if (lowerMessage.includes('terima kasih') || lowerMessage.includes('makasih')) {
      // Reply terima kasih
      await sendAutoReply(sender, `
🙏 Sama-sama!

Terima kasih telah menggunakan layanan DWash Laundry.
Semoga puas dengan layanan kami! 😊

Sampai jumpa lagi! 👋
      `.trim())
    }

    console.log(`✅ [Fonnte] Customer message processed from ${sender}`)

  } catch (error) {
    console.error('❌ [Fonnte] Handle customer message error:', error)
  }
}

/**
 * Handle media messages
 */
async function handleMediaMessage(sender, type, data) {
  try {
    console.log(`📷 [Fonnte] Processing ${type} message from ${sender}`)

    // Handle media if needed (bukti transfer, foto, dll)
    // For now, just log

  } catch (error) {
    console.error('❌ [Fonnte] Handle media message error:', error)
  }
}

/**
 * Handle delivery status updates
 */
async function handleStatusUpdate(status, key, data) {
  try {
    console.log(`📊 [Fonnte] Status update: ${status} for message key: ${key}`)

    // Track delivery status if needed
    // Status examples: 'sent', 'delivered', 'read', 'failed'

    if (status === 'failed') {
      console.warn(`⚠️ [Fonnte] Message delivery failed for key: ${key}`)
    }

  } catch (error) {
    console.error('❌ [Fonnte] Handle status update error:', error)
  }
}

/**
 * Send auto-reply message
 */
async function sendAutoReply(target, message) {
  try {
    // Import sendFontteMessage here to avoid circular imports
    const { sendFontteMessage } = await import('@/lib/fonnte')

    const result = await sendFontteMessage(target, message)

    if (result.success) {
      console.log(`✅ [Fonnte] Auto-reply sent to ${target}`)
    } else {
      console.error(`❌ [Fonnte] Auto-reply failed to ${target}:`, result.error)
    }

  } catch (error) {
    console.error('❌ [Fonnte] Send auto-reply error:', error)
  }
}