import { useState, useEffect, useMemo, useRef } from 'react'
import { getParSettingsWithPrices, upsertParSetting, updateVendorLock, updatePrice, patchProduct, createProduct, deleteProductPermanent, fetchCategories } from '../api'
import HelpTooltip from './HelpTooltip'

export default function PARManager({ refreshKey }) {
  const [products, setProducts] = useState([])
  const [parValues, setParValues] = useState({})
  const [saveStatus, setSaveStatus] = useState({})
  const [editingPrice, setEditingPrice] = useState({})
  const [priceInput, setPriceInput] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  // ⋯ menu state
  const [openMenu, setOpenMenu] = useState(null) // product_id or null
  const [renamingId, setRenamingId] = useState(null)
  const [renameInput, setRenameInput] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  // Graveyard
  const [graveyardOpen, setGraveyardOpen] = useState(false)
  const [permDeleteConfirmId, setPermDeleteConfirmId] = useState(null)
  const [clearAllConfirm, setClearAllConfirm] = useState(false)

  // Add Item
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [categories, setCategories] = useState([])
  const [newName, setNewName] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newPar, setNewPar] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [addItemSaving, setAddItemSaving] = useState(false)

  const [expandedCategories, setExpandedCategories] = useState({})
  const [noVendorFlag, setNoVendorFlag] = useState({}) // FR-PRICE-01: products with no vendor

  const menuRef = useRef(null)

  const loadData = () => {
    return getParSettingsWithPrices()
      .then((res) => {
        const data = res.data
        setProducts(data)
        const map = {}
        data.forEach((p) => {
          map[p.product_id] = String(p.par_value ?? '')
        })
        setParValues(map)
      })
  }

  useEffect(() => {
    loadData()
      .catch(() => setError('Failed to load products. Please try again.'))
      .finally(() => setLoading(false))
    fetchCategories().then(setCategories).catch(() => {})
  }, [refreshKey])

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null)
        setDeleteConfirmId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredProducts = useMemo(() => {
    const active = products.filter(p => !p.is_deleted)
    if (!search.trim()) return active
    const term = search.toLowerCase()
    return active.filter(p => p.product_name.toLowerCase().includes(term))
  }, [products, search])

  const groupedProducts = useMemo(() => {
    const groups = {}
    filteredProducts.forEach(p => {
      const cat = categories.find(c => c.id === p.category_id)?.name || 'Uncategorized'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(p)
    })
    // Sort by category sort_order (from categories list), with Uncategorized last
    const catOrder = {}
    categories.forEach(c => { catOrder[c.name] = c.sort_order ?? 999 })
    return Object.entries(groups).sort(([a], [b]) => (catOrder[a] ?? 999) - (catOrder[b] ?? 999))
  }, [filteredProducts, categories])

  const toggleCategory = (catName) => {
    setExpandedCategories(prev => ({ ...prev, [catName]: !prev[catName] }))
  }

  const graveyardProducts = useMemo(() => {
    return products.filter(p => p.is_deleted)
  }, [products])

  const handleParChange = (productId, value) => {
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

  const handlePriceClick = (product) => {
    const lockedVendor = product.locked_vendor_id != null
      ? (product.available_vendors || []).find(v => v.vendor_id === product.locked_vendor_id)
      : null
    const effectivePrice = lockedVendor ? lockedVendor.price : product.cheapest_price
    setPriceInput((prev) => ({
      ...prev,
      [product.product_id]: effectivePrice != null ? String(effectivePrice) : ''
    }))
    setEditingPrice((prev) => ({ ...prev, [product.product_id]: true }))
  }

  const handlePriceSave = async (product) => {
    const val = parseFloat(priceInput[product.product_id])
    if (isNaN(val) || val < 0) {
      setEditingPrice((prev) => ({ ...prev, [product.product_id]: false }))
      return
    }

    // FR-PRICE-01: Block edit if no vendor assigned
    const vendorId = product.locked_vendor_id ?? product.cheapest_vendor_id
    if (!vendorId) {
      setNoVendorFlag((prev) => ({ ...prev, [product.product_id]: true }))
      setEditingPrice((prev) => ({ ...prev, [product.product_id]: false }))
      return
    }

    setProducts((prev) =>
      prev.map((p) =>
        p.product_id === product.product_id ? { ...p, cheapest_price: val, cheapest_is_manual: true } : p
      )
    )
    setEditingPrice((prev) => ({ ...prev, [product.product_id]: false }))
    try {
      await updatePrice(product.product_id, vendorId, val, product.unit || 'each')
    } catch {
      // silently fail
    }
  }

  const handleVendorLockChange = async (product, vendorIdStr) => {
    const vendorId = vendorIdStr === '' ? null : parseInt(vendorIdStr)
    setProducts((prev) =>
      prev.map((p) =>
        p.product_id === product.product_id ? { ...p, locked_vendor_id: vendorId } : p
      )
    )
    // FR-PRICE-01: clear the no-vendor flag when a vendor is assigned
    if (vendorId) {
      setNoVendorFlag((prev) => {
        const next = { ...prev }
        delete next[product.product_id]
        return next
      })
    }
    try {
      await updateVendorLock(product.product_id, vendorId)
    } catch {
      // silently fail
    }
  }

  // ⋯ menu actions
  const handleRenameStart = (product) => {
    setRenamingId(product.product_id)
    setRenameInput(product.product_name)
    setOpenMenu(null)
  }

  const handleRenameSave = async (productId) => {
    const name = renameInput.trim()
    if (!name) { setRenamingId(null); return }
    setProducts(prev => prev.map(p => p.product_id === productId ? { ...p, product_name: name } : p))
    setRenamingId(null)
    try {
      await patchProduct(productId, { name })
    } catch {
      // silently fail - optimistic already applied
    }
  }

  const handleMuteToggle = async (product) => {
    const newMuted = !product.muted
    setProducts(prev => prev.map(p => p.product_id === product.product_id ? { ...p, muted: newMuted } : p))
    setOpenMenu(null)
    try {
      await patchProduct(product.product_id, { muted: newMuted })
    } catch {
      setProducts(prev => prev.map(p => p.product_id === product.product_id ? { ...p, muted: product.muted } : p))
    }
  }

  const handleDeleteSoft = async (productId) => {
    setProducts(prev => prev.map(p => p.product_id === productId ? { ...p, is_deleted: true } : p))
    setDeleteConfirmId(null)
    setOpenMenu(null)
    try {
      await patchProduct(productId, { is_deleted: true })
    } catch {
      setProducts(prev => prev.map(p => p.product_id === productId ? { ...p, is_deleted: false } : p))
    }
  }

  const handleRestore = async (productId) => {
    setProducts(prev => prev.map(p => p.product_id === productId ? { ...p, is_deleted: false } : p))
    try {
      await patchProduct(productId, { is_deleted: false })
    } catch {
      setProducts(prev => prev.map(p => p.product_id === productId ? { ...p, is_deleted: true } : p))
    }
  }

  const handlePermDelete = async (productId) => {
    setProducts(prev => prev.filter(p => p.product_id !== productId))
    setPermDeleteConfirmId(null)
    try {
      await deleteProductPermanent(productId)
    } catch {
      // already removed from UI
    }
  }

  const handleClearAll = async () => {
    const toDelete = graveyardProducts.map(p => p.product_id)
    setProducts(prev => prev.filter(p => !p.is_deleted))
    setClearAllConfirm(false)
    for (const id of toDelete) {
      try { await deleteProductPermanent(id) } catch {}
    }
  }

  const handleAddItem = async (e) => {
    e.preventDefault()
    if (!newName.trim() || !newCategoryId) return
    setAddItemSaving(true)
    try {
      const price = newPrice !== '' ? parseFloat(newPrice) : null
      const par = newPar !== '' ? parseInt(newPar) : null
      const res = await createProduct({
        name: newName.trim(),
        category_id: parseInt(newCategoryId),
        needs_pricing: price === null,
        par_value: par,
      })
      // reload to get full product with par/price data
      await loadData()
      setNewName('')
      setNewCategoryId('')
      setNewPar('')
      setNewPrice('')
      setAddItemOpen(false)
    } catch {
      // ignore
    } finally {
      setAddItemSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-4 border-[#00C0C8] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#8A9099] text-sm">Loading products…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[#C23B3B]/10 border border-[#C23B3B]/20 rounded-2xl p-4 text-center">
        <p className="text-[#C23B3B] text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-[#1A2025] rounded-xl border border-[#2A343C] shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-[#222C33] border-b border-[#2A343C]">
        <div className="flex items-center gap-1">
          <h2 className="text-base font-semibold text-[#F0EDE8]" style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>PAR Values</h2>
          <HelpTooltip text="PAR is your target stock level. The system orders enough to bring you back to this number each time you run an Inventory Count." />
        </div>
        <p className="text-xs text-[#8A9099] mt-0.5">Set target inventory levels, prices, and preferred vendors.</p>
      </div>

      {/* Search bar */}
      <div className="px-3 pt-3 pb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items…"
          className="w-full text-sm border border-[#2A343C] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00C0C8] bg-[#0E1214] text-[#F0EDE8] placeholder:text-[#8A9099]"
        />
      </div>

      {/* Add Item button */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setAddItemOpen(v => !v)}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#00C0C8]/10 text-[#00C0C8] hover:bg-[#00C0C8]/20 transition-colors font-medium"
        >
          {addItemOpen ? '✕ Cancel' : '+ Add Item'}
        </button>

        {addItemOpen && (
          <form onSubmit={handleAddItem} className="mt-2 p-3 rounded-lg bg-[#0E1214] border border-[#2A343C] flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
              <label className="text-xs text-[#8A9099]">Name *</label>
              <input
                type="text"
                required
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Item name"
                className="text-sm border border-[#2A343C] rounded-lg px-2 py-1.5 bg-[#1A2025] text-[#F0EDE8] focus:outline-none focus:ring-2 focus:ring-[#00C0C8]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8A9099]">Category *</label>
              <select
                required
                value={newCategoryId}
                onChange={e => setNewCategoryId(e.target.value)}
                className="text-sm border border-[#2A343C] rounded-lg px-2 py-1.5 bg-[#1A2025] text-[#F0EDE8] focus:outline-none focus:ring-2 focus:ring-[#00C0C8] min-h-[36px]"
              >
                <option value="">Select…</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8A9099]">PAR</label>
              <input
                type="number"
                min="0"
                value={newPar}
                onChange={e => setNewPar(e.target.value)}
                placeholder="—"
                className="w-16 text-sm border border-[#2A343C] rounded-lg px-2 py-1.5 bg-[#1A2025] text-[#F0EDE8] focus:outline-none focus:ring-2 focus:ring-[#00C0C8]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8A9099]">Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newPrice}
                onChange={e => setNewPrice(e.target.value)}
                placeholder="—"
                className="w-20 text-sm border border-[#2A343C] rounded-lg px-2 py-1.5 bg-[#1A2025] text-[#F0EDE8] focus:outline-none focus:ring-2 focus:ring-[#00C0C8]"
              />
            </div>
            <button
              type="submit"
              disabled={addItemSaving}
              className="px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold bg-[#00C0C8] text-[#0E1214] hover:bg-[#00A8B0] disabled:opacity-50 transition-colors"
            >
              {addItemSaving ? 'Adding…' : 'Add'}
            </button>
          </form>
        )}
      </div>

      {/* Product rows — grouped by category */}
      {groupedProducts.map(([categoryName, categoryProducts]) => (
        <div key={categoryName}>
          {/* Category header — collapsible */}
          <button
            onClick={() => toggleCategory(categoryName)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-[#222C33] border-b border-[#2A343C] hover:bg-[#2A343C] transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg
                className={`w-3.5 h-3.5 text-[#8A9099] transition-transform ${(search.trim() ? true : expandedCategories[categoryName] === true) ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-xs font-semibold text-[#8A9099] uppercase tracking-wider">{categoryName}</span>
            </div>
            <span className="text-xs text-[#8A9099]">{categoryProducts.length} items</span>
          </button>

          {/* Products in this category */}
          {(search.trim() ? true : expandedCategories[categoryName] === true) && categoryProducts.map((product) => {
        const status = saveStatus[product.product_id]
        const inputValue = parValues[product.product_id] ?? ''
        const isEditingPrice = editingPrice[product.product_id]
        const isLocked = product.locked_vendor_id != null
        const isMenuOpen = openMenu === product.product_id
        const isRenaming = renamingId === product.product_id
        const isDeleteConfirm = deleteConfirmId === product.product_id
        const hasNoVendorFlag = !!noVendorFlag[product.product_id]

        return (
          <div
            key={product.product_id}
            className={`border-b border-[#2A343C] last:border-0 ${product.muted ? 'opacity-50' : ''}`}
          >
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              {/* Product name + price */}
              <div className="flex flex-col min-w-0 flex-1">
                {isRenaming ? (
                  <input
                    type="text"
                    autoFocus
                    value={renameInput}
                    onChange={e => setRenameInput(e.target.value)}
                    onBlur={() => handleRenameSave(product.product_id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRenameSave(product.product_id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    className="text-sm border border-[#00C0C8] rounded px-1.5 py-0.5 bg-[#0E1214] text-[#F0EDE8] focus:outline-none w-full"
                  />
                ) : (
                  <span className={`text-sm truncate ${product.muted ? 'text-[#8A9099]' : 'text-[#F0EDE8]'}`}>
                    {product.product_name}
                    {product.muted && <span className="ml-1.5 text-[10px] font-bold text-[#8A9099] bg-[#2A343C] px-1 py-0.5 rounded">MUTED</span>}
                  </span>
                )}
                {/* Price — click to edit */}
                {isEditingPrice ? (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    autoFocus
                    value={priceInput[product.product_id] ?? ''}
                    onChange={(e) => setPriceInput((prev) => ({ ...prev, [product.product_id]: e.target.value }))}
                    onBlur={() => handlePriceSave(product)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePriceSave(product) }}
                    className="mt-0.5 w-20 text-xs border border-[#00C0C8] rounded px-1.5 py-0.5 bg-[#0E1214] text-[#00C0C8] focus:outline-none"
                  />
                ) : (
                  <>
                    <button
                      onClick={() => handlePriceClick(product)}
                      className="mt-0.5 text-xs hover:text-[#00C0C8] transition-colors text-left"
                      title="Click to edit price"
                      style={{
                        color: (() => {
                          const lockedVendor = product.locked_vendor_id != null
                            ? (product.available_vendors || []).find(v => v.vendor_id === product.locked_vendor_id)
                            : null
                          // FR-PRICE-02: amber for manually set prices
                          const isManual = lockedVendor ? lockedVendor.is_manual : product.cheapest_is_manual
                          return isManual ? '#F59E0B' : '#8A9099'
                        })()
                      }}
                    >
                      {(() => {
                        const lockedVendor = product.locked_vendor_id != null
                          ? (product.available_vendors || []).find(v => v.vendor_id === product.locked_vendor_id)
                          : null
                        const effectivePrice = lockedVendor ? lockedVendor.price : product.cheapest_price
                        return effectivePrice != null
                          ? `$${Number(effectivePrice).toFixed(2)}/${product.unit || 'ea'}`
                          : '—'
                      })()}
                    </button>
                    {/* FR-PRICE-01: no-vendor flag */}
                    {hasNoVendorFlag && (
                      <span className="mt-0.5 text-xs text-amber-500">Must select a vendor.</span>
                    )}
                  </>
                )}
              </div>

              {/* Vendor dropdown + lock icon */}
              {product.available_vendors && product.available_vendors.length > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (isLocked) {
                        handleVendorLockChange(product, '')
                      } else {
                        const targetVendorId = product.cheapest_vendor_id ?? product.available_vendors?.[0]?.vendor_id
                        if (targetVendorId) handleVendorLockChange(product, String(targetVendorId))
                      }
                    }}
                    title={isLocked ? 'Click to unlock (return to auto)' : 'Click to lock to cheapest vendor'}
                    className="text-sm cursor-pointer hover:scale-110 transition-transform p-0.5 rounded"
                  >
                    {isLocked ? '🔒' : '🔓'}
                  </button>
                  <select
                    value={isLocked ? String(product.locked_vendor_id) : ''}
                    onChange={(e) => handleVendorLockChange(product, e.target.value)}
                    className="text-xs border border-[#2A343C] rounded-lg px-1.5 py-1.5 bg-[#0E1214] text-[#F0EDE8] focus:outline-none focus:ring-2 focus:ring-[#00C0C8] min-h-[36px]"
                  >
                    <option value="">Auto (cheapest)</option>
                    {product.available_vendors.map((v) => (
                      <option key={v.vendor_id} value={String(v.vendor_id)}>
                        {v.vendor_name}{v.price != null ? ` — $${Number(v.price).toFixed(2)}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* PAR input */}
              <input
                type="number"
                min="0"
                value={inputValue}
                placeholder="—"
                onChange={(e) => handleParChange(product.product_id, e.target.value)}
                className="w-16 text-center text-sm border border-[#2A343C] rounded-lg py-2 px-1 focus:outline-none focus:ring-2 focus:ring-[#00C0C8] focus:border-transparent bg-[#0E1214] text-[#F0EDE8] min-h-[36px]"
              />

              {/* Save button */}
              <button
                onClick={() => handleSave(product.product_id)}
                disabled={status === 'saving'}
                className={`px-3 py-2 min-h-[36px] rounded-lg text-xs font-semibold transition-colors ${
                  status === 'saved'
                    ? 'bg-[#3DAA6E]/15 text-[#3DAA6E]'
                    : status === 'error'
                    ? 'bg-[#C23B3B]/15 text-[#C23B3B]'
                    : status === 'saving'
                    ? 'bg-[#2A343C] text-[#8A9099] cursor-not-allowed'
                    : 'bg-[#222C33] text-[#8A9099] hover:bg-[#00C0C8]/10 hover:text-[#00C0C8]'
                }`}
              >
                {status === 'saved' ? 'Saved ✓' :
                 status === 'saving' ? 'Saving…' :
                 status === 'error' ? 'Error' :
                 'Save'}
              </button>

              {/* Inline action buttons */}
              <div className="flex items-center gap-0.5 ml-1">
                <button
                  onClick={() => handleRenameStart(product)}
                  className="flex items-center justify-center w-7 h-7 rounded text-[#8A9099] hover:text-[#F0EDE8] hover:bg-[#2A343C] transition-colors text-xs"
                  title="Rename"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleMuteToggle(product)}
                  className="flex items-center justify-center w-7 h-7 rounded text-[#8A9099] hover:text-[#F0EDE8] hover:bg-[#2A343C] transition-colors text-xs"
                  title={product.muted ? 'Unmute' : 'Mute'}
                >
                  {product.muted ? '🔊' : '🔇'}
                </button>
                {deleteConfirmId !== product.product_id ? (
                  <button
                    onClick={() => setDeleteConfirmId(product.product_id)}
                    className="flex items-center justify-center w-7 h-7 rounded text-[#8A9099] hover:text-[#C23B3B] hover:bg-[#2A343C] transition-colors text-xs"
                    title="Delete"
                  >
                    🗑️
                  </button>
                ) : (
                  <div className="flex items-center gap-1 ml-1">
                    <span className="text-[10px] text-[#8A9099]">Delete?</span>
                    <button
                      onClick={() => handleDeleteSoft(product.product_id)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-[#C23B3B] text-white hover:bg-[#A83030] transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-[#2A343C] text-[#8A9099] hover:bg-[#333F48] transition-colors"
                    >
                      No
                    </button>
                  </div>
                )}
              </div>

              {/* Ellipsis menu — preserved for rollback
                  Overflow fix: when restoring, add className "bottom-full mb-1" to the dropdown
                  div (the one with "absolute right-0 top-10") to make it open upward near the
                  bottom of the container, preventing overflow.
              */}
              {/* <div className="relative" ref={isMenuOpen ? menuRef : null}>
                <button
                  onClick={() => {
                    setOpenMenu(isMenuOpen ? null : product.product_id)
                    setDeleteConfirmId(null)
                  }}
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-[#8A9099] hover:text-[#F0EDE8] hover:bg-[#2A343C] transition-colors text-base"
                  title="More options"
                >
                  ⋯
                </button>
                {isMenuOpen && (
                  <div className="absolute right-0 top-10 z-20 bg-[#1A2025] border border-[#2A343C] rounded-xl shadow-lg min-w-[140px] py-1">
                    <button
                      onClick={() => handleRenameStart(product)}
                      className="w-full text-left px-3 py-2 text-sm text-[#F0EDE8] hover:bg-[#222C33] transition-colors"
                    >
                      ✏️ Rename
                    </button>
                    <button
                      onClick={() => handleMuteToggle(product)}
                      className="w-full text-left px-3 py-2 text-sm text-[#F0EDE8] hover:bg-[#222C33] transition-colors"
                    >
                      {product.muted ? '🔊 Unmute' : '🔇 Mute'}
                    </button>
                    {!isDeleteConfirm ? (
                      <button
                        onClick={() => setDeleteConfirmId(product.product_id)}
                        className="w-full text-left px-3 py-2 text-sm text-[#C23B3B] hover:bg-[#222C33] transition-colors"
                      >
                        🗑 Delete
                      </button>
                    ) : (
                      <div className="px-3 py-2">
                        <p className="text-xs text-[#8A9099] mb-1.5">Delete this item?</p>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleDeleteSoft(product.product_id)}
                            className="flex-1 text-xs px-2 py-1 rounded bg-[#C23B3B] text-white hover:bg-[#A83030] transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="flex-1 text-xs px-2 py-1 rounded bg-[#2A343C] text-[#8A9099] hover:bg-[#333F48] transition-colors"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div> */}
            </div>
          </div>
        )
      })}
        </div>
      ))}

      {filteredProducts.length === 0 && (
        <div className="py-10 text-center text-[#8A9099] text-sm">No products found.</div>
      )}

      {/* ☠ Graveyard */}
      <div className="border-t border-[#2A343C] bg-[#0E1214]">
        <button
          onClick={() => setGraveyardOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-[#8A9099] hover:text-[#F0EDE8] transition-colors"
        >
          <span className="text-sm font-medium">☠ Graveyard {graveyardProducts.length > 0 ? `(${graveyardProducts.length})` : ''}</span>
          <span className="text-xs">{graveyardOpen ? '▲' : '▼'}</span>
        </button>

        {graveyardOpen && (
          <div className="pb-3">
            {graveyardProducts.length === 0 ? (
              <p className="px-4 py-2 text-xs text-[#8A9099]">No deleted items.</p>
            ) : (
              <>
                <div className="px-4 pb-2 flex justify-end">
                  {!clearAllConfirm ? (
                    <button
                      onClick={() => setClearAllConfirm(true)}
                      className="text-xs text-[#C23B3B] hover:underline"
                    >
                      Clear All
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#8A9099]">Permanently delete all?</span>
                      <button onClick={handleClearAll} className="text-xs px-2 py-0.5 rounded bg-[#C23B3B] text-white">Yes</button>
                      <button onClick={() => setClearAllConfirm(false)} className="text-xs px-2 py-0.5 rounded bg-[#2A343C] text-[#8A9099]">No</button>
                    </div>
                  )}
                </div>
                {graveyardProducts.map(product => (
                  <div key={product.product_id} className="flex items-center gap-2 px-4 py-2 border-t border-[#1A2025]">
                    <span className="text-sm text-[#8A9099] flex-1 truncate">{product.product_name}</span>
                    <button
                      onClick={() => handleRestore(product.product_id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-[#3DAA6E]/15 text-[#3DAA6E] hover:bg-[#3DAA6E]/25 transition-colors min-h-[32px]"
                    >
                      Restore
                    </button>
                    {permDeleteConfirmId !== product.product_id ? (
                      <button
                        onClick={() => setPermDeleteConfirmId(product.product_id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-[#C23B3B]/15 text-[#C23B3B] hover:bg-[#C23B3B]/25 transition-colors min-h-[32px]"
                      >
                        Delete
                      </button>
                    ) : (
                      <div className="flex gap-1.5 items-center">
                        <span className="text-xs text-[#8A9099]">Sure?</span>
                        <button onClick={() => handlePermDelete(product.product_id)} className="text-xs px-2 py-1 rounded bg-[#C23B3B] text-white">Yes</button>
                        <button onClick={() => setPermDeleteConfirmId(null)} className="text-xs px-2 py-1 rounded bg-[#2A343C] text-[#8A9099]">No</button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

