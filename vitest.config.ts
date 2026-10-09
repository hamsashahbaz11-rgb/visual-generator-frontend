import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Unit and component tests only. Browser specs in e2e/ run under Playwright.
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/testSetup.ts'],
  },
})
