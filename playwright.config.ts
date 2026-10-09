import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the PRODUCTION Next.js build and the real local
// API. Set E2E_API_BASE_URL to the running backend (default http://localhost:3002,
// the port the local backend binds in this environment).
const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:3002'
const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3100)

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Build once, then serve the production output. The API base URL is baked
    // into the client bundle through NEXT_PUBLIC_API_BASE_URL.
    command: `npm run build && npx next start -p ${APP_PORT}`,
    url: `http://localhost:${APP_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
    env: { NEXT_PUBLIC_API_BASE_URL: API_BASE_URL },
  },
})
