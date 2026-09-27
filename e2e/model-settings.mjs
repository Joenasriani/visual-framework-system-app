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
  if (body.apiKey === 'reject-this-key') {
    return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'YOUR OPENAI API KEY WAS REJECTED' }) });
  }
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      output: body.title === 'Model connection test' ? 'CONNECTED' : 'Personal model output',
      provider: body.provider || 'vfa-free',
      model: body.model || 'managed-free-model',
      cost: 0
    })
  });
});

async function openAISettings() {
  await page.getByRole('button', { name: 'AI', exact: true }).click();
  await page.getByText('Choose how AI runs', { exact: true }).waitFor();
}

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByText('Visual Framework', { exact: true }).first().waitFor();

  await openAISettings();
  const free = page.getByRole('radio', { name: /VFA Free/ });
  assert(await free.getAttribute('aria-checked') === 'true', 'VFA Free must be the default');

  await page.getByRole('radio', { name: /OpenAI/ }).click();
  await page.getByLabel('API key', { exact: true }).fill('openai-browser-secret');
  await page.getByLabel('Model', { exact: true }).fill('gpt-5.6-luna');
  await page.getByRole('button', { name: 'Test connection', exact: true }).click();
  await page.getByText(/Connected to gpt-5\.6-luna through openai/i).waitFor();
  assert(requests.at(-1)?.provider === 'openai', 'OpenAI provider missing from browser request');
  assert(requests.at(-1)?.apiKey === 'openai-browser-secret', 'OpenAI key missing from browser request');
  await page.getByRole('button', { name: 'Use this model', exact: true }).click();

  await page.getByRole('button', { name: 'Example', exact: true }).click();
  await page.locator('[data-frame="example-question"]').waitFor();
  await page.locator('.run-button').click();
  await page.locator('.readable-result').waitFor();
  const modelDetail = page.locator('.readable-result details').filter({ hasText: 'Asked AI · openai · gpt-5.6-luna' }).first();
  await modelDetail.locator('summary').click();
  await modelDetail.getByText(/Asked AI · openai · gpt-5\.6-luna/i).waitFor();
  assert(requests.some(item => item.title !== 'Model connection test' && item.provider === 'openai'), 'Run did not use selected OpenAI settings');

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
  assert(!stored.includes('openai-browser-secret'), 'Personal API key was persisted in IndexedDB');
  assert(stored.includes('gpt-5.6-luna'), 'Run provenance should record model identity');

  await page.reload({ waitUntil: 'networkidle' });
  await openAISettings();
  assert(await page.getByRole('radio', { name: /VFA Free/ }).getAttribute('aria-checked') === 'true', 'Reload must clear personal provider settings');
  assert((await page.getByLabel('API key', { exact: true }).count()) === 0, 'Personal key field should not exist while VFA Free is active');

  await page.getByRole('radio', { name: /Claude/ }).click();
  await page.getByLabel('API key', { exact: true }).fill('claude-browser-secret');
  assert(await page.getByLabel('Model', { exact: true }).inputValue() === 'claude-sonnet-5', 'Claude current default model missing');
  await page.getByRole('button', { name: 'Test connection', exact: true }).click();
  await page.getByText(/through anthropic/i).waitFor();
  assert(requests.at(-1)?.provider === 'anthropic', 'Claude must send anthropic provider id');

  await page.getByRole('radio', { name: /OpenRouter/ }).click();
  await page.getByLabel('API key', { exact: true }).fill('router-browser-secret');
  assert(await page.getByLabel('Model', { exact: true }).inputValue() === 'openrouter/free', 'OpenRouter default model missing');
  await page.getByRole('button', { name: 'Test connection', exact: true }).click();
  await page.getByText(/through openrouter/i).waitFor();

  await page.getByRole('radio', { name: /OpenAI/ }).click();
  await page.getByLabel('API key', { exact: true }).fill('reject-this-key');
  await page.getByRole('button', { name: 'Test connection', exact: true }).click();
  await page.getByText('YOUR OPENAI API KEY WAS REJECTED', { exact: true }).waitFor();
  const rejectedIndex = requests.length - 1;
  assert(requests[rejectedIndex]?.provider === 'openai', 'Rejected request provider changed');
  await page.waitForTimeout(100);
  assert(requests.length === rejectedIndex + 1, 'Rejected BYOK request silently fell back to another model');

  const html = await page.locator('body').innerText();
  assert(!html.includes('openai-browser-secret') && !html.includes('claude-browser-secret') && !html.includes('router-browser-secret'), 'Personal key leaked into visible text');

  console.log('MODEL SETTINGS BROWSER ACCEPTANCE PASSED');
} finally {
  await browser.close();
}
