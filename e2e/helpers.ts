import type { APIRequestContext, Page } from '@playwright/test'

export const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:3002'

export interface TestUser {
  name: string
  email: string
  password: string
}

/** A unique account per test run, so runs never collide and no fixed secret is stored. */
export const freshUser = (label: string): TestUser => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  return {
    name: `E2E ${label}`,
    email: `e2e-${label}-${stamp}@example.test`,
    password: `e2e-pass-${stamp}-xyz`,
  }
}

/** Registers through the real API and returns the session token. */
export const registerViaApi = async (request: APIRequestContext, user: TestUser) => {
  const response = await request.post(`${API_BASE_URL}/auth/register`, { data: user })
  if (!response.ok()) throw new Error(`register failed: ${response.status()}`)
  const body = (await response.json()) as { token: string; user: { id: string } }
  return body
}

/** Signs in through the real login form. The token is persisted by the app itself. */
export const signInThroughUi = async (page: Page, user: TestUser) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByRole('textbox', { name: /^Password/ }).fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/dashboard')
}
