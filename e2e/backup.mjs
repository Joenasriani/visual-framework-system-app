import { chromium } from 'playwright';

const URL = process.env.LIVE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const assert = (condition, message) => { if (!condition) throw new Error(message); };

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByText('Visual Framework', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'More tools', exact: true }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.locator('[data-frame="asset-1"]').waitFor();

  const activeBefore = await page.locator('.framework-switch').inputValue();
  const framesBefore = await page.locator('.frame').count();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  assert(path, 'Backup download did not produce a local file');

  await page.getByRole('button', { name: 'New map', exact: true }).click();
  await page.getByRole('heading', { name: 'Start with something on your mind.' }).waitFor();
  const mapsAfterNew = await page.locator('.framework-switch option').count();

  page.once('dialog', dialog => dialog.accept());
  await page.locator('input[type="file"][accept*="json"]').setInputFiles(path);
  await page.waitForFunction(expected => document.querySelector('.framework-switch')?.value === expected, activeBefore);

  assert(await page.locator('.frame').count() === framesBefore, 'Imported backup did not restore the active map');
  assert(await page.locator('.framework-switch option').count() >= mapsAfterNew, 'Backup import deleted maps created after export');

  console.log('LOCAL BACKUP EXPORT/IMPORT ACCEPTANCE PASSED');
} finally {
  await browser.close();
}
