import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = process.env.LIVE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const evidence = process.env.EVIDENCE_DIR || 'evidence/human-first';
mkdirSync(evidence, { recursive: true });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const results = [];
let failAI = false;
let calls = 0;
async function context(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', ...options });
  await ctx.route('**/api/model', async route => {
    calls += 1;
    if (failAI) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Test provider unavailable"}' });
    const input = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output: input.title.startsWith('Structural ') ? JSON.stringify({ summary: 'Consider an alternative explanation.', additions: [{ title: 'They may be busy', body: 'A late reply does not show why the reply is late.', role: 'alternative', epistemicState: 'hypothesized', relationshipToAnchor: 'alternative-to' }] }) : 'They may be busy or may not have seen the message. Ask before deciding what the silence means.', model: 'test-fixture', cost: 0 }) });
  });
  return ctx;
}
async function ready(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.locator('.app-shell').waitFor();
}
async function editItem(page, name, content) {
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Content', { exact: true }).fill(content);
  await page.keyboard.press('Escape');
  await page.locator('.inspector.panel-open').waitFor({ state: 'hidden' });
}
async function count(page, expected) {
  await page.waitForFunction(n => document.querySelectorAll('.frame').length === n, expected);
}
async function noOverlap(page) {
  const boxes = await page.locator('.frame').evaluateAll(items => items.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
  for (let a = 0; a < boxes.length; a += 1) for (let b = a + 1; b < boxes.length; b += 1) {
    const x = boxes[a], y = boxes[b];
    assert(!(x.x < y.x + y.w && x.x + x.w > y.x && x.y < y.y + y.h && x.y + x.h > y.y), `Items ${a} and ${b} overlap`);
  }
}
async function drag(page, from, to) {
  const a = await from.boundingBox(), b = await to.boundingBox();
  assert(a && b, 'Ports must be visible');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
}
try {
  const ctx = await context();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await count(page, 0);
  await page.getByRole('heading', { name: 'Start with something on your mind.' }).waitFor();
  assert(await page.locator('.run-button').isDisabled(), 'Empty Run must not pretend to work');
  assert(!(await page.getByRole('button', { name: 'Challenge', exact: true }).isVisible()), 'Advanced tools should not dominate first use');
  await page.screenshot({ path: `${evidence}/01-empty-desktop.png` });
  await page.locator('.empty-choices').getByRole('button', { name: 'Idea', exact: true }).click();
  await editItem(page, 'My interpretation', 'A friend has not replied. I think they are upset with me.');
  await page.locator('[data-guide-phase="add"]').waitFor();
  await page.getByRole('button', { name: 'Add another idea', exact: true }).click();
  await editItem(page, 'What I observed', 'I sent a message this morning. There is no reply yet.');
  await count(page, 2);
  await noOverlap(page);
  assert(calls === 0, 'Adding and editing must not silently call AI');
  await page.locator('[data-guide-phase="connect"]').waitFor();
  const frames = page.locator('.frame');
  await drag(page, frames.nth(0).locator('[data-port="out"]'), frames.nth(1).locator('[data-port="in"]'));
  await page.locator('[data-guide-phase="meaning"]').waitFor();
  await page.getByRole('button', { name: 'Choose a meaning', exact: true }).click();
  await page.locator('.inspector').getByRole('button', { name: 'Supports', exact: true }).click();
  assert(await page.locator('.connection-group.execution').count() === 1, 'Meaning must not replace the execution cable');
  assert(await page.locator('.connection-group.semantic').count() === 1, 'Meaning must remain a separate relationship');
  await page.locator('.connection-group.semantic .connection-label').filter({ hasText: 'Supports' }).waitFor();
  assert(!(await page.locator('.connection-group.semantic').getAttribute('class')).includes('selected'), 'Relationship label test must not depend on selection');
  await page.getByRole('button', { name: 'Look Another Way', exact: true }).click();
  await page.getByRole('button', { name: 'Dismiss', exact: true }).waitFor();
  await count(page, 2);
  assert(await page.locator('.inspector.panel-open').isVisible(), 'Suggestion review must open automatically');
  await page.screenshot({ path: `${evidence}/02-review-desktop.png` });
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await count(page, 2);
  await page.getByRole('button', { name: 'Look Another Way', exact: true }).click();
  await page.getByRole('button', { name: 'Apply Changes', exact: true }).click();
  await count(page, 3);
  await page.keyboard.press('Control+z');
  await count(page, 2);
  await page.keyboard.press('Control+Shift+z');
  await count(page, 3);
  await page.locator('.run-button').click();
  await page.locator('.readable-result').waitFor();
  await page.getByText('What happened in each item', { exact: true }).waitFor();
  await page.screenshot({ path: `${evidence}/03-result-desktop.png` });
  const mapId = await page.locator('.framework-switch').inputValue();
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'networkidle' });
  await count(page, 3);
  assert(await page.locator('.framework-switch').inputValue() === mapId, 'Reload must restore the same map');
  await page.getByRole('button', { name: 'Example', exact: true }).click();
  await page.locator('[data-frame="example-question"]').waitFor();
  assert(await page.locator(`.framework-switch option[value="${mapId}"]`).count() === 1, 'Opening an example must preserve existing work');
  await page.locator('.run-button').click();
  await page.locator('.readable-result .result-output').waitFor();
  assert((await page.locator('.readable-result .result-output').innerText()).includes('They may be busy'), 'Example must show the AI answer, not a true/false check');
  await page.keyboard.press('Escape');
  failAI = true;
  await page.getByRole('button', { name: 'Look Another Way', exact: true }).click();
  await page.locator('[data-guide-phase="error"]').waitFor();
  await count(page, 3);
  assert((await page.locator('.first-use-guide').innerText()).includes('could not'), 'Provider failure must have a visible explanation');
  failAI = false;
  await page.getByRole('button', { name: 'Dismiss message', exact: true }).click();
  await page.getByRole('button', { name: 'Look Another Way', exact: true }).click();
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  const colors = await page.evaluate(() => ['.topbar','.run-button','.brand-mark','.inspector'].map(selector => ({ selector, color: getComputedStyle(document.querySelector(selector)).backgroundColor })));
  for (const { selector, color } of colors) {
    const rgb = color.match(/[\d.]+/g).slice(0,3).map(Number);
    assert(Math.max(...rgb) - Math.min(...rgb) <= 18, `Decorative accent survived on ${selector}: ${color}`);
  }
  assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  results.push('Desktop: empty → edit → second item → cable → meaning → AI proposal → dismiss/apply → undo/redo → run → inspect → reload → non-destructive example → provider failure/recovery');
  await ctx.close();

  const mobile = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await mobile.newPage();
  await ready(phone);
  await phone.screenshot({ path: `${evidence}/04-empty-phone.png` });
  assert(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Phone layout overflows horizontally');
  await phone.locator('.empty-choices').getByRole('button', { name: 'Question', exact: true }).click();
  await editItem(phone, 'My question', 'Why is the reply late?');
  await phone.getByRole('button', { name: 'Add another idea', exact: true }).click();
  await editItem(phone, 'An observation', 'No reply this morning.');
  await phone.getByRole('button', { name: 'Connect items', exact: true }).click();
  const target = phone.locator('.frame').nth(1).locator('[data-port="in"]');
  await target.scrollIntoViewIfNeeded();
  assert(await target.isVisible(), 'Valid receiving dots must be visible on touch screens');
  await target.tap();
  await phone.locator('[data-guide-phase="meaning"]').waitFor();
  await phone.getByRole('button', { name: 'Not needed', exact: true }).tap();
  await phone.screenshot({ path: `${evidence}/05-connected-phone.png` });
  assert(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Connected phone layout overflows horizontally');
  results.push('Phone: empty screen, input editing, tap-to-connect, optional meaning and no page-level horizontal overflow');
  await mobile.close();

  const keyboard = await context({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  const keys = await keyboard.newPage();
  await ready(keys);
  await keys.locator('.empty-choices').getByRole('button', { name: 'Idea', exact: true }).focus();
  await keys.keyboard.press('Enter');
  await editItem(keys, 'Keyboard item', 'I can edit without dragging.');
  await keys.locator('.frame').focus();
  await keys.waitForFunction(() => document.activeElement?.classList.contains('frame'));
  await keys.keyboard.press('Enter');
  await keys.screenshot({ path: `${evidence}/06-keyboard-diagnostic.png` });
  await keys.getByLabel('Content', { exact: true }).waitFor();
  assert(await keys.getByLabel('Content', { exact: true }).inputValue() === 'I can edit without dragging.', 'Reopening the editor must preserve saved text under the same accessible field name');
  await keys.getByLabel('Content', { exact: true }).fill('Edited again using the keyboard.');
  await keys.keyboard.press('Escape');
  await keys.locator('.frame').focus();
  await keys.keyboard.press('Enter');
  assert(await keys.getByLabel('Content', { exact: true }).inputValue() === 'Edited again using the keyboard.', 'A second keyboard edit must survive reopening');
  await keys.screenshot({ path: `${evidence}/06-keyboard-tablet.png` });
  results.push('Keyboard: create and reopen item with Enter; reduced-motion layout at 1024px');
  await keyboard.close();
  writeFileSync(`${evidence}/results.json`, JSON.stringify({ automation: 'passed', humanUsability: 'NOT TESTED — requires real first-time users', liveAI: 'NOT TESTED — all model responses in this suite are mocked', tests: results }, null, 2));
  console.log('HUMAN-FIRST AUTOMATED REGRESSION PASSED. Human usability and live AI remain separate, unverified gates.');
} finally { await browser.close(); }
