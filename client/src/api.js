import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000
})

// Expired/deleted-account sessions must also clear the logged-in UI.
api.interceptors.response.use(response => response, error => {
  const token = localStorage.getItem('token')
  if (error.response?.status === 401 && token &&
      error.config?.headers?.Authorization === `Bearer ${token}`) {
    localStorage.removeItem('token')
    window.dispatchEvent(new Event('auth:unauthorized'))
  }
  return Promise.reject(error)
})

// Attach token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
