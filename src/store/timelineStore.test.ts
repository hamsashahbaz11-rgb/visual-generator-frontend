import { beforeEach, describe, expect, it } from 'vitest'
import { clampTimelineFrame, useTimelineStore } from './timelineStore'

beforeEach(() => {
  useTimelineStore.getState().reset()
})

describe('timelineStore', () => {
  it('holds currentFrame/isPlaying as editor UI state with sane defaults', () => {
    expect(useTimelineStore.getState().currentFrame).toBe(0)
    expect(useTimelineStore.getState().isPlaying).toBe(false)
  })

  it('clamps seeks: negative → 0, too large → durationFrames - 1', () => {
    useTimelineStore.getState().setCurrentFrame(-10, 300)
    expect(useTimelineStore.getState().currentFrame).toBe(0)
    useTimelineStore.getState().setCurrentFrame(9999, 300)
    expect(useTimelineStore.getState().currentFrame).toBe(299)
    useTimelineStore.getState().setCurrentFrame(45, 300)
    expect(useTimelineStore.getState().currentFrame).toBe(45)
  })

  it('toggles play/pause and resets', () => {
    useTimelineStore.getState().togglePlaying()
    expect(useTimelineStore.getState().isPlaying).toBe(true)
    useTimelineStore.getState().setCurrentFrame(42, 300)
    useTimelineStore.getState().selectKeyframe({ instanceId: 'a', property: 'position.x', frame: 42 })
    useTimelineStore.getState().selectProperty('position.x')
    useTimelineStore.getState().reset()
    expect(useTimelineStore.getState().currentFrame).toBe(0)
    expect(useTimelineStore.getState().isPlaying).toBe(false)
    expect(useTimelineStore.getState().selectedKeyframe).toBeNull()
    expect(useTimelineStore.getState().selectedProperty).toBeNull()
  })

  it('holds keyframe/property selection as UI state (never document state)', () => {
    expect(useTimelineStore.getState().selectedKeyframe).toBeNull()
    useTimelineStore.getState().selectKeyframe({ instanceId: 'a', property: 'style.opacity', frame: 7 })
    expect(useTimelineStore.getState().selectedKeyframe).toEqual({
      instanceId: 'a',
      property: 'style.opacity',
      frame: 7,
    })
    useTimelineStore.getState().selectProperty('style.opacity')
    expect(useTimelineStore.getState().selectedProperty).toBe('style.opacity')
    useTimelineStore.getState().selectKeyframe(null)
    expect(useTimelineStore.getState().selectedKeyframe).toBeNull()
  })

  it('exposes a pure clamp helper', () => {
    expect(clampTimelineFrame(-1, 100)).toBe(0)
    expect(clampTimelineFrame(100, 100)).toBe(99)
  })
})
