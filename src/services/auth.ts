import { apiClient } from './api'
import type { AuthTokenResponse, User } from '../types/api'
export const authApi = {
  login: (payload: { email: string; password: string }) => apiClient.post<AuthTokenResponse>('/auth/login', payload).then((r) => r.data),
  register: (payload: { name: string; email: string; password: string }) => apiClient.post<AuthTokenResponse>('/auth/register', payload).then((r) => r.data),
  me: () => apiClient.get<{ user: User }>('/auth/me').then((r) => r.data.user),
}
