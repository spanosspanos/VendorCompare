import { createContext, useContext, useState, useEffect } from 'react'

const ChatContext = createContext(null)

const GREETING = "Hi! What do you need to order today? I can place a quick order or pull up the PAR reorder list."

export function ChatProvider({ children }) {
  // conversationHistory is the full message list sent to the API
  const [conversationHistory, setConversationHistory] = useState([])

  // displayMessages is what's shown in the UI (includes greeting)
  const [displayMessages, setDisplayMessages] = useState([
    { role: 'assistant', content: GREETING, order_data: null }
  ])

  // Load chat history on mount — fires after auth resolves via token in localStorage
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch('/api/chat/history', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.messages?.length) return
        const loaded = data.messages.map(m => ({ role: m.role, content: m.content, order_data: null }))
        setConversationHistory(loaded)
        setDisplayMessages([{ role: 'assistant', content: GREETING, order_data: null }, ...loaded])
      })
      .catch(() => {})
  }, [])

  // Last assembled order data + draft token
  const [orderData, setOrderData] = useState(null)
  const [draftId, setDraftId] = useState(null)

  const addMessage = (role, content, order_data = null, isError = false, confirmation_receipt = null) => {
    const message = { role, content, order_data, isError, confirmation_receipt }

    // Add to conversation history (without UI metadata)
    if (role !== 'assistant' || !isError) {
      setConversationHistory(prev => [
        ...prev,
        { role, content, draft_id: draftId }
      ])
    }

    // Add to display messages (with UI metadata)
    setDisplayMessages(prev => [...prev, message])

    // Track orderData if present
    if (order_data) {
      setOrderData(order_data)
      if (order_data.draft_id) setDraftId(order_data.draft_id)
    }
    if (confirmation_receipt) {
      setDraftId(null)
    }
  }

  const clearDraft = () => {
    setOrderData(null)
    setDraftId(null)
  }

  const clearMessages = () => {
    setConversationHistory([])
    setDisplayMessages([
      { role: 'assistant', content: GREETING, order_data: null }
    ])
    setOrderData(null)
    setDraftId(null)
  }

  const getConversationHistory = () => conversationHistory

  return (
    <ChatContext.Provider value={{
      conversationHistory,
      displayMessages,
      orderData,
      draftId,
      addMessage,
      clearDraft,
      clearMessages,
      setConversationHistory,
      setDisplayMessages,
      setOrderData,
      setDraftId,
      getConversationHistory,
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export const useChat = () => {
  const ctx = useContext(ChatContext)
  if (!ctx) {
    throw new Error('useChat must be used within ChatProvider')
  }
  return ctx
}
