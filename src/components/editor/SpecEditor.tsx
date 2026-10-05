import { useEffect, useState } from 'react'
import { Check, Copy, X, AlertCircle } from 'lucide-react'
import type { Project } from '../../types/api'
import { parseApiError } from '../../services/api'

interface SpecEditorProps {
  project: Project
  onClose: () => void
  onSave: (spec: Record<string, unknown>) => Promise<void>
  updateMutation: ReturnType<typeof import('../../hooks/useApi').useProject>['update']
}

export function SpecEditor({ project, onClose, onSave, updateMutation }: SpecEditorProps) {
  const [value, setValue] = useState(JSON.stringify(project.spec ?? {}, null, 2))
  const [error, setError] = useState('')
  const [structuredError, setStructuredError] = useState<ReturnType<typeof parseApiError> | null>(null)
  const isSaving = updateMutation.isPending

  useEffect(() => setValue(JSON.stringify(project.spec ?? {}, null, 2)), [project.spec])

  const save = async () => {
    setError('')
    setStructuredError(null)
    try {
      const parsed = JSON.parse(value)
      await onSave(parsed)
      onClose()
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Spec must be valid JSON before saving.')
      } else {
        const parsed = parseApiError(err)
        setStructuredError(parsed)
        setError(parsed.message)
      }
    }
  }

  return <div className="modal-backdrop">
    <div className="modal spec-modal">
      <div className="modal-head">
        <div><p className="eyebrow">Visual specification</p><h2>Edit project spec</h2></div>
        <div className="modal-tools">
          <button className="button ghost" onClick={() => navigator.clipboard?.writeText(value)}>
            <Copy size={15} />Copy
          </button>
          <button className="icon-button" aria-label="Close" onClick={onClose} disabled={isSaving}>
            <X size={18} />
          </button>
        </div>
      </div>
      {(error || structuredError) && (
        <div className="error-alert">
          <div className="error-alert-main">
            <AlertCircle size={16} className="error-icon" />
            <div className="error-content">
              <div className="error-message">{error}</div>
              {structuredError?.code && <span className="error-code">{structuredError.code}</span>}
            </div>
          </div>
          {structuredError?.details.length && (
            <div className="error-details">
              <pre>{structuredError.details.map((d) => typeof d === 'string' ? d : JSON.stringify(d, null, 2)).join('\n')}</pre>
            </div>
          )}
        </div>
      )}
      <div className="code-editor">
        <div className="line-numbers">{value.split('\n').map((_, index) => <span key={index}>{String(index + 1).padStart(2, '0')}</span>)}</div>
        <textarea value={value} onChange={(event) => setValue(event.target.value)} spellCheck={false} disabled={isSaving} />
      </div>
      <div className="modal-foot">
        <span>{value.length} characters · JSON</span>
        <div>
          <button className="button secondary" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button className="button primary" onClick={save} disabled={isSaving}>
            <Check size={16} />{isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  </div>
}
