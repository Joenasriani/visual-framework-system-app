import { chromium } from 'playwright';

const URL = process.env.LIVE_URL || 'https://visual-framework-app.vercel.app';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByText('Visual Framework', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();

  // First-use rail: five general-purpose choices, no specialist setup required.
  for (const label of ['Idea', 'Question', 'Observation', 'Assumption', 'Evidence']) {
    await page.getByText(label, { exact: true }).first().waitFor();
  }

  // Thinking tools use plain action language.
  for (const label of ['Add Detail', 'Look Another Way', 'Find Alternatives', 'Challenge', "What's Missing?", 'Find Assumptions', 'Find Conflicts', 'Simplify']) {
    await page.getByRole('button', { name: label, exact: true }).waitFor();
  }
  await page.getByText('APPLY TO', { exact: true }).waitFor();
  await page.getByText('I WANT TO', { exact: true }).waitFor();

  // More items stays plain-language and does not display the technical source vocabulary.
  await page.getByRole('button', { name: /More items/ }).click();
  await page.getByText('Choose an item', { exact: true }).waitFor();
  const libraryText = await page.locator('.inspector').innerText();
  assert(!/Human Sciences|cognitive appraisal|interoceptive|proposition \/ claim|epistemic/i.test(libraryText), 'Advanced vocabulary leaked into the beginner item library');
  await page.keyboard.press('Escape');

  // Two selected items expose a small quick relationship set.
  await page.locator('[data-frame="asset-1"]').click({ position: { x: 60, y: 28 } });
  await page.locator('[data-frame="instruction-1"]').click({ modifiers: ['Shift'], position: { x: 60, y: 28 } });
  const options = await page.locator('.relation-select option').allTextContents();
  assert(options.length === 7, `Expected 7 quick connection choices, found ${options.length}`);
  for (const label of ['Supports', 'Conflicts With', 'Depends On', 'May Cause', 'Influences', 'Is Part Of', 'Another View Of']) {
    assert(options.includes(label), `Missing quick connection choice: ${label}`);
  }

  // Editing an item uses plain terms and exposes the simple run action.
  await page.locator('[data-frame="asset-1"]').click({ position: { x: 60, y: 28 } });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByText('This is a', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Ask AI', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Run This Item', exact: true }).waitFor();

  const bodyText = await page.locator('body').innerText();
  for (const banned of ['External Response System', 'Relationship Library', 'Element Library', 'Scientific precision']) {
    assert(!bodyText.includes(banned), `Old specialist UI leaked into MVP: ${banned}`);
  }

  console.log('BEGINNER MVP ACCEPTANCE PASSED');
} finally {
  await browser.close();
}
