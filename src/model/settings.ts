export type ModelProvider = 'vfa-free' | 'openai' | 'anthropic' | 'openrouter';

export interface ModelSettings {
  provider: ModelProvider;
  model: string;
  apiKey: string;
}

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  'vfa-free': 'VFA Free',
  openai: 'OpenAI',
  anthropic: 'Claude',
  openrouter: 'OpenRouter'
};

export const DEFAULT_MODELS: Record<Exclude<ModelProvider, 'vfa-free'>, string> = {
  openai: 'gpt-5.6-luna',
  anthropic: 'claude-sonnet-5',
  openrouter: 'openrouter/free'
};

const FREE: ModelSettings = { provider: 'vfa-free', model: '', apiKey: '' };
let active: ModelSettings = { ...FREE };

export function getModelSettings(): ModelSettings {
  return { ...active };
}

export function setModelSettings(next: ModelSettings): ModelSettings {
  if (next.provider === 'vfa-free') {
    active = { ...FREE };
    return getModelSettings();
  }
  const model = next.model.trim();
  const apiKey = next.apiKey.trim();
  if (!model) throw new Error('Choose a model.');
  if (!apiKey) throw new Error('Enter your API key.');
  active = { provider: next.provider, model, apiKey };
  return getModelSettings();
}

export function resetModelSettings(): ModelSettings {
  active = { ...FREE };
  return getModelSettings();
}

export function modelRequestConfig(settings = active) {
  if (settings.provider === 'vfa-free') return { provider: 'vfa-free' as const };
  return {
    provider: settings.provider,
    model: settings.model,
    apiKey: settings.apiKey
  };
}

export function providerSummary(settings = active) {
  if (settings.provider === 'vfa-free') return 'VFA Free · OpenRouter';
  return `${PROVIDER_LABELS[settings.provider]} · ${settings.model || 'model not set'}`;
}
