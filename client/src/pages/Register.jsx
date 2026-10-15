import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

export default function Register() {
  const { register, user, loading } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const destination = location.state?.from || '/items'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      await register(name.trim(), email.trim(), password)
      nav(destination, { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message || 'Register failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p role="status">Restoring your session…</p>
  if (user) return <Navigate to={destination} replace />

  return (
    <div className="max-w-md mx-auto card">
      <h1 className="text-xl font-semibold mb-4">Register</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor="name" className="block text-sm">Name</label>
        <input id="name" name="name" className="input" autoComplete="name" required minLength={2} maxLength={60} value={name} onChange={e => setName(e.target.value)} disabled={submitting} />
        <label htmlFor="email" className="block text-sm">Email</label>
        <input id="email" name="email" className="input" type="email" autoComplete="email" required placeholder="you@campus.edu" value={email} onChange={e => setEmail(e.target.value)} disabled={submitting} />
        <label htmlFor="password" className="block text-sm">Password (at least 6 characters)</label>
        <input id="password" name="password" className="input" type="password" autoComplete="new-password" required minLength={6} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} disabled={submitting} />
        <label htmlFor="confirmPassword" className="block text-sm">Confirm password</label>
        <input id="confirmPassword" name="confirmPassword" className="input" type="password" autoComplete="new-password" required minLength={6} maxLength={72} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={submitting} />
        {error && <div role="alert" className="text-red-600 text-sm">{error}</div>}
        <button className="btn" type="submit" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="mt-4 text-sm">Already registered? <Link className="underline" to="/login" state={{ from: destination }}>Login</Link></p>
    </div>
  )
}
