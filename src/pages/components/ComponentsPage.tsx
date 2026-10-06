import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Filter, ChevronDown, MoreVertical, Edit, Trash2, Eye, Copy, Globe, Lock, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { componentsApi } from '../../services/components'
import type { Component } from '../../types/api'
import { useToast } from '../../hooks/useToast'

type FilterType = 'all' | 'mine' | 'public' | 'project'

interface ProjectSummary {
  id: string
  name: string
}

export function ComponentsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [components, setComponents] = useState<Component[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [showProjectFilter, setShowProjectFilter] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Load projects for project filter
  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.items || [])
      }
    } catch {
      // Ignore
    }
  }

  const fetchComponents = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (debouncedQuery) params.query = debouncedQuery
      if (filter !== 'all') params.filter = filter
      if (filter === 'project' && projectId) params.projectId = projectId

      const data = await componentsApi.search(params)
      setComponents(data)
    } catch (error) {
      showToast('Failed to load components', 'error')
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, filter, projectId, showToast])

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    fetchComponents()
  }, [fetchComponents])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete component "${name}"? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      await componentsApi.delete(id)
      showToast('Component deleted', 'success')
      fetchComponents()
    } catch (error) {
      showToast('Failed to delete component', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDuplicate = async (component: Component) => {
    try {
      const newComponent = {
        ...component,
        name: `${component.name}_copy`,
        displayName: `${component.displayName} (Copy)`,
        id: undefined,
        matchedField: undefined,
        userId: undefined,
        isPublic: false,
      }
      await componentsApi.create(newComponent)
      showToast('Component duplicated', 'success')
      fetchComponents()
    } catch (error) {
      showToast('Failed to duplicate component', 'error')
    }
  }

  const getFilterLabel = (f: FilterType) => {
    switch (f) {
      case 'mine': return 'My Components'
      case 'public': return 'Public Components'
      case 'project': return 'Project Components'
      default: return 'All Components'
    }
  }

  const getFilterIcon = (f: FilterType) => {
    switch (f) {
      case 'mine': return <Lock size={16} />
      case 'public': return <Globe size={16} />
      case 'project': return <CheckCircle size={16} />
      default: return <Filter size={16} />
    }
  }

  return (
    <div className="components-page">
      <header className="page-header">
        <div className="header-left">
          <h1>Components</h1>
          <p className="subtitle">Manage your custom components</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/components/new')}>
          <Plus size={18} /> New Component
        </button>
      </header>

      <div className="toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <button className="btn btn-secondary filter-trigger" onClick={() => setShowProjectFilter(filter === 'project')}>
            {getFilterIcon(filter)}
            <span>{getFilterLabel(filter)}</span>
            <ChevronDown size={14} />
          </button>

          <div className={`filter-dropdown ${showProjectFilter ? 'open' : ''}`}>
            <button className={`dropdown-item ${filter === 'all' ? 'active' : ''}`} onClick={() => { setFilter('all'); setShowProjectFilter(false); }}>
              <Filter size={16} /> All Components
            </button>
            <button className={`dropdown-item ${filter === 'mine' ? 'active' : ''}`} onClick={() => { setFilter('mine'); setShowProjectFilter(false); }}>
              <Lock size={16} /> My Components
            </button>
            <button className={`dropdown-item ${filter === 'public' ? 'active' : ''}`} onClick={() => { setFilter('public'); setShowProjectFilter(false); }}>
              <Globe size={16} /> Public Components
            </button>
            <button className={`dropdown-item ${filter === 'project' ? 'active' : ''}`} onClick={() => setShowProjectFilter(true)}>
              <CheckCircle size={16} /> Project Components
            </button>
          </div>

          {filter === 'project' && (
            <select
              className="project-select"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="" disabled>Select a project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <Loader2 className="spin" size={32} />
          <p>Loading components...</p>
        </div>
      ) : components.length === 0 ? (
        <div className="empty-state">
          <Filter size={64} />
          <h3>No components found</h3>
          <p>{searchQuery ? 'Try adjusting your search or filters' : 'Create your first component to get started'}</p>
          {!searchQuery && <button className="btn btn-primary" onClick={() => navigate('/components/new')}>Create Component</button>}
        </div>
      ) : (
        <div className="components-grid">
          {components.map(component => (
            <ComponentCard
              key={component.id}
              component={component}
              onEdit={() => navigate(`/components/${component.id}/edit`)}
              onView={() => navigate(`/components/${component.id}`)}
              onDuplicate={() => handleDuplicate(component)}
              onDelete={() => handleDelete(component.id, component.displayName)}
              deleting={deletingId === component.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ComponentCard({
  component,
  onEdit,
  onView,
  onDuplicate,
  onDelete,
  deleting,
}: {
  component: Component
  onEdit: () => void
  onView: () => void
  onDuplicate: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const isPublic = component.isPublic === true || component.isPublic === 'true'

  return (
    <article className="component-card">
      <div className="card-header">
        <div className="component-info">
          <h3>{component.displayName}</h3>
          <span className="component-name">{component.name}</span>
        </div>
        <div className="card-badges">
          {isPublic ? (
            <span className="badge badge-public"><Globe size={12} /> Public</span>
          ) : (
            <span className="badge badge-private"><Lock size={12} /> Private</span>
          )}
        </div>
      </div>

      <p className="component-description">{component.description}</p>

      <div className="component-meta">
        <div className="meta-item">
          <span className="meta-label">Props</span>
          <span className="meta-value">{Object.keys(component.propsSchema?.properties || {}).length}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Enter Styles</span>
          <span className="meta-value">{component.enterStyles?.length || 0}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Exit Styles</span>
          <span className="meta-value">{component.exitStyles?.length || 0}</span>
        </div>
      </div>

      <div className="card-actions">
        <button className="btn-icon" onClick={onView} title="View Details"><Eye size={16} /></button>
        <button className="btn-icon" onClick={onEdit} title="Edit"><Edit size={16} /></button>
        <button className="btn-icon" onClick={onDuplicate} title="Duplicate"><Copy size={16} /></button>
        <button className="btn-icon btn-danger" onClick={onDelete} title="Delete" disabled={deleting}>
          {deleting ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
        </button>
      </div>
    </article>
  )
}