import { useEffect, useState } from 'react'
import { ArrowUpRight, CheckCircle, Code2, Copy, FileAudio, FileImage, FileVideo, Film, Frame, Share2, Trash2, WandSparkles, XCircle } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Navbar } from '../components/layout/Navbar'
import { AssetUploader } from '../components/assets/AssetUploader'
import { SpecEditor } from '../components/editor/SpecEditor'
import { RenderJobsList } from '../components/render/RenderJobsList'
import { ErrorAlert } from '../components/common/ErrorAlert'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { useAssetTranscripts, useAssets, useGeneration, useProject, useRenders } from '../hooks/useApi'
import { getApiError, parseApiError } from '../services/api'
import { apiClient } from '../services/api'
import { formatBytes, formatDuration } from '../utils/formatters'
import type { AssetKind, Project } from '../types/api'
import type { Asset } from '../types/api'
import { isVisualSpec } from '../types/spec'
import { assetsApi } from '../services/assets'
import { TranscriptImportDialog } from '../components/transcripts/TranscriptImportDialog'
import { TranscriptPromptDialog } from '../components/transcripts/TranscriptPromptDialog'
import { ManualSpecDialog } from '../components/transcripts/ManualSpecDialog'

export function EditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: project, isLoading, error, update, validate } = useProject(id)
  const assets = useAssets(id)
  const renders = useRenders(id)
  const generation = useGeneration(id)
  const [tab, setTab] = useState<'overview' | 'preview' | 'generate'>('overview')
  const [specEditor, setSpecEditor] = useState(false)
  const [message, setMessage] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [selectedTranscriptId, setSelectedTranscriptId] = useState('')
  const [promptAsset, setPromptAsset] = useState<Asset>()
  const [validationResult, setValidationResult] = useState<{ valid: boolean; issues: { path: string; code: string; message: string }[] } | null>(null)
  const [manualSpecDialog, setManualSpecDialog] = useState<{ open: boolean; transcriptId: string; instructions: string } | null>(null)

  if (isLoading) return <div className="app"><Navbar onBack={() => navigate('/')} /><div className="loading-panel"><LoadingSpinner /></div></div>
  if (!project) return <div className="app"><Navbar onBack={() => navigate('/')} /><main className="dashboard-page"><ErrorAlert message={getApiError(error, 'Project not found')} /></main></div>

  const notify = (value: string) => { setMessage(value); window.setTimeout(() => setMessage(''), 2800) }
  const upload = async (file: File, kind: AssetKind) => {
    setUploadError('')
    setUploadProgress(0)
    try {
      await assets.upload.mutateAsync({ file, kind, projectId: id!, onProgress: setUploadProgress })
      notify(`${file.name} uploaded`)
      return true
    } catch (reason) {
      setUploadError(getApiError(reason, 'Upload failed. Check the API server and try again.'))
      return false
    } finally {
      setUploadProgress(0)
    }
  }
  const saveSpec = async (spec: Record<string, unknown>) => { await update.mutateAsync({ spec }); notify('Spec saved') }
  const render = async () => { try { await renders.create.mutateAsync(); notify('Render queued') } catch (reason) { notify(getApiError(reason, 'Render could not be queued')) } }
  const handleValidate = () => {
    setValidationResult(null)
    validate.mutate(project.spec, {
      onSuccess: (result) => setValidationResult({ valid: result.valid, issues: result.issues }),
    })
  }

  return <div className="app">
    <Navbar projectName={project.name} onBack={() => navigate('/')} />
    <main className="editor-page">
      <aside className="asset-panel">
        <div className="panel-title"><div><p className="eyebrow">Project assets</p><h2>Media library</h2></div></div>
        <AssetUploader onUpload={upload} isUploading={assets.upload.isPending} progress={uploadProgress} />
        <ErrorAlert message={uploadError || (assets.upload.error ? getApiError(assets.upload.error, 'Upload failed') : '')} />
        <ErrorAlert message={assets.error ? getApiError(assets.error, 'Could not load assets') : ''} />
        <div className="asset-section-head"><span>Assets <b>{assets.data?.length ?? 0}</b></span></div>
        <div className="asset-list">{assets.data?.map((asset) => <AssetRow asset={asset} key={asset.id} projectId={id!} onTranscriptCreated={setSelectedTranscriptId} onUseTranscript={setSelectedTranscriptId} onPrompt={() => setPromptAsset(asset)} onDelete={async (assetId, projectId) => { await assets.remove.mutateAsync({ id: assetId, projectId }); setSelectedTranscriptId('') }} />)}</div>
      </aside>
      <section className="canvas-area">
        <div className="canvas-head"><div><div className="title-edit"><h1>{project.name}</h1></div><p>Last edited {new Date(project.updatedAt).toLocaleString()} · 16:9 · 1080p</p></div><div className="canvas-actions"><button className="button secondary" onClick={() => navigate(`/projects/${project.id}/canvas`)}><Frame size={16} />Open canvas</button><button className="button secondary" onClick={() => setSpecEditor(true)}><Code2 size={16} />Edit spec</button><button className="button primary" onClick={render} disabled={renders.create.isPending}><Film size={16} />Render video</button></div></div>
        <div className="tabs">{(['overview', 'preview', 'generate'] as const).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}{item === 'generate' && <span className="tab-new">NEW</span>}</button>)}</div>
        {tab === 'overview' && <Overview project={project} onGenerate={() => setTab('generate')} onValidate={handleValidate} validateMutation={validate} validationResult={validationResult} />}
        {tab === 'preview' && <Preview spec={project.spec} assets={assets.data ?? []} />}
        {tab === 'generate' && (
          <Generate
            projectId={project.id}
            generation={generation}
            transcriptId={selectedTranscriptId}
            onDone={saveSpec}
            onOpenManualSpec={(transcriptId, instructions) =>
              setManualSpecDialog({ open: true, transcriptId, instructions })
            }
          />
        )}
      </section>
      <aside className="right-panel"><RenderJobsList renders={renders.data} onRefresh={() => renders.refetch()} /><div className="right-divider" /><div className="budget"><div><span>Scene budget</span><strong>{sceneCount(project.spec)} <small>/ {project.maxComponents ?? '—'}</small></strong></div><p>{project.maxComponents ? `${Math.max(0, project.maxComponents - sceneCount(project.spec))} scenes remaining` : 'Set a budget in project settings'}</p></div></aside>
    </main>
    {specEditor && <SpecEditor project={project} onClose={() => setSpecEditor(false)} onSave={saveSpec} updateMutation={update} />}
    {promptAsset && <TranscriptPromptDialog asset={promptAsset} onClose={() => setPromptAsset(undefined)} />}
    {manualSpecDialog && (
      <ManualSpecDialog
        projectId={project.id}
        transcriptId={manualSpecDialog.transcriptId}
        instructions={manualSpecDialog.instructions}
        onClose={() => setManualSpecDialog(null)}
        onSuccess={saveSpec}
      />
    )}
    {message && <div className="toast">{message}</div>}
  </div>
}

function AssetRow({ asset, projectId, onTranscriptCreated, onUseTranscript, onPrompt, onDelete }: { asset: Asset; projectId: string; onTranscriptCreated: (id: string) => void; onUseTranscript: (id: string) => void; onPrompt: () => void; onDelete: (id: string, projectId: string) => Promise<unknown> }) {
  const [shareUrl, setShareUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const canTranscribe = asset.kind === 'audio' || asset.kind === 'video'
  const transcripts = useAssetTranscripts(asset.id, projectId, canTranscribe)
  const latestTranscript = transcripts.data?.[0]
  const transcribe = async () => {
    setError('')
    try {
      const result = await transcripts.transcribe.mutateAsync({ projectId })
      onTranscriptCreated(result.id)
    } catch (reason) {
      setError(getApiError(reason, 'Transcription failed. Check the API and Gemini configuration.'))
    }
  }
  const share = async () => { const result = await assetsApi.shareUrl(asset.id); setShareUrl(result.url); try { await navigator.clipboard?.writeText(result.url) } catch { /* The URL remains visible for manual copying. */ } }
  const remove = async () => { if (deleting) return; setError(''); setDeleting(true); try { await onDelete(asset.id, projectId) } catch (reason) { setError(getApiError(reason, 'Asset could not be deleted.')) } finally { setDeleting(false) } }
  const createShare = async () => { setError(''); try { await share() } catch (reason) { setError(getApiError(reason, 'Share URL could not be created.')) } }
  const copyShare = async () => { try { await navigator.clipboard?.writeText(shareUrl) } catch { setError('Copy is unavailable; select the share URL manually.') } }
  return <div className="asset-row-wrap">{(error || transcripts.error) && <ErrorAlert message={error || getApiError(transcripts.error, 'Could not load transcripts')} />}<div className="asset-row">
    <div className="asset-thumb">{asset.kind === 'audio' ? <FileAudio size={17} /> : asset.kind === 'video' ? <FileVideo size={17} /> : <FileImage size={17} />}</div>
    <div className="asset-copy"><strong>{asset.originalName}</strong><span>{formatBytes(asset.sizeBytes)} · {formatDuration(asset.durationSeconds)}</span>{latestTranscript && <span className="transcript-status">Transcript ready</span>}</div>
    <div className="asset-actions">
      {canTranscribe && <button className="text-button" disabled={transcripts.transcribe.isPending} onClick={() => { void (latestTranscript ? Promise.resolve(onUseTranscript(latestTranscript.id)) : transcribe()) }}>{latestTranscript ? 'Use transcript' : transcripts.transcribe.isPending ? 'Transcribing…' : 'Transcribe'}</button>}
      {canTranscribe && <button className="icon-button" aria-label="Copy external AI transcription prompt" title="Copy external AI transcription prompt" onClick={onPrompt}><Copy size={14} /></button>}
      {canTranscribe && <button className="icon-button" aria-label="Import transcript JSON" onClick={() => setImporting(true)}><FileImage size={14} /></button>}
      <button className="icon-button" aria-label="Create share URL" onClick={() => void createShare()}><Share2 size={14} /></button>
      <button className="icon-button" aria-label={`Delete ${asset.originalName}`} disabled={deleting} onClick={() => void remove()}><Trash2 size={15} /></button>
    </div>
  </div>{shareUrl && <div className="asset-share-url"><input value={shareUrl} readOnly aria-label="Share URL" /><button className="icon-button" aria-label="Copy share URL" onClick={() => void copyShare()}><Copy size={13} /></button></div>}{importing && <TranscriptImportDialog assetId={asset.id} projectId={projectId} onClose={() => setImporting(false)} onImported={(id) => { onTranscriptCreated(id); void transcripts.refetch().catch((reason) => setError(getApiError(reason, 'Transcript imported, but the asset list could not refresh.'))) }} />}</div>
}

const sceneCount = (spec: Record<string, unknown>) => isVisualSpec(spec) ? spec.scenes.length : 0
function Overview({ project, onGenerate, onValidate, validateMutation, validationResult }: { project: Project; onGenerate: () => void; onValidate: () => void; validateMutation: ReturnType<typeof import('../hooks/useApi').useProject>['validate']; validationResult: { valid: boolean; issues: { path: string; code: string; message: string }[] } | null }) {
  const visualSpec = isVisualSpec(project.spec) ? project.spec : undefined
  const isValidating = validateMutation.isPending
  return <div className="overview-content">
    <div className="hero-banner"><div><span className="banner-kicker"><WandSparkles size={14} /> AI-ready workspace</span><h2>Your story is taking shape.</h2><p>Generate a visual spec from your voiceover, then refine every frame with precision.</p><button className="button dark-button" onClick={onGenerate}>Generate a spec <ArrowUpRight size={15} /></button></div></div>
    <div className="overview-grid">
      <div className="overview-block">
        <span className="block-label">Current status</span>
        <div className="large-status"><span className={`status-dot ${visualSpec ? 'ready' : 'draft'}`} />{visualSpec ? 'Spec ready' : 'Draft'}</div>
        <button className="text-button" onClick={onValidate} disabled={isValidating}>{isValidating ? 'Validating…' : 'Validate spec <ArrowUpRight size={14} />'}</button>
      </div>
      <div className="overview-block">
        <span className="block-label">Project settings</span>
        <div className="timeline-value">{sceneCount(project.spec)} <small>scenes</small></div>
        <p>{project.maxComponents ? `${project.maxComponents} scene budget` : 'No scene budget set'}</p>
      </div>
      <div className="overview-block">
        <span className="block-label">Video settings</span>
        <div className="large-status">{visualSpec ? `${visualSpec.meta.width}×${visualSpec.meta.height}` : 'Not set'}</div>
        <p>{visualSpec ? `${visualSpec.meta.fps} fps · ${formatDuration(visualSpec.meta.durationInSeconds)}` : 'Create a valid visual specification'}</p>
      </div>
    </div>
    {validationResult && (
      <div className="validation-result">
        <div className={`validation-status ${validationResult.valid ? 'valid' : 'invalid'}`}>
          {validationResult.valid ? <CheckCircle size={20} /> : <XCircle size={20} />}
          <span>{validationResult.valid ? 'Spec is valid' : 'Spec has validation issues'}</span>
        </div>
        {!validationResult.valid && validationResult.issues.length > 0 && (
          <div className="validation-issues">
            <h4>Issues ({validationResult.issues.length})</h4>
            <ul>
              {validationResult.issues.map((issue, idx) => (
                <li key={idx} className="validation-issue">
                  <span className="issue-code">{issue.code}</span>
                  <span className="issue-path">{issue.path}</span>
                  <span className="issue-message">{issue.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )}
  </div>
}
function useAssetSources(assets: Asset[]) { const [sources, setSources] = useState<Record<string, string>>({}); useEffect(() => { let active = true; const urls: string[] = []; void Promise.all(assets.filter((asset) => asset.kind === 'image' || asset.kind === 'logo' || asset.kind === 'side_video').map(async (asset) => { const response = await apiClient.get<Blob>(`/assets/${asset.id}/file`, { responseType: 'blob' }); const url = URL.createObjectURL(response.data); urls.push(url); return [asset.id, url] as const; })).then((entries) => { if (active) setSources(Object.fromEntries(entries)) }).catch(() => undefined); return () => { active = false; urls.forEach((url) => URL.revokeObjectURL(url)) } }, [assets]); return sources }
function Preview({ spec, assets }: { spec: Record<string, unknown>; assets: Asset[] }) { const visualSpec = isVisualSpec(spec) ? spec : undefined; const sources = useAssetSources(assets); const [time, setTime] = useState(0); const [playing, setPlaying] = useState(true); useEffect(() => { if (!playing || !visualSpec) return; const timer = window.setInterval(() => setTime((current) => (current + 0.1) % visualSpec.meta.durationInSeconds), 100); return () => window.clearInterval(timer) }, [playing, visualSpec]); if (!visualSpec) return <div className="preview-content"><p className="preview-empty">No valid backend video specification yet.</p></div>; const background = visualSpec.theme.background; const backgroundImage = background.type === 'image' ? sources[background.assetId] : undefined; const backgroundStyle = background.type === 'color' ? { background: background.color } : background.type === 'gradient' ? { background: `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})` } : { backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined, backgroundSize: background.fit, backgroundColor: '#172235' }; const activeScenes = visualSpec.scenes.filter((scene) => time >= scene.at && time < scene.at + scene.duration); return <div className="preview-content"><div className="preview-frame"><div className="preview-surface spec-preview-surface" style={backgroundStyle}>{activeScenes.map((scene) => { const props = scene.props as Record<string, unknown>; const assetId = typeof props.assetId === 'string' ? props.assetId : typeof props.imageAssetId === 'string' ? props.imageAssetId : undefined; const text = typeof props.text === 'string' ? props.text : typeof props.title === 'string' ? props.title : typeof props.content === 'string' ? props.content : scene.component; return <div className="preview-scene" key={scene.id} style={{ transform: `translate(${scene.position.offsetX}%, ${scene.position.offsetY}%)`, color: scene.color ?? undefined }}>{assetId && sources[assetId] ? <img src={sources[assetId]} alt="" /> : <strong>{text}</strong>}<small>{scene.component}</small></div> })}{visualSpec.sideVideo && sources[visualSpec.sideVideo.assetId] && <video className="preview-side-video" src={sources[visualSpec.sideVideo.assetId]} autoPlay muted loop playsInline />}</div></div><div className="preview-controls"><button className="button secondary" onClick={() => setPlaying((value) => !value)}>{playing ? 'Pause' : 'Play'}</button><input type="range" min="0" max={visualSpec.meta.durationInSeconds} step="0.1" value={time} onChange={(event) => { setPlaying(false); setTime(Number(event.target.value)) }} aria-label="Preview timeline" /></div><p className="preview-empty">{visualSpec.scenes.length} scenes · {visualSpec.meta.width}×{visualSpec.meta.height} · {formatDuration(visualSpec.meta.durationInSeconds)}</p></div> }
function Generate({
  projectId,
  generation,
  transcriptId,
  onDone,
  onOpenManualSpec,
}: {
  projectId: string
  generation: ReturnType<typeof useGeneration>
  transcriptId: string
  onDone: (spec: Record<string, unknown>) => Promise<void>
  onOpenManualSpec: (transcriptId: string, instructions: string) => void
}) {
  const [instructions, setInstructions] = useState('')
  const [error, setError] = useState('')
  const [generationIssues, setGenerationIssues] = useState<{ path: string; code: string; message: string }[] | null>(null)
  const generate = async () => {
    setError('')
    setGenerationIssues(null)
    try {
      const result = await generation.generate.mutateAsync({ transcriptId, instructions, save: false, provider: 'gemini' })
      if (result.issues && result.issues.length > 0) {
        setGenerationIssues(result.issues)
      }
      await onDone(result.spec)
    } catch (reason) {
      setError(getApiError(reason, 'Generation failed. Check the API and Gemini configuration.'))
    }
  }
  return <div className="generate-content">
    {error && <ErrorAlert message={error} />}
    {generationIssues && generationIssues.length > 0 && (
      <div className="generation-warnings">
        <h4>Generation completed with warnings</h4>
        <ul>
          {generationIssues.map((issue, idx) => (
            <li key={idx} className="generation-issue">
              <span className="issue-code">{issue.code}</span>
              <span className="issue-path">{issue.path}</span>
              <span className="issue-message">{issue.message}</span>
            </li>
          ))}
        </ul>
      </div>
    )}
    <div className="generate-header">
      <div>
        <span className="eyebrow">Create with Gemini</span>
        <h2>Make the first cut.</h2>
        <p>Choose an audio or video asset, transcribe it, then use its transcript here.</p>
      </div>
      <div className="generate-orb"><WandSparkles size={28} /></div>
    </div>
    <label className="field-label">Transcript{transcriptId ? <input value={transcriptId} readOnly /> : <span className="transcript-empty">No transcript selected. Transcribe an audio or video asset in the media library first.</span>}</label>
    <label className="field-label">Creative direction<textarea className="prompt-input" value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Keep the opening minimal and editorial..." /></label>
    <div className="generate-footer">
      <span>Gemini generation via /projects/{projectId}/generate</span>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button className="button primary" disabled={!transcriptId || generation.generate.isPending} onClick={() => void generate()}>
          <WandSparkles size={16} />Generate visual spec
        </button>
        <button
          className="button secondary"
          disabled={!transcriptId}
          onClick={() => onOpenManualSpec(transcriptId, instructions)}
        >
          Manual spec (external AI)
        </button>
      </div>
    </div>
  </div>
}
