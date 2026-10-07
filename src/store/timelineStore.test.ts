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
    useTimelineStore.getState().reset()
    expect(useTimelineStore.getState().currentFrame).toBe(0)
    expect(useTimelineStore.getState().isPlaying).toBe(false)
  })

  it('exposes a pure clamp helper', () => {
    expect(clampTimelineFrame(-1, 100)).toBe(0)
    expect(clampTimelineFrame(100, 100)).toBe(99)
  })
})
