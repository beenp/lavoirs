import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';

async function enter(page: Page, name: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(`${name.toLowerCase()}@example.com`);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await page.getByLabel('Your name', { exact: true }).fill(name);
  await page.getByLabel('City or neighborhood').fill('Vancouver');
  await page.getByRole('button', { name: 'Books', exact: true }).click();
  await page.getByRole('button', { name: 'Find my group' }).click();
  await page.getByRole('button', { name: 'Join the queue' }).click();
  await page.getByRole('button', { name: 'Join group room' }).click();
  await expect(page.locator('.connection-pill')).toHaveText('CONNECTED', { timeout: 20000 });
}

test('two separate sessions publish and receive video, mute, and leave', async ({ browser }) => {
  const contexts: BrowserContext[] = [];
  const secondBrowser = await chromium.launch({ channel: 'chrome', args: ['--use-fake-device-for-media-stream'] });
  try {
    contexts.push(await browser.newContext({ permissions: ['camera', 'microphone'] }));
    contexts.push(await secondBrowser.newContext({ baseURL: 'http://127.0.0.1:5173', permissions: ['camera', 'microphone'] }));
    // Deterministic video frames avoid Windows camera-driver contention.
    for (const context of contexts) await context.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async constraints => {
        if (!constraints?.video) return original(constraints);
        const canvas = document.createElement('canvas');
        canvas.width = 640; canvas.height = 480;
        const drawing = canvas.getContext('2d')!;
        const paint = () => { drawing.fillStyle = '#e94736'; drawing.fillRect(0, 0, 640, 480); drawing.fillStyle = '#ffda45'; drawing.fillRect(Math.floor(performance.now() / 10) % 500, 100, 100, 100); };
        paint();
        const stream = canvas.captureStream(15);
        const timer = window.setInterval(paint, 66);
        const track = stream.getVideoTracks()[0];
        const stop = track.stop.bind(track);
        track.stop = () => { clearInterval(timer); stop(); };
        return stream;
      };
    });
    const one = await contexts[0].newPage();
    const two = await contexts[1].newPage();
    await enter(one, 'Taylor');
    await enter(two, 'Morgan');
    await expect(one.locator('.video-tile')).toHaveCount(2);
    await expect(two.locator('.video-tile')).toHaveCount(2);
    await expect(one.getByRole('button', { name: 'Turn camera off' })).toBeVisible();
    await expect(two.getByRole('button', { name: 'Turn camera off' })).toBeVisible();
    await expect.poll(() => one.locator('.video-tile:not(.local-tile) video').evaluateAll(videos => videos.some(v => (v as HTMLVideoElement).videoWidth > 0)), { timeout: 20000 }).toBe(true);
    await expect.poll(() => two.locator('.video-tile:not(.local-tile) video').evaluateAll(videos => videos.some(v => (v as HTMLVideoElement).videoWidth > 0)), { timeout: 20000 }).toBe(true);
    await one.getByRole('button', { name: 'Mute mic' }).click();
    await expect(one.getByRole('button', { name: 'Turn mic on' })).toBeVisible();
    await two.getByRole('button', { name: 'Back to the queue' }).click();
    await expect(one.locator('.video-tile')).toHaveCount(1);
    await one.getByRole('button', { name: /Leave room/ }).click();
    await expect(one.locator('.connection-pill')).toHaveText('READY');
  } finally {
    for (const context of contexts) { await context.request.delete('http://127.0.0.1:5173/api/dev/session', { timeout: 5000 }).catch(() => {}); await context.close(); }
    await secondBrowser.close();
  }
});

test('token API denies missing session and wrong group', async ({ request }) => {
  const missing = await request.post('/api/livekit/token', { data: { groupId: 'local-group-1' }, headers: { 'X-Dev-User-Id': 'fake-jordan' } });
  expect(missing.status()).toBe(401);
  await request.post('/api/dev/session', { data: { email: 'outsider@example.com' } });
  const denied = await request.post('/api/livekit/token', { data: { groupId: 'another-group' } });
  expect(denied.status()).toBe(403);
  await request.delete('/api/dev/session');
});

test('denied camera and microphone still allow a usable room connection', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); };
    });
    const page = await context.newPage();
    await enter(page, 'NoDevices');
    await expect(page.getByRole('alert')).toContainText(/permission was denied/);
    await expect(page.getByRole('button', { name: 'Turn camera on' })).toBeVisible();
    await page.getByRole('button', { name: /Leave room/ }).click();
    await expect(page.locator('.connection-pill')).toHaveText('READY');
  } finally { await context.request.delete('http://127.0.0.1:5173/api/dev/session'); await context.close(); }
});
