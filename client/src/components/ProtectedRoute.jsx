import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p role="status">Restoring your session…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />
  return children
}
