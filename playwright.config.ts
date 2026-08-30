import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'

export default defineConfig<ConfigOptions>({
  testDir: './test/browser',
  fullyParallel: false,
  workers: 1,
  globalTimeout: process.env.CI ? 30 * 60_000 : 15 * 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    launchOptions: { timeout: 30_000 },
    nuxt: {
      rootDir: fileURLToPath(new URL('./test/fixtures/browser', import.meta.url)),
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', testIgnore: '**/docs.test.ts', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testIgnore: '**/docs.test.ts', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chromium', testIgnore: '**/docs.test.ts', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', testIgnore: '**/docs.test.ts', use: { ...devices['iPhone 15'] } },
  ],
})
