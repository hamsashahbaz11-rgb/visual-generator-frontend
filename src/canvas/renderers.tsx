import type { CSSProperties } from 'react'
import type { Component, ComponentInstance, SceneDocument } from '../types/api'
import { connectorEndpointsFor, BUILT_IN_RENDERER_KEYS } from '@app/render'

// Renderer registry (Stage 2A).
//
// Maps a component *definition name* to its visual renderer:
//   ComponentInstance → componentDefinition → registry → React component
//
// The authoritative list of supported renderer keys comes from @app/render.
// Only these keys will have registered renderers; unknown keys fall back to
// UnsupportedRenderer.

export interface RendererProps {
  instance: ComponentInstance
  /** Resolved definition; undefined when the definition is unknown/deleted. */
  definition?: Component
  definitionName: string
  /** Current scene document — used to resolve generic instance references. */
  document: SceneDocument
}

type Renderer = (props: RendererProps) => JSX.Element

const registry = new Map<string, Renderer>()

export const registerRenderer = (definitionName: string, renderer: Renderer): void => {
  registry.set(definitionName, renderer)
}

export const resolveRenderer = (definitionName: string): Renderer =>
  registry.get(definitionName) ?? UnsupportedRenderer

export const registeredRendererNames = (): string[] => [...registry.keys()]

export const isSupportedRendererKey = (name: string): boolean =>
  BUILT_IN_RENDERER_KEYS.includes(name as typeof BUILT_IN_RENDERER_KEYS[number])

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const paletteColor = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  if (value.startsWith('palette:')) return undefined // palette resolution is a later stage
  return value
}

// --- Label → short text tag -----------------------------------------------
const LabelRenderer = ({ instance }: RendererProps): JSX.Element => {
  const props = asRecord(instance.props)
  const color = paletteColor(props.color) ?? '#2B2620'
  return (
    <div className="renderer-label" style={{ color }}>
      {asString(props.text, 'Label')}
    </div>
  )
}

// --- CounterPill → big number pill -----------------------------------------
const CounterPillRenderer = ({ instance }: RendererProps): JSX.Element => {
  const props = asRecord(instance.props)
  const to = asNumber(props.to, asNumber(props.from, 0))
  const decimals = Math.min(3, Math.max(0, Math.round(asNumber(props.decimals, 0))))
  const value = `${asString(props.prefix, '')}${to.toFixed(decimals)}${asString(props.suffix, '')}`
  return (
    <div
      className="renderer-pill"
      style={{ borderColor: paletteColor(props.color) ?? '#1F3A93' }}
    >
      {value}
    </div>
  )
}

// --- Hub → central circle node ----------------------------------------------
const HubRenderer = ({ instance }: RendererProps): JSX.Element => {
  const props = asRecord(instance.props)
  const color = paletteColor(props.color) ?? '#F5A623'
  return (
    <div className="renderer-hub" style={{ background: color }}>
      <span>{asString(props.label, '')}</span>
    </div>
  )
}

// --- Arrow → connector between referenced instances ---------------------------
// Generic reference model: `from`/`to` props hold ComponentInstance ids
// (declared via the definition's refProps). Endpoints are computed from the
// referenced components' bounds, so the arrow follows them when they move.
// Missing refs fall back to the arrow's own box; the scene never crashes.
const ArrowRenderer = ({ instance, document }: RendererProps): JSX.Element => {
  const props = asRecord(instance.props)
  const dashed = asString(props.style, 'dashed') !== 'solid'
  const color = paletteColor(props.color) ?? '#2B2620'
  const markerId = `arrowhead-${instance.id}`

  // Shared reference semantics: endpoints resolve from the scene document.
  const endpoints = connectorEndpointsFor(document.components, instance)

  if (endpoints) {
    const { p1, p2 } = endpoints
    const pad = 16
    const originX = Math.min(p1.x, p2.x) - pad
    const originY = Math.min(p1.y, p2.y) - pad
    const w = Math.max(1, Math.max(p1.x, p2.x) - originX + pad)
    const h = Math.max(1, Math.max(p1.y, p2.y) - originY + pad)
    return (
      <svg
        className="renderer-arrow renderer-arrow-bound"
        width={w}
        height={h}
        viewBox={`${originX} ${originY} ${w} ${h}`}
        style={{ position: 'absolute', left: originX - instance.position.x, top: originY - instance.position.y, overflow: 'visible' }}
      >
        <defs>
          <marker id={markerId} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill={color} />
          </marker>
        </defs>
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={color}
          strokeWidth={3}
          strokeDasharray={dashed ? '10 7' : undefined}
          markerEnd={`url(#${markerId})`}
        />
      </svg>
    )
  }

  const w = Math.max(1, instance.size.width)
  const h = Math.max(1, instance.size.height)
  const midY = h / 2
  return (
    <svg className="renderer-arrow" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <marker id={markerId} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill={color} />
        </marker>
      </defs>
      <line
        x1={8}
        y1={midY}
        x2={Math.max(9, w - 12)}
        y2={midY}
        stroke={color}
        strokeWidth={3}
        strokeDasharray={dashed ? '10 7' : undefined}
        markerEnd={`url(#${markerId})`}
      />
    </svg>
  )
}

// --- LogoCard → company/product card -------------------------------------------
const LogoCardRenderer = ({ instance }: RendererProps): JSX.Element => {
  const props = asRecord(instance.props)
  const variant = asString(props.variant, 'light')
  const label = asString(props.label, '')
  return (
    <div className={`renderer-logocard ${variant === 'dark' ? 'dark' : 'light'}`}>
      <span className="renderer-logocard-label">{label || 'Logo'}</span>
      {label === '' && <span className="renderer-logocard-hint">asset card</span>}
    </div>
  )
}

// --- Fallback: never crash the scene -------------------------------------------
export const UnsupportedRenderer = ({ definitionName }: RendererProps): JSX.Element => (
  <div className="renderer-unsupported" data-unsupported={definitionName}>
    <strong>Unsupported component</strong>
    <span>{definitionName}</span>
  </div>
)

// Register built-in renderers. Keep in sync with BUILT_IN_RENDERER_KEYS from @app/render.
registerRenderer('Label', LabelRenderer)
registerRenderer('CounterPill', CounterPillRenderer)
registerRenderer('Hub', HubRenderer)
registerRenderer('Arrow', ArrowRenderer)
registerRenderer('LogoCard', LogoCardRenderer)

// Development-only assertion: registered renderers must match authoritative keys.
if (import.meta.env.DEV) {
  const registered = registeredRendererNames().sort()
  const authoritative = [...BUILT_IN_RENDERER_KEYS].sort()
  if (JSON.stringify(registered) !== JSON.stringify(authoritative)) {
    console.error(
      '[renderer registry drift] Registered keys:', registered,
      'Authoritative keys:', authoritative,
    )
  }
}

export const instanceStyle = (
  instance: ComponentInstance,
): CSSProperties => ({
  width: instance.size.width,
  height: instance.size.height,
  opacity: instance.style.opacity ?? 1,
  transform: `rotate(${instance.transform.rotation ?? 0}deg) scale(${instance.transform.scaleX ?? 1}, ${instance.transform.scaleY ?? 1})`,
  zIndex: instance.zIndex,
});
