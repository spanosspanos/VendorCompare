import { useState, useEffect } from 'react'
import { getPendingReviewOrders, approveOrder } from '../api'

export default function OrderReviewQueue() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [approving, setApproving] = useState({})  // {order_id → bool}

  useEffect(() => {
    getPendingReviewOrders()
      .then((res) => setOrders(res.data))
      .catch(() => setError('Failed to load pending orders.'))
      .finally(() => setLoading(false))
  }, [])

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleApprove = async (id) => {
    setApproving((prev) => ({ ...prev, [id]: true }))
    try {
      await approveOrder(id)
      // Update local state instead of removing — show approved record with timestamp
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id
            ? { ...o, review_status: 'approved', approved_at: new Date().toISOString() }
            : o
        )
      )
    } catch {
      alert('Approval failed. Please try again.')
      setApproving((prev) => ({ ...prev, [id]: false }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Loading review queue…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    )
  }

  const pendingOrders = orders.filter((o) => o.review_status !== 'approved')
  const approvedOrders = orders.filter((o) => o.review_status === 'approved')

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-800">Orders Pending Review</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {pendingOrders.length === 0
            ? 'All clear — no orders need review.'
            : `${pendingOrders.length} order${pendingOrders.length === 1 ? '' : 's'} need${pendingOrders.length === 1 ? 's' : ''} your attention.`}
        </p>
      </div>

      {/* Empty state — no orders at all */}
      {orders.length === 0 && (
        <div className="py-12 text-center">
          <svg className="w-10 h-10 text-emerald-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-400 text-sm">No orders pending review</p>
        </div>
      )}

      {/* Pending orders */}
      {pendingOrders.map((order) => {
        const isExpanded = expandedId === order.id
        const flaggedItems = order.items.filter((i) => i.flag)
        const totalFlagCount = flaggedItems.length + (order.taco_flag_count || 0)
        const formattedDate = new Date(order.created_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })
        const formattedTime = new Date(order.created_at).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit',
        })

        return (
          <div key={order.id} className="border-b border-gray-100 last:border-0">
            {/* Order summary row */}
            <button
              onClick={() => toggleExpand(order.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-gray-800">Order #{order.id}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">
                    {totalFlagCount} flag{totalFlagCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{formattedDate} · {formattedTime}</p>
                {order.notes_to_john && (
                  <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                    Note: {order.notes_to_john}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 ml-3">
                <span className="text-sm font-bold text-gray-800">${order.total_cost.toFixed(2)}</span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-4 pb-4 bg-gray-50/40">
                {order.vendor_splits.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Vendor Splits</p>
                    <div className="space-y-1">
                      {order.vendor_splits.map((vs) => (
                        <div key={vs.vendor_id} className="flex justify-between text-xs text-gray-600">
                          <span>{vs.vendor_name}</span>
                          <span className="font-medium">${vs.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Items</p>
                  <div className="space-y-1.5">
                    {order.items.map((item) => (
                      <div key={item.product_id} className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-700">{item.product_name}</span>
                          <span className="text-gray-400">×{item.quantity}</span>
                          {item.flag === 'no_par' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">NO PAR</span>
                          )}
                          {item.flag === 'overstock' && (
                            <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold">OVERSTOCK</span>
                          )}
                        </div>
                        {item.item_note && (
                          <p className="text-gray-400 pl-1 mt-0.5 italic">"{item.item_note}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {order.notes_to_john && (
                  <div className="mb-3 bg-amber-50 border border-amber-100 rounded-xl p-2.5">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Note from kitchen:</p>
                    <p className="text-xs text-amber-800">{order.notes_to_john}</p>
                  </div>
                )}

                <button
                  onClick={() => handleApprove(order.id)}
                  disabled={approving[order.id]}
                  className={`w-full py-2 rounded-xl text-sm font-semibold transition-colors ${
                    approving[order.id]
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-emerald-600 text-white active:bg-emerald-700'
                  }`}
                >
                  {approving[order.id] ? 'Approving…' : 'Approve Order'}
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Divider before approved section */}
      {approvedOrders.length > 0 && (
        <div className="px-4 py-2 bg-gray-50/80 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Approved</span>
        </div>
      )}

      {/* Approved orders — greyed out, no approve button */}
      {approvedOrders.map((order) => {
        const isExpanded = expandedId === order.id
        const flaggedItems = order.items.filter((i) => i.flag)
        const formattedDate = new Date(order.created_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })
        const formattedTime = new Date(order.created_at).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit',
        })
        const approvedAt = order.approved_at
          ? new Date(order.approved_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : null

        return (
          <div key={order.id} className="border-b border-gray-100 last:border-0 opacity-60">
            <button
              onClick={() => toggleExpand(order.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left bg-gray-50/30"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-gray-600">Order #{order.id}</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700">
                    ✓ Approved
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {formattedDate} · {formattedTime}
                  {approvedAt && (
                    <span className="ml-2 text-emerald-600">· Approved {approvedAt}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-3">
                <span className="text-sm font-bold text-gray-500">${order.total_cost.toFixed(2)}</span>
                <svg
                  className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 bg-gray-50/40">
                {order.vendor_splits.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Vendor Splits</p>
                    <div className="space-y-1">
                      {order.vendor_splits.map((vs) => (
                        <div key={vs.vendor_id} className="flex justify-between text-xs text-gray-600">
                          <span>{vs.vendor_name}</span>
                          <span className="font-medium">${vs.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Items</p>
                  <div className="space-y-1.5">
                    {order.items.map((item) => (
                      <div key={item.product_id} className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-600">{item.product_name}</span>
                          <span className="text-gray-400">×{item.quantity}</span>
                          {item.flag === 'no_par' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">NO PAR</span>
                          )}
                          {item.flag === 'overstock' && (
                            <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold">OVERSTOCK</span>
                          )}
                        </div>
                        {item.item_note && (
                          <p className="text-gray-400 pl-1 mt-0.5 italic">"{item.item_note}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {order.notes_to_john && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Note from kitchen:</p>
                    <p className="text-xs text-amber-800">{order.notes_to_john}</p>
                  </div>
                )}
                {/* No approve button — already approved */}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
