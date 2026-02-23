import { useState } from 'react'

export default function PARRow({ product, parValue, inventoryActual, onActualChange, onNoteChange, onOpenChange, manualOrderQty = 0, onManualOrderChange }) {
  const [noteOpen, setNoteOpen] = useState(false)
  const [draft, setDraft] = useState('')       // in-progress text, not yet saved
  const [noteText, setNoteText] = useState('') // last submitted/committed text
  const [flagged, setFlagged] = useState(false) // true once user has submitted a taco flag

  // Reactive calculations
  const orderQty = parValue === null
    ? 0
    : Math.max(0, parValue - inventoryActual)

  const flag = parValue === null
    ? 'no_par'
    : inventoryActual > parValue
      ? 'overstock'
      : null

  const openNote = () => {
    setFlagged(true)              // register flag immediately on tap
    setDraft(noteText)            // pre-fill with any previously committed text
    if (!noteOpen) {
      setNoteOpen(true)
      onOpenChange?.(product.id, true)
    }
  }

  const submitNote = () => {
    setNoteText(draft)
    setNoteOpen(false)
    onNoteChange(product.id, draft)
    onOpenChange?.(product.id, false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitNote()
    }
  }

  return (
    <div className="border-b border-gray-100 last:border-0">
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Item name */}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-gray-800 block truncate">{product.name}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            {flag === 'no_par' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">
                NO PAR
              </span>
            )}
            {flag === 'overstock' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">
                OVERSTOCK
              </span>
            )}
          </div>
        </div>

        {/* PAR# */}
        <div className="w-12 text-center">
          <span className="text-xs text-gray-400 block leading-none mb-0.5">PAR</span>
          <span className="text-sm font-medium text-gray-600">
            {parValue === null ? '—' : parValue}
          </span>
        </div>

        {/* Actual count input */}
        <div className="w-16">
          <span className="text-xs text-gray-400 block leading-none mb-0.5 text-center">On Hand</span>
          <input
            type="number"
            min="0"
            value={inventoryActual}
            onChange={(e) => onActualChange(product.id, Math.max(0, parseInt(e.target.value) || 0))}
            onFocus={(e) => e.target.select()}
            className="w-full text-center text-sm border border-gray-200 rounded-lg py-1 px-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
          />
        </div>

        {/* Order qty — calculated if PAR set, dash if NO PAR */}
        <div className="w-14 text-center">
          <span className="text-xs text-gray-400 block leading-none mb-0.5">Order</span>
          {parValue === null ? (
            <span className="text-sm text-gray-300">—</span>
          ) : (
            <span className={`text-sm font-bold block ${orderQty > 0 ? 'text-emerald-700' : 'text-gray-300'}`}>
              {orderQty}
            </span>
          )}
        </div>

        {/* Taco flag button — flag registers immediately on tap */}
        <button
          onClick={openNote}
          className={`text-base leading-none ml-1 flex-shrink-0 transition-opacity ${
            flagged ? 'opacity-100 bg-amber-200 rounded px-0.5' : 'opacity-40 hover:opacity-60'
          }`}
          aria-label={flagged ? 'Edit flag note' : 'Add flag note'}
          title={flagged ? (noteText || 'Flagged') : 'Flag this item'}
        >
          🌮
        </button>
      </div>

      {/* Note accordion — only shown after tap, before submit */}
      {noteOpen && (
        <div className="px-3 pb-2.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Note for this item… (optional)"
            rows={2}
            autoFocus
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-white text-gray-700"
          />
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={submitNote}
              className="text-xs bg-emerald-600 text-white px-3 py-1 rounded-lg font-semibold active:bg-emerald-700 transition-colors"
            >
              Save note
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
