import type { SceneDocument } from '../types/api'

// Optional spatial-relationship foundation (Stage 2C).
//
// A relationship declares intent ("place me rightOf X with a 20-unit gap")
// without creating constraints: the engine never auto-repositions anything
// in this stage, explicit positions stay authoritative, and nothing is
// persisted yet (adding storage would force a schema redesign —
// relationships ride along once Stage 3+ needs them).
//
// Validation is same-scene only: a target must be a component instance in
// the current document.

export const RELATIONSHIP_TYPES = [
  'leftOf',
  'rightOf',
  'above',
  'below',
  'centeredOn',
  'alignedWith',
  'attachedTo',
] as const

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number]

export interface ComponentRelationship {
  type: RelationshipType
  /** Target component-instance id (same scene). */
  target: string
  /** Desired gap in world units. Optional; must be a finite number ≥ 0. */
  gap?: number
}

export type RelationshipIssue =
  | { code: 'UNKNOWN_TYPE'; message: string }
  | { code: 'UNKNOWN_TARGET'; message: string }
  | { code: 'SELF_REFERENCE'; message: string }
  | { code: 'INVALID_GAP'; message: string }

/** Validate a relationship against the current document. Pure. */
export function validateRelationship(
  document: SceneDocument,
  sourceId: string,
  relationship: ComponentRelationship,
): { ok: true } | { ok: false; issue: RelationshipIssue } {
  if (!RELATIONSHIP_TYPES.includes(relationship.type)) {
    return {
      ok: false,
      issue: { code: 'UNKNOWN_TYPE', message: `Unknown relationship type "${relationship.type}"` },
    }
  }
  if (relationship.target === sourceId) {
    return {
      ok: false,
      issue: { code: 'SELF_REFERENCE', message: 'A component cannot relate to itself' },
    }
  }
  if (!document.components.some((c) => c.id === relationship.target)) {
    return {
      ok: false,
      issue: {
        code: 'UNKNOWN_TARGET',
        message: 'Relationship target must be a component in the same scene',
      },
    }
  }
  if (
    relationship.gap !== undefined &&
    (!Number.isFinite(relationship.gap) || relationship.gap < 0)
  ) {
    return {
      ok: false,
      issue: { code: 'INVALID_GAP', message: 'Gap must be a finite number ≥ 0' },
    }
  }
  return { ok: true }
}
