import { apiClient } from './api'
import type {
  ComponentInstance,
  CreateGroupInput,
  CreateInstanceInput,
  DocumentGroup,
  SceneDocument,
  SceneSummary,
} from '../types/api'

export const scenesApi = {
  list: (projectId: string) =>
    apiClient.get<{ items: SceneSummary[] }>(`/projects/${projectId}/scenes`).then((r) => r.data.items),

  create: (projectId: string, data: { name: string; description?: string | null; duration?: number | null; meta?: Record<string, unknown> | null }) =>
    apiClient.post<SceneSummary>(`/projects/${projectId}/scenes`, data).then((r) => r.data),

  get: (sceneId: string) =>
    apiClient.get<SceneSummary>(`/scenes/${sceneId}`).then((r) => r.data),

  getDocument: (sceneId: string) =>
    apiClient.get<SceneDocument>(`/scenes/${sceneId}/document`).then((r) => r.data),

  update: (sceneId: string, data: Partial<Pick<SceneSummary, 'name' | 'description' | 'duration' | 'meta'>>) =>
    apiClient.patch<SceneSummary>(`/scenes/${sceneId}`, data).then((r) => r.data),

  remove: (sceneId: string) => apiClient.delete(`/scenes/${sceneId}`),

  // Component definitions (available = public + own private)
  listAvailableComponents: (params?: { query?: string; filter?: 'all' | 'mine' | 'public' | 'project'; projectId?: string }) =>
    import('./components').then((m) => m.componentsApi.search(params)),

  // Component instances
  listInstances: (sceneId: string) =>
    apiClient.get<{ items: ComponentInstance[] }>(`/scenes/${sceneId}/instances`).then((r) => r.data.items),

  getInstance: (instanceId: string) =>
    apiClient.get<ComponentInstance>(`/instances/${instanceId}`).then((r) => r.data),

  createInstance: (sceneId: string, data: CreateInstanceInput) =>
    apiClient.post<ComponentInstance>(`/scenes/${sceneId}/instances`, data).then((r) => r.data),

  updateInstance: (instanceId: string, data: Partial<CreateInstanceInput>) =>
    apiClient.patch<ComponentInstance>(`/instances/${instanceId}`, data).then((r) => r.data),

  deleteInstance: (instanceId: string) => apiClient.delete(`/instances/${instanceId}`),

  moveInstance: (instanceId: string, position: { x: number; y: number }) =>
    apiClient.patch<ComponentInstance>(`/instances/${instanceId}`, { position }).then((r) => r.data),

  resizeInstance: (instanceId: string, size: { width: number; height: number }) =>
    apiClient.patch<ComponentInstance>(`/instances/${instanceId}`, { size }).then((r) => r.data),

  updateInstanceProps: (instanceId: string, props: Record<string, unknown>) =>
    apiClient.patch<ComponentInstance>(`/instances/${instanceId}`, { props }).then((r) => r.data),

  updateInstanceStyle: (instanceId: string, style: Record<string, unknown>) =>
    apiClient.patch<ComponentInstance>(`/instances/${instanceId}`, { style }).then((r) => r.data),

  setInstanceVisibility: (instanceId: string, visible: boolean) =>
    apiClient.patch<ComponentInstance>(`/instances/${instanceId}`, { visible }).then((r) => r.data),

  // Groups
  listGroups: (sceneId: string) =>
    apiClient.get<{ items: DocumentGroup[] }>(`/scenes/${sceneId}/groups`).then((r) => r.data.items),

  createGroup: (sceneId: string, data: CreateGroupInput) =>
    apiClient.post<DocumentGroup>(`/scenes/${sceneId}/groups`, data).then((r) => r.data),

  updateGroup: (groupId: string, data: Partial<CreateGroupInput>) =>
    apiClient.patch<DocumentGroup>(`/groups/${groupId}`, data).then((r) => r.data),

  deleteGroup: (groupId: string) => apiClient.delete(`/groups/${groupId}`),

  addInstanceToGroup: (groupId: string, instanceId: string) =>
    apiClient.post<ComponentInstance>(`/groups/${groupId}/members/${instanceId}`).then((r) => r.data),

  removeInstanceFromGroup: (groupId: string, instanceId: string) =>
    apiClient.delete<ComponentInstance>(`/groups/${groupId}/members/${instanceId}`).then((r) => r.data),
}
