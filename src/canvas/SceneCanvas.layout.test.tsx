// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { SceneCanvas } from './SceneCanvas'
import { useDocumentStore } from '../store/documentStore'
import type { Component, ComponentInstance, SceneDocument } from '../types/api'

vi.mock('../services/scenes', () => ({
  scenesApi: {
    moveInstance: vi.fn(async (id: string, position: { x: number; y: number }) => {
      const { useDocumentStore } = await import('../store/documentStore')
      const current = useDocumentStore.getState().getComponent(id)
      return { ...current, position }
    }),
    updateInstance: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const { useDocumentStore } = await import('../store/documentStore')
      const current = useDocumentStore.getState().getComponent(id)
      return { ...current, ...patch }
    }),
  },
}))

const labelDef: Component = {
  id: 'def-label',
  name: 'Label',
  displayName: 'Label',
  description: 'text',
  propsSchema: {},
  defaultProps: {},
  enterStyles: [],
  exitStyles: [],
  colorProps: [],
  refProps: [],
  assetProps: [],
  isPublic: true,
  createdAt: '',
  updatedAt: '',
}

const definitions = new Map([[labelDef.id, labelDef]])

const makeInstance = (overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({
  id: `inst-${Math.random().toString(36).slice(2)}`,
  sceneId: 'scene-1',
  componentDefinitionId: 'def-label',
  groupId: null,
  props: { text: 'x' },
  position: { x: 0, y: 200 },
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

describe('snap guides while dragging', () => {
  it('snaps a dragged edge to a nearby edge, shows a guide, and persists the snapped position', async () => {
    const a = makeInstance({ id: 'a', position: { x: 0, y: 200 } })
    const b = makeInstance({ id: 'b', position: { x: 300, y: 200 } })
    const doc = makeDocument([a, b])
    useDocumentStore.setState({ document: doc })
    render(<SceneCanvas document={doc} definitions={definitions} />)
    const node = document.querySelector('[data-instance-id="a"]') as HTMLElement
    fireEvent.pointerDown(node, { button: 0, clientX: 0, clientY: 0 })
    // candidate x=192 → right edge 292 vs b.left 300: within threshold → snap to 200
    fireEvent.pointerMove(window, { clientX: 192, clientY: 0 })
    expect(
      useDocumentStore.getState().document?.components.find((c) => c.id === 'a')?.position,
    ).toEqual({ x: 200, y: 200 })
    const guides = document.querySelectorAll('[data-testid="snap-guide"]')
    expect(guides.length).toBeGreaterThan(0)
    const vertical = [...guides].find((g) => g.getAttribute('data-orientation') === 'vertical') as HTMLElement
    expect(vertical.style.left).toBe('300px')
    fireEvent.pointerUp(window)
    const { scenesApi } = await import('../services/scenes')
    await waitFor(() =>
      expect(scenesApi.moveInstance).toHaveBeenCalledWith('a', { x: 200, y: 200 }),
    )
    // guides are temporary: gone after drop
    expect(document.querySelectorAll('[data-testid="snap-guide"]').length).toBe(0)
  })

  it('leaves distant positions alone and shows no guides', () => {
    const a = makeInstance({ id: 'a', position: { x: 0, y: 200 } })
    const b = makeInstance({ id: 'b', position: { x: 300, y: 200 } })
    const doc = makeDocument([a, b])
    useDocumentStore.setState({ document: doc })
    render(<SceneCanvas document={doc} definitions={definitions} />)
    const node = document.querySelector('[data-instance-id="a"]') as HTMLElement
    fireEvent.pointerDown(node, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { clientX: 100, clientY: 0 })
    expect(
      useDocumentStore.getState().document?.components.find((c) => c.id === 'a')?.position,
    ).toEqual({ x: 100, y: 200 })
    expect(document.querySelectorAll('[data-testid="snap-guide"]').length).toBe(0)
    fireEvent.pointerUp(window)
  })
})

describe('overlap indicator', () => {
  it('marks the dragged component while it overlaps another, without blocking the drop', async () => {
    const a = makeInstance({ id: 'a', position: { x: 0, y: 200 } })
    const b = makeInstance({ id: 'b', position: { x: 500, y: 200 } })
    const doc = makeDocument([a, b])
    useDocumentStore.setState({ document: doc })
    render(<SceneCanvas document={doc} definitions={definitions} />)
    const node = document.querySelector('[data-instance-id="a"]') as HTMLElement
    expect(node.classList.contains('is-overlapping')).toBe(false)
    fireEvent.pointerDown(node, { button: 0, clientX: 0, clientY: 0 })
    // drag onto b: overlap begins
    fireEvent.pointerMove(window, { clientX: 480, clientY: 0 })
    const moved = document.querySelector('[data-instance-id="a"]') as HTMLElement
    expect(moved.classList.contains('is-overlapping')).toBe(true)
    fireEvent.pointerUp(window)
    // the drop still lands and persists — overlap is information only
    const { scenesApi } = await import('../services/scenes')
    await waitFor(() =>
      expect(scenesApi.moveInstance).toHaveBeenCalledWith('a', { x: 480, y: 200 }),
    )
  })
})

describe('multi-selection', () => {
  it('shift-click adds to the selection and plain click resets to one', () => {
    const a = makeInstance({ id: 'a', props: { text: 'A' } })
    const b = makeInstance({ id: 'b', props: { text: 'B' } })
    const doc = makeDocument([a, b])
    useDocumentStore.setState({ document: doc })
    render(<SceneCanvas document={doc} definitions={definitions} />)
    const nodeA = document.querySelector('[data-instance-id="a"]') as HTMLElement
    const nodeB = document.querySelector('[data-instance-id="b"]') as HTMLElement
    fireEvent.pointerDown(nodeA, { button: 0 })
    fireEvent.pointerUp(window)
    expect(useDocumentStore.getState().selectedInstanceIds).toEqual(['a'])
    // shift-click adds without starting a drag
    fireEvent.pointerDown(nodeB, { button: 0, shiftKey: true })
    fireEvent.pointerUp(window)
    expect(useDocumentStore.getState().selectedInstanceIds).toEqual(['a', 'b'])
    expect(nodeA.classList.contains('selected')).toBe(true)
    expect(nodeB.classList.contains('selected')).toBe(true)
    // shift-click again removes
    fireEvent.pointerDown(nodeA, { button: 0, shiftKey: true })
    fireEvent.pointerUp(window)
    expect(useDocumentStore.getState().selectedInstanceIds).toEqual(['b'])
    // background click clears everything
    fireEvent.pointerDown(screen.getByTestId('scene-canvas'))
    expect(useDocumentStore.getState().selectedInstanceIds).toEqual([])
    expect(useDocumentStore.getState().selectedInstanceId).toBeNull()
  })

  it('keeps selection as editor state, never in the document', () => {
    const a = makeInstance({ id: 'a' })
    const doc = makeDocument([a])
    useDocumentStore.setState({ document: doc })
    render(<SceneCanvas document={doc} definitions={definitions} />)
    act(() => {
      useDocumentStore.getState().toggleInstanceSelection('a')
    })
    expect(useDocumentStore.getState().selectedInstanceIds).toEqual(['a'])
    expect(useDocumentStore.getState().document?.components[0]).not.toHaveProperty('selected')
    expect(useDocumentStore.getState().document?.components[0]).not.toHaveProperty('selectedInstanceIds')
  })
})
