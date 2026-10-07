// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Timeline } from './Timeline'
import { frameFromTimelineX } from './timelineGeometry'
import { useDocumentStore } from '../../store/documentStore'
import { useTimelineStore } from '../../store/timelineStore'
import type { Component, ComponentInstance, SceneDocument } from '../../types/api'

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

const inst = (overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({
  id: `i-${Math.random().toString(36).slice(2)}`,
  sceneId: 's',
  componentDefinitionId: 'def-label',
  groupId: null,
  props: {},
  position: { x: 0, y: 0 },
  size: { width: 100, height: 100 },
  transform: { rotation: 0, scaleX: 1, scaleY: 1 },
  style: { opacity: 1 },
  visible: true,
  zIndex: 0,
  timing: { start: 0, duration: 2, startFrame: 0, durationFrames: 300 },
  animation: { enter: [], exit: [], keyframes: [] },
  ...overrides,
})

const doc = (
  components: ComponentInstance[],
  groups: SceneDocument['groups'] = [],
): SceneDocument => ({
  id: 's',
  projectId: 'p',
  name: 'S',
  timeline: { fps: 30, durationFrames: 300 },
  components,
  groups,
})

const mockTracksRect = (left: number): void => {
  const el = screen.getByTestId('timeline-tracks')
  el.getBoundingClientRect = () =>
    ({ left, top: 0, right: left + 640, bottom: 200, width: 640, height: 200 }) as DOMRect
}

beforeEach(() => {
  useTimelineStore.getState().reset()
  useDocumentStore.getState().clearSelection()
  useDocumentStore.setState({ document: null })
})

describe('Timeline', () => {
  it('shows FPS-derived time display and one row per instance', () => {
    render(
      <Timeline
        document={doc([
          inst({ id: 'f', props: { text: 'F' } }),
          inst({ id: 'eq', props: { text: '=' } }),
          inst({ id: 'ma', props: { text: 'ma' } }),
        ])}
        definitions={definitions}
      />,
    )
    expect(screen.getByTestId('timeline-time').textContent).toContain('00:00.00 / 00:10.00')
    expect(screen.getByText('30 fps')).toBeTruthy()
    for (const id of ['f', 'eq', 'ma']) {
      expect(screen.getByTestId(`timeline-track-${id}`)).toBeTruthy()
    }
    expect(screen.getByText('F')).toBeTruthy()
    expect(screen.getByText('ma')).toBeTruthy()
  })

  it('renders timing bars with the Stage 3A start/end convention', () => {
    render(
      <Timeline
        document={doc([
          inst({ id: 'ma', timing: { start: 0, duration: 2, startFrame: 30, durationFrames: 60 } }),
        ])}
        definitions={definitions}
      />,
    )
    const row = screen.getByTestId('timeline-track-ma')
    expect(row.getAttribute('data-start-frame')).toBe('30')
    expect(row.getAttribute('data-end-frame')).toBe('90')
  })

  it('represents nested groups without changing the document', () => {
    const before = doc(
      [
        inst({ id: 'f', groupId: 'gb', props: { text: 'F' } }),
        inst({ id: 'c', groupId: 'ga', props: { text: 'C' } }),
      ],
      [
        { id: 'ga', sceneId: 's', parentGroupId: null, name: 'Equation', zIndex: 0 },
        { id: 'gb', sceneId: 's', parentGroupId: 'ga', name: 'Inner', zIndex: 0 },
      ],
    )
    const snapshot = JSON.stringify(before)
    render(<Timeline document={before} definitions={definitions} />)
    expect(screen.getByTestId('timeline-group-ga')).toBeTruthy()
    expect(screen.getByTestId('timeline-group-gb')).toBeTruthy()
    expect(screen.getByTestId('timeline-track-f')).toBeTruthy()
    expect(JSON.stringify(before)).toBe(snapshot)
  })

  it('seeks when the ruler is clicked and clamps out-of-range frames', () => {
    render(<Timeline document={doc([inst({ id: 'a' })])} definitions={definitions} />)
    mockTracksRect(0)
    const ruler = screen.getByTestId('timeline-ruler')
    const pixelsPerFrame = 640 / 300
    fireEvent.pointerDown(ruler, { clientX: 96 })
    expect(useTimelineStore.getState().currentFrame).toBe(
      frameFromTimelineX(96, pixelsPerFrame, 300),
    )
    fireEvent.pointerDown(ruler, { clientX: 100000 })
    expect(useTimelineStore.getState().currentFrame).toBe(299)
    expect(screen.getByTestId('timeline-playhead').getAttribute('data-frame')).toBe('299')
  })

  it('toggles play/pause from the transport', () => {
    render(<Timeline document={doc([inst({ id: 'a' })])} definitions={definitions} />)
    const play = screen.getByRole('button', { name: 'Play' })
    fireEvent.click(play)
    expect(useTimelineStore.getState().isPlaying).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(useTimelineStore.getState().isPlaying).toBe(false)
  })

  it('supports keyboard: Space toggles, arrows step frames', () => {
    render(<Timeline document={doc([inst({ id: 'a' })])} definitions={definitions} />)
    const root = screen.getByTestId('timeline')
    fireEvent.keyDown(root, { key: ' ' })
    expect(useTimelineStore.getState().isPlaying).toBe(true)
    fireEvent.keyDown(root, { key: ' ' })
    expect(useTimelineStore.getState().isPlaying).toBe(false)
    fireEvent.keyDown(root, { key: 'ArrowRight' })
    expect(useTimelineStore.getState().currentFrame).toBe(1)
    fireEvent.keyDown(root, { key: 'ArrowLeft' })
    expect(useTimelineStore.getState().currentFrame).toBe(0)
  })

  it('ignores keyboard shortcuts while typing in inputs', () => {
    render(
      <div>
        <input aria-label="typing" />
        <Timeline document={doc([inst({ id: 'a' })])} definitions={definitions} />
      </div>,
    )
    fireEvent.keyDown(screen.getByLabelText('typing'), { key: ' ' })
    expect(useTimelineStore.getState().isPlaying).toBe(false)
  })

  it('selects the instance via the existing document store when its row label is clicked', () => {
    useDocumentStore.setState({
      document: doc([inst({ id: 'ma', props: { text: 'ma' } })]),
    })
    render(
      <Timeline
        document={useDocumentStore.getState().document!}
        definitions={definitions}
      />,
    )
    fireEvent.click(screen.getByText('ma'))
    expect(useDocumentStore.getState().selectedInstanceId).toBe('ma')
  })

  it('marks rows active/inactive at the current frame without touching the document', () => {
    const document = doc([
      inst({ id: 'late', timing: { start: 0, duration: 2, startFrame: 30, durationFrames: 60 } }),
    ])
    const snapshot = JSON.stringify(document)
    const { rerender } = render(<Timeline document={document} definitions={definitions} />)
    expect(screen.getByTestId('timeline-track-late').textContent).toContain('inactive')
    useTimelineStore.getState().setCurrentFrame(45, 300)
    rerender(<Timeline document={document} definitions={definitions} />)
    expect(screen.getByTestId('timeline-track-late').textContent).toContain('active')
    expect(JSON.stringify(document)).toBe(snapshot)
  })
})
