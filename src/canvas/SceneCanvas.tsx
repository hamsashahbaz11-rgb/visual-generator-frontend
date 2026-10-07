import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Component, ComponentInstance, DocumentGroup, SceneDocument } from '../types/api'
import { useDocumentStore } from '../store/documentStore'
import { scenesApi } from '../services/scenes'
import { instanceStyle, resolveRenderer } from './renderers'
import { childGroups, groupChildInstances, topLevelInstances } from './documentTree'
import { WORLD, screenToWorld, worldToScreen, DEFAULT_VIEWPORT } from './viewport'
import { clampSize, descendantInstanceIds, groupBounds, unionBounds } from './bounds'
import {
  SNAP_THRESHOLD,
  canvasBounds,
  findOverlappingComponents,
  snapBounds,
  type SnapGuide,
} from './layout'

// SceneDocument → Canvas → SceneRenderer → ComponentInstanceRenderer.
// One scene renders many independently addressable instances.
// Selection/drag state lives in the editor, never in the document.

interface CanvasProps {
  document: SceneDocument
  /** Component definitions by id (resolves instance.componentDefinitionId → name). */
  definitions: Map<string, Component>
}

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se'

interface InstanceDrag {
  kind: 'instance'
  id: string
  startClientX: number
  startClientY: number
  originX: number
  originY: number
  originW: number
  originH: number
  moved: boolean
}

interface GroupDrag {
  kind: 'group'
  id: string
  memberIds: string[]
  origins: Map<string, { x: number; y: number }>
  sizes: Map<string, { width: number; height: number }>
  startClientX: number
  startClientY: number
  moved: boolean
}

interface ResizeDrag {
  corner: ResizeCorner
  id: string
  startClientX: number
  startClientY: number
  originX: number
  originY: number
  originW: number
  originH: number
  moved: boolean
}

const round1 = (v: number): number => Math.round(v * 10) / 10

export function SceneCanvas({ document, definitions }: CanvasProps) {
  const selectedInstanceIds = useDocumentStore((s) => s.selectedInstanceIds)
  const selectedGroupIds = useDocumentStore((s) => s.selectedGroupIds)
  const selectInstance = useDocumentStore((s) => s.selectInstance)
  const selectGroup = useDocumentStore((s) => s.selectGroup)
  const toggleInstanceSelection = useDocumentStore((s) => s.toggleInstanceSelection)
  const toggleGroupSelection = useDocumentStore((s) => s.toggleGroupSelection)
  const clearSelection = useDocumentStore((s) => s.clearSelection)
  const moveLocalInstance = useDocumentStore((s) => s.moveLocalInstance)
  const patchLocalInstance = useDocumentStore((s) => s.patchLocalInstance)
  const patchLocalInstances = useDocumentStore((s) => s.patchLocalInstances)
  const persistInstance = useDocumentStore((s) => s.persistInstance)
  const upsertInstance = useDocumentStore((s) => s.upsertInstance)
  const dragRef = useRef<InstanceDrag | GroupDrag | null>(null)
  const resizeRef = useRef<ResizeDrag | null>(null)
  const [snap, setSnap] = useState<{ guides: SnapGuide[]; activeIds: string[] }>({
    guides: [],
    activeIds: [],
  })

  // Window-level move/up so drags survive pointer leaving the instance.
  useEffect(() => {
    const toWorldDelta = (startClientX: number, startClientY: number, event: PointerEvent) => {
      const origin = screenToWorld({ x: startClientX, y: startClientY }, DEFAULT_VIEWPORT)
      const current = screenToWorld({ x: event.clientX, y: event.clientY }, DEFAULT_VIEWPORT)
      return {
        dx: (current.x - origin.x) / DEFAULT_VIEWPORT.scale,
        dy: (current.y - origin.y) / DEFAULT_VIEWPORT.scale,
      }
    }
    const onMove = (event: PointerEvent) => {
      const resize = resizeRef.current
      if (resize) {
        const { dx, dy } = toWorldDelta(resize.startClientX, resize.startClientY, event)
        let { originX: x, originY: y } = resize
        let w = resize.originW
        let h = resize.originH
        if (resize.corner.includes('e')) w = resize.originW + dx
        else { w = resize.originW - dx; x = resize.originX + dx }
        if (resize.corner.includes('s')) h = resize.originH + dy
        else { h = resize.originH - dy; y = resize.originY + dy }
        const size = clampSize({ width: w, height: h })
        // Keep the opposite edge stable when clamping.
        if (resize.corner.includes('w')) x = resize.originX + resize.originW - size.width
        if (resize.corner.includes('n')) y = resize.originY + resize.originH - size.height
        resize.moved = true
        patchLocalInstance(resize.id, {
          position: { x: round1(x), y: round1(y) },
          size: { width: round1(size.width), height: round1(size.height) },
        })
        return
      }
      const drag = dragRef.current
      if (!drag) return
      const { dx, dy } = toWorldDelta(drag.startClientX, drag.startClientY, event)
      drag.moved = true
      const state = useDocumentStore.getState()
      const live = state.document ?? document
      const threshold = SNAP_THRESHOLD / DEFAULT_VIEWPORT.scale
      if (drag.kind === 'instance') {
        const candidate = {
          x: round1(drag.originX + dx),
          y: round1(drag.originY + dy),
        }
        const moving = {
          x: candidate.x,
          y: candidate.y,
          width: drag.originW,
          height: drag.originH,
        }
        const others = live.components
          .filter((c) => c.id !== drag.id && c.visible)
          .map((c) => ({ x: c.position.x, y: c.position.y, width: c.size.width, height: c.size.height }))
        const snapped = snapBounds(moving, others, canvasBounds(), threshold)
        moveLocalInstance(drag.id, snapped.position)
        setSnap({ guides: snapped.guides, activeIds: [drag.id] })
      } else {
        const candidates = drag.memberIds.map((id) => {
          const origin = drag.origins.get(id) ?? { x: 0, y: 0 }
          const size = drag.sizes.get(id) ?? { width: 0, height: 0 }
          return {
            id,
            x: round1(origin.x + dx),
            y: round1(origin.y + dy),
            width: size.width,
            height: size.height,
          }
        })
        const memberSet = new Set(drag.memberIds)
        const others = live.components
          .filter((c) => !memberSet.has(c.id) && c.visible)
          .map((c) => ({ x: c.position.x, y: c.position.y, width: c.size.width, height: c.size.height }))
        const union = unionBounds(candidates.map(({ x, y, width, height }) => ({ x, y, width, height })))
        const snapped = union
          ? snapBounds(union, others, canvasBounds(), threshold)
          : { position: { x: 0, y: 0 }, guides: [] as SnapGuide[] }
        const adjustX = union ? snapped.position.x - union.x : 0
        const adjustY = union ? snapped.position.y - union.y : 0
        patchLocalInstances(
          candidates.map((c) => ({
            id: c.id,
            patch: { position: { x: round1(c.x + adjustX), y: round1(c.y + adjustY) } },
          })),
        )
        setSnap({ guides: snapped.guides, activeIds: drag.memberIds })
      }
    }
    const onUp = () => {
      const resize = resizeRef.current
      resizeRef.current = null
      if (resize?.moved) {
        persistInstance(resize.id).catch(() => undefined)
      }
      setSnap({ guides: [], activeIds: [] })
      const drag = dragRef.current
      dragRef.current = null
      if (!drag?.moved) return
      if (drag.kind === 'instance') {
        // Persist via the existing Stage 1 move operation. Local state already
        // shows the new position; the server response reconciles it.
        const latest = useDocumentStore.getState().document?.components.find((c) => c.id === drag.id)
        if (!latest) return
        scenesApi
          .moveInstance(drag.id, latest.position)
          .then((saved) => upsertInstance(saved))
          .catch(() => undefined)
      } else {
        const state = useDocumentStore.getState()
        void Promise.all(
          drag.memberIds.map((id) => {
            const latest = state.document?.components.find((c) => c.id === id)
            if (!latest) return Promise.resolve()
            return scenesApi
              .moveInstance(id, latest.position)
              .then((saved) => upsertInstance(saved))
              .catch(() => undefined)
          }),
        )
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [document, moveLocalInstance, patchLocalInstance, patchLocalInstances, persistInstance, upsertInstance])

  const beginDrag = (
    event: React.PointerEvent,
    instance: ComponentInstance,
  ): void => {
    if (event.button !== 0) return
    event.stopPropagation()
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      // Additive click: toggle multi-selection without starting a drag.
      toggleInstanceSelection(instance.id)
      return
    }
    selectInstance(instance.id)
    dragRef.current = {
      kind: 'instance',
      id: instance.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: instance.position.x,
      originY: instance.position.y,
      originW: instance.size.width,
      originH: instance.size.height,
      moved: false,
    }
  }

  const beginGroupDrag = (
    event: React.PointerEvent,
    groupId: string,
  ): void => {
    if (event.button !== 0) return
    event.stopPropagation()
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      toggleGroupSelection(groupId)
      return
    }
    selectGroup(groupId)
    const state = useDocumentStore.getState()
    const memberIds = descendantInstanceIds(document, groupId)
    dragRef.current = {
      kind: 'group',
      id: groupId,
      memberIds,
      origins: new Map(
        memberIds.map((id) => {
          const c = state.document?.components.find((m) => m.id === id)
          return [id, { x: c?.position.x ?? 0, y: c?.position.y ?? 0 }]
        }),
      ),
      sizes: new Map(
        memberIds.map((id) => {
          const c = state.document?.components.find((m) => m.id === id)
          return [id, { width: c?.size.width ?? 0, height: c?.size.height ?? 0 }]
        }),
      ),
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
    }
  }

  const beginResize = (
    event: React.PointerEvent,
    corner: ResizeCorner,
    instance: ComponentInstance,
  ): void => {
    if (event.button !== 0) return
    event.stopPropagation()
    selectInstance(instance.id)
    resizeRef.current = {
      corner,
      id: instance.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: instance.position.x,
      originY: instance.position.y,
      originW: instance.size.width,
      originH: instance.size.height,
      moved: false,
    }
  }

  const selectParentGroup = (instance: ComponentInstance): void => {
    if (instance.groupId) selectGroup(instance.groupId)
  }

  // Instances currently being dragged (for the overlap indicator).
  // Uses the live store document so the indicator tracks in-drag positions.
  const liveDocument = useDocumentStore((s) => s.document) ?? document
  const overlapIds = new Set(
    snap.activeIds.filter(
      (id) => findOverlappingComponents(liveDocument, id).length > 0,
    ),
  )

  return (
    <div className="scene-canvas-scroll">
      <div
        className="scene-canvas"
        style={{ width: WORLD.width, height: WORLD.height }}
        onPointerDown={clearSelection}
        data-testid="scene-canvas"
      >
        {document.components.length === 0 && (
          <div className="scene-canvas-empty">
            Empty scene — add a component to begin.
          </div>
        )}
        {topLevelInstances(document.components).map((instance) => (
          <ComponentInstanceRenderer
            key={instance.id}
            document={document}
            instance={instance}
            definitions={definitions}
            selected={selectedInstanceIds.includes(instance.id)}
            overlapping={overlapIds.has(instance.id)}
            onPointerDown={beginDrag}
            onResizeStart={beginResize}
            onSelectParentGroup={selectParentGroup}
          />
        ))}
        {childGroups(document.groups, null).map((group) => (
          <GroupRenderer
            key={group.id}
            group={group}
            document={document}
            definitions={definitions}
            selectedInstanceIds={selectedInstanceIds}
            selectedGroupIds={selectedGroupIds}
            overlappingIds={overlapIds}
            onPointerDown={beginDrag}
            onResizeStart={beginResize}
            onSelectParentGroup={selectParentGroup}
            onGroupDragStart={beginGroupDrag}
          />
        ))}
        {snap.guides.map((guide, index) => (
          <div
            key={`${guide.orientation}-${guide.position}-${index}`}
            data-testid="snap-guide"
            data-orientation={guide.orientation}
            className={`snap-guide snap-${guide.orientation}`}
            style={
              guide.orientation === 'vertical'
                ? { left: guide.position }
                : { top: guide.position }
            }
          />
        ))}
      </div>
    </div>
  )
}

function GroupRenderer({
  group,
  document,
  definitions,
  selectedInstanceIds,
  selectedGroupIds,
  overlappingIds,
  onPointerDown,
  onResizeStart,
  onSelectParentGroup,
  onGroupDragStart,
}: {
  group: DocumentGroup
  document: SceneDocument
  definitions: Map<string, Component>
  selectedInstanceIds: string[]
  selectedGroupIds: string[]
  overlappingIds: Set<string>
  onPointerDown: (event: React.PointerEvent, instance: ComponentInstance) => void
  onResizeStart: (event: React.PointerEvent, corner: ResizeCorner, instance: ComponentInstance) => void
  onSelectParentGroup: (instance: ComponentInstance) => void
  onGroupDragStart: (event: React.PointerEvent, groupId: string) => void
}) {
  // Logical container only: children keep their own world coordinates.
  // (Global z-interleaving across group boundaries is a later-stage concern.)
  const style: CSSProperties = { zIndex: group.zIndex }
  const selected = selectedGroupIds.includes(group.id)
  const bounds = selected ? groupBounds(document, group.id) : null
  return (
    <div
      className="canvas-group"
      data-group-id={group.id}
      data-group-name={group.name}
      style={style}
    >
      {groupChildInstances(document.components, group.id).map((instance) => (
        <ComponentInstanceRenderer
          key={instance.id}
          document={document}
          instance={instance}
          definitions={definitions}
          selected={selectedInstanceIds.includes(instance.id)}
          overlapping={overlappingIds.has(instance.id)}
          onPointerDown={onPointerDown}
          onResizeStart={onResizeStart}
          onSelectParentGroup={onSelectParentGroup}
        />
      ))}
      {childGroups(document.groups, group.id).map((child) => (
        <GroupRenderer
          key={child.id}
          group={child}
          document={document}
          definitions={definitions}
          selectedInstanceIds={selectedInstanceIds}
          selectedGroupIds={selectedGroupIds}
          overlappingIds={overlappingIds}
          onPointerDown={onPointerDown}
          onResizeStart={onResizeStart}
          onSelectParentGroup={onSelectParentGroup}
          onGroupDragStart={onGroupDragStart}
        />
      ))}
      {selected && bounds && (
        <div
          className="canvas-group-outline"
          data-group-outline={group.id}
          style={{
            left: bounds.x,
            top: bounds.y,
            width: Math.max(1, bounds.width),
            height: Math.max(1, bounds.height),
          }}
        >
          <button
            type="button"
            className="canvas-group-chip"
            data-group-chip={group.id}
            onPointerDown={(event) => onGroupDragStart(event, group.id)}
          >
            {group.name}
          </button>
        </div>
      )}
    </div>
  )
}

const RESIZE_CORNERS: ResizeCorner[] = ['nw', 'ne', 'sw', 'se']

function ComponentInstanceRenderer({
  document,
  instance,
  definitions,
  selected,
  overlapping,
  onPointerDown,
  onResizeStart,
  onSelectParentGroup,
}: {
  document: SceneDocument
  instance: ComponentInstance
  definitions: Map<string, Component>
  selected: boolean
  overlapping: boolean
  onPointerDown: (event: React.PointerEvent, instance: ComponentInstance) => void
  onResizeStart: (event: React.PointerEvent, corner: ResizeCorner, instance: ComponentInstance) => void
  onSelectParentGroup: (instance: ComponentInstance) => void
}) {
  if (!instance.visible) return null
  const definition = definitions.get(instance.componentDefinitionId)
  const definitionName = definition?.name ?? 'unknown'
  const Renderer = resolveRenderer(definitionName)
  const screen = worldToScreen(instance.position, DEFAULT_VIEWPORT)
  const style: CSSProperties = {
    ...instanceStyle(instance),
    left: screen.x,
    top: screen.y,
  }
  return (
    <div
      className={`canvas-instance${selected ? ' selected' : ''}${overlapping ? ' is-overlapping' : ''}`}
      data-instance-id={instance.id}
      data-definition={definitionName}
      style={style}
      onPointerDown={(event) => onPointerDown(event, instance)}
      onDoubleClick={() => onSelectParentGroup(instance)}
    >
      <Renderer
        instance={instance}
        definition={definition}
        definitionName={definitionName}
        document={document}
      />
      {selected && (
        <div className="canvas-selection" aria-hidden>
          <span className="canvas-selection-tag">{definitionName}</span>
        </div>
      )}
      {selected &&
        RESIZE_CORNERS.map((corner) => (
          <div
            key={corner}
            className={`canvas-resize-handle handle-${corner}`}
            data-resize-handle={`${instance.id}:${corner}`}
            onPointerDown={(event) => onResizeStart(event, corner, instance)}
          />
        ))}
    </div>
  )
}
