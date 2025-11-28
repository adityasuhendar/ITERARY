// FILE: src/app/components/machines/MachineStatusModal.js
"use client"
import { useState } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

function Modal({ isOpen, onClose, title, children, size = "md" }) {
  if (!isOpen) return null

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg", 
    lg: "max-w-2xl"
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        ></div>

        <div className={`inline-block w-full ${sizeClasses[size]} p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export default function MachineStatusModal({ 
  machine, 
  isOpen, 
  onClose, 
  onUpdateSuccess 
}) {
  const [updating, setUpdating] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState(machine?.status_mesin || 'tersedia')
  const [estimatedFinish, setEstimatedFinish] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  if (!machine) return null

  const statusOptions = [
    { value: 'tersedia', label: 'Tersedia', color: 'bg-green-100 text-green-800', icon: '✅' },
    { value: 'rusak', label: 'Rusak', color: 'bg-red-100 text-red-800', icon: '❌' }
  ]

  const getStatusInfo = (status) => {
    return statusOptions.find(opt => opt.value === status) || statusOptions[0]
  }

  const calculateEstimatedFinish = (serviceType) => {
    const now = new Date()
    const duration = serviceType === 'cuci' ? 15 : 45 // minutes
    const finishTime = new Date(now.getTime() + duration * 60000)
    return finishTime.toTimeString().slice(0, 5) // HH:MM format
  }

  const handleQuickStatus = (status) => {
    setSelectedStatus(status)
    setEstimatedFinish('')
  }

  const handleUpdateStatus = async () => {
    try {
      setUpdating(true)
      setError('')

      const response = await fetch('/api/machines', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: machine.id_mesin || machine.id,
          new_status: selectedStatus,
          estimated_finish: estimatedFinish || null
        })
      })

      if (response.ok) {
        const result = await response.json()
        onUpdateSuccess && onUpdateSuccess(result)
        onClose()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update machine status')
      }
    } catch (err) {
      setError(err.message)
      console.error('Update machine status error:', err)
    } finally {
      setUpdating(false)
    }
  }

  const currentStatus = getStatusInfo(machine.status_mesin)
  const newStatus = getStatusInfo(selectedStatus)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Status Mesin">
      <div className="space-y-6">
        {/* Machine Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-lg">
              {machine.jenis_mesin === 'cuci' ? 'Mesin Cuci' : 'Mesin Pengering'} {machine.nomor_mesin}
            </h4>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${currentStatus.color}`}>
              {currentStatus.icon} {currentStatus.label}
            </span>
          </div>
          {machine.terakhir_maintenance && (
            <div className="text-sm text-gray-600">
              <p>Maintenance terakhir: {new Date(machine.terakhir_maintenance).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Quick Action Buttons */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Aksi Cepat:
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={selectedStatus === 'tersedia' ? 'primary' : 'outline'}
              onClick={() => handleQuickStatus('tersedia')}
              className="h-16 flex flex-col items-center justify-center"
            >
              <span className="text-xl mb-1">✅</span>
              <span className="text-sm">Tersedia</span>
            </Button>
            <Button
              variant={selectedStatus === 'rusak' ? 'primary' : 'outline'}
              onClick={() => handleQuickStatus('rusak')}
              className="h-16 flex flex-col items-center justify-center"
            >
              <span className="text-xl mb-1">❌</span>
              <span className="text-sm">Rusak</span>
            </Button>
          </div>
        </div>

        {/* Status Selection Dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status Mesin:
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-dwash-red focus:border-transparent"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>



        {/* Preview */}
        {selectedStatus !== machine.status_mesin && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-sm">
              <span>Status akan berubah dari:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${currentStatus.color}`}>
                {currentStatus.label}
              </span>
              <span>→</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${newStatus.color}`}>
                {newStatus.label}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={updating}
          >
            Batal
          </Button>
          <Button
            onClick={handleUpdateStatus}
            disabled={updating || selectedStatus === machine.status_mesin}
            className="flex-1"
          >
            {updating ? 'Updating...' : 'Update Status'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}