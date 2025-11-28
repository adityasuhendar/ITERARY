/**
 * Utility functions for formatting currency, dates, and other common data
 * Used across the application to eliminate code duplication
 */

/**
 * Format currency to Indonesian Rupiah
 * @param {number} amount - The amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

/**
 * Format date to Indonesian full format (for receipts and displays)
 * @param {string|Date} dateString - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format date for thermal receipts (compact format)
 * @param {string|Date} dateString - Date to format
 * @returns {string} Compact formatted date string
 */
export const formatDateThermal = (dateString) => {
  return new Date(dateString).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format date only for receipts (without time)
 * @param {string|Date} dateString - Date to format
 * @returns {string} Date only
 */
export const formatDateOnly = (dateString) => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

/**
 * Format time only for receipts
 * @param {string|Date} dateString - Date to format
 * @returns {string} Time only with WIB
 */
export const formatTimeOnly = (dateString) => {
  const time = new Date(dateString).toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${time} WIB`
}

/**
 * Format date for thermal (compact, date only)
 * @param {string|Date} dateString - Date to format
 * @returns {string} Compact date only
 */
export const formatDateThermalOnly = (dateString) => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

/**
 * Format time for thermal (compact, time only)
 * @param {string|Date} dateString - Date to format
 * @returns {string} Compact time only with WIB
 */
export const formatTimeThermalOnly = (dateString) => {
  const time = new Date(dateString).toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${time} WIB`
}

/**
 * Format current date/time for printing timestamp
 * @returns {string} Current date formatted for Indonesian locale
 */
export const formatCurrentDateTime = () => {
  return new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta'
  })
}

/**
 * Format date for short display (dd/mm/yyyy)
 * @param {string|Date} dateString - Date to format
 * @returns {string} Short formatted date string
 */
export const formatDateShort = (dateString) => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

/**
 * Format time only (HH:MM)
 * @param {string|Date} dateString - Date to extract time from
 * @returns {string} Formatted time string
 */
export const formatTime = (dateString) => {
  return new Date(dateString).toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format date for WhatsApp (dd/mm/yy)
 * @param {string|Date} dateString - Date to format
 * @returns {string} Compact date format for WhatsApp
 */
export const formatDateWhatsApp = (dateString) => {
  return new Date(dateString).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format number with thousand separators (Indonesian style)
 * @param {number} number - Number to format
 * @returns {string} Formatted number string
 */
export const formatNumber = (number) => {
  return new Intl.NumberFormat('id-ID').format(number)
}