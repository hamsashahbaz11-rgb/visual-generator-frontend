import { apiClient } from './api'
import type { Asset, AssetKind } from '../types/api'
export const assetsApi = {
  list: (projectId: string, kind?: AssetKind) => apiClient.get<{ items: Asset[] }>('/assets', { params: { projectId, kind } }).then((r) => r.data.items),
  upload: (file: File, kind: AssetKind, projectId: string, onUploadProgress?: (progress: number) => void) => { const data = new FormData(); data.append('kind', kind); data.append('projectId', projectId); data.append('file', file, file.name); return apiClient.post<Asset>('/assets', data, { onUploadProgress: (event) => { if (event.total) onUploadProgress?.(Math.round((event.loaded / event.total) * 100)) } }).then((r) => r.data) },
  remove: (id: string, projectId?: string) => apiClient.delete(`/assets/${id}`, { params: projectId ? { projectId } : undefined }),
  shareUrl: (id: string) => apiClient.post<{ url: string; expiresAt: string }>(`/assets/${id}/share-url`).then((r) => r.data),
  fileUrl: (id: string, projectId?: string) => `${apiClient.defaults.baseURL}/assets/${id}/file${projectId ? `?projectId=${projectId}` : ''}`,
}
