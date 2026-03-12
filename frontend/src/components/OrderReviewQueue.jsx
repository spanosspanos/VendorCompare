import { useState, useEffect } from 'react'
import { getPendingReviewOrders, approveOrder } from '../api'

// Returns which position this order falls in for the current week (Mon 00:00 local)
function getWeekPosition(order, allOrders) {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const daysSinceMonday = day === 0 ? 6 : day - 1
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - daysSinceMonday)
  weekStart.setHours(0, 0, 0, 0)

  const weekOrders = allOrders
    .filter((o) => new Date(o.created_at) >= weekStart)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  const pos = weekOrders.findIndex((o) => o.id === order.id) + 1
  return pos > 0 ? { pos, total: weekOrders.length } : null
}

export default function OrderReviewQueue({ onSelectOrder, excludeIds = [] }) {
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
          <div className="w-7 h-7 border-4 border-[#00C0C8] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#8A9099] text-sm">Loading review queue…</span>
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

  const pendingOrders = orders.filter((o) => o.review_status !== 'approved' && !excludeIds.includes(o.id))
  const approvedOrders = orders.filter((o) => o.review_status === 'approved')

  return (
    <div className="bg-[#1A2025] rounded-xl border border-[#2A343C] overflow-hidden">
      {/* Section header — amber treatment when orders are pending, neutral when clear */}
      <div className={`px-4 py-3 border-b ${
        pendingOrders.length > 0
          ? 'bg-[#E07B35]/10 border-[#E07B35]/20'
          : 'bg-[#222C33] border-[#2A343C]'
      }`}>
        <h2 className={`text-base font-semibold ${
          pendingOrders.length > 0 ? 'text-[#E07B35]' : 'text-[#F0EDE8]'
        }`}>Orders Pending Review</h2>
        <p className={`mt-0.5 ${
          pendingOrders.length > 0 ? 'text-[#E07B35]/80 text-sm' : 'text-xs text-[#8A9099]'
        }`}>
          {pendingOrders.length === 0
            ? 'All clear — no orders need review.'
            : `${pendingOrders.length} order${pendingOrders.length === 1 ? '' : 's'} need${pendingOrders.length === 1 ? 's' : ''} your attention.`}
        </p>
      </div>

      {/* Empty state — no orders at all */}
      {orders.length === 0 && (
        <div className="py-12 text-center">
          <svg className="w-10 h-10 text-[#3DAA6E]/40 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-base text-[#8A9099]">No orders pending review</p>
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
        const weekPos = getWeekPosition(order, orders)

        return (
          <div key={order.id} className="border-b border-[#2A343C] last:border-0">
            {/* Order summary row */}
            <button
              onClick={() => onSelectOrder ? onSelectOrder(order) : toggleExpand(order.id)}
              className="w-full flex items-center justify-between px-4 py-3 min-h-[56px] hover:bg-[#222C33] transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-base font-bold text-[#F0EDE8]" style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>Cantina Order #{order.id}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-[#E07B35] text-[#0E1214]">
                    {totalFlagCount} flag{totalFlagCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-[#8A9099]">{formattedDate} · {formattedTime}</p>
                  {weekPos && (
                    <span className="text-xs text-[#00C0C8] font-medium">
                      · Week #{weekPos.pos}
                    </span>
                  )}
                </div>
                {order.notes_to_john && (
                  <p className="text-xs text-[#8A9099] mt-1 truncate max-w-xs">
                    Note: {order.notes_to_john}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 ml-3">
                <span className="text-base font-bold text-[#F0EDE8]">${order.total_cost.toFixed(2)}</span>
                <svg
                  className={`w-4 h-4 text-[#8A9099] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-4 pb-4 bg-[#0E1214]/40">
                {order.vendor_splits.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-[#8A9099] uppercase tracking-wide mb-1.5">Vendor Splits</p>
                    <div className="space-y-1">
                      {order.vendor_splits.map((vs) => (
                        <div key={vs.vendor_id} className="flex justify-between text-xs text-[#F0EDE8]">
                          <span>{vs.vendor_name}</span>
                          <span className="font-medium">${vs.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <p className="text-xs font-semibold text-[#8A9099] uppercase tracking-wide mb-1.5">Items</p>
                  <div className="space-y-1.5">
                    {order.items.map((item) => (
                      <div key={item.product_id} className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#F0EDE8]">{item.product_name}</span>
                          <span className="text-[#8A9099]">×{item.quantity}</span>
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
                  <div className="mb-3 bg-[#E07B35]/10 border border-[#E07B35]/20 rounded-xl p-2.5">
                    <p className="text-xs font-semibold text-[#E07B35] mb-1">Note from kitchen:</p>
                    <p className="text-xs text-[#F0EDE8]">{order.notes_to_john}</p>
                  </div>
                )}

                <button
                  onClick={() => handleApprove(order.id)}
                  disabled={approving[order.id]}
                  className={`w-full py-3.5 rounded-full text-base font-bold transition-colors ${
                    approving[order.id]
                      ? 'bg-[#2A343C] text-[#8A9099] cursor-not-allowed'
                      : 'bg-[#00C0C8] text-[#0E1214] active:bg-[#007F85]'
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
        <div className="px-4 py-2 bg-[#222C33]/80 border-t border-[#2A343C]">
          <span className="text-xs font-semibold text-[#8A9099] uppercase tracking-widest">Approved</span>
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

        const weekPosApproved = getWeekPosition(order, orders)

        return (
          <div key={order.id} className="border-b border-[#2A343C] last:border-0 opacity-60">
            <button
              onClick={() => toggleExpand(order.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#222C33] transition-colors text-left bg-[#222C33]/30"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-[#8A9099]">Cantina Order #{order.id}</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-[#3DAA6E]/15 text-[#3DAA6E]">
                    ✓ Approved
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-[#8A9099]">
                    {formattedDate} · {formattedTime}
                    {approvedAt && (
                      <span className="ml-2 text-[#00C0C8]">· Approved {approvedAt}</span>
                    )}
                  </p>
                  {weekPosApproved && (
                    <span className="text-xs text-[#00C0C8] font-medium">
                      · Week #{weekPosApproved.pos}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-3">
                <span className="text-sm font-bold text-[#F0EDE8]">${order.total_cost.toFixed(2)}</span>
                <svg
                  className={`w-4 h-4 text-[#8A9099] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 bg-[#0E1214]/40">
                {order.vendor_splits.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-[#8A9099] uppercase tracking-wide mb-1.5">Vendor Splits</p>
                    <div className="space-y-1">
                      {order.vendor_splits.map((vs) => (
                        <div key={vs.vendor_id} className="flex justify-between text-xs text-[#F0EDE8]">
                          <span>{vs.vendor_name}</span>
                          <span className="font-medium">${vs.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <p className="text-xs font-semibold text-[#8A9099] uppercase tracking-wide mb-1.5">Items</p>
                  <div className="space-y-1.5">
                    {order.items.map((item) => (
                      <div key={item.product_id} className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#F0EDE8]">{item.product_name}</span>
                          <span className="text-[#8A9099]">×{item.quantity}</span>
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
                  <div className="bg-[#E07B35]/10 border border-[#E07B35]/20 rounded-xl p-2.5">
                    <p className="text-xs font-semibold text-[#E07B35] mb-1">Note from kitchen:</p>
                    <p className="text-xs text-[#F0EDE8]">{order.notes_to_john}</p>
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
