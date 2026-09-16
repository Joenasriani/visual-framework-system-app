import { chromium } from 'playwright';

const URL = process.env.LIVE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 960 } });
const page = await context.newPage();
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sleep = ms => page.waitForTimeout(ms);

await page.route('**/api/model', async route => {
  const body = route.request().postDataJSON?.() || {};
  const title = String(body.title || 'Frame');
  if (title.startsWith('Structural ')) {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ output: JSON.stringify({ summary: 'Acceptance proposal', additions: [] }), model: 'acceptance', cost: 0 })
    });
  }
  await new Promise(resolve => setTimeout(resolve, 90));
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output: `Mock result: ${title}`, model: 'acceptance', cost: 0 }) });
});

async function reset() {
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await sleep(100);
}

async function selectFrames(ids) {
  for (let index = 0; index < ids.length; index++) {
    await page.locator(`[data-frame="${ids[index]}"]`).click({ modifiers: index ? ['Shift'] : [], position: { x: 70, y: 28 } });
  }
}

async function createChain(ids, type, mode) {
  await selectFrames(ids);
  await page.locator('.chain-type-select').selectOption(type);
  if (mode) await page.locator('.execution-mode-select').selectOption(mode);
  await page.getByRole('button', { name: 'Chain', exact: true }).click();
  await page.getByText('CHAIN', { exact: true }).last().waitFor();
}

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByText('Visual Framework', { exact: true }).first().waitFor();
  await reset();

  // Final MVP exposes every locked topology while keeping execution mode independent.
  await selectFrames(['asset-1', 'instruction-1']);
  const chainOptions = await page.locator('.chain-type-select option').evaluateAll(options => options.map(option => option.value));
  for (const required of ['sequence','branch','merge','diamond','parallel','hierarchy','contain','nested','nested-branch','cascade','conditional','gate','reciprocal','feedback','network','recursive-framework','freeform']) {
    assert(chainOptions.includes(required), `Missing chain constructor: ${required}`);
  }
  const executionOptions = await page.locator('.execution-mode-select option').evaluateAll(options => options.map(option => option.value));
  for (const required of ['sequential','parallel','ordered-parallel','conditional','manual','iterative']) {
    assert(executionOptions.includes(required), `Missing execution mode: ${required}`);
  }

  // Chain creation is one action, selects the whole chain, and is reversible.
  await page.locator('.chain-type-select').selectOption('sequence');
  await page.locator('.execution-mode-select').selectOption('sequential');
  await page.getByRole('button', { name: 'Chain', exact: true }).click();
  await page.getByText('CHAIN', { exact: true }).last().waitFor();
  assert((await page.locator('.framework-heading').innerText()).includes('1 chains'), 'Sequence chain was not registered');
  await page.keyboard.press('Control+z');
  await sleep(70);
  assert((await page.locator('.framework-heading').innerText()).includes('0 chains'), 'Undo did not remove chain construction');
  await page.keyboard.press('Control+Shift+z');
  await page.getByText('CHAIN', { exact: true }).last().waitFor();

  // Recursive Framework is a real typed Frame, not a visual-only grouping.
  await reset();
  await createChain(['asset-1', 'instruction-1'], 'recursive-framework', 'sequential');
  assert(await page.locator('.frame-framework').count() === 1, 'Recursive Framework container was not created');
  await page.keyboard.press('Control+z');
  await sleep(70);
  assert(await page.locator('.frame-framework').count() === 0, 'Recursive Framework was not reversible');

  // Parallel topology with parallel execution runs and remains separately identifiable.
  await reset();
  await createChain(['asset-1', 'instruction-1', 'expression-1', 'output-1'], 'parallel', 'parallel');
  assert((await page.locator('.chain-inspector-preview').innerText()).includes('⇢'), 'Parallel topology preview missing');
  await page.getByRole('button', { name: 'Run Chain', exact: true }).click();
  await page.getByText('PASSED', { exact: true }).first().waitFor({ timeout: 12000 });
  assert(await page.locator('.connection-group.chain-parallel').count() >= 2, 'Parallel chain edges were not typed visually');

  // Unchanged rerun reuses dependency-identical work.
  await page.locator('.run-button').click();
  await page.getByText('PASSED', { exact: true }).first().waitFor({ timeout: 12000 });
  await sleep(80);
  const firstReuse = await page.locator('.run-strip em').count();
  assert(firstReuse === 1, 'Dependency cache reuse was not surfaced on unchanged rerun');

  // Editing one downstream Frame preserves unaffected upstream output and invalidates descendants.
  await page.locator('[data-frame="instruction-1"]').click({ position: { x: 70, y: 28 } });
  const stepTextarea = page.locator('.inspector textarea').first();
  await stepTextarea.fill('Transform the input using the revised instruction.');
  await page.locator('.run-button').click();
  await page.getByText('PASSED', { exact: true }).first().waitFor({ timeout: 12000 });
  await page.getByRole('button', { name: /Runs \d+/ }).click();
  const runArticles = page.locator('.run-detail article');
  const sourceArticle = runArticles.filter({ hasText: 'asset-1' }).first();
  const stepArticle = runArticles.filter({ hasText: 'instruction-1' }).first();
  assert((await sourceArticle.innerText()).includes('CACHED'), 'Unaffected upstream Frame was recomputed instead of reused');
  assert((await stepArticle.innerText()).includes('OK'), 'Changed Frame did not recompute');

  // Frame compositing keeps Disable and Bypass distinct from Delete and is reversible.
  await page.locator('[data-frame="instruction-1"]').click({ position: { x: 70, y: 28 } });
  await page.getByRole('button', { name: 'Bypass', exact: true }).last().click();
  assert(await page.locator('[data-frame="instruction-1"].frame-bypassed').count() === 1, 'Bypass state not applied');
  await page.getByRole('button', { name: 'Active', exact: true }).click();
  assert(await page.locator('[data-frame="instruction-1"].frame-bypassed').count() === 0, 'Bypass state did not restore');

  // Addressable instruction fragments can be masked without deleting source text.
  const fragmentSelect = page.locator('.fragment select').first();
  await fragmentSelect.selectOption('masked');
  assert(await page.locator('.fragment-masked').count() >= 1, 'Instruction fragment mask was not represented');
  assert((await page.locator('.fragment-masked p').first().innerText()).includes('revised instruction'), 'Masked source text was destroyed');
  await fragmentSelect.selectOption('active');

  // Counterfactual execution preserves the canonical Framework and reports downstream change.
  await page.getByRole('button', { name: 'Run Without This Frame', exact: true }).click();
  await page.getByText('PASSED', { exact: true }).first().waitFor({ timeout: 12000 });
  await page.getByText('WHAT IF', { exact: true }).first().waitFor();
  assert(await page.locator('.counterfactual-summary').count() === 1, 'Counterfactual comparison summary missing');
  assert(await page.locator('[data-frame="instruction-1"]').count() === 1, 'Counterfactual destroyed the canonical Frame');

  // Controlled feedback is iterative and bounded rather than accepted as an arbitrary cycle.
  await reset();
  await page.getByRole('button', { name: /Step/ }).first().click();
  const newStepId = await page.locator('.frame-instruction').last().getAttribute('data-frame');
  assert(newStepId, 'Could not create second executable Step');
  await createChain(['instruction-1', newStepId], 'feedback', 'iterative');
  const iterationInput = page.locator('.inspector input[type="number"]');
  await iterationInput.fill('2');
  await page.getByRole('button', { name: 'Run Chain', exact: true }).click();
  await page.getByText('PASSED', { exact: true }).first().waitFor({ timeout: 12000 });
  await page.getByRole('button', { name: /Runs \d+/ }).click();
  assert(await page.getByText(/iteration 2/i).count() >= 1, 'Bounded feedback did not expose its second iteration');
  assert(await page.getByText(/iteration 3/i).count() === 0, 'Feedback exceeded configured iteration limit');

  // Inspector panel is user-resizable in the final MVP interaction layer.
  const resizeMode = await page.locator('.inspector').evaluate(element => getComputedStyle(element).resize);
  assert(resizeMode === 'horizontal', `Inspector is not horizontally resizable: ${resizeMode}`);

  // Scope compositing exposes branch/descendant targeting and can restore state.
  await reset();
  await page.locator('[data-frame="instruction-1"]').click({ position: { x: 70, y: 28 } });
  await page.locator('.scope-control select').selectOption('descendants');
  await page.locator('.compose-control select').selectOption('disable');
  await page.locator('.compose-control').getByRole('button', { name: 'Apply', exact: true }).click();
  assert(await page.locator('.frame-disabled').count() >= 1, 'Scoped descendant disable did not affect downstream Frames');
  await page.locator('.compose-control').getByRole('button', { name: 'Restore', exact: true }).click();
  assert(await page.locator('.frame-disabled').count() === 0, 'Scoped composition restore failed');

  console.log('FINAL MVP V1 ACCEPTANCE PASSED');
} finally {
  await browser.close();
}
