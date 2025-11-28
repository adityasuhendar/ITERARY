// FILE: src/app/components/inventory/InventoryAlert.js
export function InventoryAlert({ inventory, onClick }) {
  if (!inventory || inventory.length === 0) return null

  const criticalItems = inventory.filter(item => 
    item.status === 'out_of_stock' || item.status === 'critical'
  )
  const lowItems = inventory.filter(item => item.status === 'low')

  if (criticalItems.length === 0 && lowItems.length === 0) return null

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 cursor-pointer hover:bg-red-100 transition" onClick={onClick}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-red-400 text-xl">⚠️</span>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            Peringatan Stok
          </h3>
          <div className="mt-2 text-sm text-red-700">
            {criticalItems.length > 0 && (
              <p className="mb-1">
                <strong>{criticalItems.length} produk</strong> habis/kritis: {' '}
                {criticalItems.slice(0, 3).map(item => item.nama_produk).join(', ')}
                {criticalItems.length > 3 && ` +${criticalItems.length - 3} lainnya`}
              </p>
            )}
            {lowItems.length > 0 && (
              <p>
                <strong>{lowItems.length} produk</strong> menipis
              </p>
            )}
          </div>
          <p className="mt-2 text-xs text-red-600">
            Klik untuk mengelola stok →
          </p>
        </div>
      </div>
    </div>
  )
}