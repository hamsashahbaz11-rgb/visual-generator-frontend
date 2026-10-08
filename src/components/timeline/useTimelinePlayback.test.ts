// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTimelinePlayback } from './useTimelinePlayback'
import { useTimelineStore } from '../../store/timelineStore'

let rafCallbacks: FrameRequestCallback[] = []
let now = 1000

beforeEach(() => {
  useTimelineStore.getState().reset()
  rafCallbacks = []
  now = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    rafCallbacks.push(cb)
    return rafCallbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const runNextFrame = (): void => {
  const cb = rafCallbacks.shift()
  act(() => {
    cb!(now)
  })
}

describe('useTimelinePlayback', () => {
  it('advances by elapsed time at the document fps (no setInterval)', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    renderHook(() => useTimelinePlayback({ fps: 30, durationFrames: 300, isPlaying: true }))
    act(() => {
      useTimelineStore.getState().play()
    })
    expect(rafCallbacks).toHaveLength(1)
    // 1000ms elapsed at 30fps → frame 30
    now = 2000
    runNextFrame()
    expect(useTimelineStore.getState().currentFrame).toBe(30)
    expect(useTimelineStore.getState().isPlaying).toBe(true)
    // another 500ms → frame 45 (missed browser frames still land correctly)
    now = 2500
    runNextFrame()
    expect(useTimelineStore.getState().currentFrame).toBe(45)
    expect(setIntervalSpy).not.toHaveBeenCalled()
  })

  it('respects a 60fps timeline (twice the frames per second)', () => {
    renderHook(() => useTimelinePlayback({ fps: 60, durationFrames: 600, isPlaying: true }))
    act(() => {
      useTimelineStore.getState().play()
    })
    now = 2000
    runNextFrame()
    expect(useTimelineStore.getState().currentFrame).toBe(60)
  })

  it('stops at durationFrames - 1 and pauses (no loop)', () => {
    renderHook(() => useTimelinePlayback({ fps: 30, durationFrames: 300, isPlaying: true }))
    act(() => {
      useTimelineStore.getState().play()
    })
    now = 20000 // far past the end
    runNextFrame()
    expect(useTimelineStore.getState().currentFrame).toBe(299)
    expect(useTimelineStore.getState().isPlaying).toBe(false)
    expect(rafCallbacks).toHaveLength(0)
  })

  it('does nothing while paused', () => {
    renderHook(() => useTimelinePlayback({ fps: 30, durationFrames: 300, isPlaying: false }))
    expect(rafCallbacks).toHaveLength(0)
    expect(useTimelineStore.getState().currentFrame).toBe(0)
  })
})
