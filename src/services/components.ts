import { apiClient } from './api'
import type { Component } from '../types/api'

export const componentsApi = {
  search: (query?: string) => apiClient.get<{ items: Component[] }>('/components', { params: query ? { query } : undefined }).then((response) => response.data.items),
}