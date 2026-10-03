import { apiClient } from './api'
import type { GenerationResponse, ManualPromptResponse } from '../types/api'
export const generationApi = {
  generate: (projectId: string, payload: { transcriptId: string; instructions?: string; save?: boolean; provider?: 'gemini' | 'manual'; apiKey?: string; model?: string }) => apiClient.post<GenerationResponse>(`/projects/${projectId}/generate`, payload).then((r) => r.data),
  manualPrompt: (projectId: string, payload: { transcriptId: string; instructions?: string }) => apiClient.post<ManualPromptResponse>(`/projects/${projectId}/generate/manual-prompt`, payload).then((r) => r.data),
  manualSubmit: (projectId: string, payload: { transcriptId: string; rawResponse: string; save?: boolean }) => apiClient.post<GenerationResponse>(`/projects/${projectId}/generate/manual-submit`, payload).then((r) => r.data),
}
