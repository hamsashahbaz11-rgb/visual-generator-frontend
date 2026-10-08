import { computeRulerTicks } from './timelineGeometry'

interface TimelineRulerProps {
  fps: number
  durationFrames: number
  trackWidthPx: number
  pixelsPerFrame: number
}

// FPS-aware frame/time ruler. Ticks adapt to scene length (a few labels,
// never hundreds). Read-only display — seeking is handled by the parent
// track area via pointer events.
export function TimelineRuler({
  fps,
  durationFrames,
  trackWidthPx,
  pixelsPerFrame,
}: TimelineRulerProps) {
  const ticks = computeRulerTicks(fps, durationFrames)
  return (
    <div
      className="tl-ruler"
      data-testid="timeline-ruler"
      style={{ width: Math.max(0, trackWidthPx) }}
      aria-hidden="true"
    >
      {ticks.map((frame) => {
        const left = frame * pixelsPerFrame
        const seconds = fps > 0 ? frame / fps : 0
        const label = Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`
        return (
          <div key={frame} className="tl-tick" style={{ left }} title={`frame ${frame}`}>
            <span className="tl-tick-label">{label}</span>
            <span className="tl-tick-frame">{frame}</span>
          </div>
        )
      })}
    </div>
  )
}
