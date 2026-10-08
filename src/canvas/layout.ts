import type { ComponentInstance, SceneDocument } from '../types/api'
import {
  boundsEdges,
  boxesOverlap,
  componentBounds,
  descendantInstanceIds,
  groupBounds,
  unionBounds,
  type Bounds,
  type Point,
} from './bounds'
import { WORLD } from './viewport'

// Pure layout engine (Stage 2C). No React, no DOM — unit tested.
//
// Everything operates on explicit positions; snapping/alignment only ever
// produce new positions that are persisted through the existing mutation
// path. Nothing here creates permanent constraints.

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'middle' | 'bottom'
export type DistributeAxis = 'horizontal' | 'vertical'

export interface PositionUpdate {
  id: string
  position: Point
}

export interface ZIndexUpdate {
  id: string
  zIndex: number
}

/** Single source for scene dimensions (Phase 4). WORLD owns the numbers. */
export const canvasBounds = (): Bounds => ({
  x: 0,
  y: 0,
  width: WORLD.width,
  height: WORLD.height,
})

const round1 = (v: number): number => Math.round(v * 10) / 10

/**
 * One geometric subject: a single instance, or a group acting as one object
 * for bounds/alignment/snapping/movement. Members keep their identity and
 * individual positions — group motion is always a per-member delta.
 */
export interface LayoutSubject {
  bounds: Bounds
  memberIds: string[]
}

export const subjectForInstance = (instance: ComponentInstance): LayoutSubject => ({
  bounds: componentBounds(instance),
  memberIds: [instance.id],
})

export const subjectForGroup = (
  document: SceneDocument,
  groupId: string,
): LayoutSubject | null => {
  const bounds = groupBounds(document, groupId)
  if (!bounds) return null
  return { bounds, memberIds: descendantInstanceIds(document, groupId) }
}

/** Subjects for a selection; instances already covered by a selected group are deduped. */
export const selectionSubjects = (
  document: SceneDocument,
  instanceIds: string[],
  groupIds: string[],
): LayoutSubject[] => {
  const covered = new Set(groupIds.flatMap((id) => descendantInstanceIds(document, id)))
  const byId = new Map(document.components.map((c) => [c.id, c]))
  const instances = instanceIds
    .map((id) => byId.get(id))
    .filter((c): c is ComponentInstance => c !== undefined && !covered.has(c.id))
  const groups = groupIds
    .map((id) => subjectForGroup(document, id))
    .filter((s): s is LayoutSubject => s !== null)
  return [...instances.map(subjectForInstance), ...groups]
}

/**
 * Align subjects. The reference frame defaults to the union of subject
 * bounds (multi-select); callers pass canvasBounds() for single-target
 * canvas alignment. Returns per-instance position updates.
 */
export function alignSubjects(
  document: SceneDocument,
  subjects: LayoutSubject[],
  mode: AlignMode,
  frame?: Bounds,
): PositionUpdate[] {
  if (subjects.length === 0) return []
  const ref = frame ?? unionBounds(subjects.map((s) => s.bounds)) ?? canvasBounds()
  const edges = boundsEdges(ref)
  const byId = new Map(document.components.map((c) => [c.id, c]))
  const updates: PositionUpdate[] = []
  for (const subject of subjects) {
    const se = boundsEdges(subject.bounds)
    let dx = 0
    let dy = 0
    switch (mode) {
      case 'left': dx = edges.left - se.left; break
      case 'centerX': dx = edges.centerX - se.centerX; break
      case 'right': dx = edges.right - se.right; break
      case 'top': dy = edges.top - se.top; break
      case 'middle': dy = edges.centerY - se.centerY; break
      case 'bottom': dy = edges.bottom - se.bottom; break
    }
    if (dx === 0 && dy === 0) continue
    for (const id of subject.memberIds) {
      const current = byId.get(id)
      if (!current) continue
      updates.push({
        id,
        position: { x: round1(current.position.x + dx), y: round1(current.position.y + dy) },
      })
    }
  }
  return updates
}

/**
 * Distribute subjects evenly along an axis. First and last (by min edge)
 * stay put; intermediates are spaced evenly by start edge. Returns null
 * when fewer than 3 subjects are given.
 */
export function distributeSubjects(
  document: SceneDocument,
  subjects: LayoutSubject[],
  axis: DistributeAxis,
): PositionUpdate[] | null {
  if (subjects.length < 3) return null
  const horizontal = axis === 'horizontal'
  const startOf = (s: LayoutSubject): number => (horizontal ? s.bounds.x : s.bounds.y)
  const ordered = [...subjects].sort((a, b) => startOf(a) - startOf(b))
  const first = startOf(ordered[0])
  const last = startOf(ordered[ordered.length - 1])
  const step = (last - first) / (ordered.length - 1)
  const byId = new Map(document.components.map((c) => [c.id, c]))
  const updates: PositionUpdate[] = []
  ordered.forEach((subject, index) => {
    const target = first + step * index
    const delta = target - startOf(subject)
    if (delta === 0) return
    for (const id of subject.memberIds) {
      const current = byId.get(id)
      if (!current) continue
      updates.push({
        id,
        position: horizontal
          ? { x: round1(current.position.x + delta), y: current.position.y }
          : { x: current.position.x, y: round1(current.position.y + delta) },
      })
    }
  })
  return updates
}

/**
 * Normalize z-indices within one scope to 0..n-1. Stable: equal z values
 * keep their current relative order, so visual ordering never changes.
 * Returns updates only for items that actually change.
 */
export function normalizeScopeZ(items: Array<{ id: string; zIndex: number }>): ZIndexUpdate[] {
  const ordered = items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => a.zIndex - b.zIndex || a.index - b.index)
  const updates: ZIndexUpdate[] = []
  ordered.forEach((item, position) => {
    if (item.zIndex !== position) updates.push({ id: item.id, zIndex: position })
  })
  return updates
}

/**
 * Normalize every layer scope in the document: top-level instances,
 * top-level groups, and each group's direct members / child groups.
 */
export function normalizeDocumentLayers(document: SceneDocument): {
  instances: ZIndexUpdate[]
  groups: ZIndexUpdate[]
} {
  const instances: ZIndexUpdate[] = [
    ...normalizeScopeZ(document.components.filter((c) => !c.groupId)),
  ]
  const groups: ZIndexUpdate[] = [
    ...normalizeScopeZ(document.groups.filter((g) => !g.parentGroupId)),
  ]
  for (const group of document.groups) {
    instances.push(
      ...normalizeScopeZ(document.components.filter((c) => c.groupId === group.id)),
    )
    groups.push(
      ...normalizeScopeZ(document.groups.filter((g) => g.parentGroupId === group.id)),
    )
  }
  return { instances, groups }
}

/** Ids of other visible instances overlapping the given one. */
export function findOverlappingComponents(
  document: SceneDocument,
  instanceId: string,
): string[] {
  const target = document.components.find((c) => c.id === instanceId)
  if (!target || !target.visible) return []
  const box = componentBounds(target)
  return document.components
    .filter((c) => c.id !== instanceId && c.visible && boxesOverlap(box, componentBounds(c)))
    .map((c) => c.id)
}

// --- Snapping (temporary guides during interaction; only positions persist) ---

export const SNAP_THRESHOLD = 8

export interface SnapGuide {
  orientation: 'vertical' | 'horizontal'
  position: number
}

export interface SnapResult {
  position: Point
  guides: SnapGuide[]
}

/**
 * Snap a moving box's edges/center to nearby edges/centers of other boxes
 * or the frame (canvas), within threshold (world units). Returns the
 * adjusted top-left position plus the guides to render.
 */
export function snapBounds(
  moving: Bounds,
  others: Bounds[],
  frame: Bounds,
  threshold: number = SNAP_THRESHOLD,
): SnapResult {
  const me = boundsEdges(moving)
  const frameEdges = boundsEdges(frame)
  const candidates = (edge: 'x' | 'y'): number[] => {
    const lines = others.flatMap((o) => {
      const e = boundsEdges(o)
      return edge === 'x' ? [e.left, e.centerX, e.right] : [e.top, e.centerY, e.bottom]
    })
    const frameLines =
      edge === 'x'
        ? [frameEdges.left, frameEdges.centerX, frameEdges.right]
        : [frameEdges.top, frameEdges.centerY, frameEdges.bottom]
    return [...lines, ...frameLines]
  }
  const snapAxis = (
    edges: number[],
    axis: 'x' | 'y',
  ): { offset: number; guide: SnapGuide | null } => {
    let best: { offset: number; guide: SnapGuide | null } = { offset: 0, guide: null }
    let bestDistance = Infinity
    for (const edge of edges) {
      for (const candidate of candidates(axis)) {
        const distance = Math.abs(edge - candidate)
        if (distance <= threshold && distance < bestDistance) {
          bestDistance = distance
          const offset = candidate - edge
          // A guide explains an actual snap; already-exact alignment needs none.
          best = {
            offset,
            guide:
              offset !== 0
                ? {
                    orientation: axis === 'x' ? 'vertical' : 'horizontal',
                    position: candidate,
                  }
                : null,
          }
        }
      }
    }
    return best
  }
  const snappedX = snapAxis([me.left, me.centerX, me.right], 'x')
  const snappedY = snapAxis([me.top, me.centerY, me.bottom], 'y')
  const guides = [snappedX.guide, snappedY.guide].filter(
    (g): g is SnapGuide => g !== null,
  )
  return {
    position: { x: round1(moving.x + snappedX.offset), y: round1(moving.y + snappedY.offset) },
    guides,
  }
}

// --- AI-friendly layout API (Phase 13): pure, DOM-free, id/data driven ---

/** Align explicit instance ids. Single id aligns within the canvas frame. */
export function alignComponents(
  document: SceneDocument,
  ids: string[],
  mode: AlignMode,
): PositionUpdate[] {
  const subjects = selectionSubjects(document, ids, [])
  if (subjects.length === 0) return []
  const frame = subjects.length === 1 ? canvasBounds() : undefined
  return alignSubjects(document, subjects, mode, frame)
}

/** Distribute explicit instance ids. Null when fewer than 3. */
export function distributeComponents(
  document: SceneDocument,
  ids: string[],
  axis: DistributeAxis,
): PositionUpdate[] | null {
  return distributeSubjects(document, selectionSubjects(document, ids, []), axis)
}

export const moveComponentTo = (id: string, position: Point): PositionUpdate => ({
  id,
  position,
})

export const getComponentBounds = (
  document: SceneDocument,
  id: string,
): Bounds | null => {
  const instance = document.components.find((c) => c.id === id)
  return instance ? componentBounds(instance) : null
}

export const getGroupBounds = (
  document: SceneDocument,
  groupId: string,
): Bounds | null => groupBounds(document, groupId)

export const findOverlaps = findOverlappingComponents

export const normalizeLayerOrder = normalizeDocumentLayers
