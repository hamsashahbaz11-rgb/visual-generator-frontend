import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Copy, Globe, Lock, Loader2, FileText, CheckCircle } from 'lucide-react'
import { componentsApi } from '../../services/components'
import type { Component } from '../../types/api'
import { useToast } from '../../hooks/useToast'

export function ComponentDetailPage() {
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const { showToast } = useToast()
  const [component, setComponent] = useState<Component | null>(null)
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    if (params.id) {
      loadComponent(params.id)
    }
  }, [params.id])

  const loadComponent = async (id: string) => {
    try {
      const data = await componentsApi.get(id)
      setComponent(data)
    } catch (error) {
      showToast('Failed to load component', 'error')
      navigate('/components')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyJson = async () => {
    if (!component) return
    setCopying(true)
    try {
      const json = JSON.stringify({
        name: component.name,
        displayName: component.displayName,
        description: component.description,
        propsSchema: component.propsSchema,
        defaultProps: component.defaultProps,
        enterStyles: component.enterStyles,
        exitStyles: component.exitStyles,
        colorProps: component.colorProps,
        refProps: component.refProps,
        assetProps: component.assetProps,
        isPublic: component.isPublic,
      }, null, 2)
      await navigator.clipboard.writeText(json)
      showToast('JSON copied to clipboard', 'success')
    } catch {
      showToast('Failed to copy', 'error')
    } finally {
      setCopying(false)
    }
  }

  const handleEdit = () => {
    if (component) navigate(`/components/${component.id}/edit`)
  }

  if (loading) {
    return (
      <div className="detail-page loading">
        <Loader2 className="spin" size={32} />
        <p>Loading component...</p>
      </div>
    )
  }

  if (!component) {
    return (
      <div className="detail-page error">
        <p>Component not found</p>
        <button className="btn btn-primary" onClick={() => navigate('/components')}>
          Back to Components
        </button>
      </div>
    )
  }

  const isPublic = component.isPublic === true || component.isPublic === 'true'

  return (
    <div className="detail-page">
      <header className="detail-header">
        <button className="btn btn-ghost" onClick={() => navigate('/components')}>
          <ArrowLeft size={18} /> Back to Components
        </button>
        <div className="header-info">
          <div className="header-badges">
            {isPublic ? (
              <span className="badge badge-public"><Globe size={14} /> Public</span>
            ) : (
              <span className="badge badge-private"><Lock size={14} /> Private</span>
            )}
          </div>
          <h1>{component.displayName}</h1>
          <span className="component-name">{component.name}</span>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleCopyJson} disabled={copying}>
            {copying ? <Loader2 className="spin" size={18} /> : <FileText size={18} />}
            {copying ? 'Copied!' : 'Copy JSON'}
          </button>
          <button className="btn btn-primary" onClick={handleEdit}>
            <Edit size={18} /> Edit Component
          </button>
        </div>
      </header>

      <div className="detail-content">
        <section className="detail-section">
          <h2>Description</h2>
          <p>{component.description}</p>
        </section>

        <section className="detail-section">
          <h2>Props Schema</h2>
          <pre className="json-preview"><code>{JSON.stringify(component.propsSchema, null, 2)}</code></pre>
        </section>

        <section className="detail-section">
          <h2>Default Props</h2>
          <pre className="json-preview"><code>{JSON.stringify(component.defaultProps, null, 2)}</code></pre>
        </section>

        <div className="detail-grid">
          <section className="detail-section">
            <h2>Enter Styles</h2>
            <div className="tag-list">
              {component.enterStyles.map(style => (
                <span key={style} className="tag">{style}</span>
              ))}
              {component.enterStyles.length === 0 && <span className="empty">None</span>}
            </div>
          </section>

          <section className="detail-section">
            <h2>Exit Styles</h2>
            <div className="tag-list">
              {component.exitStyles.map(style => (
                <span key={style} className="tag">{style}</span>
              ))}
              {component.exitStyles.length === 0 && <span className="empty">None</span>}
            </div>
          </section>

          <section className="detail-section">
            <h2>Color Props</h2>
            <div className="tag-list">
              {component.colorProps.map(prop => (
                <span key={prop} className="tag tag-color">{prop}</span>
              ))}
              {component.colorProps.length === 0 && <span className="empty">None</span>}
            </div>
          </section>

          <section className="detail-section">
            <h2>Reference Props</h2>
            <div className="tag-list">
              {component.refProps.map(prop => (
                <span key={prop} className="tag tag-ref">{prop}</span>
              ))}
              {component.refProps.length === 0 && <span className="empty">None</span>}
            </div>
          </section>

          <section className="detail-section">
            <h2>Asset Props</h2>
            <div className="tag-list">
              {component.assetProps.map(prop => (
                <span key={prop} className="tag tag-asset">{prop}</span>
              ))}
              {component.assetProps.length === 0 && <span className="empty">None</span>}
            </div>
          </section>
        </div>

        <section className="detail-section meta-section">
          <h2>Metadata</h2>
          <dl className="meta-list">
            <div><dt>ID</dt><dd>{component.id}</dd></div>
            <div><dt>Created</dt><dd>{new Date(component.createdAt).toLocaleString()}</dd></div>
            <div><dt>Updated</dt><dd>{new Date(component.updatedAt).toLocaleString()}</dd></div>
            <div><dt>Visibility</dt><dd>{isPublic ? 'Public' : 'Private'}</dd></div>
            {component.userId && <div><dt>Owner</dt><dd>{component.userId}</dd></div>}
          </dl>
        </section>
      </div>
    </div>
  )
}