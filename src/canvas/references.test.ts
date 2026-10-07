import { describe, expect, it } from 'vitest'
import {
  describeInstance,
  instanceRefId,
  instanceReferences,
  refPropsOf,
  resolveInstanceRef,
} from './references'
import type { Component, ComponentInstance } from '../types/api'

const arrowDef = {
  id: 'def-arrow',
  name: 'Arrow',
  displayName: 'Arrow',
  description: '',
  propsSchema: {},
  defaultProps: {},
  enterStyles: [],
  exitStyles: [],
  colorProps: [],
  refProps: ['from', 'to'],
  assetProps: [],
  isPublic: true,
  createdAt: '',
  updatedAt: '',
} as Component

const inst = (id: string, props: Record<string, unknown> = {}): ComponentInstance => ({
  id,
  sceneId: 's',
  componentDefinitionId: 'def-label',
  groupId: null,
  props,
  position: { x: 0, y: 0 },
  size: { width: 100, height: 50 },
  transform: { rotation: 0, scaleX: 1, scaleY: 1 },
  style: { opacity: 1 },
  visible: true,
  zIndex: 0,
  timing: { start: 0, duration: 2 },
  animation: { enter: [], exit: [], keyframes: [] },
})

describe('references', () => {
  it('reads declared ref props from the definition', () => {
    expect(refPropsOf(arrowDef)).toEqual(['from', 'to'])
    expect(refPropsOf(undefined)).toEqual([])
    expect(refPropsOf(null)).toEqual([])
  })

  it('extracts set references and treats empty as unset', () => {
    const arrow = inst('arrow-1', { from: 'inst-f', to: '' })
    expect(instanceRefId(arrow, 'from')).toBe('inst-f')
    expect(instanceRefId(arrow, 'to')).toBeNull()
    expect(instanceRefId(arrow, 'missing')).toBeNull()
    expect(instanceReferences(arrow, arrowDef)).toEqual([{ prop: 'from', targetId: 'inst-f' }])
  })

  it('resolves ids against the scene and returns undefined when missing', () => {
    const f = inst('inst-f', { text: 'F' })
    expect(resolveInstanceRef([f], 'inst-f')).toBe(f)
    expect(resolveInstanceRef([f], 'nope')).toBeUndefined()
  })

  it('describes instances for reference pickers', () => {
    expect(describeInstance(inst('abcdefgh-1234', { text: 'ma' }), { ...arrowDef, name: 'Label' }))
      .toBe('Label "ma" · abcdefgh')
  })
})
