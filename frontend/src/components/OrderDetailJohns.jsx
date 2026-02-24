import { useState } from 'react'
import { reviewOrder } from '../api'

export default function OrderDetailJohns({ order, onBack, onAction }) {
  const [step, setStep] = useState('view') // 'view' | 'approving' | 'rejecting'
  const [approveNote, setApproveNote] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Group items by vendor using vendor_splits order
  const itemsByVendor = {}
  order.vendor_splits.forEach((vs) => {
    itemsByVendor[vs.vendor_id] = { split: vs, items: [] }
  })
  order.items.forEach((item) => {
    if (item.selected_vendor_id && itemsByVendor[item.selected_vendor_id]) {
      itemsByVendor[item.selected_vendor_id].items.push(item)
    }
  })

  const formattedDate = new Date(order.created_at).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
  const formattedTime = new Date(order.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  })

  // Flag count for header badge
  const flagCount = order.taco_flag_count || 0

  const handleApprove = async () => {
    setSubmitting(true)
    try {
      await reviewOrder(order.id, {
        review_status: 'approved',
        review_note: approveNote.trim() || null,
      })
      onAction(order.id, 'approved')
    } catch {
      alert('Action failed. Please try again.')
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    setSubmitting(true)
    try {
      await reviewOrder(order.id, {
        review_status: 'rejected',
        review_note: rejectNote.trim(),
      })
      onAction(order.id, 'rejected')
    } catch {
      alert('Action failed. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-emerald-700 text-white flex items-center justify-between px-4 z-50 shadow-md">
        <button onClick={onBack} className="p-2 -ml-1" aria-label="Back to queue">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center flex-1 mx-2 min-w-0">
          <h1 className="text-base font-semibold leading-tight truncate">Order #{order.id}</h1>
          <p className="text-xs text-emerald-200 leading-tight">{formattedDate} · {formattedTime}</p>
        </div>
        <div className="w-10" />
      </header>

      <main className="flex-1 pt-[76px] pb-[86px] px-3">
        {/* Order summary card */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="text-2xl font-bold text-gray-900">${order.total_cost.toFixed(2)}</span>
              {order.savings_vs_worst > 0 && (
                <p className="text-xs text-emerald-600 font-medium mt-0.5">
                  saved ${order.savings_vs_worst.toFixed(2)} vs single-vendor
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {flagCount > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold">
                  <span>🌮</span>
                  <span>{flagCount} flag{flagCount !== 1 ? 's' : ''}</span>
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-3 text-xs text-gray-400">
            <span>{order.vendor_splits.length} vendor{order.vendor_splits.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{order.items.filter(i => i.selected_vendor_id).length} item{order.items.filter(i => i.selected_vendor_id).length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Notes to John — amber callout, above vendor breakdown */}
        {order.notes_to_john && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Note from Kitchen</span>
            </div>
            <p className="text-sm text-amber-800">{order.notes_to_john}</p>
          </div>
        )}

        {/* Vendor breakdown cards */}
        {Object.values(itemsByVendor).map(({ split, items }) => (
          <div key={split.vendor_id} className="bg-white rounded-2xl shadow-sm mb-3 overflow-hidden">
            {/* Vendor header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-800">{split.vendor_name}</span>
              <span className="text-sm font-bold text-gray-800">${split.total.toFixed(2)}</span>
            </div>
            {/* Line items */}
            <div className="divide-y divide-gray-100">
              {items.map((item) => {
                const isFlagged = item.flag !== null || item.item_note !== null
                return (
                  <div key={item.product_id} className={isFlagged ? 'bg-amber-50' : ''}>
                    <div className="px-4 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm text-gray-800">{item.product_name}</span>
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
                          {item.quantity != null && item.unit_price != null && (
                            <span className="text-xs text-gray-400">
                              {item.quantity} × ${item.unit_price.toFixed(2)}
                            </span>
                          )}
                        </div>
                        {item.line_total != null && (
                          <span className="text-sm font-medium text-gray-700 ml-3 flex-shrink-0">
                            ${item.line_total.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                    {item.item_note && (
                      <div className="px-4 pb-2.5 -mt-1">
                        <p className="text-xs text-amber-700 italic">"{item.item_note}"</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Approve note input — shown when step === 'approving' */}
        {step === 'approving' && (
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-3 border border-emerald-200">
            <p className="text-sm font-semibold text-gray-700 mb-2">Add a note (optional)</p>
            <textarea
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder="Any notes for the kitchen…"
              rows={3}
              autoFocus
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-white text-gray-700 mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setStep('view'); setApproveNote('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 bg-white active:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={submitting}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${
                  submitting ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 active:bg-emerald-700'
                }`}
              >
                {submitting ? 'Approving…' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        )}

        {/* Reject note input — shown when step === 'rejecting' */}
        {step === 'rejecting' && (
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-3 border border-red-200">
            <p className="text-sm font-semibold text-gray-700 mb-2">Reason for rejection <span className="text-red-500">(required)</span></p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Tell the kitchen why this order is being rejected…"
              rows={3}
              autoFocus
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none bg-white text-gray-700 mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setStep('view'); setRejectNote('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 bg-white active:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={submitting || rejectNote.trim().length === 0}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${
                  submitting || rejectNote.trim().length === 0
                    ? 'bg-red-300 cursor-not-allowed'
                    : 'bg-red-600 active:bg-red-700'
                }`}
              >
                {submitting ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Sticky bottom — Reject | Approve buttons, view mode only */}
      {step === 'view' && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-50">
          <div className="flex gap-3">
            <button
              onClick={() => setStep('rejecting')}
              className="flex-1 py-3 rounded-xl font-semibold text-sm border-2 border-red-300 text-red-600 bg-white active:bg-red-50 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={() => setStep('approving')}
              className="flex-1 py-3 rounded-xl font-semibold text-sm bg-emerald-600 text-white active:bg-emerald-700 transition-colors"
            >
              Approve
            </button>
          </div>
        </footer>
      )}
    </div>
  )
}
