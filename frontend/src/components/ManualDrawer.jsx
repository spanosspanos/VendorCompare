import { useState, useEffect } from 'react'
import manualSections from '../ownersManualContent'

export default function ManualDrawer({ isOpen, onClose }) {
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState(new Set())

  useEffect(() => {
    if (isOpen) setSearch('')
  }, [isOpen])

  const query = search.trim().toLowerCase()

  const matchingSubsections = (section) =>
    section.subsections.filter((sub) =>
      !query ||
      sub.title.toLowerCase().includes(query) ||
      sub.body.toLowerCase().includes(query)
    )

  const visibleSections = manualSections.filter(
    (section) =>
      !query ||
      section.title.toLowerCase().includes(query) ||
      section.subsections.some(
        (sub) =>
          sub.title.toLowerCase().includes(query) ||
          sub.body.toLowerCase().includes(query)
      )
  )

  const toggleSection = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const isExpanded = (id) => query ? true : expandedIds.has(id)

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[150] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-label="Owner's Manual"
        className={`fixed top-0 right-0 bottom-0 z-[160] flex flex-col bg-[#0E1214] border-l border-[#2A343C] shadow-2xl transition-transform duration-300 ease-in-out
          w-full sm:w-[420px]
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A343C] flex-shrink-0 bg-[#0E1214]">
          <div>
            <h2
              className="text-base font-semibold text-[#F0EDE8]"
              style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700 }}
            >
              Owner's Manual
            </h2>
            <p className="text-xs text-[#8A9099]">Version 1.1</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close manual"
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
            placeholder="Search the manual…"
            className="w-full text-sm border border-[#2A343C] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00C0C8] bg-[#1A2025] text-[#F0EDE8] placeholder:text-[#8A9099]"
          />
        </div>

        {/* Sections list */}
        <div className="flex-1 overflow-y-auto">
          {visibleSections.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#8A9099]">
              {query ? `No results for "${search}"` : 'No sections found'}
            </p>
          ) : (
            <div>
              {visibleSections.map((section) => {
                const subs = matchingSubsections(section)
                const expanded = isExpanded(section.id)

                return (
                  <div key={section.id} className="border-b border-[#1A2025]">
                    {/* Section header */}
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#1A2025] transition-colors"
                    >
                      <span
                        className="text-sm font-semibold text-[#F0EDE8]"
                        style={{ fontFamily: "'Syne',sans-serif" }}
                      >
                        {section.title}
                      </span>
                      <svg
                        className={`w-4 h-4 text-[#8A9099] flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Subsections */}
                    {expanded && (
                      <div className="pb-2">
                        {subs.map((sub) => (
                          <div key={sub.id} className="px-4 pt-2 pb-4">
                            <p className="text-xs font-semibold text-[#00C0C8] mb-2 uppercase tracking-wide">
                              {sub.title}
                            </p>
                            <pre
                              className="text-sm text-[#8A9099] leading-relaxed whitespace-pre-wrap font-sans"
                            >
                              {sub.body}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#2A343C] flex-shrink-0">
          <p className="text-xs text-[#8A9099] text-center">
            VendorCompare Owner's Manual v1.1
            {query ? ` · ${visibleSections.length} section${visibleSections.length !== 1 ? 's' : ''} matching` : ''}
          </p>
        </div>
      </div>
    </>
  )
}
