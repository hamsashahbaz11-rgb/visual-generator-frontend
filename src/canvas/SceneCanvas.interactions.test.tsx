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
  position: { x: 100, y: 100 },
  size: { width: 200, height: 100 },
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
    loading: false,
    error: null,
  })
  vi.clearAllMocks()
})

const selectViaCanvas = (id: string) => {
  const node = document.querySelector(`[data-instance-id="${id}"]`) as HTMLElement
  fireEvent.pointerDown(node, { button: 0, clientX: 0, clientY: 0 })
  fireEvent.pointerUp(window)
}

describe('resize handles', () => {
  it('drags the south-east handle to grow, keeping position stable', async () => {
    const inst = makeInstance()
    const doc = makeDocument([inst])
    useDocumentStore.setState({ document: doc })
    render(<SceneCanvas document={doc} definitions={definitions} />)
    selectViaCanvas(inst.id)
    const handle = document.querySelector(
      `[data-resize-handle="${inst.id}:se"]`,
    ) as HTMLElement
    expect(handle).toBeTruthy()
    fireEvent.pointerDown(handle, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { clientX: 50, clientY: 20 })
    fireEvent.pointerUp(window)
    const state = useDocumentStore.getState()
    expect(state.document?.components.find((c) => c.id === inst.id)?.size).toEqual({
      width: 250,
      height: 120,
    })
    expect(state.document?.components.find((c) => c.id === inst.id)?.position).toEqual({
      x: 100,
      y: 100,
    })
    const { scenesApi } = await import('../services/scenes')
    await waitFor(() => expect(scenesApi.updateInstance).toHaveBeenCalled())
    // component remains selectable after resize
    expect(
      (document.querySelector(`[data-instance-id="${inst.id}"]`) as HTMLElement).classList.contains('selected'),
    ).toBe(true)
  })

  it('drags the north-west handle, keeping the opposite corner stable', () => {
    const inst = makeInstance()
    const doc = makeDocument([inst])
    useDocumentStore.setState({ document: doc })
    render(<SceneCanvas document={doc} definitions={definitions} />)
    selectViaCanvas(inst.id)
    const handle = document.querySelector(
      `[data-resize-handle="${inst.id}:nw"]`,
    ) as HTMLElement
    fireEvent.pointerDown(handle, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { clientX: 20, clientY: 10 })
    fireEvent.pointerUp(window)
    const state = useDocumentStore.getState()
    // opposite corner (300, 200) unchanged: pos shifts, size shrinks
    expect(state.document?.components.find((c) => c.id === inst.id)?.position).toEqual({
      x: 120,
      y: 110,
    })
    expect(state.document?.components.find((c) => c.id === inst.id)?.size).toEqual({
      width: 180,
      height: 90,
    })
  })
})

describe('group selection and movement', () => {
  const setup = () => {
    const f = makeInstance({ id: 'inst-f', props: { text: 'F' }, groupId: 'g-eq', position: { x: 140, y: 180 } })
    const eq = makeInstance({ id: 'inst-eq', props: { text: '=' }, groupId: 'g-eq', position: { x: 300, y: 180 } })
    const doc = makeDocument([f, eq], [
      { id: 'g-eq', sceneId: 'scene-1', parentGroupId: null, name: 'Equation', zIndex: 0 },
    ])
    useDocumentStore.setState({ document: doc })
    render(<SceneCanvas document={doc} definitions={definitions} />)
    return { f, eq, doc }
  }

  it('shows group bounds and a drag chip when the group is selected', () => {
    setup()
    expect(document.querySelector('[data-group-chip="g-eq"]')).toBeNull()
    act(() => {
      useDocumentStore.getState().selectGroup('g-eq')
    })
    const chip = document.querySelector('[data-group-chip="g-eq"]') as HTMLElement
    expect(chip).toBeTruthy()
    expect(chip.textContent).toBe('Equation')
    const outline = document.querySelector('[data-group-outline="g-eq"]') as HTMLElement
    expect(outline).toBeTruthy()
    // bounds cover F(140..340) and =(300..500): x=140 w=360
    expect(outline.style.left).toBe('140px')
    expect(outline.style.width).toBe('360px')
  })

  it('drags the group chip to move children together, preserving identity', async () => {
    const { f, eq } = setup()
    act(() => {
      useDocumentStore.getState().selectGroup('g-eq')
    })
    const chip = document.querySelector('[data-group-chip="g-eq"]') as HTMLElement
    fireEvent.pointerDown(chip, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { clientX: 30, clientY: 40 })
    fireEvent.pointerUp(window)
    const state = useDocumentStore.getState()
    expect(state.document?.components.find((c) => c.id === f.id)?.position).toEqual({
      x: 170,
      y: 220,
    })
    expect(state.document?.components.find((c) => c.id === eq.id)?.position).toEqual({
      x: 330,
      y: 220,
    })
    // identity untouched: ids, props and group membership preserved
    expect(state.document?.components.find((c) => c.id === f.id)?.props).toEqual({ text: 'F' })
    expect(state.document?.components.find((c) => c.id === f.id)?.groupId).toBe('g-eq')
    const { scenesApi } = await import('../services/scenes')
    await waitFor(() => expect(scenesApi.moveInstance).toHaveBeenCalledTimes(2))
  })

  it('double-clicking a member selects its parent group', () => {
    const { f } = setup()
    const node = document.querySelector(`[data-instance-id="${f.id}"]`) as HTMLElement
    fireEvent.doubleClick(node)
    expect(useDocumentStore.getState().selectedGroupId).toBe('g-eq')
    expect(screen.getByText('Equation', { selector: '.canvas-group-chip' })).toBeTruthy()
  })
})
