import { useState } from 'react'
import { Sparkles, Wand2, X } from 'lucide-react'
import { aiApi } from '../../services/ai'
import { getApiError } from '../../services/api'
import type { AISceneOperation, AIScenePlan, SceneDocument } from '../../types/api'

// Minimal AI authoring panel (Stage 4A): prompt → plan preview → apply.
//
// The model only proposes structured operations; nothing touches the
// SceneDocument until the user inspects the plan and applies it through
// POST /scenes/:id/ai/apply, where the server re-validates first. No chat
// history, no streaming, no autonomous loop — deliberately small.
export function AiPanel({
  sceneId,
  onApplied,
}: {
  sceneId: string
  onApplied: (document: SceneDocument) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [plan, setPlan] = useState<AIScenePlan | null>(null)
  const [busy, setBusy] = useState<'plan' | 'apply' | null>(null)
  const [error, setError] = useState('')

  const generate = async () => {
    if (!prompt.trim() || busy) return
    setBusy('plan')
    setError('')
    try {
      const result = await aiApi.plan(sceneId, prompt.trim())
      setPlan(result.plan)
    } catch (reason) {
      setPlan(null)
      setError(getApiError(reason, 'Could not generate a plan'))
    } finally {
      setBusy(null)
    }
  }

  const apply = async () => {
    if (!plan || plan.operations.length === 0 || busy) return
    setBusy('apply')
    setError('')
    try {
      const result = await aiApi.apply(sceneId, plan)
      setPlan(null)
      setPrompt('')
      onApplied(result.document)
    } catch (reason) {
      setError(getApiError(reason, 'Could not apply the plan'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="ai-panel" data-testid="ai-panel">
      <div className="right-head">
        <div>
          <p className="eyebrow">AI</p>
          <h2>Plan scene edit</h2>
        </div>
      </div>
      <textarea
        aria-label="AI prompt"
        placeholder="Move the equation to the right…"
        rows={3}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <button
        type="button"
        className="button secondary"
        disabled={!prompt.trim() || busy !== null}
        onClick={() => void generate()}
      >
        <Sparkles size={15} /> {busy === 'plan' ? 'Generating…' : 'Generate plan'}
      </button>
      {error && <p className="error-copy">{error}</p>}
      {plan && (
        <div className="ai-plan-card" data-testid="ai-plan-preview">
          <div className="ai-plan-head">
            <span>
              {plan.operations.length} operation{plan.operations.length === 1 ? '' : 's'} —
              review before applying
            </span>
            <button type="button" className="text-button" onClick={() => setPlan(null)}>
              <X size={13} /> Discard
            </button>
          </div>
          {plan.operations.length > 0 ? (
            <ul className="ai-plan-list">
              {plan.operations.map((operation, index) => (
                <li key={index}>{describeOperation(operation)}</li>
              ))}
            </ul>
          ) : (
            <p className="ai-plan-empty">The model returned no operations for this request.</p>
          )}
          <button
            type="button"
            className="button primary"
            disabled={busy !== null || plan.operations.length === 0}
            onClick={() => void apply()}
          >
            <Wand2 size={15} /> {busy === 'apply' ? 'Applying…' : 'Apply plan'}
          </button>
        </div>
      )}
    </div>
  )
}

const describeOperation = (operation: AISceneOperation): string => {
  const detail =
    typeof operation.definitionName === 'string'
      ? ` (${operation.definitionName})`
      : typeof operation.property === 'string'
        ? ` (${operation.property})`
        : typeof operation.prop === 'string'
          ? ` (${operation.prop})`
          : ''
  return `${operation.type}${detail}`
}
