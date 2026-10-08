import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { durationToTimeDisplay, frameToTimeDisplay } from './timelineGeometry'

interface TimelineHeaderProps {
  fps: number
  durationFrames: number
  currentFrame: number
  isPlaying: boolean
  onTogglePlaying: () => void
  onStep: (delta: number) => void
}

// Transport + FPS-derived time display (frames stay canonical; seconds display-only).
export function TimelineHeader({
  fps,
  durationFrames,
  currentFrame,
  isPlaying,
  onTogglePlaying,
  onStep,
}: TimelineHeaderProps) {
  return (
    <div className="tl-header" data-testid="timeline-header">
      <span className="tl-title">Timeline</span>
      <span className="tl-time" data-testid="timeline-time" aria-label="Current time and total duration">
        {frameToTimeDisplay(currentFrame, fps)} / {durationToTimeDisplay(durationFrames, fps)}
      </span>
      <span className="tl-frame" data-testid="timeline-frame" aria-label="Current frame">
        f{currentFrame}
      </span>
      <span className="tl-fps" aria-label="Frames per second">
        {fps} fps
      </span>
      <button
        type="button"
        className="button secondary tl-step"
        aria-label="Previous frame"
        onClick={() => onStep(-1)}
      >
        <ChevronLeft size={15} />
      </button>
      <button
        type="button"
        className="button secondary tl-play"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        aria-pressed={isPlaying}
        onClick={onTogglePlaying}
      >
        {isPlaying ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <button
        type="button"
        className="button secondary tl-step"
        aria-label="Next frame"
        onClick={() => onStep(1)}
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )
}
