import { useState, useEffect, useRef } from 'react'
import PriceDiff from './PriceDiff'
import ScrapeButton from './ScrapeButton'
import { importPrices, confirmPrices, getPriceAuditLog } from '../api'

const VENDORS = [
  { id: 1, name: 'US Foods' },
  { id: 2, name: 'Food Direct' },
  { id: 3, name: 'Riviera Produce' },
]

export default function PriceImport() {
  const [vendorId, setVendorId] = useState(VENDORS[0].id)
  const [diffs, setDiffs] = useState(null)
  const [unmatched, setUnmatched] = useState([])
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState({}) // vendor_id -> ISO string
  const [dragging, setDragging] = useState(false)
  const [detectedVendor, setDetectedVendor] = useState(null)
  const [pendingConfirm, setPendingConfirm] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [uploadedItemCount, setUploadedItemCount] = useState(0)
  const fileRef = useRef()

  // Fetch last updated timestamps from audit log on mount
  useEffect(() => {
    getPriceAuditLog()
      .then(res => {
        const data = res.data
        const map = {}
        for (const entry of data) {
          if (!map[entry.vendor_id] || entry.timestamp > map[entry.vendor_id]) {
            map[entry.vendor_id] = entry.timestamp
          }
        }
        setLastUpdated(map)
      })
      .catch(() => {})
  }, [])

  const handleFile = async (file) => {
    if (!file) return
    // Auto-detect vendor
    const name = file.name.toLowerCase()
    let detected = null
    if (name.includes('usfoods') || name.includes('us_foods') || name.includes('us-foods') || name.includes('moxe') || name.includes('mox')) {
      detected = VENDORS.find(v => v.id === 1)
    } else if (name.includes('fooddirect') || name.includes('food_direct') || name.includes('food-direct')) {
      detected = VENDORS.find(v => v.id === 2)
    } else if (name.includes('riviera') || name.includes('bluecart') || name.includes('blue_cart')) {
      detected = VENDORS.find(v => v.id === 3)
    }
    if (detected) {
      setDetectedVendor(detected.name)
      setVendorId(detected.id)
    } else {
      setDetectedVendor(null)
    }

    setUploadedFileName(file.name)
    setLoading(true)
    setError(null)
    setDiffs(null)
    setSuccess(null)
    try {
      // Use the potentially-updated vendorId — but since setState is async, pass detected.id or vendorId directly
      const effectiveVendorId = detected ? detected.id : vendorId
      const res = await importPrices(file, effectiveVendorId)
      const newDiffs = res.data.diffs || []
      const newUnmatched = res.data.unmatched || []
      setDiffs(newDiffs)
      setUnmatched(newUnmatched)
      setUploadedItemCount(newDiffs.length + newUnmatched.length)
      setPendingConfirm(true) // show confirmation gate, not diff
    } catch (e) {
      setError(e?.response?.data?.detail || 'Upload failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleConfirm = async () => {
    setConfirming(true)
    setError(null)
    try {
      const res = await confirmPrices(diffs, vendorId)
      setSuccess(`✅ ${res.data.imported} price${res.data.imported !== 1 ? 's' : ''} updated successfully.`)
      setDiffs(null)
      setUnmatched([])
      // Refresh last updated
      const now = new Date().toISOString()
      setLastUpdated(prev => ({ ...prev, [vendorId]: now }))
    } catch (e) {
      setError(e?.response?.data?.detail || 'Confirm failed.')
    } finally {
      setConfirming(false)
    }
  }

  const handleCancel = () => {
    setDiffs(null)
    setUnmatched([])
    setError(null)
    setSuccess(null)
    setPendingConfirm(false)
    setDetectedVendor(null)
    setUploadedFileName('')
    setUploadedItemCount(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  const currentVendorName = VENDORS.find(v => v.id === vendorId)?.name

  return (
    <div className="space-y-4">
      {/* Scrape button (Gate 3 stub) */}
      <div className="flex justify-end">
        <ScrapeButton />
      </div>

      {/* Vendor selector */}
      <div className="flex gap-2 flex-wrap">
        {VENDORS.map(v => (
          <button
            key={v.id}
            onClick={() => { setVendorId(v.id); handleCancel() }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              vendorId === v.id
                ? 'bg-[#00C0C8]/20 text-[#00C0C8] border border-[#00C0C8]/40'
                : 'bg-[#1A242C] text-[#8A9099] border border-[#2A343C] hover:text-[#F0EDE8]'
            }`}
          >
            {v.name}
          </button>
        ))}
      </div>

      {/* Last updated */}
      {lastUpdated[vendorId] && (
        <p className="text-xs text-[#8A9099]">
          Last updated ({currentVendorName}): {new Date(lastUpdated[vendorId]).toLocaleString()}
        </p>
      )}

      {/* Detection banner */}
      {detectedVendor && !diffs && !pendingConfirm && (
        <div className="rounded-xl bg-[#00C0C8]/10 border border-[#00C0C8]/30 p-3 text-sm text-[#00C0C8]">
          📂 We detected this as a <strong>{detectedVendor}</strong> file
        </div>
      )}

      {/* File upload */}
      {!diffs && !pendingConfirm && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-[#00C0C8] bg-[#00C0C8]/5'
              : 'border-[#2A343C] hover:border-[#00C0C8]/50 hover:bg-[#1A242C]/40'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,.pdf"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0])}
          />
          {loading ? (
            <p className="text-sm text-[#00C0C8]">Processing file…</p>
          ) : (
            <>
              <p className="text-sm font-medium text-[#F0EDE8]">Drop price file here or click to upload</p>
              <p className="text-xs text-[#8A9099] mt-1">Accepts CSV, Excel (.xlsx), or PDF</p>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-[#C23B3B]/10 border border-[#C23B3B]/30 p-3 text-sm text-[#C23B3B]">
          {error}
        </div>
      )}

      {/* Success banner */}
      {success && (
        <div className="rounded-xl bg-[#00C0C8]/10 border border-[#00C0C8]/30 p-3 text-sm text-[#00C0C8]">
          {success}
        </div>
      )}

      {/* Confirmation gate */}
      {pendingConfirm && diffs !== null && (
        <div className="rounded-2xl bg-[#1A242C] border border-[#D4A017]/40 p-5 space-y-4">
          <h3 className="text-base font-bold text-[#F0EDE8]" style={{fontFamily:"'Syne',sans-serif"}}>Upload Summary</h3>
          <div className="border-t border-[#2A343C] pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8A9099] w-16">Vendor</span>
              <span className="text-lg font-semibold text-[#D4A017]">⚠️ {currentVendorName}</span>
              <button
                onClick={handleCancel}
                className="text-xs text-[#00C0C8] underline ml-2"
              >Change</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8A9099] w-16">File</span>
              <span className="text-sm text-[#F0EDE8]">{uploadedFileName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8A9099] w-16">Items</span>
              <span className="text-sm text-[#F0EDE8]">{uploadedItemCount} found</span>
            </div>
          </div>
          <p className="text-sm text-[#8A9099]">
            This will compare against <strong className="text-[#F0EDE8]">{currentVendorName}</strong> prices in the database. Are you sure this is the right vendor?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setPendingConfirm(false)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#00C0C8]/20 text-[#00C0C8] border border-[#00C0C8]/40 hover:bg-[#00C0C8]/30 transition-colors"
            >Yes, continue →</button>
            <button
              onClick={handleCancel}
              className="px-4 py-2.5 rounded-xl text-sm text-[#8A9099] border border-[#2A343C] hover:text-[#F0EDE8] transition-colors"
            >Cancel</button>
          </div>
        </div>
      )}

      {/* Diff view */}
      {!pendingConfirm && diffs !== null && diffs.length === 0 && unmatched.length === 0 && (
        <div className="rounded-xl bg-[#1A242C] border border-[#2A343C] p-4 text-center space-y-3">
          <p className="text-sm font-medium text-[#F0EDE8]">No changes found</p>
          <p className="text-xs text-[#8A9099]">All prices in this file match what's already in the database for {currentVendorName}.</p>
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-xl text-sm text-[#8A9099] border border-[#2A343C] hover:text-[#F0EDE8] transition-colors"
          >
            Upload another file
          </button>
        </div>
      )}
      {!pendingConfirm && diffs !== null && (diffs.length > 0 || unmatched.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#F0EDE8]">
              {diffs.length} price change{diffs.length !== 1 ? 's' : ''} detected for {currentVendorName}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-xl text-sm text-[#8A9099] border border-[#2A343C] hover:text-[#F0EDE8] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming || diffs.length === 0}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[#00C0C8]/20 text-[#00C0C8] border border-[#00C0C8]/40 hover:bg-[#00C0C8]/30 disabled:opacity-50 transition-colors"
              >
                {confirming ? 'Saving…' : 'Confirm All'}
              </button>
            </div>
          </div>
          <PriceDiff diffs={diffs} unmatched={unmatched} />
        </div>
      )}
    </div>
  )
}
