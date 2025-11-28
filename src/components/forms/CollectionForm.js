'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function CollectionForm({ user, selectedBranch, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    cabang_id: selectedBranch?.id_cabang || '',
    kasir_id: '',
    shift: 'pagi',
    total_tunai_sistem: '',
    total_qris_sistem: '',
    uang_fisik_dihitung: '',
    uang_diambil: '',
    alasan_selisih: '',
    catatan: ''
  })
  const [kasirOptions, setKasirOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (selectedBranch) {
      fetchKasirOptions(selectedBranch.id_cabang)
      setFormData(prev => ({
        ...prev,
        cabang_id: selectedBranch.id_cabang,
        total_tunai_sistem: selectedBranch.tunai_ready || '',
        total_qris_sistem: selectedBranch.qris_total || ''
      }))
    }
  }, [selectedBranch])

  useEffect(() => {
    // Auto calculate uang_diambil when uang_fisik_dihitung changes
    if (formData.uang_fisik_dihitung) {
      setFormData(prev => ({
        ...prev,
        uang_diambil: formData.uang_fisik_dihitung
      }))
    }
  }, [formData.uang_fisik_dihitung])

  const fetchKasirOptions = async (cabangId) => {
    try {
      const response = await fetch(`/api/kasir?cabang_id=${cabangId}`)
      if (response.ok) {
        const data = await response.json()
        setKasirOptions(data.kasir || [])
      }
    } catch (error) {
      console.error('Error fetching kasir options:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Validation
      if (!formData.cabang_id || !formData.kasir_id || !formData.uang_diambil) {
        throw new Error('Mohon lengkapi data yang diperlukan')
      }

      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          total_tunai_sistem: parseFloat(formData.total_tunai_sistem) || 0,
          total_qris_sistem: parseFloat(formData.total_qris_sistem) || 0,
          uang_fisik_dihitung: parseFloat(formData.uang_fisik_dihitung) || 0,
          uang_diambil: parseFloat(formData.uang_diambil) || 0
        })
      })

      const data = await response.json()

      if (data.success) {
        onSuccess && onSuccess(data)
      } else {
        setError(data.error || 'Gagal menyimpan data pengambilan')
      }
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0)
  }

  const calculateSelisih = () => {
    const sistem = (parseFloat(formData.total_tunai_sistem) || 0) + (parseFloat(formData.total_qris_sistem) || 0)
    const fisik = parseFloat(formData.uang_fisik_dihitung) || 0
    return fisik - sistem
  }

  const selisih = calculateSelisih()

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Catat Pengambilan Uang
          </h1>
          <Button
            onClick={onCancel}
            variant="outline"
            className="text-gray-600 border-gray-300"
          >
            ← Kembali
          </Button>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Branch Info */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Informasi Cabang</h3>
              <p className="text-blue-800">
                <strong>{selectedBranch?.nama_cabang}</strong>
              </p>
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-600">Tunai Ready:</span>
                  <span className="font-medium ml-2">{formatCurrency(selectedBranch?.tunai_ready)}</span>
                </div>
                <div>
                  <span className="text-blue-600">QRIS Total:</span>
                  <span className="font-medium ml-2">{formatCurrency(selectedBranch?.qris_total)}</span>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kasir <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.kasir_id}
                  onChange={(e) => setFormData({...formData, kasir_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Pilih Kasir</option>
                  {kasirOptions.map((kasir) => (
                    <option key={kasir.id_karyawan} value={kasir.id_karyawan}>
                      {kasir.nama_karyawan} - Shift {kasir.shift}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shift <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.shift}
                  onChange={(e) => setFormData({...formData, shift: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="pagi">Pagi</option>
                  <option value="malam">Malam</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Total Tunai Sistem"
                type="number"
                step="0.01"
                value={formData.total_tunai_sistem}
                onChange={(e) => setFormData({...formData, total_tunai_sistem: e.target.value})}
                placeholder="0"
              />

              <Input
                label="Total QRIS Sistem"
                type="number"
                step="0.01"
                value={formData.total_qris_sistem}
                onChange={(e) => setFormData({...formData, total_qris_sistem: e.target.value})}
                placeholder="0"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Uang Fisik Dihitung *"
                type="number"
                step="0.01"
                value={formData.uang_fisik_dihitung}
                onChange={(e) => setFormData({...formData, uang_fisik_dihitung: e.target.value})}
                placeholder="0"
                required
              />

              <Input
                label="Uang Diambil *"
                type="number"
                step="0.01"
                value={formData.uang_diambil}
                onChange={(e) => setFormData({...formData, uang_diambil: e.target.value})}
                placeholder="0"
                required
              />
            </div>

            {/* Selisih Display */}
            {(formData.total_tunai_sistem || formData.total_qris_sistem || formData.uang_fisik_dihitung) && (
              <div className={`p-4 rounded-lg ${
                selisih === 0 ? 'bg-green-50 border border-green-200' :
                selisih > 0 ? 'bg-blue-50 border border-blue-200' :
                'bg-red-50 border border-red-200'
              }`}>
                <h4 className="font-semibold mb-2">Perhitungan Selisih</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Sistem:</span>
                    <div className="font-medium">
                      {formatCurrency((parseFloat(formData.total_tunai_sistem) || 0) + (parseFloat(formData.total_qris_sistem) || 0))}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Uang Fisik:</span>
                    <div className="font-medium">
                      {formatCurrency(parseFloat(formData.uang_fisik_dihitung) || 0)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Selisih:</span>
                    <div className={`font-bold ${
                      selisih === 0 ? 'text-green-600' :
                      selisih > 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {selisih >= 0 ? '+' : ''}{formatCurrency(selisih)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selisih !== 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alasan Selisih
                </label>
                <textarea
                  value={formData.alasan_selisih}
                  onChange={(e) => setFormData({...formData, alasan_selisih: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  placeholder="Jelaskan alasan selisih..."
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catatan
              </label>
              <textarea
                value={formData.catatan}
                onChange={(e) => setFormData({...formData, catatan: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows="3"
                placeholder="Catatan tambahan..."
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {loading ? 'Menyimpan...' : 'Simpan Pengambilan'}
              </Button>
              <Button
                type="button"
                onClick={onCancel}
                variant="outline"
                className="px-6"
              >
                Batal
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}