import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import OrderConfirmCard from '../components/OrderConfirmCard'
import { sendChat } from '../api'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'

export default function ChatPage() {
  const { token } = useAuth()
  const {
    conversationHistory,
    setConversationHistory,
    displayMessages,
    setDisplayMessages,
    addMessage,
    draftId,
  } = useChat()
  const navigate = useNavigate()
  const location = useLocation()
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayMessages, loading])

  const handleSend = async (overrideText) => {
    const text = (overrideText !== undefined ? overrideText : inputValue).trim()
    if (!text || loading) return

    setInputValue('')
    setError(null)

    const userMessage = { role: 'user', content: text }
    const newHistory = [...conversationHistory, userMessage]
    setConversationHistory(newHistory)
    addMessage('user', text)
    setLoading(true)

    try {
      const res = await sendChat(newHistory, token, draftId)
      const { reply, order_data, confirmation_receipt } = res.data
      const assistantMessage = { role: 'assistant', content: reply }
      setConversationHistory(prev => [...prev, assistantMessage])
      addMessage('assistant', reply, order_data || null, false, confirmation_receipt || null)
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Something went wrong. Please try again.'
      setError(errMsg)
      addMessage('assistant', `Error: ${errMsg}`, null, true)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    handleSend('Confirm')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const modeToggle = (
    <button
      onClick={() => navigate('/manual')}
      className="px-2.5 py-1 rounded-lg border border-[#2A343C] text-xs font-semibold text-[#8A9099] hover:text-[#F0EDE8] hover:border-[#3A444C] transition-colors"
      aria-label="Switch to Manual Mode"
    >
      Manual Mode
    </button>
  )

  return (
    <div className="flex flex-col h-screen bg-[#0E1214]">
      <PageHeader title="Cantina Orders" showBack={false} rightContent={modeToggle} />

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 pt-[72px] pb-4 space-y-3">
        {displayMessages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#00C0C8] text-[#0E1214] rounded-br-sm font-medium'
                  : msg.isError
                    ? 'bg-red-900/30 text-red-300 border border-red-800/40 rounded-bl-sm'
                    : 'bg-[#1A2025] text-[#F0EDE8] border border-[#2A343C] rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>

            {/* Verified receipt rendered verbatim when save_order readback passes */}
            {msg.role === 'assistant' && msg.confirmation_receipt && (
              <div className="mt-2 w-full max-w-sm bg-emerald-950/30 border border-emerald-700/50 rounded-2xl px-4 py-3 text-sm text-emerald-100">
                <div className="font-bold text-emerald-300 mb-2">Order #{msg.confirmation_receipt.order_id} saved</div>
                <div>Status: {msg.confirmation_receipt.status} / {msg.confirmation_receipt.review_status}</div>
                <div>Total: ${msg.confirmation_receipt.total_cost.toFixed(2)} · Items: {msg.confirmation_receipt.item_count}</div>
                <div>Savings vs worst: ${msg.confirmation_receipt.savings_vs_worst.toFixed(2)}</div>
                <div className="mt-2 space-y-1">
                  {msg.confirmation_receipt.vendor_splits.map((split, i) => (
                    <div key={i} className="flex justify-between gap-3">
                      <span>{split.vendor}</span>
                      <span>${split.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-emerald-200/70">{msg.confirmation_receipt.created_at}</div>
              </div>
            )}

            {/* OrderConfirmCard rendered below assistant message when order_data present */}
            {msg.role === 'assistant' && msg.order_data && (
              <div className="mt-2 w-full max-w-sm">
                <OrderConfirmCard
                  orderData={msg.order_data}
                  onConfirm={handleConfirm}
                />
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-start">
            <div className="bg-[#1A2025] border border-[#2A343C] rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#8A9099] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#8A9099] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#8A9099] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-[#2A343C] bg-[#0E1214] px-4 py-3">
        <div className="flex items-end gap-2 max-w-lg mx-auto">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What do you need to order?"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none bg-[#1A2025] border border-[#2A343C] rounded-xl px-4 py-2.5 text-sm text-[#F0EDE8] placeholder-[#8A9099] focus:outline-none focus:border-[#00C0C8]/50 transition-colors disabled:opacity-50"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !inputValue.trim()}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#00C0C8] text-[#0E1214] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#00A8AF] active:bg-[#008F96] transition-colors"
            aria-label="Send message"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
