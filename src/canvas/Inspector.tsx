import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import type { Component, ComponentInstance, SceneDocument } from '../types/api'
import { useDocumentStore } from '../store/documentStore'
import { scenesApi } from '../services/scenes'
import { getApiError } from '../services/api'
import { groupBounds } from './bounds'
import { describeInstance, instanceRefId, refPropsOf } from './references'
import { AnimationInspector } from './AnimationInspector'

interface InspectorProps {
  document: SceneDocument
  definitions: Map<string, Component>
}

// Inspector operates on the selected instance from the document store —
// never on a duplicate object. Local edits update the canvas immediately;
// persistence goes through the existing Stage 1 update operation.
export function Inspector({ document, definitions }: InspectorProps) {
  const selectedInstanceId = useDocumentStore((s) => s.selectedInstanceId)
  const selectedInstanceIds = useDocumentStore((s) => s.selectedInstanceIds)
  const selectedGroupId = useDocumentStore((s) => s.selectedGroupId)
  const selectedGroupIds = useDocumentStore((s) => s.selectedGroupIds)
  const selectInstance = useDocumentStore((s) => s.selectInstance)

  const group = selectedGroupId
    ? document.groups.find((g) => g.id === selectedGroupId)
    : undefined
  const instance = !group && selectedInstanceId
    ? document.components.find((c) => c.id === selectedInstanceId)
    : undefined

  if (group) {
    return <GroupInspector document={document} definitions={definitions} groupId={group.id} />
  }
  if (!instance) {
    return (
      <aside className="inspector" data-testid="inspector-empty">
        <h2>Inspector</h2>
        <p className="inspector-empty">No component selected</p>
      </aside>
    )
  }
  const definition = definitions.get(instance.componentDefinitionId)
  const multiCount = selectedInstanceIds.length + selectedGroupIds.length
  return (
    <aside className="inspector" data-testid="inspector" data-instance-id={instance.id}>
      <h2>Inspector</h2>
      {multiCount > 1 && (
        <p className="inspector-multi" data-testid="inspector-multi">
          {multiCount} selected — editing first
        </p>
      )}
      <div className="inspector-title">
        {definition?.displayName ?? definition?.name ?? 'Unknown component'}
      </div>
      <InstanceInspector
        key={instance.id}
        document={document}
        definitions={definitions}
        instance={instance}
        definition={definition}
        onSelectMember={selectInstance}
      />
    </aside>
  )
}

function InstanceInspector({
  document,
  definitions,
  instance,
  definition,
  onSelectMember,
}: {
  document: SceneDocument
  definitions: Map<string, Component>
  instance: ComponentInstance
  definition?: Component
  onSelectMember: (id: string) => void
}) {
  const patchLocalInstance = useDocumentStore((s) => s.patchLocalInstance)
  const persistInstance = useDocumentStore((s) => s.persistInstance)
  const [error, setError] = useState('')

  const commit = async (patch: Partial<ComponentInstance>) => {
    setError('')
    patchLocalInstance(instance.id, patch)
    try {
      await persistInstance(instance.id)
    } catch (reason) {
      setError(getApiError(reason, 'Could not save changes'))
    }
  }

  const commitNumber = (
    field: 'x' | 'y' | 'w' | 'h' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity' | 'zIndex',
    raw: number,
  ) => {
    if (!Number.isFinite(raw)) return
    switch (field) {
      case 'x':
        return void commit({ position: { ...instance.position, x: raw } })
      case 'y':
        return void commit({ position: { ...instance.position, y: raw } })
      case 'w':
        return void commit({
          size: { ...instance.size, width: Math.max(10, raw) },
        })
      case 'h':
        return void commit({
          size: { ...instance.size, height: Math.max(10, raw) },
        })
      case 'rotation':
        return void commit({ transform: { ...instance.transform, rotation: raw } })
      case 'scaleX':
        return void commit({ transform: { ...instance.transform, scaleX: raw } })
      case 'scaleY':
        return void commit({ transform: { ...instance.transform, scaleY: raw } })
      case 'opacity':
        return void commit({
          style: { ...instance.style, opacity: Math.min(1, Math.max(0, raw)) },
        })
      case 'zIndex':
        return void commit({ zIndex: Math.round(raw) })
    }
  }

  const setLayer = (mode: 'front' | 'back' | 'forward' | 'backward') => {
    const zs = document.components.map((c) => c.zIndex)
    const max = zs.length ? Math.max(...zs) : 0
    const min = zs.length ? Math.min(...zs) : 0
    const next =
      mode === 'front' ? max + 1
      : mode === 'back' ? min - 1
      : mode === 'forward' ? instance.zIndex + 1
      : instance.zIndex - 1
    void commit({ zIndex: next })
  }

  const setProp = (prop: string, value: unknown) =>
    commit({ props: { ...instance.props, [prop]: value } })

  return (
    <div className="inspector-body">
      {error && <p className="inspector-error">{error}</p>}
      <section>
        <h3>Position</h3>
        <div className="inspector-grid">
          <NumField label="X" value={instance.position.x} onCommit={(v) => commitNumber('x', v)} />
          <NumField label="Y" value={instance.position.y} onCommit={(v) => commitNumber('y', v)} />
        </div>
      </section>
      <section>
        <h3>Size</h3>
        <div className="inspector-grid">
          <NumField label="Width" value={instance.size.width} min={10} onCommit={(v) => commitNumber('w', v)} />
          <NumField label="Height" value={instance.size.height} min={10} onCommit={(v) => commitNumber('h', v)} />
        </div>
      </section>
      <section>
        <h3>Transform</h3>
        <div className="inspector-grid">
          <NumField label="Rotation" value={instance.transform.rotation} onCommit={(v) => commitNumber('rotation', v)} />
          <NumField label="Scale X" value={instance.transform.scaleX} step={0.1} onCommit={(v) => commitNumber('scaleX', v)} />
          <NumField label="Scale Y" value={instance.transform.scaleY} step={0.1} onCommit={(v) => commitNumber('scaleY', v)} />
        </div>
      </section>
      <section>
        <h3>Style</h3>
        <div className="inspector-grid">
          <NumField label="Opacity" value={instance.style.opacity ?? 1} min={0} max={1} step={0.1} onCommit={(v) => commitNumber('opacity', v)} />
        </div>
        <label className="inspector-check">
          <input
            type="checkbox"
            checked={instance.visible}
            onChange={(e) => void commit({ visible: e.target.checked })}
          />
          {instance.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          Visible
        </label>
      </section>
      <AnimationInspector document={document} instance={instance} />
      <section>
        <h3>Layer</h3>
        <div className="inspector-grid">
          <NumField label="Z-index" value={instance.zIndex} step={1} onCommit={(v) => commitNumber('zIndex', v)} />
        </div>
        <div className="inspector-row">
          <button type="button" className="button secondary" onClick={() => setLayer('front')}>Front</button>
          <button type="button" className="button secondary" onClick={() => setLayer('forward')}>Fwd</button>
          <button type="button" className="button secondary" onClick={() => setLayer('backward')}>Back</button>
          <button type="button" className="button secondary" onClick={() => setLayer('back')}>Send back</button>
        </div>
      </section>
      <section>
        <h3>Props</h3>
        <PropFields
          instance={instance}
          definition={definition}
          document={document}
          definitions={definitions}
          onCommit={setProp}
        />
      </section>
      {instance.groupId && (
        <section>
          <h3>Group</h3>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              const parentId: string | null = instance.groupId ?? null
              useDocumentStore.getState().selectGroup(parentId)
            }}
          >
            Select parent group
          </button>
        </section>
      )}
      <section className="inspector-meta">
        <span>ID {instance.id.slice(0, 8)}</span>
        <button type="button" className="inspector-member" onClick={() => onSelectMember(instance.id)}>
          reselect
        </button>
      </section>
    </div>
  )
}

type JsonSchemaProp = {
  type?: string
  enum?: unknown[]
  minimum?: number
  maximum?: number
}

const schemaProperties = (definition?: Component): Record<string, JsonSchemaProp> => {
  const schema = definition?.propsSchema as
    | { properties?: Record<string, JsonSchemaProp> }
    | undefined
  return schema?.properties ?? {}
}

function PropFields({
  instance,
  definition,
  document,
  definitions,
  onCommit,
}: {
  instance: ComponentInstance
  definition?: Component
  document: SceneDocument
  definitions: Map<string, Component>
  onCommit: (prop: string, value: unknown) => Promise<void>
}) {
  const properties = schemaProperties(definition)
  const names = Object.keys(properties)
  const refs = new Set(refPropsOf(definition))
  if (names.length === 0) {
    return <p className="inspector-empty">No editable props.</p>
  }
  return (
    <div className="inspector-props">
      {names.map((name) => {
        if (refs.has(name)) {
          return (
            <ReferenceField
              key={name}
              label={name}
              value={instanceRefId(instance, name)}
              candidates={document.components.filter((c) => c.id !== instance.id)}
              definitions={definitions}
              onCommit={(targetId) => onCommit(name, targetId)}
            />
          )
        }
        return (
          <SchemaField
            key={name}
            label={name}
            schema={properties[name]}
            value={instance.props[name]}
            onCommit={(value) => onCommit(name, value)}
          />
        )
      })}
    </div>
  )
}

function ReferenceField({
  label,
  value,
  candidates,
  definitions,
  onCommit,
}: {
  label: string
  value: string | null
  candidates: ComponentInstance[]
  definitions: Map<string, Component>
  onCommit: (targetId: string) => Promise<void>
}) {
  const missing = value && !candidates.some((c) => c.id === value)
  return (
    <label className="inspector-field">
      <span>{label} (reference)</span>
      <select
        value={value ?? ''}
        onChange={(e) => void onCommit(e.target.value)}
        data-testid={`ref-${label}`}
      >
        <option value="">None</option>
        {missing && <option value={value ?? ''}>Missing: {(value ?? '').slice(0, 8)}…</option>}
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {describeInstance(c, definitions.get(c.componentDefinitionId))}
          </option>
        ))}
      </select>
    </label>
  )
}

function SchemaField({
  label,
  schema,
  value,
  onCommit,
}: {
  label: string
  schema: JsonSchemaProp
  value: unknown
  onCommit: (value: unknown) => Promise<void>
}) {
  const options = schema.enum
  if (options) {
    return (
      <label className="inspector-field">
        <span>{label}</span>
        <select
          value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
          onChange={(e) => void onCommit(coerceEnum(e.target.value, options))}
        >
          {options.map((option) => (
            <option key={String(option)} value={String(option)}>
              {String(option)}
            </option>
          ))}
        </select>
      </label>
    )
  }
  if (schema.type === 'boolean') {
    return (
      <label className="inspector-check">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => void onCommit(e.target.checked)}
        />
        {label}
      </label>
    )
  }
  if (schema.type === 'number' || schema.type === 'integer') {
    return (
      <NumField
        label={label}
        value={typeof value === 'number' ? value : 0}
        min={schema.minimum}
        max={schema.maximum}
        step={schema.type === 'integer' ? 1 : 0.1}
        onCommit={(v) => void onCommit(schema.type === 'integer' ? Math.round(v) : v)}
      />
    )
  }
  if (schema.type === 'string') {
    return (
      <TextField
        label={label}
        value={typeof value === 'string' ? value : ''}
        onCommit={(v) => void onCommit(v)}
      />
    )
  }
  return (
    <div className="inspector-field">
      <span>{label} (read-only)</span>
      <code className="inspector-readonly">{JSON.stringify(value ?? null)}</code>
    </div>
  )
}

const coerceEnum = (raw: string, options: unknown[]): unknown => {
  const match = options.find((o) => String(o) === raw)
  return match ?? raw
}

export function NumField({
  label,
  value,
  min,
  max,
  step = 1,
  onCommit,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  useEffect(() => {
    setDraft(null)
  }, [value])
  const commitDraft = () => {
    if (draft === null) return
    const parsed = Number(draft)
    setDraft(null)
    if (!Number.isFinite(parsed)) return
    const clamped =
      min !== undefined || max !== undefined
        ? Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed))
        : parsed
    if (clamped !== value) onCommit(clamped)
  }
  return (
    <label className="inspector-field">
      <span>{label}</span>
      <input
        type="number"
        value={draft ?? String(value)}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </label>
  )
}

export function TextField({
  label,
  value,
  onCommit,
}: {
  label: string
  value: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  useEffect(() => {
    setDraft(null)
  }, [value])
  const commitDraft = () => {
    if (draft === null) return
    setDraft(null)
    if (draft !== value) onCommit(draft)
  }
  return (
    <label className="inspector-field">
      <span>{label}</span>
      <input
        type="text"
        value={draft ?? value}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </label>
  )
}

function GroupInspector({
  document,
  definitions,
  groupId,
}: {
  document: SceneDocument
  definitions: Map<string, Component>
  groupId: string
}) {
  const group = document.groups.find((g) => g.id === groupId)
  const upsertGroup = useDocumentStore((s) => s.upsertGroup)
  const selectInstance = useDocumentStore((s) => s.selectInstance)
  const [name, setName] = useState(group?.name ?? '')
  const [error, setError] = useState('')
  useEffect(() => {
    setName(group?.name ?? '')
  }, [group?.name])
  if (!group) {
    return (
      <aside className="inspector" data-testid="inspector-empty">
        <h2>Inspector</h2>
        <p className="inspector-empty">No component selected</p>
      </aside>
    )
  }
  const bounds = groupBounds(document, group.id)
  const memberIds = document.components.filter((c) => c.groupId === group.id)
  const commitName = async () => {
    const next = name.trim()
    if (!next || next === group.name) {
      setName(group.name)
      return
    }
    try {
      const saved = await scenesApi.updateGroup(group.id, { name: next })
      upsertGroup(saved)
    } catch (reason) {
      setError(getApiError(reason, 'Could not rename group'))
      setName(group.name)
    }
  }
  return (
    <aside className="inspector" data-testid="inspector-group" data-group-id={group.id}>
      <h2>Inspector</h2>
      <div className="inspector-title">Group · {group.name}</div>
      <div className="inspector-body">
        {error && <p className="inspector-error">{error}</p>}
        <section>
          <h3>Name</h3>
          <label className="inspector-field">
            <span>Name</span>
            <input
              type="text"
              value={name}
              aria-label="Group name"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => void commitName()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
            />
          </label>
        </section>
        <section>
          <h3>Bounds</h3>
          <p className="inspector-bounds" data-testid="group-bounds">
            {bounds
              ? `x ${Math.round(bounds.x)} · y ${Math.round(bounds.y)} · ${Math.round(bounds.width)}×${Math.round(bounds.height)}`
              : 'Empty group'}
          </p>
          <p className="inspector-empty">Drag the group chip on the canvas to move all children together.</p>
        </section>
        <section>
          <h3>Members ({memberIds.length})</h3>
          <div className="inspector-members">
            {memberIds.map((m) => (
              <button
                key={m.id}
                type="button"
                className="inspector-member"
                onClick={() => selectInstance(m.id)}
              >
                {describeInstance(m, definitions.get(m.componentDefinitionId))}
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  )
}
