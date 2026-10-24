import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Cloud image supplies Chromium; avoid a separate browser download.
const executablePath = process.env.CHROMIUM_PATH ?? '/usr/bin/chromium';
const basePath = process.env.VITE_BASE_PATH ?? '/';
const baseURL = new URL(basePath, 'http://127.0.0.1:4173').href;
if (!existsSync(executablePath)) {
  throw new Error('Chromium is missing. Set CHROMIUM_PATH to an installed Chromium executable.');
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    launchOptions: { executablePath },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
