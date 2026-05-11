import { useNavigate, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import CartModal from '../components/CartModal'
import ManualDrawer from '../components/ManualDrawer'
import { useOrder } from '../context/OrderContext'
import { useAuth } from '../context/AuthContext'
import { getPendingReviewOrders, deleteOrder } from '../api'
import { countAssembledOrders } from '../utils/assembledOrders'

export default function Home() {
  const navigate = useNavigate()
  const { selectedItems } = useOrder()
  const { role } = useAuth()
  const itemCount = Object.keys(selectedItems).length
  const [assembledCount, setAssembledCount] = useState(countAssembledOrders())
  const [pendingOrders, setPendingOrders] = useState([])
  const [margOpen, setMargOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const pendingCount = pendingOrders.length

  const fetchPendingCount = async () => {
    try {
      const res = await getPendingReviewOrders()
      setPendingOrders(res.data || [])
    } catch {
      // silently fail
    }
  }

  useEffect(() => { fetchPendingCount() }, [])

  useEffect(() => {
    const handler = () => fetchPendingCount()
    window.addEventListener('orderSaved', handler)
    return () => window.removeEventListener('orderSaved', handler)
  }, [])

  useEffect(() => {
    setAssembledCount(countAssembledOrders())
  }, [cartOpen])

  const openMargarita = async () => {
    setMargOpen(true)
    setLoadingOrders(true)
    try {
      const res = await getPendingReviewOrders()
      setPendingOrders(res.data || [])
    } catch {
      setPendingOrders([])
    } finally {
      setLoadingOrders(false)
    }
  }

  const handleSelectOrder = (order) => {
    setMargOpen(false)
    navigate('/order-assembly', { state: { fromPendingOrder: true, order } })
  }

  const handleDeleteClick = (e, orderId) => {
    e.stopPropagation()
    setDeleteConfirm(orderId)
  }

  const handleDeleteConfirm = async (e, orderId) => {
    e.stopPropagation()
    try {
      await deleteOrder(orderId)
      setPendingOrders((prev) => prev.filter((o) => o.id !== orderId))
      setDeleteConfirm(null)
    } catch {
      alert('Delete failed. Please try again.')
      setDeleteConfirm(null)
    }
  }

  const handleDeleteCancel = (e) => {
    e.stopPropagation()
    setDeleteConfirm(null)
  }

  const rightContent = (
    <div className="flex items-center gap-2">
      {/* Bus icon — Owner's Manual */}
      <button
        data-tour="bus-btn"
        onClick={() => setManualOpen(true)}
        className="relative p-2 flex items-center"
        aria-label="Owner's Manual"
      >
        <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>🚌</span>
      </button>

      {/* John's Glasses — admin only */}
      {role === 'admin' && (
        <Link to="/glasses" data-tour="glasses-icon" className="relative p-2 flex items-center" aria-label="John's Glasses">
          <span className="px-1 text-xl leading-none">👓</span>
        </Link>
      )}

      {/* Margarita Glass — pending orders */}
      <button
        data-tour="margarita-btn"
        onClick={openMargarita}
        className="relative p-2 flex items-center"
        aria-label="My pending orders"
      >
        <span className="px-1 text-xl leading-none">🍸</span>
        {pendingCount > 0 && (
          <span className="absolute top-0 right-0 bg-[#E07B35] text-[#0E1214] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {pendingCount}
          </span>
        )}
      </button>

      {/* Clipboard — cart */}
      <button
        data-tour="clipboard-btn"
        onClick={() => setCartOpen(true)}
        className="relative p-2 flex items-center"
        aria-label="View cart"
      >
        <span className="px-1 text-xl leading-none">📋</span>
        {(itemCount + assembledCount) > 0 && (
          <span className="absolute top-0 right-0 bg-[#00C0C8] text-[#0E1214] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {itemCount + assembledCount}
          </span>
        )}
      </button>
    </div>
  )

  return (
    <div className="flex flex-col h-screen bg-[#0E1214]">
      <PageHeader
        title="Cantina Orders"
        showBack={false}
        rightContent={rightContent}
      />

      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-[60px] gap-4">
        <p className="text-[#8A9099] text-sm mb-2">What do you need to do?</p>

        <div data-tour="home-buttons" className="w-full flex flex-col gap-4">
          <button
            onClick={() => navigate('/quick-order')}
            className="w-full max-w-sm bg-[#1A2025] rounded-xl border border-[#2A343C] p-5 text-left motion-card hover:bg-[#222C33] hover:border-[#00C0C8]/30"
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-[#00C0C8]/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#00C0C8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M12 11v4m-2-2h4" />
                </svg>
              </div>
              <span className="text-base font-bold text-[#F0EDE8]" style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>Quick Order</span>
            </div>
            <p className="text-sm text-[#8A9099] ml-[52px]">Manually build an order from the catalog.</p>
          </button>

          <button
            onClick={() => navigate('/inventory-count')}
            className="w-full max-w-sm bg-[#1A2025] rounded-xl border border-[#2A343C] p-5 text-left motion-card hover:bg-[#222C33] hover:border-[#00C0C8]/30"
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-[#00C0C8]/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#00C0C8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <span className="text-base font-bold text-[#F0EDE8]" style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>Inventory Count</span>
            </div>
            <p className="text-sm text-[#8A9099] ml-[52px]">Count what's on hand and generate orders from PAR levels.</p>
          </button>
        </div>
      </main>

      {/* Margarita popup — pending orders list */}
      {margOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end" onClick={() => setMargOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-[#1A2025] rounded-t-2xl border border-[#2A343C] shadow-xl max-h-[75vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-[#2A343C] rounded-full" />
            </div>
            <div className="px-4 py-3 border-b border-[#2A343C] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-[#F0EDE8]">My Pending Orders</h2>
                {!loadingOrders && (
                  <p className="text-xs text-[#8A9099] mt-0.5">
                    {pendingOrders.length === 0 ? 'No pending orders' : `${pendingOrders.length} awaiting John's approval`}
                  </p>
                )}
              </div>
              <button onClick={() => setMargOpen(false)} className="p-2 text-[#8A9099] active:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {loadingOrders && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-7 h-7 border-4 border-[#00C0C8] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!loadingOrders && pendingOrders.length === 0 && (
                <div className="py-12 text-center px-6">
                  <p className="text-[#8A9099] text-sm">No pending orders. Assemble an order to submit it for review.</p>
                </div>
              )}
              {!loadingOrders && pendingOrders.length > 0 && (
                <div className="divide-y divide-[#2A343C]">
                  {pendingOrders.map((order) => {
                    const isConfirming = deleteConfirm === order.id
                    const formattedDate = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    const formattedTime = new Date(order.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    return (
                      <div
                        key={order.id}
                        onClick={() => !isConfirming && handleSelectOrder(order)}
                        className={`px-4 py-3 flex items-center justify-between cursor-pointer ${isConfirming ? '' : 'hover:bg-[#222C33] active:bg-[#222C33]'} transition-colors`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-[#F0EDE8]">Cantina Order #{order.id}</span>
                            {(order.taco_flag_count > 0) && (
                              <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">🌮</span>
                            )}
                          </div>
                          <p className="text-xs text-[#8A9099]">{formattedDate} · {formattedTime}</p>
                          <div className="flex gap-3 text-xs text-[#8A9099] mt-0.5">
                            <span>{(order.items || []).length} items</span>
                            <span>${order.total_cost?.toFixed(2) ?? '—'}</span>
                          </div>
                        </div>
                        {!isConfirming ? (
                          <button
                            onClick={(e) => handleDeleteClick(e, order.id)}
                            className="ml-3 p-2 text-red-400 hover:text-red-500 active:text-red-600 transition-colors flex-shrink-0"
                            aria-label="Delete order"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        ) : (
                          <div className="ml-3 flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-red-600 font-medium">Delete?</span>
                            <button onClick={(e) => handleDeleteConfirm(e, order.id)} className="px-2 py-1 bg-red-600 text-white text-xs font-semibold rounded-lg active:bg-red-700">Yes</button>
                            <button onClick={handleDeleteCancel} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg active:bg-gray-200">No</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="px-4 py-4 border-t border-[#2A343C] flex-shrink-0">
              <button onClick={() => setMargOpen(false)} className="w-full py-3 rounded-xl border border-[#2A343C] text-sm font-semibold text-[#F0EDE8] bg-[#222C33] active:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <CartModal isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      <ManualDrawer isOpen={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  )
}
