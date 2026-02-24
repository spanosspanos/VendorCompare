import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getOrders, getOrderSummary, exportOrdersCsv } from '../api'

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
]

export default function OrderHistory() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState('all')
  const [orders, setOrders] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [csvLoading, setCsvLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([getOrders(period), getOrderSummary(period)])
      .then(([ordersRes, summaryRes]) => {
        setOrders(ordersRes.data)
        setSummary(summaryRes.data)
      })
      .catch(() => setError('Failed to load order history. Please try again.'))
      .finally(() => setLoading(false))
  }, [period])

  const handleCsvDownload = async () => {
    setCsvLoading(true)
    try {
      const res = await exportOrdersCsv(period)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `orders_${period}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('CSV export failed. Please try again.')
    } finally {
      setCsvLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-emerald-700 text-white flex items-center justify-between px-4 z-50 shadow-md">
        <button onClick={() => navigate('/')} className="p-2" aria-label="Home">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Order History</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 pt-[76px] pb-6 px-3">
        {/* Period filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                period === p.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 active:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Spend summary banner */}
        {summary && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Total Spent</p>
                <p className="text-lg font-bold text-emerald-800">${summary.total_spent.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Total Saved</p>
                <p className="text-lg font-bold text-emerald-800">${summary.total_saved.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Orders</p>
                <p className="text-lg font-bold text-emerald-800">{summary.order_count}</p>
              </div>
            </div>
          </div>
        )}

        {/* CSV download */}
        {!loading && !error && orders.length > 0 && (
          <div className="flex justify-end mb-3">
            <button
              onClick={handleCsvDownload}
              disabled={csvLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-emerald-700 border border-emerald-300 rounded-lg bg-white active:bg-emerald-50 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {csvLoading ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-500 text-sm">Loading orders…</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 text-sm mb-4">No orders saved yet. Assemble an order and hit Save.</p>
            <Link
              to="/"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium"
            >
              Go to Catalog
            </Link>
          </div>
        )}

        {/* Order list */}
        {!loading && !error && orders.length > 0 && (
          <div className="space-y-2">
            {orders.map((order) => (
              <button
                key={order.id}
                onClick={() => navigate(`/history/${order.id}`)}
                className="w-full bg-white rounded-2xl shadow-sm p-4 text-left hover:shadow-md active:bg-gray-50 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        {order.status}
                      </span>
                      {order.review_status === 'approved' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          Approved
                        </span>
                      )}
                      {order.review_status === 'rejected' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                          Rejected
                        </span>
                      )}
                      {order.review_status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                          Pending Review
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-gray-800">${order.total_cost.toFixed(2)}</p>
                    {order.savings_vs_worst > 0 && (
                      <p className="text-xs text-emerald-600">saved ${order.savings_vs_worst.toFixed(2)}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-gray-400">
                  <span>{order.item_count} {order.item_count === 1 ? 'item' : 'items'}</span>
                  <span>{order.vendor_count} {order.vendor_count === 1 ? 'vendor' : 'vendors'}</span>
                </div>
                {order.review_note && (order.review_status === 'approved' || order.review_status === 'rejected') && (
                  <p className="text-xs text-gray-400 mt-1.5 italic">
                    <span className="font-medium not-italic text-gray-500">John's note:</span> {order.review_note}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
