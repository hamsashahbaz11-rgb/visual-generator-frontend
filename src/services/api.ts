import axios from 'axios'
import { API_BASE_URL } from '../utils/constants'
import { useAuthStore } from '../store/authStore'

export const apiClient = axios.create({ baseURL: API_BASE_URL })
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
apiClient.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401) useAuthStore.getState().logout()
  return Promise.reject(error)
})

export const getApiError = (error: unknown, fallback = 'Something went wrong') => {
  if (axios.isAxiosError(error)) return error.response?.data?.error?.message ?? error.message
  return fallback
}
