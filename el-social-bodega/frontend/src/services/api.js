import axios from 'axios'
import { supabase } from './supabase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Prevent requests from hanging indefinitely when the backend is unreachable.
  // 10 s is enough for local dev; cloud deployments should respond well within that.
  timeout: 10000,
})

// Request interceptor: Add auth token to all requests
api.interceptors.request.use(
  async (config) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
      } else {
        // If no session, remove any existing auth header
        delete config.headers.Authorization
      }
    } catch (error) {
      console.error('Error getting session in request interceptor:', error)
      delete config.headers.Authorization
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor: Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Clear session and redirect to login
      try {
        await supabase.auth.signOut()
        // Only redirect if we're not already on the login page
        if (window.location.pathname !== '/iniciar-sesion') {
          window.location.href = '/iniciar-sesion'
        }
      } catch (signOutError) {
        console.error('Error signing out:', signOutError)
      }
    }
    return Promise.reject(error)
  }
)

export default api
