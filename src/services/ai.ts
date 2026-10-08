import { apiClient } from './api'
import type { AIApplyResponse, AIExecuteResponse, AIPlanResponse, AIScenePlan } from '../types/api'

// Scene AI endpoints (Stage 4A + 4B). The plan endpoint never mutates; the
// apply endpoint sends a previously previewed plan back for server-side
// re-validation before the domain mutations run; the execute endpoint runs
// the server-side bounded agent (inspect → plan → validate → apply →
// verify) with application-owned budgets and returns an explicit status.
export const aiApi = {
  plan: (sceneId: string, prompt: string, selection?: { instanceIds?: string[] }) =>
    apiClient
      .post<AIPlanResponse>(`/scenes/${sceneId}/ai/plan`, {
        prompt,
        ...(selection ? { selection } : {}),
      })
      .then((r) => r.data),

  apply: (sceneId: string, plan: AIScenePlan) =>
    apiClient
      .post<AIApplyResponse>(`/scenes/${sceneId}/ai/apply`, { plan })
      .then((r) => r.data),

  execute: (sceneId: string, prompt: string, selection?: { instanceIds?: string[] }) =>
    apiClient
      .post<AIExecuteResponse>(`/scenes/${sceneId}/ai/execute`, {
        prompt,
        ...(selection ? { selection } : {}),
      })
      .then((r) => r.data),
}
