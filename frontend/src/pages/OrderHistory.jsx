import PageHeader from '../components/PageHeader'
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api, { getOrders, getOrderSummary, exportOrdersCsv } from '../api'

const PERIODS = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
]

export default function OrderHistory({ embedded = false, onReopen = null }) {
  const navigate = useNavigate()
  const [period, setPeriod] = useState('all')
  const [orders, setOrders] = useState(() => {
    try {
      const cached = sessionStorage.getItem('orderHistoryList')
      return cached ? JSON.parse(cached) : []
    } catch { return [] }
  })
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveData, setArchiveData] = useState(null)
  const [archiveDataLoading, setArchiveDataLoading] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState(null)
  const [archivePeriodOrders, setArchivePeriodOrders] = useState([])
  const [expandedArchiveOrder, setExpandedArchiveOrder] = useState(null)
  const [archiveOrderDetail, setArchiveOrderDetail] = useState({})

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      getOrders(period, dateRange.start, dateRange.end),
      getOrderSummary(period, dateRange.start, dateRange.end)
    ])
      .then(([ordersRes, summaryRes]) => {
        setOrders(ordersRes.data)
        sessionStorage.setItem('orderHistoryList', JSON.stringify(ordersRes.data))
        setSummary(summaryRes.data)
      })
      .catch(() => setError('Failed to load order history. Please try again.'))
      .finally(() => setLoading(false))
  }, [period, dateRange])

  const handleCsvDownload = async () => {
    setCsvLoading(true)
    try {
      const res = await exportOrdersCsv(period, dateRange.start, dateRange.end)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = period === 'custom' ? 'orders_custom.csv' : `orders_${period}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('CSV export failed. Please try again.')
    } finally {
      setCsvLoading(false)
    }
  }

  const calendarButton = (
    <button onClick={() => setShowDatePicker(p => !p)} className={`flex-shrink-0 p-2 rounded-full border ${showDatePicker ? 'bg-[#00C0C8] text-[#0E1214] border-[#00C0C8]' : 'bg-[#222C33] text-[#8A9099] border-[#2A343C]'}`} aria-label="Date range">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </button>
  )

  const datePickerUI = showDatePicker && (
    <div className="flex flex-wrap gap-2 mb-4 items-center">
      <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
        className="border border-[#2A343C] rounded-lg px-2 py-1.5 text-sm bg-[#0E1214] text-[#F0EDE8]" />
      <span className="text-[#8A9099] text-sm">to</span>
      <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
        className="border border-[#2A343C] rounded-lg px-2 py-1.5 text-sm bg-[#0E1214] text-[#F0EDE8]" />
      <button
        onClick={() => { if (customStart && customEnd) { setDateRange({ start: customStart, end: customEnd }); setPeriod('custom'); setShowDatePicker(false) } }}
        disabled={!customStart || !customEnd}
        className="px-3 py-1.5 bg-[#00C0C8] text-[#0E1214] rounded-full text-sm font-bold disabled:opacity-50"
      >Apply</button>
    </div>
  )

  const archiveButton = (
    <button onClick={async () => {
      setArchiveOpen(true)
      setArchiveDataLoading(true)
      try {
        const token = localStorage.getItem('vc_token')
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const res = await api.get('/orders/archive', { headers })
        setArchiveData(res.data)
      } catch {
        setArchiveData({})
      } finally {
        setArchiveDataLoading(false)
      }
    }} className="flex items-center gap-1.5 px-4 py-2 min-h-[36px] text-sm font-medium text-[#8A9099] border border-[#2A343C] rounded-lg bg-[#222C33] active:opacity-75">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12h12L19 8M10 12h4" />
      </svg>
      Archive
    </button>
  )

  const archiveModal = archiveOpen && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setArchiveOpen(false)}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-[#1A2025] rounded-2xl border border-[#2A343C] shadow-xl p-6 mx-4 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#F0EDE8]" style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>Order Archive</h2>
          <button onClick={() => setArchiveOpen(false)} className="text-[#8A9099] p-1"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        {archiveDataLoading ? (
          <p className="text-sm text-[#8A9099]">Loading…</p>
        ) : archiveData ? (
          <div className="text-sm font-mono space-y-1 max-h-60 overflow-y-auto">
            {Object.keys(archiveData).sort((a,b) => b-a).map(year => (
              <div key={year}>
                <div className="text-[#F0EDE8]">📁 {year}</div>
                {Object.keys(archiveData[year]).map(month => (
                  <button
                    key={month}
                    onClick={() => {
                      setSelectedPeriod(`${year}-${month}`)
                      setArchivePeriodOrders(archiveData[year][month])
                    }}
                    className={`pl-4 w-full text-left hover:text-[#00C0C8] transition-colors ${selectedPeriod === `${year}-${month}` ? 'text-[#00C0C8]' : 'text-[#8A9099]'}`}
                  >
                    📁 {month} ({archiveData[year][month].length})
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#8A9099]">No archive data.</p>
        )}
        {selectedPeriod && archivePeriodOrders.length > 0 && (
          <div className="mt-4 border-t border-[#2A343C] pt-3 space-y-2 max-h-48 overflow-y-auto">
            <p className="text-xs text-[#8A9099] mb-2">{selectedPeriod}</p>
            {archivePeriodOrders.map(order => (
              <div key={order.id} className="border border-[#2A343C] rounded-xl overflow-hidden">
                <div
                  onClick={async () => {
                    const id = order.id
                    if (expandedArchiveOrder === id) {
                      setExpandedArchiveOrder(null)
                      return
                    }
                    setExpandedArchiveOrder(id)
                    if (!archiveOrderDetail[id]) {
                      try {
                        const token = localStorage.getItem('vc_token')
                        const headers = token ? { Authorization: `Bearer ${token}` } : {}
                        const res = await api.get(`/orders/${id}`, { headers })
                        setArchiveOrderDetail(prev => ({ ...prev, [id]: res.data }))
                      } catch {
                        setArchiveOrderDetail(prev => ({ ...prev, [id]: null }))
                      }
                    }
                  }}
                  className="flex items-center justify-between text-xs px-3 py-2 cursor-pointer hover:bg-[#222C33] transition-colors"
                >
                  <span className="text-[#8A9099]">{new Date(order.created_at).toLocaleDateString('en-US', {month:'short', day:'numeric'})}</span>
                  <span className="text-[#F0EDE8] font-bold">${order.total_cost.toFixed(2)}</span>
                  <span className="text-[#8A9099]">{order.item_count} items</span>
                  <span className="text-[#8A9099] ml-1">{expandedArchiveOrder === order.id ? '▾' : '▸'}</span>
                </div>
                {expandedArchiveOrder === order.id && (
                  <div className="border-t border-[#2A343C] px-3 py-2 bg-[#0E1214]">
                    {!archiveOrderDetail[order.id] && archiveOrderDetail[order.id] !== null ? (
                      <div className="flex items-center gap-2 py-1">
                        <div className="w-3 h-3 border-2 border-[#00C0C8] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-[#8A9099]">Loading…</span>
                      </div>
                    ) : archiveOrderDetail[order.id] === null ? (
                      <p className="text-xs text-[#8A9099]">Unable to load order detail</p>
                    ) : (
                      <div className="space-y-1">
                        {(archiveOrderDetail[order.id].items || []).map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-[#F0EDE8] flex-1 min-w-0 truncate">{item.product_name}</span>
                            <span className="text-[#8A9099] mx-2 flex-shrink-0">{item.quantity} × ${item.unit_price?.toFixed(2) ?? '—'}</span>
                            <span className="text-[#8A9099] flex-shrink-0">${item.line_total?.toFixed(2) ?? '—'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderOrderCard = (order) => {
    const cardContent = (
      <>
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-xs text-[#8A9099] font-medium">
              {new Date(order.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-[#3DAA6E]/15 text-[#3DAA6E]">
                {order.status}
              </span>
              {order.review_status === 'approved' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#3DAA6E]/15 text-[#3DAA6E]">
                  Approved
                </span>
              )}
              {order.review_status === 'rejected' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#C23B3B]/15 text-[#C23B3B]">
                  Rejected
                </span>
              )}
              {order.review_status === 'pending' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#E07B35]/15 text-[#E07B35]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E07B35] inline-block" />
                  Pending Review
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-base font-bold text-[#F0EDE8]">${order.total_cost.toFixed(2)}</p>
            {order.savings_vs_worst > 0 && (
              <p className="text-xs text-[#3DAA6E]">saved ${order.savings_vs_worst.toFixed(2)}</p>
            )}
          </div>
        </div>
        <div className="flex gap-4 text-xs text-[#8A9099]">
          <span>{order.item_count} {order.item_count === 1 ? 'item' : 'items'}</span>
          <span>{order.vendor_count} {order.vendor_count === 1 ? 'vendor' : 'vendors'}</span>
        </div>
        {order.review_note && (order.review_status === 'approved' || order.review_status === 'rejected') && (
          <p className="text-xs text-[#8A9099] mt-1.5 italic">
            <span className="font-medium not-italic text-[#8A9099]">John's note:</span> {order.review_note}
          </p>
        )}
      </>
    )

    if (embedded) {
      return (
        <div
          key={order.id}
          onClick={() => navigate(`/history/${order.id}`)}
          className="w-full bg-[#1A2025] rounded-xl border border-[#2A343C] p-4 text-left hover:bg-[#222C33] transition-colors duration-150 cursor-pointer"
        >
          {cardContent}
          {embedded && onReopen && (order.review_status === 'approved' || order.review_status === 'rejected' || order.review_status === 'pending_review') && (
            <button
              onClick={(e) => { e.stopPropagation(); onReopen(order) }}
              className="mt-2 text-xs font-semibold text-[#00C0C8] border border-[#00C0C8]/30 rounded-lg px-3 py-1.5 bg-[#00C0C8]/5 active:opacity-75"
            >
              Reopen
            </button>
          )}
        </div>
      )
    }

    return (
      <button
        key={order.id}
        onClick={() => navigate(`/history/${order.id}`)}
        className="w-full bg-[#1A2025] rounded-xl border border-[#2A343C] p-4 text-left hover:bg-[#222C33] transition-colors duration-150"
      >
        {cardContent}
      </button>
    )
  }

  // When embedded in John's Glasses, render content only (no header, no outer layout)
  if (embedded) {
    return (
      <div className="pb-6">
        {/* Period filter + calendar icon */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 items-center">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`flex-shrink-0 px-3 py-2 min-h-[36px] rounded-full text-sm font-medium transition-colors ${
                period === p.value
                  ? 'bg-[#00C0C8] text-[#0E1214]'
                  : 'bg-[#222C33] text-[#8A9099] border border-[#2A343C] active:opacity-75'
              }`}
            >
              {p.label}
            </button>
          ))}
          {calendarButton}
        </div>

        {datePickerUI}

        {summary && (
          <div className="mb-6">
            {/* John's Glasses — KPI medallion row */}
            <div className="flex items-center justify-around py-2 mb-2">
              <div className="kpi-medallion">
                <span className="text-[9px] text-[#8A9099] uppercase tracking-wide leading-none mb-0.5">Spent</span>
                <span className="text-xs font-bold text-[#F0EDE8] leading-tight">${summary.total_spent.toFixed(0)}</span>
              </div>
              <div className="kpi-medallion">
                <span className="text-[9px] text-[#8A9099] uppercase tracking-wide leading-none mb-0.5">Saved</span>
                <span className="text-xs font-bold text-[#3DAA6E] leading-tight">${summary.total_saved.toFixed(0)}</span>
              </div>
              <div className="kpi-medallion">
                <span className="text-[9px] text-[#8A9099] uppercase tracking-wide leading-none mb-0.5">Orders</span>
                <span className="text-xs font-bold text-[#F0EDE8] leading-tight">{summary.order_count}</span>
              </div>
            </div>
            {/* Gold ornamental section divider */}
            <div className="gold-divider mx-2" />
          </div>
        )}

        {/* CSV download + Archive */}
        {!loading && !error && orders.length > 0 && (
          <div className="flex justify-end gap-2 mb-3">
            {archiveButton}
            <button
              onClick={handleCsvDownload}
              disabled={csvLoading}
              className="flex items-center gap-1.5 px-4 py-2 min-h-[36px] text-sm font-medium text-[#00C0C8] border border-[#00C0C8]/40 rounded-lg bg-[#222C33] active:opacity-75 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {csvLoading ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-[#00C0C8] border-t-transparent rounded-full animate-spin" />
              <span className="text-[#8A9099] text-sm">Loading orders...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-[#C23B3B]/10 border border-[#C23B3B]/20 rounded-2xl p-4 text-center">
            <p className="text-[#C23B3B] text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <p className="text-[#8A9099] text-sm">No orders saved yet.</p>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="space-y-2">
            {orders.map((order) => renderOrderCard(order))}
          </div>
        )}

        {archiveModal}
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0E1214]">
      <PageHeader title="Order History" />

      <main className="flex-1 pt-[76px] pb-6 px-3">
        {/* Period filter + calendar icon */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 items-center">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`flex-shrink-0 px-3 py-2 min-h-[36px] rounded-full text-sm font-medium transition-colors ${
                period === p.value
                  ? 'bg-[#00C0C8] text-[#0E1214]'
                  : 'bg-[#222C33] text-[#8A9099] border border-[#2A343C] active:opacity-75'
              }`}
            >
              {p.label}
            </button>
          ))}
          {calendarButton}
        </div>

        {datePickerUI}

        {/* Spend summary banner */}
        {summary && (
          <div className="bg-[#00C0C8]/10 border border-[#00C0C8]/20 rounded-2xl p-4 mb-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-[#00C0C8] font-medium uppercase tracking-wide">Total Spent</p>
                <p className="text-xl font-bold text-[#F0EDE8]">${summary.total_spent.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-[#00C0C8] font-medium uppercase tracking-wide">Total Saved</p>
                <p className="text-xl font-bold text-[#F0EDE8]">${summary.total_saved.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-[#00C0C8] font-medium uppercase tracking-wide">Orders</p>
                <p className="text-xl font-bold text-[#F0EDE8]">{summary.order_count}</p>
              </div>
            </div>
          </div>
        )}

        {/* CSV download + Archive */}
        {!loading && !error && orders.length > 0 && (
          <div className="flex justify-end gap-2 mb-3">
            {archiveButton}
            <button
              onClick={handleCsvDownload}
              disabled={csvLoading}
              className="flex items-center gap-1.5 px-4 py-2 min-h-[36px] text-sm font-medium text-[#00C0C8] border border-[#00C0C8]/40 rounded-lg bg-[#222C33] active:opacity-75 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {csvLoading ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-[#00C0C8] border-t-transparent rounded-full animate-spin" />
              <span className="text-[#8A9099] text-sm">Loading orders...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-[#C23B3B]/10 border border-[#C23B3B]/20 rounded-2xl p-4 text-center">
            <p className="text-[#C23B3B] text-sm">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <svg className="w-12 h-12 text-[#2A343C] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-[#8A9099] text-sm mb-4">No orders saved yet. Assemble an order and hit Save.</p>
            <Link
              to="/"
              className="px-4 py-2 bg-[#00C0C8] text-[#0E1214] rounded-full text-sm font-bold"
            >
              Go to Catalog
            </Link>
          </div>
        )}

        {/* Order list */}
        {!loading && !error && orders.length > 0 && (
          <div className="space-y-2">
            {orders.map((order) => renderOrderCard(order))}
          </div>
        )}
      </main>

      {archiveModal}
    </div>
  )
}
