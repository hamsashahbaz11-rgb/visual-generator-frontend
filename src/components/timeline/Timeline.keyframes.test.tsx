// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Timeline } from './Timeline'
import { useDocumentStore } from '../../store/documentStore'
import { useTimelineStore } from '../../store/timelineStore'
import type { Component, ComponentInstance, SceneDocument } from '../../types/api'

vi.mock('../../services/scenes', () => ({
  scenesApi: {
    updateInstance: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const { useDocumentStore } = await import('../../store/documentStore')
      const current = useDocumentStore.getState().getComponent(id)
      return { ...current, ...patch }
    }),
  },
}))

import { scenesApi } from '../../services/scenes'

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

const animated = (): ComponentInstance =>
  inst({
    id: 'ma',
    props: { text: 'ma' },
    position: { x: 100, y: 0 },
    animation: {
      enter: [],
      exit: [],
      keyframes: [],
      tracks: [
        {
          property: 'position.x',
          keyframes: [
            { frame: 0, value: 100, easing: 'linear' },
            { frame: 60, value: 500, easing: 'linear' },
          ],
        },
      ],
    },
  })

const doc = (components: ComponentInstance[]): SceneDocument => ({
  id: 's',
  projectId: 'p',
  name: 'S',
  timeline: { fps: 30, durationFrames: 300 },
  components,
  groups: [],
})

const mockTracksRect = (left: number): void => {
  const el = screen.getByTestId('timeline-tracks')
  el.getBoundingClientRect = () =>
    ({ left, top: 0, right: left + 640, bottom: 200, width: 640, height: 200 }) as DOMRect
}

const renderTimeline = (document: SceneDocument) => {
  act(() => {
    useDocumentStore.setState({ document })
  })
  return render(<Timeline document={document} definitions={definitions} />)
}

const selectMa = (): void => {
  act(() => {
    useDocumentStore.getState().selectInstance('ma')
  })
}

beforeEach(() => {
  useTimelineStore.getState().reset()
  useDocumentStore.getState().clearSelection()
  useDocumentStore.setState({ document: null })
  vi.clearAllMocks()
})

describe('Timeline keyframes', () => {
  it('shows keyframe lanes only for the selected instance', () => {
    const document = doc([animated(), inst({ id: 'other', props: { text: 'x' } })])
    renderTimeline(document)
    // Nothing selected: no diamonds.
    expect(screen.queryByTestId('timeline-keyframe-ma-position.x-0')).toBeNull()
    selectMa()
    // Store-driven re-render reveals the selected instance's lanes.
    expect(screen.getByTestId('timeline-keyframe-ma-position.x-0')).toBeTruthy()
    expect(screen.getByTestId('timeline-keyframe-ma-position.x-60')).toBeTruthy()
    expect(screen.queryByTestId('timeline-keyframe-other-position.x-0')).toBeNull()
  })

  it('selects the keyframe and its instance when a diamond is clicked', () => {
    renderTimeline(doc([animated()]))
    selectMa()
    fireEvent.click(screen.getByTestId('timeline-keyframe-ma-position.x-60'))
    expect(useTimelineStore.getState().selectedKeyframe).toEqual({
      instanceId: 'ma',
      property: 'position.x',
      frame: 60,
    })
    expect(useDocumentStore.getState().selectedInstanceId).toBe('ma')
    // Clicking a diamond must not seek the playhead.
    expect(useTimelineStore.getState().currentFrame).toBe(0)
  })

  it('drags a keyframe in time with local patching and persists on release', async () => {
    renderTimeline(doc([animated()]))
    selectMa()
    mockTracksRect(0)
    // pixelsPerFrame = 640 / 300; frame 60 sits at x = 128.
    const diamond = screen.getByTestId('timeline-keyframe-ma-position.x-60')
    fireEvent.pointerDown(diamond, { clientX: 128 })
    // Drag to x for frame 45 → 45 * 640 / 300 = 96.
    fireEvent.pointerMove(window, { clientX: 96 })
    const moved = useDocumentStore
      .getState()
      .document?.components.find((c) => c.id === 'ma')
    expect(moved?.animation.tracks?.[0].keyframes.map((k) => k.frame)).toEqual([0, 45])
    fireEvent.pointerUp(window)
    await vi.waitFor(() => expect(scenesApi.updateInstance).toHaveBeenCalled())
    const patch = (scenesApi.updateInstance as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      animation: { tracks: Array<{ keyframes: Array<{ frame: number }> }> }
    }
    expect(patch.animation.tracks[0].keyframes.map((k) => k.frame)).toEqual([0, 45])
    // Playhead untouched by the drag.
    expect(useTimelineStore.getState().currentFrame).toBe(0)
  })

  it('blocks drags onto occupied frames without duplicating', () => {
    renderTimeline(doc([animated()]))
    selectMa()
    mockTracksRect(0)
    const diamond = screen.getByTestId('timeline-keyframe-ma-position.x-0')
    fireEvent.pointerDown(diamond, { clientX: 0 })
    // Frame 60 sits at x = 128 — occupied.
    fireEvent.pointerMove(window, { clientX: 128 })
    fireEvent.pointerUp(window)
    const after = useDocumentStore
      .getState()
      .document?.components.find((c) => c.id === 'ma')
    expect(after?.animation.tracks?.[0].keyframes.map((k) => k.frame)).toEqual([0, 60])
  })
})
