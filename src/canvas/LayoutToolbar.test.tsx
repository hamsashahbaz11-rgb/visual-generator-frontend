// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LayoutToolbar } from './LayoutToolbar'
import { useDocumentStore } from '../store/documentStore'
import type { ComponentInstance, SceneDocument } from '../types/api'

vi.mock('../services/scenes', () => ({
  scenesApi: {
    updateInstance: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const { useDocumentStore } = await import('../store/documentStore')
      const current = useDocumentStore.getState().getComponent(id)
      return { ...current, ...patch }
    }),
    updateGroup: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const { useDocumentStore } = await import('../store/documentStore')
      const current = useDocumentStore.getState().document?.groups.find((g) => g.id === id)
      return { ...current, ...patch }
    }),
  },
}))

const makeInstance = (overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({
  id: `inst-${Math.random().toString(36).slice(2)}`,
  sceneId: 'scene-1',
  componentDefinitionId: 'def-label',
  groupId: null,
  props: { text: 'x' },
  position: { x: 0, y: 0 },
  size: { width: 100, height: 100 },
  transform: { rotation: 0, scaleX: 1, scaleY: 1 },
  style: { opacity: 1 },
  visible: true,
  zIndex: 0,
  timing: { start: 0, duration: 2 },
  animation: { enter: [], exit: [], keyframes: [] },
  ...overrides,
})

const makeDocument = (
  components: ComponentInstance[],
  groups: SceneDocument['groups'] = [],
): SceneDocument => ({
  id: 'scene-1',
  projectId: 'project-1',
  name: 'Scene 1',
  components,
  groups,
})

const renderToolbar = (doc: SceneDocument) => {
  const state = useDocumentStore.getState()
  render(<LayoutToolbar document={state.document ?? doc} />)
}

beforeEach(() => {
  useDocumentStore.setState({
    document: null,
    selectedInstanceId: null,
    selectedGroupId: null,
    selectedInstanceIds: [],
    selectedGroupIds: [],
    loading: false,
    error: null,
  })
  vi.clearAllMocks()
})

describe('LayoutToolbar', () => {
  it('aligns the multi-selection and persists through the existing mutation path', async () => {
    const a = makeInstance({ id: 'a', position: { x: 0, y: 0 } })
    const b = makeInstance({ id: 'b', position: { x: 200, y: 50 } })
    const doc = makeDocument([a, b])
    useDocumentStore.setState({ document: doc, selectedInstanceIds: ['a', 'b'], selectedInstanceId: 'a' })
    renderToolbar(doc)
    fireEvent.click(screen.getByRole('button', { name: 'Align Left' }))
    const state = useDocumentStore.getState()
    expect(state.document?.components.find((c) => c.id === 'b')?.position).toEqual({ x: 0, y: 50 })
    const { scenesApi } = await import('../services/scenes')
    await waitFor(() => expect(scenesApi.updateInstance).toHaveBeenCalled())
    // identity preserved: only positions changed
    expect(state.document?.components.find((c) => c.id === 'b')?.props).toEqual({ text: 'x' })
  })

  it('disables distribution with fewer than 3 selected', () => {
    const doc = makeDocument([makeInstance({ id: 'a' }), makeInstance({ id: 'b' })])
    useDocumentStore.setState({ document: doc, selectedInstanceIds: ['a', 'b'] })
    render(<LayoutToolbar document={doc} />)
    expect((screen.getByRole('button', { name: 'Distribute ⟷' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Distribute ↕' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables distribution with 3 subjects and distributes them', async () => {
    const a = makeInstance({ id: 'a', position: { x: 0, y: 0 } })
    const b = makeInstance({ id: 'b', position: { x: 200, y: 0 } })
    const c = makeInstance({ id: 'c', position: { x: 500, y: 0 } })
    const doc = makeDocument([a, b, c])
    useDocumentStore.setState({ document: doc, selectedInstanceIds: ['a', 'b', 'c'] })
    render(<LayoutToolbar document={doc} />)
    const button = screen.getByRole('button', { name: 'Distribute ⟷' }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    expect(
      useDocumentStore.getState().document?.components.find((m) => m.id === 'b')?.position,
    ).toEqual({ x: 250, y: 0 })
  })

  it('normalizes duplicate z-indices without changing visual order', async () => {
    const a = makeInstance({ id: 'a', zIndex: 4 })
    const b = makeInstance({ id: 'b', zIndex: 4 })
    const doc = makeDocument([a, b])
    useDocumentStore.setState({ document: doc, selectedInstanceIds: ['a'] })
    render(<LayoutToolbar document={doc} />)
    fireEvent.click(screen.getByRole('button', { name: 'Normalize layers' }))
    const { scenesApi } = await import('../services/scenes')
    await waitFor(() => expect(scenesApi.updateInstance).toHaveBeenCalled())
    const zs = useDocumentStore
      .getState()
      .document?.components.map((c) => [c.id, c.zIndex] as const)
    expect(zs).toEqual([
      ['a', 0],
      ['b', 1],
    ])
    await waitFor(() =>
      expect(screen.getByText(/normalized 2 layers/i)).toBeTruthy(),
    )
  })
})
