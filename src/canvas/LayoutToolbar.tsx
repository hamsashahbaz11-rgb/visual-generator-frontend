import { useState } from 'react'
import type { SceneDocument } from '../types/api'
import { useDocumentStore } from '../store/documentStore'
import { getApiError } from '../services/api'
import {
  alignSubjects,
  canvasBounds,
  distributeSubjects,
  selectionSubjects,
  type AlignMode,
  type DistributeAxis,
} from './layout'

// Small alignment/distribution toolbar (Stage 2C). Operates on the current
// multi-selection through the existing mutation path: local patch first,
// then persist. Groups act as single geometric subjects.
export function LayoutToolbar({ document }: { document: SceneDocument }) {
  const selectedInstanceIds = useDocumentStore((s) => s.selectedInstanceIds)
  const selectedGroupIds = useDocumentStore((s) => s.selectedGroupIds)
  const patchLocalInstances = useDocumentStore((s) => s.patchLocalInstances)
  const persistInstances = useDocumentStore((s) => s.persistInstances)
  const normalizeLayers = useDocumentStore((s) => s.normalizeLayers)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const subjects = selectionSubjects(document, selectedInstanceIds, selectedGroupIds)

  const runLayout = async (
    label: string,
    compute: () => Array<{ id: string; position: { x: number; y: number } }> | null,
  ) => {
    setError('')
    setNotice('')
    const updates = compute()
    if (!updates || updates.length === 0) {
      setNotice(`Nothing to ${label.toLowerCase()}`)
      return
    }
    patchLocalInstances(updates.map((u) => ({ id: u.id, patch: { position: u.position } })))
    try {
      await persistInstances(updates.map((u) => u.id))
    } catch (reason) {
      setError(getApiError(reason, `Could not persist ${label.toLowerCase()}`))
    }
  }

  const align = (mode: AlignMode) =>
    runLayout('align', () => {
      if (subjects.length === 0) return null
      const frame = subjects.length === 1 ? canvasBounds() : undefined
      return alignSubjects(document, subjects, mode, frame)
    })

  const distribute = (axis: DistributeAxis) =>
    runLayout('distribute', () => distributeSubjects(document, subjects, axis))

  const normalize = async () => {
    setError('')
    setNotice('')
    try {
      const changed = await normalizeLayers()
      const total = changed.instances + changed.groups
      setNotice(total === 0 ? 'Layers already normalized' : `Normalized ${total} layer${total === 1 ? '' : 's'}`)
    } catch (reason) {
      setError(getApiError(reason, 'Could not normalize layers'))
    }
  }

  const canAlign = subjects.length > 0
  const canDistribute = subjects.length >= 3
  const hint =
    subjects.length === 0
      ? 'Select components to align'
      : subjects.length === 1
        ? 'Single selection aligns within the canvas'
        : `${subjects.length} targets selected`

  return (
    <div className="layout-toolbar" data-testid="layout-toolbar" role="toolbar" aria-label="Layout">
      <span className="layout-toolbar-group" role="group" aria-label="Align">
        <AlignButton label="Left" mode="left" disabled={!canAlign} onAlign={align} />
        <AlignButton label="Center" mode="centerX" disabled={!canAlign} onAlign={align} />
        <AlignButton label="Right" mode="right" disabled={!canAlign} onAlign={align} />
        <AlignButton label="Top" mode="top" disabled={!canAlign} onAlign={align} />
        <AlignButton label="Middle" mode="middle" disabled={!canAlign} onAlign={align} />
        <AlignButton label="Bottom" mode="bottom" disabled={!canAlign} onAlign={align} />
      </span>
      <span className="layout-toolbar-group" role="group" aria-label="Distribute">
        <button type="button" className="button secondary" disabled={!canDistribute} onClick={() => void distribute('horizontal')}>
          Distribute ⟷
        </button>
        <button type="button" className="button secondary" disabled={!canDistribute} onClick={() => void distribute('vertical')}>
          Distribute ↕
        </button>
      </span>
      <span className="layout-toolbar-group" role="group" aria-label="Layers">
        <button type="button" className="button secondary" onClick={() => void normalize()}>
          Normalize layers
        </button>
      </span>
      <span className="layout-toolbar-hint">{hint}</span>
      {notice && <span className="layout-toolbar-notice">{notice}</span>}
      {error && <span className="layout-toolbar-error">{error}</span>}
    </div>
  )
}

function AlignButton({
  label,
  mode,
  disabled,
  onAlign,
}: {
  label: string
  mode: AlignMode
  disabled: boolean
  onAlign: (mode: AlignMode) => void
}) {
  return (
    <button
      type="button"
      className="button secondary"
      disabled={disabled}
      aria-label={`Align ${label}`}
      onClick={() => onAlign(mode)}
    >
      {label}
    </button>
  )
}
