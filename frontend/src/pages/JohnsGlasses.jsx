import PARManager from '../components/PARManager'
import OrderReviewQueue from '../components/OrderReviewQueue'

export default function JohnsGlasses() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-emerald-700 text-white flex items-center justify-center px-4 z-50 shadow-md">
        <div className="flex items-center gap-2">
          {/* Glasses SVG icon */}
          <svg width="28" height="14" viewBox="0 0 28 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-90">
            <rect x="1" y="2" width="10" height="8" rx="4" stroke="white" strokeWidth="2" fill="none"/>
            <rect x="17" y="2" width="10" height="8" rx="4" stroke="white" strokeWidth="2" fill="none"/>
            <line x1="11" y1="6" x2="17" y2="6" stroke="white" strokeWidth="2"/>
            <line x1="0" y1="4" x2="1" y2="4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <line x1="27" y1="4" x2="28" y2="4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <h1 className="text-lg font-semibold">John's Glasses</h1>
        </div>
      </header>

      <main className="flex-1 pt-[76px] pb-8 px-3 space-y-4">
        {/* Order Review Queue — shown first so John sees what needs action */}
        <section>
          <OrderReviewQueue />
        </section>

        {/* PAR Manager */}
        <section>
          <PARManager />
        </section>
      </main>
    </div>
  )
}
