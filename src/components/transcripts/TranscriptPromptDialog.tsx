import { useEffect, useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import type { Asset } from '../../types/api'

const buildPrompt = (asset: Asset) => `You are a precise audio/video transcription assistant. Transcribe the uploaded media file "${asset.originalName}" and return the result in the exact JSON format below.

Requirements:
- Transcribe every spoken word in the original order.
- Preserve the spoken wording. Do not summarize, rewrite, translate, or add commentary.
- Use seconds for all timestamps. Start at 0 or later.
- For every word, provide a start timestamp and an end timestamp. Word timestamps must be chronological, and each end must be greater than 0 and greater than or equal to its start.
- Include punctuation attached to the relevant word when appropriate, but keep each words[] item as one spoken word/token.
- Set text to the complete transcript as readable plain text.
- Set language to the detected language using a short language name or code such as "English" or "en".
- Set durationSeconds to the media duration when available.
- If the media contains no speech, return a clear empty-speech result with text set to "No speech detected." and words set to [].
- Do not include markdown fences, explanations, speaker labels outside the JSON, confidence scores, or any extra properties.

Return ONLY one valid JSON object matching this shape:
{
  "version": 1,
  "language": "en",
  "text": "The complete transcript goes here.",
  "durationSeconds": 12.34,
  "words": [
    { "word": "The", "start": 0.00, "end": 0.42 },
    { "word": "complete", "start": 0.43, "end": 0.88 },
    { "word": "transcript", "start": 0.89, "end": 1.40 }
  ]
}

Before replying, validate that the response is strict JSON, every words[] item has word/start/end, timestamps are non-negative, and no text appears before or after the JSON.`

export function TranscriptPromptDialog({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const prompt = buildPrompt(asset)
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown) }, [onClose])
  const copy = async () => {
    setError('')
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Copy is unavailable. Select the prompt text manually and copy it.')
    }
  }
  return <div className="modal-backdrop"><div className="modal transcript-prompt-modal" role="dialog" aria-modal="true" aria-labelledby="transcript-prompt-title"><div className="modal-head"><div><p className="eyebrow">External AI transcription</p><h2 id="transcript-prompt-title">Copy transcription prompt</h2></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button></div><p className="transcript-prompt-help">Upload the same media file to an external AI website, paste this prompt, then paste its JSON response into Import transcript JSON.</p>{error && <div className="error-alert">{error}</div>}<textarea className="transcript-prompt-input" value={prompt} readOnly autoFocus spellCheck={false} /><div className="modal-foot"><span>{prompt.length} characters · JSON output required</span><div><button className="button secondary" onClick={onClose}>Close</button><button className="button primary" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy prompt'}</button></div></div></div></div>
}
