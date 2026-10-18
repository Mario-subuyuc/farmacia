import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 45000,
  use: { baseURL: 'http://localhost:5174', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node ../tests/ui-server.js', url: 'http://127.0.0.1:3010/api/health', timeout: 60000 },
    { command: 'npx vite --host 127.0.0.1 --port 5174 --strictPort', url: 'http://localhost:5174', timeout: 60000, env: { VITE_API_URL: 'http://127.0.0.1:3010/api' } },
  ],
});
