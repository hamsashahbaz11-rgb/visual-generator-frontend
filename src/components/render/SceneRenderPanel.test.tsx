// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SceneRenderPanel } from './SceneRenderPanel'
import { pollIntervalForRenderStatus } from '../../hooks/useApi'
import { RENDER_POLL_INTERVAL } from '../../utils/constants'
import type { Render } from '../../types/api'

vi.mock('../../services/render', () => ({
  renderApi: {
    createSceneRender: vi.fn(),
    listSceneRenders: vi.fn(),
    getStatus: vi.fn(),
    cancel: vi.fn(),
    download: vi.fn(),
    previewUrl: vi.fn(),
  },
}))

import { renderApi } from '../../services/render'

const mocked = vi.mocked(renderApi, true)

const renderRow = (overrides: Partial<Render> = {}): Render => ({
  id: 'render-1',
  projectId: 'project-1',
  sceneId: 'scene-1',
  status: 'queued',
  progress: 0,
  specSnapshot: {},
  outputAssetId: null,
  error: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const renderPanel = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SceneRenderPanel sceneId="scene-1" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocked.listSceneRenders.mockResolvedValue([])
})

describe('SceneRenderPanel', () => {
  it('starts a render with one idempotency key per intent (double-click safe)', async () => {
    mocked.createSceneRender.mockResolvedValue(renderRow({ status: 'queued' }))
    renderPanel()
    await waitFor(() => expect(screen.getByText('Render scene')).toBeTruthy())
    const button = screen.getByText('Render scene')
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(mocked.createSceneRender).toHaveBeenCalledTimes(1))
    expect(mocked.createSceneRender.mock.calls[0][0]).toBe('scene-1')
    expect(typeof mocked.createSceneRender.mock.calls[0][1]).toBe('string')
  })

  it('displays queued and running progress states', async () => {
    mocked.listSceneRenders.mockResolvedValue([renderRow({ status: 'running', progress: 37 })])
    mocked.getStatus.mockResolvedValue({
      id: 'render-1', projectId: 'project-1', sceneId: 'scene-1', status: 'running',
      progress: 37, outputAssetId: null, error: null, source: 'scene-document',
      startedAt: null, completedAt: null, createdAt: '', updatedAt: '',
    })
    renderPanel()
    await waitFor(() => expect(screen.getByText('Rendering…')).toBeTruthy())
    expect(screen.getByText('37%')).toBeTruthy()
    expect(screen.getByText('Cancel')).toBeTruthy()
  })

  it('shows completed output with preview video and download', async () => {
    mocked.listSceneRenders.mockResolvedValue([
      renderRow({ status: 'done', progress: 100, outputAssetId: 'asset-1' }),
    ])
    mocked.previewUrl.mockResolvedValue('blob:preview')
    renderPanel()
    await waitFor(() => expect(screen.getByText('Completed')).toBeTruthy())
    await waitFor(() => expect(screen.getByTestId('scene-render-video')).toBeTruthy())
    expect(screen.getByTestId('scene-render-video').getAttribute('src')).toBe('blob:preview')
    fireEvent.click(screen.getByText('Download'))
    expect(mocked.download).toHaveBeenCalledWith('render-1')
  })

  it('distinguishes failure from cancellation', async () => {
    mocked.listSceneRenders.mockResolvedValue([
      renderRow({ status: 'failed', error: 'codec exploded' }),
    ])
    renderPanel()
    await waitFor(() => expect(screen.getByText('Failed')).toBeTruthy())
    expect(screen.getByText('Render failed: codec exploded')).toBeTruthy()
  })

  it('renders cancelled state distinctly', async () => {
    mocked.listSceneRenders.mockResolvedValue([renderRow({ status: 'cancelled', progress: 42 })])
    renderPanel()
    await waitFor(() => expect(screen.getByText('Cancelled')).toBeTruthy())
    expect(screen.getByText('Rendering cancelled')).toBeTruthy()
  })

  it('cancels an active render', async () => {
    mocked.listSceneRenders.mockResolvedValue([renderRow({ status: 'running', progress: 10 })])
    mocked.getStatus.mockResolvedValue({
      id: 'render-1', projectId: 'project-1', sceneId: 'scene-1', status: 'running',
      progress: 10, outputAssetId: null, error: null, source: 'scene-document',
      startedAt: null, completedAt: null, createdAt: '', updatedAt: '',
    })
    mocked.cancel.mockResolvedValue(renderRow({ status: 'cancelled' }))
    renderPanel()
    await waitFor(() => expect(screen.getByText('Cancel')).toBeTruthy())
    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => expect(mocked.cancel).toHaveBeenCalledWith('render-1'))
  })

  it('lists recent render history besides the latest', async () => {
    mocked.listSceneRenders.mockResolvedValue([
      renderRow({ id: 'r2', status: 'done', progress: 100 }),
      renderRow({ id: 'r1', status: 'failed', error: 'x' }),
    ])
    renderPanel()
    await waitFor(() => expect(screen.getByTestId('scene-render-history')).toBeTruthy())
    expect(screen.getByTestId('scene-render-history').textContent).toContain('Failed')
  })

  it('keeps scene selection intact (no document coupling)', async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByTestId('scene-render-panel')).toBeTruthy())
    expect(mocked.listSceneRenders).toHaveBeenCalledWith('scene-1')
  })
})

describe('render polling rule', () => {
  it('polls while active and stops at terminal states', () => {
    expect(pollIntervalForRenderStatus('queued')).toBe(RENDER_POLL_INTERVAL)
    expect(pollIntervalForRenderStatus('running')).toBe(RENDER_POLL_INTERVAL)
    expect(pollIntervalForRenderStatus('done')).toBe(false)
    expect(pollIntervalForRenderStatus('failed')).toBe(false)
    expect(pollIntervalForRenderStatus('cancelled')).toBe(false)
    expect(pollIntervalForRenderStatus(undefined)).toBe(false)
  })
})
