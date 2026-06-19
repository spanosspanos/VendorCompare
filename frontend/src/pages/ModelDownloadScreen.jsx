import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const MODEL_NAME = 'qwen2.5:7b'

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export default function ModelDownloadScreen() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('checking') // checking | downloading | done | error
  const [statusText, setStatusText] = useState('Checking AI model...')
  const [progressPct, setProgressPct] = useState(0)
  const [bytesDone, setBytesDone] = useState(0)
  const [bytesTotal, setBytesTotal] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const cleanupRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        // Check if model already exists
        const exists = await window.electronAPI.checkModel(MODEL_NAME)
        if (cancelled) return

        if (exists) {
          setPhase('done')
          setStatusText('AI model ready')
          setTimeout(() => navigate('/'), 500)
          return
        }

        // Model not present — start download
        setPhase('downloading')
        setStatusText('Connecting to model server...')

        // Listen for progress events
        const cleanup = window.electronAPI.onPullProgress((progress) => {
          if (cancelled) return

          if (progress.status) {
            setStatusText(progress.status)
          }

          if (progress.completed != null && progress.total != null && progress.total > 0) {
            const pct = Math.round((progress.completed / progress.total) * 100)
            setProgressPct(pct)
            setBytesDone(progress.completed)
            setBytesTotal(progress.total)
          }

          if (progress.status === 'success') {
            setPhase('done')
            setProgressPct(100)
            setStatusText('AI model ready')
            setTimeout(() => navigate('/'), 800)
          }
        })
        cleanupRef.current = cleanup

        // Start the pull (resolves when complete)
        await window.electronAPI.pullModel(MODEL_NAME)

        if (cancelled) return

        // Pull resolved — navigate if not already done via progress event
        setPhase('done')
        setProgressPct(100)
        setStatusText('AI model ready')
        setTimeout(() => navigate('/'), 800)

      } catch (err) {
        if (cancelled) return
        setPhase('error')
        setErrorMsg(err.message || 'Unknown error during model setup')
      }
    }

    run()

    return () => {
      cancelled = true
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [navigate])

  const isDone = phase === 'done'
  const isError = phase === 'error'
  const isChecking = phase === 'checking'

  return (
    <div className="min-h-screen bg-[#0E1214] flex flex-col items-center justify-center px-6">
      {/* Logo / Brand */}
      <div className="mb-10 text-center">
        <div className="text-[#00C0C8] text-4xl font-bold tracking-tight mb-1">VendorCompare</div>
        <div className="text-[#8A9099] text-sm tracking-wide">AI Ordering Assistant</div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-[#1A2025] border border-[#2A343C] rounded-2xl p-8 flex flex-col gap-6">
        {/* Heading */}
        <div className="text-center">
          <h2 className="text-[#F0EDE8] text-lg font-semibold mb-1">
            {isError ? 'Setup Error' : 'Setting up AI assistant'}
          </h2>
          <p className="text-[#8A9099] text-sm">
            {isError
              ? 'Could not download the AI model.'
              : isChecking
                ? 'Checking local AI model...'
                : isDone
                  ? 'Ready to go!'
                  : 'Downloading AI model (one-time, ~4.5 GB)'}
          </p>
        </div>

        {/* Progress bar */}
        {!isError && (
          <div className="flex flex-col gap-2">
            <div className="h-2 bg-[#0E1214] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00C0C8] rounded-full transition-all duration-300"
                style={{ width: `${isDone ? 100 : progressPct}%` }}
              />
            </div>

            {/* Byte counter row */}
            <div className="flex items-center justify-between text-xs text-[#8A9099]">
              <span className="truncate max-w-[70%]">{statusText}</span>
              {bytesTotal > 0 ? (
                <span className="ml-2 shrink-0 tabular-nums">
                  {formatBytes(bytesDone)} / {formatBytes(bytesTotal)}
                </span>
              ) : (
                <span className="ml-2 shrink-0 tabular-nums">
                  {isDone ? '100%' : isChecking ? '' : `${progressPct}%`}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Spinner (checking / downloading with no progress yet) */}
        {(isChecking || (phase === 'downloading' && progressPct === 0)) && !isDone && !isError && (
          <div className="flex justify-center">
            <svg
              className="animate-spin h-6 w-6 text-[#00C0C8]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="flex flex-col gap-3">
            <p className="text-red-400 text-sm text-center">{errorMsg}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-xl bg-[#00C0C8] text-[#0E1214] font-semibold text-sm hover:bg-[#00A8AF] transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Done checkmark */}
        {isDone && (
          <div className="flex justify-center">
            <svg className="h-8 w-8 text-[#00C0C8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Footnote */}
      {phase === 'downloading' && progressPct === 0 && (
        <p className="mt-6 text-[#8A9099] text-xs text-center max-w-xs">
          This is a one-time download. Future launches will start instantly.
        </p>
      )}
    </div>
  )
}
