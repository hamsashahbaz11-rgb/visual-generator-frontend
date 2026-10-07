import { useState } from 'react'
import { Diamond, DiamondPlus, Trash2 } from 'lucide-react'
import type { ComponentInstance, SceneDocument } from '../types/api'
import { useDocumentStore } from '../store/documentStore'
import { useTimelineStore } from '../store/timelineStore'
import { resolveTimelineMeta } from '../components/timeline/timelineGeometry'
import {
  CANONICAL_TRACK_ORDER,
  deleteKeyframe,
  evaluatedValueAt,
  findKeyframe,
  getTrack,
  isKeyedAt,
  moveKeyframe,
  readAnimatedValue,
  setKeyframeEasing,
  setKeyframeValue,
  trackLabel,
  trackValueAt,
  upsertKeyframe,
  type AnimatableProperty,
} from '../components/timeline/animationOps'
import { NumField } from './Inspector'

// Animation authoring for one instance (Stage 3D), integrated into the
// existing Inspector. Reads/writes the canonical
// `ComponentInstance.animation.tracks`; evaluated values come from the
// Stage 3A evaluator. Base property fields elsewhere in the Inspector keep
// editing base values; this section authors keyframes.
export function AnimationInspector({
  document,
  instance,
}: {
  document: SceneDocument
  instance: ComponentInstance
}) {
  const patchLocalInstance = useDocumentStore((s) => s.patchLocalInstance)
  const persistInstance = useDocumentStore((s) => s.persistInstance)
  const currentFrame = useTimelineStore((s) => s.currentFrame)
  const selectedKeyframe = useTimelineStore((s) => s.selectedKeyframe)
  const selectKeyframe = useTimelineStore((s) => s.selectKeyframe)
  const selectProperty = useTimelineStore((s) => s.selectProperty)
  const [error, setError] = useState('')

  const { durationFrames } = resolveTimelineMeta(document)

  const commitAnimation = async (next: ComponentInstance['animation']) => {
    setError('')
    patchLocalInstance(instance.id, { animation: next })
    try {
      await persistInstance(instance.id)
    } catch {
      setError('Could not save animation changes')
    }
  }

  const addKeyframeAtCurrentFrame = (property: AnimatableProperty) =>
    void (async () => {
      const captured =
        evaluatedValueAt(document, instance.id, property, currentFrame) ??
        readAnimatedValue(instance, property)
      await commitAnimation(
        upsertKeyframe(
          instance.animation,
          property,
          { frame: currentFrame, value: captured, easing: 'linear' },
          durationFrames,
        ),
      )
      selectProperty(property)
      selectKeyframe({ instanceId: instance.id, property, frame: currentFrame })
    })()

  const activeKeyframe =
    selectedKeyframe && selectedKeyframe.instanceId === instance.id
      ? findKeyframe(instance.animation, selectedKeyframe.property, selectedKeyframe.frame)
      : undefined
  const activeProperty =
    selectedKeyframe && selectedKeyframe.instanceId === instance.id
      ? selectedKeyframe.property
      : null

  return (
    <section data-testid="animation-inspector">
      <h3>Animation</h3>
      {error && <p className="inspector-error">{error}</p>}
      <p className="inspector-hint" data-testid="animation-frame-hint">
        Frame {currentFrame} · values shown are evaluated
      </p>
      <div className="anim-rows">
        {CANONICAL_TRACK_ORDER.map((property) => (
          <AnimationPropertyRow
            key={property}
            document={document}
            instance={instance}
            property={property}
            currentFrame={currentFrame}
            onAdd={() => addKeyframeAtCurrentFrame(property)}
          />
        ))}
      </div>
      {activeKeyframe && activeProperty && (
        <KeyframeEditor
          key={`${activeProperty}-${selectedKeyframe!.frame}`}
          instance={instance}
          property={activeProperty}
          keyframe={activeKeyframe}
          durationFrames={durationFrames}
          onClose={() => selectKeyframe(null)}
          onCommit={commitAnimation}
          onMoved={(frame) =>
            selectKeyframe({ instanceId: instance.id, property: activeProperty, frame })
          }
        />
      )}
    </section>
  )
}

function AnimationPropertyRow({
  document,
  instance,
  property,
  currentFrame,
  onAdd,
}: {
  document: SceneDocument
  instance: ComponentInstance
  property: AnimatableProperty
  currentFrame: number
  onAdd: () => void
}) {
  const track = getTrack(instance.animation, property)
  const animated = track !== undefined && track.keyframes.length > 0
  const keyed = isKeyedAt(instance.animation, property, currentFrame)
  const evaluated = animated
    ? (trackValueAt(track, currentFrame) ?? readAnimatedValue(instance, property))
    : readAnimatedValue(instance, property)
  return (
    <div
      className={`anim-row${animated ? ' animated' : ''}${keyed ? ' keyed' : ''}`}
      data-testid={`anim-row-${property}`}
      data-animated={animated}
      data-keyed={keyed}
    >
      <span className="anim-label">{trackLabel(property)}</span>
      <span className="anim-value" data-testid={`anim-value-${property}`}>
        {formatAnimatedValue(property, evaluated)}
      </span>
      <button
        type="button"
        className={`button secondary anim-key${keyed ? ' keyed' : ''}`}
        aria-label={
          keyed
            ? `${trackLabel(property)} has a keyframe at frame ${currentFrame}`
            : `Add keyframe for ${trackLabel(property)} at frame ${currentFrame}`
        }
        aria-pressed={keyed}
        data-testid={`kf-toggle-${property}`}
        title={
          keyed
            ? 'Keyed at current frame'
            : animated
              ? 'Animated — add keyframe at current frame'
              : 'Not animated — add first keyframe'
        }
        onClick={onAdd}
      >
        {keyed ? <Diamond size={14} /> : <DiamondPlus size={14} />}
      </button>
    </div>
  )
}

function KeyframeEditor({
  instance,
  property,
  keyframe,
  durationFrames,
  onClose,
  onCommit,
  onMoved,
}: {
  instance: ComponentInstance
  property: AnimatableProperty
  keyframe: { frame: number; value: number; easing?: string }
  durationFrames: number
  onClose: () => void
  onCommit: (next: ComponentInstance['animation']) => Promise<void>
  onMoved: (frame: number) => void
}) {
  return (
    <div className="anim-editor" data-testid="keyframe-editor" data-property={property}>
      <h4>
        Keyframe · {trackLabel(property)}
      </h4>
      <div className="inspector-grid">
        <NumField
          label="Frame"
          value={keyframe.frame}
          min={0}
          max={durationFrames - 1}
          step={1}
          onCommit={(v) => {
            const target = Math.min(durationFrames - 1, Math.max(0, Math.floor(v)))
            const result = moveKeyframe(
              instance.animation,
              property,
              keyframe.frame,
              target,
              durationFrames,
            )
            if (result.moved) {
              onMoved(result.frame)
              void onCommit(result.animation)
            }
          }}
        />
        <NumField
          label="Value"
          value={keyframe.value}
          step={property === 'style.opacity' ? 0.1 : 1}
          onCommit={(v) =>
            void onCommit(setKeyframeValue(instance.animation, property, keyframe.frame, v))
          }
        />
      </div>
      <label className="inspector-field">
        <span>Easing</span>
        <select
          aria-label="Easing"
          data-testid="keyframe-easing"
          value={keyframe.easing ?? 'linear'}
          onChange={(e) =>
            void onCommit(
              setKeyframeEasing(instance.animation, property, keyframe.frame, e.target.value),
            )
          }
        >
          <option value="linear">linear</option>
          <option value="easeIn">easeIn</option>
          <option value="easeOut">easeOut</option>
          <option value="easeInOut">easeInOut</option>
        </select>
      </label>
      <div className="inspector-row">
        <button
          type="button"
          className="button secondary anim-delete"
          aria-label={`Delete keyframe ${trackLabel(property)} at frame ${keyframe.frame}`}
          data-testid="keyframe-delete"
          onClick={() => {
            onClose()
            void onCommit(deleteKeyframe(instance.animation, property, keyframe.frame))
          }}
        >
          <Trash2 size={14} /> Delete keyframe
        </button>
      </div>
    </div>
  )
}

const round2 = (v: number): number => Math.round(v * 100) / 100

const formatAnimatedValue = (property: AnimatableProperty, value: number): string => {
  if (!Number.isFinite(value)) return '—'
  if (property === 'style.opacity') return `${Math.round(value * 100)}%`
  if (property === 'transform.rotation') return `${round2(value)}°`
  return String(round2(value))
}
