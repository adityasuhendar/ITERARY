'use client'

import { useEffect, useRef, useState } from 'react'

export default function WeeklyRevenueChart({ data }) {
  const canvasRef = useRef(null)
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const chartData = data || []

  useEffect(() => {
    if (!data || data.length === 0) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height
    const padding = { top: 20, right: 20, bottom: 40, left: 60 }

    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Find max value
    const maxRevenue = Math.max(...chartData.map(d => d.revenue))
    const yScale = chartHeight / maxRevenue

    // Draw grid lines
    ctx.strokeStyle = '#f0f0f0'
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
      ctx.stroke()
    }

    // Draw Y axis labels
    ctx.fillStyle = '#6b7280'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 5; i++) {
      const value = maxRevenue - (maxRevenue / 5) * i
      const y = padding.top + (chartHeight / 5) * i
      const label = value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : `${Math.round(value / 1000)}K`
      ctx.fillText(label, padding.left - 10, y + 4)
    }

    // Draw X axis labels
    ctx.textAlign = 'center'
    chartData.forEach((point, i) => {
      const x = padding.left + (chartWidth / (chartData.length - 1)) * i
      ctx.fillText(point.day, x, height - padding.bottom + 20)
    })

    // Draw line
    ctx.strokeStyle = '#16a34a'
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()

    chartData.forEach((point, i) => {
      const x = padding.left + (chartWidth / (chartData.length - 1)) * i
      const y = padding.top + chartHeight - (point.revenue * yScale)

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    // Draw dots
    chartData.forEach((point, i) => {
      const x = padding.left + (chartWidth / (chartData.length - 1)) * i
      const y = padding.top + chartHeight - (point.revenue * yScale)

      ctx.fillStyle = '#16a34a'
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()
    })

  }, [chartData])

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const padding = { top: 20, right: 20, bottom: 40, left: 60 }
    const chartWidth = rect.width - padding.left - padding.right

    // Find closest point
    let closestIndex = -1
    let closestDistance = Infinity

    chartData.forEach((point, i) => {
      const pointX = padding.left + (chartWidth / (chartData.length - 1)) * i
      const distance = Math.abs(x - pointX)

      if (distance < 30 && distance < closestDistance) {
        closestDistance = distance
        closestIndex = i
      }
    })

    if (closestIndex >= 0) {
      setHoveredPoint(chartData[closestIndex])
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    } else {
      setHoveredPoint(null)
    }
  }

  const handleMouseLeave = () => {
    setHoveredPoint(null)
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">No data available</p>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full h-full"
        style={{ cursor: hoveredPoint ? 'pointer' : 'default' }}
      />

      {hoveredPoint && (
        <div
          className="absolute bg-white p-3 border border-gray-200 rounded-lg shadow-lg pointer-events-none"
          style={{
            left: `${tooltipPos.x + 10}px`,
            top: `${tooltipPos.y - 60}px`,
            transform: tooltipPos.x > 300 ? 'translateX(-100%)' : 'none'
          }}
        >
          <p className="text-sm font-semibold text-gray-900 mb-1">
            {hoveredPoint.day} ({hoveredPoint.date})
          </p>
          <p className="text-green-600 text-sm">
            <span className="text-gray-600">Revenue: </span>
            <span className="font-bold">{formatCurrency(hoveredPoint.revenue)}</span>
          </p>
          <p className="text-blue-600 text-sm">
            <span className="text-gray-600">Transaksi: </span>
            <span className="font-bold">{hoveredPoint.transactions}</span>
          </p>
        </div>
      )}
    </div>
  )
}
