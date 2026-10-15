import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../hooks/useAuth'

const CATEGORIES = ['electronics', 'clothing', 'documents', 'accessories', 'other']
const STATUSES = ['lost', 'found', 'claimed']

export default function Items() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    api.get('/items', {
      params: { status: status || undefined, category: category || undefined },
      signal: controller.signal
    })
      .then(res => {
        if (!controller.signal.aborted) setItems(res.data.items)
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setItems([])
          setError(err?.response?.data?.message || 'Could not load items. Please try again.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [status, category])

  async function onDelete(id) {
    if (deletingId) return
    setError('')
    setDeletingId(id)
    try {
      await api.delete('/items/' + id)
      setItems(prev => prev.filter(i => i._id !== id))
    } catch (err) {
      setError(err?.response?.data?.message || 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-2">
        <select aria-label="Filter by status" className="input" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select aria-label="Filter by category" className="input" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {error && <div role="alert" className="text-red-600 text-sm">{error}</div>}
      {loading && <p role="status" className="text-sm">Loading items…</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!loading && items.map(i => {
          const isMine = user && i.reportedBy?._id === user.id
          return (
            <div key={i._id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{i.title}</div>
                  <div className="text-sm text-zinc-600">
                    {i.status} • {i.category}{i.location && <> • {i.location}</>} • by {i.reportedBy?.name || 'unknown'}
                  </div>
                </div>
                {isMine && (
                  <div className="flex gap-2">
                    <Link to={`/items/${i._id}`} className="btn text-sm">Edit</Link>
                    <button onClick={() => onDelete(i._id)} disabled={Boolean(deletingId)} className="btn text-sm">{deletingId === i._id ? 'Deleting…' : 'Delete'}</button>
                  </div>
                )}
              </div>
              {i.description && <p className="mt-2 text-sm">{i.description}</p>}
            </div>
          )
        })}
        {!loading && !error && items.length === 0 && <div className="text-sm text-zinc-600">No items found.</div>}
      </div>
    </div>
  )
}
