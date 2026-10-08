import { useState } from 'react'
import { Bot, Sparkles, Wand2, X } from 'lucide-react'
import { aiApi } from '../../services/ai'
import { getApiError } from '../../services/api'
import type {
  AIExecuteResponse,
  AIExecuteStatus,
  AISceneOperation,
  AIScenePlan,
  SceneDocument,
} from '../../types/api'

// Minimal AI authoring panel (Stage 4A + 4B): prompt → plan preview →
// apply, plus a bounded agent execution.
//
// The model only proposes structured operations; nothing touches the
// SceneDocument until either the user applies a previewed plan or the
// server-side bounded agent validates one through POST /scenes/:id/ai/execute
// (fixed iteration/tool/operation/time budgets, deterministic verification).
// No chat history, no streaming, no autonomous loop — deliberately small.
export function AiPanel({
  sceneId,
  onApplied,
}: {
  sceneId: string
  onApplied: (document: SceneDocument) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [plan, setPlan] = useState<AIScenePlan | null>(null)
  const [busy, setBusy] = useState<'plan' | 'apply' | 'execute' | null>(null)
  const [error, setError] = useState('')
  const [executeResult, setExecuteResult] = useState<AIExecuteResponse | null>(null)

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

  const execute = async () => {
    if (!prompt.trim() || busy) return
    setBusy('execute')
    setError('')
    setPlan(null)
    setExecuteResult(null)
    try {
      const result = await aiApi.execute(sceneId, prompt.trim())
      setExecuteResult(result)
      // Always refresh: even a non-completed status may have applied
      // earlier iterations, and the panel must show the current document.
      onApplied(result.document)
    } catch (reason) {
      setError(getApiError(reason, 'Could not run the agent'))
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
      <div className="ai-actions">
        <button
          type="button"
          className="button secondary"
          disabled={!prompt.trim() || busy !== null}
          onClick={() => void generate()}
        >
          <Sparkles size={15} /> {busy === 'plan' ? 'Generating…' : 'Generate plan'}
        </button>
        <button
          type="button"
          className="button primary"
          disabled={!prompt.trim() || busy !== null}
          onClick={() => void execute()}
          title="Bounded agent: inspects the scene, applies a validated plan, and verifies the result (server-set limits)"
        >
          <Bot size={15} />{' '}
          {busy === 'execute' ? 'Inspecting, planning, verifying…' : 'Execute'}
        </button>
      </div>
      {error && <p className="error-copy">{error}</p>}
      {executeResult && (
        <div className="ai-plan-card" data-testid="ai-execute-result">
          <div className="ai-plan-head">
            <span>
              {statusLabel(executeResult.status)} · {executeResult.iterations} iteration
              {executeResult.iterations === 1 ? '' : 's'} · {executeResult.toolCalls} tool
              {executeResult.toolCalls === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              className="text-button"
              onClick={() => setExecuteResult(null)}
            >
              <X size={13} /> Dismiss
            </button>
          </div>
          <ul className="ai-plan-list">
            <li>{executeResult.appliedOperations.length} operation(s) applied</li>
            {executeResult.verification &&
              (executeResult.verification.passed ? (
                <li>Verification passed (deterministic checks)</li>
              ) : (
                executeResult.verification.issues.map((issue, index) => (
                  <li key={index}>Unverified: {issue}</li>
                ))
              ))}
            {executeResult.failure && (
              <li>
                {executeResult.failure.code}: {executeResult.failure.message}
              </li>
            )}
          </ul>
        </div>
      )}
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

const STATUS_LABELS: Record<AIExecuteStatus, string> = {
  completed: 'Completed — verified',
  max_iterations: 'Stopped at the iteration limit',
  validation_failed: 'Stopped — plans failed validation',
  tool_error: 'Stopped — tool/turn budget reached',
  provider_error: 'Stopped — model error',
  application_error: 'Stopped — application error',
  unauthorized: 'Stopped — access denied',
  timeout: 'Stopped — time budget exceeded',
}

const statusLabel = (status: AIExecuteStatus): string =>
  STATUS_LABELS[status] ?? `Stopped — ${status}`

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
