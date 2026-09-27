import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './tests/browser', workers: 1, timeout: 60000,
    use: {
        baseURL: 'http://127.0.0.1:5173', channel: 'chrome', headless: true,
        launchOptions: { args: ['--use-fake-device-for-media-stream'] },
    },
});
