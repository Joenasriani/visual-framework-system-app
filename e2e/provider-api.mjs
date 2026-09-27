import handler from '../api/model.js';

const originalFetch = globalThis.fetch;
const originalKey = process.env.FW_API;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function invoke(body, upstream) {
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
    headers: { host: 'localhost:4173', 'x-forwarded-proto': 'http' }
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

  const openai = await invoke(
    { title: 'OpenAI', instruction: 'Answer.', input: 'x', provider: 'openai', apiKey: 'openai-user-secret', model: 'gpt-5.6-luna' },
    captured => {
      assert(captured.url === 'https://api.openai.com/v1/responses', 'OpenAI must use Responses API');
      assert(captured.headers.Authorization === 'Bearer openai-user-secret', 'OpenAI user key not forwarded correctly');
      assert(captured.body.model === 'gpt-5.6-luna', 'OpenAI model not forwarded');
      assert(!('apiKey' in captured.body), 'API key must not be placed in provider JSON body');
      return jsonResponse({ output_text: 'OPENAI OK' });
    }
  );
  assert(openai.payload.provider === 'openai' && openai.payload.model === 'gpt-5.6-luna', 'OpenAI provenance missing');
  assert(JSON.stringify(openai.payload).includes('openai-user-secret') === false, 'OpenAI key leaked in response');

  const anthropic = await invoke(
    { title: 'Claude', instruction: 'Answer.', input: 'x', provider: 'anthropic', apiKey: 'claude-user-secret', model: 'claude-sonnet-5' },
    captured => {
      assert(captured.url === 'https://api.anthropic.com/v1/messages', 'Claude must use Anthropic Messages API');
      assert(captured.headers['x-api-key'] === 'claude-user-secret', 'Claude user key not forwarded correctly');
      assert(captured.headers['anthropic-version'] === '2023-06-01', 'Anthropic API version missing');
      assert(captured.body.model === 'claude-sonnet-5', 'Claude model not forwarded');
      return jsonResponse({ content: [{ type: 'text', text: 'CLAUDE OK' }] });
    }
  );
  assert(anthropic.payload.output === 'CLAUDE OK' && anthropic.payload.provider === 'anthropic', 'Claude response parsing failed');

  const openrouter = await invoke(
    { title: 'OpenRouter', instruction: 'Answer.', input: 'x', provider: 'openrouter', apiKey: 'router-user-secret', model: 'openrouter/free' },
    captured => {
      assert(captured.url === 'https://openrouter.ai/api/v1/chat/completions', 'OpenRouter endpoint incorrect');
      assert(captured.headers.Authorization === 'Bearer router-user-secret', 'OpenRouter user key not forwarded correctly');
      assert(captured.body.model === 'openrouter/free', 'OpenRouter model not forwarded');
      assert(!('reasoning' in captured.body), 'Personal OpenRouter requests must not force provider-specific reasoning controls');
      return jsonResponse({ choices: [{ message: { content: 'ROUTER OK' } }], usage: { cost: 0 } });
    }
  );
  assert(openrouter.payload.output === 'ROUTER OK' && openrouter.payload.provider === 'openrouter', 'OpenRouter BYOK failed');

  let calls = 0;
  const rejected = await invoke(
    { title: 'Rejected', instruction: 'Answer.', input: 'x', provider: 'openai', apiKey: 'bad-secret', model: 'gpt-5.6-luna' },
    () => { calls += 1; return jsonResponse({ error: { message: 'bad key' } }, 401); }
  );
  assert(calls === 1, 'A rejected personal provider must not silently fall back');
  assert(rejected.statusCode === 502 && rejected.payload.error === 'YOUR OPENAI API KEY WAS REJECTED', 'Rejected key error is unclear');
  assert(JSON.stringify(rejected.payload).includes('bad-secret') === false, 'Rejected key leaked in response');

  console.log('MODEL PROVIDER SERVER ROUTING PASSED');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.FW_API;
  else process.env.FW_API = originalKey;
}
