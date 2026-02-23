import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import CategorySection from '../components/CategorySection'
import ClipboardCard from '../components/ClipboardCard'
import PARForm from './PARForm'
import { useOrder } from '../context/OrderContext'
import { fetchProducts } from '../api'

export default function Home() {
  const [activeTab, setActiveTab] = useState('quick')
  const [categories, setCategories] = useState([])
  const [expandedCategories, setExpandedCategories] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { selectedItems } = useOrder()
  const navigate = useNavigate()

  useEffect(() => {
    fetchProducts()
      .then((data) => {
        setCategories(data)
        if (data.length > 0) {
          setExpandedCategories({ [data[0].id]: true })
        }
      })
      .catch((err) => {
        setError('Failed to load products. Please try again.')
        console.error(err)
      })
      .finally(() => setLoading(false))
  }, [])

  const toggleExpand = (categoryId) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }))
  }

  const totalSelected = Object.keys(selectedItems).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500 text-sm">Loading products…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center px-6">
          <p className="text-red-500 mb-4 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <Header />

      {/* Tab strip */}
      <div className="fixed top-[60px] left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-2 flex gap-2">
        <button
          onClick={() => setActiveTab('quick')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'quick'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Quick Order
        </button>
        <button
          onClick={() => setActiveTab('par')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'par'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Inventory Count
        </button>
      </div>

      {/* Tab 1: Quick Order */}
      {activeTab === 'quick' && (
        <>
          <main className="flex-1 overflow-y-auto pt-[108px] pb-[70px] px-3 py-3">
            {categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <p className="text-gray-400 text-sm">No products found.</p>
              </div>
            ) : (
              categories.map((category) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  isExpanded={!!expandedCategories[category.id]}
                  onToggleExpand={toggleExpand}
                />
              ))
            )}
          </main>

          <footer className="fixed bottom-0 left-0 right-0 h-[70px] bg-white border-t border-gray-200 flex items-center justify-center px-4 z-50">
            <button
              className={`w-full max-w-md py-3 rounded-xl font-semibold text-sm transition-colors ${
                totalSelected > 0
                  ? 'bg-emerald-600 text-white active:bg-emerald-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              disabled={totalSelected === 0}
              onClick={() => navigate('/order-assembly')}
            >
              Assemble Orders
              {totalSelected > 0 && (
                <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {totalSelected} {totalSelected === 1 ? 'item' : 'items'}
                </span>
              )}
            </button>
          </footer>
        </>
      )}

      {/* Tab 2: Inventory Count (PAR form) */}
      {activeTab === 'par' && (
        <main className="flex-1 overflow-y-auto pt-[108px] pb-6 px-3 py-3">
          <ClipboardCard>
            <PARForm />
          </ClipboardCard>
        </main>
      )}
    </div>
  )
}
