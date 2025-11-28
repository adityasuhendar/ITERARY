// Floating Action Button (FAB) - Mobile-First Primary Action
export default function FloatingActionButton({
  onClick,
  icon = '+',
  label,
  className = '',
  position = 'bottom-right' // bottom-right, bottom-left, bottom-center
}) {
  const positionClasses = {
    'bottom-right': 'bottom-20 right-6',
    'bottom-left': 'bottom-20 left-6',
    'bottom-center': 'bottom-20 left-1/2 -translate-x-1/2'
  }

  return (
    <button
      onClick={onClick}
      className={`
        fixed ${positionClasses[position]} z-50
        w-12 h-12
        bg-orange-500 hover:bg-orange-600 active:bg-orange-700
        text-white
        rounded-full
        shadow-lg hover:shadow-xl
        flex items-center justify-center
        transition-all duration-200
        hover:scale-110 active:scale-95
        group
        ${className}
      `}
      aria-label={label || 'Add'}
    >
      {typeof icon === 'string' ? (
        <span className="text-xl font-light">{icon}</span>
      ) : (
        icon
      )}

      {/* Tooltip on hover (desktop) */}
      {label && (
        <span className="
          absolute right-full mr-3
          px-3 py-2
          bg-gray-900 text-white text-sm
          rounded-lg
          whitespace-nowrap
          opacity-0 group-hover:opacity-100
          transition-opacity duration-200
          pointer-events-none
          hidden sm:block
        ">
          {label}
        </span>
      )}
    </button>
  )
}
