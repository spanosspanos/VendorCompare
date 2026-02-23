import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useOrder } from '../context/OrderContext'
import { assembleOrder, saveOrder } from '../api'

export default function OrderAssembly() {
  const { getItemsArray } = useOrder()
  const navigate = useNavigate()
  const location = useLocation()

  // PAR flow detection
  const parState = location.state?.fromPAR ? location.state : null

  const [result, setResult] = useState(parState?.assembledResult || null)
  const [loading, setLoading] = useState(!parState)
  const [error, setError] = useState(null)
  const [expandedVendors, setExpandedVendors] = useState({})
  const [showComparison, setShowComparison] = useState(false)
  const [saveState, setSaveState] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'

  useEffect(() => {
    // If PAR flow, skip assembly — we already have the result
    if (parState) {
      const expanded = {}
      parState.assembledResult.vendor_orders.forEach((vo) => {
        expanded[vo.vendor_id] = true
      })
      setExpandedVendors(expanded)
      return
    }

    // Quick Order flow
    const items = getItemsArray()
    if (items.length === 0) {
      navigate('/')
      return
    }

    assembleOrder(1, items)
      .then((data) => {
        setResult(data)
        const expanded = {}
        data.vendor_orders.forEach((vo) => {
          expanded[vo.vendor_id] = true
        })
        setExpandedVendors(expanded)
      })
      .catch(() => setError('Order assembly failed. Please try again.'))
      .finally(() => setLoading(false))
  }, [])

  const toggleVendor = (vendorId) => {
    setExpandedVendors((prev) => ({ ...prev, [vendorId]: !prev[vendorId] }))
  }

  const handleSave = async () => {
    if (!result) return
    setSaveState('saving')

    const items = result.vendor_orders.flatMap((vo) =>
      vo.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        selected_vendor_id: vo.vendor_id,
        unit_price: item.unit_price,
        line_total: item.line_total,
      }))
    )

    const payload = {
      location_id: 1,
      total_cost: result.total_cost,
      savings_vs_worst: result.comparison.savings_vs_worst,
      items,
      vendor_splits: result.vendor_orders.map((vo) => ({
        vendor_id: vo.vendor_id,
        total: vo.subtotal,
      })),
    }

    try {
      await saveOrder(payload)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 3000)
    } catch {
      setSaveState('error')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-100">
        <header className="fixed top-0 left-0 right-0 h-[60px] bg-emerald-700 text-white flex items-center justify-center px-4 z-50 shadow-md">
          <h1 className="text-lg font-semibold">Order Review</h1>
        </header>
        <div className="flex-1 flex items-center justify-center pt-[60px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 text-sm">Assembling your order…</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen bg-gray-100">
        <header className="fixed top-0 left-0 right-0 h-[60px] bg-emerald-700 text-white flex items-center justify-center px-4 z-50 shadow-md">
          <h1 className="text-lg font-semibold">Order Review</h1>
        </header>
        <div className="flex-1 flex items-center justify-center pt-[60px]">
          <div className="text-center px-6">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"
            >
              Back to Catalog
            </button>
          </div>
        </div>
      </div>
    )
  }

  const { vendor_orders, total_cost, unpriced_items, comparison } = result
  const hasSavings = comparison.savings_vs_worst > 0 && vendor_orders.length > 1

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-emerald-700 text-white flex items-center justify-center px-4 z-50 shadow-md">
        <h1 className="text-lg font-semibold">Order Review</h1>
      </header>

      {/* Scrollable body */}
      <main className="flex-1 overflow-y-auto pt-[60px] pb-[70px] px-3 py-3">
        {/* Review banner/notice (PAR flow only) */}
        {parState && (
          parState.tacoFlagCount > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-3 flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-amber-800 text-sm">
                <strong>Flagged items detected</strong> — this order is pending John's review before processing.
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 mb-3">
              <p className="text-gray-500 text-sm">This order will be sent to John for review.</p>
            </div>
          )
        )}

        {/* Unpriced items warning */}
        {unpriced_items.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-3">
            <p className="text-amber-800 text-sm font-medium mb-1">
              {unpriced_items.length} {unpriced_items.length === 1 ? 'item' : 'items'} could not be priced — no vendor data
            </p>
            <ul className="text-amber-700 text-xs space-y-0.5">
              {unpriced_items.map((item) => (
                <li key={item.product_id}>• {item.product_name}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Savings banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 mb-3">
          {hasSavings ? (
            <>
              <p className="text-emerald-800 text-sm font-semibold">
                Estimated savings: ${comparison.savings_vs_worst.toFixed(2)} vs single-vendor
              </p>
              <p className="text-emerald-700 text-xs mt-0.5">
                Total: ${total_cost.toFixed(2)} · {vendor_orders.length} vendors
              </p>
            </>
          ) : (
            <p className="text-emerald-800 text-sm font-semibold">
              Total: ${total_cost.toFixed(2)} · {vendor_orders.length} {vendor_orders.length === 1 ? 'vendor' : 'vendors'}
            </p>
          )}
        </div>

        {/* Comparison detail */}
        <div className="bg-white rounded-2xl shadow-sm mb-3 overflow-hidden">
          <button
            onClick={() => setShowComparison((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700">If ordered from one vendor</span>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${showComparison ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {showComparison && (
            <div className="px-4 py-2 space-y-1">
              {comparison.vendors.map((vc) => (
                <div key={vc.vendor_id} className="flex justify-between text-xs text-gray-600">
                  <span>{vc.vendor_name}</span>
                  <span>
                    {vc.total_if_all != null ? `$${vc.total_if_all.toFixed(2)}` : 'N/A'}
                    <span className="text-gray-400 ml-1">
                      (carries {vc.items_carried} of {vc.items_selected} items)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vendor cards */}
        {vendor_orders.map((vo) => (
          <div key={vo.vendor_id} className="bg-white mb-2 rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => toggleVendor(vo.vendor_id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${expandedVendors[vo.vendor_id] ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-semibold text-gray-800">{vo.vendor_name}</span>
              </div>
              <span className="font-bold text-gray-800">${vo.subtotal.toFixed(2)}</span>
            </button>

            {expandedVendors[vo.vendor_id] && (
              <div className="divide-y divide-gray-100">
                {vo.items.map((item) => (
                  <div key={item.product_id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm text-gray-800 truncate">{item.product_name}</span>
                          {item.flag === 'no_par' && (
                            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0">
                              NO PAR
                            </span>
                          )}
                          {item.flag === 'overstock' && (
                            <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0">
                              OVERSTOCK
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {item.quantity} × ${item.unit_price.toFixed(2)}/{item.unit || 'each'}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-700 ml-3 flex-shrink-0">
                        ${item.line_total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Notes to John (PAR flow only) */}
        {parState?.notesToJohn && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes to John</p>
            <p className="text-sm text-gray-700">{parState.notesToJohn}</p>
          </div>
        )}
      </main>

      {/* Fixed footer — two variants */}
      {parState ? (
        <footer className="fixed bottom-0 left-0 right-0 h-[70px] bg-white border-t border-gray-200 flex items-center justify-center px-4 z-50 gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex-1 max-w-[160px] py-3 rounded-xl font-semibold text-sm border border-gray-300 text-gray-700 bg-white active:bg-gray-100 transition-colors"
          >
            Back to Home
          </button>
          <Link
            to={`/history/${parState.savedOrderId}`}
            className="flex-1 max-w-[160px] py-3 rounded-xl font-semibold text-sm bg-emerald-600 text-white text-center active:bg-emerald-700 transition-colors"
          >
            View in History
          </Link>
        </footer>
      ) : (
        <footer className="fixed bottom-0 left-0 right-0 h-[70px] bg-white border-t border-gray-200 flex items-center justify-center px-4 z-50 gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex-1 max-w-[160px] py-3 rounded-xl font-semibold text-sm border border-gray-300 text-gray-700 bg-white active:bg-gray-100 transition-colors"
          >
            Back to Catalog
          </button>
          <button
            onClick={handleSave}
            disabled={saveState === 'saving' || saveState === 'saved'}
            className={`flex-1 max-w-[160px] py-3 rounded-xl font-semibold text-sm transition-colors ${
              saveState === 'saved'
                ? 'bg-emerald-600 text-white cursor-not-allowed'
                : saveState === 'error'
                ? 'bg-red-500 text-white active:bg-red-600'
                : saveState === 'saving'
                ? 'bg-blue-400 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white active:bg-blue-700'
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
            {saveState === 'idle' && 'Save Order'}
          </button>
        </footer>
      )}
    </div>
  )
}
