// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AiPanel } from './AiPanel'
import type { SceneDocument } from '../../types/api'

vi.mock('../../services/ai', () => ({
  aiApi: { plan: vi.fn(), apply: vi.fn() },
}))

import { aiApi } from '../../services/ai'

const mocked = vi.mocked(aiApi, true)

const updatedDocument = {
  id: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  name: 'F = ma',
  components: [],
  groups: [],
} as SceneDocument

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AiPanel', () => {
  it('generates a plan and previews it before any mutation', async () => {
    mocked.plan.mockResolvedValue({
      plan: { operations: [{ type: 'createInstance', definitionName: 'Label' }] },
      meta: { requestId: 'req-1', model: 'test-model' },
    })
    const onApplied = vi.fn()
    render(<AiPanel sceneId="scene-1" onApplied={onApplied} />)
    fireEvent.change(screen.getByLabelText('AI prompt'), {
      target: { value: 'Add a label on the left' },
    })
    fireEvent.click(screen.getByText('Generate plan'))
    await waitFor(() => expect(screen.getByTestId('ai-plan-preview')).toBeTruthy())
    expect(screen.getByTestId('ai-plan-preview').textContent).toContain(
      'createInstance (Label)',
    )
    expect(mocked.plan).toHaveBeenCalledWith('scene-1', 'Add a label on the left')
    // Planning never mutates: apply has not been called.
    expect(mocked.apply).not.toHaveBeenCalled()
    expect(onApplied).not.toHaveBeenCalled()
  })

  it('applies the previewed plan and hands the updated document back', async () => {
    mocked.plan.mockResolvedValue({
      plan: { operations: [{ type: 'moveInstance', instanceId: 'x' }] },
      meta: {},
    })
    mocked.apply.mockResolvedValue({
      applied: [{ index: 0, type: 'moveInstance', id: 'x' }],
      document: updatedDocument,
    })
    const onApplied = vi.fn()
    render(<AiPanel sceneId="scene-1" onApplied={onApplied} />)
    fireEvent.change(screen.getByLabelText('AI prompt'), {
      target: { value: 'Move it right' },
    })
    fireEvent.click(screen.getByText('Generate plan'))
    await waitFor(() => expect(screen.getByTestId('ai-plan-preview')).toBeTruthy())
    fireEvent.click(screen.getByText('Apply plan'))
    await waitFor(() =>
      expect(mocked.apply).toHaveBeenCalledWith('scene-1', {
        operations: [{ type: 'moveInstance', instanceId: 'x' }],
      }),
    )
    expect(onApplied).toHaveBeenCalledWith(updatedDocument)
    await waitFor(() => expect(screen.queryByTestId('ai-plan-preview')).toBeNull())
    expect((screen.getByLabelText('AI prompt') as HTMLTextAreaElement).value).toBe('')
  })

  it('surfaces provider errors and applies nothing', async () => {
    mocked.plan.mockRejectedValue(
      new Error('AI model is not configured (missing API key)'),
    )
    const onApplied = vi.fn()
    render(<AiPanel sceneId="scene-1" onApplied={onApplied} />)
    fireEvent.change(screen.getByLabelText('AI prompt'), {
      target: { value: 'Do something' },
    })
    fireEvent.click(screen.getByText('Generate plan'))
    await waitFor(() =>
      expect(screen.getByText(/AI model is not configured/)).toBeTruthy(),
    )
    expect(mocked.apply).not.toHaveBeenCalled()
    expect(onApplied).not.toHaveBeenCalled()
    expect(screen.queryByTestId('ai-plan-preview')).toBeNull()
  })

  it('disables apply for empty plans', async () => {
    mocked.plan.mockResolvedValue({ plan: { operations: [] }, meta: {} })
    render(<AiPanel sceneId="scene-1" onApplied={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('AI prompt'), {
      target: { value: 'Something impossible' },
    })
    fireEvent.click(screen.getByText('Generate plan'))
    await waitFor(() => expect(screen.getByTestId('ai-plan-preview')).toBeTruthy())
    expect(screen.getByText(/no operations/i)).toBeTruthy()
    expect((screen.getByText('Apply plan') as HTMLButtonElement).disabled).toBe(true)
    expect(mocked.apply).not.toHaveBeenCalled()
  })

  it('keeps generate disabled until a prompt exists', () => {
    render(<AiPanel sceneId="scene-1" onApplied={vi.fn()} />)
    expect((screen.getByText('Generate plan') as HTMLButtonElement).disabled).toBe(true)
    expect(mocked.plan).not.toHaveBeenCalled()
  })
})
