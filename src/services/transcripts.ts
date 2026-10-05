import { apiClient } from './api'
import type { Transcript } from '../types/api'

export const transcriptsApi = {
  listForAsset: (assetId: string, projectId?: string) => apiClient.get<{ items: Transcript[] }>(`/assets/${assetId}/transcripts`, { params: projectId ? { projectId } : undefined }).then((response) => response.data.items),
  get: (id: string, projectId?: string) => apiClient.get<Transcript>(`/transcripts/${id}`, { params: projectId ? { projectId } : undefined }).then((response) => response.data),
  transcribe: (assetId: string, language?: string, projectId?: string) => apiClient.post<Transcript>(`/assets/${assetId}/transcribe`, language ? { language } : {}, { params: projectId ? { projectId } : undefined }).then((response) => response.data),
  import: (assetId: string, transcript: unknown, projectId?: string) => apiClient.post<Transcript>(`/assets/${assetId}/transcripts/import`, { transcript }, { params: projectId ? { projectId } : undefined }).then((response) => response.data),
}
