const FREE_MODEL = process.env.FW_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free';
const MAX_INPUT_CHARS = 60000;
const MAX_KEY_CHARS = 2048;
const MAX_MODEL_CHARS = 240;
const PROVIDERS = new Set(['vfa-free', 'openai', 'anthropic', 'openrouter']);

export const config = { maxDuration: 60 };

const SYSTEM_PROMPT = 'Execute exactly one Frame in Visual Framework. The Frame order is authoritative. Work only from the supplied input and order. Preserve structural distinctions, alternatives, contradictions, and uncertainty when the order requires them. Do not invent certainty. Do not narrate hidden reasoning. Return only the Frame result in the structure requested by the order.';

function textOf(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); }
  catch { return String(value); }
}

function userPrompt(title, instruction, inputText) {
  return `FRAME: ${textOf(title) || 'Untitled'}\n\nORDER:\n${instruction.trim()}\n\nINPUT:\n${inputText || '(none)'}`;
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

function anthropicText(data) {
  return (Array.isArray(data?.content) ? data.content : [])
    .filter(item => item?.type === 'text' && typeof item.text === 'string')
    .map(item => item.text)
    .join('\n')
    .trim();
}

function providerError(provider, status) {
  const label = provider === 'openai' ? 'OPENAI' : provider === 'anthropic' ? 'CLAUDE' : 'OPENROUTER';
  if (status === 401 || status === 403) return `YOUR ${label} API KEY WAS REJECTED`;
  if (status === 429) return `YOUR ${label} LIMIT WAS REACHED`;
  if (status === 400 || status === 404 || status === 422) return `MODEL OR REQUEST REJECTED BY ${label}`;
  return `${label} UNAVAILABLE`;
}

async function callOpenRouter({ apiKey, model, referer, prompt, free, signal }) {
  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    max_tokens: 1400
  };
  if (free) {
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

async function callOpenAI({ apiKey, model, prompt, signal }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      instructions: SYSTEM_PROMPT,
      input: prompt,
      max_output_tokens: 1400
    })
  });
  const data = await response.json().catch(() => ({}));
  return { response, data, output: openAIText(data) };
}

async function callAnthropic({ apiKey, model, prompt, signal }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 1400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await response.json().catch(() => ({}));
  return { response, data, output: anthropicText(data) };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST ONLY' });
  }

  const { instruction, input, title } = req.body || {};
  const provider = typeof req.body?.provider === 'string' ? req.body.provider : 'vfa-free';

  if (!PROVIDERS.has(provider)) {
    return res.status(400).json({ error: 'UNKNOWN MODEL PROVIDER' });
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
  } else {
    apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
    model = typeof req.body?.model === 'string' ? req.body.model.trim() : '';
    if (!apiKey) return res.status(400).json({ error: 'API KEY MISSING' });
    if (!model) return res.status(400).json({ error: 'MODEL MISSING' });
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
    let result;
    if (provider === 'openai') {
      result = await callOpenAI({ apiKey, model, prompt, signal: controller.signal });
    } else if (provider === 'anthropic') {
      result = await callAnthropic({ apiKey, model, prompt, signal: controller.signal });
    } else {
      result = await callOpenRouter({
        apiKey,
        model,
        referer,
        prompt,
        free: provider === 'vfa-free',
        signal: controller.signal
      });
    }

    if (!result.response.ok) {
      if (provider === 'vfa-free') {
        if (result.response.status === 429) return res.status(429).json({ error: 'VFA FREE LIMIT REACHED' });
        if (result.response.status === 401 || result.response.status === 403) return res.status(502).json({ error: 'VFA FREE MODEL REJECTED' });
        return res.status(502).json({ error: 'VFA FREE MODEL UNAVAILABLE' });
      }
      const status = result.response.status === 429 ? 429 : 502;
      return res.status(status).json({ error: providerError(provider, result.response.status) });
    }

    if (!result.output) {
      return res.status(502).json({ error: 'EMPTY MODEL OUTPUT' });
    }

    return res.status(200).json({
      output: result.output,
      provider,
      model,
      cost: provider === 'openrouter' || provider === 'vfa-free' ? result.data?.usage?.cost ?? null : null
    });
  } catch (error) {
    if (error?.name === 'AbortError') return res.status(504).json({ error: 'MODEL TIMEOUT' });
    return res.status(502).json({ error: provider === 'vfa-free' ? 'VFA FREE MODEL UNAVAILABLE' : providerError(provider, 503) });
  } finally {
    clearTimeout(timeout);
  }
}
