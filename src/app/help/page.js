"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function HelpPage() {
  const [activeCategory, setActiveCategory] = useState('general')
  const router = useRouter()

  const categories = [
    { id: 'general', name: 'Umum', icon: '❓' },
    { id: 'transactions', name: 'Transaksi', icon: '💰' },
    { id: 'machines', name: 'Mesin', icon: '🔧' },
    { id: 'customers', name: 'Pelanggan', icon: '👥' },
    { id: 'reports', name: 'Laporan', icon: '📊' }
  ]

  const helpContent = {
    general: [
      {
        question: 'Bagaimana cara menggunakan sistem D\'Wash?',
        answer: 'Sistem D\'Wash dirancang untuk memudahkan pengelolaan laundry self-service. Mulai dengan login menggunakan akun yang telah diberikan, kemudian akses dashboard sesuai role Anda.'
      },
      {
        question: 'Bagaimana cara logout dari sistem?',
        answer: 'Klik avatar profil Anda di pojok kanan atas, kemudian pilih "Logout" dari menu dropdown.'
      },
      {
        question: 'Bagaimana cara mengubah password?',
        answer: 'Buka Profile Settings dari menu profil, kemudian klik "Ubah Password". Masukkan password lama dan password baru.'
      }
    ],
    transactions: [
      {
        question: 'Bagaimana cara membuat transaksi baru?',
        answer: 'Klik tombol "Buat Transaksi Baru" di dashboard kasir. Pilih pelanggan, layanan, produk tambahan (opsional), lalu konfirmasi pembayaran.'
      },
      {
        question: 'Apa itu draft transaksi?',
        answer: 'Draft transaksi adalah transaksi yang mesinnya sudah dimulai tapi belum dibayar. Customer bisa bayar nanti di kasir.'
      },
      {
        question: 'Bagaimana cara melihat riwayat transaksi?',
        answer: 'Klik "Lihat Semua" di bagian Transaksi Terbaru pada dashboard, atau gunakan filter tanggal untuk mencari transaksi tertentu.'
      }
    ],
    machines: [
      {
        question: 'Bagaimana cara mengecek status mesin?',
        answer: 'Status mesin ditampilkan di dashboard dengan warna berbeda: Hijau (Tersedia), Biru (Digunakan), Kuning (Maintenance), Merah (Rusak).'
      },
      {
        question: 'Bagaimana cara mengubah status mesin?',
        answer: 'Klik tombol "Update" pada mesin yang ingin diubah, pilih status baru, dan tambahkan catatan jika diperlukan.'
      },
      {
        question: 'Apa yang terjadi jika timer mesin habis?',
        answer: 'Sistem akan otomatis mengubah status mesin menjadi "Tersedia" ketika countdown timer mencapai nol.'
      }
    ],
    customers: [
      {
        question: 'Bagaimana cara menambah pelanggan baru?',
        answer: 'Saat membuat transaksi, jika pelanggan tidak ditemukan, klik "Tambah Pelanggan Baru" dan isi data yang diperlukan.'
      },
      {
        question: 'Bagaimana cara mencari pelanggan?',
        answer: 'Gunakan kolom pencarian di form transaksi. Anda bisa mencari berdasarkan nama atau nomor telepon.'
      }
    ],
    reports: [
      {
        question: 'Bagaimana cara melihat laporan shift?',
        answer: 'Klik "Laporan Shift" di dashboard untuk melihat ringkasan transaksi dan pendapatan selama shift aktif.'
      },
      {
        question: 'Bagaimana cara export laporan?',
        answer: 'Fitur export laporan tersedia di halaman laporan dengan format PDF atau Excel (fitur dalam pengembangan).'
      }
    ]
  }

  const ContactInfo = () => (
    <Card>
      <h3 className="text-lg sm:text-xl font-semibold mb-4">Kontak Support</h3>
      <div className="space-y-4">
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <span className="text-2xl">📞</span>
          <div>
            <div className="font-medium text-gray-900">Telepon</div>
            <div className="text-sm text-gray-600">+62 821-9988-7766</div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <span className="text-2xl">💬</span>
          <div>
            <div className="font-medium text-gray-900">WhatsApp</div>
            <div className="text-sm text-gray-600">+62 821-9988-7766</div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <span className="text-2xl">📧</span>
          <div>
            <div className="font-medium text-gray-900">Email</div>
            <div className="text-sm text-gray-600">support@dwashlaundry.com</div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <span className="text-2xl">🕒</span>
          <div>
            <div className="font-medium text-gray-900">Jam Operasional</div>
            <div className="text-sm text-gray-600">24/7 - Selalu siap membantu</div>
          </div>
        </div>
      </div>
    </Card>
  )

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-12 h-12 text-2xl text-gray-700 hover:bg-gray-100 rounded-full transition-colors mr-4"
            >
              ←
            </button>
            <div className="text-center flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Help & Support</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">Temukan jawaban untuk pertanyaan yang sering diajukan</p>
            </div>
            <div className="w-12"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
          {/* Categories Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <h3 className="text-lg font-semibold mb-4">Kategori</h3>
              <div className="space-y-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-3 ${
                      activeCategory === category.id
                        ? 'bg-dwash-red text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-lg">{category.icon}</span>
                    <span className="text-sm sm:text-base">{category.name}</span>
                  </button>
                ))}
              </div>
            </Card>

            {/* Contact Info for Mobile */}
            <div className="mt-6 lg:hidden">
              <ContactInfo />
            </div>
          </div>

          {/* FAQ Content */}
          <div className="lg:col-span-2">
            <Card>
              <h3 className="text-lg sm:text-xl font-semibold mb-6">
                {categories.find(c => c.id === activeCategory)?.icon} {' '}
                {categories.find(c => c.id === activeCategory)?.name}
              </h3>
              
              <div className="space-y-6">
                {helpContent[activeCategory]?.map((item, index) => (
                  <div key={index} className="border-b border-gray-100 pb-6 last:border-b-0 last:pb-0">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
                      {item.question}
                    </h4>
                    <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Bantuan Cepat</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => window.open('https://wa.me/6282199887766', '_blank')}
                    className="text-sm"
                  >
                    💬 Chat WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open('tel:+6282199887766')}
                    className="text-sm"
                  >
                    📞 Telepon Support
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Contact Info Sidebar - Desktop */}
          <div className="lg:col-span-1 hidden lg:block">
            <ContactInfo />
            
            {/* System Info */}
            <Card className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Informasi Sistem</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Versi:</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Update terakhir:</span>
                  <span className="font-medium">23 Juli 2025</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="text-green-600 font-medium">🟢 Online</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 sm:mt-12">
          <Card>
            <div className="text-center py-6 sm:py-8">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
                Tidak menemukan jawaban yang Anda cari?
              </h3>
              <p className="text-sm sm:text-base text-gray-600 mb-6">
                Tim support kami siap membantu Anda 24/7
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                <Button
                  onClick={() => window.open('https://wa.me/6282199887766', '_blank')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  💬 Chat WhatsApp
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open('mailto:support@dwash.id')}
                >
                  📧 Kirim Email
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}