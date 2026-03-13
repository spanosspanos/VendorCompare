import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { loginUser, getMe } from '../api'

const AuthContext = createContext(null)

const IDLE_TIMEOUT = 20 * 60 * 1000 // 20 minutes

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('vc_token'))
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const idleTimer = useRef(null)

  const logout = useCallback(() => {
    setToken(null)
    setRole(null)
    localStorage.removeItem('vc_token')
    if (idleTimer.current) clearTimeout(idleTimer.current)
  }, [])

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(logout, IDLE_TIMEOUT)
  }, [logout])

  // Validate token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('vc_token')
    if (storedToken) {
      getMe(storedToken)
        .then(res => {
          setRole(res.data.role)
          setToken(storedToken)
        })
        .catch(() => {
          localStorage.removeItem('vc_token')
          setToken(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  // Idle timeout + visibility change when authenticated
  useEffect(() => {
    if (!token) return

    const ACTIVITY_EVENTS = ['click', 'keypress', 'scroll', 'mousemove', 'touchstart']
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetIdleTimer))
    resetIdleTimer()

    const handleVisibility = () => {
      if (document.hidden) logout()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetIdleTimer))
      document.removeEventListener('visibilitychange', handleVisibility)
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [token, logout, resetIdleTimer])

  const login = async (pin) => {
    const res = await loginUser(pin)
    const { token: newToken, role: newRole } = res.data
    setToken(newToken)
    setRole(newRole)
    localStorage.setItem('vc_token', newToken)
    resetIdleTimer()
  }

  return (
    <AuthContext.Provider value={{ token, role, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
