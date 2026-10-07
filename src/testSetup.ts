import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// testing-library auto-cleanup (replaces the globals-based setup).
afterEach(() => {
  cleanup()
})

// jsdom has no PointerEvent constructor, so fireEvent.pointerDown/move fall
// back to generic Events that drop button/clientX/clientY. Real browsers
// always provide them, so polyfill PointerEvent on top of MouseEvent to make
// interaction tests faithful.
if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number
    constructor(
      type: string,
      init: MouseEventInit & { pointerId?: number } = {},
    ) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent
}
