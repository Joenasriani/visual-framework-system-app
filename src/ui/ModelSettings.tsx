import { useState } from 'react';
import {
  DEFAULT_MODELS,
  getModelSettings,
  modelRequestConfig,
  PROVIDER_LABELS,
  resetModelSettings,
  setModelSettings,
  type ModelProvider,
  type ModelSettings
} from '../model/settings';

const PERSONAL_PROVIDERS: Exclude<ModelProvider, 'vfa-free'>[] = ['openai', 'anthropic', 'openrouter'];

export function ModelSettingsInspector({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [draft, setDraft] = useState<ModelSettings>(() => getModelSettings());
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const selectProvider = (provider: ModelProvider) => {
    setMessage('');
    setTestState('idle');
    if (provider === 'vfa-free') {
      setDraft({ provider, model: '', apiKey: '' });
      return;
    }
    setDraft(current => ({
      provider,
      apiKey: current.provider === provider ? current.apiKey : '',
      model: current.provider === provider && current.model ? current.model : DEFAULT_MODELS[provider]
    }));
  };

  const save = () => {
    try {
      const saved = setModelSettings(draft);
      setDraft(saved);
      setMessage(saved.provider === 'vfa-free'
        ? 'VFA Free is active.'
        : `${PROVIDER_LABELS[saved.provider]} is active for this page.`);
      setTestState('idle');
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save model settings.');
      setTestState('error');
    }
  };

  const useFree = () => {
    const saved = resetModelSettings();
    setDraft(saved);
    setMessage('VFA Free is active.');
    setTestState('idle');
    onChanged();
  };

  const test = async () => {
    if (draft.provider === 'vfa-free') {
      setMessage('VFA Free is already configured by the app.');
      setTestState('ok');
      return;
    }
    if (!draft.apiKey.trim() || !draft.model.trim()) {
      setMessage('Enter a key and model before testing.');
      setTestState('error');
      return;
    }
    setTestState('testing');
    setMessage('Testing a small request…');
    try {
      const response = await fetch('/api/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Model connection test',
          instruction: 'Reply with exactly: CONNECTED',
          input: 'Connection test only.',
          ...modelRequestConfig(draft)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Connection test failed.');
      setMessage(`Connected to ${data?.model || draft.model} through ${data?.provider || PROVIDER_LABELS[draft.provider]}.`);
      setTestState('ok');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Connection test failed.');
      setTestState('error');
    }
  };

  return <>
    <div className="inspector-head">
      <div><span>AI MODEL</span><strong>Choose how AI runs</strong></div>
      <button className="close-inspector" aria-label="Close editor" onClick={onClose}>×</button>
    </div>

    <p className="proposal-summary">VFA Free works immediately. Or use your own provider key and model. Changing this setting never changes your map.</p>

    <div className="model-provider-list" role="radiogroup" aria-label="AI provider">
      <button type="button" role="radio" aria-checked={draft.provider === 'vfa-free'} className={draft.provider === 'vfa-free' ? 'active' : ''} onClick={() => selectProvider('vfa-free')}>
        <strong>VFA Free</strong><small>Our connected OpenRouter free model · no setup</small>
      </button>
      {PERSONAL_PROVIDERS.map(provider => (
        <button type="button" role="radio" aria-checked={draft.provider === provider} key={provider} className={draft.provider === provider ? 'active' : ''} onClick={() => selectProvider(provider)}>
          <strong>{PROVIDER_LABELS[provider]}</strong><small>Use my own API key</small>
        </button>
      ))}
    </div>

    {draft.provider !== 'vfa-free' && <>
      <label className="field">
        <span>API key</span>
        <input
          aria-label="API key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={draft.apiKey}
          onChange={event => { setDraft(current => ({ ...current, apiKey: event.target.value })); setTestState('idle'); setMessage(''); }}
          placeholder="Paste your key"
        />
      </label>
      <label className="field">
        <span>Model</span>
        <input
          aria-label="Model"
          value={draft.model}
          onChange={event => { setDraft(current => ({ ...current, model: event.target.value })); setTestState('idle'); setMessage(''); }}
          placeholder={DEFAULT_MODELS[draft.provider]}
          spellCheck={false}
        />
      </label>
      <p className="model-privacy-note">Your key is kept only in this page's memory and sent to the VFA server only when a request runs. It is not written to your framework, IndexedDB, exports, run text, or provenance. Reloading clears it. Your provider may charge your account.</p>
      <p className="model-privacy-note">If your provider fails, VFA stops and tells you. It does not silently fall back to VFA Free.</p>
    </>}

    {message && <p className={`model-test-state model-test-${testState}`} role="status">{message}</p>}

    <div className="model-actions">
      {draft.provider !== 'vfa-free' && <button className="panel-action" type="button" disabled={testState === 'testing'} onClick={() => void test()}>{testState === 'testing' ? 'Testing…' : 'Test connection'}</button>}
      <button className="inspector-run" type="button" onClick={draft.provider === 'vfa-free' ? useFree : save}>{draft.provider === 'vfa-free' ? 'Use VFA Free' : 'Use this model'}</button>
      {draft.provider !== 'vfa-free' && <button className="delete-btn" type="button" onClick={useFree}>Back to VFA Free</button>}
    </div>
  </>;
}
