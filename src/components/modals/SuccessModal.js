"use client"
import { useEffect } from 'react'

export default function SuccessModal({ 
  isOpen, 
  onClose, 
  title = "Berhasil!", 
  message = "Operasi berhasil dilakukan",
  icon = "✅",
  autoClose = true,
  autoCloseDelay = 2000 
}) {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose()
      }, autoCloseDelay)
      
      return () => clearTimeout(timer)
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full transform animate-bounce-in">
        <div className="text-center">
          <div className="mb-4">
            <span className="text-4xl">{icon}</span>
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {title}
          </h2>
          
          <p className="text-gray-600 mb-4">
            {message}
          </p>
          
          {!autoClose && (
            <button
              onClick={onClose}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
            >
              OK
            </button>
          )}
          
          {autoClose && (
            <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
              <div className="bg-green-600 h-full rounded-full animate-progress"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}