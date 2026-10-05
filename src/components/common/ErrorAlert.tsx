import { ChevronDown, ChevronUp, Copy, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { parseApiError, StructuredApiError } from '../../services/api'

function formatDetails(details: unknown[]): string {
  if (!details.length) return ''
  return details
    .map((d) => {
      if (typeof d === 'string') return d
      if (typeof d === 'object' && d !== null) {
        if ('path' in d && 'code' in d && 'message' in d) {
          return `[${d.code}] ${d.path}: ${d.message}`
        }
        return JSON.stringify(d, null, 2)
      }
      return String(d)
    })
    .join('\n')
}

export function ErrorAlert({ message, error }: { message?: string; error?: unknown }) {
  const structured = error ? parseApiError(error) : message ? { code: '', message, details: [], issues: [] } : null
  if (!structured) return null

  const [expanded, setExpanded] = useState(false)
  const detailsText = formatDetails(structured.details)

  return (
    <div className="error-alert" role="alert">
      <div className="error-alert-main">
        <AlertCircle size={16} className="error-icon" />
        <div className="error-content">
          <div className="error-message">{structured.message}</div>
          {structured.code && <span className="error-code">{structured.code}</span>}
        </div>
      </div>
      {detailsText && (
        <div className="error-details">
          <button
            className="error-toggle"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            {expanded ? 'Hide details' : 'Show details'}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {expanded && (
            <div className="error-details-content">
              <pre>{detailsText}</pre>
              <button
                className="button ghost copy-button"
                onClick={() => navigator.clipboard?.writeText(detailsText)}
              >
                <Copy size={14} /> Copy
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
