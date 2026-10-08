import { describe, expect, it } from 'vitest'
import {
  buildGroupTree,
  childGroups,
  groupChildInstances,
  sortByZIndex,
  topLevelInstances,
} from './documentTree'
import type { ComponentInstance, DocumentGroup } from '../types/api'

const instance = (overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({
  id: `inst-${Math.random()}`,
  sceneId: 'scene-1',
  componentDefinitionId: 'def-1',
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

const group = (overrides: Partial<DocumentGroup> = {}): DocumentGroup => ({
  id: `group-${Math.random()}`,
  sceneId: 'scene-1',
  parentGroupId: null,
  name: 'G',
  zIndex: 0,
  ...overrides,
})

describe('documentTree', () => {
  it('sorts by zIndex without mutating the input', () => {
    const items = [{ zIndex: 2 }, { zIndex: 0 }, { zIndex: 1 }]
    const sorted = sortByZIndex(items)
    expect(sorted.map((i) => i.zIndex)).toEqual([0, 1, 2])
    expect(items[0].zIndex).toBe(2)
  })

  it('separates top-level instances from grouped ones', () => {
    const a = instance({ id: 'a' })
    const b = instance({ id: 'b', groupId: 'g1' })
    expect(topLevelInstances([a, b]).map((c) => c.id)).toEqual(['a'])
    expect(groupChildInstances([a, b], 'g1').map((c) => c.id)).toEqual(['b'])
  })

  it('keeps every instance individually addressable', () => {
    const five = ['F', '=', 'ma', 'arrow', 'force'].map((text, i) =>
      instance({ id: `inst-${i}`, props: { text }, zIndex: i }),
    )
    const top = topLevelInstances(five)
    expect(top).toHaveLength(5)
    expect(new Set(top.map((c) => c.id)).size).toBe(5)
  })

  it('builds nested group trees preserving hierarchy', () => {
    const a = group({ id: 'a', name: 'A' })
    const b = group({ id: 'b', name: 'B', parentGroupId: 'a' })
    const tree = buildGroupTree([b, a])
    expect(tree.map((g) => g.id)).toEqual(['a'])
    expect(tree[0].children.map((g) => g.id)).toEqual(['b'])
    expect(childGroups([a, b], 'a').map((g) => g.id)).toEqual(['b'])
    expect(childGroups([a, b], null).map((g) => g.id)).toEqual(['a'])
  })

  it('keeps orphaned groups visible instead of dropping them', () => {
    const orphan = group({ id: 'orphan', parentGroupId: 'missing' })
    expect(buildGroupTree([orphan]).map((g) => g.id)).toEqual(['orphan'])
  })
})
