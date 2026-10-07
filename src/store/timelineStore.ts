import { create } from 'zustand'
import type { AnimatableProperty } from '../types/api'

/** Stable keyframe reference: instance + property + frame. UI state only. */
export interface SelectedKeyframe {
  instanceId: string
  property: AnimatableProperty
  frame: number
}

interface TimelineState {
  /** Current playhead frame. Editor/UI state only — never persisted to the backend. */
  currentFrame: number
  isPlaying: boolean
  /** Selected keyframe (Stage 3D). UI state only — never written to SceneDocument. */
  selectedKeyframe: SelectedKeyframe | null
  /** Property armed for keyframe authoring on the selected instance. */
  selectedProperty: AnimatableProperty | null
  /** Set the frame, clamped to 0..durationFrames-1. */
  setCurrentFrame: (frame: number, durationFrames: number) => void
  play: () => void
  pause: () => void
  togglePlaying: () => void
  selectKeyframe: (selection: SelectedKeyframe | null) => void
  selectProperty: (property: AnimatableProperty | null) => void
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
  selectedKeyframe: null,
  selectedProperty: null,
  setCurrentFrame: (frame, durationFrames) =>
    set({ currentFrame: clamp(frame, durationFrames) }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),
  selectKeyframe: (selectedKeyframe) => set({ selectedKeyframe }),
  selectProperty: (selectedProperty) => set({ selectedProperty }),
  reset: () => set({ currentFrame: 0, isPlaying: false, selectedKeyframe: null, selectedProperty: null }),
}))

/** Re-exported for tests and non-store callers. */
export const clampTimelineFrame = clamp
