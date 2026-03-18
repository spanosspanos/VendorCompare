import { useState } from 'react'
import jsPDF from 'jspdf'
import JSZip from 'jszip'
import { reviewOrder, patchOrder, assembleOrder } from '../api'
import HelpTooltip from './HelpTooltip'

const round2 = (n) => Math.round(n * 100) / 100

const slugifyVendor = (name) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

function generatePDF(orderId, approvalTime, vs, flaggedItems, notesToJohn) {
  const doc = new jsPDF()
  let y = 22

  // ── Header ──────────────────────────────────────────────────────────────────
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

  // ── Vendor Section ──────────────────────────────────────────────────────────
  {
    if (y > 255) { doc.addPage(); y = 22 }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(vs.vendorName, 15, y)
    y += 7

    // Column headers
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

    // Subtotal
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Subtotal:', 130, y, { align: 'right' })
    doc.text(`$${vs.subtotal.toFixed(2)}`, 195, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    y += 9
  }

  // ── Notes to John ────────────────────────────────────────────────────────────
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

  // ── Flagged Items ────────────────────────────────────────────────────────────
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

  // ── Footer ───────────────────────────────────────────────────────────────────
  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(150, 150, 150)
  doc.text(
    'This is an internal ordering document. Cantina Order # does not correspond to any vendor invoice number.',
    105, 290, { align: 'center' }
  )

  return doc
}

export default function OrderDetailJohns({ order, onBack, onAction, isReopen = false }) {
  const [step, setStep] = useState('view') // 'view' | 'approving' | 'rejecting'
  const [approveNote, setApproveNote] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Editable quantities
  const [localQtys, setLocalQtys] = useState({})
  const [recalcResult, setRecalcResult] = useState(null)
  const [recalculating, setRecalculating] = useState(false)
  const [recalcError, setRecalcError] = useState(null)
  const hasEdits = Object.keys(localQtys).length > 0

  // PDF state
  const [pdfDoc, setPdfDoc] = useState(null)
  const [approvalDone, setApprovalDone] = useState(false)

  // Build display vendor grouping
  const buildVendorSections = () => {
    if (recalcResult) {
      return recalcResult.vendor_orders.map((vo) => ({
        vendorId: vo.vendor_id,
        vendorName: vo.vendor_name,
        subtotal: vo.subtotal,
        items: vo.items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          item_note: null,
          flag: null,
        })),
      }))
    }

    // Original order structure
    const itemsByVendor = {}
    order.vendor_splits.forEach((vs) => {
      itemsByVendor[vs.vendor_id] = { vendorId: vs.vendor_id, vendorName: vs.vendor_name, split: vs, items: [] }
    })
    order.items.forEach((item) => {
      if (item.selected_vendor_id && itemsByVendor[item.selected_vendor_id]) {
        const qty = localQtys[item.product_id] !== undefined ? localQtys[item.product_id] : item.quantity
        const lineTotal = (item.unit_price > 0 && qty > 0) ? round2(qty * item.unit_price) : item.line_total
        itemsByVendor[item.selected_vendor_id].items.push({
          ...item,
          quantity: qty,
          line_total: lineTotal,
        })
      }
    })

    return Object.values(itemsByVendor).map(({ vendorId, vendorName, split, items }) => {
      const subtotal = hasEdits
        ? round2(items.reduce((sum, i) => sum + (i.line_total ?? 0), 0))
        : split.total
      return { vendorId, vendorName, subtotal, items }
    })
  }

  const vendorSections = buildVendorSections()
  const flaggedItems = order.items.filter((i) => i.flag || i.item_note)
  const totalCost = recalcResult
    ? recalcResult.total_cost
    : hasEdits
      ? round2(vendorSections.reduce((sum, vs) => sum + vs.subtotal, 0))
      : order.total_cost
  const savingsVsWorst = recalcResult ? (recalcResult.comparison?.savings_vs_worst ?? 0) : order.savings_vs_worst
  const flagCount = order.taco_flag_count || 0

  // What if? breakdown — from recalc result or saved comparison data
  const comparisonVendors = recalcResult?.comparison?.vendors ?? order.comparison?.vendors ?? null
  const whatIfVendors = comparisonVendors
    ? comparisonVendors
        .filter((v) => v.total_if_all !== null)
        .sort((a, b) => b.total_if_all - a.total_if_all)
    : null
  const worstVendor = whatIfVendors?.[0] ?? null
  const currentTotal = recalcResult?.total_cost ?? order.total_cost
  const specificSavings = worstVendor ? round2(worstVendor.total_if_all - currentTotal) : null

  const formattedDate = new Date(order.created_at).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
  const formattedTime = new Date(order.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  })

  const handleRecalculate = async () => {
    setRecalculating(true)
    setRecalcError(null)
    try {
      const items = order.items
        .filter((i) => i.selected_vendor_id)
        .map((i) => ({
          product_id: i.product_id,
          quantity: localQtys[i.product_id] !== undefined ? localQtys[i.product_id] : i.quantity,
        }))
        .filter((i) => i.quantity > 0)

      if (items.length === 0) {
        setRecalcError('No items to recalculate.')
        setRecalculating(false)
        return
      }

      const result = await assembleOrder(1, items)
      setRecalcResult(result)
    } catch {
      setRecalcError('Recalculate failed. Please try again.')
    } finally {
      setRecalculating(false)
    }
  }

  const buildApprovePayload = () => {
    if (recalcResult) {
      const items = recalcResult.vendor_orders.flatMap((vo) =>
        vo.items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          selected_vendor_id: vo.vendor_id,
          unit_price: item.unit_price,
          line_total: item.line_total,
          flag: null,
          item_note: null,
        }))
      )
      // Re-attach flagged items (no vendor)
      order.items.filter((i) => i.flag && !i.selected_vendor_id).forEach((fi) => {
        items.push({
          product_id: fi.product_id,
          quantity: localQtys[fi.product_id] ?? fi.quantity ?? 0,
          selected_vendor_id: null,
          unit_price: null,
          line_total: null,
          flag: fi.flag,
          item_note: fi.item_note,
        })
      })
      return {
        items,
        vendor_splits: recalcResult.vendor_orders.map((vo) => ({ vendor_id: vo.vendor_id, total: vo.subtotal })),
        total_cost: recalcResult.total_cost,
        savings_vs_worst: recalcResult.comparison?.savings_vs_worst ?? 0,
        review_status: 'approved',
        review_note: approveNote.trim() || null,
      }
    }

    if (hasEdits) {
      const items = order.items.map((i) => {
        const qty = localQtys[i.product_id] !== undefined ? localQtys[i.product_id] : i.quantity
        const lineTotal = (i.unit_price > 0 && qty > 0) ? round2(qty * i.unit_price) : i.line_total
        return {
          product_id: i.product_id,
          quantity: qty,
          selected_vendor_id: i.selected_vendor_id,
          unit_price: i.unit_price,
          line_total: lineTotal,
          flag: i.flag,
          item_note: i.item_note,
        }
      })
      const vendorTotals = {}
      items.forEach((i) => {
        if (i.selected_vendor_id && i.line_total > 0) {
          vendorTotals[i.selected_vendor_id] = round2((vendorTotals[i.selected_vendor_id] || 0) + i.line_total)
        }
      })
      const vendor_splits = Object.entries(vendorTotals).map(([vid, total]) => ({
        vendor_id: Number(vid), total,
      }))
      const total = round2(vendor_splits.reduce((s, vs) => s + vs.total, 0))
      return {
        items,
        vendor_splits,
        total_cost: total || order.total_cost,
        review_status: 'approved',
        review_note: approveNote.trim() || null,
      }
    }

    return null // no edits — use reviewOrder
  }

  const handleApprove = async () => {
    setSubmitting(true)
    try {
      const patchPayload = buildApprovePayload()
      if (patchPayload) {
        await patchOrder(order.id, patchPayload)
      } else {
        await reviewOrder(order.id, {
          review_status: 'approved',
          review_note: approveNote.trim() || null,
        })
      }

      // Generate PDF
      const approvalTime = new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
      const finalTotal = patchPayload?.total_cost ?? totalCost
      const finalSavings = patchPayload?.savings_vs_worst ?? savingsVsWorst

      // Build vendor sections for PDF
      const pdfVendorSections = recalcResult
        ? recalcResult.vendor_orders.map((vo) => ({
            vendorName: vo.vendor_name,
            subtotal: vo.subtotal,
            items: vo.items,
          }))
        : vendorSections

      const zip = new JSZip()
      pdfVendorSections.forEach((vs) => {
        const doc = generatePDF(order.id, approvalTime, vs, flaggedItems, order.notes_to_john)
        const pdfBlob = doc.output('blob')
        zip.file(`cantina-order-${order.id}-${slugifyVendor(vs.vendorName)}.pdf`, pdfBlob)
      })
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cantina-order-${order.id}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setPdfDoc(pdfVendorSections)
      setApprovalDone(true)
      onAction(order.id, 'approved')
    } catch {
      alert('Action failed. Please try again.')
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    setSubmitting(true)
    try {
      await reviewOrder(order.id, {
        review_status: 'rejected',
        review_note: rejectNote.trim(),
      })
      onAction(order.id, 'rejected')
    } catch {
      alert('Action failed. Please try again.')
      setSubmitting(false)
    }
  }

  const handleDownloadAgain = async () => {
    const approvalTime = new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
    if (pdfDoc && Array.isArray(pdfDoc)) {
      const zip = new JSZip()
      pdfDoc.forEach((vs) => {
        const doc = generatePDF(order.id, approvalTime, vs, flaggedItems, order.notes_to_john)
        const pdfBlob = doc.output('blob')
        zip.file(`cantina-order-${order.id}-${slugifyVendor(vs.vendorName)}.pdf`, pdfBlob)
      })
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cantina-order-${order.id}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0E1214]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-[#0E1214] text-white flex items-center justify-between px-4 z-50 shadow-md relative">
        <button onClick={onBack} className="p-3 -ml-1" aria-label="Back to queue">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center flex-1 mx-2 min-w-0">
          <h1 className="text-base font-semibold leading-tight truncate" style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>
            {isReopen ? 'Reopen — ' : ''}Cantina Order #{order.id}
          </h1>
          <p className="text-xs text-[#8A9099] leading-tight">{formattedDate} · {formattedTime}</p>
        </div>
        <div className="w-10" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-[#D4A017] opacity-45" />
      </header>

      <main className="flex-1 pt-[76px] pb-[86px] px-3">
        {/* Order summary card */}
        <div className="bg-[#1A2025] rounded-xl border border-[#2A343C] shadow-sm p-4 mb-3">
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="text-2xl font-bold text-[#F0EDE8]">${totalCost.toFixed(2)}</span>
              {/* Specific savings line when recalc data available; fallback to generic */}
              {specificSavings != null && specificSavings > 0 ? (
                <p className="text-xs text-[#3DAA6E] font-medium mt-0.5 flex items-center">
                  saved ${specificSavings.toFixed(2)} vs {worstVendor.vendor_name}
                  <HelpTooltip text="Estimated savings compared to ordering everything from the single most expensive vendor." />
                </p>
              ) : savingsVsWorst > 0 && (
                <p className="text-xs text-[#3DAA6E] font-medium mt-0.5 flex items-center">
                  saved ${savingsVsWorst.toFixed(2)} vs single-vendor
                  <HelpTooltip text="Estimated savings compared to ordering everything from the single most expensive vendor." />
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {flagCount > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-[#E07B35] text-[#0E1214] rounded-lg text-xs font-semibold">
                  <span>🌮</span>
                  <span>{flagCount} flag{flagCount !== 1 ? 's' : ''}</span>
                </span>
              )}
              {isReopen && (
                <span className="px-2 py-0.5 bg-[#00C0C8]/15 text-[#00C0C8] rounded-lg text-xs font-semibold">Reopen</span>
              )}
              {recalcResult && (
                <span className="px-2 py-0.5 bg-[#3DAA6E]/15 text-[#3DAA6E] rounded-lg text-xs font-semibold">Recalculated</span>
              )}
            </div>
          </div>

          {/* What if? vendor breakdown — only shown after recalc */}
          {whatIfVendors && whatIfVendors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#2A343C]">
              <p className="text-xs text-[#8A9099] font-medium uppercase tracking-wide mb-2">
                What if you ordered from one vendor?
              </p>
              <div className="space-y-1.5">
                {whatIfVendors.map((v, idx) => (
                  <div key={v.vendor_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#F0EDE8]">{v.vendor_name}</span>
                      {idx === 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[#C23B3B]/15 text-[#C23B3B] font-semibold">worst</span>
                      )}
                    </div>
                    <span className={`text-sm font-medium tabular-nums ${idx === 0 ? 'text-[#C23B3B]' : 'text-[#8A9099]'}`}>
                      ${v.total_if_all.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-[#2A343C]/60 flex items-center justify-between">
                <span className="text-xs text-[#3DAA6E] font-medium">Your optimized order</span>
                <span className="text-sm font-bold text-[#3DAA6E] tabular-nums">${totalCost.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3 text-xs text-[#8A9099]">
            <span>{order.vendor_splits.length} vendor{order.vendor_splits.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{order.items.filter(i => i.selected_vendor_id).length} item{order.items.filter(i => i.selected_vendor_id).length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Notes to John */}
        {order.notes_to_john && (
          <div className="bg-[#E07B35]/10 border border-[#E07B35]/20 rounded-2xl p-3 mb-3 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg className="w-3.5 h-3.5 text-[#E07B35] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="text-xs font-semibold text-[#E07B35] uppercase tracking-wide">Note from Kitchen</span>
            </div>
            <p className="text-sm text-[#F0EDE8]">{order.notes_to_john}</p>
          </div>
        )}

        {/* Flagged Items */}
        {flaggedItems.length > 0 && (
          <div className="bg-[#E07B35]/8 border-l-4 border-[#E07B35] border border-[#E07B35]/20 rounded-2xl p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span>🌮</span>
              <span className="text-xs font-semibold text-[#E07B35] uppercase tracking-wide">Flagged Items</span>
              <HelpTooltip text="Flag this item to draw the owner's attention. Add a short note explaining your concern — they'll see it highlighted in the Review Queue." />
            </div>
            <div className="space-y-2">
              {flaggedItems.map((item) => (
                <div key={item.product_id}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-base font-semibold text-[#F0EDE8]">{item.product_name}</p>
                    {item.flag === 'no_par' && (
                      <span className="bg-[#E07B35]/20 text-[#E07B35] text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0">NO PAR</span>
                    )}
                    {item.flag === 'overstock' && (
                      <span className="bg-[#E07B35]/20 text-[#E07B35] text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0">OVERSTOCK</span>
                    )}
                    {/* Quantity stepper for flagged items (John can enter qty) */}
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={() => setLocalQtys((p) => ({ ...p, [item.product_id]: Math.max(0, (p[item.product_id] ?? item.quantity ?? 0) - 1) }))}
                        className="w-6 h-6 rounded-full bg-[#E07B35]/20 flex items-center justify-center text-[#E07B35] font-bold text-sm active:bg-[#E07B35]/30"
                      >−</button>
                      <span className="text-sm font-bold text-[#F0EDE8] min-w-[1.5rem] text-center">
                        {localQtys[item.product_id] !== undefined ? localQtys[item.product_id] : (item.quantity ?? 0)}
                      </span>
                      <button
                        onClick={() => setLocalQtys((p) => ({ ...p, [item.product_id]: (p[item.product_id] ?? item.quantity ?? 0) + 1 }))}
                        className="w-6 h-6 rounded-full bg-[#E07B35]/20 flex items-center justify-center text-[#E07B35] font-bold text-sm active:bg-[#E07B35]/30"
                      >+</button>
                    </div>
                  </div>
                  {item.item_note && (
                    <p className="text-xs text-[#E07B35] mt-0.5 italic">"{item.item_note}"</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recalculate controls */}
        {!recalcResult && (
          <div className="bg-[#00C0C8]/8 border border-[#00C0C8]/20 rounded-2xl p-3 mb-3 flex items-center justify-between gap-3">
            <p className="text-xs text-[#00C0C8] flex-1">
              {hasEdits ? 'Quantities edited. Recalculate to update vendor splits and pricing.' : whatIfVendors ? 'Recalculate to refresh pricing with current rates.' : 'Recalculate to see vendor breakdown and savings analysis.'}
            </p>
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                recalculating ? 'bg-[#2A343C] text-[#8A9099] cursor-not-allowed' : 'bg-[#00C0C8] text-[#0E1214] active:bg-[#007F85]'
              }`}
            >
              {recalculating ? 'Recalculating…' : 'Recalculate'}
            </button>
          </div>
        )}
        {recalcResult && (
          <div className="bg-[#00C0C8]/8 border border-[#00C0C8]/20 rounded-2xl p-3 mb-3 flex items-center justify-between gap-3">
            <p className="text-xs text-[#00C0C8] flex-1">Pricing updated. New total: ${recalcResult.total_cost.toFixed(2)}</p>
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold bg-[#00C0C8]/15 text-[#00C0C8] active:bg-[#00C0C8]/25"
            >
              {recalculating ? 'Recalculating…' : 'Recalculate Again'}
            </button>
          </div>
        )}
        {recalcError && (
          <p className="text-[#C23B3B] text-xs text-center mb-3">{recalcError}</p>
        )}

        {/* Vendor breakdown cards */}
        {vendorSections.map((vs) => (
          <div key={vs.vendorId} className="bg-[#1A2025] rounded-xl border border-[#2A343C] shadow-sm mb-3 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#222C33] border-b border-[#2A343C]">
              <div className="flex items-center gap-1">
                <span className="text-base font-semibold text-[#F0EDE8]" style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>{vs.vendorName}</span>
                <HelpTooltip text="Items are routed to this vendor because they offer the lowest price for each product in your order." />
              </div>
              <span className="text-sm font-bold text-[#F0EDE8]">${vs.subtotal.toFixed(2)}</span>
            </div>
            <div className="divide-y divide-[#2A343C]">
              {vs.items.map((item) => {
                const isFlagged = Boolean(item.flag) || Boolean(item.item_note)
                return (
                  <div key={item.product_id} className={isFlagged ? 'bg-[#E07B35]/5' : ''}>
                    <div className="px-4 py-2.5 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm text-[#F0EDE8]">{item.product_name}</span>
                          {item.flag === 'no_par' && (
                            <span className="bg-[#E07B35]/20 text-[#E07B35] text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0">NO PAR</span>
                          )}
                          {item.flag === 'overstock' && (
                            <span className="bg-[#E07B35]/20 text-[#E07B35] text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0">OVERSTOCK</span>
                          )}
                        </div>
                        {item.unit_price != null && item.unit_price > 0 && (
                          <div className="flex items-center gap-2 mt-1">
                            {/* Quantity stepper */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setLocalQtys((p) => ({ ...p, [item.product_id]: Math.max(0, (p[item.product_id] ?? item.quantity ?? 0) - 1) }))}
                                className="w-6 h-6 rounded-full bg-[#222C33] flex items-center justify-center text-[#F0EDE8] font-bold text-sm active:bg-[#2A343C]"
                              >−</button>
                              <span className={`text-base font-bold min-w-[1.5rem] text-center ${localQtys[item.product_id] !== undefined ? 'text-[#00C0C8]' : 'text-[#F0EDE8]'}`}>
                                {localQtys[item.product_id] !== undefined ? localQtys[item.product_id] : item.quantity}
                              </span>
                              <button
                                onClick={() => setLocalQtys((p) => ({ ...p, [item.product_id]: (p[item.product_id] ?? item.quantity ?? 0) + 1 }))}
                                className="w-6 h-6 rounded-full bg-[#222C33] flex items-center justify-center text-[#F0EDE8] font-bold text-sm active:bg-[#2A343C]"
                              >+</button>
                            </div>
                            <span className="text-xs text-[#8A9099]">× ${item.unit_price.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                      {item.line_total != null && item.line_total > 0 && (
                        <span className="text-sm font-medium text-[#F0EDE8] ml-3 flex-shrink-0">
                          ${item.line_total.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {item.item_note && (
                      <div className="px-4 pb-2.5 -mt-1">
                        <p className="text-xs text-[#E07B35] italic">"{item.item_note}"</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* PDF download again (shown after approval) */}
        {approvalDone && pdfDoc && (
          <div className="bg-[#3DAA6E]/10 border border-[#3DAA6E]/20 rounded-2xl p-4 mb-3 text-center">
            <p className="text-sm text-[#3DAA6E] font-semibold mb-2">✓ Order approved — PDF downloaded</p>
            <button
              onClick={handleDownloadAgain}
              className="px-4 py-2 bg-[#00C0C8] text-[#0E1214] rounded-full text-sm font-bold active:bg-[#007F85]"
            >
              Download again
            </button>
          </div>
        )}

        {/* Approve note input */}
        {step === 'approving' && (
          <div className="bg-[#1A2025] rounded-xl shadow-sm p-4 mb-3 border border-[#3DAA6E]/30">
            <p className="text-sm font-semibold text-[#F0EDE8] mb-2">Add a note (optional)</p>
            <textarea
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder="Any notes for the kitchen…"
              rows={3}
              autoFocus
              className="w-full text-sm border border-[#2A343C] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3DAA6E] resize-none bg-[#0E1214] text-[#F0EDE8] placeholder:text-[#8A9099] mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setStep('view'); setApproveNote('') }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-[#2A343C] text-[#F0EDE8] bg-[#222C33] active:bg-[#2A343C]"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={submitting}
                className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                  submitting ? 'bg-[#007F85] text-[#0E1214] cursor-not-allowed' : 'bg-[#00C0C8] text-[#0E1214] active:bg-[#007F85]'
                }`}
              >
                {submitting ? 'Approving…' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        )}

        {/* Reject note input */}
        {step === 'rejecting' && (
          <div className="bg-[#1A2025] rounded-xl shadow-sm p-4 mb-3 border border-[#C23B3B]/30">
            <p className="text-sm font-semibold text-[#F0EDE8] mb-2">Reason for rejection <span className="text-[#8A9099]">(optional)</span></p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Tell the kitchen why this order is being rejected…"
              rows={3}
              autoFocus
              className="w-full text-sm border border-[#2A343C] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C23B3B] resize-none bg-[#0E1214] text-[#F0EDE8] placeholder:text-[#8A9099] mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setStep('view'); setRejectNote('') }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-[#2A343C] text-[#F0EDE8] bg-[#222C33] active:bg-[#2A343C]"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={submitting}
                className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                  submitting ? 'bg-[#C23B3B]/40 cursor-not-allowed text-[#F0EDE8]' : 'bg-[#C23B3B] text-[#F0EDE8] active:opacity-80'
                }`}
              >
                {submitting ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Sticky bottom */}
      {step === 'view' && !approvalDone && (
        <footer className="fixed bottom-0 left-0 right-0 bg-[#1A2025] border-t border-[#2A343C] px-4 py-3 z-50">
          <div className="flex gap-2">
            <button
              onClick={onBack}
              className="py-3 min-h-[44px] px-4 rounded-lg font-semibold text-sm border border-[#2A343C] text-[#F0EDE8] bg-[#222C33] active:opacity-75 transition-colors flex-shrink-0"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep('rejecting')}
              className="flex-1 py-3 min-h-[44px] rounded-lg font-semibold text-sm bg-[#C23B3B]/10 border-2 border-[#C23B3B] text-[#C23B3B] active:bg-[#C23B3B]/20 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={() => setStep('approving')}
              className="flex-1 py-3 min-h-[44px] rounded-full font-bold text-sm bg-[#00C0C8] text-[#0E1214] active:bg-[#007F85] transition-colors"
            >
              Approve
            </button>
          </div>
        </footer>
      )}
    </div>
  )
}
