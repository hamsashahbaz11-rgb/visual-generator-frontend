import type { ComponentInstance } from '../../types/api'
import type { TimingBar } from './timelineGeometry'

interface TimelineTrackProps {
  instance: ComponentInstance
  definitionName: string
  label: string
  /** Nesting depth for group hierarchy indentation. */
  depth: number
  /** Pixel geometry from the parent (single pixelsPerFrame for all rows). */
  bar: TimingBar
  active: boolean
  selected: boolean
  onSelect: (id: string) => void
}

// One read-only timing bar per component instance (Stage 3C).
// Pixel geometry comes from the parent so every row shares one scale.
// Lane background seeks (parent pointer handler); label clicks select.
// No keyframe handles here (Stage 3D owns animation authoring).
export function TimelineTrack({
  instance,
  definitionName,
  label,
  depth,
  bar,
  active,
  selected,
  onSelect,
}: TimelineTrackProps) {
  const hidden = instance.visible === false
  return (
    <div
      className={`tl-row${selected ? ' selected' : ''}${active && !hidden ? ' active' : ''}${hidden ? ' hidden-instance' : ''}`}
      data-testid={`timeline-track-${instance.id}`}
      data-instance-id={instance.id}
      data-start-frame={bar.startFrame}
      data-end-frame={bar.endFrame}
      role="button"
      tabIndex={0}
      aria-label={`Select ${label}`}
      aria-pressed={selected}
      onClick={(e) => {
        // Lane background is the seek surface — only label/state clicks select.
        if ((e.target as HTMLElement).closest('.tl-row-lane')) return
        onSelect(instance.id)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(instance.id)
        }
      }}
      title={`${label} · ${definitionName} · frames ${bar.startFrame}–${bar.endFrame - 1}`}
    >
      <span className="tl-row-label" style={{ paddingLeft: 8 + depth * 16 }}>
        {label}
      </span>
      <span className="tl-row-lane" aria-hidden="true">
        <span
          className="tl-track-bar"
          style={{ left: bar.left, width: Math.max(2, bar.width) }}
        />
      </span>
      <span className="tl-row-state">{hidden ? 'hidden' : active ? 'active' : 'inactive'}</span>
    </div>
  )
}
