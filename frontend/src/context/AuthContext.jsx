import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { loginUser, getMe } from '../api'
import axios from 'axios'

const AuthContext = createContext(null)

const IDLE_TIMEOUT = 20 * 60 * 1000 // 20 minutes

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('vc_token'))
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deviceRecognized, setDeviceRecognized] = useState(false)
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

  // Check device recognition + validate token on mount
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE || '/api'
    const checkDevice = axios.get(`${apiBase}/auth/check-device`, { withCredentials: true })
      .then(res => setDeviceRecognized(res.data.recognized === true))
      .catch(() => setDeviceRecognized(false))

    const storedToken = localStorage.getItem('vc_token')
    if (storedToken) {
      Promise.all([
        checkDevice,
        getMe(storedToken)
          .then(res => {
            setRole(res.data.role)
            setToken(storedToken)
          })
          .catch(() => {
            localStorage.removeItem('vc_token')
            setToken(null)
          }),
      ]).finally(() => setLoading(false))
    } else {
      checkDevice.finally(() => setLoading(false))
    }
  }, [])

  // Idle timeout + visibility change when authenticated
  useEffect(() => {
    if (!token) return

    const ACTIVITY_EVENTS = ['click', 'keypress', 'scroll', 'mousemove', 'touchstart']
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetIdleTimer))
    resetIdleTimer()

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetIdleTimer))
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
    <AuthContext.Provider value={{ token, role, login, logout, loading, deviceRecognized }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
