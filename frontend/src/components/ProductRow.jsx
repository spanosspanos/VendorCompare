import { useState, useEffect } from 'react'
import { useOrder } from '../context/OrderContext'

export default function ProductRow({ product }) {
  const { selectedItems, toggleItem, updateQuantity } = useOrder()
  const isSelected = !!selectedItems[product.id]
  const qty = selectedItems[product.id]?.quantity ?? 1
  const [draft, setDraft] = useState(String(qty))
  const [focused, setFocused] = useState(false)

  // Keep draft in sync with external qty changes (e.g. stepper from CartModal)
  useEffect(() => {
    if (!focused) setDraft(String(qty))
  }, [qty, focused])

  return (
    <div className="flex items-center gap-3 px-4 py-3 min-h-[44px] border-b border-[#2A343C] last:border-b-0">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => toggleItem(product)}
        className="w-5 h-5 rounded border-gray-300 text-[#00C0C8] focus:ring-[#00C0C8] flex-shrink-0"
      />

      <span className={`flex-1 ${isSelected ? 'text-base text-[#F0EDE8] font-medium' : 'text-sm text-[#8A9099]'}`}>
        {product.name}
      </span>

      {isSelected && (
        <input
          type="number"
          min="1"
          value={draft}
          onFocus={(e) => { setFocused(true); e.target.select() }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setFocused(false)
            const parsed = parseInt(draft)
            if (!draft || isNaN(parsed) || parsed < 1) {
              updateQuantity(product.id, 1)
              setDraft('1')
            } else {
              updateQuantity(product.id, parsed)
              setDraft(String(parsed))
            }
          }}
          className="w-14 px-2 py-2 text-sm text-center border border-[#2A343C] bg-[#0E1214] text-[#F0EDE8] focus:outline-none focus:ring-1 focus:ring-[#00C0C8] rounded-lg"
        />
      )}
    </div>
  )
}
