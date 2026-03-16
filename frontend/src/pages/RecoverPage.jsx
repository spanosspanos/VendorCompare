import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function RecoverPage() {
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [newRecoveryCode, setNewRecoveryCode] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (recoveryCode.length !== 8 || !/^\d{8}$/.test(recoveryCode)) {
      setError('Recovery code must be 8 digits.')
      return
    }
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError('New PIN must be 4 digits.')
      return
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match.')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post('/auth/recover', {
        recovery_code: recoveryCode,
        new_pin: newPin,
      })
      setNewRecoveryCode(res.data.new_recovery_code)
    } catch (err) {
      setError(err.response?.data?.detail || 'Recovery failed. Check your code and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (newRecoveryCode) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-gray-800 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-white text-xl font-bold mb-2">PIN Reset</h1>
          <p className="text-gray-400 text-sm mb-6">All admin PINs have been reset to your new PIN.</p>

          <div className="bg-yellow-900/40 border border-yellow-600 rounded-xl p-4 mb-6">
            <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-1">New Recovery Code</p>
            <p className="text-yellow-300 text-3xl font-mono font-bold tracking-widest">{newRecoveryCode}</p>
            <p className="text-yellow-500 text-xs mt-2">⚠️ Write this down now — it won't be shown again.</p>
          </div>

          <Link
            to="/"
            className="block w-full bg-[#D4A017] text-gray-900 font-semibold py-3 rounded-xl hover:bg-[#E6B51F] transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-gray-800 rounded-2xl p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔑</div>
          <h1 className="text-white text-xl font-bold">Account Recovery</h1>
          <p className="text-gray-400 text-sm mt-1">Use your recovery code to reset admin PINs</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
              Recovery Code (8 digits)
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={recoveryCode}
              onChange={e => setRecoveryCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="12345678"
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 font-mono text-lg tracking-widest placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#D4A017]"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
              New PIN (4 digits)
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 font-mono text-lg tracking-widest placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#D4A017]"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
              Confirm New PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 font-mono text-lg tracking-widest placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#D4A017]"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#D4A017] text-gray-900 font-semibold py-3 rounded-xl hover:bg-[#E6B51F] transition-colors disabled:opacity-50 mt-2"
          >
            {submitting ? 'Resetting…' : 'Reset PIN'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">
            ← Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
