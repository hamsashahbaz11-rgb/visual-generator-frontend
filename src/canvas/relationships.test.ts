import { describe, expect, it } from 'vitest'
import {
  RELATIONSHIP_TYPES,
  validateRelationship,
  type ComponentRelationship,
} from './relationships'
import type { SceneDocument } from '../types/api'

const doc: SceneDocument = {
  id: 's',
  projectId: 'p',
  name: 'S',
  components: [
    {
      id: 'a',
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
    },
    {
      id: 'b',
      sceneId: 's',
      componentDefinitionId: 'd',
      groupId: null,
      props: {},
      position: { x: 200, y: 0 },
      size: { width: 100, height: 100 },
      transform: { rotation: 0, scaleX: 1, scaleY: 1 },
      style: { opacity: 1 },
      visible: true,
      zIndex: 1,
      timing: { start: 0, duration: 2 },
      animation: { enter: [], exit: [], keyframes: [] },
    },
  ],
  groups: [],
}

describe('relationships', () => {
  it('declares the future relationship vocabulary', () => {
    expect([...RELATIONSHIP_TYPES]).toEqual([
      'leftOf',
      'rightOf',
      'above',
      'below',
      'centeredOn',
      'alignedWith',
      'attachedTo',
    ])
  })

  it('accepts a valid same-scene relationship', () => {
    const rel: ComponentRelationship = { type: 'rightOf', target: 'b', gap: 20 }
    expect(validateRelationship(doc, 'a', rel)).toEqual({ ok: true })
  })

  it('accepts relationships without a gap', () => {
    expect(validateRelationship(doc, 'a', { type: 'below', target: 'b' })).toEqual({ ok: true })
  })

  it('rejects unknown types', () => {
    const result = validateRelationship(doc, 'a', {
      type: 'orbiting' as never,
      target: 'b',
    })
    expect(result).toEqual({
      ok: false,
      issue: { code: 'UNKNOWN_TYPE', message: expect.any(String) },
    })
  })

  it('rejects targets outside the scene', () => {
    const result = validateRelationship(doc, 'a', { type: 'rightOf', target: 'ghost' })
    expect(result).toEqual({
      ok: false,
      issue: { code: 'UNKNOWN_TARGET', message: expect.any(String) },
    })
  })

  it('rejects self references', () => {
    const result = validateRelationship(doc, 'a', { type: 'attachedTo', target: 'a' })
    expect(result).toEqual({
      ok: false,
      issue: { code: 'SELF_REFERENCE', message: expect.any(String) },
    })
  })

  it('rejects invalid gaps', () => {
    for (const gap of [-1, NaN, Infinity]) {
      const result = validateRelationship(doc, 'a', { type: 'rightOf', target: 'b', gap })
      expect(result).toEqual({
        ok: false,
        issue: { code: 'INVALID_GAP', message: expect.any(String) },
      })
    }
  })
})
