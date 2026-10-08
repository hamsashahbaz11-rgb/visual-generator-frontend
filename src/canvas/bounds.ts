import type { ComponentInstance, SceneDocument } from '../types/api'

// Reusable bounds calculations (Stage 2B). Single home for bounding boxes —
// reused by selection outlines, resize, connectors, and later layout/snapping.
// All bounds are axis-aligned world-space boxes (rotation is rendered by CSS).

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export const MIN_SIZE = 10

/** Axis-aligned box of one instance (position + size, unrotated). */
export const componentBounds = (instance: ComponentInstance): Bounds => ({
  x: instance.position.x,
  y: instance.position.y,
  width: Math.max(0, instance.size.width),
  height: Math.max(0, instance.size.height),
})

export const boundsCenter = (bounds: Bounds): Point => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2,
})

/** Named edges of a box — the single source for alignment/snap geometry. */
export interface BoxEdges {
  left: number
  right: number
  top: number
  bottom: number
  centerX: number
  centerY: number
}

export const boundsEdges = (bounds: Bounds): BoxEdges => ({
  left: bounds.x,
  right: bounds.x + bounds.width,
  top: bounds.y,
  bottom: bounds.y + bounds.height,
  centerX: bounds.x + bounds.width / 2,
  centerY: bounds.y + bounds.height / 2,
})

export const distanceBetweenPoints = (a: Point, b: Point): number =>
  Math.hypot(a.x - b.x, a.y - b.y)

/** True when two boxes overlap with positive area (touching edges ≠ overlap). */
export const boxesOverlap = (a: Bounds, b: Bounds): boolean =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y

/** Intersection box, or null when there is none. */
export const intersectionBounds = (a: Bounds, b: Bounds): Bounds | null => {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  if (right <= x || bottom <= y) return null
  return { x, y, width: right - x, height: bottom - y }
}

/** Smallest box containing every box, or null when empty. */
export const unionBounds = (boxes: Bounds[]): Bounds | null => {
  if (boxes.length === 0) return null
  const minX = Math.min(...boxes.map((b) => b.x))
  const minY = Math.min(...boxes.map((b) => b.y))
  const maxX = Math.max(...boxes.map((b) => b.x + b.width))
  const maxY = Math.max(...boxes.map((b) => b.y + b.height))
  return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) }
}

/** Every instance id in a group's subtree (nested groups included). */
export const descendantInstanceIds = (
  document: SceneDocument,
  groupId: string,
): string[] => {
  const childGroupIds = document.groups
    .filter((g) => g.parentGroupId === groupId)
    .map((g) => g.id)
  const nested = childGroupIds.flatMap((id) => descendantInstanceIds(document, id))
  const direct = document.components
    .filter((c) => c.groupId === groupId)
    .map((c) => c.id)
  return [...direct, ...nested]
}

/**
 * Bounding box of all *visible* descendants of a group (nested included),
 * or null when the group has no visible descendants.
 */
export const groupBounds = (
  document: SceneDocument,
  groupId: string,
): Bounds | null =>
  unionBounds(
    document.components
      .filter((c) => c.visible && descendantInstanceIds(document, groupId).includes(c.id))
      .map(componentBounds),
  )

export const clampSize = (
  size: { width: number; height: number },
  min = MIN_SIZE,
): { width: number; height: number } => ({
  width: Math.max(min, size.width),
  height: Math.max(min, size.height),
})

/** Where the segment inside→outside first exits the rect (fallback: inside). */
export const clipExit = (rect: Bounds, inside: Point, outside: Point): Point => {
  const dx = outside.x - inside.x
  const dy = outside.y - inside.y
  if (dx === 0 && dy === 0) return { ...inside }
  const candidates: number[] = []
  if (dx !== 0) {
    candidates.push((rect.x - inside.x) / dx, (rect.x + rect.width - inside.x) / dx)
  }
  if (dy !== 0) {
    candidates.push((rect.y - inside.y) / dy, (rect.y + rect.height - inside.y) / dy)
  }
  const t = Math.min(...candidates.filter((v) => v > 0))
  if (!Number.isFinite(t)) return { ...inside }
  return { x: inside.x + dx * t, y: inside.y + dy * t }
}

/**
 * Connector endpoints between two boxes: each endpoint sits on its own box
 * edge along the center-to-center line. Falls back to centers for degenerate
 * (zero-area / coincident) boxes. Pure and unit tested.
 */
export const connectorPoints = (
  from: Bounds,
  to: Bounds,
): { p1: Point; p2: Point } => {
  const c1 = boundsCenter(from)
  const c2 = boundsCenter(to)
  if (c1.x === c2.x && c1.y === c2.y) return { p1: c1, p2: c2 }
  return { p1: clipExit(from, c1, c2), p2: clipExit(to, c2, c1) }
}
