import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

  const now = new Date().toISOString();
  const multiPortPath = join(tmpdir(), `vfa-multi-port-${Date.now()}.json`);
  writeFileSync(multiPortPath, JSON.stringify({
    format: 'visual-framework-backup',
    version: 1,
    exportedAt: now,
    activeFrameworkId: 'multi-port-test',
    frameworks: [{
      id: 'multi-port-test',
      name: 'Multi-port test',
      updatedAt: now,
      frames: [
        {
          id: 'source',
          kind: 'asset',
          role: 'concept',
          epistemicState: 'known',
          provenance: { origin: 'user', createdAt: now },
          title: 'Two values',
          operation: 'DETERMINISTIC',
          x: 120,
          y: 180,
          inputs: [],
          outputs: [
            { id: 'left', name: 'left', type: 'text' },
            { id: 'right', name: 'right', type: 'text' }
          ],
          body: '',
          value: { left: 'LEFT VALUE', right: 'RIGHT VALUE' }
        },
        {
          id: 'result',
          kind: 'output',
          role: 'result',
          epistemicState: 'unknown',
          provenance: { origin: 'user', createdAt: now },
          title: 'Combined result',
          operation: 'DETERMINISTIC',
          x: 480,
          y: 180,
          inputs: [
            { id: 'a', name: 'a', type: 'text' },
            { id: 'b', name: 'b', type: 'text' }
          ],
          outputs: [],
          body: ''
        }
      ],
      connections: [
        { id: 'left-a', fromFrame: 'source', fromPort: 'left', toFrame: 'result', toPort: 'a', kind: 'execution', meaning: 'feeds' },
        { id: 'right-b', fromFrame: 'source', fromPort: 'right', toFrame: 'result', toPort: 'b', kind: 'execution', meaning: 'feeds' }
      ],
      layers: [],
      proposals: [],
      transformations: [],
      goal: 'understand',
      version: 1
    }],
    runs: []
  }, null, 2));

  page.once('dialog', dialog => dialog.accept());
  await page.locator('input[type="file"][accept*="json"]').setInputFiles(multiPortPath);
  await page.waitForFunction(() => document.querySelector('.framework-switch')?.value === 'multi-port-test');
  await page.locator('.run-button').click();
  await page.locator('.readable-result').waitFor();
  const resultText = await page.locator('.readable-result .result-output').innerText();
  assert(resultText.includes('LEFT VALUE') && resultText.includes('RIGHT VALUE'), 'Port-aware execution did not preserve separate input values');

  console.log('LOCAL BACKUP + PORT-AWARE EXECUTION ACCEPTANCE PASSED');
} finally {
  await browser.close();
}
