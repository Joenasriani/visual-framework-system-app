const MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
const MAX_INPUT_CHARS = 60000;

export const config = { maxDuration: 60 };

function textOf(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); }
  catch { return String(value); }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST ONLY' });
  }

  const apiKey = process.env.FW_API;
  if (!apiKey) {
    return res.status(503).json({ error: 'FW_API MISSING' });
  }

  const { instruction, input, title } = req.body || {};
  if (typeof instruction !== 'string' || !instruction.trim()) {
    return res.status(400).json({ error: 'INSTRUCTION MISSING' });
  }

  const inputText = textOf(input);
  if (instruction.length + inputText.length > MAX_INPUT_CHARS) {
    return res.status(413).json({ error: 'FRAME INPUT TOO LARGE' });
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const referer = host ? `${proto}://${host}` : 'https://visual-framework-system.vercel.app';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': referer,
        'X-Title': 'Visual Framework'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'Execute exactly one Frame in Visual Framework. The Frame order is authoritative. Work only from the supplied input and order. Preserve structural distinctions, alternatives, contradictions, and uncertainty when the order requires them. Do not invent certainty. Do not narrate hidden reasoning. Return only the Frame result in the structure requested by the order.'
          },
          {
            role: 'user',
            content: `FRAME: ${textOf(title) || 'Untitled'}\n\nORDER:\n${instruction.trim()}\n\nINPUT:\n${inputText || '(none)'}`
          }
        ],
        reasoning: { effort: 'medium' },
        temperature: 0.25,
        max_tokens: 1400
      })
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      if (upstream.status === 429) return res.status(429).json({ error: 'FREE LIMIT REACHED' });
      if (upstream.status === 401 || upstream.status === 403) return res.status(502).json({ error: 'FW_API REJECTED' });
      return res.status(502).json({ error: 'MODEL UNAVAILABLE' });
    }

    const output = data?.choices?.[0]?.message?.content;
    if (typeof output !== 'string' || !output.trim()) {
      return res.status(502).json({ error: 'EMPTY MODEL OUTPUT' });
    }

    return res.status(200).json({
      output: output.trim(),
      model: MODEL,
      cost: data?.usage?.cost ?? 0
    });
  } catch (error) {
    if (error?.name === 'AbortError') return res.status(504).json({ error: 'MODEL TIMEOUT' });
    return res.status(502).json({ error: 'MODEL UNAVAILABLE' });
  } finally {
    clearTimeout(timeout);
  }
}