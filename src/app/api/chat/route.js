import { NextResponse } from 'next/server'

// Rate limiting store (in-memory, use Redis for production)
const rateLimitStore = new Map()

// Clean expired entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.firstRequest > 60000) { // 1 minute window
      rateLimitStore.delete(key)
    }
  }
}, 600000)

// Input sanitization function
function sanitizeInput(input) {
  if (typeof input !== 'string') return ''

  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>&"']/g, (match) => { // Escape dangerous characters
      const escapeMap = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#x27;'
      }
      return escapeMap[match]
    })
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .slice(0, 500) // Limit length
}

/**
 * Chat API untuk DWash Laundry
 * Menggunakan keyword-based smart response
 */

// Smart response generator based on keywords
function generateSmartResponse(message) {
  const msg = message.toLowerCase()

  // Greeting responses
  if (msg.includes('hai') || msg.includes('halo') || msg.includes('hi') || msg.includes('hello')) {
    return "Hai! Selamat datang di DWash Laundry 😊\n\nAda yang bisa saya bantu? Mau tanya tentang:\n• 💰 Harga layanan\n• 📍 Lokasi cabang\n• ⏰ Jam operasional\n\nTinggal ketik aja ya kak!"
  }

  // Harga responses
  if (msg.includes('harga') || msg.includes('biaya') || msg.includes('tarif') || msg.includes('berapa')) {
    return "💰 INFO HARGA LAYANAN\n\n🔧 Layanan tersedia:\n• Cuci saja (Rp. 10.000/7kg)\n• Cuci + Kering (Rp. 20.000/7kg)\n• Cuci + Kering + Lipat (Rp. 26.000/7kg)\n• Bilas (Rp. 5.000/7kg)\n\n📞 Untuk info harga detail, silakan hubungi cabang atau datang langsung\n\nTerima kasih! 😊"
  }

  // Specific branch responses
  if (msg.includes('tanjung senang')) {
    return "🏪 Cabang Tanjung Senang\n\n📍 Jl. Ratu Dibalau, Tj. Senang, Kec. Tj. Senang, Kota Bandar Lampung\n\n🗺️ Google Maps:\nhttps://share.google/whjLF2wMOFzMbD8vL\n\n🏭 5 Mesin Cuci + 5 Pengering\n📞 0821-8148-7971\n⏰ 06:00 - 22:00\n\nSiap melayani kak! 😊"
  }

  if (msg.includes('panglima polim')) {
    return "🏪 Cabang Panglima Polim\n\n📍 Jl. Panglima Polim No.15, Gedong Air, Kec. Tj. Karang Bar., Kota Bandar Lampung\n\n🗺️ Google Maps:\nhttps://share.google/I5JWmhMD1bww5LIzZ\n\n🏭 5 Mesin Cuci + 5 Pengering\n📞 0821-8148-7971\n⏰ 06:00 - 22:00\n\nSiap melayani kak! 😊"
  }

  if (msg.includes('sukarame')) {
    return "🏪 Cabang Sukarame\n\n📍 Jl. Endro Suratmin, Waydadi, Kec. Sukarame, Kota Bandar Lampung\n\n🗺️ Google Maps:\nhttps://share.google/zgddrTY1NG0C6s7eL\n\n🏭 6 Mesin Cuci + 6 Pengering\n📞 0821-8148-7971\n⏰ 06:00 - 22:00\n\nSiap melayani kak! 😊"
  }

  if (msg.includes('korpri')) {
    return "🏪 Cabang Korpri\n\n📍 Jl. Ryamizard Jl. Ryacudu, Harapan Jaya, Kec. Sukarame, Kota Bandar Lampung\n\n🗺️ Google Maps:\nhttps://share.google/9NueEMn8IjJEowlze\n\n🏭 5 Mesin Cuci + 5 Pengering\n📞 0821-8148-7971\n⏰ 06:00 - 22:00\n\nSiap melayani kak! 😊"
  }

  if (msg.includes('gedong meneng')) {
    return "🏪 Cabang Gedong Meneng\n\n📍 Jl. Abdul Muis, Gedong Meneng, Kec. Rajabasa, Kota Bandar Lampung\n\n🗺️ Google Maps:\nhttps://share.google/n5nw7o9PPAUWUhIXE\n\n🏭 5 Mesin Cuci + 5 Pengering\n📞 0821-8148-7971\n⏰ 06:00 - 22:00\n\nSiap melayani kak! 😊"
  }

  if (msg.includes('untung')) {
    return "🏪 Cabang Untung\n\n📍 Jl. R.A. Basyid, Labuhan Dalam, Kec. Tj. Senang, Kota Bandar Lampung\n\n🗺️ Google Maps:\nhttps://share.google/QsQqsOt9gT5Fs7wsC\n\n🏭 3 Mesin Cuci + 3 Pengering\n📞 0821-8148-7971\n⏰ 06:00 - 22:00\n\nSiap melayani kak! 😊"
  }

  if (msg.includes('komarudin')) {
    return "🏪 Cabang Komarudin\n\n📍 Jl. H. Komarudin, Rajabasa Raya, Kec. Rajabasa, Kota Bandar Lampung\n\n🗺️ Google Maps:\nhttps://maps.app.goo.gl/pNRQrxcjqDMmCrTJ9\n\n🏭 3 Mesin Cuci + 3 Pengering\n📞 0821-8148-7971\n⏰ 06:00 - 22:00\n\nSiap melayani kak! 😊"
  }

  // General location responses
  if (msg.includes('lokasi') || msg.includes('alamat') || msg.includes('cabang') || msg.includes('dimana') || msg.includes('tempat')) {
    return "📍 DWash punya 7 cabang di Bandar Lampung kak!\n\n🏪 1. Tanjung Senang\n🏪 2. Panglima Polim  \n🏪 3. Sukarame\n🏪 4. Korpri\n🏪 5. Gedong Meneng\n🏪 6. Untung\n🏪 7. Komarudin\n\n📞 0821-8148-7971\n⏰ 06:00 - 22:00 (setiap hari)\n\nMau alamat lengkap + maps cabang mana kak?\nTinggal sebutkan namanya aja! 😊"
  }

  // Jam operasional
  if (msg.includes('jam') || msg.includes('buka') || msg.includes('operasional') || msg.includes('tutup')) {
    return "DWash buka setiap hari kak! ⏰\n\n🕕 06:00 - 22:00 WIB\n\nJadi dari pagi sampai malem bisa cuci santai. Weekend juga tetap buka ya! Kapan mau datang? 😊"
  }


  // Cara kerja/self service
  if (msg.includes('cara') || msg.includes('gimana') || msg.includes('bagaimana') || msg.includes('self service')) {
    return "Self service di DWash gampang banget kak! 🧺\n\nCara cuci:\n1. Datang ke cabang\n2. Pilih mesin yang kosong\n3. Masukkan cucian + deterjen\n4. Bayar tunai/QRIS ke kasir\n5. Tunggu selesai (~45 menit)\n6. Ambil cucian\n\nTanpa koin, tanpa ribet! Staff juga siap bantu kalau ada kendala 😊"
  }

  // Payment methods
  if (msg.includes('bayar') || msg.includes('pembayaran') || msg.includes('qris') || msg.includes('tunai')) {
    return "Pembayaran di DWash fleksibel kak! 💳\n\n• 💰 Tunai (cash)\n• 📱 QRIS (scan pakai HP)\n\nGak pakai koin lagi, jadi praktis! Tinggal pilih mau bayar tunai atau scan QRIS. Mudah kan? 😊"
  }

  // Default response for unrecognized queries
  return `Hmm, sepertinya pertanyaan kak tentang "${message}" belum bisa saya jawab dengan detail nih 😅\n\nTapi saya bisa bantu info tentang:\n• 💰 Harga & paket layanan\n• 📍 Lokasi cabang DWash\n• ⏰ Jam operasional\n• 🧺 Cara pakai self service\n\nAtau langsung hubungi CS di +62 821-8148-7971 ya kak! 😊`
}

/**
 * POST /api/chat
 * Handle chat messages from frontend
 */
export async function POST(request) {
  try {
    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown'

    // Rate limiting check (5 requests per minute per IP)
    const now = Date.now()
    const rateLimitKey = `chat_${clientIP}`

    if (rateLimitStore.has(rateLimitKey)) {
      const data = rateLimitStore.get(rateLimitKey)

      // Reset counter if window expired
      if (now - data.firstRequest > 60000) {
        rateLimitStore.set(rateLimitKey, { count: 1, firstRequest: now })
      } else {
        // Check if exceeded limit
        if (data.count >= 5) {
          console.log(`🚫 Rate limit exceeded for IP: ${clientIP}`)
          return NextResponse.json({
            success: false,
            error: 'Terlalu banyak permintaan. Coba lagi dalam 1 menit.'
          }, { status: 429 })
        }

        // Increment counter
        data.count += 1
        rateLimitStore.set(rateLimitKey, data)
      }
    } else {
      // First request from this IP
      rateLimitStore.set(rateLimitKey, { count: 1, firstRequest: now })
    }

    const { message, sessionId } = await request.json()

    // Validate input
    if (!message || typeof message !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Invalid message format'
      }, { status: 400 })
    }

    // Sanitize input
    const sanitizedMessage = sanitizeInput(message)

    if (!sanitizedMessage || sanitizedMessage.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'Message is required'
      }, { status: 400 })
    }

    // Additional validation
    if (sanitizedMessage.length < 1 || sanitizedMessage.length > 500) {
      return NextResponse.json({
        success: false,
        error: 'Message must be between 1-500 characters'
      }, { status: 400 })
    }

    console.log(`💬 Chat request: "${sanitizedMessage.substring(0, 50)}..." (session: ${sessionId}, IP: ${clientIP})`)

    // Generate response
    const response = generateSmartResponse(sanitizedMessage.toLowerCase())

    console.log(`🤖 Response: "${response.substring(0, 100)}..."`)

    // Return response
    return NextResponse.json({
      success: true,
      data: {
        message: sanitizedMessage,
        response: response,
        timestamp: new Date().toISOString(),
        sessionId: sessionId || 'anonymous'
      }
    })

  } catch (error) {
    console.error('❌ Chat API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * GET /api/chat
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'online',
    service: 'DWash Chat API',
    timestamp: new Date().toISOString()
  })
}