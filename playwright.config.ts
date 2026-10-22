import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5179',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', testIgnore: '**/online.spec.ts', use: { browserName: 'chromium' } },
    { name: 'webkit', testIgnore: '**/online.spec.ts', use: { browserName: 'webkit' } },
    { name: 'online', testMatch: '**/online.spec.ts', use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:5180' } },
  ],
  webServer: [{
    command: 'npx vite build --mode e2e --outDir .e2e/offline && npx vite preview --outDir .e2e/offline --host 127.0.0.1 --port 5179 --strictPort',
    port: 5179,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
      VITE_ADMIN_PASSWORD: 'e2e-local-only',
    },
  }, {
    command: 'npx vite build --mode e2e --outDir .e2e/online && npx vite preview --outDir .e2e/online --host 127.0.0.1 --port 5180 --strictPort',
    port: 5180,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54329',
      VITE_SUPABASE_ANON_KEY: 'e2e-test-anon-key',
      VITE_ADMIN_PASSWORD: '',
    },
  }],
});
