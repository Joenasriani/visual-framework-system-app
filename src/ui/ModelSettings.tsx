import { useState } from 'react';
import {
  DEFAULT_MODELS,
  getModelSettings,
  modelRequestConfig,
  PROVIDER_LABELS,
  resetModelSettings,
  setModelSettings,
  type ModelSettings
} from '../model/settings';

export function ModelSettingsInspector({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [draft, setDraft] = useState<ModelSettings>(() => getModelSettings());
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const selectProvider = (provider: ModelSettings['provider']) => {
    setMessage('');
    setTestState('idle');
    if (provider === 'vfa-free') {
      setDraft({ provider, model: '', apiKey: '' });
      return;
    }
    setDraft(current => ({
      provider: 'openrouter',
      apiKey: current.provider === 'openrouter' ? current.apiKey : '',
      model: current.provider === 'openrouter' && current.model ? current.model : DEFAULT_MODELS.openrouter
    }));
  };

  const save = () => {
    try {
      const saved = setModelSettings(draft);
      setDraft(saved);
      setMessage(saved.provider === 'vfa-free'
        ? 'VFA Free is active.'
        : `${PROVIDER_LABELS[saved.provider]} free route is active for this page.`);
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
    let config;
    try {
      config = modelRequestConfig(setModelSettings(draft));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Choose a valid free OpenRouter route.');
      setTestState('error');
      return;
    }
    setTestState('testing');
    setMessage('Testing a small free request…');
    try {
      const response = await fetch('/api/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Model connection test',
          instruction: 'Reply with exactly: CONNECTED',
          input: 'Connection test only.',
          ...config
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Connection test failed.');
      setMessage(`Connected to ${data?.model || draft.model} through OpenRouter free routing.`);
      setTestState('ok');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Connection test failed.');
      setTestState('error');
    }
  };

  return <>
    <div className="inspector-head">
      <div><span>AI MODEL</span><strong>Choose how free AI runs</strong></div>
      <button className="close-inspector" aria-label="Close editor" onClick={onClose}>×</button>
    </div>

    <p className="proposal-summary">VFA Free works immediately. You can also use your own OpenRouter key, but VFA accepts only free OpenRouter routes.</p>

    <div className="model-provider-list" role="radiogroup" aria-label="AI provider">
      <button type="button" role="radio" aria-label="VFA Free" aria-checked={draft.provider === 'vfa-free'} className={draft.provider === 'vfa-free' ? 'active' : ''} onClick={() => selectProvider('vfa-free')}>
        <strong>VFA Free</strong><small>Managed OpenRouter free model · no setup</small>
      </button>
      <button type="button" role="radio" aria-label="OpenRouter Free" aria-checked={draft.provider === 'openrouter'} className={draft.provider === 'openrouter' ? 'active' : ''} onClick={() => selectProvider('openrouter')}>
        <strong>OpenRouter Free</strong><small>Use my own key · free routes only</small>
      </button>
    </div>

    {draft.provider === 'openrouter' && <>
      <label className="field">
        <span>OpenRouter API key</span>
        <input
          aria-label="API key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={draft.apiKey}
          onChange={event => { setDraft(current => ({ ...current, apiKey: event.target.value })); setTestState('idle'); setMessage(''); }}
          placeholder="Paste your OpenRouter key"
        />
      </label>
      <label className="field">
        <span>Free model</span>
        <input
          aria-label="Model"
          value={draft.model}
          onChange={event => { setDraft(current => ({ ...current, model: event.target.value })); setTestState('idle'); setMessage(''); }}
          placeholder={DEFAULT_MODELS.openrouter}
          spellCheck={false}
        />
      </label>
      <p className="model-privacy-note">Allowed values are <code>openrouter/free</code> or an OpenRouter model id ending in <code>:free</code>. Paid routes are rejected by both the browser settings and the server.</p>
      <p className="model-privacy-note">Your key is kept only in this page's memory and sent to the VFA server only when a request runs. It is not written to your framework, IndexedDB, exports, run text, or provenance. Reloading clears it.</p>
      <p className="model-privacy-note">If OpenRouter fails, VFA stops and tells you. It does not silently fall back to another model.</p>
    </>}

    {message && <p className={`model-test-state model-test-${testState}`} role="status">{message}</p>}

    <div className="model-actions">
      {draft.provider === 'openrouter' && <button className="panel-action" type="button" disabled={testState === 'testing'} onClick={() => void test()}>{testState === 'testing' ? 'Testing…' : 'Test connection'}</button>}
      <button className="inspector-run" type="button" onClick={draft.provider === 'vfa-free' ? useFree : save}>{draft.provider === 'vfa-free' ? 'Use VFA Free' : 'Use this free model'}</button>
      {draft.provider === 'openrouter' && <button className="delete-btn" type="button" onClick={useFree}>Back to VFA Free</button>}
    </div>
  </>;
}
