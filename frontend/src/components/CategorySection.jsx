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
    <div className="bg-[#1A2025] mb-2 rounded-xl border border-[#2A343C] overflow-hidden">
      <button
        onClick={() => onToggleExpand(category.id)}
        className="w-full flex items-center justify-between px-4 py-3 min-h-[44px] bg-[#1A2025] hover:bg-[#222C33] transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-[#8A9099] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-semibold text-[#F0EDE8]" style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>{category.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <span className="bg-[#00C0C8]/15 text-[#00C0C8] text-xs font-semibold px-2.5 py-1 rounded-full">
              {selectedCount}
            </span>
          )}
          <span className="text-xs text-[#8A9099]">{category.products.length} items</span>
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
