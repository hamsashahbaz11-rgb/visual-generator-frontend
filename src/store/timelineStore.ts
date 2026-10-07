import { create } from 'zustand'

interface TimelineState {
  /** Current playhead frame. Editor/UI state only — never persisted to the backend. */
  currentFrame: number
  isPlaying: boolean
  /** Set the frame, clamped to 0..durationFrames-1. */
  setCurrentFrame: (frame: number, durationFrames: number) => void
  play: () => void
  pause: () => void
  togglePlaying: () => void
  /** Reset to frame 0 and pause (e.g. when the scene changes). */
  reset: () => void
}

const clamp = (frame: number, durationFrames: number): number => {
  if (!Number.isFinite(durationFrames) || durationFrames < 1) return 0
  if (!Number.isFinite(frame)) return 0
  return Math.min(Math.max(0, Math.floor(frame)), durationFrames - 1)
}

export const useTimelineStore = create<TimelineState>((set) => ({
  currentFrame: 0,
  isPlaying: false,
  setCurrentFrame: (frame, durationFrames) =>
    set({ currentFrame: clamp(frame, durationFrames) }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),
  reset: () => set({ currentFrame: 0, isPlaying: false }),
}))

/** Re-exported for tests and non-store callers. */
export const clampTimelineFrame = clamp
