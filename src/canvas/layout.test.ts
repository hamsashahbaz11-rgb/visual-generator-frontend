import { describe, expect, it } from 'vitest'
import {
  SNAP_THRESHOLD,
  alignComponents,
  alignSubjects,
  canvasBounds,
  distributeComponents,
  distributeSubjects,
  findOverlappingComponents,
  normalizeDocumentLayers,
  normalizeScopeZ,
  selectionSubjects,
  snapBounds,
} from './layout'
import type { ComponentInstance, SceneDocument } from '../types/api'

const inst = (overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({
  id: `i-${Math.random().toString(36).slice(2)}`,
  sceneId: 's',
  componentDefinitionId: 'd',
  groupId: null,
  props: {},
  position: { x: 0, y: 0 },
  size: { width: 100, height: 100 },
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

const trio = () => {
  const a = inst({ id: 'a', position: { x: 0, y: 0 } })
  const b = inst({ id: 'b', position: { x: 200, y: 50 } })
  const c = inst({ id: 'c', position: { x: 500, y: 0 } })
  return { a, b, c, d: doc([a, b, c]) }
}

const posOf = (updates: Array<{ id: string; position: { x: number; y: number } }>, id: string) =>
  updates.find((u) => u.id === id)?.position

describe('alignment', () => {
  it.each([
    ['left', { b: { x: 0, y: 50 }, c: { x: 0, y: 0 } }],
    ['centerX', { a: { x: 250, y: 0 }, b: { x: 250, y: 50 }, c: { x: 250, y: 0 } }],
    ['right', { a: { x: 500, y: 0 }, b: { x: 500, y: 50 } }],
    ['top', { b: { x: 200, y: 0 } }],
    ['middle', { a: { x: 0, y: 25 }, b: { x: 200, y: 25 }, c: { x: 500, y: 25 } }],
    ['bottom', { a: { x: 0, y: 50 }, c: { x: 500, y: 50 } }],
  ] as const)('align %s moves the expected instances', (mode, expected) => {
    const { a, b, c, d } = trio()
    const subjects = selectionSubjects(d, [a.id, b.id, c.id], [])
    const updates = alignSubjects(d, subjects, mode)
    for (const [id, position] of Object.entries(expected)) {
      expect(posOf(updates, id)).toEqual(position)
    }
  })

  it('aligns a single instance within the canvas frame', () => {
    const { a, d } = trio()
    const updates = alignComponents(d, [a.id], 'centerX')
    // canvas 1600 wide → center 800, box 100 wide → x 750
    expect(posOf(updates, a.id)).toEqual({ x: 750, y: 0 })
  })

  it('treats a selected group as one geometric subject', () => {
    const a = inst({ id: 'a', groupId: 'g', position: { x: 0, y: 0 } })
    const b = inst({ id: 'b', groupId: 'g', position: { x: 200, y: 0 } })
    const d = doc([a, b], [
      { id: 'g', sceneId: 's', parentGroupId: null, name: 'G', zIndex: 0 },
    ])
    const subjects = selectionSubjects(d, [], ['g'])
    expect(subjects).toHaveLength(1)
    expect(subjects[0].memberIds.sort()).toEqual(['a', 'b'])
    const updates = alignSubjects(d, subjects, 'right', canvasBounds())
    // group bounds right edge 300 → canvas right 1600: both members shift +1300
    expect(posOf(updates, 'a')).toEqual({ x: 1300, y: 0 })
    expect(posOf(updates, 'b')).toEqual({ x: 1500, y: 0 })
  })

  it('dedupes instances already covered by a selected group', () => {
    const a = inst({ id: 'a', groupId: 'g', position: { x: 50, y: 0 } })
    const d = doc([a], [
      { id: 'g', sceneId: 's', parentGroupId: null, name: 'G', zIndex: 0 },
    ])
    expect(selectionSubjects(d, ['a'], ['g'])).toHaveLength(1)
  })
})

describe('distribution', () => {
  it('distributes horizontally, preserving first and last', () => {
    const { a, b, c, d } = trio()
    const updates = distributeComponents(d, [a.id, b.id, c.id], 'horizontal')
    // first/last keep their positions (no update emitted); middle moves to 250
    expect(updates).toHaveLength(1)
    expect(posOf(updates ?? [], 'b')).toEqual({ x: 250, y: 50 })
  })

  it('distributes vertically', () => {
    const a = inst({ id: 'a', position: { x: 0, y: 0 } })
    const b = inst({ id: 'b', position: { x: 0, y: 90 } })
    const c = inst({ id: 'c', position: { x: 0, y: 300 } })
    const d = doc([a, b, c])
    const updates = distributeSubjects(d, selectionSubjects(d, ['a', 'b', 'c'], []), 'vertical')
    expect(posOf(updates ?? [], 'b')).toEqual({ x: 0, y: 150 })
  })

  it('rejects fewer than 3 subjects', () => {
    const { a, b, d } = trio()
    expect(distributeComponents(d, [a.id, b.id], 'horizontal')).toBeNull()
    expect(distributeComponents(d, [a.id], 'vertical')).toBeNull()
  })
})

describe('layer normalization', () => {
  it('removes duplicates while preserving visual order', () => {
    expect(
      normalizeScopeZ([
        { id: 'a', zIndex: 0 },
        { id: 'b', zIndex: 0 },
        { id: 'c', zIndex: 5 },
      ]),
    ).toEqual([
      { id: 'b', zIndex: 1 },
      { id: 'c', zIndex: 2 },
    ])
    expect(
      normalizeScopeZ([
        { id: 'a', zIndex: 3 },
        { id: 'b', zIndex: 1 },
        { id: 'c', zIndex: 1 },
      ]),
    ).toEqual([
      { id: 'b', zIndex: 0 },
      { id: 'a', zIndex: 2 },
    ])
  })

  it('normalizes every scope in the document, including nested groups', () => {
    const d = doc(
      [
        inst({ id: 't1', zIndex: 4 }),
        inst({ id: 't2', zIndex: 4 }),
        inst({ id: 'm1', groupId: 'g', zIndex: 7 }),
        inst({ id: 'm2', groupId: 'g', zIndex: 7 }),
      ],
      [
        { id: 'g', sceneId: 's', parentGroupId: null, name: 'G', zIndex: 3 },
        { id: 'n', sceneId: 's', parentGroupId: 'g', name: 'N', zIndex: 9 },
      ],
    )
    const { instances, groups } = normalizeDocumentLayers(d)
    expect(instances).toEqual([
      { id: 't1', zIndex: 0 },
      { id: 't2', zIndex: 1 },
      { id: 'm1', zIndex: 0 },
      { id: 'm2', zIndex: 1 },
    ])
    expect(groups).toEqual([
      { id: 'g', zIndex: 0 },
      { id: 'n', zIndex: 0 },
    ])
  })
})

describe('snapping', () => {
  const frame = { x: 0, y: 0, width: 1600, height: 900 }
  const other = { x: 300, y: 0, width: 100, height: 100 }

  it('snaps an edge to a nearby edge', () => {
    const result = snapBounds({ x: 192, y: 0, width: 100, height: 100 }, [other], frame)
    expect(result.position).toEqual({ x: 200, y: 0 })
    expect(result.guides).toContainEqual({ orientation: 'vertical', position: 300 })
  })

  it('snaps centers', () => {
    // different widths isolate center snapping: moving centerX 348 vs 350,
    // while no edge is near any candidate line.
    const result = snapBounds({ x: 318, y: 400, width: 60, height: 100 }, [other], frame)
    expect(result.position.x).toBe(320)
    expect(result.guides).toContainEqual({ orientation: 'vertical', position: 350 })
  })

  it('snaps to the canvas center', () => {
    const result = snapBounds({ x: 745, y: 400, width: 100, height: 100 }, [], frame)
    expect(result.position.x).toBe(750)
    expect(result.guides).toContainEqual({ orientation: 'vertical', position: 800 })
  })

  it('respects the threshold and leaves distant boxes alone', () => {
    const result = snapBounds({ x: 100, y: 200, width: 100, height: 100 }, [other], frame, SNAP_THRESHOLD)
    expect(result.position).toEqual({ x: 100, y: 200 })
    expect(result.guides).toEqual([])
  })
})

describe('collision', () => {
  it('detects overlaps and finds overlapping components', () => {
    const a = inst({ id: 'a', position: { x: 0, y: 0 } })
    const b = inst({ id: 'b', position: { x: 50, y: 50 } })
    const c = inst({ id: 'c', position: { x: 500, y: 500 } })
    const hidden = inst({ id: 'h', position: { x: 10, y: 10 }, visible: false })
    const d = doc([a, b, c, hidden])
    expect(findOverlappingComponents(d, 'a').sort()).toEqual(['b'])
    expect(findOverlappingComponents(d, 'c')).toEqual([])
    expect(findOverlappingComponents(d, 'missing')).toEqual([])
  })
})
