import ProductRow from './ProductRow'
import { useOrder } from '../context/OrderContext'

export default function CategorySection({
  category,
  isExpanded,
  onToggleExpand,
}) {
  const { selectedItems } = useOrder()
  const selectedCount = category.products.filter((p) => selectedItems[p.id]).length

  return (
    <div className="bg-white mb-2 rounded-lg shadow-sm overflow-hidden">
      <button
        onClick={() => onToggleExpand(category.id)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-semibold text-gray-800">{category.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <span className="bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {selectedCount}
            </span>
          )}
          <span className="text-xs text-gray-400">{category.products.length} items</span>
        </div>
      </button>

      {isExpanded && (
        <div>
          {category.products.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
            />
          ))}
        </div>
      )}
    </div>
  )
}
