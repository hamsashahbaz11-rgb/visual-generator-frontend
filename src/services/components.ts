import { apiClient } from './api'
import type { Component } from '../types/api'

type ComponentInput = Omit<Component, 'id' | 'matchedField' | 'createdAt' | 'updatedAt'>

export const componentsApi = {
  search: (params?: { query?: string; filter?: 'all' | 'mine' | 'public' | 'project'; projectId?: string }) =>
    apiClient.get<{ items: Component[] }>('/components', { params }).then((response) => response.data.items),

  get: (id: string) =>
    apiClient.get<Component>(`/components/${id}`).then((response) => response.data),

  create: (data: ComponentInput) =>
    apiClient.post<Component>('/components', data).then((response) => response.data),

  update: (id: string, data: Partial<ComponentInput>) =>
    apiClient.put<Component>(`/components/${id}`, data).then((response) => response.data),

  delete: (id: string) =>
    apiClient.delete(`/components/${id}`).then((response) => response.data),

  validateJson: (jsonString: string): { valid: boolean; component?: Component; errors?: string[] } => {
    try {
      const parsed = JSON.parse(jsonString)
      const requiredFields = ['name', 'displayName', 'description', 'propsSchema', 'defaultProps', 'enterStyles', 'exitStyles', 'colorProps', 'refProps', 'assetProps']
      const missingFields = requiredFields.filter(field => !(field in parsed))
      if (missingFields.length > 0) {
        return { valid: false, errors: [`Missing required fields: ${missingFields.join(', ')}`] }
      }
      // Validate propsSchema is a valid JSON Schema
      if (typeof parsed.propsSchema !== 'object' || parsed.propsSchema === null) {
        return { valid: false, errors: ['propsSchema must be a valid JSON Schema object'] }
      }
      // Validate defaultProps against propsSchema using a simple check
      // Full validation happens on backend
      return { valid: true, component: parsed as Component }
    } catch (e) {
      return { valid: false, errors: [e instanceof Error ? e.message : 'Invalid JSON'] }
    }
  }
}