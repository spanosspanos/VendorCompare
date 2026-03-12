import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col h-screen bg-[#0E1214]">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-[60px] gap-4">
        <p className="text-[#8A9099] text-sm mb-2">What do you need to do?</p>

        <div data-tour="home-buttons" className="w-full flex flex-col gap-4">
          <button
            onClick={() => navigate('/quick-order')}
            className="w-full max-w-sm bg-[#1A2025] rounded-xl border border-[#2A343C] p-5 text-left motion-card hover:bg-[#222C33] hover:border-[#00C0C8]/30"
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-[#00C0C8]/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#00C0C8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M12 11v4m-2-2h4" />
                </svg>
              </div>
              <span className="text-base font-bold text-[#F0EDE8]" style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>Quick Order</span>
            </div>
            <p className="text-sm text-[#8A9099] ml-[52px]">Manually build an order from the catalog.</p>
          </button>


        </div>
      </main>
    </div>
  )
}
