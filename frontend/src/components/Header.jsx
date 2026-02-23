import { Link } from 'react-router-dom'
import { useOrder } from '../context/OrderContext'

export default function Header() {
  const { selectedItems } = useOrder()
  const itemCount = Object.keys(selectedItems).length

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] bg-emerald-700 text-white flex items-center justify-between px-4 z-50 shadow-md">
      <button className="p-2" aria-label="Menu">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <h1 className="text-lg font-semibold">Cantina Orders</h1>

      <div className="flex items-center gap-2">
        {/* John's Glasses */}
        <Link to="/glasses" className="p-2 flex items-center" aria-label="John's Glasses">
          <svg width="24" height="12" viewBox="0 0 28 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="2" width="10" height="8" rx="4" stroke="white" strokeWidth="2" fill="none"/>
            <rect x="17" y="2" width="10" height="8" rx="4" stroke="white" strokeWidth="2" fill="none"/>
            <line x1="11" y1="6" x2="17" y2="6" stroke="white" strokeWidth="2"/>
            <line x1="0" y1="4" x2="1" y2="4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <line x1="27" y1="4" x2="28" y2="4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </Link>

        {/* Order History */}
        <Link to="/history" className="p-2 flex items-center" aria-label="Order History">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </Link>

        {/* Order Assembly — clipboard with item count badge */}
        <Link to="/order-assembly" className="relative p-2 flex items-center" aria-label="Assemble Orders">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          {itemCount > 0 && (
            <span className="absolute top-0 right-0 bg-white text-emerald-700 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
