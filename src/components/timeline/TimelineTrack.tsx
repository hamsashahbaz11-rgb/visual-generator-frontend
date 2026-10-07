import type { AnimatableProperty, ComponentInstance } from '../../types/api'
import type { SelectedKeyframe } from '../../store/timelineStore'
import type { TimingBar } from './timelineGeometry'
import { CANONICAL_TRACK_ORDER, trackLabel } from './animationOps'

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
  /** Expanded (selected) instances reveal per-property keyframe lanes. */
  expanded: boolean
  pixelsPerFrame: number
  selectedKeyframe: SelectedKeyframe | null
  onSelect: (id: string) => void
  onSelectKeyframe: (selection: SelectedKeyframe) => void
  onKeyframeDragStart: (
    e: React.PointerEvent,
    drag: { instanceId: string; property: AnimatableProperty; frame: number },
  ) => void
}

// Timing bar per component instance (Stage 3C) + keyframe lanes (Stage 3D).
// Pixel geometry comes from the parent so every row shares one scale.
// Lane background seeks (parent pointer handler); label clicks select;
// diamond clicks/drags select/move keyframes and never seek.
export function TimelineTrack({
  instance,
  definitionName,
  label,
  depth,
  bar,
  active,
  selected,
  expanded,
  pixelsPerFrame,
  selectedKeyframe,
  onSelect,
  onSelectKeyframe,
  onKeyframeDragStart,
}: TimelineTrackProps) {
  const hidden = instance.visible === false
  const tracks = (instance.animation?.tracks ?? [])
    .filter((t) => CANONICAL_TRACK_ORDER.includes(t.property))
    .sort(
      (a, b) =>
        CANONICAL_TRACK_ORDER.indexOf(a.property) - CANONICAL_TRACK_ORDER.indexOf(b.property),
    )
  return (
    <div className="tl-track-group">
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
      {expanded && (
        <div className="tl-kf-lanes">
          {tracks.length === 0 && (
            <div className="tl-kf-empty">No keyframes — press ◆ in the Inspector</div>
          )}
          {tracks.map((track) => (
            <div
              key={track.property}
              className="tl-kf-lane"
              data-testid={`timeline-keyframes-${instance.id}-${track.property}`}
              data-property={track.property}
            >
              <span className="tl-kf-lane-label" style={{ paddingLeft: 8 + (depth + 1) * 16 }}>
                {trackLabel(track.property)}
              </span>
              <span className="tl-kf-lane-track">
                {[...track.keyframes]
                  .sort((a, b) => a.frame - b.frame)
                  .map((kf) => {
                    const isSelected =
                      selectedKeyframe?.instanceId === instance.id &&
                      selectedKeyframe?.property === track.property &&
                      selectedKeyframe?.frame === kf.frame
                    return (
                      <span
                        key={kf.frame}
                        role="button"
                        tabIndex={0}
                        aria-label={`Keyframe ${trackLabel(track.property)} at frame ${kf.frame}`}
                        aria-pressed={isSelected}
                        data-testid={`timeline-keyframe-${instance.id}-${track.property}-${kf.frame}`}
                        data-keyframe-frame={kf.frame}
                        data-easing={kf.easing ?? 'linear'}
                        title={`${trackLabel(track.property)} · frame ${kf.frame} · value ${kf.value} · ${kf.easing ?? 'linear'}`}
                        className={`tl-keyframe${isSelected ? ' selected' : ''}`}
                        style={{ left: kf.frame * pixelsPerFrame }}
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          onSelectKeyframe({
                            instanceId: instance.id,
                            property: track.property,
                            frame: kf.frame,
                          })
                          onSelect(instance.id)
                          onKeyframeDragStart(e, {
                            instanceId: instance.id,
                            property: track.property,
                            frame: kf.frame,
                          })
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectKeyframe({
                            instanceId: instance.id,
                            property: track.property,
                            frame: kf.frame,
                          })
                          onSelect(instance.id)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            e.stopPropagation()
                            onSelectKeyframe({
                              instanceId: instance.id,
                              property: track.property,
                              frame: kf.frame,
                            })
                            onSelect(instance.id)
                          }
                        }}
                      />
                    )
                  })}
              </span>
              <span className="tl-kf-lane-count">{track.keyframes.length}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
