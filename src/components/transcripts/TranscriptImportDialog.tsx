import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { getApiError } from '../../services/api'
import { transcriptsApi } from '../../services/transcripts'

export function TranscriptImportDialog({ assetId, projectId, onClose, onImported }: { assetId: string; projectId: string; onClose: () => void; onImported: (id: string) => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setError('')
    try {
      setSaving(true)
      const transcript = JSON.parse(value) as unknown
      const result = await transcriptsApi.import(assetId, transcript, projectId)
      onImported(result.id)
      onClose()
    } catch (reason) {
      setError(getApiError(reason, reason instanceof SyntaxError ? 'Transcript must be valid JSON.' : 'Transcript import failed.'))
    } finally {
      setSaving(false)
    }
  }
  return <div className="modal-backdrop"><div className="modal small-modal"><div className="modal-head"><div><p className="eyebrow">External or manual transcript</p><h2>Import transcript JSON</h2></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button></div>{error && <div className="error-alert">{error}</div>}<textarea className="transcript-import-input" value={value} onChange={(event) => setValue(event.target.value)} placeholder={'{"version":1,"text":"...","words":[]}'}/><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!value.trim() || saving} onClick={() => void save()}><Check size={16} />{saving ? 'Importing…' : 'Import transcript'}</button></div></div></div>
}