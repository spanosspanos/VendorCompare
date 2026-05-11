import { useState } from 'react'

export const TOS_VERSION = 'beta-2026-05-11'
export const TOS_KEY = `vendorcompare_terms_${TOS_VERSION}_accepted`
export const APP_VERSION = '1.0.0-john-beta'

function buildAcceptanceRecord() {
  return {
    terms: 'VendorCompare Beta Terms of Use',
    terms_version: TOS_VERSION,
    version: TOS_VERSION,
    accepted_at: new Date().toISOString(),
    app: 'VendorCompare',
    app_version: APP_VERSION,
    platform: typeof navigator !== 'undefined' ? navigator.platform || 'unknown' : 'unknown',
  }
}

export function isTosAccepted() {
  try {
    const record = JSON.parse(localStorage.getItem(TOS_KEY) || 'null')
    return record?.terms_version === TOS_VERSION || record?.version === TOS_VERSION
  } catch {
    return false
  }
}

export async function recordTosAcceptance() {
  const record = buildAcceptanceRecord()

  // localStorage is the synchronous UX gate for this installed local app.
  localStorage.setItem(TOS_KEY, JSON.stringify(record))

  // Electron writes durable local evidence to app.getPath('userData')/tos_acceptance.json.
  // Acceptance must not depend on a remote service for John's local beta install.
  if (typeof window !== 'undefined' && window.electronAPI?.recordTos) {
    try {
      await window.electronAPI.recordTos(record)
    } catch (_) {
      // Keep the app usable if durable logging fails; localStorage still gates UX.
    }
  }

  return record
}

export default function ToSGate({ onAccept }) {
  const [checked, setChecked] = useState(false)
  const [declined, setDeclined] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleAgree() {
    if (!checked || saving) return
    setSaving(true)
    await recordTosAcceptance()
    onAccept()
  }

  if (declined) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-2xl p-10 shadow-2xl max-w-md w-full flex flex-col items-center gap-5 text-center">
          <h1 className="text-white text-xl font-bold">Beta Terms Declined</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            VendorCompare cannot be used unless the VendorCompare Beta Terms of Use are accepted.
          </p>
          <p className="text-gray-500 text-xs">
            You may return to review the terms, or close this window to exit.
          </p>
          <button
            onClick={() => setDeclined(false)}
            className="text-amber-500 text-sm underline hover:text-amber-400"
          >
            Go back and review the Beta Terms
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '92vh' }}>

        <div className="px-8 pt-8 pb-4 border-b border-gray-700 flex-shrink-0">
          <h1 className="text-white text-2xl font-bold tracking-wide">VendorCompare</h1>
          <p className="text-amber-500 text-sm font-medium mt-1">Beta Terms of Use / Beta License</p>
          <p className="text-gray-400 text-xs mt-2">
            Terms version {TOS_VERSION} · App version {APP_VERSION} — Please read before continuing
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 text-gray-300 text-sm leading-relaxed space-y-5 min-h-0">

          <p className="text-gray-400 text-xs italic">
            PLEASE READ THESE BETA TERMS CAREFULLY. BY CHECKING THE ACKNOWLEDGEMENT BOX AND CLICKING “I ACCEPT THE BETA TERMS,” YOU CONFIRM THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO THESE TERMS. IF YOU DO NOT AGREE, CLICK “DECLINE.”
          </p>

          <Section n="1" title="Parties and Beta Purpose">
            VendorCompare is being provided by the Developer to John / Cantina for a single-customer beta installation. VendorCompare is an early beta software tool for restaurant purchasing, vendor comparison, order preparation, price tracking, and related operational workflows.
          </Section>

          <Section n="2" title="License Grant and Internal Use">
            Subject to these Beta Terms, Developer grants Customer a limited, non-exclusive, non-transferable, non-sublicensable license to install and use the provided version of VendorCompare for Customer’s own internal restaurant business operations. VendorCompare may not be resold, sublicensed, hosted for third parties, distributed, or made available as a service to others.
          </Section>

          <Section n="3" title="Perpetual Use of Delivered Version">
            Customer may continue using the specific version of VendorCompare delivered under these Beta Terms, subject to continued compliance. This perpetual license does not include any automatic right to future versions, upgrades, new features, hosting, maintenance, support, source code, or custom development unless separately agreed in writing.
          </Section>

          <Section n="4" title="Developer Ownership">
            Developer retains all right, title, and interest in VendorCompare, including the software, source code, object code, architecture, database structure, designs, workflows, documentation, trade secrets, know-how, copyrights, and all related intellectual property. Customer receives only the license rights expressly granted here and may not reverse engineer, decompile, disassemble, copy, modify, create derivative works from, or attempt to extract VendorCompare source code except where applicable law prohibits that restriction.
          </Section>

          <Section n="5" title="Customer Data">
            Customer owns the business data Customer enters into VendorCompare, including vendor names, product lists, price data, orders, notes, inventory counts, and similar operational records. Developer does not claim ownership of Customer Data and may use it only as reasonably necessary for setup, troubleshooting, support, debugging, import assistance, product improvement, or other services requested by Customer.
          </Section>

          <Section n="6" title="Vendor Files, Imports, and Purchasing Decisions">
            Customer is responsible for confirming imported prices, product matches, vendor assignments, units, order calculations, and vendor submissions before relying on VendorCompare for purchasing decisions. VendorCompare may produce incorrect matches, missed matches, duplicate entries, parsing errors, outdated pricing, or other inaccurate results. VendorCompare is an operational support tool only and does not replace Customer’s independent judgment.
          </Section>

          <Section n="7" title="Feedback">
            Customer may provide feedback, suggestions, bug reports, feature requests, workflow ideas, or other comments. Customer grants Developer a worldwide, perpetual, irrevocable, royalty-free license to use, incorporate, modify, commercialize, and otherwise exploit that feedback in VendorCompare or other products without restriction or compensation, provided Developer does not disclose Customer’s confidential business information except as permitted by these Beta Terms.
          </Section>

          <Section n="8" title="Beta / As-Is Disclaimer">
            <span className="uppercase font-medium">
              VENDORCOMPARE IS PROVIDED ON A BETA, “AS IS,” “AS AVAILABLE,” AND “WITH ALL FAULTS” BASIS. DEVELOPER MAKES NO WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, RELIABILITY, AVAILABILITY, OR ERROR-FREE OPERATION. DEVELOPER DOES NOT GUARANTEE THAT VENDORCOMPARE WILL BE UNINTERRUPTED, SECURE, BUG-FREE, COMPATIBLE WITH ALL DEVICES, OR SUITABLE FOR CUSTOMER’S PURCHASING, ACCOUNTING, COMPLIANCE, OR OPERATIONAL NEEDS.
            </span>
          </Section>

          <Section n="9" title="No Support or Update Obligation">
            Support, maintenance, updates, bug fixes, hosting, training, custom development, or future versions are provided only at Developer’s discretion or under a separate written agreement. Developer may modify, improve, discontinue, or replace beta features at any time.
          </Section>

          <Section n="10" title="Limitation of Liability">
            <span className="uppercase font-medium">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, DEVELOPER WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, LOST BUSINESS, LOST DATA, INCORRECT ORDERS, VENDOR DISPUTES, BUSINESS INTERRUPTION, OR SUBSTITUTE PROCUREMENT COSTS. DEVELOPER’S TOTAL CUMULATIVE LIABILITY ARISING OUT OF OR RELATING TO VENDORCOMPARE OR THESE TERMS WILL NOT EXCEED THE AMOUNTS ACTUALLY PAID BY CUSTOMER TO DEVELOPER FOR VENDORCOMPARE DURING THE THREE MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS GREATER.
            </span>
          </Section>

          <Section n="11" title="Confidentiality, Termination, and Survival">
            Non-public information shared in connection with the beta should be treated as confidential and used only for VendorCompare-related purposes. Either party may terminate beta access or support arrangements by written notice. Ownership, customer data, feedback, warranty disclaimers, limitation of liability, confidentiality, payment, and license restrictions survive termination.
          </Section>

          <Section n="12" title="Governing Law and Entire Agreement">
            These Beta Terms are governed by the laws of the State of New York / TBD, without regard to conflict-of-law principles. These Beta Terms, together with any signed order form, invoice, statement of work, or written addendum, constitute the entire agreement between the parties regarding VendorCompare and supersede prior discussions or understandings on the same subject.
          </Section>

          <p className="text-gray-500 text-xs pt-2 border-t border-gray-700">
            VendorCompare Beta Terms of Use · Terms version {TOS_VERSION} · Local John/Cantina beta install
          </p>
        </div>

        <div className="px-8 py-6 border-t border-gray-700 flex-shrink-0 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-amber-500 cursor-pointer flex-shrink-0"
            />
            <span className="text-gray-300 text-sm leading-snug">
              I acknowledge that I have read and understood the VendorCompare Beta Terms of Use, and I agree that use of VendorCompare requires acceptance of these Beta Terms.
            </span>
          </label>

          <div className="flex gap-3">
            <button
              onClick={handleAgree}
              disabled={!checked || saving}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-bold py-3 rounded-lg transition-colors text-sm"
            >
              {saving ? 'Recording Acceptance…' : 'I Accept the Beta Terms'}
            </button>
            <button
              onClick={() => setDeclined(true)}
              className="px-6 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-3 rounded-lg transition-colors text-sm"
            >
              Decline
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

function Section({ n, title, children }) {
  return (
    <div>
      <p className="text-white font-semibold mb-1">{n}. {title}</p>
      <div className="text-gray-400">{children}</div>
    </div>
  )
}
