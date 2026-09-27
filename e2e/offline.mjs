import { chromium } from 'playwright';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = process.env.LIVE_URL || 'http://127.0.0.1:4173';
const PID_FILE = process.env.PREVIEW_PID_FILE || '/tmp/vfa-preview.pid';
const profile = mkdtempSync(join(tmpdir(), 'vfa-offline-'));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    headless: true,
    viewport: { width: 1440, height: 900 }
  });
  const page = context.pages()[0] ?? await context.newPage();

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByText('Visual Framework', { exact: true }).first().waitFor();

  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload({ waitUntil: 'networkidle' });
  }
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 8000 });

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'CACHE_SHELL' });
  });

  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    const cacheName = keys.find(key => key.startsWith('visual-framework-shell-'));
    if (!cacheName) return false;
    const requests = await (await caches.open(cacheName)).keys();
    const urls = requests.map(request => request.url);
    return Boolean(await caches.match('/')) &&
      urls.some(url => /\/assets\/.*\.js(?:\?|$)/.test(url)) &&
      urls.some(url => /\/assets\/.*\.css(?:\?|$)/.test(url));
  }, null, { timeout: 8000 });

  const previewPid = Number(readFileSync(PID_FILE, 'utf8').trim());
  assert(Number.isInteger(previewPid) && previewPid > 0, 'Preview server PID is invalid');
  process.kill(previewPid, 'SIGTERM');

  let originStopped = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await fetch(URL, { signal: AbortSignal.timeout(300) });
    } catch {
      originStopped = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(originStopped, 'Preview origin did not stop for offline acceptance');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.getByText('Visual Framework', { exact: true }).first().waitFor({ timeout: 8000 });

  await page.locator('[data-frame="instruction-1"]').click({ position: { x: 65, y: 28 } });
  await page.getByRole('button', { name: 'Run This Item', exact: true }).click();
  await page.getByText('STOPPED', { exact: true }).first().waitFor({ timeout: 8000 });

  console.log('TRUE OFFLINE PWA ACCEPTANCE PASSED');
} finally {
  await context?.close().catch(() => undefined);
  rmSync(profile, { recursive: true, force: true });
}
