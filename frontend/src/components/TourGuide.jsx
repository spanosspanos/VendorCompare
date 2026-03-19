import Joyride, { STATUS, EVENTS, ACTIONS } from 'react-joyride'
import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

// ── DEMO MODE ─────────────────────────────────────────────────────────────────
// true  → pulsing "Take A Tour!!" badge + overlay click advances tour
// false → bus icon only, no badge; Back/Next buttons only (overlay locked)
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

// ── Route per step (11 stops, index 0–10) ─────────────────────────────────────
const STEP_ROUTES = [
  '/',               // 0 — Home: You Are Here (keep as-is)
  '/',               // 1 — Home: The Five Things on This Page
  '/quick-order',    // 2 — Quick Order
  '/quick-order',    // 3 — Clipboard (stays on Quick Order)
  '/inventory-count',// 4 — Inventory Count
  '/',               // 5 — Margarita Glass 🍹 (home header)
  '/order-assembly', // 6 — Order Review (Kitchen Manager)
  '/glasses',        // 7 — John's Glasses: Review Queue
  '/glasses',        // 8 — John's Glasses: Order Details
  '/glasses',        // 9 — John's Glasses: Order History (tab flip)
  '/',               // 10 — End of the Line (home)
]

// ── Content components ────────────────────────────────────────────────────────

const Stop0Content = () => (
  <div style={{ fontFamily: "'Inter', sans-serif", color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6 }}>
    {/* Section 1 — Kitchen Manager */}
    <p style={{ marginBottom: 4, fontSize: '0.75rem', color: '#00C0C8', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Kitchen Manager</p>
    <p style={{ marginBottom: 8, fontSize: '0.8rem', color: '#8A9099' }}>Your two entry points:</p>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: 14 }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #2A343C', color: '#8A9099' }}>I want to…</th>
          <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #2A343C', color: '#8A9099' }}>I go to…</th>
        </tr>
      </thead>
      <tbody>
        {[
          ['Order items I know I need', 'Quick Order'],
          ['Count stock and calculate order from PAR', 'Inventory Count'],
          ['Edit, flag, and submit an order', 'Order Review'],
          ['Revisit a saved or pending order', '🍹 Margarita glass'],
        ].map(([want, go], i) => (
          <tr key={i}>
            <td style={{ padding: '4px 6px', borderBottom: '1px solid #2A343C20', color: '#cbd5e1' }}>{want}</td>
            <td style={{ padding: '4px 6px', borderBottom: '1px solid #2A343C20', color: '#00C0C8', fontWeight: 500 }}>{go}</td>
          </tr>
        ))}
      </tbody>
    </table>

    {/* Section divider */}
    <div style={{ borderTop: '1px solid #2A343C', marginBottom: 12 }} />

    {/* Section 2 — John's Glasses */}
    <p style={{ marginBottom: 4, fontSize: '0.75rem', color: '#00C0C8', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>John's Glasses</p>
    <p style={{ marginBottom: 8, fontSize: '0.8rem', color: '#8A9099' }}>The owner portal:</p>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #2A343C', color: '#8A9099' }}>I want to…</th>
          <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #2A343C', color: '#8A9099' }}>I go to…</th>
        </tr>
      </thead>
      <tbody>
        {[
          ['Review and approve submitted orders', 'Review Queue'],
          ['See vendor splits and pricing', 'Order Details'],
          ['Browse past orders and export PDFs', 'Order History'],
        ].map(([want, go], i) => (
          <tr key={i}>
            <td style={{ padding: '4px 6px', borderBottom: '1px solid #2A343C20', color: '#cbd5e1' }}>{want}</td>
            <td style={{ padding: '4px 6px', borderBottom: '1px solid #2A343C20', color: '#00C0C8', fontWeight: 500 }}>{go}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const Stop1Content = () => (
  <div style={{ fontFamily: "'Inter', sans-serif", color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6 }}>
    <p style={{ marginBottom: 10 }}>Before we roll, here's everything on this page:</p>
    <p style={{ marginBottom: 8 }}>
      🚌 <strong style={{ color: '#fff' }}>Tour Bus</strong> — that's this. Tap it anytime to restart the tour.
    </p>
    <p style={{ marginBottom: 8 }}>
      🍹 <strong style={{ color: '#fff' }}>Margarita Glass</strong> — your quick-save shortcut. More on this at Stop 4.
    </p>
    <p style={{ marginBottom: 8 }}>
      <strong style={{ color: '#fff' }}>Quick Order</strong> — you know what you need. Browse, pick quantities, fire.
    </p>
    <p style={{ marginBottom: 8 }}>
      <strong style={{ color: '#fff' }}>Inventory Count</strong> — full count mode. Enter what's on hand; PAR math handled.
    </p>
    <p style={{ marginBottom: 0 }}>
      <strong style={{ color: '#fff' }}>John's Glasses</strong> — the owner portal. His stop is coming up.
    </p>
  </div>
)

const Stop2Content = () => (
  <div style={{ fontFamily: "'Inter', sans-serif", color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6 }}>
    <p style={{ marginBottom: 10 }}>
      You know what you need — Quick Order is your lane.
    </p>
    <p style={{ marginBottom: 10 }}>
      Browse by category or search by name. Set quantities as you go.
    </p>
    <p style={{ marginBottom: 0 }}>
      When you're ready, tap the clipboard 📋 in the header to review your order.
    </p>
  </div>
)

const Stop3Content = () => (
  <div style={{ fontFamily: "'Inter', sans-serif", color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6 }}>
    <p style={{ marginBottom: 10 }}>
      The clipboard 📋 in the header is your active cart for Quick Order.
    </p>
    <p style={{ marginBottom: 10 }}>
      Every item you select lands here. Tap it anytime to review what's in your order before sending it to John.
    </p>
    <p style={{ marginBottom: 10 }}>
      Inventory Count works differently — the system calculates your order automatically based on PAR. No clipboard needed.
    </p>
    <p style={{ marginBottom: 0 }}>
      Nothing is committed until you save.
    </p>
  </div>
)

const Stop4Content = () => (
  <div style={{ fontFamily: "'Inter', sans-serif", color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6 }}>
    <p style={{ marginBottom: 10 }}>
      Full count mode. Go item by item — enter what you have on hand.
    </p>
    <p style={{ marginBottom: 0 }}>
      VendorCompare does the PAR math: what you have vs. what you need. No calculator required.
    </p>
  </div>
)

const Stop5Content = () => (
  <div style={{ fontFamily: "'Inter', sans-serif", color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6 }}>
    <p style={{ marginBottom: 10 }}>
      The margarita glass 🍹 is your saved orders tray.
    </p>
    <p style={{ marginBottom: 10 }}>
      Tap it anytime to see orders you've submitted that are still pending John's review. Tap any order to reopen it — edit quantities, add notes, and resubmit.
    </p>
    <p style={{ marginBottom: 0 }}>
      It lives in the header on every page, so you can always get back to an order in progress.
    </p>
  </div>
)

const Stop6Content = () => (
  <div style={{ fontFamily: "'Inter', sans-serif", color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6 }}>
    <p style={{ marginBottom: 10 }}>This is where you finalize before sending to John.</p>
    <ul style={{ paddingLeft: 16, marginBottom: 0 }}>
      <li style={{ marginBottom: 6 }}>
        <strong style={{ color: '#fff' }}>Edit quantities</strong> — adjust anything before saving; splits recalculate automatically.
      </li>
      <li style={{ marginBottom: 6 }}>
        <strong style={{ color: '#fff' }}>Flag an item</strong> — tap the taco 🌮 next to any item to flag it for John's attention. One tap — no form, no friction.
      </li>
      <li style={{ marginBottom: 6 }}>
        <strong style={{ color: '#fff' }}>Add an order note</strong> — a note for the whole order, not a specific item.
      </li>
      <li style={{ marginBottom: 0 }}>
        <strong style={{ color: '#fff' }}>Save</strong> — sends the order to John's review queue.
      </li>
    </ul>
  </div>
)

const Stop7Content = () => (
  <div style={{ fontFamily: "'Inter', sans-serif", color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6 }}>
    <p style={{ marginBottom: 10 }}>
      John's Glasses is the owner portal. This is where orders land after the kitchen submits them.
    </p>
    <ul style={{ paddingLeft: 16, marginBottom: 0 }}>
      <li style={{ marginBottom: 6 }}>
        <strong style={{ color: '#fff' }}>Review Queue</strong> — every submitted order, waiting for John's eyes.
      </li>
      <li style={{ marginBottom: 6 }}>
        Flagged items (taco 🌮) are highlighted — John's attention goes there first.
      </li>
      <li style={{ marginBottom: 0 }}>
        John can approve, reject, or edit before the order goes out.
      </li>
    </ul>
  </div>
)

const Stop8Content = () => (
  <div style={{ fontFamily: "'Inter', sans-serif", color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6 }}>
    <p style={{ marginBottom: 10 }}>Inside each order, John sees the full picture:</p>
    <ul style={{ paddingLeft: 16, marginBottom: 0 }}>
      <li style={{ marginBottom: 6 }}>
        <strong style={{ color: '#fff' }}>Vendor splits</strong> — which items go to US Foods, Food Direct, Riviera Produce, and why.
      </li>
      <li style={{ marginBottom: 6 }}>
        <strong style={{ color: '#fff' }}>Unit price + line totals</strong> — every item shows price × quantity = total.
      </li>
      <li style={{ marginBottom: 6 }}>
        <strong style={{ color: '#fff' }}>Savings</strong> — what VendorCompare saved vs. ordering everything from one vendor.
      </li>
      <li style={{ marginBottom: 0 }}>
        <strong style={{ color: '#fff' }}>PDF export</strong> — download the full order for records.
      </li>
    </ul>
  </div>
)

const Stop9Content = () => (
  <div style={{ fontFamily: "'Inter', sans-serif", color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6 }}>
    <p style={{ marginBottom: 10 }}>
      Order History is the paper trail. Every submitted order — searchable, downloadable as PDF.
    </p>
    <p style={{ marginBottom: 0 }}>
      Reference any past order to see exactly what was ordered, from which vendors, and at what price.
    </p>
  </div>
)

const Stop10Content = () => (
  <div style={{ fontFamily: "'Inter', sans-serif", color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6, textAlign: 'center' }}>
    <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🚌</div>
    <p style={{ marginBottom: 10, fontWeight: 600, color: '#fff' }}>End of the line.</p>
    <p style={{ marginBottom: 0 }}>
      You've seen the full kitchen — Quick Order, Inventory Count, Order Review, and John's corner.
      Tap the bus anytime to run the tour again. Now go cook something.
    </p>
  </div>
)

// ── Steps ─────────────────────────────────────────────────────────────────────

const steps = [
  {
    target: '[data-tour="bus-btn"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'You Are Here — Quick Reference',
    content: <Stop0Content />,
  },
  {
    target: '[data-tour="home-buttons"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Stop 1 — The Five Things on This Page',
    content: <Stop1Content />,
  },
  {
    target: '[data-tour="quick-order-main"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Stop 2 — Quick Order',
    content: <Stop2Content />,
  },
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    disableScrolling: true,
    styles: { spotlight: { display: 'none' } },
    title: 'Stop 3 — The Clipboard 📋',
    content: <Stop3Content />,
  },
  {
    target: '[data-tour="inventory-count-main"]',
    placement: 'auto',
    disableBeacon: true,
    title: 'Stop 4 — Inventory Count',
    content: <Stop4Content />,
  },
  {
    target: '[data-tour="margarita-btn"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Stop 5 — The Margarita Glass 🍹',
    content: <Stop5Content />,
  },
  {
    target: '[data-tour="order-items-list"]',
    placement: 'top',
    disableBeacon: true,
    title: 'Stop 6 — Order Review',
    content: <Stop6Content />,
  },
  {
    target: '[data-tour="glasses-queue"]',
    placement: 'auto',
    disableBeacon: true,
    title: "Stop 7 — John's Glasses: Review Queue",
    content: <Stop7Content />,
  },
  {
    target: '[data-tour="glasses-queue"]',
    placement: 'auto',
    disableBeacon: true,
    title: "Stop 8 — John's Glasses: Order Details",
    content: <Stop8Content />,
  },
  {
    target: '[data-tour="glasses-history-tab"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Stop 9 — Order History',
    content: <Stop9Content />,
  },
  {
    target: '[data-tour="bus-btn"]',
    placement: 'bottom',
    disableBeacon: true,
    title: 'End of the Line 🚌',
    content: <Stop10Content />,
  },
]

// ── Custom tooltip (sticky title + scrollable body + sticky footer for Stop 0) ──

const CustomTooltip = ({
  backProps,
  closeProps,
  index,
  primaryProps,
  skipProps,
  step,
  tooltipProps,
}) => {
  const isStop0 = index === 0

  return (
    <div
      {...tooltipProps}
      style={{
        backgroundColor: '#16213e',
        border: '1px solid #00C0C8',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.65), 0 2px 8px rgba(0,192,200,0.18)',
        width: 360,
        maxWidth: '95vw',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: isStop0 ? '82vh' : undefined,
        overflow: isStop0 ? 'hidden' : undefined,
      }}
    >
      {/* Sticky header — title */}
      <div style={{
        padding: '20px 20px 8px 20px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        background: 'rgba(22, 33, 62, 0.6)',
      }}>
        {step.title && (
          <div style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            color: '#ffffff',
            fontSize: '1rem',
            flex: 1,
            paddingRight: 8,
          }}>
            {step.title}
          </div>
        )}
        <button
          {...closeProps}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: '1rem',
            lineHeight: 1,
            padding: 0,
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          ✕
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{
        padding: '0 20px 8px 20px',
        overflowY: isStop0 ? 'auto' : undefined,
        flex: isStop0 ? 1 : undefined,
        minHeight: 0,
      }}>
        {step.content}
      </div>

      {/* Sticky footer — Skip / Back / Next */}
      <div style={{
        padding: '8px 20px 20px 20px',
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(22, 33, 62, 0.6)',
      }}>
        <button
          {...skipProps}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.8rem',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {skipProps.title}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {index > 0 && (
            <button
              {...backProps}
              style={{
                background: 'none',
                border: 'none',
                color: '#8A9099',
                fontFamily: "'Inter', sans-serif",
                fontSize: '0.875rem',
                cursor: 'pointer',
                padding: 0,
                marginRight: 4,
              }}
            >
              {backProps.title}
            </button>
          )}
          <button
            {...primaryProps}
            style={{
              backgroundColor: '#00C0C8',
              color: '#ffffff',
              borderRadius: '10px',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: '0.875rem',
              padding: '8px 18px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {primaryProps.title}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Joyride styles ────────────────────────────────────────────────────────────

const joyrideStyles = {
  options: {
    arrowColor: '#16213e',
    backgroundColor: '#16213e',
    overlayColor: 'rgba(0, 0, 0, 0.25)',
    primaryColor: '#00C0C8',
    textColor: '#cbd5e1',
    zIndex: 20000,
    width: 360,
  },
  tooltip: {
    border: '1px solid #00C0C8',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.65), 0 2px 8px rgba(0,192,200,0.18)',
  },
  tooltipTitle: {
    fontFamily: "'Syne', sans-serif",
    fontWeight: 700,
    color: '#ffffff',
    fontSize: '1rem',
    marginBottom: 8,
  },
  tooltipContent: {
    padding: '0 0 8px 0',
  },
  buttonNext: {
    backgroundColor: '#00C0C8',
    color: '#ffffff',
    borderRadius: '10px',
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    fontSize: '0.875rem',
    padding: '8px 18px',
    border: 'none',
  },
  buttonBack: {
    color: '#8A9099',
    fontFamily: "'Inter', sans-serif",
    fontSize: '0.875rem',
    marginRight: 8,
  },
  buttonSkip: {
    color: '#64748b',
    fontFamily: "'Inter', sans-serif",
    fontSize: '0.8rem',
  },
  buttonClose: {
    color: '#64748b',
    top: 12,
    right: 12,
  },
  spotlight: {
    borderRadius: '8px',
    boxShadow: '0 0 0 2px #00C0C8, 0 0 0 9999px rgba(0,0,0,0.25)',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TourGuide({ run, onStop }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [stepIndex, setStepIndex] = useState(0)
  const [busVisible, setBusVisible] = useState(false)
  const busTimer = useRef(null)

  const triggerBus = () => {
    if (busTimer.current) clearTimeout(busTimer.current)
    setBusVisible(true)
    busTimer.current = setTimeout(() => setBusVisible(false), 700)
  }

  const getLocale = (idx) => {
    if (idx === 0) return { next: 'Start the Tour 🚌', skip: 'Skip Tour', back: 'Back', last: "Let's Go! ✅" }
    if (idx === steps.length - 1) return { next: "Let's Go! ✅", skip: 'Skip Tour', back: 'Back', last: "Let's Go! ✅" }
    return { next: 'Next Stop →', skip: 'Skip Tour', back: 'Back', last: "Let's Go! ✅" }
  }

  const navigateToStep = (nextIndex, delay = 200) => {
    const nextRoute = STEP_ROUTES[nextIndex]
    const currentRoute = location.pathname

    const needsNavigation = currentRoute !== nextRoute
    const needsTabFlip = nextIndex === 9
    const needsQueueTab = (nextIndex === 7 || nextIndex === 8) && currentRoute === '/glasses'

    if (needsNavigation) {
      const navState = nextIndex === 6 ? { state: { _tourMode: true } } : {}
      navigate(nextRoute, navState)
    }

    if (needsNavigation || needsTabFlip || needsQueueTab) {
      setTimeout(() => {
        if (needsTabFlip) {
          document.querySelector('[data-tour="glasses-history-tab"]')?.click()
        }
        if (needsQueueTab) {
          document.querySelector('[data-tour="glasses-queue-tab"]')?.click()
        }
        setStepIndex(nextIndex)
      }, delay)
    } else {
      setStepIndex(nextIndex)
    }
  }

  const closeTour = () => {
    if (location.pathname !== '/') navigate('/')
    setBusVisible(false)
    setStepIndex(0)
    onStop()
  }

  const handleCallback = (data) => {
    const { status, type, index, action } = data

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      closeTour()
      return
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      if (action === ACTIONS.PREV) {
        const prevIndex = index - 1
        if (prevIndex < 0) {
          closeTour()
          return
        }
        navigateToStep(prevIndex)
      } else {
        // NEXT or overlay tap (CLOSE in DEMO_MODE)
        const nextIndex = index + 1
        if (nextIndex >= steps.length) {
          closeTour()
          return
        }
        triggerBus()
        navigateToStep(nextIndex)
      }
    }
  }

  return (
    <>
      {busVisible && (
        <div
          className="bus-slide"
          style={{
            position: 'fixed',
            top: '16px',
            left: 0,
            zIndex: 30000,
            fontSize: '1.75rem',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          🚌
        </div>
      )}
      <Joyride
        steps={steps}
        run={run}
        stepIndex={stepIndex}
        continuous
        showSkipButton
        showProgress={false}
        disableScrolling
        disableOverlayClose={!DEMO_MODE}
        locale={getLocale(stepIndex)}
        styles={joyrideStyles}
        tooltipComponent={CustomTooltip}
        callback={handleCallback}
      />
    </>
  )
}

export { DEMO_MODE }
