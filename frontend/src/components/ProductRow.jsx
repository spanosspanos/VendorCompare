import { useOrder } from '../context/OrderContext'

export default function ProductRow({ product }) {
  const { selectedItems, toggleItem, updateQuantity } = useOrder()
  const isSelected = !!selectedItems[product.id]
  const qty = selectedItems[product.id]?.quantity ?? 1

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => toggleItem(product)}
        className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 flex-shrink-0"
      />

      <span className={`flex-1 text-sm ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
        {product.name}
      </span>

      {isSelected && (
        <input
          type="number"
          min="1"
          value={qty === 0 ? '' : qty}
          onChange={(e) => updateQuantity(product.id, e.target.value === '' ? 0 : parseInt(e.target.value))}
          onBlur={(e) => {
            if (!e.target.value || parseInt(e.target.value) < 1) updateQuantity(product.id, 1)
          }}
          className="w-16 px-2 py-1 text-sm text-center border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      )}
    </div>
  )
}
