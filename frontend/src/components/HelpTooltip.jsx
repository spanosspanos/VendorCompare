import { useState, useEffect, useRef } from 'react'

/**
 * HelpTooltip — Small inline "i" icon that shows a popover tooltip on click/tap.
 *
 * Props:
 *   text {string} — The help text to display in the popover.
 */
export default function HelpTooltip({ text }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        aria-label="Help"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#8A9099] text-[#8A9099] text-[9px] font-bold leading-none hover:border-[#00C0C8] hover:text-[#00C0C8] transition-colors flex-shrink-0 ml-1"
      >
        i
      </button>
      {open && (
        <div
          className="absolute z-[200] bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 max-w-[90vw] bg-[#1A2025] border border-[#2A343C] rounded-xl shadow-xl p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs text-[#F0EDE8] leading-relaxed">{text}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#2A343C]" />
        </div>
      )}
    </span>
  )
}
