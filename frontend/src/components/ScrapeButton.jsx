/**
 * ScrapeButton — placeholder for Gate 3 scraper trigger.
 * Live scraping requires US Foods MOXē credentials (contact SpanosspanoS).
 */
export default function ScrapeButton({ onResult }) {
  return (
    <div className="relative group inline-block">
      <button
        disabled
        className="px-4 py-2 rounded-xl bg-[#1A242C] border border-[#2A343C] text-sm text-[#8A9099] cursor-not-allowed opacity-60 select-none"
        aria-label="Refresh US Foods Prices — credentials required"
      >
        🔄 Refresh US Foods Prices
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-[#2A343C] text-xs text-[#F0EDE8] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
        Credentials required — see setup
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2A343C]" />
      </div>
    </div>
  )
}
