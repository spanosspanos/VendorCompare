import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getOrderDetail } from '../api'

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getOrderDetail(id)
      .then((res) => setOrder(res.data))
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('Order not found.')
        } else {
          setError('Failed to load order. Please try again.')
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-100">
        <header className="fixed top-0 left-0 right-0 h-[60px] bg-emerald-700 text-white flex items-center justify-between px-4 z-50 shadow-md">
          <button onClick={() => navigate('/history')} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">Order Detail</h1>
          <div className="w-10" />
        </header>
        <div className="flex-1 flex items-center justify-center pt-[60px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 text-sm">Loading order…</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen bg-gray-100">
        <header className="fixed top-0 left-0 right-0 h-[60px] bg-emerald-700 text-white flex items-center justify-between px-4 z-50 shadow-md">
          <button onClick={() => navigate('/history')} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">Order Detail</h1>
          <div className="w-10" />
        </header>
        <div className="flex-1 flex items-center justify-center pt-[60px] px-6">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Link to="/history" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">
              Back to History
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Group items by vendor for display
  const itemsByVendor = {}
  order.vendor_splits.forEach((vs) => {
    itemsByVendor[vs.vendor_id] = { split: vs, items: [] }
  })
  order.items.forEach((item) => {
    if (itemsByVendor[item.selected_vendor_id]) {
      itemsByVendor[item.selected_vendor_id].items.push(item)
    }
  })

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-emerald-700 text-white flex items-center justify-between px-4 z-50 shadow-md">
        <button onClick={() => navigate('/history')} className="p-2" aria-label="Back">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Order #{order.id}</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 pt-[76px] pb-6 px-3">
        {/* Order header card */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm text-gray-500">
                {new Date(order.created_at).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                })}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(order.created_at).toLocaleTimeString('en-US', {
                  hour: 'numeric', minute: '2-digit',
                })}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                {order.status}
              </span>
              {order.review_status === 'pending' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  Pending Review
                </span>
              )}
              {order.review_status === 'approved' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                  Approved
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Total Cost</p>
              <p className="text-xl font-bold text-gray-800">${order.total_cost.toFixed(2)}</p>
            </div>
            {order.savings_vs_worst > 0 && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Savings vs Worst</p>
                <p className="text-xl font-bold text-emerald-600">${order.savings_vs_worst.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Vendor split cards */}
        {Object.values(itemsByVendor).map(({ split, items }) => (
          <div key={split.vendor_id} className="bg-white rounded-2xl shadow-sm mb-3 overflow-hidden">
            {/* Vendor header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
              <span className="font-semibold text-gray-800">{split.vendor_name}</span>
              <span className="font-bold text-gray-800">${split.total.toFixed(2)}</span>
            </div>
            {/* Line items */}
            <div className="divide-y divide-gray-100">
              {items.map((item) => (
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
                        {item.quantity} × ${item.unit_price.toFixed(2)}
                      </span>
                      {item.item_note && (
                        <p className="text-xs text-gray-400 italic mt-0.5">"{item.item_note}"</p>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-700 ml-3 flex-shrink-0">
                      ${item.line_total.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Notes to John (if present) */}
        {order.notes_to_john && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Notes to John</p>
            <p className="text-sm text-amber-800">{order.notes_to_john}</p>
          </div>
        )}

        {/* Footer back link */}
        <div className="mt-4 text-center">
          <Link to="/history" className="text-sm text-emerald-600 font-medium">
            ← Back to History
          </Link>
        </div>
      </main>
    </div>
  )
}
