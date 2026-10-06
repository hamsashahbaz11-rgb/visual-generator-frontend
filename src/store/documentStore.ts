import { create } from 'zustand'
import type { ComponentInstance, DocumentGroup, SceneDocument } from '../types/api'
import { scenesApi } from '../services/scenes'

interface DocumentState {
  document: SceneDocument | null
  loading: boolean
  error: string | null
  selectedInstanceId: string | null
  loadDocument: (sceneId: string) => Promise<void>
  setDocument: (document: SceneDocument | null) => void
  selectInstance: (id: string | null) => void
  upsertInstance: (instance: ComponentInstance) => void
  removeInstance: (id: string) => void
  upsertGroup: (group: DocumentGroup) => void
  removeGroup: (id: string) => void
}

// Minimal Stage 1 state: load + represent the document. Canvas interaction is Stage 2.
export const useDocumentStore = create<DocumentState>((set) => ({
  document: null,
  loading: false,
  error: null,
  selectedInstanceId: null,
  loadDocument: async (sceneId: string) => {
    set({ loading: true, error: null })
    try {
      const document = await scenesApi.getDocument(sceneId)
      set({ document, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load scene document',
      })
    }
  },
  setDocument: (document) => set({ document }),
  selectInstance: (selectedInstanceId) => set({ selectedInstanceId }),
  upsertInstance: (instance) =>
    set((state) =>
      state.document
        ? {
            document: {
              ...state.document,
              components: state.document.components.some((c) => c.id === instance.id)
                ? state.document.components.map((c) => (c.id === instance.id ? instance : c))
                : [...state.document.components, instance],
            },
          }
        : state,
    ),
  removeInstance: (id) =>
    set((state) =>
      state.document
        ? {
            document: {
              ...state.document,
              components: state.document.components.filter((c) => c.id !== id),
            },
            selectedInstanceId: state.selectedInstanceId === id ? null : state.selectedInstanceId,
          }
        : state,
    ),
  upsertGroup: (group) =>
    set((state) =>
      state.document
        ? {
            document: {
              ...state.document,
              groups: state.document.groups.some((g) => g.id === group.id)
                ? state.document.groups.map((g) => (g.id === group.id ? group : g))
                : [...state.document.groups, group],
            },
          }
        : state,
    ),
  removeGroup: (id) =>
    set((state) =>
      state.document
        ? {
            document: {
              ...state.document,
              groups: state.document.groups.filter((g) => g.id !== id),
              // Instances in a deleted group are detached (FK SET NULL);
              // mirror that locally by keeping them visible but ungrouped.
              components: state.document.components.map((c) =>
                c.groupId === id ? { ...c, groupId: null } : c,
              ),
            },
          }
        : state,
    ),
}))
