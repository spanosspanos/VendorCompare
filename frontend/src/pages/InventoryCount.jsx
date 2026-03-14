import PageHeader from '../components/PageHeader'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrder } from '../context/OrderContext'
import { fetchProducts } from '../api'

export default function InventoryCount() {
  const [categories, setCategories] = useState([])
  const [expandedCategories, setExpandedCategories] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [onHand, setOnHand] = useState({})    // { [product.id]: string }
  const { clearAll, upsertItem } = useOrder()
  const navigate = useNavigate()

  useEffect(() => {
    fetchProducts()
      .then((data) => {
        setCategories(data)
        // expand all categories by default
        const expanded = {}
        data.forEach(cat => { expanded[cat.id] = true })
        setExpandedCategories(expanded)
      })
      .catch((err) => {
        setError('Failed to load products. Please try again.')
        console.error(err)
      })
      .finally(() => setLoading(false))
  }, [])

  const toggleExpand = (categoryId) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }))
  }

  // Filter out muted and deleted items, then apply search
  const filteredCategories = useMemo(() => {
    const filtered = categories.map(cat => ({
      ...cat,
      products: cat.products.filter(p => !p.muted && !p.is_deleted)
    })).filter(cat => cat.products.length > 0)

    if (!search.trim()) return filtered
    const term = search.toLowerCase()
    return filtered.map(cat => ({
      ...cat,
      products: cat.products.filter(p => p.name.toLowerCase().includes(term))
    })).filter(cat => cat.products.length > 0)
  }, [categories, search])

  // Build pending order from on-hand values
  const pendingOrder = useMemo(() => {
    const items = {}
    // Flatten all products to look up PAR
    const allProducts = categories.flatMap(cat => cat.products)
    for (const product of allProducts) {
      if (product.muted || product.is_deleted) continue
      const oh = parseInt(onHand[product.id] ?? '')
      if (isNaN(oh)) continue
      const parValue = product.par_value ?? 0
      const orderQty = Math.max(0, parValue - oh)
      if (orderQty > 0) {
        items[product.id] = { id: product.id, name: product.name, quantity: orderQty, par: parValue, onHand: oh }
      }
    }
    return items
  }, [onHand, categories])

  const pendingCount = Object.keys(pendingOrder).length

  const handleAssemble = () => {
    clearAll()
    Object.values(pendingOrder).forEach(item => {
      upsertItem({ id: item.id, name: item.name, quantity: item.quantity })
    })
    navigate('/order-assembly')
  }

  const handleOnHandChange = (productId, value) => {
    setOnHand(prev => ({ ...prev, [productId]: value }))
  }

  const handleInputFocus = (e) => {
    e.target.select()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0E1214]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#00C0C8] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#8A9099] text-sm">Loading products…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0E1214]">
        <div className="text-center px-6">
          <p className="text-red-500 mb-4 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#00C0C8] text-[#0E1214] rounded-full text-sm font-bold"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#0E1214]">
      <PageHeader title="Inventory Count" />

      <main className="flex-1 overflow-y-auto pt-[60px] pb-[70px] px-3 py-3">
        {/* Search */}
        <div className="px-0 pt-3 pb-2">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full text-sm border border-[#2A343C] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00C0C8] bg-[#0E1214] text-[#F0EDE8] placeholder:text-[#8A9099]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A9099] hover:text-[#F0EDE8] transition-colors"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Column headers */}
        <div className="flex items-center px-4 py-2 text-xs font-semibold text-[#8A9099] uppercase tracking-wider">
          <span className="flex-1">Item</span>
          <span className="w-16 text-center">PAR</span>
          <span className="w-20 text-center">On Hand</span>
          <span className="w-16 text-center">Order</span>
        </div>

        {filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <p className="text-[#8A9099] text-sm">No products found.</p>
          </div>
        ) : (
          filteredCategories.map((category) => (
            <div key={category.id} className="bg-[#1A2025] mb-2 rounded-xl border border-[#2A343C] overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleExpand(category.id)}
                className="w-full flex items-center justify-between px-4 py-3 min-h-[44px] bg-[#1A2025] hover:bg-[#222C33] transition-colors duration-150"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 text-[#8A9099] transition-transform ${expandedCategories[category.id] ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-semibold text-[#F0EDE8]" style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>{category.name}</span>
                </div>
                <span className="text-xs text-[#8A9099]">{category.products.length}</span>
              </button>

              {/* Product rows */}
              {expandedCategories[category.id] && category.products.map((product) => {
                const parValue = product.par_value ?? 0
                const ohValue = onHand[product.id] ?? ''
                const ohNum = parseInt(ohValue)
                const orderQty = !isNaN(ohNum) ? Math.max(0, parValue - ohNum) : null
                const hasNotes = product.notes && product.notes.trim().length > 0

                return (
                  <div key={product.id} className="border-t border-[#2A343C]">
                    <div className="flex items-center px-4 py-2.5">
                      {/* Product name */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-[#F0EDE8] truncate block">
                          {product.name}
                          {hasNotes && <span className="ml-1" title={product.notes}>🌮</span>}
                        </span>
                      </div>

                      {/* PAR value */}
                      <span className="w-16 text-center text-sm text-[#8A9099]">
                        {product.par_value != null ? product.par_value : '—'}
                      </span>

                      {/* On Hand input */}
                      <div className="w-20 flex justify-center">
                        <input
                          type="number"
                          min="0"
                          value={ohValue}
                          onChange={(e) => handleOnHandChange(product.id, e.target.value)}
                          onFocus={handleInputFocus}
                          placeholder="—"
                          className="w-16 text-center text-sm border border-[#2A343C] rounded-lg py-2 px-1 focus:outline-none focus:ring-2 focus:ring-[#00C0C8] focus:border-transparent bg-[#0E1214] text-[#F0EDE8] min-h-[36px]"
                        />
                      </div>

                      {/* Order Qty */}
                      <span className={`w-16 text-center text-sm font-semibold ${orderQty && orderQty > 0 ? 'text-[#00C0C8]' : 'text-[#8A9099]'}`}>
                        {orderQty != null ? orderQty : '—'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </main>

      {/* Assemble Order footer */}
      <footer className="fixed bottom-0 left-0 right-0 h-[70px] bg-[#1A2025] border-t border-[#2A343C] flex items-center justify-center px-4 z-50">
        <button
          className={`w-full max-w-md py-3 min-h-[44px] font-bold text-base transition-colors ${
            pendingCount > 0
              ? 'bg-[#00C0C8] text-[#0E1214] rounded-full active:opacity-90'
              : 'bg-[#2A343C] text-[#8A9099] rounded-full cursor-not-allowed'
          }`}
          disabled={pendingCount === 0}
          onClick={handleAssemble}
        >
          Assemble Order
          {pendingCount > 0 && (
            <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {pendingCount} {pendingCount === 1 ? 'item' : 'items'}
            </span>
          )}
        </button>
      </footer>
    </div>
  )
}
