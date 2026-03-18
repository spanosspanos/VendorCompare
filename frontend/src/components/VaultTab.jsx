import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api'
import HelpTooltip from './HelpTooltip'

function authHeaders() {
  const token = localStorage.getItem('vc_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function statusDot(connectionType, docCount) {
  if (connectionType === 'docs' && docCount > 0) return { dot: '🟡', label: 'Docs' }
  if (connectionType === 'api') return { dot: '🟢', label: 'API' }
  return { dot: '⚪', label: 'Not connected' }
}

export default function VaultTab({ onVendorUpdate }) {
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [archiveDocs, setArchiveDocs] = useState({}) // vendor_id -> docs[]
  const [archiveLoading, setArchiveLoading] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [uploadState, setUploadState] = useState({}) // vendor_id -> {loading, preview, error}
  const [previewModal, setPreviewModal] = useState(null) // {vendor_id, filename, preview_data}
  const [confirming, setConfirming] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState('')
  const [showGraveyard, setShowGraveyard] = useState(false)
  const [graveyard, setGraveyard] = useState([])
  const [addingVendor, setAddingVendor] = useState(false)
  const [newVendorName, setNewVendorName] = useState('')
  const [newVendorType, setNewVendorType] = useState('manual')
  const searchTimerRef = useRef(null)
  const fileInputRefs = useRef({})

  const fetchVendors = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const res = await api.get('/vault/vendors', { headers: authHeaders() })
      setVendors(res.data)
    } catch {
      setError('Failed to load vendors.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { fetchVendors() }, [fetchVendors])

  const handleEdit = (vendor) => {
    setEditingId(vendor.id)
    setExpandedId(vendor.id)
    setEditForm({
      display_name: vendor.display_name || '',
      connection_type: vendor.connection_type,
      is_muted: vendor.is_muted,
    })
    setSaveMsg('')
    loadArchive(vendor.id)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setSaveMsg('')
  }

  const loadArchive = async (vendorId) => {
    if (archiveDocs[vendorId]) return
    setArchiveLoading(prev => ({ ...prev, [vendorId]: true }))
    try {
      const res = await api.get(`/vendor-docs/archive/${vendorId}`, { headers: authHeaders() })
      setArchiveDocs(prev => ({ ...prev, [vendorId]: res.data }))
    } catch {
      setArchiveDocs(prev => ({ ...prev, [vendorId]: [] }))
    } finally {
      setArchiveLoading(prev => ({ ...prev, [vendorId]: false }))
    }
  }

  const handleSave = async (vendorId) => {
    setSaving(true)
    setSaveMsg('')
    try {
      await api.patch(`/vault/vendors/${vendorId}`, {
        display_name: editForm.display_name || null,
        connection_type: editForm.connection_type,
        is_muted: editForm.is_muted,
      }, { headers: authHeaders() })
      setSaveMsg('Saved ✓')
      await fetchVendors(true)
      if (onVendorUpdate) onVendorUpdate()
      setTimeout(() => { setEditingId(null); setSaveMsg('') }, 800)
    } catch {
      setSaveMsg('Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (vendor) => {
    if (!window.confirm(`Move "${vendor.display_name || vendor.name}" to graveyard?`)) return
    try {
      await api.delete(`/vault/vendors/${vendor.id}`, { headers: authHeaders() })
      setEditingId(null)
      await fetchVendors(true)
    } catch {
      alert('Failed to remove vendor.')
    }
  }

  const handleFileUpload = async (vendorId, file) => {
    if (!file) return
    setUploadState(prev => ({ ...prev, [vendorId]: { loading: true, preview: null, error: null } }))
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await api.post(`/vendor-docs/upload/${vendorId}`, formData, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' }
      })
      setUploadState(prev => ({ ...prev, [vendorId]: { loading: false, preview: res.data, error: null } }))
      setPreviewModal({ vendor_id: vendorId, filename: file.name, preview_data: res.data })
    } catch {
      setUploadState(prev => ({ ...prev, [vendorId]: { loading: false, preview: null, error: 'Upload failed.' } }))
    }
  }

  const handleConfirm = async () => {
    if (!previewModal) return
    setConfirming(true)
    setConfirmMsg('')
    const { vendor_id, filename, preview_data } = previewModal
    try {
      await api.post(`/vendor-docs/confirm/${vendor_id}`, {
        preview_id: preview_data.preview_id,
        filename,
        item_count: preview_data.total_items,
      }, { headers: authHeaders() })
      setConfirmMsg(`${preview_data.matched_items?.length || 0} prices updated ✓`)
      setPreviewModal(null)
      setArchiveDocs(prev => { const n = {...prev}; delete n[vendor_id]; return n })
      loadArchive(vendor_id)
      await fetchVendors()
    } catch {
      setConfirmMsg('Confirm failed.')
    } finally {
      setConfirming(false)
    }
  }

  const handleSearch = (q) => {
    setSearchQuery(q)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!q.trim()) { setSearchResults([]); return }
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await api.get(`/vendor-docs/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() })
        setSearchResults(res.data)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }

  const loadGraveyard = async () => {
    try {
      const res = await api.get('/vault/graveyard', { headers: authHeaders() })
      setGraveyard(res.data)
    } catch {
      setGraveyard([])
    }
  }

  const handleRestore = async (vendorId) => {
    try {
      await api.post(`/vault/graveyard/${vendorId}/restore`, {}, { headers: authHeaders() })
      await loadGraveyard()
      await fetchVendors()
    } catch {
      alert('Restore failed.')
    }
  }

  const handleAddVendor = async () => {
    if (!newVendorName.trim()) return
    try {
      await api.post('/vault/vendors', { name: newVendorName.trim(), connection_type: newVendorType }, { headers: authHeaders() })
      setNewVendorName('')
      setNewVendorType('manual')
      setAddingVendor(false)
      await fetchVendors()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add vendor.')
    }
  }

  if (loading) return <p className="text-[#8A9099] text-sm py-4">Loading vendors…</p>
  if (error) return <p className="text-[#C23B3B] text-sm py-4">{error}</p>

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A9099]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search all vendor catalogs…"
          className="w-full bg-[#1A2025] border border-[#2A343C] rounded-xl pl-9 pr-4 py-2.5 text-[#F0EDE8] text-sm placeholder-[#8A9099]/60 focus:outline-none focus:border-[#00C0C8]/60"
        />
      </div>

      {/* Search results */}
      {(searchResults.length > 0 || searchLoading) && (
        <div className="rounded-2xl border border-[#2A343C] bg-[#131C22] overflow-hidden">
          <div className="px-4 py-2 border-b border-[#2A343C] text-xs text-[#8A9099]">
            {searchLoading ? 'Searching…' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`}
          </div>
          {searchResults.map((item, i) => {
            const { dot } = statusDot(item.connection_type || 'docs', 1)
            return (
              <div key={i} className="px-4 py-3 border-t border-[#2A343C] first:border-t-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-[#F0EDE8] font-medium">{item.description}</p>
                    <p className="text-xs text-[#8A9099] mt-0.5">
                      {item.sku && <span className="font-mono mr-2">{item.sku}</span>}
                      {dot} {item.vendor_name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {item.price && <p className="text-sm font-bold text-[#F0EDE8]">${item.price.toFixed(2)}{item.unit ? `/${item.unit}` : ''}</p>}
                    {item.uploaded_at && <p className="text-xs text-[#8A9099]">{new Date(item.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Vendor folder list */}
      <div>
        <h2 className="text-xs font-semibold text-[#8A9099] uppercase tracking-widest mb-3">Vendor Catalog Archive</h2>
        <div className="space-y-3">
          {vendors.map(vendor => {
            const isEditing = editingId === vendor.id
            const isExpanded = expandedId === vendor.id || isEditing
            const { dot, label } = statusDot(vendor.connection_type, vendor.doc_count)
            const displayName = vendor.display_name || vendor.name
            const docs = archiveDocs[vendor.id] || []
            const uploadSt = uploadState[vendor.id] || {}

            return (
              <div key={vendor.id} className="rounded-2xl border border-[#2A343C] bg-[#131C22] overflow-hidden">
                {/* Folder header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-lg">{isExpanded ? '📂' : '📁'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#F0EDE8]">{displayName}</p>
                    <p className="text-xs text-[#8A9099]">
                      {vendor.doc_count > 0
                        ? `${vendor.doc_count} document${vendor.doc_count !== 1 ? 's' : ''}`
                        : 'No documents yet'
                      } · {dot} {label}
                      {vendor.is_muted && <span className="ml-2 text-[#E07B35]">· Muted</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => isEditing ? handleCancelEdit() : handleEdit(vendor)}
                    className="text-xs text-[#8A9099] hover:text-[#F0EDE8] px-2 py-1 border border-[#2A343C] rounded-lg transition-colors"
                  >
                    {isEditing ? '✕ Close' : '✎ Edit'}
                  </button>
                </div>

                {/* Edit panel */}
                {isEditing && (
                  <div className="border-t border-[#2A343C] bg-[#1A2025] px-4 py-4 space-y-4">
                    <p className="text-xs font-semibold text-[#D4A017] uppercase tracking-widest">⚙ Vendor Settings</p>

                    {/* Display name */}
                    <div>
                      <label className="block text-xs text-[#8A9099] mb-1">Display name</label>
                      <input
                        type="text"
                        value={editForm.display_name}
                        onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))}
                        className="w-full bg-[#0E1214] border border-[#2A343C] rounded-lg px-3 py-2 text-[#F0EDE8] text-sm focus:outline-none focus:border-[#D4A017]/60"
                      />
                    </div>

                    {/* Connection type */}
                    <div>
                      <label className="block text-xs text-[#8A9099] mb-2">Connection type</label>
                      <div className="space-y-1.5">
                        {[
                          { value: 'api', dot: '🟢', label: 'API', disabled: true, note: 'Not available' },
                          { value: 'docs', dot: '🟡', label: 'Docs Upload', disabled: false },
                          { value: 'manual', dot: '⚪', label: 'Manual', disabled: false },
                        ].map(opt => (
                          <label key={opt.value} className={`flex items-center gap-2 text-sm ${opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input
                              type="radio"
                              name={`conn-${vendor.id}`}
                              value={opt.value}
                              checked={editForm.connection_type === opt.value}
                              disabled={opt.disabled}
                              onChange={() => !opt.disabled && setEditForm(f => ({ ...f, connection_type: opt.value }))}
                              className="accent-[#D4A017]"
                            />
                            <span>{opt.dot} {opt.label}</span>
                            {opt.note && <span className="text-xs text-[#8A9099] italic">{opt.note}</span>}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Mute toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="text-sm text-[#F0EDE8]">Mute vendor</p>
                          <HelpTooltip text="Muting a vendor removes them from order splits without deleting their data. Unmute at any time to restore." />
                        </div>
                        <p className="text-xs text-[#8A9099]">Hides from all comparisons and PAR views</p>
                      </div>
                      <button
                        onClick={() => setEditForm(f => ({ ...f, is_muted: !f.is_muted }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.is_muted ? 'bg-[#E07B35]' : 'bg-[#2A343C]'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.is_muted ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    {/* Price sheet history */}
                    {docs.length > 0 && (
                      <div>
                        <p className="text-xs text-[#8A9099] mb-2">Price sheet history</p>
                        <div className="space-y-1.5">
                          {docs.map(doc => (
                            <div key={doc.id} className="flex items-center gap-2 text-xs text-[#8A9099]">
                              <span>📄</span>
                              <span className="text-[#F0EDE8] flex-1 truncate">{doc.filename}</span>
                              {doc.is_most_recent && <span className="text-[#00C0C8] font-medium">most recent</span>}
                              <span>{doc.item_count} items</span>
                              <span>·</span>
                              <span>{doc.uploaded_by}</span>
                              <span>·</span>
                              <span>{new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {archiveLoading[vendor.id] && <p className="text-xs text-[#8A9099]">Loading history…</p>}

                    {/* Upload button */}
                    <div>
                      <input
                        ref={el => { fileInputRefs.current[vendor.id] = el }}
                        type="file"
                        accept=".pdf,.csv,.xlsx,.xls"
                        className="hidden"
                        onChange={e => handleFileUpload(vendor.id, e.target.files[0])}
                      />
                      <button
                        onClick={() => fileInputRefs.current[vendor.id]?.click()}
                        disabled={uploadSt.loading}
                        className="text-sm text-[#00C0C8] border border-[#00C0C8]/40 rounded-xl px-4 py-2 hover:bg-[#00C0C8]/10 transition-colors disabled:opacity-50"
                      >
                        {uploadSt.loading ? 'Parsing…' : '＋ Upload new price sheet'}
                      </button>
                      {uploadSt.error && <p className="text-xs text-[#C23B3B] mt-1">{uploadSt.error}</p>}
                    </div>

                    {/* Action row */}
                    <div className="flex items-center gap-2 pt-1 border-t border-[#2A343C]">
                      <button onClick={handleCancelEdit} className="text-sm text-[#8A9099] px-3 py-1.5 border border-[#2A343C] rounded-lg hover:text-[#F0EDE8]">Cancel</button>
                      <button
                        onClick={() => handleSave(vendor.id)}
                        disabled={saving}
                        className="text-sm bg-[#D4A017] text-[#0E1214] font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : 'Save changes'}
                      </button>
                      {saveMsg && <span className="text-xs text-[#3DAA6E]">{saveMsg}</span>}
                      <div className="flex-1" />
                      <button
                        onClick={() => handleRemove(vendor)}
                        className="text-sm text-[#C23B3B] px-3 py-1.5 border border-[#C23B3B]/30 rounded-lg hover:bg-[#C23B3B]/10"
                      >
                        🗑 Remove
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded archive view (not editing) */}
                {isExpanded && !isEditing && docs.length > 0 && (
                  <div className="border-t border-[#2A343C] px-4 py-3 space-y-2">
                    {docs.map(doc => (
                      <div key={doc.id} className="flex items-center gap-2 text-xs text-[#8A9099]">
                        <span>📄</span>
                        <span className="text-[#F0EDE8] flex-1 truncate">{doc.filename}</span>
                        {doc.is_most_recent && <span className="text-[#00C0C8] font-medium">most recent</span>}
                        <span>{doc.item_count} items · {doc.uploaded_by} · {new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add vendor */}
      {addingVendor ? (
        <div className="rounded-2xl border border-[#2A343C] bg-[#131C22] p-4 space-y-3">
          <p className="text-sm font-semibold text-[#F0EDE8]">New Vendor</p>
          <input
            type="text"
            value={newVendorName}
            onChange={e => setNewVendorName(e.target.value)}
            placeholder="Vendor name"
            className="w-full bg-[#0E1214] border border-[#2A343C] rounded-lg px-3 py-2 text-[#F0EDE8] text-sm focus:outline-none focus:border-[#D4A017]/60"
          />
          <select
            value={newVendorType}
            onChange={e => setNewVendorType(e.target.value)}
            className="w-full bg-[#0E1214] border border-[#2A343C] rounded-lg px-3 py-2 text-[#F0EDE8] text-sm"
          >
            <option value="manual">⚪ Manual</option>
            <option value="docs">🟡 Docs Upload</option>
          </select>
          <div className="flex gap-2">
            <button onClick={() => setAddingVendor(false)} className="text-sm text-[#8A9099] px-3 py-1.5 border border-[#2A343C] rounded-lg">Cancel</button>
            <button onClick={handleAddVendor} className="text-sm bg-[#D4A017] text-[#0E1214] font-semibold px-4 py-1.5 rounded-lg">Add Vendor</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingVendor(true)}
          className="w-full text-sm text-[#8A9099] border border-dashed border-[#2A343C] rounded-2xl py-3 hover:text-[#F0EDE8] hover:border-[#4A545C] transition-colors"
        >
          ＋ Add vendor
        </button>
      )}

      {/* Graveyard section */}
      <div>
        <button
          onClick={() => { setShowGraveyard(p => !p); if (!showGraveyard) loadGraveyard() }}
          className="text-xs text-[#8A9099] hover:text-[#F0EDE8] flex items-center gap-1"
        >
          🪦 Vendor Graveyard {showGraveyard ? '▲' : '▼'}
        </button>
        {showGraveyard && (
          <div className="mt-2 rounded-2xl border border-[#2A343C] bg-[#131C22] overflow-hidden">
            {graveyard.length === 0 ? (
              <p className="text-xs text-[#8A9099] px-4 py-3">Graveyard is empty.</p>
            ) : graveyard.map(v => (
              <div key={v.id} className="flex items-center gap-3 px-4 py-3 border-t border-[#2A343C] first:border-t-0">
                <span className="text-sm text-[#8A9099]">🪦</span>
                <span className="flex-1 text-sm text-[#8A9099]">{v.display_name || v.name}</span>
                <button
                  onClick={() => handleRestore(v.id)}
                  className="text-xs text-[#3DAA6E] border border-[#3DAA6E]/30 px-2 py-1 rounded-lg hover:bg-[#3DAA6E]/10"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload diff preview modal */}
      {previewModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setPreviewModal(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-[#1A2025] rounded-2xl border border-[#2A343C] shadow-xl p-5 mx-4 max-w-sm w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#F0EDE8]" style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>Confirm Upload</h2>
              <button onClick={() => setPreviewModal(null)} className="text-[#8A9099] p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-sm text-[#8A9099] mb-3 truncate">{previewModal.filename}</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#0E1214] rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-[#3DAA6E]">{previewModal.preview_data.matched_items?.length || 0}</p>
                <p className="text-xs text-[#8A9099]">matched items</p>
              </div>
              <div className="bg-[#0E1214] rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-[#8A9099]">{previewModal.preview_data.unmatched_count || 0}</p>
                <p className="text-xs text-[#8A9099]">unmatched</p>
              </div>
            </div>
            {previewModal.preview_data.matched_items?.length > 0 && (
              <div className="mb-4 space-y-1.5 max-h-48 overflow-y-auto">
                <p className="text-xs text-[#8A9099] mb-1">Price changes:</p>
                {previewModal.preview_data.matched_items.slice(0, 10).map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-[#F0EDE8] truncate flex-1 mr-2">{item.product_name}</span>
                    <span className="text-[#8A9099] line-through mr-1">{item.old_price ? `$${item.old_price.toFixed(2)}` : '—'}</span>
                    <span className="text-[#3DAA6E]">→ ${item.new_price.toFixed(2)}</span>
                  </div>
                ))}
                {previewModal.preview_data.matched_items.length > 10 && (
                  <p className="text-xs text-[#8A9099] text-center">…and {previewModal.preview_data.matched_items.length - 10} more</p>
                )}
              </div>
            )}
            {confirmMsg && <p className="text-sm text-[#C23B3B] mb-3">{confirmMsg}</p>}
            <div className="flex gap-2">
              <button onClick={() => setPreviewModal(null)} className="flex-1 text-sm text-[#8A9099] border border-[#2A343C] rounded-xl py-2.5">Cancel</button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex-1 text-sm bg-[#00C0C8] text-[#0E1214] font-bold rounded-xl py-2.5 disabled:opacity-50"
              >
                {confirming ? 'Confirming…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
