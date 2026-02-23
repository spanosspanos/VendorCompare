import { useState, useEffect } from 'react'
import { fetchProducts, getParSettings, upsertParSetting } from '../api'

export default function PARManager() {
  const [categories, setCategories] = useState([])
  const [parValues, setParValues] = useState({})      // {product_id → string input value}
  const [saveStatus, setSaveStatus] = useState({})    // {product_id → 'saving'|'saved'|'error'}
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([fetchProducts(), getParSettings()])
      .then(([productsData, parRes]) => {
        setCategories(productsData)
        const map = {}
        parRes.data.forEach((s) => {
          map[s.product_id] = String(s.par_value)
        })
        setParValues(map)
      })
      .catch(() => setError('Failed to load products. Please try again.'))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (productId, value) => {
    setParValues((prev) => ({ ...prev, [productId]: value }))
  }

  const handleSave = async (productId) => {
    const value = parseInt(parValues[productId] ?? '0')
    if (isNaN(value) || value < 0) return

    setSaveStatus((prev) => ({ ...prev, [productId]: 'saving' }))
    try {
      await upsertParSetting(productId, value)
      setSaveStatus((prev) => ({ ...prev, [productId]: 'saved' }))
      setTimeout(() => {
        setSaveStatus((prev) => {
          const next = { ...prev }
          delete next[productId]
          return next
        })
      }, 2000)
    } catch {
      setSaveStatus((prev) => ({ ...prev, [productId]: 'error' }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Loading products…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-800">PAR Values</h2>
        <p className="text-xs text-gray-500 mt-0.5">Set the target inventory level for each product.</p>
      </div>

      {categories.map((category) => (
        <div key={category.id}>
          {/* Category header */}
          <div className="px-4 py-2 bg-gray-50/60 border-b border-t border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {category.name}
            </span>
          </div>

          {/* Product rows */}
          {category.products.map((product) => {
            const status = saveStatus[product.id]
            const inputValue = parValues[product.id] ?? ''

            return (
              <div
                key={product.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0"
              >
                <span className="flex-1 text-sm text-gray-800 min-w-0 truncate">{product.name}</span>
                <input
                  type="number"
                  min="0"
                  value={inputValue}
                  placeholder="—"
                  onChange={(e) => handleChange(product.id, e.target.value)}
                  className="w-16 text-center text-sm border border-gray-200 rounded-lg py-1 px-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <button
                  onClick={() => handleSave(product.id)}
                  disabled={status === 'saving'}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    status === 'saved'
                      ? 'bg-emerald-100 text-emerald-700'
                      : status === 'error'
                      ? 'bg-red-100 text-red-600'
                      : status === 'saving'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  {status === 'saved' ? 'Saved ✓' :
                   status === 'saving' ? 'Saving…' :
                   status === 'error' ? 'Error' :
                   'Save'}
                </button>
              </div>
            )
          })}
        </div>
      ))}

      {categories.length === 0 && (
        <div className="py-10 text-center text-gray-400 text-sm">No products found.</div>
      )}
    </div>
  )
}
