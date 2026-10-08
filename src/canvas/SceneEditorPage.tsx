import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FlaskConical, MousePointer2, Plus } from 'lucide-react'
import { Navbar } from '../components/layout/Navbar'
import { ErrorAlert } from '../components/common/ErrorAlert'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { useDocumentStore } from '../store/documentStore'
import { useTimelineStore } from '../store/timelineStore'
import { scenesApi } from '../services/scenes'
import { componentsApi } from '../services/components'
import { getApiError } from '../services/api'
import type { Component, ComponentInstance, DocumentGroup } from '../types/api'
import { SceneCanvas } from './SceneCanvas'
import { ScenePreview } from './ScenePreview'
import { Timeline } from '../components/timeline/Timeline'
import { SceneRenderPanel } from '../components/render/SceneRenderPanel'
import { AiPanel } from '../components/ai/AiPanel'
import { Inspector } from './Inspector'
import { LayoutToolbar } from './LayoutToolbar'

// Route page: one interactive canvas per SceneDocument.
export function SceneEditorPage() {
  const { projectId, sceneId } = useParams()
  const navigate = useNavigate()
  const document = useDocumentStore((s) => s.document)
  const loading = useDocumentStore((s) => s.loading)
  const docError = useDocumentStore((s) => s.error)
  const loadDocument = useDocumentStore((s) => s.loadDocument)
  const setDocument = useDocumentStore((s) => s.setDocument)
  const selectInstance = useDocumentStore((s) => s.selectInstance)
  const selectedInstanceId = useDocumentStore((s) => s.selectedInstanceId)
  const upsertInstance = useDocumentStore((s) => s.upsertInstance)
  const upsertGroup = useDocumentStore((s) => s.upsertGroup)
  const currentFrame = useTimelineStore((s) => s.currentFrame)
  const resetTimeline = useTimelineStore((s) => s.reset)

  const [actionError, setActionError] = useState('')
  const [newSceneName, setNewSceneName] = useState('')
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  const scenesQuery = useQuery({
    queryKey: ['scenes', projectId],
    queryFn: () => scenesApi.list(projectId!),
    enabled: Boolean(projectId),
  })
  const definitionsQuery = useQuery({
    queryKey: ['components', 'all'],
    queryFn: () => componentsApi.search({ filter: 'all' }),
  })
  const definitions = useMemo(
    () => new Map((definitionsQuery.data ?? []).map((d) => [d.id, d])),
    [definitionsQuery.data],
  )

  useEffect(() => {
    setDocument(null)
    selectInstance(null)
    resetTimeline()
    if (sceneId) void loadDocument(sceneId)
  }, [sceneId, loadDocument, setDocument, selectInstance, resetTimeline])

  const selected = document?.components.find((c) => c.id === selectedInstanceId)

  const runAction = async (fn: () => Promise<void>) => {
    setActionError('')
    try {
      await fn()
    } catch (reason) {
      setActionError(getApiError(reason, 'Action failed'))
    }
  }

  const createScene = () =>
    runAction(async () => {
      const scene = await scenesApi.create(projectId!, {
        name: newSceneName.trim() || `Scene ${(scenesQuery.data?.length ?? 0) + 1}`,
      })
      setNewSceneName('')
      await scenesQuery.refetch()
      navigate(`/projects/${projectId}/scenes/${scene.id}`)
    })

  const addComponent = (definitionId: string) =>
    runAction(async () => {
      if (!sceneId) return
      const definition = definitions.get(definitionId)
      if (!definition) return
      const count = document?.components.length ?? 0
      const created = await scenesApi.createInstance(sceneId, {
        componentDefinitionId: definitionId,
        props: cannedPropsFor(definition),
        position: { x: 120 + (count % 8) * 36, y: 120 + (count % 8) * 28 },
        size: defaultSizeFor(definition.name),
      })
      upsertInstance(created)
    })

  const loadDemo = () =>
    runAction(async () => {
      if (!sceneId) return
      await seedEquationDemo(sceneId, definitions, upsertInstance, upsertGroup)
    })

  if (loading || scenesQuery.isLoading) {
    return (
      <div className="app">
        <Navbar onBack={() => navigate(`/projects/${projectId}`)} />
        <div className="loading-panel"><LoadingSpinner /></div>
      </div>
    )
  }

  return (
    <div className="app">
      <Navbar
        projectName={document ? `Canvas · ${document.name}` : 'Canvas'}
        onBack={() => navigate(`/projects/${projectId}`)}
      />
      <div className="scene-editor-bar">
        <button className="button secondary" onClick={() => navigate(`/projects/${projectId}`)}>
          <ArrowLeft size={15} /> Project
        </button>
        <label className="scene-switcher">
          Scene
          <select
            value={sceneId ?? ''}
            onChange={(e) => navigate(`/projects/${projectId}/scenes/${e.target.value}`)}
          >
            {(scenesQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <span className="scene-editor-newscene">
          <input
            value={newSceneName}
            onChange={(e) => setNewSceneName(e.target.value)}
            placeholder="New scene name"
            aria-label="New scene name"
          />
          <button className="button secondary" onClick={() => void createScene()}>
            <Plus size={15} /> Scene
          </button>
        </span>
        <span className="scene-editor-add">
          <select
            defaultValue=""
            onChange={(e) => { if (e.target.value) void addComponent(e.target.value); e.target.value = '' }}
            aria-label="Add component"
          >
            <option value="" disabled>Add component…</option>
            {(definitionsQuery.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.displayName} ({d.name})</option>
            ))}
          </select>
        </span>
        <button className="button secondary" onClick={() => void loadDemo()}>
          <FlaskConical size={15} /> Load F=ma demo
        </button>
        <span className="scene-editor-mode" role="group" aria-label="Editor mode">
          <button
            type="button"
            className={`button secondary${mode === 'edit' ? ' active' : ''}`}
            aria-pressed={mode === 'edit'}
            onClick={() => setMode('edit')}
          >
            Edit
          </button>
          <button
            type="button"
            className={`button secondary${mode === 'preview' ? ' active' : ''}`}
            aria-pressed={mode === 'preview'}
            onClick={() => setMode('preview')}
          >
            Preview
          </button>
        </span>
        <span className="scene-editor-selection">
          <MousePointer2 size={14} />
          {selected
            ? `${definitions.get(selected.componentDefinitionId)?.name ?? 'unknown'} · ${selected.position.x}, ${selected.position.y}`
            : 'Nothing selected'}
        </span>
      </div>
      {(docError || actionError || scenesQuery.error) && (
        <div className="scene-editor-error">
          <ErrorAlert message={docError || actionError || getApiError(scenesQuery.error, 'Could not load scenes')} />
        </div>
      )}
      {document ? (
        mode === 'preview' ? (
          <div className="scene-editor-main">
            <div className="scene-editor-canvas">
              <ScenePreview document={document} definitions={definitions} frame={currentFrame} />
              <Timeline document={document} definitions={definitions} />
              {sceneId && <SceneRenderPanel sceneId={sceneId} />}
            </div>
          </div>
        ) : (
          <div className="scene-editor-main">
            <div className="scene-editor-canvas">
              <LayoutToolbar document={document} />
              <SceneCanvas document={document} definitions={definitions} />
              <Timeline document={document} definitions={definitions} />
              {sceneId && <SceneRenderPanel sceneId={sceneId} />}
              {sceneId && <AiPanel sceneId={sceneId} onApplied={setDocument} />}
            </div>
            <Inspector document={document} definitions={definitions} />
          </div>
        )
      ) : (
        <div className="loading-panel"><p>No scene loaded.</p></div>
      )}
    </div>
  )
}

// Resolves /projects/:projectId/canvas → first scene (creating one if needed).
export function CanvasLanding() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    scenesApi
      .list(projectId!)
      .then(async (scenes) => {
        if (!active) return
        if (scenes.length > 0) navigate(`/projects/${projectId}/scenes/${scenes[0].id}`, { replace: true })
        else {
          const scene = await scenesApi.create(projectId!, { name: 'Scene 1' })
          if (active) navigate(`/projects/${projectId}/scenes/${scene.id}`, { replace: true })
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(getApiError(reason, 'Could not open canvas'))
      })
    return () => { active = false }
  }, [projectId, navigate])
  return (
    <div className="app">
      <Navbar onBack={() => navigate(`/projects/${projectId}`)} />
      <div className="loading-panel">{error ? <ErrorAlert message={error} /> : <LoadingSpinner />}</div>
    </div>
  )
}

// Minimal valid props per seeded definition (backend fills the rest from defaults).
const cannedPropsFor = (definition: Component): Record<string, unknown> => {
  switch (definition.name) {
    case 'Label': return { text: 'New text' }
    case 'Hub': return { label: 'Hub' }
    case 'CounterPill': return { from: 0, to: 100 }
    case 'LogoCard': return { label: 'Acme' }
    case 'Arrow': return { from: '', to: '' }
    default: return {}
  }
}

const defaultSizeFor = (definitionName: string): { width: number; height: number } => {
  switch (definitionName) {
    case 'Label': return { width: 220, height: 90 }
    case 'Hub': return { width: 160, height: 160 }
    case 'Arrow': return { width: 560, height: 120 }
    case 'CounterPill': return { width: 260, height: 110 }
    case 'LogoCard': return { width: 320, height: 180 }
    default: return { width: 240, height: 120 }
  }
}

// DoD demonstration: F = ma + arrow + Force, equation grouped, one scene.
async function seedEquationDemo(
  sceneId: string,
  definitions: Map<string, Component>,
  upsertInstance: (instance: ComponentInstance) => void,
  upsertGroup: (group: DocumentGroup) => void,
): Promise<void> {
  const byName = new Map([...definitions.values()].map((d) => [d.name, d]))
  const label = byName.get('Label')
  const arrow = byName.get('Arrow')
  if (!label) throw new Error('Label component definition is not available')
  const group = await scenesApi.createGroup(sceneId, { name: 'Equation' })
  upsertGroup(group)
  const texts: Array<{ text: string; x: number; w: number }> = [
    { text: 'F', x: 140, w: 120 },
    { text: '=', x: 300, w: 120 },
    { text: 'ma', x: 460, w: 200 },
  ]
  let fId = ''
  let maId = ''
  for (const [i, item] of texts.entries()) {
    const created = await scenesApi.createInstance(sceneId, {
      componentDefinitionId: label.id,
      groupId: group.id,
      props: { text: item.text },
      position: { x: item.x, y: 180 },
      size: { width: item.w, height: 90 },
      zIndex: i,
    })
    upsertInstance(created)
    if (item.text === 'F') fId = created.id
    if (item.text === 'ma') maId = created.id
  }
  if (arrow && fId && maId) {
    const created = await scenesApi.createInstance(sceneId, {
      componentDefinitionId: arrow.id,
      props: { from: fId, to: maId },
      position: { x: 140, y: 420 },
      size: { width: 560, height: 120 },
      zIndex: 3,
    })
    upsertInstance(created)
  } else if (arrow) {
    const created = await scenesApi.createInstance(sceneId, {
      componentDefinitionId: arrow.id,
      props: { from: '', to: '' },
      position: { x: 140, y: 420 },
      size: { width: 560, height: 120 },
      zIndex: 3,
    })
    upsertInstance(created)
  }
  const force = await scenesApi.createInstance(sceneId, {
    componentDefinitionId: label.id,
    props: { text: 'Force' },
    position: { x: 330, y: 340 },
    size: { width: 220, height: 90 },
    zIndex: 4,
  })
  upsertInstance(force)
}
