import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, AlertTriangle, CheckCircle, XCircle, Clipboard, FileText, Eye, Globe, Lock, ChevronDown } from 'lucide-react'
import { componentsApi } from '../../services/components'
import type { Component } from '../../types/api'
import { useToast } from '../../hooks/useToast'

interface FormData {
  name: string
  displayName: string
  description: string
  propsSchema: Record<string, unknown>
  defaultProps: Record<string, unknown>
  enterStyles: string[]
  exitStyles: string[]
  colorProps: string[]
  refProps: string[]
  assetProps: string[]
  isPublic: boolean
}

const initialFormData: FormData = {
  name: '',
  displayName: '',
  description: '',
  propsSchema: { type: 'object', properties: {}, required: [] },
  defaultProps: {},
  enterStyles: ['fade'],
  exitStyles: ['fade'],
  colorProps: [],
  refProps: [],
  assetProps: [],
  isPublic: false,
}

const commonEnterStyles = ['fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom', 'rotate', 'flip', 'typewriter', 'draw']
const commonExitStyles = ['fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom', 'rotate', 'flip']

export function ComponentFormPage() {
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const { showToast } = useToast()
  const isEditing = !!params.id
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showJsonPaste, setShowJsonPaste] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [jsonErrors, setJsonErrors] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'form' | 'json'>('form')
  const [propsSchemaJson, setPropsSchemaJson] = useState(JSON.stringify(initialFormData.propsSchema, null, 2))
  const [defaultPropsJson, setDefaultPropsJson] = useState(JSON.stringify(initialFormData.defaultProps, null, 2))

  // Load component if editing
  useEffect(() => {
    if (isEditing && params.id) {
      loadComponent(params.id)
    }
  }, [params.id])

  const loadComponent = async (id: string) => {
    try {
      const component = await componentsApi.get(id)
      const data: FormData = {
        name: component.name,
        displayName: component.displayName,
        description: component.description,
        propsSchema: component.propsSchema,
        defaultProps: component.defaultProps,
        enterStyles: component.enterStyles || [],
        exitStyles: component.exitStyles || [],
        colorProps: component.colorProps || [],
        refProps: component.refProps || [],
        assetProps: component.assetProps || [],
        isPublic: component.isPublic === true || component.isPublic === 'true',
      }
      setFormData(data)
      setPropsSchemaJson(JSON.stringify(data.propsSchema, null, 2))
      setDefaultPropsJson(JSON.stringify(data.defaultProps, null, 2))
    } catch (error) {
      showToast('Failed to load component', 'error')
      navigate('/components')
    } finally {
      setLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    else if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(formData.name)) newErrors.name = 'Name must start with a letter and contain only letters, numbers, underscores, and hyphens'
    if (!formData.displayName.trim()) newErrors.displayName = 'Display name is required'
    if (!formData.description.trim()) newErrors.description = 'Description is required'
    if (formData.enterStyles.length === 0) newErrors.enterStyles = 'At least one enter style is required'

    // Validate propsSchema JSON
    try {
      const schema = JSON.parse(propsSchemaJson)
      if (typeof schema !== 'object' || schema === null) {
        newErrors.propsSchema = 'Props schema must be a valid JSON object'
      } else if (schema.type !== 'object') {
        newErrors.propsSchema = 'Props schema must have type "object"'
      }
    } catch {
      newErrors.propsSchema = 'Props schema must be valid JSON'
    }

    // Validate defaultProps JSON
    try {
      JSON.parse(defaultPropsJson)
    } catch {
      newErrors.defaultProps = 'Default props must be valid JSON'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setSaving(true)
    try {
      const payload = {
        ...formData,
        propsSchema: JSON.parse(propsSchemaJson),
        defaultProps: JSON.parse(defaultPropsJson),
      }

      if (isEditing && params.id) {
        await componentsApi.update(params.id, payload)
        showToast('Component updated', 'success')
      } else {
        await componentsApi.create(payload)
        showToast('Component created', 'success')
      }
      navigate('/components')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save component'
      if (message.includes('NAME_TAKEN')) {
        setErrors({ name: 'Component name already exists' })
      } else if (message.includes('INVALID_PROPS_SCHEMA')) {
        setErrors({ propsSchema: 'Invalid props schema - must be a valid JSON Schema' })
      } else if (message.includes('INVALID_DEFAULT_PROPS')) {
        setErrors({ defaultProps: 'Default props do not match the schema' })
      } else {
        showToast(message, 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleJsonPaste = () => {
    const result = componentsApi.validateJson(jsonInput)
    if (result.valid && result.component) {
      const component = result.component
      setFormData({
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
        isPublic: component.isPublic === true || component.isPublic === 'true',
      })
      setPropsSchemaJson(JSON.stringify(component.propsSchema, null, 2))
      setDefaultPropsJson(JSON.stringify(component.defaultProps, null, 2))
      setJsonErrors([])
      setShowJsonPaste(false)
      setJsonInput('')
      setActiveTab('form')
      showToast('Component loaded from JSON', 'success')
    } else {
      setJsonErrors(result.errors || ['Invalid JSON'])
    }
  }

  const handleExportJson = () => {
    const json = JSON.stringify({
      name: formData.name,
      displayName: formData.displayName,
      description: formData.description,
      propsSchema: JSON.parse(propsSchemaJson),
      defaultProps: JSON.parse(defaultPropsJson),
      enterStyles: formData.enterStyles,
      exitStyles: formData.exitStyles,
      colorProps: formData.colorProps,
      refProps: formData.refProps,
      assetProps: formData.assetProps,
      isPublic: formData.isPublic,
    }, null, 2)
    navigator.clipboard.writeText(json)
    showToast('JSON copied to clipboard', 'success')
  }

  if (loading) {
    return (
      <div className="form-page loading">
        <Loader2 className="spin" size={32} />
        <p>Loading component...</p>
      </div>
    )
  }

  return (
    <div className="form-page">
      <header className="form-header">
        <button className="btn btn-ghost" onClick={() => navigate('/components')}>
          <ArrowLeft size={18} /> Back to Components
        </button>
        <div className="header-title">
          <h1>{isEditing ? 'Edit Component' : 'New Component'}</h1>
          <p>{isEditing ? 'Modify your component definition' : 'Create a new custom component'}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleExportJson} disabled={!formData.name}>
            <FileText size={18} /> Export JSON
          </button>
          <button className="btn btn-primary" onClick={() => { setShowJsonPaste(true); setActiveTab('json'); }}>
            <Clipboard size={18} /> Paste JSON
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
            {saving ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
          </button>
        </div>
      </header>

      {showJsonPaste && (
        <div className="json-paste-modal">
          <div className="modal-content">
            <h2>Paste Component JSON</h2>
            <p className="modal-description">Paste a complete component JSON object. It will be validated for required fields and valid syntax.</p>
            <textarea
              className="json-textarea"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{"name": "my_component", "displayName": "My Component", "description": "...", "propsSchema": {...}, "defaultProps": {}, "enterStyles": ["fade"], "exitStyles": ["fade"], "colorProps": [], "refProps": [], "assetProps": [], "isPublic": false}'
              rows={15}
            />
            {jsonErrors.length > 0 && (
              <div className="json-errors">
                {jsonErrors.map((err, i) => (
                  <div key={i} className="error-item">
                    <XCircle size={16} /> {err}
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowJsonPaste(false); setJsonInput(''); setJsonErrors([]); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleJsonPaste}>
                <CheckCircle size={16} /> Validate & Import
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="component-form">
        <div className="form-tabs">
          <button
            type="button"
            className={`tab ${activeTab === 'form' ? 'active' : ''}`}
            onClick={() => setActiveTab('form')}
          >
            <FileText size={16} /> Form Editor
          </button>
          <button
            type="button"
            className={`tab ${activeTab === 'json' ? 'active' : ''}`}
            onClick={() => setActiveTab('json')}
          >
            <Clipboard size={16} /> JSON Editor
          </button>
        </div>

        {activeTab === 'form' && (
          <div className="form-content">
            <section className="form-section">
              <h2>Basic Information</h2>
              <div className="field">
                <label htmlFor="name">Name <span className="required">*</span></label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="my_component"
                  disabled={isEditing}
                />
                {errors.name && <span className="error">{errors.name}</span>}
                <span className="hint">Unique identifier, used in specs. Letters, numbers, underscores, hyphens only.</span>
              </div>
              <div className="field">
                <label htmlFor="displayName">Display Name <span className="required">*</span></label>
                <input
                  id="displayName"
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="My Component"
                />
                {errors.displayName && <span className="error">{errors.displayName}</span>}
              </div>
              <div className="field">
                <label htmlFor="description">Description <span className="required">*</span></label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description of what this component does..."
                  rows={3}
                />
                {errors.description && <span className="error">{errors.description}</span>}
              </div>
              <div className="field">
                <label>Visibility</label>
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={!formData.isPublic}
                      onChange={() => setFormData({ ...formData, isPublic: false })}
                    />
                    <span>
                      <Lock size={16} />
                      <strong>Private</strong>
                      <span>Only you can use this component</span>
                    </span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={formData.isPublic}
                      onChange={() => setFormData({ ...formData, isPublic: true })}
                    />
                    <span>
                      <Globe size={16} />
                      <strong>Public</strong>
                      <span>Anyone can use this component</span>
                    </span>
                  </label>
                </div>
              </div>
            </section>

            <section className="form-section">
              <h2>Props Schema (JSON Schema)</h2>
              <p className="section-hint">Define the properties your component accepts. Uses JSON Schema Draft 7.</p>
              <div className="field">
                <textarea
                  className="json-field"
                  value={propsSchemaJson}
                  onChange={(e) => setPropsSchemaJson(e.target.value)}
                  placeholder='{ "type": "object", "properties": { "title": { "type": "string" }, "count": { "type": "number" } }, "required": ["title"] }'
                  rows={10}
                  spellCheck={false}
                />
                {errors.propsSchema && <span className="error">{errors.propsSchema}</span>}
              </div>
            </section>

            <section className="form-section">
              <h2>Default Props</h2>
              <p className="section-hint">Default values for props. Must be valid against the props schema above.</p>
              <div className="field">
                <textarea
                  className="json-field"
                  value={defaultPropsJson}
                  onChange={(e) => setDefaultPropsJson(e.target.value)}
                  placeholder='{ "title": "Default Title", "count": 5 }'
                  rows={6}
                  spellCheck={false}
                />
                {errors.defaultProps && <span className="error">{errors.defaultProps}</span>}
              </div>
            </section>

            <section className="form-section">
              <h2>Animation Styles</h2>
              <div className="field-group">
                <div className="field">
                  <label>Enter Styles <span className="required">*</span></label>
                  <StyleMultiSelect
                    value={formData.enterStyles}
                    onChange={(styles) => setFormData({ ...formData, enterStyles: styles })}
                    options={commonEnterStyles}
                    placeholder="Select enter styles..."
                  />
                  {errors.enterStyles && <span className="error">{errors.enterStyles}</span>}
                </div>
                <div className="field">
                  <label>Exit Styles</label>
                  <StyleMultiSelect
                    value={formData.exitStyles}
                    onChange={(styles) => setFormData({ ...formData, exitStyles: styles })}
                    options={commonExitStyles}
                    placeholder="Select exit styles..."
                  />
                </div>
              </div>
            </section>

            <section className="form-section">
              <h2>Special Prop Types</h2>
              <p className="section-hint">Mark specific props as color, reference, or asset props for editor integration.</p>
              <div className="field-group">
                <div className="field">
                  <label>Color Props</label>
                  <PropMultiSelect
                    value={formData.colorProps}
                    onChange={(props) => setFormData({ ...formData, colorProps: props })}
                    schema={JSON.parse(propsSchemaJson)}
                    placeholder="Select color props..."
                  />
                </div>
                <div className="field">
                  <label>Reference Props</label>
                  <PropMultiSelect
                    value={formData.refProps}
                    onChange={(props) => setFormData({ ...formData, refProps: props })}
                    schema={JSON.parse(propsSchemaJson)}
                    placeholder="Select reference props..."
                  />
                </div>
                <div className="field">
                  <label>Asset Props</label>
                  <PropMultiSelect
                    value={formData.assetProps}
                    onChange={(props) => setFormData({ ...formData, assetProps: props })}
                    schema={JSON.parse(propsSchemaJson)}
                    placeholder="Select asset props..."
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'json' && (
          <div className="form-content">
            <section className="form-section">
              <h2>Full Component JSON</h2>
              <p className="section-hint">Edit the complete component as JSON. Switch back to Form Editor to validate.</p>
              <div className="field">
                <textarea
                  className="json-field"
                  value={JSON.stringify({
                    name: formData.name,
                    displayName: formData.displayName,
                    description: formData.description,
                    propsSchema: JSON.parse(propsSchemaJson),
                    defaultProps: JSON.parse(defaultPropsJson),
                    enterStyles: formData.enterStyles,
                    exitStyles: formData.exitStyles,
                    colorProps: formData.colorProps,
                    refProps: formData.refProps,
                    assetProps: formData.assetProps,
                    isPublic: formData.isPublic,
                  }, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value)
                      if (parsed.name) setFormData({ ...formData, name: parsed.name })
                      if (parsed.displayName) setFormData({ ...formData, displayName: parsed.displayName })
                      if (parsed.description) setFormData({ ...formData, description: parsed.description })
                      if (parsed.propsSchema) setPropsSchemaJson(JSON.stringify(parsed.propsSchema, null, 2))
                      if (parsed.defaultProps) setDefaultPropsJson(JSON.stringify(parsed.defaultProps, null, 2))
                      if (parsed.enterStyles) setFormData({ ...formData, enterStyles: parsed.enterStyles })
                      if (parsed.exitStyles) setFormData({ ...formData, exitStyles: parsed.exitStyles })
                      if (parsed.colorProps) setFormData({ ...formData, colorProps: parsed.colorProps })
                      if (parsed.refProps) setFormData({ ...formData, refProps: parsed.refProps })
                      if (parsed.assetProps) setFormData({ ...formData, assetProps: parsed.assetProps })
                      if (typeof parsed.isPublic === 'boolean') setFormData({ ...formData, isPublic: parsed.isPublic })
                    } catch {
                      // Ignore invalid JSON while typing
                    }
                  }}
                  rows={25}
                  spellCheck={false}
                />
              </div>
            </section>
          </div>
        )}
      </form>
    </div>
  )
}

function StyleMultiSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string[]
  onChange: (value: string[]) => void
  options: string[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase()) && !value.includes(opt)
  )

  const toggle = (style: string) => {
    onChange(value.includes(style) ? value.filter(s => s !== style) : [...value, style])
  }

  return (
    <div className="multi-select">
      <div className="multi-select-trigger" onClick={() => setOpen(!open)}>
        <div className="selected-tags">
          {value.length === 0 && <span className="placeholder">{placeholder}</span>}
          {value.map(v => (
            <span key={v} className="tag">
              {v}
              <button type="button" onClick={(e) => { e.stopPropagation(); toggle(v); }}>
                <XCircle size={12} />
              </button>
            </span>
          ))}
        </div>
        <ChevronDown size={16} className={open ? 'rotate' : ''} />
      </div>
      {open && (
        <div className="multi-select-dropdown">
          <input
            type="text"
            placeholder="Search styles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          {filteredOptions.map(opt => (
            <button
              key={opt}
              type="button"
              className="dropdown-option"
              onClick={(e) => { e.stopPropagation(); toggle(opt); setSearch(''); }}
            >
              {opt}
            </button>
          ))}
          {filteredOptions.length === 0 && (
            <div className="no-options">No more styles available</div>
          )}
        </div>
      )}
    </div>
  )
}

function PropMultiSelect({
  value,
  onChange,
  schema,
  placeholder,
}: {
  value: string[]
  onChange: (value: string[]) => void
  schema: Record<string, unknown>
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const properties = (schema.properties as Record<string, unknown>) || {}
  const availableProps = Object.keys(properties).filter(p => !value.includes(p))

  const toggle = (prop: string) => {
    onChange(value.includes(prop) ? value.filter(p => p !== prop) : [...value, prop])
  }

  return (
    <div className="multi-select">
      <div className="multi-select-trigger" onClick={() => setOpen(!open)}>
        <div className="selected-tags">
          {value.length === 0 && <span className="placeholder">{placeholder}</span>}
          {value.map(v => (
            <span key={v} className="tag">
              {v}
              <button type="button" onClick={(e) => { e.stopPropagation(); toggle(v); }}>
                <XCircle size={12} />
              </button>
            </span>
          ))}
        </div>
        <ChevronDown size={16} className={open ? 'rotate' : ''} />
      </div>
      {open && (
        <div className="multi-select-dropdown">
          {availableProps.map(prop => (
            <button
              key={prop}
              type="button"
              className="dropdown-option"
              onClick={(e) => { e.stopPropagation(); toggle(prop); }}
            >
              {prop}
            </button>
          ))}
          {availableProps.length === 0 && (
            <div className="no-options">No more props available (define in props schema first)</div>
          )}
        </div>
      )}
    </div>
  )
}