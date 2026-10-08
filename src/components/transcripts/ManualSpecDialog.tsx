import { useEffect, useState } from 'react'
import { Check, Copy, X, Loader2, ExternalLink } from 'lucide-react'
import { generationApi } from '../../services/generation'
import { getApiError } from '../../services/api'
import { useToast } from '../../hooks/useToast'

interface ManualSpecDialogProps {
  projectId: string
  transcriptId: string
  instructions?: string
  onClose: () => void
  onSuccess: (spec: Record<string, unknown>) => Promise<void>
}

export function ManualSpecDialog({
  projectId,
  transcriptId,
  instructions = '',
  onClose,
  onSuccess,
}: ManualSpecDialogProps) {
  const [step, setStep] = useState<'prompt' | 'submit'>('prompt')
  const [promptText, setPromptText] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [submittedJson, setSubmittedJson] = useState('')
  const [promptError, setPromptError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [loadingPrompt, setLoadingPrompt] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    fetchPrompt()
  }, [projectId, transcriptId, instructions])

  const fetchPrompt = async () => {
    setLoadingPrompt(true)
    setPromptError('')
    try {
      const response = await generationApi.manualPrompt(projectId, {
        transcriptId,
        instructions,
      })
      setPromptText(response.promptText)
    } catch (reason) {
      const errorMessage = getApiError(reason, 'Failed to generate manual prompt')
      setPromptError(errorMessage)
    } finally {
      setLoadingPrompt(false)
    }
  }

  const copyPrompt = async () => {
    if (!promptText) return
    setPromptError('')
    try {
      await navigator.clipboard.writeText(promptText)
      setCopied(true)
      showToast('Prompt copied to clipboard', 'success')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setPromptError('Copy is unavailable. Select the prompt text manually and copy it.')
    }
  }

  const handleSubmit = async () => {
    if (!submittedJson.trim()) {
      setSubmitError('Please paste the AI response JSON')
      return
    }
    setSubmitError('')
    setSubmitting(true)
    try {
      const response = await generationApi.manualSubmit(projectId, {
        transcriptId,
        rawResponse: submittedJson.trim(),
        save: false,
      })
      await onSuccess(response.spec)
      showToast('Spec generated and saved successfully!', 'success')
      onClose()
    } catch (reason) {
      const errorMessage = getApiError(reason, 'Failed to submit manual spec')
      setSubmitError(errorMessage)
      showToast(errorMessage, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const validateJson = (json: string) => {
    try {
      JSON.parse(json)
      return true
    } catch {
      return false
    }
  }

  const isJsonValid = validateJson(submittedJson.trim())

  if (step === 'prompt') {
    return (
      <div className="modal-backdrop">
        <div className="modal transcript-prompt-modal" role="dialog" aria-modal="true" aria-labelledby="manual-spec-title">
          <div className="modal-head">
            <div>
              <p className="eyebrow">Manual spec generation</p>
              <h2 id="manual-spec-title">Copy generation prompt</h2>
            </div>
            <button className="icon-button" aria-label="Close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <p className="transcript-prompt-help">
            Paste this prompt into an external AI (ChatGPT, Claude, etc.), then paste the JSON response here.
          </p>

          {promptError && <div className="error-alert">{promptError}</div>}

          {loadingPrompt ? (
            <div className="loading-panel" style={{ minHeight: '200px' }}>
              <div className="loading-spinner" style={{ width: '32px', height: '32px', borderWidth: '4px' }} />
              <p style={{ marginTop: '12px', color: 'var(--muted)', fontSize: '11px' }}>Generating prompt...</p>
            </div>
          ) : (
            <textarea
              className="transcript-prompt-input"
              value={promptText ?? ''}
              readOnly
              autoFocus
              spellCheck={false}
            />
          )}

          <div className="modal-foot">
            <span>{promptText?.length ?? 0} characters · JSON output required</span>
            <div>
              <button className="button secondary" onClick={onClose} disabled={loadingPrompt}>
                Close
              </button>
              <button
                className="button primary"
                onClick={() => void copyPrompt()}
                disabled={loadingPrompt || !promptText}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy prompt'}
              </button>
              <button
                className="button secondary"
                onClick={() => setStep('submit')}
                disabled={loadingPrompt || !promptText}
              >
                <ExternalLink size={16} /> I have the JSON response
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop">
      <div className="modal transcript-prompt-modal" role="dialog" aria-modal="true" aria-labelledby="manual-submit-title">
        <div className="modal-head">
          <div>
            <p className="eyebrow">Manual spec generation</p>
            <h2 id="manual-submit-title">Paste AI response</h2>
          </div>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="transcript-prompt-help">
          Paste the complete JSON response from the AI. It must be valid JSON matching the spec schema.
        </p>

        {submitError && <div className="error-alert">{submitError}</div>}

        <textarea
          className="transcript-prompt-input"
          value={submittedJson}
          onChange={(e) => setSubmittedJson(e.target.value)}
          placeholder="Paste the AI's JSON response here..."
          autoFocus
          spellCheck={false}
          style={{ minHeight: '300px' }}
        />

        <div className="modal-foot">
          <span>
            {submittedJson.length} characters{' '}
            {submittedJson.trim() && (
              <>
                · {isJsonValid ? (
                  <span style={{ color: '#2e9a69' }}>Valid JSON</span>
                ) : (
                  <span style={{ color: '#b54747' }}>Invalid JSON</span>
                )}
              </>
            )}
          </span>
          <div>
            <button className="button secondary" onClick={() => setStep('prompt')}>
              Back
            </button>
            <button
              className="button primary"
              onClick={() => void handleSubmit()}
              disabled={submitting || !submittedJson.trim() || !isJsonValid}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin" /> Submitting...
                </>
              ) : (
                'Submit spec'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}