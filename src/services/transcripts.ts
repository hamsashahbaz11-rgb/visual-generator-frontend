import { apiClient } from './api'
import type { Transcript } from '../types/api'

export const transcriptsApi = {
  listForAsset: (assetId: string) => apiClient.get<{ items: Transcript[] }>(`/assets/${assetId}/transcripts`).then((response) => response.data.items),
  get: (id: string) => apiClient.get<Transcript>(`/transcripts/${id}`).then((response) => response.data),
  transcribe: (assetId: string, language?: string) => apiClient.post<Transcript>(`/assets/${assetId}/transcribe`, language ? { language } : {}).then((response) => response.data),
  import: (assetId: string, transcript: unknown) => apiClient.post<Transcript>(`/assets/${assetId}/transcripts/import`, { transcript }).then((response) => response.data),
}
