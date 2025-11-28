// Skeleton Loader Component - Modern Loading State
export default function SkeletonLoader({ type = 'card', count = 3 }) {
  if (type === 'card') {
    return (
      <div className="space-y-3">
        {[...Array(count)].map((_, i) => (
          <div key={i} className="animate-pulse bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="flex space-x-2 ml-3">
                <div className="h-8 w-8 bg-gray-200 rounded-lg"></div>
                <div className="h-8 w-8 bg-gray-200 rounded-lg"></div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center space-y-2">
                <div className="h-3 bg-gray-200 rounded w-16 mx-auto"></div>
                <div className="h-6 bg-gray-200 rounded w-20 mx-auto"></div>
              </div>
              <div className="text-center space-y-2">
                <div className="h-3 bg-gray-200 rounded w-16 mx-auto"></div>
                <div className="h-6 bg-gray-200 rounded w-20 mx-auto"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'table') {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-7 gap-4 px-6 py-3 bg-gray-50 rounded">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded"></div>
          ))}
        </div>
        {[...Array(count)].map((_, i) => (
          <div key={i} className="grid grid-cols-7 gap-4 px-6 py-4 border-b">
            {[...Array(7)].map((_, j) => (
              <div key={j} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  return null
}
