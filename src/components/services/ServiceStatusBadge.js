/**
 * Service Status Badge Component
 * Shows visual indicator for service status with appropriate colors and text
 */

const ServiceStatusBadge = ({ status, className = "" }) => {
  const statusConfig = {
    planned: {
      color: 'gray',
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-300',
      label: 'Belum Mulai',
      icon: '⏳'
    },
    active: {
      color: 'blue',
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-300',
      label: 'Sedang Jalan',
      icon: '🔵'
    },
    queued: {
      color: 'yellow',
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      border: 'border-yellow-300',
      label: 'Antri',
      icon: '🟡'
    },
    completed: {
      color: 'green',
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-300',
      label: 'Selesai',
      icon: '✅'
    },
    cancelled: {
      color: 'red',
      bg: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-300',
      label: 'Dibatalkan',
      icon: '❌'
    }
  }

  const config = statusConfig[status] || statusConfig.planned

  return (
    <span className={`
      inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
      ${config.bg} ${config.text} ${config.border} border
      ${className}
    `}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  )
}

export default ServiceStatusBadge