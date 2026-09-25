import { chromium } from 'playwright';

const URL = process.env.LIVE_URL || 'https://visual-framework-system.vercel.app';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sleep = ms => page.waitForTimeout(ms);
const frameCount = () => page.locator('.frame').count();
const executionCount = () => page.locator('.connection-group.execution').count();

async function drag(from, to) {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  assert(a && b, 'Connection ports not measurable');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await sleep(120);
}

await page.route('**/api/model', async route => {
  const body = route.request().postDataJSON?.() || {};
  const title = String(body.title || 'Frame');
  await new Promise(resolve => setTimeout(resolve, title.startsWith('Structural ') ? 40 : 220));
  if (title.startsWith('Structural ')) {
    const op = title.slice('Structural '.length);
    const additions = op === 'compress'
      ? [
          { title: 'Compressed Core', body: 'Essential structure.', role: 'concept', epistemicState: 'inferred', relationshipToAnchor: 'supports' },
          { title: 'Compressed Result', body: 'Essential result.', role: 'result', epistemicState: 'inferred', relationshipToAnchor: 'supports' }
        ]
      : [{ title: `QA ${op}`, body: `Acceptance structure for ${op}.`, role: 'alternative', epistemicState: 'hypothesized', relationshipToAnchor: 'supports' }];
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ output: JSON.stringify({ summary: `QA ${op} proposal`, additions }), model: 'acceptance', cost: 0 })
    });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output: 'Mock Frame result', model: 'acceptance', cost: 0 }) });
});

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByText('Visual Framework', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await sleep(150);

  // All five Frame kinds can be created and reversed.
  const seed = await frameCount();
  for (const name of ['Data', 'Step', 'Logic', 'Check', 'Result']) {
    await page.getByRole('button', { name: new RegExp(name) }).first().click();
  }
  assert(await frameCount() === seed + 5, 'All five Frame kinds were not created');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Control+z');
  assert(await frameCount() === seed, 'Undo did not restore seed after Frame creation');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Control+Shift+z');
  assert(await frameCount() === seed + 5, 'Redo did not restore Frame creation');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Control+z');

  // Frame movement supports Undo and Redo.
  const source = page.locator('[data-frame="asset-1"]');
  const beforeMove = await source.boundingBox();
  assert(beforeMove, 'Source Frame missing');
  await page.mouse.move(beforeMove.x + 70, beforeMove.y + 30);
  await page.mouse.down();
  await page.mouse.move(beforeMove.x + 145, beforeMove.y + 75, { steps: 7 });
  await page.mouse.up();
  await sleep(150);
  const moved = await source.boundingBox();
  assert(moved && moved.x > beforeMove.x + 35, 'Frame movement failed');
  await page.keyboard.press('Control+z');
  await sleep(80);
  const undone = await source.boundingBox();
  assert(undone && Math.abs(undone.x - beforeMove.x) < 3, 'Undo Frame movement failed');
  await page.keyboard.press('Control+Shift+z');
  await sleep(80);
  const redone = await source.boundingBox();
  assert(redone && redone.x > beforeMove.x + 35, 'Redo Frame movement failed');
  await page.keyboard.press('Control+z');

  // Canvas movement, pointer anchored zoom and fit.
  const stage = page.locator('.stage');
  const box = await stage.boundingBox();
  assert(box, 'Stage missing');
  const scroll0 = await stage.evaluate(el => ({ x: el.scrollLeft, y: el.scrollTop }));
  await page.mouse.move(box.x + box.width - 35, box.y + box.height - 35);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 180, box.y + box.height - 150, { steps: 7 });
  await page.mouse.up();
  const scroll1 = await stage.evaluate(el => ({ x: el.scrollLeft, y: el.scrollTop }));
  assert(scroll0.x !== scroll1.x || scroll0.y !== scroll1.y, 'Canvas pan failed');
  const zoom0 = await page.locator('.zoom span').innerText();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -300);
  await page.keyboard.up('Control');
  await sleep(80);
  assert(await page.locator('.zoom span').innerText() !== zoom0, 'Pointer zoom failed');
  await page.getByRole('button', { name: 'Fit', exact: true }).first().click();

  // Compatible cable creation and reversal.
  const exec0 = await executionCount();
  await page.getByRole('button', { name: /Step/ }).first().click();
  const newStep = page.locator('.frame-instruction').last();
  await drag(page.locator('[data-frame="asset-1"] [data-port="out"]'), newStep.locator('[data-port="in"]'));
  assert(await executionCount() === exec0 + 1, 'Compatible cable connection failed');
  await page.keyboard.press('Control+z');
  await sleep(80);
  assert(await executionCount() === exec0, 'Undo cable connection failed');
  await page.keyboard.press('Control+Shift+z');
  await sleep(80);
  assert(await executionCount() === exec0 + 1, 'Redo cable connection failed');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');

  // Incompatible cable is rejected.
  await page.getByRole('button', { name: /Check/ }).first().click();
  const check = page.locator('.frame-check').last();
  const reject0 = await executionCount();
  await drag(check.locator('[data-port="out"]'), page.locator('[data-frame="expression-1"] [data-port="in"]'));
  assert(await executionCount() === reject0, 'Incompatible cable was accepted');
  await page.keyboard.press('Control+z');

  // Exact Resolve-style cable contract: 20px snap, invalid red preview, detach-to-delete.
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await sleep(120);
  const baseExec = await executionCount();

  await page.getByRole('button', { name: /Step/ }).first().click();
  const snapStep = page.locator('.frame-instruction').last();
  const sourceOut = page.locator('[data-frame="asset-1"] [data-port="out"]');
  const snapIn = snapStep.locator('[data-port="in"]');
  const outBox = await sourceOut.boundingBox();
  const inBox = await snapIn.boundingBox();
  assert(outBox && inBox, 'Snap test ports missing');

  await page.mouse.move(outBox.x + outBox.width / 2, outBox.y + outBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(inBox.x + inBox.width / 2 + 15, inBox.y + inBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await sleep(100);
  assert(await executionCount() === baseExec + 1, 'Cable did not snap within 20px');
  await page.keyboard.press('Control+z');
  await sleep(80);

  const rejectSnap = await executionCount();
  await page.mouse.move(outBox.x + outBox.width / 2, outBox.y + outBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(inBox.x + inBox.width / 2 + 25, inBox.y + inBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await sleep(100);
  assert(await executionCount() === rejectSnap, 'Cable snapped beyond 20px');
  await page.keyboard.press('Control+z');

  const expressionOut = page.locator('[data-frame="expression-1"] [data-port="out"]');
  const assetIn = page.locator('[data-frame="asset-1"] [data-port="in"]');
  const eo = await expressionOut.boundingBox();
  const ai = await assetIn.boundingBox();
  assert(eo && ai, 'Cycle test ports missing');
  await page.mouse.move(eo.x + eo.width / 2, eo.y + eo.height / 2);
  await page.mouse.down();
  await page.mouse.move(ai.x + ai.width / 2, ai.y + ai.height / 2, { steps: 8 });
  await page.locator('.preview-connections .wire-live.invalid').waitFor();
  await page.mouse.up();
  await sleep(80);
  assert(await executionCount() === baseExec, 'Cycle connection was accepted');

  const assetOutBox = await page.locator('[data-frame="asset-1"] [data-port="out"]').boundingBox();
  const instructionOutBox = await page.locator('[data-frame="instruction-1"] [data-port="out"]').boundingBox();
  assert(assetOutBox && instructionOutBox, 'Output-to-output test ports missing');
  await page.mouse.move(assetOutBox.x + assetOutBox.width / 2, assetOutBox.y + assetOutBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(instructionOutBox.x + instructionOutBox.width / 2, instructionOutBox.y + instructionOutBox.height / 2, { steps: 8 });
  await page.locator('.preview-connections .wire-live.invalid').waitFor();
  await page.mouse.up();
  assert(await executionCount() === baseExec, 'Output-to-output connection was accepted');

  const instructionIn = page.locator('[data-frame="instruction-1"] [data-port="in"]');
  const instructionInBox = await instructionIn.boundingBox();
  const stageForDetach = await page.locator('.stage').boundingBox();
  assert(instructionInBox && stageForDetach, 'Detach test geometry missing');
  await page.mouse.move(instructionInBox.x + instructionInBox.width / 2, instructionInBox.y + instructionInBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(stageForDetach.x + stageForDetach.width * 0.55, stageForDetach.y + stageForDetach.height * 0.72, { steps: 8 });
  await page.mouse.up();
  await sleep(100);
  assert(await executionCount() === baseExec - 1, 'Dragging a connected input to empty space did not delete the cable');
  await page.keyboard.press('Control+z');
  await sleep(80);
  assert(await executionCount() === baseExec, 'Undo did not restore detached cable');

  // Layer contract: selected nodes become one movable, resizable container.
  const layers0 = await page.locator('.layer').count();
  const nodes0 = await frameCount();
  await page.locator('[data-frame="asset-1"]').click({ position: { x: 65, y: 28 } });
  await page.locator('[data-frame="instruction-1"]').click({ modifiers: ['Shift'], position: { x: 65, y: 28 } });
  await page.getByRole('button', { name: 'Layer Selection', exact: true }).click();
  await sleep(100);
  assert(await page.locator('.layer').count() === layers0 + 1, 'Layer was not created');

  const layer = page.locator('.layer').last();
  const header = layer.locator('.layer-header');
  const beforeLayer = await layer.boundingBox();
  const beforeAsset = await page.locator('[data-frame="asset-1"]').boundingBox();
  const beforeInstruction = await page.locator('[data-frame="instruction-1"]').boundingBox();
  assert(beforeLayer && beforeAsset && beforeInstruction, 'Layer move geometry missing');
  await page.mouse.move(beforeLayer.x + 80, beforeLayer.y - 15);
  await page.mouse.down();
  await page.mouse.move(beforeLayer.x + 180, beforeLayer.y + 35, { steps: 8 });
  await page.mouse.up();
  await sleep(120);
  const movedAsset = await page.locator('[data-frame="asset-1"]').boundingBox();
  const movedInstruction = await page.locator('[data-frame="instruction-1"]').boundingBox();
  assert(movedAsset && movedInstruction && movedAsset.x > beforeAsset.x + 50 && movedInstruction.x > beforeInstruction.x + 50, 'Layer move did not move contained nodes');

  const beforeResize = await layer.boundingBox();
  const se = layer.locator('[data-layer-resize="se"]');
  const seBox = await se.boundingBox();
  assert(beforeResize && seBox, 'Layer resize handle missing');
  await page.mouse.move(seBox.x + seBox.width / 2, seBox.y + seBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(seBox.x + 90, seBox.y + 70, { steps: 7 });
  await page.mouse.up();
  await sleep(100);
  const afterResize = await layer.boundingBox();
  assert(afterResize && afterResize.width > beforeResize.width + 40 && afterResize.height > beforeResize.height + 30, 'Layer resize failed');

  await layer.locator('.layer-delete').click();
  await sleep(100);
  assert(await page.locator('.layer').count() === layers0, 'Layer delete failed');
  assert(await frameCount() === nodes0 - 2, 'Deleting a layer did not delete its contained nodes');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await sleep(120);

  // Semantic relation and hierarchy are reversible.
  await page.locator('[data-frame="asset-1"]').click({ position: { x: 65, y: 28 } });
  await page.locator('[data-frame="instruction-1"]').click({ modifiers: ['Shift'], position: { x: 65, y: 28 } });
  const sem0 = await page.locator('.connection-group.semantic').count();
  await page.locator('.relation-select').selectOption('supports');
  await page.getByRole('button', { name: 'Relate', exact: true }).click();
  assert(await page.locator('.connection-group.semantic').count() === sem0 + 1, 'Semantic relationship failed');
  await page.keyboard.press('Control+z');
  assert(await page.locator('.connection-group.semantic').count() === sem0, 'Undo semantic relationship failed');
  await page.keyboard.press('Control+Shift+z');
  assert(await page.locator('.connection-group.semantic').count() === sem0 + 1, 'Redo semantic relationship failed');
  await page.keyboard.press('Control+z');
  await page.getByRole('button', { name: 'Contain selection in active Frame' }).click();
  await page.locator('[data-frame="asset-1"] .frame-parent').waitFor();
  await page.keyboard.press('Control+z');
  await sleep(70);
  assert(await page.locator('[data-frame="asset-1"] .frame-parent').count() === 0, 'Undo hierarchy failed');
  await page.keyboard.press('Control+Shift+z');
  await page.locator('[data-frame="asset-1"] .frame-parent').waitFor();
  await page.getByRole('button', { name: 'Collapse children' }).click();
  await sleep(80);
  await page.getByRole('button', { name: 'Expand children' }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();

  // Progressive Framework execution exposes intermediate completion states.
  await page.evaluate(() => {
    window.__vfProgress = [];
    const read = () => {
      const value = document.querySelector('.run-strip strong')?.textContent;
      if (value && !window.__vfProgress.includes(value)) window.__vfProgress.push(value);
    };
    const observer = new MutationObserver(read);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    window.__vfObserver = observer;
  });
  await page.locator('.run-button').click();
  await page.getByText('PASSED', { exact: true }).first().waitFor({ timeout: 15000 });
  const progress = await page.evaluate(() => { window.__vfObserver?.disconnect(); return window.__vfProgress || []; });
  assert(progress.length >= 2 && progress.some(value => value !== '4/4'), `Progressive states missing: ${progress.join(', ')}`);

  // Every structural operation creates a pending Proposal and leaves accepted graph unchanged until approval.
  await page.locator('[data-frame="asset-1"]').click({ position: { x: 65, y: 28 } });
  await page.locator('.scope-control select').selectOption('frame');
  for (const operation of ['Expand', 'Reframe', 'Alternatives', 'Challenge', 'Find Missing', 'Assumptions', 'Contradictions', 'Compress']) {
    const before = await frameCount();
    await page.getByRole('button', { name: operation, exact: true }).click();
    await page.getByRole('button', { name: 'Reject', exact: true }).waitFor({ timeout: 8000 });
    assert(await frameCount() === before, `${operation} mutated graph before approval`);
    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    await sleep(50);
    assert(await frameCount() === before, `${operation} rejection mutated graph`);
  }

  // Proposal acceptance is reversible.
  const accept0 = await frameCount();
  await page.getByRole('button', { name: 'Reframe', exact: true }).click();
  await page.getByRole('button', { name: 'Accept Proposal', exact: true }).waitFor({ timeout: 8000 });
  await page.getByRole('button', { name: 'Accept Proposal', exact: true }).click();
  await page.getByText('QA reframe', { exact: true }).waitFor();
  assert(await frameCount() === accept0 + 1, 'Proposal acceptance failed');
  await page.keyboard.press('Control+z');
  await sleep(70);
  assert(await frameCount() === accept0, 'Undo accepted Proposal failed');
  await page.keyboard.press('Control+Shift+z');
  await page.getByText('QA reframe', { exact: true }).waitFor();
  await page.keyboard.press('Control+z');

  // Linter issue navigates to its affected Frame.
  await page.getByRole('button', { name: /Issues \d+/ }).click();
  const issue = page.locator('.issue-list button').first();
  await issue.waitFor();
  await issue.click();
  assert(await page.locator('.frame.selected').count() >= 1, 'Linter issue navigation failed');

  // Goal reorganization remains reversible.
  const goal = page.locator('.goal-control select');
  await goal.selectOption('compare');
  assert(await goal.inputValue() === 'compare', 'Goal organization failed');
  await page.keyboard.press('Control+z');
  await sleep(70);
  assert(await goal.inputValue() !== 'compare', 'Undo goal organization failed');
  await page.keyboard.press('Control+Shift+z');
  assert(await goal.inputValue() === 'compare', 'Redo goal organization failed');

  // Real Compress operation creates another Framework while preserving source.
  await page.locator('[data-frame="asset-1"]').click({ position: { x: 65, y: 28 } });
  await page.locator('.scope-control select').selectOption('framework');
  await page.getByRole('button', { name: 'Compress', exact: true }).click();
  await page.getByRole('button', { name: 'Create Framework', exact: true }).waitFor({ timeout: 8000 });
  await page.getByRole('button', { name: 'Create Framework', exact: true }).click();
  await page.getByText('Compressed Core', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.framework-switch option').length >= 2);
  await page.locator('.framework-switch').selectOption('framework-main');
  await page.getByText('Source', { exact: true }).waitFor();

  // PWA reloads offline and an online Frame fails explicitly without network.
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload({ waitUntil: 'networkidle' });
  await page.unroute('**/api/model');
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.getByText('Visual Framework', { exact: true }).first().waitFor({ timeout: 8000 });
  await page.locator('[data-frame="instruction-1"]').click({ position: { x: 65, y: 28 } });
  await page.getByRole('button', { name: 'Run Frame', exact: true }).click();
  await page.getByText('STOPPED', { exact: true }).first().waitFor({ timeout: 8000 });
  await context.setOffline(false);

  console.log('REMAINING MVP ACCEPTANCE PASSED');
} finally {
  await context.setOffline(false).catch(() => undefined);
  await browser.close();
}