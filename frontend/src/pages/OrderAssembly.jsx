import SombreroHome from '../components/SombreroHome'
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useOrder } from '../context/OrderContext'
import { assembleOrder, saveOrder, patchOrder } from '../api'
import { saveAssembledOrder, removeAssembledOrder } from '../utils/assembledOrders'

const DEFAULT_LOCATION_ID = 1

const round2 = (n) => Math.round(n * 100) / 100

const TOUR_DEMO_ITEMS = [
  { product_id: 9001, product_name: 'Roma Tomatoes', quantity: 4, vendor_name: 'US Foods', unit_price: 18.50, line_total: 74.00, unit: 'cs' },
  { product_id: 9002, product_name: 'Chicken Thighs', quantity: 6, vendor_name: 'Food Direct', unit_price: 32.00, line_total: 192.00, unit: 'cs' },
  { product_id: 9003, product_name: 'Limes', quantity: 2, vendor_name: 'Riviera Produce', unit_price: 14.00, line_total: 28.00, unit: 'bg' },
]
const TOUR_DEMO_TOTAL = 294.00

export default function OrderAssembly() {
  const { getItemsArray } = useOrder()
  const navigate = useNavigate()
  const location = useLocation()

  // Flow detection
  const isTourMode = !!location.state?._tourMode
  const parState = location.state?.fromPAR ? location.state : null
  const pendingOrderState = location.state?.fromPendingOrder ? location.state : null
  // Resume from Clipboard waiting room
  const assembledOrderState = (location.state?.assembledOrderId && location.state?.vendor_orders) ? location.state : null

  const [result, setResult] = useState(
    parState?.assembledResult ||
    (assembledOrderState ? {
      vendor_orders: assembledOrderState.vendor_orders,
      total_cost: assembledOrderState.total_cost,
      comparison: assembledOrderState.comparison,
    } : null)
  )
  const [loading, setLoading] = useState(!parState && !pendingOrderState && !assembledOrderState)
  const [currentAssembledOrderId, setCurrentAssembledOrderId] = useState(
    assembledOrderState?.assembledOrderId || null
  )
  const [error, setError] = useState(null)
  const [saveState, setSaveState] = useState('idle') // 'idle'|'saving'|'saved'|'error'
  const [savedOrderMeta, setSavedOrderMeta] = useState(null) // { id, created_at } after save

  // Inline editing state
  const [editedQtys, setEditedQtys] = useState({})
  const [editedNotes, setEditedNotes] = useState({})
  const [recalculating, setRecalculating] = useState(false)
  const [search, setSearch] = useState('')
  const [manualFlags, setManualFlags] = useState({})
  const [manualFlagNotes, setManualFlagNotes] = useState({})
  const [openFlagDrawers, setOpenFlagDrawers] = useState({})
  const [orderReviewNote, setOrderReviewNote] = useState(
    location.state?.notesToJohn || parState?.notesToJohn || pendingOrderState?.order?.notes_to_john || ''
  )

  useEffect(() => {
    // PAR, pending, and assembled-order-resume flows skip the assembly API call
    if (parState || pendingOrderState || assembledOrderState) return

    const items = getItemsArray()
    if (items.length === 0) {
      if (location.state?._tourMode) {
        setLoading(false)
        return
      }
      navigate('/')
      return
    }

    assembleOrder(1, items)
      .then((data) => {
        setResult(data)
        // Park assembled order in waiting room immediately so it survives navigation
        const id = crypto.randomUUID()
        setCurrentAssembledOrderId(id)
        saveAssembledOrder({
          id,
          timestamp: new Date().toISOString(),
          label: `Order · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          vendorOrders: data.vendor_orders,
          totalCost: data.total_cost,
          savingsVsWorst: data.comparison?.savings_vs_worst ?? 0,
          comparison: data.comparison,
          notesToJohn: location.state?.notesToJohn || null,
          tacoFlagCount: 0,
          requiresReview: false,
          locationId: DEFAULT_LOCATION_ID,
        })
      })
      .catch(() => setError('Order assembly failed. Please try again.'))
      .finally(() => setLoading(false))
  }, [])

  // Auto-recalculate for Quick Order only
  useEffect(() => {
    if (parState || pendingOrderState || Object.keys(editedQtys).length === 0 || !result) return
    const timer = setTimeout(async () => {
      if (recalculating) return
      const baseItems = result.vendor_orders.flatMap((vo) => vo.items)
      const items = baseItems
        .map((item) => ({
          product_id: item.product_id,
          quantity: editedQtys[item.product_id] !== undefined ? editedQtys[item.product_id] : item.quantity,
        }))
        .filter((item) => item.quantity > 0)
      if (items.length === 0) return
      setRecalculating(true)
      try {
        const newResult = await assembleOrder(DEFAULT_LOCATION_ID, items)
        setResult(newResult)
        setEditedQtys({})
      } catch {
        // keep existing result on failure
      } finally {
        setRecalculating(false)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [editedQtys])

  // ── Item helpers ──────────────────────────────────────────────────────────

  const getDisplayItems = () => {
    if (isTourMode && !parState && !pendingOrderState) return TOUR_DEMO_ITEMS
    if (parState) {
      // New format: allItems from PARForm (includes flagged items)
      if (parState.allItems) return parState.allItems
      // Fallback: old format (pre-006g)
      return result ? result.vendor_orders.flatMap((vo) => vo.items) : []
    }
    if (pendingOrderState) {
      return pendingOrderState.order.items || []
    }
    if (result) {
      return result.vendor_orders.flatMap((vo) => vo.items)
    }
    return []
  }

  const getFlagCount = () => {
    if (parState) {
      return (parState.allItems || []).filter((i) => i.flag).length || (parState.tacoFlagCount || 0)
    }
    if (pendingOrderState) {
      return (pendingOrderState.order.items || []).filter((i) => i.flag).length
    }
    // Quick Order: count manually flagged items
    return Object.values(manualFlags).filter(Boolean).length
  }

  // ── Save handlers ─────────────────────────────────────────────────────────

  const buildFinalItems = (sourceItems) => {
    return sourceItems.map((item) => {
      const qty = editedQtys[item.product_id] !== undefined ? editedQtys[item.product_id] : (item.quantity ?? 0)
      const note = editedNotes[item.product_id] !== undefined ? editedNotes[item.product_id] : (item.item_note || null)
      const lineTotal = (item.unit_price > 0 && qty > 0) ? round2(qty * item.unit_price) : (item.line_total > 0 ? item.line_total : null)

      // Quick Order manual taco flag
      const manualFlag = (!isPAR && !isPending && manualFlags[item.product_id]) ? 'taco' : null
      const manualNote = (!isPAR && !isPending && manualFlags[item.product_id])
        ? (manualFlagNotes[item.product_id] || null)
        : null

      return {
        product_id: item.product_id,
        quantity: qty,
        selected_vendor_id: item.selected_vendor_id || null,
        unit_price: item.unit_price > 0 ? item.unit_price : null,
        line_total: lineTotal,
        flag: manualFlag || item.flag || null,
        item_note: manualNote || note,
      }
    })
  }

  const buildVendorSplits = (finalItems) => {
    const vendorTotals = {}
    finalItems.forEach((item) => {
      if (item.selected_vendor_id && item.unit_price > 0 && item.quantity > 0) {
        const vid = item.selected_vendor_id
        vendorTotals[vid] = round2((vendorTotals[vid] || 0) + round2(item.quantity * item.unit_price))
      }
    })
    return Object.entries(vendorTotals).map(([vendor_id, total]) => ({
      vendor_id: Number(vendor_id),
      total,
    }))
  }

  const handleSaveQuickOrder = async () => {
    if (!result) return
    setSaveState('saving')
    const manualFlagCount = Object.values(manualFlags).filter(Boolean).length
    const items = result.vendor_orders.flatMap((vo) =>
      vo.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        selected_vendor_id: vo.vendor_id,
        unit_price: item.unit_price,
        line_total: item.line_total,
        flag: manualFlags[item.product_id] ? 'taco' : null,
        item_note: manualFlags[item.product_id] ? (manualFlagNotes[item.product_id] || null) : null,
      }))
    )
    const payload = {
      location_id: DEFAULT_LOCATION_ID,
      total_cost: result.total_cost,
      savings_vs_worst: result.comparison?.savings_vs_worst ?? 0,
      notes_to_john: orderReviewNote || null,
      requires_review: true,
      items,
      vendor_splits: result.vendor_orders.map((vo) => ({
        vendor_id: vo.vendor_id,
        total: vo.subtotal,
      })),
      comparison: result.comparison || null,
      origin_route: location.state?.origin_route || null,
    }
    try {
      const res = await saveOrder(payload)
      if (currentAssembledOrderId) {
        removeAssembledOrder(currentAssembledOrderId)
      }
      if (res?.data?.id && res?.data?.created_at) {
        setSavedOrderMeta({ id: res.data.id, created_at: res.data.created_at })
      }
      setSaveState('saved')
      window.dispatchEvent(new CustomEvent('orderSaved'))
      setTimeout(() => navigate('/'), 1500)
    } catch {
      setSaveState('error')
    }
  }

  const handleSavePAR = async () => {
    setSaveState('saving')
    try {
      const sourceItems = parState.allItems || []
      const finalItems = buildFinalItems(sourceItems)
      const vendorSplits = buildVendorSplits(finalItems)
      const totalCost = round2(vendorSplits.reduce((sum, vs) => sum + vs.total, 0))
      const template = parState.saveTemplate || {}
      const payload = {
        location_id: template.location_id || DEFAULT_LOCATION_ID,
        total_cost: totalCost || template.total_cost || 0,
        savings_vs_worst: template.savings_vs_worst || 0,
        notes_to_john: orderReviewNote || null,
        requires_review: template.requires_review !== false,
        taco_flag_count: template.taco_flag_count || 0,
        items: finalItems,
        vendor_splits: vendorSplits,
      }
      await saveOrder(payload)
      setSaveState('saved')
      window.dispatchEvent(new CustomEvent('orderSaved'))
      setTimeout(() => navigate('/'), 1500)
    } catch {
      setSaveState('error')
    }
  }

  const handleSavePending = async () => {
    const order = pendingOrderState.order
    if (!order?.id) { setSaveState('error'); return }
    setSaveState('saving')
    try {
      const sourceItems = order.items || []
      const finalItems = buildFinalItems(sourceItems)
      const vendorSplits = buildVendorSplits(finalItems)
      const totalCost = round2(vendorSplits.reduce((sum, vs) => sum + vs.total, 0))
      await patchOrder(order.id, {
        items: finalItems,
        vendor_splits: vendorSplits,
        total_cost: totalCost || order.total_cost || 0,
        savings_vs_worst: order.savings_vs_worst ?? 0,
        review_status: 'pending',
        notes_to_john: orderReviewNote || null,
      })
      setSaveState('saved')
      window.dispatchEvent(new CustomEvent('orderSaved'))
      setTimeout(() => navigate('/'), 1500)
    } catch {
      setSaveState('error')
    }
  }

  const handleBack = () => {
    if (pendingOrderState) {
      const origin = pendingOrderState.order.origin_route
      if (origin === 'quick_order') {
        navigate('/quick-order', { state: { restoredOrder: pendingOrderState.order } })
      } else if (origin === 'inventory_count') {
        navigate('/inventory', { state: { restoredOrder: pendingOrderState.order } })
      } else {
        // NULL origin_route — graceful fallback
        navigate('/')
      }
    } else {
      // Normal (non-reopen) flow — existing behavior
      navigate(-1)
    }
  }

  const handleSave = () => {
    if (pendingOrderState) return handleSavePending()
    if (parState) return handleSavePAR()
    return handleSaveQuickOrder()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div data-tour="order-assembly-main" className="flex flex-col h-screen bg-[#0E1214]">
        <header className="relative fixed top-0 left-0 right-0 h-[60px] bg-[#0E1214] text-white flex items-center justify-center px-4 z-50 shadow-md">
          <h1 className="text-lg text-[#F0EDE8]" style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>Order Review</h1>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-[#D4A017] opacity-45" />
        </header>
        <div className="flex-1 flex items-center justify-center pt-[60px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-[#00C0C8] border-t-transparent rounded-full animate-spin" />
            <span className="text-[#8A9099] text-sm">Assembling your order…</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div data-tour="order-assembly-main" className="flex flex-col h-screen bg-[#0E1214]">
        <header className="relative fixed top-0 left-0 right-0 h-[60px] bg-[#0E1214] text-white flex items-center justify-center px-4 z-50 shadow-md">
          <h1 className="text-lg text-[#F0EDE8]" style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>Order Review</h1>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-[#D4A017] opacity-45" />
        </header>
        <div className="flex-1 flex items-center justify-center pt-[60px]">
          <div className="text-center px-6">
            <p className="text-red-500 mb-4">{error}</p>
            <button onClick={() => navigate('/')} className="px-4 py-2 bg-[#00C0C8] text-[#0E1214] rounded-full text-sm font-bold">Back to Catalog</button>
          </div>
        </div>
      </div>
    )
  }

  const displayItems = getDisplayItems()
  const filteredItems = search.trim()
    ? displayItems.filter((item) => (item.product_name || '').toLowerCase().includes(search.toLowerCase()))
    : displayItems
  const flagCount = getFlagCount()
  const unpriced_items = result?.unpriced_items || []
  const isPAR = !!parState
  const isPending = !!pendingOrderState

  const pendingEmployeeName = isPending && pendingOrderState.order.employee_name ? pendingOrderState.order.employee_name : null
  const formatOrderDate = (isoStr) => new Date(isoStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
  const draftTimestamp = location.state?.draft_timestamp
  const draftToken = location.state?.draft_token

  let primaryTitle, secondaryLine
  if (isTourMode) {
    primaryTitle = 'Order #DEMO-001'
    secondaryLine = null
  } else if (isPending) {
    primaryTitle = pendingEmployeeName ? `Order #${pendingOrderState.order.id} · ${pendingEmployeeName}` : `Order #${pendingOrderState.order.id}`
    secondaryLine = null
  } else if (savedOrderMeta) {
    primaryTitle = `Order #${savedOrderMeta.id}`
    secondaryLine = formatOrderDate(savedOrderMeta.created_at)
  } else {
    primaryTitle = draftToken ? `New Order #${draftToken}` : 'New Order'
    secondaryLine = draftTimestamp ? formatOrderDate(draftTimestamp) : null
  }

  const SaveButton = (
    <button
      onClick={handleSave}
      disabled={saveState === 'saving' || saveState === 'saved'}
      className={`flex-1 py-3 min-h-[50px] rounded-full font-bold text-base transition-colors ${
        saveState === 'saved'
          ? 'bg-[#3DAA6E] text-[#0E1214] cursor-not-allowed'
          : saveState === 'error'
          ? 'bg-[#C23B3B] text-white active:opacity-90'
          : saveState === 'saving'
          ? 'bg-[#007F85] text-[#0E1214] cursor-not-allowed'
          : 'bg-[#00C0C8] text-[#0E1214] active:opacity-90'
      }`}
    >
      {saveState === 'saving' && (
        <span className="flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Saving…
        </span>
      )}
      {saveState === 'saved' && '✓ Saved'}
      {saveState === 'error' && 'Save Failed — Retry?'}
      {saveState === 'idle' && (isPending ? 'Save Changes' : 'Save Order')}
    </button>
  )

  return (
    <div data-tour="order-assembly-main" className="flex flex-col h-screen bg-[#0E1214]">
      {/* Header */}
      <header className="relative fixed top-0 left-0 right-0 h-[60px] bg-[#0E1214] text-white flex items-center justify-center px-4 z-50 shadow-md">
        <button onClick={() => navigate('/')} className="absolute left-4" aria-label="Home"><SombreroHome /></button>
        <div className="flex flex-col items-center">
          <h1 className="text-lg text-[#F0EDE8]" style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>{primaryTitle}</h1>
          {secondaryLine && (
            <p className="text-xs text-[#8A9099] mt-0.5">{secondaryLine}</p>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-[#D4A017] opacity-45" />
      </header>

      {/* Scrollable body */}
      <main className="flex-1 overflow-y-auto pt-[60px] pb-[70px] px-3 py-3">
        {/* Flag banner */}
        {flagCount > 0 && (
          <div className="bg-[#E07B35]/10 border border-[#E07B35]/20 rounded-2xl p-3 mb-3 flex items-start gap-2">
            <svg className="w-5 h-5 text-[#E07B35] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-[#F0EDE8] text-sm">
              <strong>{flagCount}</strong> flagged item{flagCount !== 1 ? 's' : ''} — this order will go to John for review
            </p>
          </div>
        )}

        {/* Unpriced items warning (Quick Order only) */}
        {unpriced_items.length > 0 && (
          <div className="bg-[#E07B35]/10 border border-[#E07B35]/20 rounded-2xl p-3 mb-3">
            <p className="text-[#F0EDE8] text-sm font-medium mb-1">
              {unpriced_items.length} {unpriced_items.length === 1 ? 'item' : 'items'} could not be priced — no vendor data
            </p>
            <ul className="text-[#E07B35] text-xs space-y-0.5">
              {unpriced_items.map((item) => (
                <li key={item.product_id}>• {item.product_name}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Taco-only order message */}
        {isPAR && displayItems.length === 0 && (
          <div className="bg-[#E07B35]/10 border border-[#E07B35]/20 rounded-2xl p-4 mb-3">
            <p className="text-[#F0EDE8] text-sm font-medium text-center">
              No vendor orders — flagged items forwarded to John.
            </p>
          </div>
        )}

        {/* Recalculating indicator (Quick Order) */}
        {recalculating && (
          <div className="flex items-center gap-2 justify-center py-2 mb-2 text-xs text-[#00C0C8]">
            <div className="w-3.5 h-3.5 border-2 border-[#00C0C8] border-t-transparent rounded-full animate-spin" />
            Recalculating…
          </div>
        )}

        {/* Search filter */}
        {displayItems.length > 1 && (
          <div className="mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items…"
              className="w-full text-sm border border-[#2A343C] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00C0C8] bg-[#0E1214] text-[#F0EDE8] placeholder:text-[#8A9099]"
            />
          </div>
        )}

        {/* Item list */}
        {filteredItems.length > 0 && (
          <div data-tour="order-items-list" className="bg-[#1A2025] rounded-xl border border-[#2A343C] shadow-sm mb-3 overflow-hidden divide-y divide-[#2A343C]">
            {filteredItems.map((item) => {
              const effectiveQty = editedQtys[item.product_id] !== undefined
                ? editedQtys[item.product_id]
                : (item.quantity ?? 0)
              const effectiveNote = editedNotes[item.product_id] !== undefined
                ? editedNotes[item.product_id]
                : (item.item_note || '')
              const isDirty = editedQtys[item.product_id] !== undefined
              const isRemoved = effectiveQty === 0 && !item.flag
              const isFlagged = !!(item.flag) || (!isPAR && !isPending && !!manualFlags[item.product_id])

              return (
                <div key={item.product_id} className={isFlagged ? 'bg-[#E07B35]/5' : ''}>
                  <div className={`px-4 py-3 flex items-center justify-between ${isRemoved ? 'opacity-40' : ''}`}>
                    {/* Product name + flag badge */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-sm ${isRemoved ? 'line-through text-[#8A9099]' : isFlagged ? 'text-[#E07B35] font-medium' : 'text-[#F0EDE8]'}`}>
                          {item.product_name}
                        </span>
                        {item.flag === 'no_par' && (
                          <span className="text-xs font-semibold bg-[#E07B35]/20 text-[#E07B35] px-1.5 py-0.5 rounded flex-shrink-0">NO PAR</span>
                        )}
                        {item.flag === 'overstock' && (
                          <span className="text-xs font-semibold bg-[#E07B35]/20 text-[#E07B35] px-1.5 py-0.5 rounded flex-shrink-0">OVERSTOCK</span>
                        )}
                      </div>
                      {item.vendor_name && (
                        <p className="text-xs text-[#8A9099] mt-0.5">{item.vendor_name}</p>
                      )}
                    </div>

                    {/* Quantity stepper — shown for all items in PAR/pending flows; Quick Order only for non-flagged */}
                    {(!isPAR && !isPending) ? (
                      // Quick Order: existing stepper behavior
                      <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                        <button
                          onClick={() => setEditedQtys((prev) => ({ ...prev, [item.product_id]: Math.max(0, effectiveQty - 1) }))}
                          className="w-7 h-7 rounded-full bg-[#222C33] flex items-center justify-center text-[#F0EDE8] font-bold text-base active:opacity-75 leading-none"
                          aria-label="Decrease quantity"
                        >−</button>
                        <span className={`text-sm min-w-[2.5rem] text-center font-medium ${isDirty ? 'text-[#00C0C8]' : 'text-[#8A9099]'}`}>
                          {effectiveQty} {item.unit || 'cs'}
                        </span>
                        <button
                          onClick={() => setEditedQtys((prev) => ({ ...prev, [item.product_id]: effectiveQty + 1 }))}
                          className="w-7 h-7 rounded-full bg-[#222C33] flex items-center justify-center text-[#F0EDE8] font-bold text-base active:opacity-75 leading-none"
                          aria-label="Increase quantity"
                        >+</button>
                      </div>
                    ) : (
                      // PAR / Pending: editable stepper for all items
                      <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                        <button
                          onClick={() => setEditedQtys((prev) => ({ ...prev, [item.product_id]: Math.max(0, effectiveQty - 1) }))}
                          className="w-7 h-7 rounded-full bg-[#222C33] flex items-center justify-center text-[#F0EDE8] font-bold text-base active:opacity-75 leading-none"
                          aria-label="Decrease quantity"
                        >−</button>
                        <span className={`text-sm min-w-[2.5rem] text-center font-medium ${isDirty ? 'text-[#00C0C8]' : isFlagged ? 'text-[#E07B35]' : 'text-[#8A9099]'}`}>
                          {effectiveQty} {item.unit || 'cs'}
                        </span>
                        <button
                          onClick={() => setEditedQtys((prev) => ({ ...prev, [item.product_id]: effectiveQty + 1 }))}
                          className="w-7 h-7 rounded-full bg-[#222C33] flex items-center justify-center text-[#F0EDE8] font-bold text-base active:opacity-75 leading-none"
                          aria-label="Increase quantity"
                        >+</button>
                      </div>
                    )}
                  </div>

                  {/* Editable taco note — shown for flagged items in PAR/pending flows */}
                  {(isPAR || isPending) && isFlagged && (
                    <div className="px-4 pb-3 -mt-1">
                      <input
                        type="text"
                        value={effectiveNote}
                        onChange={(e) => setEditedNotes((prev) => ({ ...prev, [item.product_id]: e.target.value }))}
                        placeholder="Note for John…"
                        className="w-full text-xs border border-[#E07B35]/30 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#E07B35] bg-[#0E1214] text-[#F0EDE8] placeholder:text-[#8A9099]"
                      />
                    </div>
                  )}

                  {/* Read-only note display for Quick Order (not editable) */}
                  {(!isPAR && !isPending) && item.item_note && (
                    <div className="px-4 pb-2.5 -mt-1">
                      <p className="text-xs text-[#E07B35] italic">"{item.item_note}"</p>
                    </div>
                  )}

                  {/* Taco flag — Quick Order only */}
                  {(!isPAR && !isPending) && (
                    <div className="flex items-center gap-2 px-4 pb-2 mt-0.5">
                      <button
                        onClick={() => {
                          const isCurrentlyFlagged = manualFlags[item.product_id]
                          setManualFlags((prev) => ({ ...prev, [item.product_id]: !isCurrentlyFlagged }))
                          if (!isCurrentlyFlagged) {
                            setOpenFlagDrawers((prev) => ({ ...prev, [item.product_id]: true }))
                          } else {
                            setOpenFlagDrawers((prev) => ({ ...prev, [item.product_id]: false }))
                            setManualFlagNotes((prev) => { const n = {...prev}; delete n[item.product_id]; return n })
                          }
                        }}
                        className={`text-lg transition-opacity ${manualFlags[item.product_id] ? 'opacity-100 bg-[#E07B35]/30 rounded px-0.5' : 'opacity-30 hover:opacity-60'}`}
                        aria-label={manualFlags[item.product_id] ? 'Edit flag note' : 'Flag this item for John'}
                        title={manualFlags[item.product_id] ? (manualFlagNotes[item.product_id] || 'Flagged') : 'Flag this item'}
                      >
                        🌮
                      </button>
                      {manualFlags[item.product_id] && (
                        <span className="text-xs text-[#E07B35]">Flagged for John</span>
                      )}
                    </div>
                  )}

                  {/* Note drawer for flagged Quick Order items */}
                  {(!isPAR && !isPending) && openFlagDrawers[item.product_id] && (
                    <div className="px-4 pb-3">
                      <textarea
                        className="w-full text-sm bg-[#1C2127] border border-[#E07B35]/40 rounded p-2 text-[#F0EDE8] placeholder-[#8A9099] resize-none"
                        placeholder="Note for John… (optional)"
                        rows={2}
                        value={manualFlagNotes[item.product_id] || ''}
                        onChange={(e) => setManualFlagNotes((prev) => ({ ...prev, [item.product_id]: e.target.value }))}
                      />
                      <button
                        className="text-xs text-[#8A9099] mt-1"
                        onClick={() => setOpenFlagDrawers((prev) => ({ ...prev, [item.product_id]: false }))}
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Demo total (tour mode only) */}
        {isTourMode && (
          <div className="bg-[#1A2025] border border-[#2A343C] rounded-xl px-4 py-3 mb-3 flex justify-between items-center">
            <span className="text-[#8A9099] text-sm font-semibold uppercase tracking-wide">Total</span>
            <span className="text-[#F0EDE8] font-bold">${TOUR_DEMO_TOTAL.toFixed(2)}</span>
          </div>
        )}

        {/* Notes to John — editable for all flows */}
        <div className="bg-[#222C33] border border-[#2A343C] rounded-2xl p-3 mb-3">
          <p className="text-xs font-semibold text-[#8A9099] uppercase tracking-wide mb-1">Notes to John</p>
          <textarea
            value={orderReviewNote}
            onChange={(e) => setOrderReviewNote(e.target.value)}
            placeholder="Add a note for John…"
            rows={3}
            className="w-full text-sm border border-[#2A343C] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00C0C8] resize-none bg-[#0E1214] text-[#F0EDE8] placeholder:text-[#8A9099]"
          />
        </div>
      </main>

      {/* Fixed footer */}
      {isPAR ? (
        <footer className="fixed bottom-0 left-0 right-0 h-[70px] bg-[#1A2025] border-t border-[#2A343C] flex items-center justify-center px-4 z-50 gap-3">
          <button
            onClick={() => navigate('/inventory-count')}
            className="flex-1 py-3 rounded-lg font-semibold text-sm border border-[#2A343C] text-[#F0EDE8] bg-[#222C33] active:opacity-75 transition-colors"
          >
            Back to Inventory
          </button>
          {SaveButton}
        </footer>
      ) : isPending ? (
        <footer className="fixed bottom-0 left-0 right-0 h-[70px] bg-[#1A2025] border-t border-[#2A343C] flex items-center justify-center px-4 z-50 gap-3">
          <button
            onClick={handleBack}
            className="flex-1 py-3 rounded-lg font-semibold text-sm border border-[#2A343C] text-[#F0EDE8] bg-[#222C33] active:opacity-75 transition-colors"
          >
            Back
          </button>
          {SaveButton}
        </footer>
      ) : (
        <footer className="fixed bottom-0 left-0 right-0 h-[70px] bg-[#1A2025] border-t border-[#2A343C] flex items-center justify-center px-4 z-50 gap-3">
          <button
            onClick={() => navigate('/quick-order')}
            className="flex-1 py-3 rounded-lg font-semibold text-sm border border-[#2A343C] text-[#F0EDE8] bg-[#222C33] active:opacity-75 transition-colors"
          >
            Back to Catalogue
          </button>
          {SaveButton}
        </footer>
      )}
    </div>
  )
}
