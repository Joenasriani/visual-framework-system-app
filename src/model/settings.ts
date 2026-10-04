export type ModelProvider = 'vfa-free' | 'openrouter';

export interface ModelSettings {
  provider: ModelProvider;
  model: string;
  apiKey: string;
}

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  'vfa-free': 'VFA Free',
  openrouter: 'OpenRouter'
};

export const DEFAULT_MODELS: Record<Exclude<ModelProvider, 'vfa-free'>, string> = {
  openrouter: 'openrouter/free'
};

const FREE: ModelSettings = { provider: 'vfa-free', model: '', apiKey: '' };
let active: ModelSettings = { ...FREE };

export function isFreeOpenRouterModel(model: string): boolean {
  const value = model.trim().toLowerCase();
  return value === 'openrouter/free' || value.endsWith(':free');
}

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
  if (!model) throw new Error('Choose a free OpenRouter model.');
  if (!isFreeOpenRouterModel(model)) throw new Error('Only OpenRouter free routes are allowed. Use openrouter/free or a model ending in :free.');
  if (!apiKey) throw new Error('Enter your OpenRouter API key.');
  active = { provider: 'openrouter', model, apiKey };
  return getModelSettings();
}

export function resetModelSettings(): ModelSettings {
  active = { ...FREE };
  return getModelSettings();
}

export function modelRequestConfig(settings = active) {
  if (settings.provider === 'vfa-free') return { provider: 'vfa-free' as const };
  return {
    provider: 'openrouter' as const,
    model: settings.model,
    apiKey: settings.apiKey
  };
}

export function providerSummary(settings = active) {
  if (settings.provider === 'vfa-free') return 'VFA Free · OpenRouter';
  return `OpenRouter Free · ${settings.model || 'model not set'}`;
}
