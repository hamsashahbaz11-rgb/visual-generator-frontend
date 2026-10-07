import {
  isFrameVisible,
  resolveTimeline,
  resolveTimingFrames,
} from '@app/render'
import type { ComponentInstance, SceneDocument } from '../../types/api'

// Pure timeline geometry + timing helpers (Stage 3C).
//
// Frames are canonical; seconds appear only for display (frame / fps).
// The timeline NEVER computes animated values (x, y, opacity, rotation) —
// the Stage 3A evaluator remains the only authority. These helpers deal
// exclusively with frame ranges, pixel mapping, ruler ticks, and playback math.

export interface TimelineMeta {
  fps: number
  durationFrames: number
}

/** FPS/duration from the document timeline (never hard-coded). */
export const resolveTimelineMeta = (document: SceneDocument): TimelineMeta =>
  resolveTimeline(document)

/** Clamp to the valid scene range: 0..durationFrames-1. */
export const clampFrame = (frame: number, durationFrames: number): number => {
  if (!Number.isFinite(durationFrames) || durationFrames < 1) return 0
  if (!Number.isFinite(frame)) return 0
  return Math.min(Math.max(0, Math.floor(frame)), durationFrames - 1)
}

/** Frame → seconds (display only). */
export const frameToSeconds = (frame: number, fps: number): number =>
  fps > 0 ? Math.max(0, frame) / fps : 0

/** Seconds → MM:SS.cc, e.g. 1.5 → "00:01.50". */
export const formatTimelineTime = (totalSeconds: number): string => {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0
  const minutes = Math.floor(safe / 60)
  const seconds = Math.floor(safe % 60)
  const centis = Math.floor((safe * 100) % 100)
  const pad = (n: number, len = 2): string => String(n).padStart(len, '0')
  return `${pad(minutes)}:${pad(seconds)}.${pad(centis)}`
}

/** Frame → display time, derived from fps. */
export const frameToTimeDisplay = (frame: number, fps: number): string =>
  formatTimelineTime(frameToSeconds(frame, fps))

/** Total duration display, e.g. fps=30, 300 frames → "00:10.00". */
export const durationToTimeDisplay = (durationFrames: number, fps: number): string =>
  formatTimelineTime(frameToSeconds(durationFrames, fps))

/** Fit the whole scene into the available track width (adaptive, no fixed scale). */
export const pixelsPerFrameFor = (trackWidthPx: number, durationFrames: number): number =>
  durationFrames > 0 && trackWidthPx > 0 ? trackWidthPx / durationFrames : 0

/** Frame → x offset in the track area. */
export const timelineXFromFrame = (frame: number, pixelsPerFrame: number): number =>
  Math.max(0, frame) * Math.max(0, pixelsPerFrame)

/** Track-area x offset → frame (clamped to the scene range). */
export const frameFromTimelineX = (
  x: number,
  pixelsPerFrame: number,
  durationFrames: number,
): number => {
  if (!(pixelsPerFrame > 0)) return 0
  return clampFrame(Math.floor(x / pixelsPerFrame), durationFrames)
}

export interface TimingBar {
  startFrame: number
  endFrame: number
  durationFrames: number
  /** Pixel geometry for the active-range bar. */
  left: number
  width: number
}

/**
 * Active-range bar for one instance, using the Stage 3A convention
 * startFrame <= frame < endFrame. Frame fields win; legacy seconds
 * convert via fps (shared `resolveTimingFrames` — same math as the evaluator).
 */
export const timingBarFor = (
  instance: Pick<ComponentInstance, 'timing'>,
  fps: number,
  pixelsPerFrame: number,
): TimingBar => {
  const { startFrame, durationFrames, endFrame } = resolveTimingFrames(
    instance.timing ?? null,
    fps,
  )
  return {
    startFrame,
    endFrame,
    durationFrames,
    left: timelineXFromFrame(startFrame, pixelsPerFrame),
    width: Math.max(0, durationFrames) * Math.max(0, pixelsPerFrame),
  }
}

/** Whether the instance's timing range covers the frame (ignores base `visible`). */
export const isTimingActiveAt = (
  instance: Pick<ComponentInstance, 'timing'>,
  frame: number,
  fps: number,
): boolean => isFrameVisible(instance.timing ?? null, frame, fps)

/** Nice second-steps for ruler labels (never hundreds of labels). */
const NICE_SECOND_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]

/**
 * Major ruler ticks as frame positions at whole-second intervals,
 * adapting to fps and duration. E.g. 30fps/300f → every 2s by default
 * with maxLabels=8 (0,60,120,180,240,300); 60fps/600f → likewise per second count.
 */
export const computeRulerTicks = (
  fps: number,
  durationFrames: number,
  maxLabels = 8,
): number[] => {
  if (!(fps > 0) || !(durationFrames > 0)) return [0]
  const durationSeconds = durationFrames / fps
  const step =
    NICE_SECOND_STEPS.find((s) => durationSeconds / s <= maxLabels) ??
    NICE_SECOND_STEPS[NICE_SECOND_STEPS.length - 1]
  const ticks: number[] = []
  for (let second = 0; second * fps < durationFrames; second += step) {
    ticks.push(Math.round(second * fps))
  }
  const last = durationFrames
  if (ticks[ticks.length - 1] !== last) ticks.push(last)
  return ticks
}

export interface PlaybackAdvance {
  frame: number
  /** True when the playhead reached the final valid frame and must stop. */
  ended: boolean
}

/**
 * Elapsed-time playback math (single source for the rAF loop and tests).
 * Converts real elapsed ms → frames at the document fps, so missed browser
 * frames still land on the correct frame. Stops at durationFrames - 1 (no loop).
 */
export const advancePlaybackFrame = (
  fromFrame: number,
  elapsedMs: number,
  fps: number,
  durationFrames: number,
): PlaybackAdvance => {
  if (!(fps > 0) || !(durationFrames > 0)) return { frame: 0, ended: true }
  const start = clampFrame(fromFrame, durationFrames)
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0
  const advanced = start + Math.floor((elapsed * fps) / 1000)
  const last = durationFrames - 1
  if (advanced >= last) return { frame: last, ended: true }
  return { frame: advanced, ended: false }
}

/** Row label: distinguishing text prop when present, else the definition name. */
export const instanceTrackLabel = (
  instance: Pick<ComponentInstance, 'props'>,
  definitionName: string,
): string => {
  const props = instance.props ?? {}
  for (const key of ['text', 'label', 'title']) {
    const value = props[key]
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return definitionName
}
