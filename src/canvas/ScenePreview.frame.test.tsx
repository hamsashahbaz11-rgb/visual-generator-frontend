// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ScenePreview } from './ScenePreview'
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

const definitions = new Map([[labelDef.id, labelDef]])

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
  timeline: SceneDocument['timeline'] = { fps: 30, durationFrames: 300 },
): SceneDocument => ({
  id: 's',
  projectId: 'p',
  name: 'S',
  timeline,
  components,
  groups,
})

const leftOf = (container: HTMLElement, id: string): string | null => {
  const el = container.querySelector(`[data-instance-id="${id}"]`) as HTMLElement | null
  return el ? el.style.left : null
}

// Stage 3B: frontend preview shares the Stage 3A evaluator with Remotion —
// same document + same frame = same evaluated scene.
describe('ScenePreview frame parity', () => {
  it('defaults to frame 0, keeping static scenes unchanged', () => {
    const document = doc([inst({ id: 'a', position: { x: 100, y: 50 } })])
    const { container } = render(<ScenePreview document={document} definitions={definitions} />)
    expect(leftOf(container, 'a')).toBe('100px')
  })

  it('evaluates position animation at the requested frame', () => {
    const document = doc([
      inst({
        id: 'ma',
        position: { x: 100, y: 0 },
        timing: { start: 0, duration: 2, startFrame: 0, durationFrames: 300 },
        animation: {
          enter: [],
          exit: [],
          keyframes: [],
          tracks: [
            {
              property: 'position.x',
              keyframes: [
                { frame: 0, value: 100 },
                { frame: 30, value: 500 },
              ],
            },
          ],
        },
      }),
    ])
    const at0 = render(
      <ScenePreview document={document} definitions={definitions} frame={0} />,
    )
    expect(leftOf(at0.container, 'ma')).toBe('100px')
    at0.unmount()
    const at30 = render(
      <ScenePreview document={document} definitions={definitions} frame={30} />,
    )
    expect(leftOf(at30.container, 'ma')).toBe('500px')
  })

  it('hides instances outside their timing range but keeps them resolvable', () => {
    const snapshot = doc([
      inst({ id: 'a', timing: { start: 0, duration: 2, startFrame: 30, durationFrames: 60 } }),
    ])
    const before = JSON.stringify(snapshot)
    const { container } = render(
      <ScenePreview document={snapshot} definitions={definitions} frame={29} />,
    )
    expect(container.querySelector('[data-instance-id="a"]')).toBeNull()
    const during = render(
      <ScenePreview document={snapshot} definitions={definitions} frame={30} />,
    )
    expect(during.container.querySelector('[data-instance-id="a"]')).not.toBeNull()
    expect(JSON.stringify(snapshot)).toBe(before)
  })
})
