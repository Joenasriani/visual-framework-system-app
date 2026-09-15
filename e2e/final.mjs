import { chromium } from 'playwright';

const URL = process.env.LIVE_URL || 'https://visual-framework-app.vercel.app';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const frames = () => page.locator('.frame').count();
const executionLinks = () => page.locator('.connection-group.execution').count();
const sleep = ms => page.waitForTimeout(ms);

async function activeFramework() {
  return page.evaluate(async () => new Promise((resolve, reject) => {
    const request = indexedDB.open('visual-framework', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const meta = db.transaction('meta', 'readonly').objectStore('meta').get('active-framework-id');
      meta.onerror = () => reject(meta.error);
      meta.onsuccess = () => {
        const id = meta.result || 'framework-main';
        const get = db.transaction('frameworks', 'readonly').objectStore('frameworks').get(id);
        get.onerror = () => reject(get.error);
        get.onsuccess = () => resolve(get.result);
      };
    };
  }));
}

async function dragLocator(from, to) {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  assert(a && b, 'Could not locate connection ports');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await sleep(180);
}

await page.route('**/api/model', async route => {
  const body = route.request().postDataJSON?.() || {};
  const title = String(body.title || 'Frame');
  await new Promise(resolve => setTimeout(resolve, title.startsWith('Structural ') ? 45 : 220));
  if (title.startsWith('Structural ')) {
    const operation = title.slice('Structural '.length);
    const additions = operation === 'compress'
      ? [
          { title: 'Compressed Core', body: 'Essential structure.', role: 'concept', epistemicState: 'inferred', relationshipToAnchor: 'supports' },
          { title: 'Compressed Result', body: 'Essential result.', role: 'result', epistemicState: 'inferred', relationshipToAnchor: 'supports' }
        ]
      : [{ title: `QA ${operation}`, body: `Structural result for ${operation}.`, role: 'alternative', epistemicState: 'hypothesized', relationshipToAnchor: 'supports' }];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ output: JSON.stringify({ summary: `QA ${operation} proposal`, additions }), model: 'acceptance', cost: 0 })
    });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output: 'Mock Frame result', model: 'acceptance', cost: 0 }) });
});

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByText('Visual Framework', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await sleep(180);

  // All five Frame kinds plus reversible creation.
  const seedCount = await frames();
  for (const name of ['Data', 'Step', 'Logic', 'Check', 'Result']) {
    await page.getByRole('button', { name: new RegExp(name) }).first().click();
  }
  assert(await frames() === seedCount + 5, 'Not all five Frame kinds could be created');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Control+z');
  await sleep(120);
  assert(await frames() === seedCount, 'Undo did not reverse Frame creation');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Control+Shift+z');
  await sleep(120);
  assert(await frames() === seedCount + 5, 'Redo did not restore Frame creation');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Control+z');

  // Move is reversible.
  const source = page.locator('[data-frame="asset-1"]');
  const sourceBefore = await source.boundingBox();
  assert(sourceBefore, 'Source Frame missing');
  await page.mouse.move(sourceBefore.x + 80, sourceBefore.y + 30);
  await page.mouse.down();
  await page.mouse.move(sourceBefore.x + 150, sourceBefore.y + 70, { steps: 7 });
  await page.mouse.up();
  await sleep(180);
  const sourceMoved = await source.boundingBox();
  assert(sourceMoved && sourceMoved.x > sourceBefore.x + 35, 'Frame move failed');
  await page.keyboard.press('Control+z');
  await sleep(100);
  const sourceUndone = await source.boundingBox();
  assert(sourceUndone && Math.abs(sourceUndone.x - sourceBefore.x) < 3, 'Undo Frame move failed');
  await page.keyboard.press('Control+Shift+z');
  await sleep(100);
  const sourceRedone = await source.boundingBox();
  assert(sourceRedone && sourceRedone.x > sourceBefore.x + 35, 'Redo Frame move failed');
  await page.keyboard.press('Control+z');

  // Canvas pan, pointer zoom and fit.
  const stage = page.locator('.stage');
  const stageBox = await stage.boundingBox();
  assert(stageBox, 'Stage missing');
  const panBefore = await stage.evaluate(el => ({ left: el.scrollLeft, top: el.scrollTop }));
  await page.mouse.move(stageBox.x + stageBox.width - 35, stageBox.y + stageBox.height - 35);
  await page.mouse.down();
  await page.mouse.move(stageBox.x + stageBox.width - 190, stageBox.y + stageBox.height - 150, { steps: 6 });
  await page.mouse.up();
  const panAfter = await stage.evaluate(el => ({ left: el.scrollLeft, top: el.scrollTop }));
  assert(panAfter.left !== panBefore.left || panAfter.top !== panBefore.top, 'Canvas pan failed');
  const zoomBefore = await page.locator('.zoom span').innerText();
  await page.mouse.move(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -260);
  await page.keyboard.up('Control');
  await sleep(100);
  const zoomAfter = await page.locator('.zoom span').innerText();
  assert(zoomAfter !== zoomBefore, 'Pointer anchored zoom failed');
  await page.getByRole('button', { name: 'Fit', exact: true }).first().click();

  // Compatible execution connection creation, Undo and Redo.
  const incomingBefore = (await activeFramework()).connections.find(link => (link.kind ?? 'execution') !== 'semantic' && link.toFrame === 'output-1');
  assert(incomingBefore?.fromFrame === 'expression-1', 'Seed output connection missing');
  await dragLocator(page.locator('[data-frame="asset-1"] [data-port="out"]'), page.locator('[data-frame="output-1"] [data-port="in"]'));
  let doc = await activeFramework();
  assert(doc.connections.find(link => (link.kind ?? 'execution') !== 'semantic' && link.toFrame === 'output-1')?.fromFrame === 'asset-1', 'Compatible port connection failed');
  await page.keyboard.press('Control+z');
  await sleep(100);
  doc = await activeFramework();
  assert(doc.connections.find(link => (link.kind ?? 'execution') !== 'semantic' && link.toFrame === 'output-1')?.fromFrame === 'expression-1', 'Undo connection failed');
  await page.keyboard.press('Control+Shift+z');
  await sleep(100);
  doc = await activeFramework();
  assert(doc.connections.find(link => (link.kind ?? 'execution') !== 'semantic' && link.toFrame === 'output-1')?.fromFrame === 'asset-1', 'Redo connection failed');
  await page.keyboard.press('Control+z');

  // Incompatible port must not connect.
  await page.getByRole('button', { name: /Check/ }).first().click();
  const newCheck = page.locator('.frame-check').last();
  const beforeReject = await activeFramework();
  const linkBeforeReject = beforeReject.connections.find(link => (link.kind ?? 'execution') !== 'semantic' && link.toFrame === 'expression-1');
  await dragLocator(newCheck.locator('[data-port="out"]'), page.locator('[data-frame="expression-1"] [data-port="in"]'));
  const afterReject = await activeFramework();
  const linkAfterReject = afterReject.connections.find(link => (link.kind ?? 'execution') !== 'semantic' && link.toFrame === 'expression-1');
  assert(linkAfterReject?.fromFrame === linkBeforeReject?.fromFrame, 'Incompatible connection was accepted');
  await page.keyboard.press('Control+z');

  // Semantic relation and hierarchy are reversible.
  await page.locator('[data-frame="asset-1"]').click({ position: { x: 65, y: 30 } });
  await page.locator('[data-frame="instruction-1"]').click({ modifiers: ['Shift'], position: { x: 65, y: 30 } });
  const semanticBefore = await page.locator('.connection-group.semantic').count();
  await page.locator('.relation-select').selectOption('supports');
  await page.getByRole('button', { name: 'Relate', exact: true }).click();
  assert(await page.locator('.connection-group.semantic').count() === semanticBefore + 1, 'Semantic relationship failed');
  await page.keyboard.press('Control+z');
  assert(await page.locator('.connection-group.semantic').count() === semanticBefore, 'Undo semantic relationship failed');
  await page.keyboard.press('Control+Shift+z');
  assert(await page.locator('.connection-group.semantic').count() === semanticBefore + 1, 'Redo semantic relationship failed');
  await page.keyboard.press('Control+z');
  await page.getByRole('button', { name: 'Contain selection in active Frame' }).click();
  await page.locator('[data-frame="asset-1"] .frame-parent').waitFor();
  await page.keyboard.press('Control+z');
  await sleep(100);
  assert(await page.locator('[data-frame="asset-1"] .frame-parent').count() === 0, 'Undo hierarchy failed');
  await page.keyboard.press('Control+Shift+z');
  await page.locator('[data-frame="asset-1"] .frame-parent').waitFor();
  await page.getByRole('button', { name: 'Collapse children' }).click();
  await sleep(80);
  await page.getByRole('button', { name: 'Expand children' }).click();
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');

  // Progressive execution should expose more than final state.
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await sleep(120);
  await page.evaluate(() => {
    window.__vfProgress = [];
    const capture = () => {
      const text = document.querySelector('.run-strip strong')?.textContent;
      if (text && !window.__vfProgress.includes(text)) window.__vfProgress.push(text);
    };
    const observer = new MutationObserver(capture);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    window.__vfObserver = observer;
  });
  await page.locator('.run-button').click();
  await page.getByText('PASSED', { exact: true }).first().waitFor({ timeout: 15000 });
  const progress = await page.evaluate(() => { window.__vfObserver?.disconnect(); return window.__vfProgress || []; });
  assert(progress.length >= 2 && progress.some(value => value !== '4/4'), `Progressive Run states were not visible: ${progress.join(', ')}`);

  // Each structural operation must create a Proposal before graph mutation.
  await page.locator('[data-frame="asset-1"]').click({ position: { x: 65, y: 30 } });
  await page.locator('.scope-control select').selectOption('frame');
  const operations = ['Expand', 'Reframe', 'Alternatives', 'Challenge', 'Find Missing', 'Assumptions', 'Contradictions', 'Compress'];
  for (const operation of operations) {
    const before = await frames();
    await page.getByRole('button', { name: operation, exact: true }).click();
    await page.getByRole('button', { name: 'Reject', exact: true }).waitFor({ timeout: 8000 });
    assert(await frames() === before, `${operation} changed accepted graph before approval`);
    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    await sleep(60);
    assert(await frames() === before, `${operation} rejection changed accepted graph`);
  }

  // Accept Proposal, then Undo and Redo it.
  const beforeAccept = await frames();
  await page.getByRole('button', { name: 'Reframe', exact: true }).click();
  await page.getByRole('button', { name: 'Accept Proposal', exact: true }).waitFor({ timeout: 8000 });
  await page.getByRole('button', { name: 'Accept Proposal', exact: true }).click();
  await page.getByText('QA reframe', { exact: true }).waitFor();
  assert(await frames() === beforeAccept + 1, 'Accepted Proposal did not add proposed structure');
  await page.keyboard.press('Control+z');
  await sleep(80);
  assert(await frames() === beforeAccept, 'Undo accepted Proposal failed');
  await page.keyboard.press('Control+Shift+z');
  await page.getByText('QA reframe', { exact: true }).waitFor();
  await page.keyboard.press('Control+z');

  // Linter issue must navigate to affected Frame.
  await page.getByRole('button', { name: /Issues \d+/ }).click();
  const issueButton = page.locator('.issue-list button').first();
  await issueButton.waitFor();
  await issueButton.click();
  assert(await page.locator('.frame.selected').count() >= 1, 'Linter issue did not navigate to affected Frame');

  // Goal organization is reversible.
  const goalSelect = page.locator('.goal-control select');
  await goalSelect.selectOption('compare');
  assert(await goalSelect.inputValue() === 'compare', 'Goal organization failed');
  await page.keyboard.press('Control+z');
  await sleep(80);
  assert(await goalSelect.inputValue() !== 'compare', 'Undo goal organization failed');
  await page.keyboard.press('Control+Shift+z');
  assert(await goalSelect.inputValue() === 'compare', 'Redo goal organization failed');

  // Compression creates a separate Framework and preserves source.
  await page.locator('[data-frame="asset-1"]').click({ position: { x: 65, y: 30 } });
  await page.locator('.scope-control select').selectOption('framework');
  await page.getByRole('button', { name: 'Compress', exact: true }).click();
  await page.getByRole('button', { name: 'Create Framework', exact: true }).waitFor({ timeout: 8000 });
  await page.getByRole('button', { name: 'Create Framework', exact: true }).click();
  await page.getByText('Compressed Core', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.framework-switch option').length >= 2);
  await page.locator('.framework-switch').selectOption('framework-main');
  await page.getByText('Source', { exact: true }).waitFor();

  // Offline PWA shell must reload, while online Frame execution must fail visibly offline.
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload({ waitUntil: 'networkidle' });
  }
  await page.unroute('**/api/model');
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.getByText('Visual Framework', { exact: true }).first().waitFor({ timeout: 8000 });
  await page.locator('[data-frame="instruction-1"]').click({ position: { x: 65, y: 30 } });
  await page.getByRole('button', { name: 'Run Frame', exact: true }).click();
  await page.getByText('STOPPED', { exact: true }).first().waitFor({ timeout: 8000 });
  await context.setOffline(false);

  console.log('COMPLETE MVP ACCEPTANCE PASSED');
} finally {
  await context.setOffline(false).catch(() => undefined);
  await browser.close();
}
