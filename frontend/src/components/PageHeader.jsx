import { useState } from 'react'
import SombreroHome from './SombreroHome'
import HelpDrawer from './HelpDrawer'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * PageHeader — Shared page header component for VendorCompare app.
 *
 * Props:
 *   title        {string}  — Page title, left-aligned
 *   icons        {Array}   — Optional array of { emoji, label } for decorative right-side icon cluster
 *   rightContent {node}    — Optional React node for right-side functional content (badges, buttons)
 *   showBack     {bool}    — Show SombreroHome back button (default: true)
 */
export default function PageHeader({ title, icons = [], rightContent, showBack = true }) {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [helpOpen, setHelpOpen] = useState(false)

  // Determine help role: admin if role === 'admin', else 'user'
  const helpRole = role === 'admin' ? 'admin' : 'user'

  return (
    <>
      <header className="relative fixed top-0 left-0 right-0 h-[60px] bg-[#0E1214] text-white flex items-center justify-between px-4 z-50 shadow-md">
        {/* Left: back button + title */}
        <div className="flex items-center gap-2">
          {showBack && (
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-1 transition-transform duration-150 hover:scale-110 hover:drop-shadow-[0_0_6px_rgba(240,200,48,0.6)]"
              aria-label="Home"
            >
              <SombreroHome />
            </button>
          )}
          <h1
            className="text-lg font-semibold text-[#F0EDE8]"
            style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700 }}
          >
            {title}
          </h1>
        </div>

        {/* Right: icon cluster + optional functional content + help button */}
        <div className="flex items-center gap-1">
          {icons.map((icon, i) => (
            <span
              key={i}
              className="px-1 text-xl leading-none"
              role="img"
              aria-label={icon.label}
            >
              {icon.emoji}
            </span>
          ))}
          {rightContent}
          <button
            onClick={() => setHelpOpen(true)}
            aria-label="Open help"
            className="ml-1 w-8 h-8 flex items-center justify-center rounded-lg text-[#8A9099] hover:text-[#F0EDE8] hover:bg-[#2A343C] transition-colors text-sm font-bold border border-[#2A343C]"
          >
            ?
          </button>
        </div>

        {/* Gold bottom border — matches JohnsGlasses aesthetic */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-[#D4A017] opacity-45" />
      </header>

      <HelpDrawer
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        role={helpRole}
      />
    </>
  )
}
