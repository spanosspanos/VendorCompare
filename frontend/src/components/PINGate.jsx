import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function PINGate() {
  const { login } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!pin || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await login(pin)
    } catch {
      setError('Invalid PIN. Please try again.')
      setPin('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 rounded-2xl p-10 shadow-2xl w-80 flex flex-col items-center gap-6">
        <h1 className="text-white text-2xl font-bold tracking-wide">VendorCompare</h1>
        <p className="text-gray-400 text-sm">Enter your PIN to continue</p>
        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-4">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-gray-700 text-white text-center text-2xl tracking-[0.5em] rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 border border-gray-600"
            placeholder="●●●●●●"
            autoComplete="off"
            disabled={submitting}
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={!pin || submitting}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-gray-900 font-bold py-3 rounded-lg transition-colors"
          >
            {submitting ? 'Checking...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
