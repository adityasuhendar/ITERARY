'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'

export default function CollectionDetailModal({ collectionId, isOpen, onClose }) {
  const [collection, setCollection] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && collectionId) {
      fetchCollectionDetail()
    }
  }, [isOpen, collectionId])

  const fetchCollectionDetail = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/collections/${collectionId}`)
      if (response.ok) {
        const data = await response.json()
        setCollection(data.collection)
      }
    } catch (error) {
      console.error('Error fetching collection detail:', error)
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

  const formatDateTime = (dateString, timeString) => {
    const date = new Date(`${dateString}T${timeString}`)
    return date.toLocaleString('id-ID')
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detail Pengambilan Uang">
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      ) : collection ? (
        <div className="space-y-6">
          {/* Header Info */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-blue-900">{collection.nama_cabang}</h3>
                <p className="text-blue-700">Shift {collection.shift_diambil}</p>
              </div>
              <div className="text-right">
                <p className="text-blue-700">
                  {formatDateTime(collection.tanggal_pengambilan, collection.jam_pengambilan)}
                </p>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  collection.status_pengambilan === 'selesai' ? 'bg-green-100 text-green-800' :
                  collection.status_pengambilan === 'bermasalah' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {collection.status_pengambilan}
                </span>
              </div>
            </div>
          </div>

          {/* Financial Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Data Sistem</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tunai Sistem:</span>
                  <span className="font-medium">{formatCurrency(collection.total_tunai_sistem)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">QRIS Sistem:</span>
                  <span className="font-medium">{formatCurrency(collection.total_qris_sistem)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">Total Sistem:</span>
                  <span className="font-bold">{formatCurrency(collection.total_tunai_sistem + collection.total_qris_sistem)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Data Fisik</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Uang Dihitung:</span>
                  <span className="font-medium">{formatCurrency(collection.uang_fisik_dihitung)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Uang Diambil:</span>
                  <span className="font-medium">{formatCurrency(collection.uang_diambil)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">Selisih:</span>
                  <span className={`font-bold ${
                    collection.selisih === 0 ? 'text-green-600' :
                    collection.selisih > 0 ? 'text-blue-600' : 'text-red-600'
                  }`}>
                    {collection.selisih >= 0 ? '+' : ''}{formatCurrency(collection.selisih)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Personnel Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">Personel</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Kasir:</span>
                <span className="font-medium ml-2">{collection.nama_kasir}</span>
              </div>
              <div>
                <span className="text-gray-600">Collector:</span>
                <span className="font-medium ml-2">{collection.nama_collector}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {(collection.alasan_selisih || collection.catatan) && (
            <div className="space-y-4">
              {collection.alasan_selisih && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Alasan Selisih</h4>
                  <p className="text-gray-700 bg-red-50 p-3 rounded-lg">{collection.alasan_selisih}</p>
                </div>
              )}
              
              {collection.catatan && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Catatan</h4>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{collection.catatan}</p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
            >
              Tutup
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>Data pengambilan tidak ditemukan</p>
        </div>
      )}
    </Modal>
  )
}