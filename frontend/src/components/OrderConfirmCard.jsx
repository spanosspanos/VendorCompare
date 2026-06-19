import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { saveOrder } from '../api'

export default function OrderConfirmCard({ orderData, onConfirm }) {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [saving, setSaving] = useState(false)

  if (!orderData) return null

  const { vendor_orders = [], total_cost = 0, savings_vs_worst = 0, unpriced_items = [] } = orderData

  return (
    <div className="w-full bg-[#1A2025] border border-[#2A343C] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2A343C] flex items-center justify-between">
        <span className="text-sm font-bold text-[#F0EDE8]" style={{ fontFamily: "'Syne',sans-serif" }}>
          Order Summary
        </span>
        {savings_vs_worst > 0 && (
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            Saving ${savings_vs_worst.toFixed(2)}
          </span>
        )}
      </div>

      {/* Vendor groups */}
      <div className="divide-y divide-[#2A343C]">
        {vendor_orders.map((vo) => (
          <div key={vo.vendor_id} className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#00C0C8] uppercase tracking-wider">
                {vo.vendor_name}
              </span>
              <span className="text-xs font-semibold text-[#F0EDE8]">
                ${vo.subtotal.toFixed(2)}
              </span>
            </div>
            <div className="space-y-1.5">
              {vo.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-[#8A9099] flex-1 mr-2 truncate">
                    {item.quantity}× {item.product_name}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[#8A9099]">${item.unit_price?.toFixed(2)}/ea</span>
                    <span className="text-[#F0EDE8] font-medium w-16 text-right">
                      ${item.line_total?.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Unpriced items warning */}
      {unpriced_items.length > 0 && (
        <div className="px-4 py-2 bg-amber-900/20 border-t border-amber-800/30">
          <p className="text-xs text-amber-400">
            No price found for: {unpriced_items.map(i => i.product_name).join(', ')}
          </p>
        </div>
      )}

      {/* Total */}
      <div className="px-4 py-3 border-t border-[#2A343C] flex items-center justify-between">
        <span className="text-sm font-bold text-[#F0EDE8]">Total</span>
        <span className="text-lg font-bold text-[#00C0C8]">${total_cost.toFixed(2)}</span>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex flex-col gap-2">
        <button
          onClick={onConfirm}
          className="w-full py-3 rounded-xl bg-[#00C0C8] text-[#0E1214] text-sm font-bold hover:bg-[#00A8AF] active:bg-[#008F96] transition-colors"
        >
          Confirm &amp; Save Order
        </button>
        <button
          onClick={async () => {
            setSaving(true)
            try {
              const items = vendor_orders.flatMap(vo =>
                vo.items.map(item => ({
                  product_id: item.product_id,
                  quantity: item.quantity,
                  selected_vendor_id: item.selected_vendor_id,
                  unit_price: item.unit_price,
                  line_total: item.line_total,
                }))
              )
              const vendor_splits = vendor_orders.map(vo => ({
                vendor_id: vo.vendor_id,
                total: vo.subtotal,
              }))
              await saveOrder({
                location_id: 1,
                total_cost,
                savings_vs_worst,
                requires_review: true,
                taco_flag_count: 0,
                origin_route: 'chat',
                items,
                vendor_splits,
              })
              navigate('/john')
            } catch {
              setSaving(false)
            }
          }}
          disabled={saving}
          className="w-full py-2.5 rounded-xl border border-[#2A343C] text-sm font-semibold text-[#8A9099] hover:text-[#F0EDE8] hover:border-[#3A444C] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Edit in Manual Mode'}
        </button>
      </div>
    </div>
  )
}
