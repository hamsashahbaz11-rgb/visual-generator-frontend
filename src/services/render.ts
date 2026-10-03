import { apiClient } from './api'
import type { Render } from '../types/api'
export const renderApi = {
  create: (projectId: string) => apiClient.post<Render>(`/projects/${projectId}/renders`).then((r) => r.data),
  list: (projectId: string) => apiClient.get<{ items: Render[] }>(`/projects/${projectId}/renders`).then((r) => r.data.items),
  get: (id: string) => apiClient.get<Render>(`/renders/${id}`).then((r) => r.data),
  download: async (id: string) => { const response = await apiClient.get<Blob>(`/renders/${id}/file`, { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${id}.mp4`; anchor.click(); URL.revokeObjectURL(url) },
}
