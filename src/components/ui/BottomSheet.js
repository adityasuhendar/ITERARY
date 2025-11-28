"use client"
import { useEffect, useRef, useState } from 'react'

// Bottom Sheet Component - Mobile-First Modal Alternative
export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  height = 'auto' // 'auto', 'half', 'full'
}) {
  const sheetRef = useRef(null)
  const contentRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startY, setStartY] = useState(0)
  const [currentY, setCurrentY] = useState(0)
  const [translateY, setTranslateY] = useState(0)
  const [startTime, setStartTime] = useState(0)

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setTranslateY(0) // Reset position when opening
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Touch event handlers for swipe-to-close with velocity detection
  const handleTouchStart = (e) => {
    // Check if content is scrollable and at top
    const content = contentRef.current
    const isContentScrollable = content && content.scrollHeight > content.clientHeight
    const isAtTop = content && content.scrollTop === 0

    // Only allow drag if:
    // 1. Content is not scrollable, OR
    // 2. Content is at top position
    if (!isContentScrollable || isAtTop) {
      setIsDragging(true)
      setStartY(e.touches[0].clientY)
      setCurrentY(e.touches[0].clientY)
      setStartTime(Date.now())
    }
  }

  const handleTouchMove = (e) => {
    if (!isDragging) return

    const newY = e.touches[0].clientY
    const diff = newY - startY

    // Only allow downward swipe
    if (diff > 0) {
      // Prevent default to stop content scrolling while dragging
      e.preventDefault()
      setCurrentY(newY)
      setTranslateY(diff)
    }
  }

  const handleTouchEnd = () => {
    if (!isDragging) return

    setIsDragging(false)

    const swipeDistance = currentY - startY
    const swipeTime = Date.now() - startTime
    const velocity = swipeDistance / swipeTime // px per ms

    // Close conditions:
    // 1. Fast swipe (velocity > 0.5 px/ms), OR
    // 2. Swiped down more than 100px (slow drag)
    const shouldClose = velocity > 0.5 || swipeDistance > 100

    if (shouldClose) {
      onClose()
    }

    // Reset position
    setTranslateY(0)
    setStartY(0)
    setCurrentY(0)
    setStartTime(0)
  }

  const heightClasses = {
    'auto': 'max-h-[85vh]',
    'half': 'h-[50vh]',
    'full': 'h-[90vh]'
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-black z-40
          transition-opacity duration-300
          ${isOpen ? 'opacity-50' : 'opacity-0'}
        `}
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={`
          fixed bottom-0 left-0 right-0 z-50
          bg-white rounded-t-3xl
          ${heightClasses[height]}
          ${isDragging ? '' : 'transition-transform duration-300 ease-out'}
          ${isOpen ? 'translate-y-0' : 'translate-y-full'}
          shadow-2xl
        `}
        style={{
          transform: isDragging ? `translateY(${translateY}px)` : undefined
        }}
      >
        {/* Handle Bar - Swipeable Area */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        {/* Header - Also Draggable */}
        {title && (
          <div
            className="flex items-center justify-between px-6 py-4 border-b border-gray-200 cursor-grab active:cursor-grabbing"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 -mr-2"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content - Draggable when at top */}
        <div
          ref={contentRef}
          className="overflow-y-auto p-6"
          style={{ maxHeight: 'calc(85vh - 80px)' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {children}
        </div>
      </div>
    </>
  )
}
