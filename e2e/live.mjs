import { chromium } from 'playwright';

const URL = process.env.LIVE_URL || 'https://visual-framework-app.vercel.app';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const countFrames = () => page.locator('.frame').count();
const countExecutionLinks = () => page.locator('.connection-group.execution').count();

async function injectProposal(proposal) {
  await page.evaluate(async proposalValue => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('visual-framework', 2);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const metaTx = db.transaction('meta', 'readonly');
        const activeRequest = metaTx.objectStore('meta').get('active-framework-id');
        activeRequest.onerror = () => reject(activeRequest.error);
        activeRequest.onsuccess = () => {
          const id = activeRequest.result || 'framework-main';
          const readTx = db.transaction('frameworks', 'readonly');
          const getRequest = readTx.objectStore('frameworks').get(id);
          getRequest.onerror = () => reject(getRequest.error);
          getRequest.onsuccess = () => {
            const doc = getRequest.result;
            if (!doc) return reject(new Error('Framework not found in IndexedDB'));
            doc.proposals = [...(doc.proposals || []).filter(item => item.id !== proposalValue.id), proposalValue];
            doc.updatedAt = new Date().toISOString();
            const writeTx = db.transaction('frameworks', 'readwrite');
            writeTx.objectStore('frameworks').put(doc);
            writeTx.oncomplete = () => resolve();
            writeTx.onerror = () => reject(writeTx.error);
          };
        };
      };
    });
  }, proposal);
}

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByText('Visual Framework', { exact: true }).first().waitFor();

  const initialFrames = await countFrames();
  assert(initialFrames >= 4, `Expected at least 4 seed Frames, found ${initialFrames}`);

  await page.getByRole('button', { name: /Data/ }).first().click();
  assert(await countFrames() === initialFrames + 1, 'Adding a Data Frame failed');

  const newest = page.locator('.frame').last();
  await newest.click({ position: { x: 80, y: 30 } });
  await page.keyboard.press('Control+d');
  await page.waitForTimeout(120);
  assert(await countFrames() === initialFrames + 2, 'Duplicate failed');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  assert(await countFrames() === initialFrames + 1, 'Undo duplicate failed');
  await page.keyboard.press('Control+Shift+z');
  await page.waitForTimeout(100);
  assert(await countFrames() === initialFrames + 2, 'Redo duplicate failed');

  await page.locator('[data-frame="asset-1"]').click({ position: { x: 70, y: 30 } });
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(120);
  assert(await countFrames() === initialFrames + 3, 'Copy and paste failed');
  await page.keyboard.press('Control+z');

  await page.locator('[data-frame="asset-1"]').click({ position: { x: 70, y: 30 } });
  await page.locator('[data-frame="instruction-1"]').click({ modifiers: ['Shift'], position: { x: 70, y: 30 } });
  await page.getByText('2 selected', { exact: true }).waitFor();

  const assetBefore = await page.locator('[data-frame="asset-1"]').boundingBox();
  const stepBefore = await page.locator('[data-frame="instruction-1"]').boundingBox();
  assert(assetBefore && stepBefore, 'Could not measure selected Frames');
  await page.mouse.move(stepBefore.x + 90, stepBefore.y + 32);
  await page.mouse.down();
  await page.mouse.move(stepBefore.x + 175, stepBefore.y + 72, { steps: 7 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const assetAfter = await page.locator('[data-frame="asset-1"]').boundingBox();
  const stepAfter = await page.locator('[data-frame="instruction-1"]').boundingBox();
  assert(assetAfter && stepAfter && assetAfter.x > assetBefore.x + 40 && stepAfter.x > stepBefore.x + 40, 'Multi Frame movement failed');

  await page.getByRole('button', { name: 'Contain selection in active Frame' }).click();
  await page.locator('[data-frame="asset-1"] .frame-parent').waitFor();
  await page.getByRole('button', { name: 'Collapse children' }).click();
  await page.waitForTimeout(120);
  assert(await page.locator('[data-frame="asset-1"]').count() === 0, 'Hierarchy collapse failed');
  await page.getByRole('button', { name: 'Expand children' }).click();
  await page.locator('[data-frame="asset-1"]').waitFor();

  await page.locator('.relation-select').selectOption('supports');
  const semanticBefore = await page.locator('.connection-group.semantic').count();
  await page.getByRole('button', { name: 'Relate', exact: true }).click();
  await page.waitForTimeout(120);
  assert(await page.locator('.connection-group.semantic').count() === semanticBefore + 1, 'Semantic relationship creation failed');

  const goalSelect = page.locator('.goal-control select');
  await goalSelect.selectOption('compare');
  await page.waitForTimeout(220);
  assert(await goalSelect.inputValue() === 'compare', 'Goal reorganization did not set the goal');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  assert(await goalSelect.inputValue() !== 'compare', 'Undo goal organization failed');
  await page.keyboard.press('Control+Shift+z');
  await page.getByRole('button', { name: 'Fit', exact: true }).first().click();

  const executionBefore = await countExecutionLinks();
  await page.locator('.connection-group.execution .connection-hit').first().dispatchEvent('click');
  await page.locator('.connection-group.execution.selected .connection-remove').dispatchEvent('click');
  await page.waitForTimeout(400);
  assert(await countExecutionLinks() === executionBefore - 1, 'Cable removal failed');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(120);
  assert(await countExecutionLinks() === executionBefore, 'Undo cable removal failed');

  await page.locator('[data-frame="instruction-1"]').click({ position: { x: 70, y: 30 } });
  await page.getByRole('button', { name: 'Local', exact: true }).click();
  await page.getByRole('button', { name: 'Run Frame', exact: true }).click();
  await page.getByText('PASSED', { exact: true }).waitFor({ timeout: 15000 });

  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.getByText('PASSED', { exact: true }).waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: /Runs \d+/ }).click();
  await page.getByText('Runs', { exact: true }).last().waitFor();
  assert(await page.locator('.run-list button').count() >= 1, 'Stored Run inspection failed');

  await page.getByRole('button', { name: /Issues \d+/ }).click();
  await page.getByText('Issues', { exact: true }).last().waitFor();
  assert(await page.locator('.issue-list').count() === 1, 'Framework issue inspector failed');

  const reframeProposal = {
    id: 'qa-reframe-proposal',
    operation: 'reframe',
    scope: { kind: 'frame', frameIds: ['asset-1'] },
    status: 'pending',
    createdAt: new Date().toISOString(),
    summary: 'QA structural proposal',
    additions: [{ tempId: 'qa-a', title: 'QA Alternative', body: 'Alternative structure for acceptance testing.', role: 'alternative', epistemicState: 'hypothesized', relationshipToAnchor: 'reframes' }]
  };
  await injectProposal(reframeProposal);
  await page.reload({ waitUntil: 'networkidle' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Review Proposal' }).click();
  await page.getByText('QA Alternative', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Accept Proposal' }).click();
  await page.getByText('QA Alternative', { exact: true }).waitFor();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(120);
  assert(await page.getByText('QA Alternative', { exact: true }).count() === 0, 'Undo accepted Proposal failed');
  await page.keyboard.press('Control+Shift+z');
  await page.getByText('QA Alternative', { exact: true }).waitFor();

  const compressProposal = {
    id: 'qa-compress-proposal',
    operation: 'compress',
    scope: { kind: 'framework', frameIds: [] },
    status: 'pending',
    createdAt: new Date().toISOString(),
    summary: 'QA compressed Framework',
    additions: [
      { tempId: 'qa-c1', title: 'Compressed Core', body: 'Essential structure.', role: 'concept', epistemicState: 'inferred' },
      { tempId: 'qa-c2', title: 'Compressed Result', body: 'Essential result.', role: 'result', epistemicState: 'inferred' }
    ]
  };
  await injectProposal(compressProposal);
  await page.reload({ waitUntil: 'networkidle' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Review Proposal' }).click();
  await page.getByRole('button', { name: 'Create Framework' }).click();
  await page.getByText('Compressed Core', { exact: true }).waitFor();
  assert(await page.locator('.framework-switch option').count() >= 2, 'Compressed Framework was not preserved separately');
  await page.locator('.framework-switch').selectOption('framework-main');
  await page.getByText('Source', { exact: true }).waitFor();

  const persistedCount = await countFrames();
  await page.reload({ waitUntil: 'networkidle' });
  assert(await countFrames() === persistedCount, 'IndexedDB persistence failed after reload');

  const pwa = await page.evaluate(async () => {
    const manifest = await fetch('/manifest.webmanifest');
    const registration = await navigator.serviceWorker.ready;
    return { manifest: manifest.ok, worker: Boolean(registration.active) };
  });
  assert(pwa.manifest && pwa.worker, 'PWA manifest or service worker failed');

  console.log('LIVE MVP ACCEPTANCE PASSED');
} finally {
  await browser.close();
}
