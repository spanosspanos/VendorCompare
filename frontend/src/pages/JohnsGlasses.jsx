import PageHeader from '../components/PageHeader'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import PARManager from '../components/PARManager'
import OrderReviewQueue from '../components/OrderReviewQueue'
import OrderDetailJohns from '../components/OrderDetailJohns'
import OrderHistory from './OrderHistory'
import VaultTab from '../components/VaultTab'
import EmployeeManagement from '../components/EmployeeManagement'
import { getOrderDetail } from '../api'

export default function JohnsGlasses() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('johnsGlassesTab') || 'queue')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [actionedIds, setActionedIds] = useState([])
  const [confirmation, setConfirmation] = useState(null) // { orderId, action }
  const [vendorRevision, setVendorRevision] = useState(0)
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

  const handleReopen = async (order) => {
    try {
      const res = await getOrderDetail(order.id)
      setSelectedOrder({ ...res.data, _isReopen: true })
    } catch {
      // fallback: use the order as-is
      setSelectedOrder({ ...order, items: order.items || [], vendor_splits: order.vendor_splits || [], _isReopen: true })
    }
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
        isReopen={selectedOrder?._isReopen || false}
      />
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0E1214]">
      <PageHeader
        title="John's Glasses"
        icons={[{ emoji: '👓', label: 'glasses' }, { emoji: '🍸', label: 'martini' }, { emoji: '📋', label: 'clipboard' }]}
      />

      {/* Tab navigation — pinned below header */}
      <div className="fixed top-[60px] left-0 right-0 bg-[#0E1214] border-b border-[#2A343C] z-40">
        <div className="flex">
          <button
            data-tour="glasses-queue-tab"
            onClick={() => { setActiveTab('queue'); sessionStorage.setItem('johnsGlassesTab', 'queue') }}
            className={`flex-1 min-h-[44px] py-3 text-sm font-medium transition-colors ${
              activeTab === 'queue'
                ? 'text-[#00C0C8] border-b-2 border-[#00C0C8]'
                : 'text-[#8A9099] border-b-2 border-transparent hover:text-[#F0EDE8]'
            }`}
          >
            Pending Review
          </button>
          <button
            data-tour="glasses-history-tab"
            onClick={() => { setActiveTab('history'); sessionStorage.setItem('johnsGlassesTab', 'history') }}
            className={`flex-1 min-h-[44px] py-3 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-[#00C0C8] border-b-2 border-[#00C0C8]'
                : 'text-[#8A9099] border-b-2 border-transparent hover:text-[#F0EDE8]'
            }`}
          >
            Order History
          </button>
          <button
            onClick={() => { setActiveTab('employees'); sessionStorage.setItem('johnsGlassesTab', 'employees') }}
            className={`flex-1 min-h-[44px] py-3 text-sm font-medium transition-colors ${
              activeTab === 'employees'
                ? 'text-[#D4A017] border-b-2 border-[#D4A017]'
                : 'text-[#8A9099] border-b-2 border-transparent hover:text-[#F0EDE8]'
            }`}
          >
            Employees
          </button>
          <button
            onClick={() => { setActiveTab('vault'); sessionStorage.setItem('johnsGlassesTab', 'vault') }}
            className={`flex-1 min-h-[44px] py-3 text-sm font-medium transition-colors ${
              activeTab === 'vault'
                ? 'text-[#00C0C8] border-b-2 border-[#00C0C8]'
                : 'text-[#8A9099] border-b-2 border-transparent hover:text-[#F0EDE8]'
            }`}
          >
            Vault
          </button>

        </div>
      </div>

      <main className="flex-1 pt-[108px] pb-8 px-3 space-y-4">
        {/* Post-action confirmation banner */}
        {confirmation && (
          <div className={`rounded-2xl p-3 flex items-center justify-between gap-3 shadow-sm ${
            confirmation.action === 'approved'
              ? 'bg-[#00C0C8]/10 border border-[#00C0C8]/30'
              : 'bg-[#C23B3B]/10 border border-[#C23B3B]/30'
          }`}>
            <p className={`text-sm font-medium ${
              confirmation.action === 'approved' ? 'text-[#00C0C8]' : 'text-[#C23B3B]'
            }`}>
              {confirmation.action === 'approved'
                ? `Order #${confirmation.orderId} approved ✅`
                : `Order #${confirmation.orderId} rejected ✗`}
            </p>
            <Link
              to={`/history/${confirmation.orderId}`}
              onClick={handleConfirmationDismiss}
              className="text-xs font-semibold text-[#00C0C8] hover:underline flex-shrink-0 py-2"
            >
              View in History →
            </Link>
          </div>
        )}

        {activeTab === 'queue' && (
          <>
            <section data-tour="glasses-queue">
              <OrderReviewQueue
                onSelectOrder={handleSelectOrder}
                excludeIds={actionedIds}
              />
            </section>
            {/* Gold ornamental section divider between queue and PAR manager */}
            <div className="gold-divider mx-1" />
            <section>
              <PARManager refreshKey={vendorRevision} />
            </section>
          </>
        )}

        {activeTab === 'history' && (
          <OrderHistory embedded onReopen={handleReopen} />
        )}

        {activeTab === 'vault' && (
          <VaultTab onVendorUpdate={() => setVendorRevision(v => v + 1)} />
        )}

        {activeTab === 'employees' && (
          <EmployeeManagement />
        )}

      </main>
    </div>
  )
}
