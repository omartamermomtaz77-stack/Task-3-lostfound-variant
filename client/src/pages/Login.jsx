import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

export default function Login() {
  const { login, user, loading } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const destination = location.state?.from || '/items'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      nav(destination, { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p role="status">Restoring your session…</p>
  if (user) return <Navigate to={destination} replace />

  return (
    <div className="max-w-md mx-auto card">
      <h1 className="text-xl font-semibold mb-4">Login</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor="email" className="block text-sm">Email</label>
        <input id="email" name="email" className="input" type="email" autoComplete="email" required placeholder="you@campus.edu" value={email} onChange={e => setEmail(e.target.value)} disabled={submitting} />
        <label htmlFor="password" className="block text-sm">Password</label>
        <input id="password" name="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={submitting} />
        {error && <div role="alert" className="text-red-600 text-sm">{error}</div>}
        <button className="btn" type="submit" disabled={submitting}>{submitting ? 'Logging in…' : 'Login'}</button>
      </form>
      <p className="mt-4 text-sm">Need an account? <Link className="underline" to="/register" state={{ from: destination }}>Register</Link></p>
    </div>
  )
}
