import axios from 'axios'
import { API_BASE_URL } from '../utils/constants'
import { useAuthStore } from '../store/authStore'
import type { ApiErrorPayload, Issue } from '../types/api'

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

export interface StructuredApiError {
  code: string
  message: string
  details: unknown[]
  issues: Issue[]
}

export const parseApiError = (error: unknown): StructuredApiError => {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as ApiErrorPayload | undefined
    const err = payload?.error
    if (err) {
      return {
        code: err.code ?? 'UNKNOWN_ERROR',
        message: err.message ?? 'An error occurred',
        details: Array.isArray(err.details) ? err.details : [],
        issues: Array.isArray(err.details) && err.details.every((d): d is Issue => typeof d === 'object' && d !== null && 'path' in d && 'code' in d && 'message' in d)
          ? err.details
          : [],
      }
    }
    return {
      code: 'REQUEST_FAILED',
      message: error.message,
      details: [],
      issues: [],
    }
  }
  if (error instanceof Error) {
    return { code: 'CLIENT_ERROR', message: error.message, details: [], issues: [] }
  }
  return { code: 'UNKNOWN_ERROR', message: 'Something went wrong', details: [], issues: [] }
}

export const getApiError = (error: unknown, fallback = 'Something went wrong') => {
  return parseApiError(error).message ?? fallback
}
