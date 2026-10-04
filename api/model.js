const DEFAULT_FREE_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
const FREE_MODEL = process.env.FW_MODEL || DEFAULT_FREE_MODEL;
const MAX_INPUT_CHARS = 60000;
const MAX_KEY_CHARS = 2048;
const MAX_MODEL_CHARS = 240;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = Math.max(1, Number(process.env.FW_RATE_LIMIT || 30));
const PROVIDERS = new Set(['vfa-free', 'openrouter']);

export const config = { maxDuration: 60 };

const SYSTEM_PROMPT = 'Execute exactly one Frame in Visual Framework. The Frame order is authoritative. Work only from the supplied input and order. Preserve structural distinctions, alternatives, contradictions, and uncertainty when the order requires them. Do not invent certainty. Do not narrate hidden reasoning. Return only the Frame result in the structure requested by the order.';

const rateBuckets = globalThis.__VFA_RATE_BUCKETS__ instanceof Map
  ? globalThis.__VFA_RATE_BUCKETS__
  : new Map();
globalThis.__VFA_RATE_BUCKETS__ = rateBuckets;

function textOf(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); }
  catch { return String(value); }
}

function userPrompt(title, instruction, inputText) {
  return `FRAME: ${textOf(title) || 'Untitled'}\n\nORDER:\n${instruction.trim()}\n\nINPUT:\n${inputText || '(none)'}`;
}

function isFreeOpenRouterModel(model) {
  const value = String(model || '').trim().toLowerCase();
  return value === 'openrouter/free' || value.endsWith(':free');
}

function sameOrigin(req) {
  const origin = typeof req.headers?.origin === 'string' ? req.headers.origin : '';
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) return false;
  try { return new URL(origin).host === host; }
  catch { return false; }
}

function clientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function allowRequest(ip) {
  const now = Date.now();
  const current = rateBuckets.get(ip);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= RATE_LIMIT) return false;
  current.count += 1;
  return true;
}

function openAIText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

function providerError(status) {
  if (status === 401 || status === 403) return 'YOUR OPENROUTER API KEY WAS REJECTED';
  if (status === 429) return 'YOUR OPENROUTER FREE LIMIT WAS REACHED';
  if (status === 400 || status === 404 || status === 422) return 'FREE MODEL OR REQUEST REJECTED BY OPENROUTER';
  return 'OPENROUTER UNAVAILABLE';
}

async function callOpenRouter({ apiKey, model, referer, prompt, managed, signal }) {
  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    max_tokens: 1400
  };
  if (managed) {
    body.reasoning = { effort: 'medium' };
    body.temperature = 0.25;
  }
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': referer,
      'X-Title': 'Visual Framework'
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  return {
    response,
    data,
    output: typeof data?.choices?.[0]?.message?.content === 'string' ? data.choices[0].message.content.trim() : ''
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST ONLY' });
  }
  if (!sameOrigin(req)) {
    return res.status(403).json({ error: 'CROSS ORIGIN MODEL REQUEST REJECTED' });
  }
  if (!allowRequest(clientIp(req))) {
    res.setHeader('Retry-After', String(Math.ceil(RATE_WINDOW_MS / 1000)));
    return res.status(429).json({ error: 'VFA FREE REQUEST LIMIT REACHED' });
  }

  const { instruction, input, title } = req.body || {};
  const provider = typeof req.body?.provider === 'string' ? req.body.provider : 'vfa-free';

  if (!PROVIDERS.has(provider)) {
    return res.status(400).json({ error: 'ONLY FREE OPENROUTER PROVIDERS ARE ALLOWED' });
  }
  if (typeof instruction !== 'string' || !instruction.trim()) {
    return res.status(400).json({ error: 'INSTRUCTION MISSING' });
  }

  const inputText = textOf(input);
  if (instruction.length + inputText.length > MAX_INPUT_CHARS) {
    return res.status(413).json({ error: 'FRAME INPUT TOO LARGE' });
  }

  let apiKey;
  let model;
  if (provider === 'vfa-free') {
    apiKey = process.env.FW_API;
    model = FREE_MODEL;
    if (!apiKey) return res.status(503).json({ error: 'VFA FREE MODEL IS NOT CONFIGURED' });
    if (!isFreeOpenRouterModel(model)) {
      return res.status(503).json({ error: 'VFA FREE MODEL CONFIGURATION MUST USE AN OPENROUTER FREE ROUTE' });
    }
  } else {
    apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
    model = typeof req.body?.model === 'string' ? req.body.model.trim() : '';
    if (!apiKey) return res.status(400).json({ error: 'OPENROUTER API KEY MISSING' });
    if (!model) return res.status(400).json({ error: 'FREE MODEL MISSING' });
    if (!isFreeOpenRouterModel(model)) {
      return res.status(400).json({ error: 'ONLY OPENROUTER FREE ROUTES ARE ALLOWED' });
    }
    if (apiKey.length > MAX_KEY_CHARS || model.length > MAX_MODEL_CHARS) {
      return res.status(400).json({ error: 'MODEL SETTINGS TOO LARGE' });
    }
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const referer = host ? `${proto}://${host}` : 'https://visual-framework-app.vercel.app';
  const prompt = userPrompt(title, instruction, inputText);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const result = await callOpenRouter({
      apiKey,
      model,
      referer,
      prompt,
      managed: provider === 'vfa-free',
      signal: controller.signal
    });

    if (!result.response.ok) {
      if (provider === 'vfa-free') {
        if (result.response.status === 429) return res.status(429).json({ error: 'VFA FREE LIMIT REACHED' });
        if (result.response.status === 401 || result.response.status === 403) return res.status(502).json({ error: 'VFA FREE MODEL REJECTED' });
        return res.status(502).json({ error: 'VFA FREE MODEL UNAVAILABLE' });
      }
      const status = result.response.status === 429 ? 429 : 502;
      return res.status(status).json({ error: providerError(result.response.status) });
    }

    if (!result.output) {
      return res.status(502).json({ error: 'EMPTY MODEL OUTPUT' });
    }

    return res.status(200).json({
      output: result.output,
      provider,
      model,
      cost: result.data?.usage?.cost ?? null
    });
  } catch (error) {
    if (error?.name === 'AbortError') return res.status(504).json({ error: 'MODEL TIMEOUT' });
    return res.status(502).json({ error: provider === 'vfa-free' ? 'VFA FREE MODEL UNAVAILABLE' : providerError(503) });
  } finally {
    clearTimeout(timeout);
  }
}
