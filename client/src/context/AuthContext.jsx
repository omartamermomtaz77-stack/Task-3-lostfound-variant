import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Bootstrap user from token on first load
  useEffect(() => {
    const controller = new AbortController()
    const clearSession = () => {
      setUser(null)
      setLoading(false)
    }
    window.addEventListener('auth:unauthorized', clearSession)
    const token = localStorage.getItem('token')
    if (!token) setLoading(false)
    else {
      api.get('/auth/me', { signal: controller.signal })
        .then(res => {
          if (!controller.signal.aborted && localStorage.getItem('token') === token) {
            setUser(res.data.user || null)
          }
        })
        .catch(() => {
          if (!controller.signal.aborted && localStorage.getItem('token') === token) setUser(null)
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }
    return () => {
      controller.abort()
      window.removeEventListener('auth:unauthorized', clearSession)
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', res.data.token)
    setUser(res.data.user)
  }, [])

  const register = useCallback(async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password })
    localStorage.setItem('token', res.data.token)
    setUser(res.data.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setUser(null)
  }, [])


  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
