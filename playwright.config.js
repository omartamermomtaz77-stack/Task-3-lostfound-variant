import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5176',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'node server/test/start-test-server.js',
      url: 'http://127.0.0.1:4001/api/health',
      timeout: 180000
    },
    {
      command: 'npm run dev --workspace client -- --host 127.0.0.1 --port 5176',
      url: 'http://127.0.0.1:5176',
      env: { API_PROXY_TARGET: 'http://127.0.0.1:4001' }
    }
  ]
});
