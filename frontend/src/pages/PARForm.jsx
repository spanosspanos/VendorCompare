import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PARRow from '../components/PARRow'
import { fetchProducts, getParSettings, assembleOrder, saveOrder } from '../api'
import { useOrder } from '../context/OrderContext'

export default function PARForm() {
  const navigate = useNavigate()
  const { upsertItem, clearAll } = useOrder()

  // Data from server
  const [categories, setCategories] = useState([])
  const [parMap, setParMap] = useState({})  // {product_id → par_value}
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Local pending order state — Inventory Count's own cart, never touches OrderContext on keystroke
  const [pendingOrder, setPendingOrder] = useState({})  // {product_id → {id, name, quantity}}

  // Form state
  const [actuals, setActuals] = useState({})       // {product_id → number}
  const [notes, setNotes] = useState({})            // {product_id → string} — only set on taco submit
  const [openTacos, setOpenTacos] = useState({})   // {product_id → bool} — tracks open taco inputs
  const [orderNote, setOrderNote] = useState('')    // notes_to_john
  const [assembling, setAssembling] = useState(false)
  const [assembleError, setAssembleError] = useState(null)

  useEffect(() => {
    Promise.all([fetchProducts(), getParSettings()])
      .then(([productsData, parRes]) => {
        setCategories(productsData)

        // Build parMap from par_settings list
        const map = {}
        parRes.data.forEach((s) => {
          map[s.product_id] = s.par_value
        })
        setParMap(map)
      })
      .catch((err) => {
        console.error(err)
        setError('Failed to load inventory data. Please try again.')
      })
      .finally(() => setLoading(false))
  }, [])

  const handleActualChange = (productId, value) => {
    setActuals((prev) => ({ ...prev, [productId]: value }))

    // Zero or empty means remove — no exceptions
    if (!value) {
      setPendingOrder((prev) => {
        const next = { ...prev }
        delete next[productId]
        return next
      })
      return
    }

    // Write to local pendingOrder only — never touches OrderContext on keystroke
    const parValue = parMap[productId] !== undefined ? parMap[productId] : null
    const effectivePAR = parValue !== null ? parValue : 0
    const orderQty = Math.max(0, effectivePAR - value)

    if (orderQty > 0) {
      setPendingOrder((prev) => ({
        ...prev,
        [productId]: { id: productId, name: productNameMap[productId] || '', quantity: orderQty },
      }))
    } else {
      setPendingOrder((prev) => {
        const next = { ...prev }
        delete next[productId]
        return next
      })
    }
  }

  const handleNoteChange = (productId, text) => {
    setNotes((prev) => ({ ...prev, [productId]: text }))
  }

  const handleTacoOpenChange = (productId, isOpen) => {
    setOpenTacos((prev) => ({ ...prev, [productId]: isOpen }))
  }

  const openTacoCount = Object.values(openTacos).filter(Boolean).length

  // Compute per-product derived values
  const productData = useMemo(() => {
    const map = {}
    categories.forEach((cat) => {
      cat.products.forEach((product) => {
        const parValue = parMap[product.id] !== undefined ? parMap[product.id] : null
        const actual = actuals[product.id] ?? 0
        const orderQty = parValue === null ? 0 : Math.max(0, parValue - actual)
        const flag =
          parValue === null ? 'no_par' :
          actual > parValue ? 'overstock' :
          null
        map[product.id] = { parValue, actual, orderQty, flag }
      })
    })
    return map
  }, [categories, parMap, actuals])

  const productNameMap = useMemo(() => {
    const map = {}
    categories.forEach((cat) => cat.products.forEach((p) => { map[p.id] = p.name }))
    return map
  }, [categories])

  const totalOrderItems = useMemo(() => {
    return Object.values(productData).filter((d) => d.orderQty > 0).length
  }, [productData])

  const hasFlags = useMemo(() => {
    return Object.values(productData).some((d) => d.flag !== null)
  }, [productData])

  const pendingCount = Object.keys(pendingOrder).length
  const savedTacoCount = Object.keys(notes).length

  const handleAssemble = async () => {
    if (assembling) return
    setAssembling(true)
    setAssembleError(null)

    // Explicit merge: wipe Quick Order cart, then push all pending items in
    clearAll()
    Object.values(pendingOrder).forEach((item) => {
      upsertItem({ id: item.id, name: item.name, quantity: item.quantity })
    })

    try {
      // Build items to assemble: only products with orderQty > 0
      const assembleItems = []
      const saveItemsMeta = {}  // product_id → {flag, item_note}

      categories.forEach((cat) => {
        cat.products.forEach((product) => {
          const { orderQty, flag } = productData[product.id]
          const effectiveQty = orderQty
          const itemNote = notes[product.id] || null

          if (effectiveQty > 0) {
            assembleItems.push({ product_id: product.id, quantity: effectiveQty })
            saveItemsMeta[product.id] = { flag, item_note: itemNote }
          }
          // Flagged items with qty=0 inform requires_review but aren't ordered
        })
      })

      if (assembleItems.length === 0 && savedTacoCount === 0) {
        setAssembleError('Nothing to order — all items are at or above PAR.')
        setAssembling(false)
        return
      }

      const requires_review = hasFlags || savedTacoCount > 0

      // Step 1: Assemble (skip if no orderable items — taco-only order)
      let assembleData
      if (assembleItems.length > 0) {
        assembleData = await assembleOrder(1, assembleItems)
      } else {
        assembleData = {
          vendor_orders: [],
          total_cost: 0,
          unpriced_items: [],
          comparison: { savings_vs_worst: 0, vendors: [] },
        }
      }

      // Step 2: Build save payload with flag + note metadata
      const saveItems = assembleData.vendor_orders.flatMap((vo) =>
        vo.items.map((item) => {
          const meta = saveItemsMeta[item.product_id] || {}
          return {
            product_id: item.product_id,
            quantity: item.quantity,
            selected_vendor_id: vo.vendor_id,
            unit_price: item.unit_price,
            line_total: item.line_total,
            item_note: meta.item_note || null,
            flag: meta.flag || null,
          }
        })
      )

      // Explicitly serialize NO PAR + taco items (flagged but unorderable — no PAR set)
      // Governing principle: every item type must be explicitly included or it silently drops
      categories.forEach((cat) => {
        cat.products.forEach((product) => {
          const { flag } = productData[product.id]
          if (flag === 'no_par' && notes[product.id] !== undefined) {
            saveItems.push({
              product_id: product.id,
              quantity: null,
              selected_vendor_id: null,
              unit_price: null,
              line_total: null,
              item_note: notes[product.id] || null,
              flag: 'no_par',
              taco: true,
            })
          }
        })
      })

      const savePayload = {
        location_id: 1,
        total_cost: assembleData.total_cost,
        savings_vs_worst: assembleData.comparison.savings_vs_worst,
        items: saveItems,
        vendor_splits: assembleData.vendor_orders.map((vo) => ({
          vendor_id: vo.vendor_id,
          total: vo.subtotal,
        })),
        notes_to_john: orderNote || null,
        requires_review,
        taco_flag_count: savedTacoCount,
      }

      // Step 3: Save
      const savedOrderRes = await saveOrder(savePayload)

      // Step 4: Navigate to OrderAssembly with pre-assembled result
      navigate('/order-assembly', {
        state: {
          fromPAR: true,
          assembledResult: assembleData,
          savedOrderId: savedOrderRes.data.id,
          requiresReview: requires_review,
          notesToJohn: orderNote || null,
          tacoFlagCount: savedTacoCount,
        },
      })
    } catch (err) {
      console.error('Assemble/save failed:', err)
      setAssembleError('Order assembly failed. Please try again.')
      setAssembling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500 text-sm">Loading inventory…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 px-6">
        <div className="text-center">
          <p className="text-red-500 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="pb-[76px]">
        {/* Column headers */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/80 border-b border-gray-200/60">
          <div className="flex-1 text-xs text-gray-400 font-medium uppercase tracking-wide">Item</div>
          <div className="w-12 text-center text-xs text-gray-400 font-medium uppercase tracking-wide">PAR</div>
          <div className="w-16 text-center text-xs text-gray-400 font-medium uppercase tracking-wide">On Hand</div>
          <div className="w-14 text-center text-xs text-gray-400 font-medium uppercase tracking-wide">Order</div>
          <div className="w-5" />
        </div>

        {/* Categories and products */}
        {categories.map((category) => (
          <div key={category.id}>
            {/* Category header */}
            <div className="px-3 py-2 bg-gray-50/50 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {category.name}
              </span>
            </div>
            {/* Product rows */}
            {category.products.map((product) => {
              const { parValue, actual, orderQty, flag } = productData[product.id] || { parValue: null, actual: 0, orderQty: 0, flag: 'no_par' }
              return (
                <PARRow
                  key={product.id}
                  product={product}
                  parValue={parValue}
                  inventoryActual={actual}
                  onActualChange={handleActualChange}
                  onNoteChange={handleNoteChange}
                  onOpenChange={handleTacoOpenChange}
                />
              )
            })}
          </div>
        ))}

        {/* Notes to John */}
        <div className="px-3 py-4 border-t border-gray-200 mt-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Notes to John
          </label>
          <textarea
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            placeholder="Any notes for John about this order…"
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-white text-gray-700"
          />
        </div>

        {/* Inline status messages (flags warning + error) */}
        <div className="px-3 pb-4">
          {assembleError && (
            <p className="text-red-500 text-xs text-center mb-2">{assembleError}</p>
          )}
          {hasFlags && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-amber-700 text-xs">
                Flagged items detected — this order will be sent to John for review.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky footer — same pattern as Quick Order footer in Home.jsx */}
      <footer className="fixed bottom-0 left-0 right-0 h-[70px] bg-white border-t border-gray-200 flex items-center justify-center px-4 z-50">
        <button
          onClick={handleAssemble}
          disabled={assembling || (pendingCount === 0 && savedTacoCount === 0) || openTacoCount > 0}
          className={`w-full max-w-md py-3 rounded-xl font-semibold text-sm transition-colors ${
            assembling
              ? 'bg-emerald-400 text-white cursor-not-allowed'
              : (pendingCount === 0 && savedTacoCount === 0) || openTacoCount > 0
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-emerald-600 text-white active:bg-emerald-700'
          }`}
        >
          {assembling ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Assembling…
            </span>
          ) : (
            <>
              Assemble Order
              {pendingCount > 0 && (
                <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {pendingCount} {pendingCount === 1 ? 'item' : 'items'}
                </span>
              )}
            </>
          )}
        </button>
      </footer>
    </>
  )
}
