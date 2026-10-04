import handler from '../api/model.js';

const originalFetch = globalThis.fetch;
const originalKey = process.env.FW_API;
const originalModel = process.env.FW_MODEL;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function invoke(body, upstream, headers = {}) {
  let captured = null;
  globalThis.fetch = async (url, options = {}) => {
    captured = {
      url: String(url),
      headers: { ...(options.headers || {}) },
      body: options.body ? JSON.parse(options.body) : null
    };
    return upstream(captured);
  };

  let statusCode = 200;
  let payload = null;
  const req = {
    method: 'POST',
    body,
    headers: {
      host: 'localhost:4173',
      'x-forwarded-proto': 'http',
      'x-forwarded-for': `test-${Math.random()}`,
      ...headers
    }
  };
  const res = {
    setHeader() {},
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return value; }
  };
  await handler(req, res);
  return { captured, statusCode, payload };
}

try {
  process.env.FW_API = 'server-free-secret';
  delete process.env.FW_MODEL;

  const free = await invoke(
    { title: 'Free', instruction: 'Answer.', input: 'x', provider: 'vfa-free', apiKey: 'must-be-ignored', model: 'must-be-ignored' },
    captured => {
      assert(captured.url === 'https://openrouter.ai/api/v1/chat/completions', 'VFA Free must use OpenRouter');
      assert(captured.headers.Authorization === 'Bearer server-free-secret', 'VFA Free must use only the server key');
      assert(captured.body.model === 'nvidia/nemotron-3-ultra-550b-a55b:free', 'VFA Free model changed unexpectedly');
      return jsonResponse({ choices: [{ message: { content: 'FREE OK' } }], usage: { cost: 0 } });
    }
  );
  assert(free.statusCode === 200 && free.payload.output === 'FREE OK', 'VFA Free response failed');
  assert(JSON.stringify(free.payload).includes('server-free-secret') === false, 'Server key leaked in response');

  const openrouter = await invoke(
    { title: 'OpenRouter', instruction: 'Answer.', input: 'x', provider: 'openrouter', apiKey: 'router-user-secret', model: 'openrouter/free' },
    captured => {
      assert(captured.url === 'https://openrouter.ai/api/v1/chat/completions', 'OpenRouter endpoint incorrect');
      assert(captured.headers.Authorization === 'Bearer router-user-secret', 'OpenRouter user key not forwarded correctly');
      assert(captured.body.model === 'openrouter/free', 'OpenRouter model not forwarded');
      assert(!('reasoning' in captured.body), 'Personal OpenRouter requests must not force managed reasoning controls');
      return jsonResponse({ choices: [{ message: { content: 'ROUTER OK' } }], usage: { cost: 0 } });
    }
  );
  assert(openrouter.payload.output === 'ROUTER OK' && openrouter.payload.provider === 'openrouter', 'OpenRouter free BYOK failed');

  const paid = await invoke(
    { title: 'Paid route', instruction: 'Answer.', input: 'x', provider: 'openrouter', apiKey: 'router-user-secret', model: 'openai/gpt-6.1-sol' },
    () => { throw new Error('Paid route reached upstream'); }
  );
  assert(paid.statusCode === 400 && paid.payload.error === 'ONLY OPENROUTER FREE ROUTES ARE ALLOWED', 'Paid OpenRouter route was not blocked');

  const otherProvider = await invoke(
    { title: 'OpenAI', instruction: 'Answer.', input: 'x', provider: 'openai', apiKey: 'secret', model: 'gpt-6.1-sol' },
    () => { throw new Error('Disallowed provider reached upstream'); }
  );
  assert(otherProvider.statusCode === 400, 'Non-OpenRouter provider was not blocked');

  const crossOrigin = await invoke(
    { title: 'Cross origin', instruction: 'Answer.', input: 'x', provider: 'vfa-free' },
    () => { throw new Error('Cross-origin request reached upstream'); },
    { origin: 'https://example.com' }
  );
  assert(crossOrigin.statusCode === 403, 'Cross-origin request was not rejected');

  console.log('FREE-ONLY MODEL PROVIDER SERVER ROUTING PASSED');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.FW_API;
  else process.env.FW_API = originalKey;
  if (originalModel === undefined) delete process.env.FW_MODEL;
  else process.env.FW_MODEL = originalModel;
}
