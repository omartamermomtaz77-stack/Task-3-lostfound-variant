import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'

const defaults = { title: '', description: '', category: 'other', status: 'lost', location: '' }
const statuses = ['lost', 'found', 'claimed']
const categories = ['electronics', 'clothing', 'documents', 'accessories', 'other']

export default function ItemForm() {
  const nav = useNavigate()
  const { id } = useParams()
  const [form, setForm] = useState(defaults)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(id))
  const [saving, setSaving] = useState(false)
  const [loadedId, setLoadedId] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    setForm(defaults)
    setError('')
    setLoadedId(null)
    setLoading(Boolean(id))
    if (!id) return

    api.get(`/items/${id}`, { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return
        const item = data.item
        // Copy only editable fields; never send the populated reporter back.
        setForm({
          title: item.title,
          status: item.status,
          category: item.category,
          location: item.location ?? '',
          description: item.description ?? ''
        })
        setLoadedId(id)
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setError(err?.response?.data?.message || 'Could not load this item. Please try again.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [id])

  function onChange(e) {
    const { name, value } = e.target
    setForm(previous => ({ ...previous, [name]: value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (saving || loading || (id && loadedId !== id)) return
    setError('')
    setSaving(true)
    const { title, status, category, location, description } = form
    const payload = { title, status, category, location, description }
    try {
      if (id) await api.patch(`/items/${id}`, payload)
      else await api.post('/items', payload)
      nav('/items')
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save this item. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto card">
      <h1 className="text-xl font-semibold mb-4">{id ? 'Edit' : 'Report'} Item</h1>
      {loading && <p role="status" className="mb-3 text-sm">Loading item…</p>}
      <form onSubmit={onSubmit} className="space-y-3">
        <fieldset disabled={loading || saving || Boolean(id && loadedId !== id)} className="space-y-3">
          <div>
            <label htmlFor="title" className="block text-sm mb-1">Title</label>
            <input id="title" name="title" className="input" required placeholder="Black backpack" value={form.title} onChange={onChange} />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm mb-1">Status</label>
            <select id="status" name="status" className="input" value={form.status} onChange={onChange}>
              {statuses.map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="category" className="block text-sm mb-1">Category</label>
            <select id="category" name="category" className="input" value={form.category} onChange={onChange}>
              {categories.map(category => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="location" className="block text-sm mb-1">Location (optional)</label>
            <input id="location" name="location" className="input" placeholder="Library 2nd floor" value={form.location} onChange={onChange} />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm mb-1">Description (optional)</label>
            <textarea id="description" name="description" className="input" rows={3} placeholder="Has a laptop sleeve and a blue keychain." value={form.description} onChange={onChange} />
          </div>
          <button className="btn" type="submit">{saving ? 'Saving…' : 'Save'}</button>
        </fieldset>
        {error && <div role="alert" className="text-red-600 text-sm">{error}</div>}
      </form>
    </div>
  )
}
