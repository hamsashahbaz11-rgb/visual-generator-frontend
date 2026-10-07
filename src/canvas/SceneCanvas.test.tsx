// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SceneCanvas } from './SceneCanvas'
import { useDocumentStore } from '../store/documentStore'
import { scenesApi } from '../services/scenes'
import type { Component, ComponentInstance, SceneDocument } from '../types/api'

vi.mock('../services/scenes', () => ({
  scenesApi: {
    moveInstance: vi.fn(async (_id: string, position: { x: number; y: number }) => ({
      id: 'mock',
      position,
    })),
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
  position: { x: 100, y: 200 },
  size: { width: 220, height: 90 },
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
    loading: false,
    error: null,
  })
  vi.clearAllMocks()
})

describe('SceneCanvas', () => {
  it('renders multiple instances simultaneously with identity preserved', () => {
    const instances = ['F', '=', 'ma', 'arrow', 'Force'].map((text) =>
      makeInstance({ props: { text } }),
    )
    render(<SceneCanvas document={makeDocument(instances)} definitions={definitions} />)
    for (const text of ['F', '=', 'ma', 'arrow', 'Force']) {
      expect(screen.getByText(text)).toBeTruthy()
    }
    const nodes = document.querySelectorAll('[data-instance-id]')
    expect(nodes.length).toBe(5)
    expect(new Set([...nodes].map((n) => n.getAttribute('data-instance-id'))).size).toBe(5)
  })

  it('applies position, size, transform, opacity and zIndex', () => {
    const inst = makeInstance({
      position: { x: 100, y: 200 },
      size: { width: 400, height: 200 },
      transform: { rotation: 45, scaleX: 2, scaleY: 0.5 },
      style: { opacity: 0.5 },
      zIndex: 7,
    })
    render(<SceneCanvas document={makeDocument([inst])} definitions={definitions} />)
    const node = document.querySelector(`[data-instance-id="${inst.id}"]`) as HTMLElement
    expect(node.style.left).toBe('100px')
    expect(node.style.top).toBe('200px')
    expect(node.style.width).toBe('400px')
    expect(node.style.height).toBe('200px')
    expect(node.style.opacity).toBe('0.5')
    expect(node.style.zIndex).toBe('7')
    expect(node.style.transform).toContain('rotate(45deg)')
    expect(node.style.transform).toContain('scale(2, 0.5)')
  })

  it('hides invisible instances', () => {
    const hidden = makeInstance({ props: { text: 'gone' }, visible: false })
    const shown = makeInstance({ props: { text: 'here' } })
    render(<SceneCanvas document={makeDocument([hidden, shown])} definitions={definitions} />)
    expect(screen.queryByText('gone')).toBeNull()
    expect(screen.getByText('here')).toBeTruthy()
  })

  it('renders grouped and nested-group children with hierarchy intact', () => {
    const a = makeInstance({ props: { text: 'A' }, groupId: 'g-a' })
    const b = makeInstance({ props: { text: 'B' }, groupId: 'g-a' })
    const c = makeInstance({ props: { text: 'C' }, groupId: 'g-b' })
    const d = makeInstance({ props: { text: 'D' }, groupId: 'g-b' })
    const doc = makeDocument(
      [a, b, c, d],
      [
        { id: 'g-a', sceneId: 'scene-1', parentGroupId: null, name: 'A', zIndex: 0 },
        { id: 'g-b', sceneId: 'scene-1', parentGroupId: 'g-a', name: 'B', zIndex: 0 },
      ],
    )
    render(<SceneCanvas document={doc} definitions={definitions} />)
    for (const text of ['A', 'B', 'C', 'D']) expect(screen.getByText(text)).toBeTruthy()
    const groupA = document.querySelector('[data-group-id="g-a"]')
    const groupB = document.querySelector('[data-group-id="g-b"]')
    expect(groupA).toBeTruthy()
    expect(groupB).toBeTruthy()
    expect(groupA!.contains(groupB!)).toBe(true) // nesting preserved, not flattened
    expect(groupB!.querySelectorAll('[data-instance-id]').length).toBe(2)
    // grouped instances remain individually addressable
    expect(document.querySelector(`[data-instance-id="${c.id}"]`)).toBeTruthy()
  })

  it('renders an empty scene without crashing', () => {
    render(<SceneCanvas document={makeDocument([])} definitions={definitions} />)
    expect(screen.getByTestId('scene-canvas')).toBeTruthy()
    expect(document.querySelectorAll('[data-instance-id]').length).toBe(0)
  })

  it('isolates unsupported components instead of crashing the scene', () => {
    const good = makeInstance({ props: { text: 'ok' } })
    const bad = makeInstance({ componentDefinitionId: 'def-missing', props: {} })
    render(
      <SceneCanvas document={makeDocument([good, bad])} definitions={definitions} />,
    )
    expect(screen.getByText('ok')).toBeTruthy()
    expect(screen.getByText('Unsupported component')).toBeTruthy()
    expect(document.querySelectorAll('[data-instance-id]').length).toBe(2)
  })

  it('selects on click and shows a selection boundary', () => {
    const inst = makeInstance({ props: { text: 'pick me' } })
    useDocumentStore.setState({ document: makeDocument([inst]) })
    render(<SceneCanvas document={makeDocument([inst])} definitions={definitions} />)
    const node = document.querySelector(`[data-instance-id="${inst.id}"]`) as HTMLElement
    expect(node.classList.contains('selected')).toBe(false)
    fireEvent.pointerDown(node)
    expect(useDocumentStore.getState().selectedInstanceId).toBe(inst.id)
    expect(node.classList.contains('selected')).toBe(true)
    // selection is editor state, not document state
    expect(useDocumentStore.getState().document?.components[0]).not.toHaveProperty('selected')
    // clicking empty canvas clears selection
    fireEvent.pointerDown(screen.getByTestId('scene-canvas'))
    expect(useDocumentStore.getState().selectedInstanceId).toBeNull()
  })

  it('drags one component without moving the others', async () => {
    const target = makeInstance({ props: { text: 'drag me' }, position: { x: 100, y: 100 } })
    const other = makeInstance({ props: { text: 'stays' }, position: { x: 500, y: 500 } })
    const doc = makeDocument([target, other])
    useDocumentStore.setState({ document: doc })
    render(<SceneCanvas document={doc} definitions={definitions} />)
    const node = document.querySelector(`[data-instance-id="${target.id}"]`) as HTMLElement
    fireEvent.pointerDown(node, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { clientX: 50, clientY: 25 })
    fireEvent.pointerUp(window)
    const state = useDocumentStore.getState()
    expect(state.document?.components.find((c) => c.id === target.id)?.position).toEqual({
      x: 150,
      y: 125,
    })
    expect(state.document?.components.find((c) => c.id === other.id)?.position).toEqual({
      x: 500,
      y: 500,
    })
    expect(scenesApi.moveInstance).toHaveBeenCalledWith(target.id, { x: 150, y: 125 })
  })
})
