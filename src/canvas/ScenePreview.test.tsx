// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScenePreview } from './ScenePreview'
import { SceneCanvas } from './SceneCanvas'
import type { Component, ComponentInstance, SceneDocument } from '../types/api'

const labelDef: Component = {
  id: 'def-label',
  name: 'Label',
  displayName: 'Label',
  description: 'text',
  propsSchema: {},
  defaultProps: {},
  enterStyles: [],
  exitStyles: [],
  colorProps: [],
  refProps: [],
  assetProps: [],
  isPublic: true,
  createdAt: '',
  updatedAt: '',
}

const arrowDef: Component = {
  ...labelDef,
  id: 'def-arrow',
  name: 'Arrow',
  displayName: 'Arrow',
  refProps: ['from', 'to'],
}

const definitions = new Map([
  [labelDef.id, labelDef],
  [arrowDef.id, arrowDef],
])

const inst = (overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({
  id: `i-${Math.random().toString(36).slice(2)}`,
  sceneId: 's',
  componentDefinitionId: 'def-label',
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

const lineAttrs = (root: ParentNode) => {
  const line = root.querySelector('line') as SVGLineElement | null
  if (!line) return null
  const attr = (name: string) => line.getAttribute(name)
  return { x1: attr('x1'), y1: attr('y1'), x2: attr('x2'), y2: attr('y2') }
}

describe('ScenePreview', () => {
  it('renders F, =, ma as independent instances', () => {
    const { container } = render(
      <ScenePreview
        document={doc([
          inst({ id: 'f', props: { text: 'F' } }),
          inst({ id: 'eq', props: { text: '=' } }),
          inst({ id: 'ma', props: { text: 'ma' } }),
        ])}
        definitions={definitions}
      />,
    )
    for (const id of ['f', 'eq', 'ma']) {
      expect(container.querySelector(`[data-instance-id="${id}"]`)).toBeTruthy()
    }
    expect(screen.getByText('F')).toBeTruthy()
    expect(screen.getByText('ma')).toBeTruthy()
  })

  it('renders nested groups with all descendants and preserved hierarchy', () => {
    const { container } = render(
      <ScenePreview
        document={doc(
          [
            inst({ id: 'a', groupId: 'gb' }),
            inst({ id: 'b', groupId: 'gb' }),
            inst({ id: 'c', groupId: 'ga' }),
          ],
          [
            { id: 'ga', sceneId: 's', parentGroupId: null, name: 'A', zIndex: 0 },
            { id: 'gb', sceneId: 's', parentGroupId: 'ga', name: 'B', zIndex: 0 },
          ],
        )}
        definitions={definitions}
      />,
    )
    for (const id of ['a', 'b', 'c']) {
      expect(container.querySelector(`[data-instance-id="${id}"]`)).toBeTruthy()
    }
    const ga = container.querySelector('[data-group-id="ga"]') as HTMLElement
    const gb = container.querySelector('[data-group-id="gb"]') as HTMLElement
    expect(ga.contains(gb)).toBe(true)
  })

  it('skips hidden instances but keeps opacity-0 ones', () => {
    const { container } = render(
      <ScenePreview
        document={doc([
          inst({ id: 'hidden', visible: false }),
          inst({ id: 'ghost', style: { opacity: 0 } }),
        ])}
        definitions={definitions}
      />,
    )
    expect(container.querySelector('[data-instance-id="hidden"]')).toBeNull()
    const ghost = container.querySelector('[data-instance-id="ghost"]') as HTMLElement
    expect(ghost.style.opacity).toBe('0')
  })

  it('interprets position/size/transform consistently', () => {
    const { container } = render(
      <ScenePreview
        document={doc([
          inst({
            id: 't',
            position: { x: 100, y: 200 },
            size: { width: 400, height: 200 },
            transform: { rotation: 30, scaleX: 2, scaleY: 0.5 },
            style: { opacity: 0.5 },
            zIndex: 7,
          }),
        ])}
        definitions={definitions}
      />,
    )
    const node = container.querySelector('[data-instance-id="t"]') as HTMLElement
    expect(node.style.left).toBe('100px')
    expect(node.style.top).toBe('200px')
    expect(node.style.width).toBe('400px')
    expect(node.style.height).toBe('200px')
    expect(node.style.opacity).toBe('0.5')
    expect(node.style.transform).toBe('rotate(30deg) scale(2, 0.5)')
    expect(node.style.zIndex).toBe('7')
  })

  it('orders paint by ascending z-index', () => {
    const { container } = render(
      <ScenePreview
        document={doc([
          inst({ id: 'front', zIndex: 9 }),
          inst({ id: 'back', zIndex: 1 }),
          inst({ id: 'middle', zIndex: 5 }),
        ])}
        definitions={definitions}
      />,
    )
    const order = [...container.querySelectorAll('[data-instance-id]')].map((n) =>
      n.getAttribute('data-instance-id'),
    )
    expect(order).toEqual(['back', 'middle', 'front'])
  })

  it('resolves arrow references and follows moved components', () => {
    const f = inst({ id: 'f', position: { x: 100, y: 100 } })
    const ma = inst({ id: 'ma', position: { x: 300, y: 100 } })
    const arrow = inst({
      id: 'arrow',
      componentDefinitionId: 'def-arrow',
      props: { from: 'f', to: 'ma' },
    })
    const { container, rerender } = render(
      <ScenePreview document={doc([f, ma, arrow])} definitions={definitions} />,
    )
    expect(lineAttrs(container)).toEqual({ x1: '200', y1: '150', x2: '300', y2: '150' })
    rerender(
      <ScenePreview
        document={doc([{ ...f, position: { x: 0, y: 400 } }, ma, arrow])}
        definitions={definitions}
      />,
    )
    const moved = lineAttrs(container)
    expect(moved?.x1).toBe('100')
    expect(moved?.y1).not.toBe('150')
  })

  it('renders a safe fallback for missing references', () => {
    const { container } = render(
      <ScenePreview
        document={doc([
          inst({ id: 'arrow', componentDefinitionId: 'def-arrow', props: { from: 'gone', to: '' } }),
        ])}
        definitions={definitions}
      />,
    )
    expect(lineAttrs(container)?.x1).toBe('8')
  })

  it('renders the unsupported fallback for unknown components', () => {
    const { container } = render(
      <ScenePreview
        document={doc([inst({ id: 'weird', componentDefinitionId: 'def-missing' })])}
        definitions={definitions}
      />,
    )
    const node = container.querySelector('[data-instance-id="weird"]') as HTMLElement
    expect(node.textContent).toContain('Unsupported component')
  })

  it('renders no interaction chrome', () => {
    const { container } = render(
      <ScenePreview document={doc([inst({ id: 'a' })])} definitions={definitions} />,
    )
    expect(container.querySelector('.canvas-resize-handle')).toBeNull()
    expect(container.querySelector('.canvas-selection')).toBeNull()
    expect(container.querySelector('[data-testid="snap-guide"]')).toBeNull()
    expect(container.querySelector('.canvas-group-outline')).toBeNull()
  })

  it('is deterministic for the same document', () => {
    const document = doc(
      [
        inst({ id: 'a', zIndex: 2 }),
        inst({ id: 'b', groupId: 'g', zIndex: 2 }),
      ],
      [{ id: 'g', sceneId: 's', parentGroupId: null, name: 'G', zIndex: 1 }],
    )
    const first = render(<ScenePreview document={document} definitions={definitions} />)
    const firstHtml = first.container.innerHTML
    first.unmount()
    const second = render(<ScenePreview document={document} definitions={definitions} />)
    expect(second.container.innerHTML).toBe(firstHtml)
  })

  it('does not mutate the document while rendering', () => {
    const document = doc([inst({ id: 'a' })])
    const before = JSON.stringify(document)
    render(<ScenePreview document={document} definitions={definitions} />)
    expect(JSON.stringify(document)).toBe(before)
  })

  it('matches canvas paint order, positions and styles (editor parity)', () => {
    const document = doc(
      [
        inst({ id: 'front', zIndex: 9, position: { x: 10, y: 20 } }),
        inst({ id: 'back', zIndex: 1, position: { x: 30, y: 40 }, style: { opacity: 0.5 } }),
        inst({ id: 'gchild', groupId: 'g', zIndex: 3, position: { x: 50, y: 60 } }),
      ],
      [{ id: 'g', sceneId: 's', parentGroupId: null, name: 'G', zIndex: 5 }],
    )
    const snapshotOf = (root: ParentNode) =>
      [...root.querySelectorAll('[data-instance-id]')].map((n) => {
        const el = n as HTMLElement
        return [
          el.getAttribute('data-instance-id'),
          el.style.left,
          el.style.top,
          el.style.opacity,
          el.style.transform,
          el.style.zIndex,
        ].join('|')
      })
    const preview = render(<ScenePreview document={document} definitions={definitions} />)
    const previewSnap = snapshotOf(preview.container)
    preview.unmount()
    const canvas = render(<SceneCanvas document={document} definitions={definitions} />)
    expect(snapshotOf(canvas.container)).toEqual(previewSnap)
  })
})
