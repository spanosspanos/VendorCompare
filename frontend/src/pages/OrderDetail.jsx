import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getOrderDetail } from '../api'
import jsPDF from 'jspdf'

function generatePDF(orderId, approvalTime, vendorSections, totalCost, savingsVsWorst, flaggedItems, notesToJohn) {
  const doc = new jsPDF()
  let y = 22

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(`Cantina Order #${orderId}`, 105, y, { align: 'center' })
  y += 9

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Approved: ${approvalTime}`, 105, y, { align: 'center' })
  y += 6
  doc.text('Location: Cantina', 105, y, { align: 'center' })
  y += 10

  doc.setDrawColor(200, 200, 200)
  doc.line(15, y, 195, y)
  y += 8

  vendorSections.forEach((vs) => {
    if (y > 255) { doc.addPage(); y = 22 }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(vs.vendorName, 15, y)
    y += 7

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(130, 130, 130)
    doc.text('Product', 20, y)
    doc.text('Qty', 130, y, { align: 'right' })
    doc.text('Unit Price', 158, y, { align: 'right' })
    doc.text('Total', 195, y, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    y += 5

    vs.items.forEach((item) => {
      if (y > 270) { doc.addPage(); y = 22 }
      const lineText = item.product_name.length > 55 ? item.product_name.substring(0, 52) + '…' : item.product_name
      doc.setFontSize(9)
      doc.text(lineText, 20, y)
      doc.text(`${item.quantity}`, 130, y, { align: 'right' })
      doc.text(item.unit_price != null ? `$${item.unit_price.toFixed(2)}` : '—', 158, y, { align: 'right' })
      doc.text(item.line_total != null ? `$${item.line_total.toFixed(2)}` : '—', 195, y, { align: 'right' })
      y += 5
    })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Subtotal:', 130, y, { align: 'right' })
    doc.text(`$${vs.subtotal.toFixed(2)}`, 195, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    y += 9
  })

  if (y > 255) { doc.addPage(); y = 22 }
  doc.line(15, y, 195, y)
  y += 8

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Order Total:', 130, y, { align: 'right' })
  doc.text(`$${totalCost.toFixed(2)}`, 195, y, { align: 'right' })
  y += 7

  if (savingsVsWorst > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(20, 130, 80)
    doc.text(`Savings vs single-vendor: $${savingsVsWorst.toFixed(2)}`, 195, y, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    y += 8
  }

  if (notesToJohn) {
    y += 3
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Kitchen Note:', 15, y)
    doc.setFont('helvetica', 'normal')
    y += 6
    const noteLines = doc.splitTextToSize(notesToJohn, 165)
    doc.text(noteLines, 20, y)
    y += noteLines.length * 5 + 5
  }

  if (flaggedItems.length > 0) {
    if (y > 240) { doc.addPage(); y = 22 }
    y += 3
    doc.line(15, y, 195, y)
    y += 8

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Flagged Items', 15, y)
    y += 7

    flaggedItems.forEach((item) => {
      if (y > 270) { doc.addPage(); y = 22 }
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      const flagLabel = item.flag === 'no_par' ? '[NO PAR]' : item.flag === 'overstock' ? '[OVERSTOCK]' : ''
      doc.text(`• ${item.product_name} ${flagLabel}`, 20, y)
      doc.setFont('helvetica', 'normal')
      y += 5
      if (item.item_note) {
        const noteLines = doc.splitTextToSize(`"${item.item_note}"`, 155)
        doc.text(noteLines, 25, y)
        y += noteLines.length * 4 + 3
      }
    })
  }

  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(150, 150, 150)
  doc.text(
    'This is an internal ordering document. Cantina Order # does not correspond to any vendor invoice number.',
    105, 290, { align: 'center' }
  )

  return doc
}

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  useEffect(() => {
    getOrderDetail(id)
      .then((res) => setOrder(res.data))
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('Order not found.')
        } else {
          setError('Failed to load order. Please try again.')
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-[#0E1214]">
        <header className="fixed top-0 left-0 right-0 h-[60px] bg-[#0E1214] text-[#F0EDE8] flex items-center justify-between px-4 z-50 shadow-md">
          <button onClick={() => navigate('/glasses')} className="p-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold" style={{fontFamily:"'Syne',sans-serif"}}>Order Detail</h1>
          <div className="w-10" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-[#D4A017] opacity-45" />
        </header>
        <div className="flex-1 flex items-center justify-center pt-[60px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-[#00C0C8] border-t-transparent rounded-full animate-spin" />
            <span className="text-[#8A9099] text-sm">Loading order…</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen bg-[#0E1214]">
        <header className="fixed top-0 left-0 right-0 h-[60px] bg-[#0E1214] text-[#F0EDE8] flex items-center justify-between px-4 z-50 shadow-md">
          <button onClick={() => navigate('/glasses')} className="p-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold" style={{fontFamily:"'Syne',sans-serif"}}>Order Detail</h1>
          <div className="w-10" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-[#D4A017] opacity-45" />
        </header>
        <div className="flex-1 flex items-center justify-center pt-[60px] px-6">
          <div className="text-center">
            <p className="text-[#C23B3B] mb-4">{error}</p>
            <Link to="/glasses" className="px-4 py-2 bg-[#00C0C8] text-[#0E1214] rounded-full text-sm font-bold">
              Back to History
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Group items by vendor for display
  const itemsByVendor = {}
  order.vendor_splits.forEach((vs) => {
    itemsByVendor[vs.vendor_id] = { split: vs, items: [] }
  })
  order.items.forEach((item) => {
    if (itemsByVendor[item.selected_vendor_id]) {
      itemsByVendor[item.selected_vendor_id].items.push(item)
    }
  })

  const handleDownloadPDF = () => {
    setDownloadingPdf(true)
    try {
      const approvalTime = new Date(order.created_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
      const pdfVendorSections = Object.values(itemsByVendor)
        .filter(({ items }) => items.length > 0)
        .map(({ split, items }) => ({
          vendorName: split.vendor_name,
          subtotal: split.total,
          items: items.map((item) => ({
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price > 0 ? item.unit_price : null,
            line_total: item.line_total > 0 ? item.line_total : null,
          })),
        }))
      const flaggedItems = order.items.filter((i) => i.flag || i.item_note)
      const doc = generatePDF(
        order.id,
        approvalTime,
        pdfVendorSections,
        order.total_cost,
        order.savings_vs_worst,
        flaggedItems,
        order.notes_to_john,
      )
      doc.save(`cantina-order-${order.id}.pdf`)
    } catch {
      alert('PDF generation failed. Please try again.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0E1214]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-[#0E1214] text-[#F0EDE8] flex items-center justify-between px-4 z-50 shadow-md">
        <button onClick={() => navigate('/glasses')} className="p-3" aria-label="Back">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold" style={{fontFamily:"'Syne',sans-serif"}}>Order #{order.id}</h1>
        <div className="w-10" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-[#D4A017] opacity-45" />
      </header>

      <main className="flex-1 pt-[76px] pb-6 px-3">
        {/* Order header card */}
        <div className="bg-[#1A2025] rounded-xl border border-[#2A343C] p-4 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm text-[#8A9099]">
                {new Date(order.created_at).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                })}
              </p>
              <p className="text-xs text-[#8A9099] mt-0.5">
                {new Date(order.created_at).toLocaleTimeString('en-US', {
                  hour: 'numeric', minute: '2-digit',
                })}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#3DAA6E]/15 text-[#3DAA6E]">
                {order.status}
              </span>
              {order.review_status === 'pending' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#E07B35]/15 text-[#E07B35]">
                  Pending Review
                </span>
              )}
              {order.review_status === 'approved' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#3DAA6E]/15 text-[#3DAA6E]">
                  Approved
                </span>
              )}
              {order.review_status === 'rejected' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#C23B3B]/15 text-[#C23B3B]">
                  Rejected
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-[#8A9099] uppercase tracking-wide">Total Cost</p>
              <p className="text-2xl font-bold text-[#F0EDE8]">${order.total_cost.toFixed(2)}</p>
            </div>
            {order.savings_vs_worst > 0 && (
              <div>
                <p className="text-xs text-[#8A9099] uppercase tracking-wide">Savings vs Worst</p>
                <p className="text-2xl font-bold text-[#3DAA6E]">${order.savings_vs_worst.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Download PDF button */}
        <button
          onClick={handleDownloadPDF}
          disabled={downloadingPdf}
          className="w-full py-2.5 mb-4 rounded-xl bg-[#222C33] border border-[#2A343C] text-sm font-semibold text-[#00C0C8] flex items-center justify-center gap-2 active:opacity-75 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {downloadingPdf ? 'Generating PDF…' : 'Download PDF'}
        </button>

        {/* Vendor split cards */}
        {Object.values(itemsByVendor).map(({ split, items }) => (
          <div key={split.vendor_id} className="bg-[#1A2025] rounded-xl border border-[#2A343C] mb-3 overflow-hidden">
            {/* Vendor header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#222C33] border-b border-[#2A343C]">
              <span className="font-semibold text-[#F0EDE8]" style={{fontFamily:"'Syne',sans-serif"}}>{split.vendor_name}</span>
              <span className="font-bold text-[#F0EDE8] text-base">${split.total.toFixed(2)}</span>
            </div>
            {/* Line items */}
            <div className="divide-y divide-[#2A343C]">
              {items.map((item) => (
                <div key={item.product_id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm text-[#F0EDE8] truncate">{item.product_name}</span>
                        {item.flag === 'no_par' && (
                          <span className="bg-[#E07B35]/20 text-[#E07B35] text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0">
                            NO PAR
                          </span>
                        )}
                        {item.flag === 'overstock' && (
                          <span className="bg-[#E07B35]/20 text-[#E07B35] text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0">
                            OVERSTOCK
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[#8A9099]">
                        {item.unit_price > 0
                          ? `${item.quantity} × $${item.unit_price.toFixed(2)}`
                          : `${item.quantity} × —`}
                      </span>
                      {item.item_note && (
                        <p className="text-xs text-[#8A9099] italic mt-0.5">"{item.item_note}"</p>
                      )}
                    </div>
                    <span className="text-sm font-medium text-[#F0EDE8] ml-3 flex-shrink-0">
                      {item.line_total > 0 ? `$${item.line_total.toFixed(2)}` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Notes to John (if present) */}
        {order.notes_to_john && (
          <div className="bg-[#E07B35]/10 border border-[#E07B35]/20 rounded-xl p-3 mb-3">
            <p className="text-xs font-semibold text-[#E07B35] uppercase tracking-wide mb-1">Notes to John</p>
            <p className="text-sm text-[#F0EDE8]">{order.notes_to_john}</p>
          </div>
        )}

        {/* Footer back link */}
        <div className="mt-4 text-center">
          <Link to="/glasses" className="text-sm font-semibold text-[#00C0C8] py-3 inline-block">
            ← Back to History
          </Link>
        </div>
      </main>
    </div>
  )
}
