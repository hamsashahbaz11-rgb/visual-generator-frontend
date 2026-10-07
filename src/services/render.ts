import { apiClient } from './api'
import type { Render, RenderStatusPayload } from '../types/api'
export const renderApi = {
  create: (projectId: string) => apiClient.post<Render>(`/projects/${projectId}/renders`).then((r) => r.data),
  list: (projectId: string) => apiClient.get<{ items: Render[] }>(`/projects/${projectId}/renders`).then((r) => r.data.items),
  get: (id: string) => apiClient.get<Render>(`/renders/${id}`).then((r) => r.data),
  download: async (id: string) => { const response = await apiClient.get<Blob>(`/renders/${id}/file`, { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${id}.mp4`; anchor.click(); URL.revokeObjectURL(url) },
  previewUrl: async (id: string) => { const response = await apiClient.get<Blob>(`/renders/${id}/file`, { responseType: 'blob' }); return URL.createObjectURL(response.data) },
  createSceneRender: (sceneId: string, clientKey?: string) => apiClient.post<Render>(`/scenes/${sceneId}/renders`, clientKey ? { clientKey } : {}).then((r) => r.data),
  listSceneRenders: (sceneId: string) => apiClient.get<{ items: Render[] }>(`/scenes/${sceneId}/renders`).then((r) => r.data.items),
  getStatus: (id: string) => apiClient.get<RenderStatusPayload>(`/renders/${id}/status`).then((r) => r.data),
  cancel: (id: string) => apiClient.post<Render>(`/renders/${id}/cancel`).then((r) => r.data),
}
