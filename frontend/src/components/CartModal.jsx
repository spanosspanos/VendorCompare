import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrder } from '../context/OrderContext'
import { getAssembledOrders, removeAssembledOrder } from '../utils/assembledOrders'

export default function CartModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { selectedItems, updateQuantity } = useOrder()
  const items = Object.values(selectedItems)
  const [assembledOrders, setAssembledOrders] = useState([])

  useEffect(() => {
    if (isOpen) setAssembledOrders(getAssembledOrders())
  }, [isOpen])

  if (!isOpen) return null

  const handleViewOrder = () => {
    navigate('/order-assembly')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal panel */}
      <div
        className="relative bg-[#1A2025] rounded-t-2xl border border-[#2A343C] border-b-0 shadow-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-[#2A343C] rounded-full" />
        </div>

        {/* Title row */}
        <div className="px-4 py-3 border-b border-[#2A343C] flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[#F0EDE8]" style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>Your Order</h2>
            {items.length > 0 && (
              <p className="text-xs text-[#8A9099] mt-0.5">{items.length} item{items.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#8A9099] active:text-gray-600"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Item list */}
        <div className="overflow-y-auto flex-1">
          {items.length === 0 ? (
            <div className="py-12 text-center">
              <svg className="w-10 h-10 text-[#2A343C] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm text-[#8A9099]">Your order is empty</p>
            </div>
          ) : (
            <div className="divide-y divide-[#2A343C]">
              {items.map((item) => (
                <div key={item.product_id} className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-[#F0EDE8]">{item.product_name}</span>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      className="w-7 h-7 rounded-full bg-[#222C33] flex items-center justify-center text-[#F0EDE8] font-bold text-base active:bg-gray-200 leading-none"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="text-sm text-[#F0EDE8] w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      className="w-7 h-7 rounded-full bg-[#222C33] flex items-center justify-center text-[#F0EDE8] font-bold text-base active:bg-gray-200 leading-none"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Waiting Room — assembled but unsaved orders */}
          {assembledOrders.length > 0 && (
            <div className="border-t border-[#2A343C] px-4 py-3">
              <p className="text-xs font-semibold text-[#8A9099] uppercase tracking-wide mb-2">
                Assembled Orders ({assembledOrders.length})
              </p>
              {assembledOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b border-[#2A343C]/50 last:border-0">
                  <div>
                    <p className="text-sm text-[#F0EDE8] font-medium">{order.label}</p>
                    <p className="text-xs text-[#8A9099]">
                      ${order.totalCost.toFixed(2)} · {order.vendorOrders?.length ?? 0} vendor{(order.vendorOrders?.length ?? 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="text-xs text-[#00C0C8] font-medium px-3 py-1.5 rounded-lg bg-[#00C0C8]/10 active:bg-[#00C0C8]/20"
                      onClick={() => {
                        navigate('/order-assembly', {
                          state: {
                            vendor_orders: order.vendorOrders,
                            total_cost: order.totalCost,
                            savings_vs_worst: order.savingsVsWorst,
                            comparison: order.comparison,
                            notesToJohn: order.notesToJohn,
                            assembledOrderId: order.id,
                          }
                        })
                        onClose()
                      }}
                    >
                      Resume
                    </button>
                    <button
                      className="text-xs text-[#8A9099] px-2 py-1.5"
                      onClick={() => {
                        removeAssembledOrder(order.id)
                        setAssembledOrders(getAssembledOrders())
                      }}
                      aria-label="Discard order"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-4 py-4 border-t border-[#2A343C] flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border border-[#2A343C] text-sm font-semibold text-[#F0EDE8] bg-[#222C33] active:bg-gray-50 transition-colors"
          >
            Keep Shopping
          </button>
          {items.length > 0 && (
            <button
              onClick={handleViewOrder}
              className="flex-1 py-3 rounded-full bg-[#00C0C8] text-[#0E1214] text-sm font-bold active:bg-[#007F85] transition-colors"
            >
              View Order
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
