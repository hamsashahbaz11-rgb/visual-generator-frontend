import { create } from 'zustand'
import type { ComponentInstance, DocumentGroup, SceneDocument } from '../types/api'
import { scenesApi } from '../services/scenes'
import { normalizeDocumentLayers } from '../canvas/layout'
import { parseApiError } from '../services/api'

interface PersistResult {
  success: boolean
  error?: string
}

interface DocumentState {
  document: SceneDocument | null
  loading: boolean
  error: string | null
  selectedInstanceId: string | null
  selectedGroupId: string | null
  /** Multi-selection (editor state only, never written to the document). */
  selectedInstanceIds: string[]
  selectedGroupIds: string[]
  /** Transient error from last drag/resize persistence (cleared on next interaction). */
  lastPersistError: string | null
  loadDocument: (sceneId: string) => Promise<void>
  setDocument: (document: SceneDocument | null) => void
  selectInstance: (id: string | null) => void
  selectGroup: (id: string | null) => void
  toggleInstanceSelection: (id: string) => void
  toggleGroupSelection: (id: string) => void
  clearSelection: () => void
  getComponent: (id: string) => ComponentInstance | undefined
  /** Local-only position update for dragging; persisted separately on drop. */
  moveLocalInstance: (id: string, position: { x: number; y: number }) => void
  /** Immediate local patch (inspector/resize); call persistInstance to save. */
  patchLocalInstance: (id: string, patch: Partial<ComponentInstance>) => void
  patchLocalInstances: (patches: Array<{ id: string; patch: Partial<ComponentInstance> }>) => void
  /** Persist the current local state of one instance via the Stage 1 API. */
  persistInstance: (id: string) => Promise<PersistResult>
  /** Persist several instances (layout ops); resolves when all are saved. */
  persistInstances: (ids: string[]) => Promise<PersistResult[]>
  /** Normalize every layer scope to 0..n-1, preserving visual order. */
  normalizeLayers: () => Promise<{ instances: number; groups: number }>
  upsertInstance: (instance: ComponentInstance) => void
  /** Local-only removal (used by deleteInstance after server success). */
  removeInstance: (id: string) => void
  /** Delete an instance locally and on the server. */
  deleteInstance: (id: string, sceneId: string) => Promise<PersistResult>
  upsertGroup: (group: DocumentGroup) => void
  /** Delete a group locally and on the server. */
  deleteGroup: (id: string, sceneId: string) => Promise<PersistResult>
  removeGroup: (id: string) => void
  /** Clear the transient persistence error. */
  clearPersistError: () => void
}

// Minimal Stage 1 state: load + represent the document. Canvas interaction is Stage 2.
export type { PersistResult }
export const useDocumentStore = create<DocumentState>((set, get) => ({
  document: null,
  loading: false,
  error: null,
  selectedInstanceId: null,
  selectedGroupId: null,
  selectedInstanceIds: [],
  selectedGroupIds: [],
  lastPersistError: null,
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
  selectInstance: (selectedInstanceId) =>
    set({
      selectedInstanceId,
      selectedGroupId: null,
      selectedInstanceIds: selectedInstanceId ? [selectedInstanceId] : [],
      selectedGroupIds: [],
    }),
  selectGroup: (selectedGroupId) =>
    set({
      selectedGroupId,
      selectedInstanceId: null,
      selectedGroupIds: selectedGroupId ? [selectedGroupId] : [],
      selectedInstanceIds: [],
    }),
  toggleInstanceSelection: (id) =>
    set((state) => {
      const selected = state.selectedInstanceIds.includes(id)
        ? state.selectedInstanceIds.filter((member) => member !== id)
        : [...state.selectedInstanceIds, id]
      return {
        selectedInstanceIds: selected,
        selectedInstanceId: selected[0] ?? null,
        selectedGroupIds: [],
        selectedGroupId: null,
      }
    }),
  toggleGroupSelection: (id) =>
    set((state) => {
      const selected = state.selectedGroupIds.includes(id)
        ? state.selectedGroupIds.filter((member) => member !== id)
        : [...state.selectedGroupIds, id]
      return {
        selectedGroupIds: selected,
        selectedGroupId: selected[0] ?? null,
        selectedInstanceIds: [],
        selectedInstanceId: null,
      }
    }),
  clearSelection: () =>
    set({
      selectedInstanceId: null,
      selectedGroupId: null,
      selectedInstanceIds: [],
      selectedGroupIds: [],
    }),
  getComponent: (id) => get().document?.components.find((c) => c.id === id),
  moveLocalInstance: (id, position) =>
    set((state) =>
      state.document
        ? {
            document: {
              ...state.document,
              components: state.document.components.map((c) =>
                c.id === id ? { ...c, position } : c,
              ),
            },
          }
        : state,
    ),
  patchLocalInstance: (id, patch) =>
    get().patchLocalInstances([{ id, patch }]),
  patchLocalInstances: (patches) =>
    set((state) => {
      if (!state.document) return state
      const byId = new Map(patches.map((p) => [p.id, p.patch]))
      return {
        document: {
          ...state.document,
          components: state.document.components.map((c) =>
            byId.has(c.id) ? { ...c, ...byId.get(c.id) } : c,
          ),
        },
      }
    }),
  persistInstance: async (id) => {
    const current = get().document?.components.find((c) => c.id === id)
    if (!current) return { success: false, error: 'Instance not found' }
    try {
      const saved = await scenesApi.updateInstance(id, {
        position: current.position,
        size: current.size,
        transform: current.transform,
        style: current.style,
        visible: current.visible,
        zIndex: current.zIndex,
        props: current.props,
        timing: current.timing,
        animation: current.animation,
      })
      get().upsertInstance(saved)
      return { success: true }
    } catch (error) {
      const message = parseApiError(error).message
      return { success: false, error: message }
    }
  },
  persistInstances: async (ids) => {
    const results = await Promise.all(ids.map((id) => get().persistInstance(id)))
    return results
  },
  normalizeLayers: async () => {
    const document = get().document
    if (!document) return { instances: 0, groups: 0 }
    const { instances, groups } = normalizeDocumentLayers(document)
    if (instances.length > 0) {
      get().patchLocalInstances(
        instances.map((u) => ({ id: u.id, patch: { zIndex: u.zIndex } })),
      )
    }
    const savedGroups = await Promise.all(
      groups.map(async (u) => {
        const current = get().document?.groups.find((g) => g.id === u.id)
        if (!current) return null
        const saved = await scenesApi.updateGroup(u.id, { zIndex: u.zIndex })
        get().upsertGroup(saved)
        return saved
      }),
    )
    await get().persistInstances(instances.map((u) => u.id))
    return {
      instances: instances.length,
      groups: savedGroups.filter((g) => g !== null).length,
    }
  },
  clearPersistError: () => set({ lastPersistError: null }),
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
            selectedInstanceIds: state.selectedInstanceIds.filter((member) => member !== id),
          }
        : state,
    ),
  /** Delete an instance on the server and locally. */
  deleteInstance: async (id: string, _sceneId: string) => {
    try {
      await scenesApi.deleteInstance(id)
      get().removeInstance(id)
      return { success: true }
    } catch (error) {
      const message = parseApiError(error).message
      return { success: false, error: message }
    }
  },
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
            selectedGroupId: state.selectedGroupId === id ? null : state.selectedGroupId,
            selectedGroupIds: state.selectedGroupIds.filter((member) => member !== id),
          }
        : state,
    ),
  /** Delete a group on the server and locally. */
  deleteGroup: async (id: string, _sceneId: string) => {
    try {
      await scenesApi.deleteGroup(id)
      get().removeGroup(id)
      return { success: true }
    } catch (error) {
      const message = parseApiError(error).message
      return { success: false, error: message }
    }
  },
}))
