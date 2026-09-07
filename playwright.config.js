import { defineConfig } from '@playwright/test'

const browserPort = process.env.PW_BROWSER_PORT || '5183'
const browserBaseURL = 'http://127.0.0.1:' + browserPort

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results/playwright',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: './test-results/playwright/results.json' }]
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'browser',
      testMatch: '**/browser.spec.js',
      use: { browserName: 'chromium', baseURL: browserBaseURL }
    },
    {
      name: 'electron',
      testMatch: '**/electron.spec.js'
    },
    {
      name: 'electron-dist',
      testMatch: '**/electron-dist.spec.js'
    }
  ],
  webServer: [
    {
      command: 'npm.cmd run dev:mock -- --host 127.0.0.1 --port ' + browserPort,
      url: browserBaseURL + '/login',
      reuseExistingServer: false,
      timeout: 120000
    },
    {
      command: 'npx.cmd vite --mode desktop-mock --host 127.0.0.1 --port 5177',
      url: 'http://127.0.0.1:5177',
      reuseExistingServer: true,
      timeout: 120000
    }
  ]
})
