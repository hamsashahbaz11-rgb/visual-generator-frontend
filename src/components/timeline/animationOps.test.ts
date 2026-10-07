import { describe, expect, it } from 'vitest'
import { connectorEndpointsFor, evaluateSceneAtFrame } from '@app/render'
import type { InstanceAnimation } from '../../types/api'
import {
  CANONICAL_TRACK_ORDER,
  deleteKeyframe,
  evaluatedValueAt,
  findKeyframe,
  getTrack,
  isKeyedAt,
  moveKeyframe,
  normalizeAnimation,
  readAnimatedValue,
  setKeyframeEasing,
  setKeyframeValue,
  upsertKeyframe,
} from './animationOps'

const empty: InstanceAnimation = { enter: [], exit: [], keyframes: [] }
const DUR = 300

const docWith = (animation: InstanceAnimation) => ({
  timeline: { fps: 30, durationFrames: DUR },
  components: [
    {
      id: 'ma',
      props: {},
      position: { x: 100, y: 0 },
      size: { width: 100, height: 100 },
      transform: { rotation: 0, scaleX: 1, scaleY: 1 },
      style: { opacity: 1 },
      visible: true,
      zIndex: 0,
      groupId: null,
      timing: { start: 0, duration: 2, startFrame: 0, durationFrames: DUR },
      animation,
    },
  ],
  groups: [],
})

describe('track creation', () => {
  it('creates exactly one track for a property with none', () => {
    const next = upsertKeyframe(empty, 'position.x', { frame: 30, value: 300 }, DUR)
    expect(next.tracks).toHaveLength(1)
    expect(next.tracks![0]).toEqual({
      property: 'position.x',
      keyframes: [{ frame: 30, value: 300, easing: 'linear' }],
    })
  })

  it('does not create another track when adding to the same property', () => {
    const one = upsertKeyframe(empty, 'position.x', { frame: 0, value: 100 }, DUR)
    const two = upsertKeyframe(one, 'position.x', { frame: 60, value: 500 }, DUR)
    expect(two.tracks).toHaveLength(1)
    expect(two.tracks![0].keyframes.map((k) => k.frame)).toEqual([0, 60])
  })

  it('keeps independent tracks per property', () => {
    let anim = upsertKeyframe(empty, 'position.x', { frame: 0, value: 1 }, DUR)
    anim = upsertKeyframe(anim, 'style.opacity', { frame: 0, value: 0.5 }, DUR)
    expect(anim.tracks).toHaveLength(2)
    expect(getTrack(anim, 'position.x')?.keyframes).toHaveLength(1)
    expect(getTrack(anim, 'style.opacity')?.keyframes).toHaveLength(1)
  })

  it('sorts tracks in canonical order regardless of creation order', () => {
    let anim = upsertKeyframe(empty, 'style.opacity', { frame: 0, value: 1 }, DUR)
    anim = upsertKeyframe(anim, 'position.x', { frame: 0, value: 1 }, DUR)
    expect(anim.tracks!.map((t) => t.property)).toEqual(['position.x', 'style.opacity'])
    expect(CANONICAL_TRACK_ORDER).toEqual([
      'position.x',
      'position.y',
      'size.width',
      'size.height',
      'transform.rotation',
      'transform.scaleX',
      'transform.scaleY',
      'style.opacity',
    ])
  })
})

describe('keyframe update', () => {
  it('updates the value instead of duplicating at an existing frame', () => {
    const one = upsertKeyframe(empty, 'position.x', { frame: 30, value: 300 }, DUR)
    const two = upsertKeyframe(one, 'position.x', { frame: 30, value: 350 }, DUR)
    expect(two.tracks![0].keyframes).toHaveLength(1)
    expect(two.tracks![0].keyframes[0].value).toBe(350)
    expect(isKeyedAt(two, 'position.x', 30)).toBe(true)
  })

  it('sorts frames ascending after out-of-order insertion', () => {
    let anim = upsertKeyframe(empty, 'position.x', { frame: 60, value: 500 }, DUR)
    anim = upsertKeyframe(anim, 'position.x', { frame: 0, value: 100 }, DUR)
    anim = upsertKeyframe(anim, 'position.x', { frame: 30, value: 300 }, DUR)
    expect(anim.tracks![0].keyframes.map((k) => k.frame)).toEqual([0, 30, 60])
  })
})

describe('keyframe deletion', () => {
  it('removes the keyframe but keeps the track', () => {
    let anim = upsertKeyframe(empty, 'position.x', { frame: 0, value: 100 }, DUR)
    anim = upsertKeyframe(anim, 'position.x', { frame: 60, value: 500 }, DUR)
    const next = deleteKeyframe(anim, 'position.x', 0)
    expect(next.tracks![0].keyframes.map((k) => k.frame)).toEqual([60])
  })

  it('removes the track when its final keyframe goes', () => {
    const one = upsertKeyframe(empty, 'position.x', { frame: 0, value: 100 }, DUR)
    const next = deleteKeyframe(one, 'position.x', 0)
    expect(next.tracks ?? []).toHaveLength(0)
  })
})

describe('move keyframe', () => {
  it('changes the frame and keeps order', () => {
    let anim = upsertKeyframe(empty, 'position.x', { frame: 0, value: 100 }, DUR)
    anim = upsertKeyframe(anim, 'position.x', { frame: 60, value: 500 }, DUR)
    const result = moveKeyframe(anim, 'position.x', 60, 45, DUR)
    expect(result.moved).toBe(true)
    expect(result.frame).toBe(45)
    expect(result.animation.tracks![0].keyframes.map((k) => k.frame)).toEqual([0, 45])
  })

  it('handles collisions deterministically: no duplicates, no data loss', () => {
    let anim = upsertKeyframe(empty, 'position.x', { frame: 0, value: 100 }, DUR)
    anim = upsertKeyframe(anim, 'position.x', { frame: 60, value: 500 }, DUR)
    const result = moveKeyframe(anim, 'position.x', 0, 60, DUR)
    expect(result.moved).toBe(false)
    expect(result.animation.tracks![0].keyframes).toHaveLength(2)
    expect(result.animation.tracks![0].keyframes.map((k) => k.frame)).toEqual([0, 60])
  })

  it('clamps to the scene range and floors to integers', () => {
    const anim = upsertKeyframe(empty, 'position.x', { frame: 10, value: 100 }, DUR)
    const toStart = moveKeyframe(anim, 'position.x', 10, -5, DUR)
    expect(toStart.frame).toBe(0)
    expect(toStart.moved).toBe(true)
    const clamped = moveKeyframe(anim, 'position.x', 10, 9999, DUR)
    expect(clamped.frame).toBe(DUR - 1)
    expect(clamped.moved).toBe(true)
  })

  it('is a no-op for unknown keyframes', () => {
    const result = moveKeyframe(empty, 'position.x', 10, 20, DUR)
    expect(result.moved).toBe(false)
  })
})

describe('value and easing editing', () => {
  const anim = upsertKeyframe(empty, 'position.x', { frame: 30, value: 300 }, DUR)

  it('edits the keyframe value without moving it', () => {
    const next = setKeyframeValue(anim, 'position.x', 30, 350)
    expect(findKeyframe(next, 'position.x', 30)?.value).toBe(350)
    expect(next.tracks![0].keyframes).toHaveLength(1)
  })

  it('edits easing without changing the value', () => {
    const next = setKeyframeEasing(anim, 'position.x', 30, 'easeOut')
    expect(findKeyframe(next, 'position.x', 30)).toEqual({
      frame: 30,
      value: 300,
      easing: 'easeOut',
    })
  })

  it('normalizes invalid easing to linear', () => {
    const next = setKeyframeEasing(anim, 'position.x', 30, 'spring')
    expect(findKeyframe(next, 'position.x', 30)?.easing).toBe('linear')
  })

  it('rejects non-finite values', () => {
    expect(setKeyframeValue(anim, 'position.x', 30, Number.NaN)).toEqual(anim)
  })
})

describe('capture evaluated value', () => {
  it('captures the interpolated value, not the base value', () => {
    // 0 → 100, 60 → 500: frame 30 evaluates to 300.
    let anim = upsertKeyframe(empty, 'position.x', { frame: 0, value: 100 }, DUR)
    anim = upsertKeyframe(anim, 'position.x', { frame: 60, value: 500 }, DUR)
    const document = docWith(anim)
    expect(evaluatedValueAt(document, 'ma', 'position.x', 30)).toBe(300)
    const captured = upsertKeyframe(
      anim,
      'position.x',
      { frame: 30, value: evaluatedValueAt(document, 'ma', 'position.x', 30)! },
      DUR,
    )
    expect(findKeyframe(captured, 'position.x', 30)?.value).toBe(300)
    expect(captured.tracks![0].keyframes.map((k) => k.frame)).toEqual([0, 30, 60])
  })

  it('reads base values for all eight properties', () => {
    const instance = docWith(empty).components[0]
    expect(readAnimatedValue(instance, 'position.x')).toBe(100)
    expect(readAnimatedValue(instance, 'position.y')).toBe(0)
    expect(readAnimatedValue(instance, 'size.width')).toBe(100)
    expect(readAnimatedValue(instance, 'size.height')).toBe(100)
    expect(readAnimatedValue(instance, 'transform.rotation')).toBe(0)
    expect(readAnimatedValue(instance, 'transform.scaleX')).toBe(1)
    expect(readAnimatedValue(instance, 'transform.scaleY')).toBe(1)
    expect(readAnimatedValue(instance, 'style.opacity')).toBe(1)
  })
})

describe('validation', () => {
  it('rejects invalid properties, NaN values, and non-finite frames', () => {
    expect(upsertKeyframe(empty, 'position.z', { frame: 0, value: 1 }, DUR)).toEqual(empty)
    expect(upsertKeyframe(empty, 'position.x', { frame: 0, value: Number.NaN }, DUR)).toEqual(empty)
    expect(
      upsertKeyframe(empty, 'position.x', { frame: Number.POSITIVE_INFINITY, value: 1 }, DUR),
    ).toEqual(empty)
  })

  it('normalizes messy animation data deterministically', () => {
    const messy: InstanceAnimation = {
      enter: [],
      exit: [],
      keyframes: [],
      tracks: [
        { property: 'style.opacity', keyframes: [{ frame: 60, value: 1 }] },
        { property: 'position.x', keyframes: [{ frame: 30, value: 1 }, { frame: 0, value: 0 }] },
        { property: 'position.z' as never, keyframes: [{ frame: 0, value: 0 }] },
        { property: 'position.y', keyframes: [] },
      ],
    }
    const next = normalizeAnimation(messy)
    expect(next.tracks!.map((t) => t.property)).toEqual(['position.x', 'style.opacity'])
    expect(next.tracks![0].keyframes.map((k) => k.frame)).toEqual([0, 30])
  })

  it('never mutates inputs', () => {
    const anim = upsertKeyframe(empty, 'position.x', { frame: 0, value: 100 }, DUR)
    const frozen = structuredClone(anim)
    Object.freeze(anim)
    upsertKeyframe(anim, 'position.x', { frame: 60, value: 500 }, DUR)
    deleteKeyframe(anim, 'position.x', 0)
    moveKeyframe(anim, 'position.x', 0, 45, DUR)
    setKeyframeValue(anim, 'position.x', 0, 1)
    setKeyframeEasing(anim, 'position.x', 0, 'easeOut')
    normalizeAnimation(anim)
    expect(anim).toEqual(frozen)
  })
})

describe('evaluator compatibility', () => {
  it('authored tracks evaluate to expected values', () => {
    let anim = upsertKeyframe(empty, 'position.x', { frame: 0, value: 100 }, DUR)
    anim = upsertKeyframe(anim, 'position.x', { frame: 60, value: 500 }, DUR)
    anim = upsertKeyframe(anim, 'position.x', { frame: 30, value: 300 }, DUR)
    const document = docWith(anim)
    expect(evaluateSceneAtFrame(document, 30).components[0].position.x).toBe(300)
    expect(evaluateSceneAtFrame(document, 15).components[0].position.x).toBe(200)
    // Stored base value is untouched by evaluation.
    expect(document.components[0].position.x).toBe(100)
  })

  it('animated referenced components still move connectors', () => {
    let anim = upsertKeyframe(empty, 'position.x', { frame: 0, value: 300 }, DUR)
    anim = upsertKeyframe(anim, 'position.x', { frame: 60, value: 700 }, DUR)
    const document = {
      timeline: { fps: 30, durationFrames: DUR },
      components: [
        { ...docWith(empty).components[0], id: 'f', position: { x: 100, y: 100 }, animation: empty },
        { ...docWith(empty).components[0], id: 'ma', position: { x: 300, y: 100 }, animation: anim },
        {
          ...docWith(empty).components[0],
          id: 'arrow',
          props: { from: 'f', to: 'ma' },
          animation: empty,
        },
      ],
      groups: [],
    }
    const at0 = evaluateSceneAtFrame(document, 0).components
    const at60 = evaluateSceneAtFrame(document, 60).components
    expect(connectorEndpointsFor(at0, at0[2])!.p2.x).toBe(300)
    expect(connectorEndpointsFor(at60, at60[2])!.p2.x).toBe(700)
  })
})
