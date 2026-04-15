import axios from 'axios'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: '/caltims/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
})

// ─── Request Interceptor: Attach access token ─────────────────────────────────
api.interceptors.request.use(
  (config) => {
    let token = useAuthStore.getState().accessToken

    // Fallback: check localStorage directly if store is out of sync
    if (!token) {
      try {
        const authData = JSON.parse(localStorage.getItem('timesheet-auth'))
        token = authData?.state?.accessToken
      } catch (e) {
        console.error('Failed to parse auth storage', e)
      }
    }

    // Skip warning for public routes
    const publicRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/health', '/auth/send-verification-otp', '/auth/verify-verification-otp'];
    const isPublic = publicRoutes.some(route => config.url?.includes(route));

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    } else if (!isPublic) {
      console.warn(`No auth token found for protected request: ${config.url}`)
    }
    
    return config
  },
  (error) => Promise.reject(error)
)

// ─── Response Interceptor: Refresh token on 401 ───────────────────────────────
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve(token)))
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { refreshToken } = useAuthStore.getState()
        if (!refreshToken) throw new Error('No refresh token')

        const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken })
        const { accessToken, refreshToken: newRefreshToken } = data.data
        useAuthStore.getState().setAccessToken(accessToken)
        if (newRefreshToken) useAuthStore.getState().setRefreshToken(newRefreshToken)
        processQueue(null, accessToken)
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (err) {
        processQueue(err, null)
        
        // --- Loop Prevention Fix ---
        // 1. Clear state locally FIRST
        useAuthStore.getState().logout()
        localStorage.removeItem('timesheet-auth') // Explicit clear for persistence

        // 2. Only redirect if NOT already at /login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    // Show toast for non-401 errors
    const message = error.response?.data?.message || 'Something went wrong'
    const skipToast = error.config?.skipToast
    
    if (error.response?.status !== 401 && !skipToast) {
      toast.error(message, { id: message })
    }

    return Promise.reject(error)
  }
)

export default api
