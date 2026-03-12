/**
 * PriceDiff — diff table subcomponent
 * Props: diffs, unmatched
 */
export default function PriceDiff({ diffs = [], unmatched = [] }) {
  return (
    <div className="space-y-4">
      {/* Diff table */}
      {diffs.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[#2A343C]">
          <table className="w-full text-sm">
            <thead className="bg-[#1A242C] text-[#8A9099]">
              <tr>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-right px-3 py-2">Old Price</th>
                <th className="text-right px-3 py-2">New Price</th>
                <th className="text-right px-3 py-2">Change</th>
              </tr>
            </thead>
            <tbody>
              {diffs.map((d, i) => {
                const isDecrease = d.change_pct !== null && d.change_pct < 0
                const isIncrease = d.change_pct !== null && d.change_pct > 0
                return (
                  <tr key={i} className="border-t border-[#2A343C] hover:bg-[#1A242C]/40">
                    <td className="px-3 py-2 text-[#F0EDE8]">
                      {d.product_name}
                      {d.unit ? <span className="ml-1 text-xs text-[#8A9099]">/ {d.unit}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right text-[#8A9099]">
                      {d.old_price != null ? `$${d.old_price.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-[#F0EDE8] font-medium">
                      ${d.new_price.toFixed(2)}
                    </td>
                    <td className={`px-3 py-2 text-right font-medium ${
                      isDecrease ? 'text-[#00C0C8]' : isIncrease ? 'text-[#C23B3B]' : 'text-[#8A9099]'
                    }`}>
                      {d.change_pct != null
                        ? `${isDecrease ? '▼' : isIncrease ? '▲' : ''}${Math.abs(d.change_pct).toFixed(1)}%`
                        : 'NEW'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Unmatched items */}
      {unmatched.length > 0 && (
        <div className="rounded-xl border border-[#D4A017]/30 bg-[#D4A017]/5 p-3">
          <p className="text-xs font-semibold text-[#D4A017] mb-2">
            ⚠ {unmatched.length} unmatched item{unmatched.length > 1 ? 's' : ''} (not in catalog)
          </p>
          <ul className="space-y-1">
            {unmatched.map((u, i) => (
              <li key={i} className="text-xs text-[#8A9099] flex justify-between">
                <span>{u.raw_name}</span>
                <span>${u.new_price?.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diffs.length === 0 && unmatched.length === 0 && (
        <p className="text-sm text-[#8A9099] text-center py-4">No changes found — all prices are already up to date.</p>
      )}
    </div>
  )
}
