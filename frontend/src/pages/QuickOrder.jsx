import PageHeader from '../components/PageHeader'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import CategorySection from '../components/CategorySection'
import CartModal from '../components/CartModal'
import { useOrder } from '../context/OrderContext'
import { fetchProducts } from '../api'
import { countAssembledOrders } from '../utils/assembledOrders'

export default function QuickOrder() {
  const [categories, setCategories] = useState([])
  const [expandedCategories, setExpandedCategories] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { selectedItems, clearAll, upsertItem } = useOrder()
  const navigate = useNavigate()
  const location = useLocation()
  const draftTimestampRef = useRef(new Date().toISOString())
  const draftTokenRef = useRef(`D-${Math.floor(1000 + Math.random() * 9000)}`)

  useEffect(() => {
    fetchProducts()
      .then((data) => {
        setCategories(data)
      })
      .catch((err) => {
        setError('Failed to load products. Please try again.')
        console.error(err)
      })
      .finally(() => setLoading(false))
  }, [])

  // Restore order items when coming back from Margarita Glass reopen
  useEffect(() => {
    const restoredOrder = location.state?.restoredOrder
    if (restoredOrder && restoredOrder.items && restoredOrder.items.length > 0) {
      clearAll()
      restoredOrder.items.forEach((item) => {
        if (item.product_id && item.quantity > 0) {
          upsertItem({ id: item.product_id, name: item.product_name, quantity: item.quantity })
        }
      })
    }
  }, [location.state?.restoredOrder])

  const toggleExpand = (categoryId) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }))
  }

  const totalSelected = Object.keys(selectedItems).length
  const [cartOpen, setCartOpen] = useState(false)
  const [assembledCount, setAssembledCount] = useState(countAssembledOrders())
  const [orderNote, setOrderNote] = useState('')

  useEffect(() => {
    setAssembledCount(countAssembledOrders())
  }, [cartOpen])
  const [search, setSearch] = useState('')

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories
    const term = search.toLowerCase()
    return categories.map(cat => ({
      ...cat,
      products: cat.products.filter(p => p.name.toLowerCase().includes(term))
    })).filter(cat => cat.products.length > 0)
  }, [categories, search])

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
      <PageHeader
        title={`New Order #${draftTokenRef.current}`}
        rightContent={
          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2 flex items-center"
            aria-label="View cart"
          >
            <span className="px-1 text-xl leading-none">📋</span>
            {(totalSelected + assembledCount) > 0 && (
              <span className="absolute top-0 right-0 bg-[#00C0C8] text-[#0E1214] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {totalSelected + assembledCount}
              </span>
            )}
          </button>
        }
      />
      <CartModal isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      <main data-tour="quick-order-main" className="flex-1 overflow-y-auto pt-[60px] pb-[70px] px-3 py-3">
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

        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <p className="text-[#8A9099] text-sm">No products found.</p>
          </div>
        ) : (
          filteredCategories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              isExpanded={search.trim() ? true : !!expandedCategories[category.id]}
              onToggleExpand={toggleExpand}
            />
          ))
        )}

        {/* Notes to John */}
        <div className="px-3 py-4 border-t border-[#2A343C] mt-2">
          <label className="block text-xs font-semibold text-[#8A9099] uppercase tracking-wide mb-2">
            Notes to John
          </label>
          <textarea
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            placeholder="Any notes for John about this order…"
            rows={3}
            className="w-full text-sm border border-[#2A343C] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00C0C8] resize-none bg-[#0E1214] text-[#F0EDE8] placeholder:text-[#8A9099]"
          />
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-[70px] bg-[#1A2025] border-t border-[#2A343C] flex items-center justify-center px-4 z-50">
        <button
          className={`w-full max-w-md py-3 min-h-[44px] font-bold text-base transition-colors ${
            totalSelected > 0
              ? 'bg-[#00C0C8] text-[#0E1214] rounded-full active:opacity-90'
              : 'bg-[#2A343C] text-[#8A9099] rounded-full cursor-not-allowed'
          }`}
          disabled={totalSelected === 0}
          onClick={() => navigate('/order-assembly', { state: { notesToJohn: orderNote || null, origin_route: 'quick_order', draft_timestamp: draftTimestampRef.current, draft_token: draftTokenRef.current } })}
        >
          Assemble Orders
          {totalSelected > 0 && (
            <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {totalSelected} {totalSelected === 1 ? 'item' : 'items'}
            </span>
          )}
        </button>
      </footer>
    </div>
  )
}
