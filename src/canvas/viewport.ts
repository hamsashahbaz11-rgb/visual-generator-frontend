// Canvas/world coordinate boundary (Stage 2A).
//
// The document model is the source of truth: ComponentInstance.position
// {x, y} is a point in *world* coordinates. The canvas renders world space
// through a viewport transform. Zoom/pan (Stage 2C+) only change the
// viewport — the document model never changes.

export interface CanvasViewport {
  /** Pixels on screen per world unit. 1 until zoom is implemented. */
  scale: number
  /** Screen-space pan offset in pixels. 0 until pan is implemented. */
  offsetX: number
  offsetY: number
}

export const DEFAULT_VIEWPORT: CanvasViewport = { scale: 1, offsetX: 0, offsetY: 0 }

/** Logical scene size in world units. Components position themselves inside it. */
export const WORLD = { width: 1600, height: 900 } as const

export const worldToScreen = (
  point: { x: number; y: number },
  viewport: CanvasViewport = DEFAULT_VIEWPORT,
): { x: number; y: number } => ({
  x: point.x * viewport.scale + viewport.offsetX,
  y: point.y * viewport.scale + viewport.offsetY,
})

export const screenToWorld = (
  point: { x: number; y: number },
  viewport: CanvasViewport = DEFAULT_VIEWPORT,
): { x: number; y: number } => ({
  x: (point.x - viewport.offsetX) / viewport.scale,
  y: (point.y - viewport.offsetY) / viewport.scale,
})
