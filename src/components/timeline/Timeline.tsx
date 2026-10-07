import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Component, DocumentGroup, SceneDocument } from '../../types/api'
import { useDocumentStore } from '../../store/documentStore'
import { useTimelineStore } from '../../store/timelineStore'
import { buildGroupTree, childGroups, groupChildInstances } from '../../canvas/documentTree'
import { TimelineHeader } from './TimelineHeader'
import { TimelineRuler } from './TimelineRuler'
import { TimelineTrack } from './TimelineTrack'
import { useTimelinePlayback } from './useTimelinePlayback'
import {
  clampFrame,
  frameFromTimelineX,
  instanceTrackLabel,
  isTimingActiveAt,
  pixelsPerFrameFor,
  resolveTimelineMeta,
  timingBarFor,
  timelineXFromFrame,
} from './timelineGeometry'

interface TimelineProps {
  document: SceneDocument
  /** Component definitions by id (resolves instance.componentDefinitionId → name). */
  definitions: Map<string, Component>
}

const FALLBACK_TRACK_WIDTH = 640

// Editor timeline (Stage 3C): view layer over the document + evaluator.
// Shows timing bars per instance, a playhead, and transport controls.
// Seeking/playing only change editor UI state (currentFrame/isPlaying);
// animated values always come from evaluateSceneAtFrame in ScenePreview/Remotion.
export function Timeline({ document, definitions }: TimelineProps) {
  const currentFrame = useTimelineStore((s) => s.currentFrame)
  const isPlaying = useTimelineStore((s) => s.isPlaying)
  const setCurrentFrame = useTimelineStore((s) => s.setCurrentFrame)
  const pause = useTimelineStore((s) => s.pause)
  const togglePlaying = useTimelineStore((s) => s.togglePlaying)
  const selectInstance = useDocumentStore((s) => s.selectInstance)
  const selectGroup = useDocumentStore((s) => s.selectGroup)
  const selectedInstanceId = useDocumentStore((s) => s.selectedInstanceId)
  const selectedInstanceIds = useDocumentStore((s) => s.selectedInstanceIds)

  const meta = useMemo(() => resolveTimelineMeta(document), [document])
  const { fps, durationFrames } = meta

  const tracksRef = useRef<HTMLDivElement>(null)
  const [trackWidth, setTrackWidth] = useState(FALLBACK_TRACK_WIDTH)
  const draggingRef = useRef(false)

  useLayoutEffect(() => {
    const el = tracksRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width && width > 0) setTrackWidth(width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const pixelsPerFrame = pixelsPerFrameFor(trackWidth, durationFrames)

  // Keep the playhead valid when the scene duration changes.
  useEffect(() => {
    setCurrentFrame(clampFrame(currentFrame, durationFrames), durationFrames)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationFrames])

  useTimelinePlayback({ fps, durationFrames, isPlaying })

  const seekToFrame = useCallback(
    (frame: number) => setCurrentFrame(frame, durationFrames),
    [setCurrentFrame, durationFrames],
  )

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = tracksRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      seekToFrame(frameFromTimelineX(clientX - rect.left, pixelsPerFrame, durationFrames))
    },
    [seekToFrame, pixelsPerFrame, durationFrames],
  )

  // Dragging the playhead / ruler / lane background seeks; row labels select.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onMove = (e: PointerEvent): void => {
      if (draggingRef.current) seekFromClientX(e.clientX)
    }
    const onUp = (): void => {
      draggingRef.current = false
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [seekFromClientX])

  const onStep = useCallback(
    (delta: number) => {
      pause()
      seekToFrame(currentFrame + delta)
    },
    [pause, seekToFrame, currentFrame],
  )

  // Ruler, lane background, and playhead seek; row labels/state select.
  const onTracksPointerDown = (e: React.PointerEvent): void => {
    const target = e.target as HTMLElement
    if (
      target.closest('.tl-row-label') ||
      target.closest('.tl-row-state') ||
      target.closest('button')
    ) {
      return
    }
    draggingRef.current = true
    seekFromClientX(e.clientX)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const target = e.target as HTMLElement | null
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return
    }
    if (e.key === ' ') {
      e.preventDefault()
      togglePlaying()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onStep(e.shiftKey ? -10 : -1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      onStep(e.shiftKey ? 10 : 1)
    }
  }

  const definitionNameOf = (componentDefinitionId: string): string =>
    definitions.get(componentDefinitionId)?.name ?? 'unknown'

  const groupIds = useMemo(() => new Set(document.groups.map((g) => g.id)), [document.groups])
  const topInstances = useMemo(
    () =>
      document.components
        .filter((c) => !c.groupId || !groupIds.has(c.groupId))
        .sort((a, b) => a.zIndex - b.zIndex),
    [document.components, groupIds],
  )
  const groupTree = useMemo(() => buildGroupTree(document.groups), [document.groups])

  const rows: React.ReactNode[] = []
  for (const instance of topInstances) {
    rows.push(
      <TimelineRow
        key={instance.id}
        instanceId={instance.id}
        document={document}
        definitionNameOf={definitionNameOf}
        depth={0}
        fps={fps}
        pixelsPerFrame={pixelsPerFrame}
        currentFrame={currentFrame}
        selected={selectedInstanceIds.includes(instance.id)}
        onSelect={selectInstance}
      />,
    )
  }
  const pushGroup = (group: DocumentGroup, depth: number): void => {
    rows.push(
      <div
        key={group.id}
        className="tl-row tl-group-row"
        data-testid={`timeline-group-${group.id}`}
        data-group-id={group.id}
        role="button"
        tabIndex={0}
        aria-label={`Select group ${group.name}`}
        onClick={() => selectGroup(group.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            selectGroup(group.id)
          }
        }}
      >
        <span className="tl-row-label tl-group-label" style={{ paddingLeft: 8 + depth * 16 }}>
          {group.name}
        </span>
        <span className="tl-row-lane" aria-hidden="true" />
        <span className="tl-row-state">group</span>
      </div>,
    )
    for (const instance of groupChildInstances(document.components, group.id)) {
      rows.push(
        <TimelineRow
          key={instance.id}
          instanceId={instance.id}
          document={document}
          definitionNameOf={definitionNameOf}
          depth={depth + 1}
          fps={fps}
          pixelsPerFrame={pixelsPerFrame}
          currentFrame={currentFrame}
          selected={selectedInstanceIds.includes(instance.id)}
          onSelect={selectInstance}
        />,
      )
    }
    for (const child of childGroups(document.groups, group.id)) pushGroup(child, depth + 1)
  }
  for (const root of groupTree) pushGroup(root, 0)

  return (
    <section
      className="tl-root"
      data-testid="timeline"
      aria-label="Scene timeline"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <TimelineHeader
        fps={fps}
        durationFrames={durationFrames}
        currentFrame={currentFrame}
        isPlaying={isPlaying}
        onTogglePlaying={() => {
          if (!isPlaying && currentFrame >= durationFrames - 1) seekToFrame(0)
          togglePlaying()
        }}
        onStep={onStep}
      />
      <div className="tl-body">
        <div
          ref={tracksRef}
          className="tl-tracks"
          data-testid="timeline-tracks"
          onPointerDown={onTracksPointerDown}
        >
          <TimelineRuler
            fps={fps}
            durationFrames={durationFrames}
            trackWidthPx={trackWidth}
            pixelsPerFrame={pixelsPerFrame}
          />
          {rows.length > 0 ? (
            rows
          ) : (
            <p className="tl-empty">No components yet — add one to see its timing bar.</p>
          )}
          <div
            className="tl-playhead"
            data-testid="timeline-playhead"
            data-frame={currentFrame}
            style={{ left: timelineXFromFrame(currentFrame, pixelsPerFrame) }}
            aria-hidden="true"
          />
        </div>
      </div>
      <p className="tl-hint">
        {selectedInstanceId ? `Selected: ${selectedInstanceId}` : 'Click a row to select · drag the ruler to scrub'}
      </p>
    </section>
  )
}

function TimelineRow({
  instanceId,
  document,
  definitionNameOf,
  depth,
  fps,
  pixelsPerFrame,
  currentFrame,
  selected,
  onSelect,
}: {
  instanceId: string
  document: SceneDocument
  definitionNameOf: (id: string) => string
  depth: number
  fps: number
  pixelsPerFrame: number
  currentFrame: number
  selected: boolean
  onSelect: (id: string) => void
}) {
  const instance = document.components.find((c) => c.id === instanceId)
  if (!instance) return null
  const definitionName = definitionNameOf(instance.componentDefinitionId)
  const bar = timingBarFor(instance, fps, pixelsPerFrame)
  const active = isTimingActiveAt(instance, currentFrame, fps)
  return (
    <TimelineTrack
      instance={instance}
      definitionName={definitionName}
      label={instanceTrackLabel(instance, definitionName)}
      depth={depth}
      bar={bar}
      active={active}
      selected={selected}
      onSelect={onSelect}
    />
  )
}
