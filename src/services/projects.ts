import { apiClient } from './api'
import type { Project, ProjectSummary, ValidationResult } from '../types/api'
export const projectsApi = {
  list: () => apiClient.get<{ items: ProjectSummary[] }>('/projects').then((r) => r.data.items),
  get: (id: string) => apiClient.get<Project>(`/projects/${id}`).then((r) => r.data),
  create: (name: string, spec?: Record<string, unknown>) => apiClient.post<Project>('/projects', { name, spec }).then((r) => r.data),
  update: (id: string, data: Partial<Pick<Project, 'name' | 'spec'>>) => apiClient.put<Project>(`/projects/${id}`, data).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/projects/${id}`),
  validate: (id: string, spec: Record<string, unknown>) => apiClient.post<ValidationResult>(`/projects/${id}/validate`, { spec }).then((r) => r.data),
  updateSettings: (id: string, maxComponents: number | null) => apiClient.patch<Project>(`/projects/${id}/settings`, { maxComponents }).then((r) => r.data),
}
