import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e-real',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/e2e-real/global-setup.ts',
  outputDir: './test-results/e2e-real/artefatos',
  reporter: [['list'], ['json', { outputFile: './test-results/e2e-real/resultado.json' }]],
  workers: 1,
  timeout: 90000,
  expect: { timeout: 20000 },
  use: {
    baseURL: process.env.E2E_REAL_FRONT_URL ?? 'http://localhost:4321',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
