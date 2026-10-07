import { useEffect, useRef, useState } from 'react'
import { Download, Film, RefreshCw, X } from 'lucide-react'
import { renderApi } from '../../services/render'
import { getApiError } from '../../services/api'
import { isTerminalRenderStatus, type Render } from '../../types/api'
import { useRenderStatus, useSceneRenders } from '../../hooks/useApi'

// Scene render workflow (Stage 3F): async production render control.
//
// Render button → POST /scenes/:id/renders (202, persistent record) →
// lightweight polling of GET /renders/:id/status while queued/running →
// terminal states stop polling. Completed output previews/downloads through
// the existing asset file mechanism. No WebSockets; no editor redesign.
export function SceneRenderPanel({ sceneId }: { sceneId: string }) {
  const { data: renders = [], refetch, create, cancel } = useSceneRenders(sceneId)
  const [actionError, setActionError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const latest = renders[0]
  const active = latest && !isTerminalRenderStatus(latest.status) ? latest : undefined
  const { data: live } = useRenderStatus(active?.id, Boolean(active))
  const submittingRef = useRef(false)
  const pendingKeyRef = useRef<string | null>(null)
  const shown: Render | undefined = latest
    ? {
        ...latest,
        status: live?.status ?? latest.status,
        progress: live?.progress ?? latest.progress,
        outputAssetId: live?.outputAssetId ?? latest.outputAssetId,
        error: live?.error ?? latest.error,
      }
    : undefined

  useEffect(() => {
    if (shown?.status !== 'done') {
      setPreviewUrl(null)
      return
    }
    let active = true
    let url: string | null = null
    renderApi
      .previewUrl(shown.id)
      .then((created) => {
        if (!active) {
          if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(created)
          return
        }
        url = created
        setPreviewUrl(created)
      })
      .catch(() => undefined)
    return () => {
      active = false
      if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
    }
  }, [shown?.id, shown?.status])

  const startRender = () => {
    // Double-click safe: a synchronous in-flight guard drops the second
    // click, and rapid intents reuse one idempotency key so the server
    // dedupes even if two requests leave the client.
    if (submittingRef.current) return
    submittingRef.current = true
    setActionError('')
    const clientKey = (pendingKeyRef.current ??= crypto.randomUUID())
    create.mutate(clientKey, {
      onSettled: () => {
        submittingRef.current = false
        pendingKeyRef.current = null
      },
      onError: (reason) => setActionError(getApiError(reason, 'Could not start render')),
    })
  }

  return (
    <div className="render-stack" data-testid="scene-render-panel">
      <div className="right-head">
        <div>
          <p className="eyebrow">Output</p>
          <h2>Scene render</h2>
        </div>
        <button className="icon-button" aria-label="Refresh renders" onClick={() => refetch()}>
          <RefreshCw size={17} />
        </button>
      </div>
      <button
        type="button"
        className="button primary"
        disabled={create.isPending || Boolean(active)}
        onClick={startRender}
      >
        <Film size={15} /> {active ? `Rendering ${shown?.progress ?? 0}%…` : 'Render scene'}
      </button>
      {actionError && <p className="error-copy">{actionError}</p>}
      {create.isError && <p className="error-copy">{getApiError(create.error, 'Could not start render')}</p>}
      {shown ? (
        <div className="render-card" data-testid="scene-render-latest" data-status={shown.status}>
          <div className="render-top">
            <div className="render-status">
              <span className="pulse-dot" />
              {renderLabel(shown.status)}
            </div>
            <span>{shown.progress}%</span>
          </div>
          <div className="progress-track">
            <span style={{ width: `${shown.progress}%` }} />
          </div>
          <div className="render-meta">
            <span>
              {shown.status === 'done' && shown.completedAt
                ? new Date(shown.completedAt).toLocaleString()
                : new Date(shown.createdAt).toLocaleString()}
            </span>
            {(shown.status === 'queued' || shown.status === 'running') && (
              <button
                type="button"
                className="text-button"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(shown.id)}
              >
                <X size={13} /> Cancel
              </button>
            )}
            {shown.status === 'done' && (
              <button className="text-button" onClick={() => renderApi.download(shown.id)}>
                <Download size={13} /> Download
              </button>
            )}
          </div>
          {shown.status === 'done' && previewUrl && (
            <video
              className="render-preview"
              data-testid="scene-render-video"
              controls
              preload="metadata"
              src={previewUrl}
            />
          )}
          {shown.status === 'failed' && shown.error && (
            <p className="error-copy">Render failed: {shown.error}</p>
          )}
          {shown.status === 'cancelled' && (
            <p className="render-cancelled">Rendering cancelled</p>
          )}
        </div>
      ) : (
        <div className="empty-panel">
          <Film size={20} />
          <p>No scene renders yet</p>
          <span>Render this scene to an MP4.</span>
        </div>
      )}
      {renders.length > 1 && (
        <ul className="render-history" data-testid="scene-render-history">
          {renders.slice(1, 6).map((render) => (
            <li key={render.id} data-status={render.status}>
              <span>{renderLabel(render.status)}</span>
              <span>{render.progress}%</span>
              <span>{new Date(render.createdAt).toLocaleString()}</span>
              {render.status === 'done' && (
                <button className="text-button" onClick={() => renderApi.download(render.id)}>
                  <Download size={13} /> Download
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const renderLabel = (status: Render['status']): string => {
  switch (status) {
    case 'queued':
      return 'Queued…'
    case 'running':
      return 'Rendering…'
    case 'done':
      return 'Completed'
    case 'failed':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
  }
}
