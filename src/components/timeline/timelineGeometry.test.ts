import { describe, expect, it } from 'vitest'
import { evaluateSceneAtFrame } from '@app/render'
import {
  advancePlaybackFrame,
  clampFrame,
  computeRulerTicks,
  durationToTimeDisplay,
  formatTimelineTime,
  frameFromTimelineX,
  frameToSeconds,
  frameToTimeDisplay,
  instanceTrackLabel,
  isTimingActiveAt,
  pixelsPerFrameFor,
  resolveTimelineMeta,
  timelineXFromFrame,
  timingBarFor,
} from './timelineGeometry'

describe('frame geometry', () => {
  it('maps frame → pixel and back', () => {
    expect(timelineXFromFrame(45, 3)).toBe(135)
    expect(frameFromTimelineX(135, 3, 300)).toBe(45)
    expect(frameFromTimelineX(136.9, 3, 300)).toBe(45)
  })

  it('fits the scene width adaptively (no fixed scale)', () => {
    expect(pixelsPerFrameFor(900, 300)).toBe(3)
    expect(pixelsPerFrameFor(900, 60)).toBe(15)
    expect(pixelsPerFrameFor(0, 300)).toBe(0)
  })
})

describe('timing bars', () => {
  it('computes start/end from frame timing', () => {
    const bar = timingBarFor({ timing: { start: 0, duration: 2, startFrame: 30, durationFrames: 60 } }, 30, 2)
    expect(bar.startFrame).toBe(30)
    expect(bar.endFrame).toBe(90)
    expect(bar.left).toBe(60)
    expect(bar.width).toBe(120)
  })

  it('matches the evaluator visibility boundaries (parity)', () => {
    const document = {
      timeline: { fps: 30, durationFrames: 300 },
      components: [
        {
          id: 'a',
          props: {},
          position: { x: 0, y: 0 },
          size: { width: 100, height: 100 },
          transform: { rotation: 0, scaleX: 1, scaleY: 1 },
          style: { opacity: 1 },
          visible: true,
          zIndex: 0,
          groupId: null,
          timing: { start: 0, duration: 2, startFrame: 30, durationFrames: 60 },
          animation: { enter: [], exit: [], keyframes: [] },
        },
      ],
      groups: [],
    }
    const bar = timingBarFor(document.components[0], 30, 1)
    for (const frame of [29, 30, 89, 90]) {
      const evaluated = evaluateSceneAtFrame(document, frame).components[0].visible
      const active = isTimingActiveAt(document.components[0], frame, 30)
      expect(active).toBe(evaluated)
      expect(active).toBe(frame === 30 || frame === 89)
    }
    expect(bar.startFrame).toBe(30)
    expect(bar.endFrame).toBe(90)
  })
})

describe('ruler', () => {
  it('converts FPS-aware: 1 second = fps frames', () => {
    expect(frameToSeconds(30, 30)).toBe(1)
    expect(frameToSeconds(60, 60)).toBe(1)
    expect(frameToSeconds(90, 30)).toBe(3)
  })

  it('adapts ticks to fps and duration without label spam', () => {
    const ticks30 = computeRulerTicks(30, 300)
    expect(ticks30[0]).toBe(0)
    expect(ticks30[ticks30.length - 1]).toBe(300)
    expect(ticks30.length).toBeLessThanOrEqual(9)
    // 1-second spacing at 30fps
    expect(ticks30[1] - ticks30[0]).toBe(60)
    const ticks60 = computeRulerTicks(60, 600)
    expect(ticks60[1] - ticks60[0]).toBe(120)
    // one second still equals fps frames in both
    expect(ticks60[1] / 60).toBe(ticks30[1] / 30)
  })
})

describe('clamping', () => {
  it('clamps negative → 0 and too large → durationFrames - 1', () => {
    expect(clampFrame(-5, 300)).toBe(0)
    expect(clampFrame(0, 300)).toBe(0)
    expect(clampFrame(299, 300)).toBe(299)
    expect(clampFrame(300, 300)).toBe(299)
    expect(clampFrame(9999, 300)).toBe(299)
    expect(clampFrame(Number.NaN, 300)).toBe(0)
  })
})

describe('playback math', () => {
  it('advances according to elapsed time and fps', () => {
    // 1000ms at 30fps → +30 frames
    expect(advancePlaybackFrame(0, 1000, 30, 300)).toEqual({ frame: 30, ended: false })
    // 1000ms at 60fps → +60 frames
    expect(advancePlaybackFrame(0, 1000, 60, 600)).toEqual({ frame: 60, ended: false })
    // partial frame time floors (500ms at 30fps → +15)
    expect(advancePlaybackFrame(10, 500, 30, 300)).toEqual({ frame: 25, ended: false })
  })

  it('stops at durationFrames - 1 without looping', () => {
    expect(advancePlaybackFrame(290, 1000, 30, 300)).toEqual({ frame: 299, ended: true })
    expect(advancePlaybackFrame(299, 5000, 30, 300)).toEqual({ frame: 299, ended: true })
  })
})

describe('time display', () => {
  it('formats MM:SS.cc from frames via fps', () => {
    expect(formatTimelineTime(1.5)).toBe('00:01.50')
    expect(frameToTimeDisplay(45, 30)).toBe('00:01.50')
    expect(frameToTimeDisplay(90, 60)).toBe('00:01.50')
    expect(durationToTimeDisplay(300, 30)).toBe('00:10.00')
  })
})

describe('timeline metadata', () => {
  it('uses document timeline metadata, never hard-coded fps', () => {
    expect(resolveTimelineMeta({ timeline: { fps: 60, durationFrames: 600 } } as never)).toEqual({
      fps: 60,
      durationFrames: 600,
    })
  })
})

describe('track labels', () => {
  it('prefers distinguishing text props, falls back to definition name', () => {
    expect(instanceTrackLabel({ props: { text: 'ma' } }, 'Label')).toBe('ma')
    expect(instanceTrackLabel({ props: {} }, 'Arrow')).toBe('Arrow')
  })
})
