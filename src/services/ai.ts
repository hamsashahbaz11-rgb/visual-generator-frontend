import { apiClient } from './api'
import type { AIApplyResponse, AIPlanResponse, AIScenePlan } from '../types/api'

// Scene AI endpoints (Stage 4A). The plan endpoint never mutates; the apply
// endpoint sends a previously previewed plan back for server-side
// re-validation before the domain mutations run.
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
}
