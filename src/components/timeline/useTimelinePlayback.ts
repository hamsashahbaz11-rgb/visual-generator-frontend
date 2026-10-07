import { useEffect, useRef } from 'react'
import { useTimelineStore } from '../../store/timelineStore'
import { advancePlaybackFrame } from './timelineGeometry'

// Elapsed-time playback loop (Stage 3C).
//
// Advances currentFrame according to real elapsed time at the document fps
// (1000/fps ms per frame) via requestAnimationFrame — never setInterval.
// Missed browser frames land on the correct frame because each tick
// recomputes from accumulated elapsed time. Stops (pauses) at the final
// valid frame; no looping. The evaluator is untouched; frames just flow in.

interface PlaybackInput {
  fps: number
  durationFrames: number
  isPlaying: boolean
}

export const useTimelinePlayback = ({ fps, durationFrames, isPlaying }: PlaybackInput): void => {
  const rafId = useRef<number>(0)
  const originRef = useRef<{ frame: number; timestamp: number } | null>(null)
  const argsRef = useRef({ fps, durationFrames })
  argsRef.current = { fps, durationFrames }

  useEffect(() => {
    if (!isPlaying) {
      originRef.current = null
      return
    }
    if (typeof requestAnimationFrame === 'undefined') return
    originRef.current = {
      frame: useTimelineStore.getState().currentFrame,
      timestamp: performance.now(),
    }
    const tick = (now: number): void => {
      const origin = originRef.current
      if (!origin) return
      const { fps: liveFps, durationFrames: liveDuration } = argsRef.current
      const { frame, ended } = advancePlaybackFrame(
        origin.frame,
        now - origin.timestamp,
        liveFps,
        liveDuration,
      )
      const store = useTimelineStore.getState()
      if (frame !== store.currentFrame) store.setCurrentFrame(frame, liveDuration)
      if (ended) {
        store.pause()
        return
      }
      rafId.current = requestAnimationFrame(tick)
    }
    rafId.current = requestAnimationFrame(tick)
    return () => {
      if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(rafId.current)
      originRef.current = null
    }
  }, [isPlaying])
}
