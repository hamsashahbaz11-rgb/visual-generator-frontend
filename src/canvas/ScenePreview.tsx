import type { CSSProperties } from 'react'
import type { Component, ComponentInstance, SceneDocument } from '../types/api'
import {
  buildRenderTree,
  type RenderNode,
  type RenderTreeNode,
} from '@app/render'
import { WORLD } from './viewport'
import { resolveRenderer } from './renderers'

// Deterministic preview (Stage 2D, Phase 10).
//
// Renders the shared render tree — the same tree, styles, keys, references
// and geometry the Remotion renderer consumes. No selection, dragging,
// resize, inspector overlays, or editor guides: pure document → visuals.

interface PreviewProps {
  document: SceneDocument
  /** Component definitions by id (resolves instance.componentDefinitionId → name). */
  definitions: Map<string, Component>
}

const nodeStyle = (node: RenderNode): CSSProperties => ({
  position: 'absolute',
  left: node.style.left,
  top: node.style.top,
  width: node.style.width,
  height: node.style.height,
  opacity: node.style.opacity,
  transform: node.style.transform,
  zIndex: node.style.zIndex,
})

function PreviewInstance({
  node,
  document,
  definitionName,
}: {
  node: RenderNode<ComponentInstance>
  document: SceneDocument
  definitionName: string
}) {
  const Renderer = resolveRenderer(definitionName)
  return (
    <div
      data-instance-id={node.instance.id}
      data-definition={definitionName}
      style={nodeStyle(node)}
    >
      <Renderer
        instance={node.instance}
        definition={undefined}
        definitionName={definitionName}
        document={document}
      />
    </div>
  )
}

function PreviewNode({
  treeNode,
  document,
  definitions,
}: {
  treeNode: RenderTreeNode<ComponentInstance>
  document: SceneDocument
  definitions: Map<string, Component>
}) {
  if (treeNode.type === 'instance') {
    const definitionName =
      definitions.get(treeNode.node.instance.componentDefinitionId)?.name ?? 'unknown'
    return (
      <PreviewInstance
        node={treeNode.node}
        document={document}
        definitionName={definitionName}
      />
    )
  }
  return (
    <div
      data-group-id={treeNode.group.id}
      style={{ position: 'absolute', inset: 0, zIndex: treeNode.group.zIndex }}
    >
      {treeNode.children.map((child) =>
        child.type === 'instance' ? (
          <PreviewInstance
            key={child.node.instance.id}
            node={child.node}
            document={document}
            definitionName={
              definitions.get(child.node.instance.componentDefinitionId)?.name ?? 'unknown'
            }
          />
        ) : (
          <PreviewNode
            key={child.group.id}
            treeNode={child}
            document={document}
            definitions={definitions}
          />
        ),
      )}
    </div>
  )
}

export function ScenePreview({ document, definitions }: PreviewProps) {
  const tree = buildRenderTree(document)
  return (
    <div
      className="scene-canvas scene-preview"
      data-testid="scene-preview"
      style={{ width: WORLD.width, height: WORLD.height }}
    >
      {document.components.length === 0 && (
        <div className="scene-canvas-empty">
          Empty scene — add a component to begin.
        </div>
      )}
      {tree.map((root) =>
        root.type === 'instance' ? (
          <PreviewInstance
            key={root.node.instance.id}
            node={root.node}
            document={document}
            definitionName={
              definitions.get(root.node.instance.componentDefinitionId)?.name ?? 'unknown'
            }
          />
        ) : (
          <PreviewNode
            key={root.group.id}
            treeNode={root}
            document={document}
            definitions={definitions}
          />
        ),
      )}
    </div>
  )
}
