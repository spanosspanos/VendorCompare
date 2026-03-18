import { useState, useEffect, useRef } from 'react'
import helpContent from '../helpContent.json'

/**
 * HelpDrawer — Slide-in help panel from the right.
 *
 * Props:
 *   isOpen  {bool}   — Whether the drawer is visible.
 *   onClose {func}   — Called when the drawer should close.
 *   role    {string} — "user" or "admin". Admin sees all topics; user sees user topics only.
 */
export default function HelpDrawer({ isOpen, onClose, role }) {
  const [search, setSearch] = useState('')
  const backdropRef = useRef(null)

  // Reset search when drawer opens
  useEffect(() => {
    if (isOpen) setSearch('')
  }, [isOpen])

  // Filter by role
  const roleTopics = role === 'admin'
    ? helpContent
    : helpContent.filter((t) => t.role === 'user')

  // Filter by search
  const filtered = search.trim()
    ? roleTopics.filter((t) => {
        const q = search.toLowerCase()
        return (
          t.title.toLowerCase().includes(q) ||
          t.content.toLowerCase().includes(q) ||
          (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
        )
      })
    : roleTopics

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className={`fixed inset-0 z-[150] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-label="Help"
        className={`fixed top-0 right-0 bottom-0 z-[160] flex flex-col bg-[#0E1214] border-l border-[#2A343C] shadow-2xl transition-transform duration-300 ease-in-out
          w-full sm:w-[380px]
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A343C] flex-shrink-0 bg-[#0E1214]">
          <h2 className="text-base font-semibold text-[#F0EDE8]" style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>
            Help
          </h2>
          <button
            onClick={onClose}
            aria-label="Close help"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A9099] hover:text-[#F0EDE8] hover:bg-[#2A343C] transition-colors text-lg"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-[#2A343C] flex-shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search help topics…"
            className="w-full text-sm border border-[#2A343C] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00C0C8] bg-[#1A2025] text-[#F0EDE8] placeholder:text-[#8A9099]"
          />
        </div>

        {/* Topics list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#8A9099]">No results for "{search}"</p>
          ) : (
            <div className="divide-y divide-[#1A2025]">
              {filtered.map((topic) => (
                <div key={topic.id} className="px-4 py-4">
                  <p className="text-sm font-semibold text-[#F0EDE8] mb-1">{topic.title}</p>
                  <p className="text-sm text-[#8A9099] leading-relaxed">{topic.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#2A343C] flex-shrink-0">
          <p className="text-xs text-[#8A9099] text-center">
            {filtered.length} topic{filtered.length !== 1 ? 's' : ''}
            {role === 'admin' ? ' · Admin view' : ''}
          </p>
        </div>
      </div>
    </>
  )
}
