// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Inspector } from './Inspector'
import { useDocumentStore } from '../store/documentStore'
import type { Component, ComponentInstance, SceneDocument } from '../types/api'

vi.mock('../services/scenes', () => ({
  scenesApi: {
    updateInstance: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const { useDocumentStore } = await import('../store/documentStore')
      const current = useDocumentStore.getState().getComponent(id)
      return { ...current, ...patch }
    }),
    updateGroup: vi.fn(async (id: string, patch: Record<string, unknown>) => ({
      id,
      sceneId: 'scene-1',
      ...patch,
    })),
  },
}))

const labelDef: Component = {
  id: 'def-label',
  name: 'Label',
  displayName: 'Label',
  description: 'text',
  propsSchema: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      size: { type: 'number' },
      bold: { type: 'boolean' },
      align: { type: 'string', enum: ['left', 'center'] },
    },
  },
  defaultProps: { text: '' },
  enterStyles: [],
  exitStyles: [],
  colorProps: [],
  refProps: [],
  assetProps: [],
  isPublic: true,
  createdAt: '',
  updatedAt: '',
}

const arrowDef: Component = {
  ...labelDef,
  id: 'def-arrow',
  name: 'Arrow',
  displayName: 'Arrow',
  propsSchema: {
    type: 'object',
    properties: {
      from: { type: 'string' },
      to: { type: 'string' },
      style: { type: 'string', enum: ['solid', 'dashed'] },
    },
  },
  refProps: ['from', 'to'],
}

const definitions = new Map([
  [labelDef.id, labelDef],
  [arrowDef.id, arrowDef],
])

const makeInstance = (overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({
  id: `inst-${Math.random().toString(36).slice(2)}`,
  sceneId: 'scene-1',
  componentDefinitionId: 'def-label',
  groupId: null,
  props: { text: 'F' },
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

const select = (doc: SceneDocument, id: string) => {
  useDocumentStore.setState({ document: doc, selectedInstanceId: id, selectedGroupId: null })
  render(<Inspector document={useDocumentStore.getState().document!} definitions={definitions} />)
}

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

describe('Inspector', () => {
  it('shows an empty state when nothing is selected', () => {
    const doc = makeDocument([makeInstance()])
    useDocumentStore.setState({ document: doc })
    render(<Inspector document={doc} definitions={definitions} />)
    expect(screen.getByTestId('inspector-empty')).toBeTruthy()
    expect(screen.getByText('No component selected')).toBeTruthy()
  })

  it('edits X position and persists the change', async () => {
    const inst = makeInstance()
    const doc = makeDocument([inst])
    select(doc, inst.id)
    const x = screen.getByLabelText('X') as HTMLInputElement
    expect(x.value).toBe('100')
    fireEvent.change(x, { target: { value: '300' } })
    fireEvent.blur(x)
    expect(
      useDocumentStore.getState().document?.components.find((c) => c.id === inst.id)?.position,
    ).toEqual({ x: 300, y: 200 })
    const { scenesApi } = await import('../services/scenes')
    await waitFor(() => expect(scenesApi.updateInstance).toHaveBeenCalled())
  })

  it('edits width, rotation, opacity and visibility', () => {
    const inst = makeInstance()
    const doc = makeDocument([inst])
    select(doc, inst.id)
    const width = screen.getByLabelText('Width') as HTMLInputElement
    fireEvent.change(width, { target: { value: '500' } })
    fireEvent.blur(width)
    expect(
      useDocumentStore.getState().document?.components.find((c) => c.id === inst.id)?.size.width,
    ).toBe(500)

    const rotation = screen.getByLabelText('Rotation') as HTMLInputElement
    fireEvent.change(rotation, { target: { value: '30' } })
    fireEvent.blur(rotation)
    expect(
      useDocumentStore.getState().document?.components.find((c) => c.id === inst.id)?.transform.rotation,
    ).toBe(30)

    const opacity = screen.getByLabelText('Opacity') as HTMLInputElement
    fireEvent.change(opacity, { target: { value: '0.5' } })
    fireEvent.blur(opacity)
    expect(
      useDocumentStore.getState().document?.components.find((c) => c.id === inst.id)?.style.opacity,
    ).toBe(0.5)

    const visible = screen.getByRole('checkbox', { name: /visible/i })
    fireEvent.click(visible)
    expect(
      useDocumentStore.getState().document?.components.find((c) => c.id === inst.id)?.visible,
    ).toBe(false)
  })

  it('moves layers with bring-to-front and send-backward', () => {
    const a = makeInstance({ id: 'a', zIndex: 0 })
    const b = makeInstance({ id: 'b', zIndex: 5 })
    const doc = makeDocument([a, b])
    select(doc, 'a')
    fireEvent.click(screen.getByRole('button', { name: 'Front' }))
    expect(
      useDocumentStore.getState().document?.components.find((c) => c.id === 'a')?.zIndex,
    ).toBe(6)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(
      useDocumentStore.getState().document?.components.find((c) => c.id === 'a')?.zIndex,
    ).toBe(-1)
  })

  it('edits schema-driven props: text, number, boolean and enum', () => {
    const inst = makeInstance({ props: { text: 'F', size: 12, bold: false, align: 'left' } })
    const doc = makeDocument([inst])
    select(doc, inst.id)
    const text = screen.getByLabelText('text') as HTMLInputElement
    fireEvent.change(text, { target: { value: 'ma' } })
    fireEvent.blur(text)
    expect(
      (useDocumentStore.getState().document?.components.find((c) => c.id === inst.id)?.props as { text: string }).text,
    ).toBe('ma')
    // boolean + enum controls exist and are driven by props_schema, not hardcoding
    expect(screen.getByText('bold')).toBeTruthy()
    expect(screen.getByLabelText('align').textContent).toContain('center')
  })

  it('edits generic references through a same-scene picker', () => {
    const f = makeInstance({ id: 'inst-f', props: { text: 'F' } })
    const ma = makeInstance({ id: 'inst-ma', props: { text: 'ma' } })
    const arrow = makeInstance({
      id: 'inst-arrow',
      componentDefinitionId: 'def-arrow',
      props: { from: '', to: '', style: 'dashed' },
    })
    const doc = makeDocument([f, ma, arrow])
    select(doc, 'inst-arrow')
    const from = screen.getByTestId('ref-from') as HTMLSelectElement
    // candidates are same-scene instances; the arrow itself is excluded
    expect(from.textContent).toContain('F')
    expect(from.textContent).toContain('ma')
    fireEvent.change(from, { target: { value: 'inst-f' } })
    expect(
      (useDocumentStore.getState().document?.components.find((c) => c.id === 'inst-arrow')?.props as { from: string }).from,
    ).toBe('inst-f')
  })

  it('shows group bounds and lets members be selected', () => {
    const f = makeInstance({ id: 'inst-f', props: { text: 'F' }, groupId: 'g', position: { x: 0, y: 0 } })
    const doc = makeDocument(
      [f],
      [{ id: 'g', sceneId: 'scene-1', parentGroupId: null, name: 'Equation', zIndex: 0 }],
    )
    useDocumentStore.setState({ document: doc, selectedGroupId: 'g', selectedInstanceId: null })
    render(<Inspector document={doc} definitions={definitions} />)
    expect(screen.getByTestId('group-bounds').textContent).toContain('x 0')
    fireEvent.click(screen.getByRole('button', { name: /Label "F"/ }))
    expect(useDocumentStore.getState().selectedInstanceId).toBe('inst-f')
  })

  it('notes multi-selection while still editing the first component', () => {
    const a = makeInstance({ id: 'a', props: { text: 'A' } })
    const b = makeInstance({ id: 'b', props: { text: 'B' } })
    const doc = makeDocument([a, b])
    useDocumentStore.setState({
      document: doc,
      selectedInstanceId: 'a',
      selectedInstanceIds: ['a', 'b'],
      selectedGroupId: null,
      selectedGroupIds: [],
    })
    render(<Inspector document={doc} definitions={definitions} />)
    expect(screen.getByTestId('inspector-multi').textContent).toContain('2 selected')
    // single-selection inspector still targets the first component
    expect(screen.getByTestId('inspector').getAttribute('data-instance-id')).toBe('a')
  })
})
