import { expect, test } from '@playwright/test'

/**
 * Public site: metadata, crawl files and the no-private-content rule.
 * Runs against the production build; no authentication needed.
 */

test('features, templates and pricing render with their own titles', async ({ page }) => {
  await page.goto('/features')
  await expect(page.getByRole('heading', { level: 1, name: 'Features' })).toBeVisible()
  await expect(page).toHaveTitle(/Features/)

  await page.goto('/templates')
  await expect(page.getByRole('heading', { level: 1, name: 'Templates' })).toBeVisible()

  await page.goto('/pricing')
  await expect(page.getByRole('heading', { level: 1, name: 'Pricing' })).toBeVisible()
  // No invented prices are shown.
  await expect(page.getByText(/not published yet/i)).toBeVisible()
})

test('robots.txt allows public pages and disallows the authenticated app', async ({ request }) => {
  const res = await request.get('/robots.txt')
  expect(res.status()).toBe(200)
  const body = await res.text()
  expect(body).toContain('Allow: /features')
  expect(body).toContain('Disallow: /dashboard')
  expect(body).toContain('Disallow: /projects/')
})

test('sitemap.xml lists only public pages', async ({ request }) => {
  const res = await request.get('/sitemap.xml')
  expect(res.status()).toBe(200)
  const body = await res.text()
  expect(body).toContain('/features')
  expect(body).toContain('/pricing')
  expect(body).not.toContain('/dashboard')
  expect(body).not.toContain('/projects/')
  expect(body).not.toContain('/components')
})

test('auth pages are disallowed for crawlers and absent from the sitemap', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toContain('Disallow: /login')
  expect(robots).toContain('Disallow: /register')
  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).not.toContain('/login')
  expect(sitemap).not.toContain('/register')
})
