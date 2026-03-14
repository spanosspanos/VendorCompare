import SombreroHome from './SombreroHome'
import { useNavigate } from 'react-router-dom'

/**
 * PageHeader — Shared page header component for VendorCompare app.
 *
 * Props:
 *   title       {string}  — Page title, left-aligned
 *   icons       {Array}   — Optional array of { emoji, label } for decorative right-side icon cluster
 *   rightContent {node}   — Optional React node for right-side functional content (badges, buttons)
 *   showBack    {bool}    — Show SombreroHome back button (default: true)
 */
export default function PageHeader({ title, icons = [], rightContent, showBack = true }) {
  const navigate = useNavigate()

  return (
    <header className="relative fixed top-0 left-0 right-0 h-[60px] bg-[#0E1214] text-white flex items-center justify-between px-4 z-50 shadow-md">
      {/* Left: back button + title */}
      <div className="flex items-center gap-2">
        {showBack && (
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-1"
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

      {/* Right: icon cluster + optional functional content */}
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
      </div>

      {/* Gold bottom border — matches JohnsGlasses aesthetic */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-[#D4A017] opacity-45" />
    </header>
  )
}
