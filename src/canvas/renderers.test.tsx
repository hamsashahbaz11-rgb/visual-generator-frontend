// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { resolveRenderer } from './renderers'
import type { ComponentInstance, SceneDocument } from '../types/api'

const inst = (overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({
  id: `i-${Math.random().toString(36).slice(2)}`,
  sceneId: 's',
  componentDefinitionId: 'def-arrow',
  groupId: null,
  props: {},
  position: { x: 0, y: 0 },
  size: { width: 560, height: 120 },
  transform: { rotation: 0, scaleX: 1, scaleY: 1 },
  style: { opacity: 1 },
  visible: true,
  zIndex: 0,
  timing: { start: 0, duration: 2 },
  animation: { enter: [], exit: [], keyframes: [] },
  ...overrides,
})

const Arrow = resolveRenderer('Arrow')

const doc = (components: ComponentInstance[]): SceneDocument => ({
  id: 's',
  projectId: 'p',
  name: 'S',
  components,
  groups: [],
})

const renderArrow = (instance: ComponentInstance, document: SceneDocument) =>
  render(<Arrow instance={instance} definitionName="Arrow" document={document} />)

describe('ArrowRenderer', () => {
  it('draws between referenced components using edge-clipped endpoints', () => {
    const f = inst({ id: 'f', position: { x: 100, y: 100 }, size: { width: 100, height: 100 } })
    const ma = inst({ id: 'ma', position: { x: 300, y: 100 }, size: { width: 100, height: 100 } })
    const arrow = inst({ id: 'arrow', props: { from: 'f', to: 'ma' } })
    renderArrow(arrow, doc([f, ma, arrow]))
    const line = document.querySelector('line') as SVGLineElement
    // centers (150,150)->(350,150) clipped to box edges: 200 -> 300
    expect(line.getAttribute('x1')).toBe('200')
    expect(line.getAttribute('x2')).toBe('300')
    expect(line.getAttribute('y1')).toBe('150')
    expect(line.getAttribute('y2')).toBe('150')
  })

  it('follows a referenced component when it moves', () => {
    const f = inst({ id: 'f', position: { x: 100, y: 100 }, size: { width: 100, height: 100 } })
    const ma = inst({ id: 'ma', position: { x: 300, y: 100 }, size: { width: 100, height: 100 } })
    const arrow = inst({ id: 'arrow', props: { from: 'f', to: 'ma' } })
    const { rerender } = renderArrow(arrow, doc([f, ma, arrow]))
    const moved = { ...f, position: { x: 0, y: 400 } }
    rerender(<Arrow instance={arrow} definitionName="Arrow" document={doc([moved, ma, arrow])} />)
    const line = document.querySelector('line') as SVGLineElement
    // from-center is now (50,450); right edge of F's box on the way to ma
    expect(line.getAttribute('x1')).toBe('100')
    expect(line.getAttribute('y1')).not.toBe('150')
  })

  it('falls back safely when a reference is missing', () => {
    const arrow = inst({ id: 'arrow', props: { from: 'gone', to: '' } })
    renderArrow(arrow, doc([arrow]))
    const line = document.querySelector('line') as SVGLineElement
    expect(line).toBeTruthy()
    // fallback draws inside the arrow's own box without crashing
    expect(line.getAttribute('x1')).toBe('8')
  })
})
