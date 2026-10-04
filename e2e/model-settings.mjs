import { chromium } from 'playwright';

const URL = process.env.LIVE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const requests = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };

await page.route('**/api/model', async route => {
  const body = route.request().postDataJSON?.() || {};
  requests.push(body);
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      output: body.title === 'Model connection test' ? 'CONNECTED' : 'Personal free model output',
      provider: body.provider || 'vfa-free',
      model: body.model || 'managed-free-model',
      cost: 0
    })
  });
});

async function openAISettings() {
  await page.getByRole('button', { name: 'AI', exact: true }).click();
  await page.getByText('Choose how free AI runs', { exact: true }).waitFor();
}

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByText('Visual Framework', { exact: true }).first().waitFor();

  await openAISettings();
  const free = page.getByRole('radio', { name: /VFA Free/ });
  assert(await free.getAttribute('aria-checked') === 'true', 'VFA Free must be the default');
  assert((await page.getByRole('radio', { name: /OpenAI|Claude/ }).count()) === 0, 'Paid providers must not be exposed');

  await page.getByRole('radio', { name: /OpenRouter Free/ }).click();
  await page.getByLabel('API key', { exact: true }).fill('router-browser-secret');
  await page.getByLabel('Model', { exact: true }).fill('openrouter/free');
  await page.getByRole('button', { name: 'Test connection', exact: true }).click();
  await page.getByText(/Connected to openrouter\/free through OpenRouter free routing/i).waitFor();
  assert(requests.at(-1)?.provider === 'openrouter', 'OpenRouter provider missing from browser request');
  assert(requests.at(-1)?.apiKey === 'router-browser-secret', 'OpenRouter key missing from browser request');
  await page.getByRole('button', { name: 'Use this free model', exact: true }).click();

  await page.getByRole('button', { name: 'Example', exact: true }).click();
  await page.locator('[data-frame="example-question"]').waitFor();
  await page.locator('.run-button').click();
  await page.locator('.readable-result').waitFor();
  const modelDetail = page.locator('.readable-result details').filter({ hasText: 'Asked AI · openrouter · openrouter/free' }).first();
  await modelDetail.locator('summary').click();
  await modelDetail.getByText(/Asked AI · openrouter · openrouter\/free/i).waitFor();
  assert(requests.some(item => item.title !== 'Model connection test' && item.provider === 'openrouter'), 'Run did not use selected OpenRouter free settings');

  const stored = await page.evaluate(async () => {
    const request = indexedDB.open('visual-framework');
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const names = Array.from(db.objectStoreNames);
    const all = {};
    for (const name of names) {
      all[name] = await new Promise((resolve, reject) => {
        const tx = db.transaction(name, 'readonly');
        const req = tx.objectStore(name).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    db.close();
    return JSON.stringify(all);
  });
  assert(!stored.includes('router-browser-secret'), 'Personal API key was persisted in IndexedDB');
  assert(stored.includes('openrouter/free'), 'Run provenance should record free model identity');

  await page.reload({ waitUntil: 'networkidle' });
  await openAISettings();
  assert(await page.getByRole('radio', { name: /VFA Free/ }).getAttribute('aria-checked') === 'true', 'Reload must clear personal provider settings');

  await page.getByRole('radio', { name: /OpenRouter Free/ }).click();
  await page.getByLabel('API key', { exact: true }).fill('router-browser-secret');
  await page.getByLabel('Model', { exact: true }).fill('openai/gpt-6.1-sol');
  await page.getByRole('button', { name: 'Use this free model', exact: true }).click();
  await page.getByText(/Only OpenRouter free routes are allowed/i).waitFor();

  const html = await page.locator('body').innerText();
  assert(!html.includes('router-browser-secret'), 'Personal key leaked into visible text');

  console.log('FREE-ONLY MODEL SETTINGS BROWSER ACCEPTANCE PASSED');
} finally {
  await browser.close();
}
