export default function ClipboardCard({ children }) {
  return (
    <div className="relative mx-auto max-w-2xl">
      {/* SVG binder clip — centered at top, straddling edge */}
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
        <svg width="60" height="40" viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="clipGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#666"/>
              <stop offset="100%" stopColor="#444"/>
            </linearGradient>
          </defs>
          <rect x="8" y="0" width="44" height="13" rx="6" fill="url(#clipGrad)"/>
          <rect x="18" y="9" width="24" height="31" rx="4" fill="none" stroke="#4a4a4a" strokeWidth="4"/>
        </svg>
      </div>

      {/* Card shell */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          boxShadow: '0 2px 4px rgba(0,0,0,0.06), 0 4px 6px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.14), 0 20px 48px rgba(0,0,0,0.07)',
          border: '1px solid #e5e3dc',
        }}
      >
        {/* Paper surface */}
        <div
          style={{
            background: '#FDF8EE',
          }}
        >
          {/* Clip anchor area */}
          <div className="h-6 bg-gray-100/60 border-b border-gray-200/50" />
          {/* Content */}
          {children}
        </div>
      </div>
    </div>
  )
}
