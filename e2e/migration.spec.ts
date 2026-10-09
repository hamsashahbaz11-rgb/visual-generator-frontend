import { expect, test } from '@playwright/test'
import { freshUser, registerViaApi, signInThroughUi } from './helpers'

/**
 * Migration acceptance gate (Prompt 3, Phase 1).
 * Runs against the production Next.js build and the real local API.
 */

const consoleErrors = (page: import('@playwright/test').Page) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  return errors
}

test.describe('public site', () => {
  test('1. homepage loads with SEO metadata and no hydration errors', async ({ page }) => {
    const errors = consoleErrors(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('clear video')
    await expect(page).toHaveTitle(/Create polished videos/)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /visual video studio|Describe an idea/)
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1)
    expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([])
  })

  test('2. navigates to login and register from the homepage', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Sign in' }).first().click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/')
    await page.getByRole('link', { name: 'Start free' }).click()
    await expect(page).toHaveURL(/\/register$/)
  })
})

test.describe('authentication', () => {
  test('3. signs in with a real account and lands on the dashboard', async ({ page, request }) => {
    const user = freshUser('signin')
    await registerViaApi(request, user)
    await signInThroughUi(page, user)
    await expect(page.getByRole('heading', { name: /Make something clear/ })).toBeVisible()
  })

  test('9a. unauthorized access to a protected route redirects to login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('9b. a wrong password shows the real API error', async ({ page, request }) => {
    const user = freshUser('badpass')
    await registerViaApi(request, user)
    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.getByRole('textbox', { name: /^Password/ }).fill('not-the-password-123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('protected navigation', () => {
  test('4. dashboard lists projects and navigates to components', async ({ page, request }) => {
    const user = freshUser('nav')
    await registerViaApi(request, user)
    await signInThroughUi(page, user)
    await page.getByRole('button', { name: 'Components' }).click()
    await expect(page).toHaveURL(/\/components$/)
    await page.getByRole('button', { name: 'Dashboard' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('4b. a missing project shows the real API error, not a blank page', async ({ page, request }) => {
    const user = freshUser('missing')
    await registerViaApi(request, user)
    await signInThroughUi(page, user)
    await page.goto('/projects/00000000-0000-4000-8000-000000000000')
    await expect(page.getByText(/not found/i).first()).toBeVisible()
  })
})
