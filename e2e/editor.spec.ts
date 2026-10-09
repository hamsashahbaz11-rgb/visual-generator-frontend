import { expect, test, type APIRequestContext } from '@playwright/test'
import { API_BASE_URL, freshUser, registerViaApi, signInThroughUi } from './helpers'

/**
 * Editor acceptance (Prompt 3, Phase 1 items 5-8). Uses the production build
 * and the real API. The project, scene and component instance are created via
 * the real endpoints so the UI is exercised against genuine persisted data.
 */

const authed = (token: string) => ({ Authorization: `Bearer ${token}` })

const createProjectAndScene = async (request: APIRequestContext, token: string) => {
  const project = await request.post(`${API_BASE_URL}/projects`, {
    headers: authed(token),
    data: { name: `E2E project ${Date.now()}` },
  })
  if (!project.ok()) throw new Error(`create project failed: ${project.status()}`)
  const projectBody = (await project.json()) as { id?: string; project?: { id: string } }
  const projectId = projectBody.id ?? projectBody.project?.id
  if (!projectId) throw new Error('project id missing from response')

  const scene = await request.post(`${API_BASE_URL}/projects/${projectId}/scenes`, {
    headers: authed(token),
    data: { name: 'Intro scene' },
  })
  if (!scene.ok()) throw new Error(`create scene failed: ${scene.status()}`)
  const sceneBody = (await scene.json()) as { id?: string; scene?: { id: string } }
  const sceneId = sceneBody.id ?? sceneBody.scene?.id
  if (!sceneId) throw new Error('scene id missing from response')
  return { projectId, sceneId }
}

test.describe('editor', () => {
  test('5. navigates from a project into the canvas and scene editor', async ({ page, request }) => {
    const user = freshUser('editor-nav')
    const { token } = await registerViaApi(request, user)
    const { projectId, sceneId } = await createProjectAndScene(request, token)

    await signInThroughUi(page, user)
    await page.goto(`/projects/${projectId}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E project')
    await page.getByRole('button', { name: 'Open canvas' }).click()
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/canvas$`))
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/scenes/${sceneId}`))
    await expect(page.getByRole('group', { name: 'Editor mode' })).toBeVisible()
  })

  test('7. opens the timeline, animation inspector, AI panel and render panel', async ({ page, request }) => {
    const user = freshUser('editor-panels')
    const { token } = await registerViaApi(request, user)
    const { projectId, sceneId } = await createProjectAndScene(request, token)

    await signInThroughUi(page, user)
    await page.goto(`/projects/${projectId}/scenes/${sceneId}`)
    await expect(page.getByRole('region', { name: 'Scene timeline' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Inspector' }).first()).toBeVisible()
    await expect(page.getByLabel('AI prompt')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Refresh renders' })).toBeVisible()
  })

  test('6. adds a component, selects it, edits X in the inspector, and persists it after reload', async ({ page, request }) => {
    const user = freshUser('editor-edit')
    const { token } = await registerViaApi(request, user)
    const { projectId, sceneId } = await createProjectAndScene(request, token)

    await signInThroughUi(page, user)
    await page.goto(`/projects/${projectId}/scenes/${sceneId}`)

    // Add a real component through the component picker (Arrow/Hub/Label are seeded and public).
    // Option text is "{displayName} ({name})"; select the seeded public Label definition by value lookup.
    const labelOption = await page.getByLabel('Add component').locator('option', { hasText: '(Label)' }).first().getAttribute('value')
    if (!labelOption) throw new Error('seeded Label component is not available in the picker')
    await page.getByLabel('Add component').selectOption(labelOption)
    await expect.poll(async () => {
      const res = await request.get(`${API_BASE_URL}/scenes/${sceneId}/instances`, { headers: authed(token) })
      const body = (await res.json()) as { items?: unknown[] } | unknown[]
      return Array.isArray(body) ? body.length : (body.items?.length ?? 0)
    }, { timeout: 15_000 }).toBeGreaterThan(0)

    // Adding does not select the element; click it on the canvas so the Inspector binds to it.
    await page.getByText('New text').first().click()
    await expect(page.getByText('No component selected')).toHaveCount(0)

    // Edit the position X field in the inspector and commit it.
    const xField = page.getByRole('spinbutton', { name: 'X' }).first()
    await xField.fill('321')
    await xField.press('Enter')

    // The saved state (server truth) must reflect the edit, not only the UI.
    await expect.poll(async () => {
      const res = await request.get(`${API_BASE_URL}/scenes/${sceneId}/instances`, { headers: authed(token) })
      const body = (await res.json()) as { items?: Array<{ position: { x: number } }> } | Array<{ position: { x: number } }>
      const items = Array.isArray(body) ? body : (body.items ?? [])
      return items.some((item) => item.position.x === 321)
    }, { timeout: 15_000 }).toBe(true)

    // And it survives a full reload of the editor. Selection is not persisted,
    // so re-select the element before reading its saved X value from the Inspector.
    await page.reload()
    await page.getByText('New text').first().click()
    await expect(page.getByRole('spinbutton', { name: 'X' }).first()).toHaveValue('321')
  })
  test('8. surfaces a failed scene load as an error, not a blank editor', async ({ page, request }) => {
    const user = freshUser('editor-error')
    await registerViaApi(request, user)
    await signInThroughUi(page, user)
    await page.goto('/projects/00000000-0000-4000-8000-000000000000/scenes/00000000-0000-4000-8000-000000000001')
    await expect(page.getByRole('alert').or(page.getByText(/not found|could not|failed|not accessible/i)).first()).toBeVisible()
  })
})
