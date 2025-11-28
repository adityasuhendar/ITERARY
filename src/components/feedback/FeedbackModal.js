"use client"
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

export default function FeedbackModal({ isOpen, onClose, user }) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [kategori, setKategori] = useState([])
  const [pesan, setPesan] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!rating || kategori.length === 0 || !pesan.trim()) {
      alert('Mohon isi semua field!')
      return
    }

    setSubmitting(true)

    try {
      const feedbackData = {
        id_karyawan: user.id,
        nama_karyawan: user.name,
        cabang: user.cabang,
        role: user.role,
        rating,
        kategori,
        pesan: pesan.trim()
      }

      // Format kategori untuk WA message
      const kategoriText = kategori.map(k => {
        const cat = categories.find(c => c.value === k)
        return cat ? cat.label : k
      }).join(', ')

      // Format rating label
      const ratingLabel = rating === 5 ? 'Sangat Bagus!' : rating === 4 ? 'Bagus!' : rating === 3 ? 'Cukup Baik' : rating === 2 ? 'Perlu Perbaikan' : 'Buruk'

      // Format pesan WhatsApp
      const waMessage = `*📝 FEEDBACK SISTEM DWASH*\n\n` +
        `*Dari:* ${user.name}\n` +
        `*Cabang:* ${user.cabang}\n` +
        `*Role:* ${user.role}\n\n` +
        `*Rating:* ${'⭐'.repeat(rating)} (${rating}/5 - ${ratingLabel})\n\n` +
        `*Kategori:* ${kategoriText}\n\n` +
        `*Pesan:*\n${pesan.trim()}`

      // Kirim ke Fonnte
      const response = await fetch('/api/fonnte/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: '085842816810',
          message: waMessage
        })
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Gagal mengirim feedback')
      }

      // Reset form
      setRating(0)
      setKategori([])
      setPesan('')

      // Show success modal
      alert('✅ Terima kasih atas feedback Anda!\n\nFeedback telah dikirim ke developer dan akan segera ditindaklanjuti.')

      onClose()
    } catch (error) {
      console.error('Feedback error:', error)
      alert('❌ Gagal mengirim feedback. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  // Kategori Feedback Enum
  const KATEGORI_FEEDBACK = {
    BUG: 'bug',
    SARAN: 'saran',
    FITUR_BARU: 'fitur_baru',
    UMUM: 'umum'
  }

  const categories = [
    { value: KATEGORI_FEEDBACK.BUG, label: '🐛 Bug Report', desc: 'Laporkan bug atau error' },
    { value: KATEGORI_FEEDBACK.SARAN, label: '💡 Saran Perbaikan', desc: 'Saran untuk fitur yang ada' },
    { value: KATEGORI_FEEDBACK.FITUR_BARU, label: '⚡ Request Fitur Baru', desc: 'Usul fitur baru' },
    { value: KATEGORI_FEEDBACK.UMUM, label: '💬 Feedback Umum', desc: 'Feedback atau komentar lainnya' }
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📝 Kirim Feedback"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rating Sistem
          </label>
          <div className="flex items-center gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="text-3xl sm:text-4xl transition-all hover:scale-110 focus:outline-none active:scale-95 p-1 sm:p-2 rounded-lg hover:bg-yellow-50"
              >
                {star <= (hoveredRating || rating) ? '⭐' : '☆'}
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="mt-2 text-xs text-gray-600 text-center">
              {rating}/5 - {rating === 5 ? 'Sangat Bagus!' : rating === 4 ? 'Bagus!' : rating === 3 ? 'Cukup Baik' : rating === 2 ? 'Perlu Perbaikan' : 'Buruk'}
            </p>
          )}
        </div>

        {/* Kategori */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Kategori Feedback <span className="text-xs text-gray-500">(bisa pilih lebih dari 1)</span>
          </label>
          <div className="space-y-2">
            {categories.map((cat) => (
              <label
                key={cat.value}
                className={`flex items-start p-2 border rounded-lg cursor-pointer transition-colors ${
                  kategori.includes(cat.value)
                    ? 'bg-blue-50 border-blue-500'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  value={cat.value}
                  checked={kategori.includes(cat.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setKategori([...kategori, cat.value])
                    } else {
                      setKategori(kategori.filter(k => k !== cat.value))
                    }
                  }}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">{cat.label}</div>
                  <div className="text-xs text-gray-500">{cat.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Pesan */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pesan Anda
          </label>
          <textarea
            value={pesan}
            onChange={(e) => setPesan(e.target.value)}
            placeholder="Contoh: Tombol cetak kadang tidak respond di browser Chrome mobile..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
          />
          <div className="text-xs text-gray-500 mt-1">
            {pesan.length}/500 karakter
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-center space-x-3">
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className="px-4 py-2 text-sm"
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            type="submit"
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700"
            disabled={submitting || !rating || kategori.length === 0 || !pesan.trim()}
          >
            {submitting ? 'Mengirim...' : 'Kirim'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
