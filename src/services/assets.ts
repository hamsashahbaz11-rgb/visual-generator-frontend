import { apiClient } from './api'
import type { Asset, AssetKind } from '../types/api'
export const assetsApi = {
  list: (kind?: AssetKind) => apiClient.get<{ items: Asset[] }>('/assets', { params: { kind } }).then((r) => r.data.items),
  upload: (file: File, kind: AssetKind, onUploadProgress?: (progress: number) => void) => { const data = new FormData(); data.append('kind', kind); data.append('file', file, file.name); return apiClient.post<Asset>('/assets', data, { onUploadProgress: (event) => { if (event.total) onUploadProgress?.(Math.round((event.loaded / event.total) * 100)) } }).then((r) => r.data) },
  remove: (id: string) => apiClient.delete(`/assets/${id}`),
  shareUrl: (id: string) => apiClient.post<{ url: string; expiresAt: string }>(`/assets/${id}/share-url`).then((r) => r.data),
  fileUrl: (id: string) => `${apiClient.defaults.baseURL}/assets/${id}/file`,
}
