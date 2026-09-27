import { chromium } from 'playwright';

const URL = process.env.LIVE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function inspect(viewport, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.locator('.app-shell').waitFor();
  return { context, page };
}

try {
  const desktop = await inspect({ width: 1440, height: 900 });
  const { page } = desktop;

  const runMotion = await page.locator('.run-button').evaluate(el => {
    const s = getComputedStyle(el);
    return { duration: s.transitionDuration, timing: s.transitionTimingFunction };
  });
  assert(!/^0s(?:, 0s)*$/.test(runMotion.duration), 'Run button has no soft transition');

  const emptyMotion = await page.locator('.empty-canvas').evaluate(el => {
    const s = getComputedStyle(el);
    return { name: s.animationName, duration: s.animationDuration };
  });
  assert(emptyMotion.name.includes('soft-surface-in'), 'Empty canvas soft entrance is missing');

  await page.locator('.empty-choices').getByRole('button', { name: 'Idea', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'AI', exact: true }).click();
  const panelMotion = await page.locator('.inspector.panel-open').evaluate(el => {
    const s = getComputedStyle(el);
    return { name: s.animationName, duration: s.animationDuration };
  });
  assert(panelMotion.name.includes('soft-panel-in'), 'Desktop inspector soft entrance is missing');
  await desktop.context.close();

  const mobile = await inspect({ width: 390, height: 844 });
  await mobile.page.locator('.empty-choices').getByRole('button', { name: 'Question', exact: true }).click();
  await mobile.page.keyboard.press('Escape');
  await mobile.page.getByRole('button', { name: 'AI', exact: true }).click();
  const mobilePanel = await mobile.page.locator('.inspector.panel-open').evaluate(el => {
    const s = getComputedStyle(el);
    return { name: s.animationName, duration: s.animationDuration };
  });
  assert(mobilePanel.name.includes('soft-panel-in-mobile'), 'Mobile inspector soft entrance is missing');
  await mobile.context.close();

  const reduced = await inspect({ width: 1024, height: 768 }, 'reduce');
  const reducedState = await reduced.page.evaluate(() => {
    const empty = getComputedStyle(document.querySelector('.empty-canvas'));
    const button = getComputedStyle(document.querySelector('.run-button'));
    return {
      animationName: empty.animationName,
      animationDuration: empty.animationDuration,
      transitionDuration: button.transitionDuration
    };
  });
  assert(reducedState.animationName === 'none' || reducedState.animationDuration === '0s', 'Reduced Motion still animates the empty canvas');
  assert(reducedState.transitionDuration.split(',').every(value => value.trim() === '0s'), 'Reduced Motion still transitions controls');
  await reduced.context.close();

  console.log('SOFT MOTION ACCEPTANCE PASSED');
} finally {
  await browser.close();
}
