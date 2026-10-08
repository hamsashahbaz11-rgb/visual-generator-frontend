import { describe, expect, it } from 'vitest'
import {
  MIN_SIZE,
  boundsCenter,
  clampSize,
  clipExit,
  componentBounds,
  connectorPoints,
  descendantInstanceIds,
  groupBounds,
  unionBounds,
} from './bounds'
import type { ComponentInstance, SceneDocument } from '../types/api'

const inst = (overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({
  id: `i-${Math.random().toString(36).slice(2)}`,
  sceneId: 's',
  componentDefinitionId: 'd',
  groupId: null,
  props: {},
  position: { x: 0, y: 0 },
  size: { width: 100, height: 50 },
  transform: { rotation: 0, scaleX: 1, scaleY: 1 },
  style: { opacity: 1 },
  visible: true,
  zIndex: 0,
  timing: { start: 0, duration: 2 },
  animation: { enter: [], exit: [], keyframes: [] },
  ...overrides,
})

const doc = (
  components: ComponentInstance[],
  groups: SceneDocument['groups'] = [],
): SceneDocument => ({
  id: 's',
  projectId: 'p',
  name: 'S',
  components,
  groups,
})

describe('bounds', () => {
  it('reads component bounds from position and size', () => {
    expect(
      componentBounds(inst({ position: { x: 10, y: 20 }, size: { width: 30, height: 40 } })),
    ).toEqual({ x: 10, y: 20, width: 30, height: 40 })
    expect(boundsCenter({ x: 0, y: 0, width: 10, height: 20 })).toEqual({ x: 5, y: 10 })
  })

  it('unions boxes and returns null when empty', () => {
    expect(unionBounds([])).toBeNull()
    expect(
      unionBounds([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 5, y: 20, width: 10, height: 10 },
      ]),
    ).toEqual({ x: 0, y: 0, width: 15, height: 30 })
  })

  it('computes group bounds from visible descendants, recursively', () => {
    const a = inst({ id: 'a', groupId: 'g', position: { x: 0, y: 0 } })
    const b = inst({ id: 'b', groupId: 'g', position: { x: 200, y: 100 }, visible: false })
    const c = inst({ id: 'c', groupId: 'nested', position: { x: 50, y: 300 } })
    const d = doc(
      [a, b, c],
      [
        { id: 'g', sceneId: 's', parentGroupId: null, name: 'G', zIndex: 0 },
        { id: 'nested', sceneId: 's', parentGroupId: 'g', name: 'N', zIndex: 0 },
      ],
    )
    // hidden b excluded; nested c included via recursion
    expect(groupBounds(d, 'g')).toEqual({ x: 0, y: 0, width: 150, height: 350 })
    expect(groupBounds(d, 'nested')).toEqual({ x: 50, y: 300, width: 100, height: 50 })
    expect(groupBounds(d, 'missing')).toBeNull()
    expect(descendantInstanceIds(d, 'g').sort()).toEqual(['a', 'b', 'c'])
  })

  it('clips connector endpoints to box edges', () => {
    const from = { x: 0, y: 0, width: 100, height: 100 }
    const to = { x: 300, y: 0, width: 100, height: 100 }
    const { p1, p2 } = connectorPoints(from, to)
    expect(p1).toEqual({ x: 100, y: 50 })
    expect(p2).toEqual({ x: 300, y: 50 })
  })

  it('falls back to centers for coincident boxes', () => {
    const box = { x: 10, y: 10, width: 20, height: 20 }
    expect(connectorPoints(box, box)).toEqual({ p1: { x: 20, y: 20 }, p2: { x: 20, y: 20 } })
    expect(clipExit(box, { x: 20, y: 20 }, { x: 20, y: 20 })).toEqual({ x: 20, y: 20 })
  })

  it('clamps sizes to a minimum', () => {
    expect(clampSize({ width: 2, height: -5 })).toEqual({ width: MIN_SIZE, height: MIN_SIZE })
  })
})
