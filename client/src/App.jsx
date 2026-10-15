import { Routes, Route, Link, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Items from './pages/Items.jsx'
import ItemForm from './pages/ItemForm.jsx'
import { useAuth } from './hooks/useAuth.js'
import ProtectedRoute from './components/ProtectedRoute.jsx'

export default function App() {
  const { user, logout } = useAuth()
  return (
    <div className="container">
      <nav className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="font-semibold">Campus Lost & Found</Link>
          <Link to="/items" className="text-sm">Items</Link>
          {user && <Link to="/items/new" className="text-sm">Report Item</Link>}
        </div>
        <div className="flex items-center gap-2">
          {!user ? (
            <>
              <Link to="/login" className="btn">Login</Link>
              <Link to="/register" className="btn">Register</Link>
            </>
          ) : (
            <>
              <span className="text-sm">Logged in as <b>{user.name}</b></span>
              <button onClick={logout} className="btn">Logout</button>
            </>
          )}
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/items" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/items" element={<Items />} />
        <Route path="/items/new" element={
          <ProtectedRoute><ItemForm /></ProtectedRoute>
        } />
        <Route path="/items/:id" element={
          <ProtectedRoute><ItemForm /></ProtectedRoute>
        } />
        <Route path="*" element={<div>Not Found</div>} />
      </Routes>
    </div>
  )
}
