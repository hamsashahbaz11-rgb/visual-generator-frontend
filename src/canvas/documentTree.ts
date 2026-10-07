import type { ComponentInstance, DocumentGroup } from '../types/api'

// Pure document-hierarchy helpers. No React, no DOM — unit tested.
// The document stays flat (components[] + groups[]); hierarchy is derived.

export const sortByZIndex = <T extends { zIndex: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.zIndex - b.zIndex)

/** Instances with no group membership (rendered at scene top level). */
export const topLevelInstances = (components: ComponentInstance[]): ComponentInstance[] =>
  sortByZIndex(components.filter((c) => !c.groupId))

/** Direct child instances of a group, sorted for paint order. */
export const groupChildInstances = (
  components: ComponentInstance[],
  groupId: string,
): ComponentInstance[] =>
  sortByZIndex(components.filter((c) => c.groupId === groupId))

/** Direct child groups of a group (or top-level groups when parentId is null). */
export const childGroups = (
  groups: DocumentGroup[],
  parentId: string | null,
): DocumentGroup[] =>
  sortByZIndex(groups.filter((g) => (g.parentGroupId ?? null) === parentId))

export interface GroupNode extends DocumentGroup {
  children: GroupNode[]
}

/** Recursive group tree for a scene, preserving nesting. */
export const buildGroupTree = (groups: DocumentGroup[]): GroupNode[] => {
  const byId = new Map<string, GroupNode>(
    groups.map((g) => [g.id, { ...g, children: [] }]),
  )
  const roots: GroupNode[] = []
  for (const node of byId.values()) {
    if (node.parentGroupId) {
      const parent = byId.get(node.parentGroupId)
      if (parent) parent.children.push(node)
      else roots.push(node) // orphaned parent ref: keep visible, don't drop
    } else {
      roots.push(node)
    }
  }
  const sortTree = (nodes: GroupNode[]): GroupNode[] => {
    nodes.sort((a, b) => a.zIndex - b.zIndex)
    for (const node of nodes) node.children = sortTree(node.children)
    return nodes
  }
  return sortTree(roots)
}
