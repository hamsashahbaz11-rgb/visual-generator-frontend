// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Inspector } from './Inspector'
import { useDocumentStore } from '../store/documentStore'
import { useTimelineStore } from '../store/timelineStore'
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

import { scenesApi } from '../services/scenes'

const labelDef: Component = {
  id: 'def-label',
  name: 'Label',
  displayName: 'Label',
  description: 'text',
  propsSchema: { type: 'object', properties: { text: { type: 'string' } } },
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

const definitions = new Map([[labelDef.id, labelDef]])

const makeInstance = (overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({
  id: 'ma',
  sceneId: 'scene-1',
  componentDefinitionId: 'def-label',
  groupId: null,
  props: { text: 'ma' },
  position: { x: 100, y: 200 },
  size: { width: 220, height: 90 },
  transform: { rotation: 0, scaleX: 1, scaleY: 1 },
  style: { opacity: 1 },
  visible: true,
  zIndex: 0,
  timing: { start: 0, duration: 2, startFrame: 0, durationFrames: 300 },
  animation: { enter: [], exit: [], keyframes: [] },
  ...overrides,
})

const animated = (): ComponentInstance =>
  makeInstance({
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

const makeDocument = (components: ComponentInstance[]): SceneDocument => ({
  id: 'scene-1',
  projectId: 'project-1',
  name: 'Scene 1',
  timeline: { fps: 30, durationFrames: 300 },
  components,
  groups: [],
})

const setup = (instance: ComponentInstance, frame: number) => {
  const document = makeDocument([instance])
  act(() => {
    useDocumentStore.setState({
      document,
      selectedInstanceId: instance.id,
      selectedInstanceIds: [instance.id],
      selectedGroupId: null,
      selectedGroupIds: [],
    })
    useTimelineStore.getState().setCurrentFrame(frame, 300)
  })
  render(<BoundInspector />)
  return document
}

function BoundInspector() {
  const document = useDocumentStore((s) => s.document)
  if (!document) return null
  // Mirrors SceneEditorPage: the Inspector always reads the live store document,
  // so local patches + persisted upserts re-render authoring UI immediately.
  return <Inspector document={document} definitions={definitions} />
}

const lastAnimationPatch = (): { tracks: Array<{ property: string; keyframes: Array<{ frame: number; value: number; easing?: string }> }> } => {
  const calls = (scenesApi.updateInstance as ReturnType<typeof vi.fn>).mock.calls
  const last = calls[calls.length - 1][1] as { animation: { tracks: Array<{ property: string; keyframes: Array<{ frame: number; value: number; easing?: string }> }> } }
  return last.animation
}

beforeEach(() => {
  useTimelineStore.getState().reset()
  useDocumentStore.setState({
    document: null,
    selectedInstanceId: null,
    selectedInstanceIds: [],
    selectedGroupId: null,
    selectedGroupIds: [],
    loading: false,
    error: null,
  })
  vi.clearAllMocks()
})

describe('Inspector animation authoring', () => {
  it('displays evaluated values at the current frame, not base values', () => {
    setup(animated(), 30)
    // base x = 100, but 0→100 / 60→500 evaluates to 300 at frame 30.
    expect(screen.getByTestId('anim-value-position.x').textContent).toBe('300')
  })

  it('adds a keyframe capturing the evaluated value (not the base value)', async () => {
    setup(animated(), 30)
    fireEvent.click(screen.getByTestId('kf-toggle-position.x'))
    await waitFor(() => expect(scenesApi.updateInstance).toHaveBeenCalled())
    const tracks = lastAnimationPatch().tracks
    expect(tracks).toHaveLength(1)
    expect(tracks[0].keyframes).toEqual([
      { frame: 0, value: 100, easing: 'linear' },
      { frame: 30, value: 300, easing: 'linear' },
      { frame: 60, value: 500, easing: 'linear' },
    ])
    // The new keyframe becomes selected.
    expect(useTimelineStore.getState().selectedKeyframe).toEqual({
      instanceId: 'ma',
      property: 'position.x',
      frame: 30,
    })
  })

  it('creates a track for a property with none', async () => {
    setup(makeInstance(), 10)
    fireEvent.click(screen.getByTestId('kf-toggle-style.opacity'))
    await waitFor(() => expect(scenesApi.updateInstance).toHaveBeenCalled())
    const tracks = lastAnimationPatch().tracks
    expect(tracks).toEqual([
      { property: 'style.opacity', keyframes: [{ frame: 10, value: 1, easing: 'linear' }] },
    ])
  })

  it('updates the keyframe value without touching the base value', async () => {
    const document = setup(animated(), 30)
    fireEvent.click(screen.getByTestId('kf-toggle-position.x'))
    await waitFor(() => expect(scenesApi.updateInstance).toHaveBeenCalled())
    const valueInput = screen.getByLabelText('Value')
    fireEvent.change(valueInput, { target: { value: '350' } })
    fireEvent.blur(valueInput)
    await waitFor(() => {
      const tracks = lastAnimationPatch().tracks
      expect(tracks[0].keyframes.find((k) => k.frame === 30)?.value).toBe(350)
    })
    // Base value in the store is unchanged.
    expect(
      useDocumentStore.getState().document?.components.find((c) => c.id === 'ma')?.position.x,
    ).toBe(100)
    void document
  })

  it('edits easing without changing the value', async () => {
    setup(animated(), 60)
    fireEvent.click(screen.getByTestId('kf-toggle-position.x'))
    await waitFor(() => expect(screen.getByTestId('keyframe-editor')).toBeTruthy())
    fireEvent.change(screen.getByTestId('keyframe-easing'), { target: { value: 'easeOut' } })
    await waitFor(() => {
      const tracks = lastAnimationPatch().tracks
      expect(tracks[0].keyframes.find((k) => k.frame === 60)).toEqual({
        frame: 60,
        value: 500,
        easing: 'easeOut',
      })
    })
  })

  it('deletes a keyframe and removes the track when the last one goes', async () => {
    setup(animated(), 60)
    fireEvent.click(screen.getByTestId('kf-toggle-position.x'))
    await waitFor(() => expect(screen.getByTestId('keyframe-editor')).toBeTruthy())
    // Delete frame 60 first: track survives with frame 0.
    fireEvent.click(screen.getByTestId('keyframe-delete'))
    await waitFor(() => {
      const tracks = lastAnimationPatch().tracks
      expect(tracks[0].keyframes.map((k) => k.frame)).toEqual([0])
    })
    // Select frame 0's keyframe and delete: the track is removed.
    act(() => {
      useTimelineStore.getState().selectKeyframe({ instanceId: 'ma', property: 'position.x', frame: 0 })
    })
    fireEvent.click(screen.getByTestId('keyframe-delete'))
    await waitFor(() => {
      expect(lastAnimationPatch().tracks ?? []).toHaveLength(0)
    })
  })

  it('moves a keyframe in time through the frame field', async () => {
    setup(animated(), 60)
    fireEvent.click(screen.getByTestId('kf-toggle-position.x'))
    await waitFor(() => expect(screen.getByTestId('keyframe-editor')).toBeTruthy())
    const frameInput = screen.getByLabelText('Frame')
    fireEvent.change(frameInput, { target: { value: '45' } })
    fireEvent.blur(frameInput)
    await waitFor(() => {
      const tracks = lastAnimationPatch().tracks
      expect(tracks[0].keyframes.map((k) => k.frame)).toEqual([0, 45])
    })
  })

  it('does not modify base values while scrubbing the playhead', () => {
    const document = setup(animated(), 0)
    const snapshot = JSON.stringify(document.components[0])
    act(() => {
      useTimelineStore.getState().setCurrentFrame(15, 300)
    })
    act(() => {
      useTimelineStore.getState().setCurrentFrame(59, 300)
    })
    expect(JSON.stringify(document.components[0])).toBe(snapshot)
    // …while the displayed value follows the evaluator.
    expect(screen.getByTestId('anim-value-position.x').textContent).toBe('493.33')
  })
})
