import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import PARManager from '../components/PARManager'
import OrderReviewQueue from '../components/OrderReviewQueue'
import OrderDetailJohns from '../components/OrderDetailJohns'
import OrderHistory from './OrderHistory'

export default function JohnsGlasses() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('queue') // 'queue' | 'history'
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [actionedIds, setActionedIds] = useState([])
  const [confirmation, setConfirmation] = useState(null) // { orderId, action }
  const confirmTimerRef = useRef(null)

  const handleSelectOrder = (order) => {
    setSelectedOrder(order)
  }

  const handleBackToQueue = () => {
    setSelectedOrder(null)
  }

  const handleAction = (orderId, action) => {
    setActionedIds((prev) => [...prev, orderId])
    setSelectedOrder(null)
    setConfirmation({ orderId, action })

    // Auto-dismiss confirmation after 4 seconds
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    confirmTimerRef.current = setTimeout(() => setConfirmation(null), 4000)
  }

  const handleConfirmationDismiss = () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    setConfirmation(null)
  }

  useEffect(() => {
    return () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current) }
  }, [])

  if (selectedOrder) {
    return (
      <OrderDetailJohns
        order={selectedOrder}
        onBack={handleBackToQueue}
        onAction={handleAction}
      />
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-emerald-700 text-white flex items-center justify-between px-4 z-50 shadow-md">
        {/* Back to Kitchen */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-sm text-emerald-200 hover:text-white transition-colors py-1 px-1"
          aria-label="Back to Kitchen"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Kitchen</span>
        </button>

        <div className="flex items-center gap-2">
          <svg width="28" height="14" viewBox="0 0 28 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-90">
            <rect x="1" y="2" width="10" height="8" rx="4" stroke="white" strokeWidth="2" fill="none"/>
            <rect x="17" y="2" width="10" height="8" rx="4" stroke="white" strokeWidth="2" fill="none"/>
            <line x1="11" y1="6" x2="17" y2="6" stroke="white" strokeWidth="2"/>
            <line x1="0" y1="4" x2="1" y2="4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <line x1="27" y1="4" x2="28" y2="4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <h1 className="text-lg font-semibold">John's Glasses</h1>
        </div>

        {/* Spacer to balance the header */}
        <div className="w-[70px]" />
      </header>

      {/* Tab navigation — pinned below header */}
      <div className="fixed top-[60px] left-0 right-0 bg-white border-b border-gray-200 z-40">
        <div className="flex">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'queue'
                ? 'text-emerald-700 border-b-2 border-emerald-600'
                : 'text-gray-500 border-b-2 border-transparent hover:text-gray-700'
            }`}
          >
            Pending Review
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-emerald-700 border-b-2 border-emerald-600'
                : 'text-gray-500 border-b-2 border-transparent hover:text-gray-700'
            }`}
          >
            Order History
          </button>
        </div>
      </div>

      <main className="flex-1 pt-[108px] pb-8 px-3 space-y-4">
        {/* Post-action confirmation banner */}
        {confirmation && (
          <div className={`rounded-2xl p-3 flex items-center justify-between gap-3 ${
            confirmation.action === 'approved'
              ? 'bg-emerald-50 border border-emerald-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`text-sm font-medium ${
              confirmation.action === 'approved' ? 'text-emerald-800' : 'text-red-700'
            }`}>
              {confirmation.action === 'approved'
                ? `Order #${confirmation.orderId} approved ✅`
                : `Order #${confirmation.orderId} rejected ✗`}
            </p>
            <Link
              to={`/history/${confirmation.orderId}`}
              onClick={handleConfirmationDismiss}
              className="text-xs font-semibold text-emerald-700 hover:underline flex-shrink-0"
            >
              View in History →
            </Link>
          </div>
        )}

        {activeTab === 'queue' && (
          <>
            <section>
              <OrderReviewQueue
                onSelectOrder={handleSelectOrder}
                excludeIds={actionedIds}
              />
            </section>
            <section>
              <PARManager />
            </section>
          </>
        )}

        {activeTab === 'history' && (
          <OrderHistory embedded />
        )}
      </main>
    </div>
  )
}
