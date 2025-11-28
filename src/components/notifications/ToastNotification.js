"use client"
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

const ToastContainer = ({ toasts, removeToast }) => {
  if (typeof window === 'undefined') return null

  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>,
    document.body
  )
}

const ToastItem = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    // Enter animation
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Auto dismiss
    if (toast.duration > 0) {
      const timer = setTimeout(() => {
        handleRemove()
      }, toast.duration)
      return () => clearTimeout(timer)
    }
  }, [toast.duration])

  const handleRemove = () => {
    setIsLeaving(true)
    setTimeout(() => onRemove(toast.id), 300) // Wait for exit animation
  }

  const handleClick = () => {
    if (toast.onClick) {
      toast.onClick()
    }
    handleRemove()
  }

  const getToastStyle = () => {
    const baseStyle = "pointer-events-auto transition-all duration-300 ease-in-out transform"
    const visibilityStyle = isVisible && !isLeaving 
      ? "translate-x-0 opacity-100" 
      : "translate-x-full opacity-0"
    
    switch (toast.type) {
      case 'success':
        return `${baseStyle} ${visibilityStyle} bg-green-50 border-l-4 border-green-400 shadow-lg`
      case 'error':
      case 'rejected':
        return `${baseStyle} ${visibilityStyle} bg-red-50 border-l-4 border-red-400 shadow-lg`
      case 'warning':
        return `${baseStyle} ${visibilityStyle} bg-yellow-50 border-l-4 border-yellow-400 shadow-lg`
      case 'info':
      default:
        return `${baseStyle} ${visibilityStyle} bg-blue-50 border-l-4 border-blue-400 shadow-lg`
    }
  }

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )
      case 'error':
      case 'rejected':
        return (
          <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        )
      case 'warning':
        return (
          <div className="w-5 h-5 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        )
      case 'info':
      default:
        return (
          <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
        )
    }
  }

  return (
    <div className={getToastStyle()}>
      <div 
        className={`max-w-sm w-full bg-white rounded-lg shadow-lg p-4 cursor-pointer hover:shadow-xl transition-shadow ${toast.onClick ? 'hover:bg-gray-50' : ''}`}
        onClick={handleClick}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">
              {toast.title}
            </div>
            {toast.message && (
              <div className="text-sm text-gray-500 mt-1">
                {toast.message}
              </div>
            )}
            {toast.subtitle && (
              <div className="text-xs text-gray-400 mt-1">
                {toast.subtitle}
              </div>
            )}
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleRemove()
              }}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Toast manager hook
export function useToast() {
  const [toasts, setToasts] = useState([])

  const addToast = (toast) => {
    const id = Date.now() + Math.random()
    const newToast = {
      id,
      type: 'info',
      duration: 4000, // 4 seconds default
      ...toast
    }

    setToasts(prev => [...prev, newToast])
    return id
  }

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  const showToast = {
    success: (title, message, options = {}) => addToast({ ...options, type: 'success', title, message }),
    error: (title, message, options = {}) => addToast({ ...options, type: 'error', title, message }),
    warning: (title, message, options = {}) => addToast({ ...options, type: 'warning', title, message }),
    info: (title, message, options = {}) => addToast({ ...options, type: 'info', title, message }),
    rejected: (title, message, options = {}) => addToast({ ...options, type: 'rejected', title, message })
  }

  return {
    toasts,
    showToast,
    removeToast,
    ToastContainer: () => <ToastContainer toasts={toasts} removeToast={removeToast} />
  }
}