import {
  ANIMATABLE_PROPERTIES,
  evaluateSceneAtFrame,
  interpolateKeyframes,
  isAnimatableProperty,
  isEasingName,
  normalizeKeyframes,
} from '@app/render'
import type { TimelineDocument } from '@app/render'
import type {
  AnimatableProperty,
  AnimationTrack,
  ComponentInstance,
  InstanceAnimation,
  TimelineEasingName,
  TimelineKeyframe,
} from '../../types/api'

// Pure animation-authoring domain helpers (Stage 3D).
//
// No React, no DOM, no Remotion, no browser APIs. All mutations return new
// objects; inputs are never modified. Keyframe interpolation authority stays
// with the Stage 3A evaluator — these helpers only shape track data.

export type { AnimatableProperty, TimelineEasingName }

export const CANONICAL_TRACK_ORDER: readonly AnimatableProperty[] = [...ANIMATABLE_PROPERTIES]

export const TRACK_LABELS: Record<AnimatableProperty, string> = {
  'position.x': 'Position X',
  'position.y': 'Position Y',
  'size.width': 'Width',
  'size.height': 'Height',
  'transform.rotation': 'Rotation',
  'transform.scaleX': 'Scale X',
  'transform.scaleY': 'Scale Y',
  'style.opacity': 'Opacity',
}

export const trackLabel = (property: AnimatableProperty): string =>
  TRACK_LABELS[property] ?? property

export const isSupportedEasing = (value: unknown): value is TimelineEasingName =>
  isEasingName(value)

/** Read one animatable value from a base OR evaluated instance shape. */
export const readAnimatedValue = (
  instance: Pick<ComponentInstance, 'position' | 'size' | 'transform' | 'style'>,
  property: AnimatableProperty,
): number => {
  switch (property) {
    case 'position.x': return instance.position.x
    case 'position.y': return instance.position.y
    case 'size.width': return instance.size.width
    case 'size.height': return instance.size.height
    case 'transform.rotation': return instance.transform.rotation
    case 'transform.scaleX': return instance.transform.scaleX
    case 'transform.scaleY': return instance.transform.scaleY
    case 'style.opacity': return instance.style.opacity ?? 1
  }
}

/**
 * Evaluated property value at a frame via the Stage 3A evaluator (the only
 * interpolation authority). Used when capturing keyframes so an already
 * animated property records its on-screen value, not its base value.
 */
export const evaluatedValueAt = (
  document: TimelineDocument,
  instanceId: string,
  property: AnimatableProperty,
  frame: number,
): number | undefined => {
  const evaluated = evaluateSceneAtFrame(document, frame)
  const instance = evaluated.components.find((c) => c.id === instanceId)
  if (!instance) return undefined
  const value = readAnimatedValue(
    instance as Pick<ComponentInstance, 'position' | 'size' | 'transform' | 'style'>,
    property,
  )
  return Number.isFinite(value) ? value : undefined
}

/** Interpolated track value at a frame (evaluator math, no document needed). */
export const trackValueAt = (
  track: Pick<AnimationTrack, 'keyframes'> | null | undefined,
  frame: number,
): number | undefined => interpolateKeyframes(track?.keyframes ?? [], frame)

export const getTrack = (
  animation: Pick<InstanceAnimation, 'tracks'> | null | undefined,
  property: AnimatableProperty,
): AnimationTrack | undefined => animation?.tracks?.find((t) => t.property === property)

export const getTrackKeyframes = (
  animation: Pick<InstanceAnimation, 'tracks'> | null | undefined,
  property: AnimatableProperty,
): TimelineKeyframe[] => getTrack(animation, property)?.keyframes.slice() ?? []

export const findKeyframe = (
  animation: Pick<InstanceAnimation, 'tracks'> | null | undefined,
  property: AnimatableProperty,
  frame: number,
): TimelineKeyframe | undefined =>
  getTrack(animation, property)?.keyframes.find((k) => k.frame === frame)

export const isKeyedAt = (
  animation: Pick<InstanceAnimation, 'tracks'> | null | undefined,
  property: AnimatableProperty,
  frame: number,
): boolean => findKeyframe(animation, property, frame) !== undefined

const clampFrame = (frame: number, durationFrames: number): number => {
  if (!Number.isFinite(durationFrames) || durationFrames < 1) return 0
  if (!Number.isFinite(frame)) return 0
  return Math.min(Math.max(0, Math.floor(frame)), durationFrames - 1)
}

const baseAnimation = (animation: InstanceAnimation | null | undefined): InstanceAnimation => ({
  enter: animation?.enter ? [...animation.enter] : [],
  exit: animation?.exit ? [...animation.exit] : [],
  keyframes: Array.isArray(animation?.keyframes) ? [...animation.keyframes] : [],
  // Preserve shape: absent tracks stay absent so invalid input is a true no-op.
  ...(animation?.tracks
    ? {
        tracks: animation.tracks.map((t) => ({
          property: t.property,
          keyframes: t.keyframes.map((k) => ({ ...k })),
        })),
      }
    : {}),
})

/**
 * Normalize animation data: drop invalid properties, normalize keyframes via
 * the shared Stage 3A helper (invalid/duplicate frames handled there),
 * drop empty tracks, sort tracks in canonical order. Never mutates.
 */
export const normalizeAnimation = (
  animation: InstanceAnimation | null | undefined,
): InstanceAnimation => {
  const base = baseAnimation(animation)
  const tracks: AnimationTrack[] = []
  for (const track of base.tracks ?? []) {
    if (!isAnimatableProperty(track.property)) continue
    const keyframes = normalizeKeyframes(track.keyframes ?? [])
    if (keyframes.length === 0) continue
    tracks.push({
      property: track.property,
      keyframes: keyframes.map((k) => ({ ...k })),
    })
  }
  tracks.sort(
    (a, b) => CANONICAL_TRACK_ORDER.indexOf(a.property) - CANONICAL_TRACK_ORDER.indexOf(b.property),
  )
  return { ...base, tracks }
}

export interface KeyframeInput {
  frame: number
  value: number
  easing?: TimelineEasingName | string
}

/**
 * Insert or update a keyframe. Exactly one keyframe per property/frame;
 * frames stay sorted ascending. Invalid input (bad property, NaN value,
 * non-finite frame) leaves the animation unchanged. Frame is clamped to the
 * scene range. Never mutates.
 */
export const upsertKeyframe = (
  animation: InstanceAnimation | null | undefined,
  property: AnimatableProperty | string,
  input: KeyframeInput,
  durationFrames: number,
): InstanceAnimation => {
  if (!isAnimatableProperty(property)) return baseAnimation(animation)
  if (typeof input.value !== 'number' || !Number.isFinite(input.value)) {
    return baseAnimation(animation)
  }
  if (typeof input.frame !== 'number' || !Number.isFinite(input.frame)) {
    return baseAnimation(animation)
  }
  const frame = clampFrame(input.frame, durationFrames)
  const easing: TimelineEasingName = isEasingName(input.easing) ? input.easing : 'linear'
  const base = baseAnimation(animation)
  const tracks = [...(base.tracks ?? [])]
  const index = tracks.findIndex((t) => t.property === property)
  if (index === -1) {
    tracks.push({ property, keyframes: [{ frame, value: input.value, easing }] })
  } else {
    const keyframes = tracks[index].keyframes.filter((k) => k.frame !== frame)
    keyframes.push({ frame, value: input.value, easing })
    tracks[index] = { property, keyframes }
  }
  return normalizeAnimation({ ...base, tracks })
}

/**
 * Delete one keyframe. Removes the track when its last keyframe goes.
 * Never mutates.
 */
export const deleteKeyframe = (
  animation: InstanceAnimation | null | undefined,
  property: AnimatableProperty | string,
  frame: number,
): InstanceAnimation => {
  if (!isAnimatableProperty(property)) return baseAnimation(animation)
  const base = baseAnimation(animation)
  const tracks = (base.tracks ?? [])
    .map((t) =>
      t.property === property
        ? { ...t, keyframes: t.keyframes.filter((k) => k.frame !== frame) }
        : t,
    )
    .filter((t) => t.keyframes.length > 0)
  return normalizeAnimation({ ...base, tracks })
}

export interface MoveResult {
  animation: InstanceAnimation
  /** Frame the keyframe actually ended at (unchanged when blocked). */
  frame: number
  moved: boolean
}

/**
 * Move a keyframe in time. Integer frames ≥ 0 within the scene range.
 * Moving onto an occupied frame is a deterministic no-op (no duplicates,
 * no data loss). Updates the keyframe in place — never creates a new one.
 * Never mutates.
 */
export const moveKeyframe = (
  animation: InstanceAnimation | null | undefined,
  property: AnimatableProperty | string,
  fromFrame: number,
  toFrame: number,
  durationFrames: number,
): MoveResult => {
  const unchanged = { animation: baseAnimation(animation), frame: fromFrame, moved: false }
  if (!isAnimatableProperty(property)) return unchanged
  if (!Number.isInteger(fromFrame) || fromFrame < 0) return unchanged
  const target = clampFrame(toFrame, durationFrames)
  if (target === fromFrame) return { ...unchanged, frame: target }
  const track = getTrack(animation, property)
  const source = track?.keyframes.find((k) => k.frame === fromFrame)
  if (!source) return unchanged
  if (track?.keyframes.some((k) => k.frame === target)) {
    // Collision: deterministic no-op so two keyframes never share a frame.
    return unchanged
  }
  const keyframes = (track?.keyframes ?? [])
    .filter((k) => k.frame !== fromFrame)
    .concat([{ ...source, frame: target }])
  const base = baseAnimation(animation)
  const tracks = (base.tracks ?? []).map((t) =>
    t.property === property ? { ...t, keyframes } : t,
  )
  return { animation: normalizeAnimation({ ...base, tracks }), frame: target, moved: true }
};

/** Update a keyframe value (keyframe must exist). Never mutates. */
export const setKeyframeValue = (
  animation: InstanceAnimation | null | undefined,
  property: AnimatableProperty | string,
  frame: number,
  value: number,
): InstanceAnimation => {
  if (!isAnimatableProperty(property)) return baseAnimation(animation)
  if (typeof value !== 'number' || !Number.isFinite(value)) return baseAnimation(animation)
  const existing = findKeyframe(animation, property, frame)
  if (!existing) return baseAnimation(animation)
  return upsertKeyframe(animation, property, { frame, value, easing: existing.easing }, Number.MAX_SAFE_INTEGER)
};

/** Update a keyframe easing (keyframe must exist). Never mutates. */
export const setKeyframeEasing = (
  animation: InstanceAnimation | null | undefined,
  property: AnimatableProperty | string,
  frame: number,
  easing: TimelineEasingName | string,
): InstanceAnimation => {
  if (!isAnimatableProperty(property)) return baseAnimation(animation)
  const existing = findKeyframe(animation, property, frame)
  if (!existing) return baseAnimation(animation)
  return upsertKeyframe(
    animation,
    property,
    { frame, value: existing.value, easing: isEasingName(easing) ? easing : 'linear' },
    Number.MAX_SAFE_INTEGER,
  )
};
