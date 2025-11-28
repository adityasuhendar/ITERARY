import { useState } from 'react'

export default function StatsCard({ title, value, subtitle, icon, color = "blue", warning = false, warningMessage = "" }) {
  const [showTooltip, setShowTooltip] = useState(false)

  const colorClasses = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    yellow: "bg-yellow-100 text-yellow-600",
    red: "bg-red-100 text-red-600",
    purple: "bg-purple-100 text-purple-600",
    orange: "bg-orange-100 text-orange-600"
  }

  return (
    <div className={`rounded-lg shadow p-4 sm:p-6 relative group ${warning ? 'bg-orange-50' : 'bg-white'}`}>
      <div className="flex items-center">
        <div className={`p-2 sm:p-3 rounded-lg ${colorClasses[color]} flex-shrink-0`}>
          <span className="text-xl sm:text-2xl">{icon}</span>
        </div>
        <div className="ml-3 sm:ml-4 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs sm:text-sm text-dwash-gray truncate">{title}</p>
            {warning && (
              <span
                onClick={() => setShowTooltip(!showTooltip)}
                className="inline-flex items-center justify-center w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full cursor-pointer sm:cursor-help"
              >
                !
              </span>
            )}
          </div>
          <p className="text-lg sm:text-2xl font-bold text-dwash-dark truncate">{value}</p>
          {subtitle && (
            <p className="text-xs sm:text-sm text-dwash-gray mt-1 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {/* Tooltip - Desktop hover, Mobile click */}
      {warning && warningMessage && (
        <div className={`absolute top-2 right-2 bg-orange-600 text-white text-xs px-3 py-2 rounded shadow-lg whitespace-nowrap z-10 transition-opacity duration-200 ${
          showTooltip ? 'opacity-100 sm:opacity-0' : 'opacity-0'
        } sm:group-hover:opacity-100`}>
          {warningMessage}
        </div>
      )}
    </div>
  )
}