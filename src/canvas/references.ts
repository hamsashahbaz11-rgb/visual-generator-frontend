import type { Component, ComponentInstance } from '../types/api'

// Generic component-reference model (Stage 2B).
//
// A definition declares reference props via `refProps` (e.g. Arrow's
// ["from", "to"]). The instance stores the referenced ComponentInstance id
// as that prop's string value. Empty/missing means "unset". Nothing here is
// Arrow-specific — Line, Connector, Label, Annotation or Diagram edge all
// use the same mechanism. Backend validation is authoritative; the UI only
// filters to same-scene candidates.

/** Reference prop names declared by a definition (empty when none). */
export const refPropsOf = (definition?: Component | null): string[] =>
  definition?.refProps ?? []

/** The referenced instance id for one ref prop, or null when unset. */
export const instanceRefId = (
  instance: ComponentInstance,
  prop: string,
): string | null => {
  const value = instance.props[prop]
  return typeof value === 'string' && value !== '' ? value : null
}

/** All references declared by an instance: prop → referenced instance id. */
export const instanceReferences = (
  instance: ComponentInstance,
  definition?: Component | null,
): Array<{ prop: string; targetId: string }> => {
  const out: Array<{ prop: string; targetId: string }> = []
  for (const prop of refPropsOf(definition)) {
    const targetId = instanceRefId(instance, prop)
    if (targetId) out.push({ prop, targetId })
  }
  return out
}

/** Resolve a referenced id against the current scene document. */
export const resolveInstanceRef = (
  components: ComponentInstance[],
  targetId: string,
): ComponentInstance | undefined => components.find((c) => c.id === targetId)

/** Short human label for reference dropdowns: Label "ma" · a1b2c3d4. */
export const describeInstance = (
  instance: ComponentInstance,
  definition?: Component | null,
): string => {
  const name = definition?.name ?? 'unknown'
  const hint = Object.values(instance.props).find(
    (v): v is string => typeof v === 'string' && v !== '' && v.length <= 24,
  )
  return hint ? `${name} "${hint}" · ${instance.id.slice(0, 8)}` : `${name} · ${instance.id.slice(0, 8)}`
}
