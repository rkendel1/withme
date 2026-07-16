import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Check, AlertCircle, Key, Globe, Bot, Download, ExternalLink } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { useOverlayMode } from '../hooks/useOverlayMode';
import { saveLLMConfig, getLLMConfig } from '../services/llm';
import type { LLMConfig, LLMProvider } from '../types';

const PROVIDERS: { value: LLMProvider; label: string; requiresKey: boolean; defaultModel: string }[] = [
  { value: 'openai', label: 'OpenAI', requiresKey: true, defaultModel: 'gpt-4o' },
  { value: 'anthropic', label: 'Anthropic', requiresKey: true, defaultModel: 'claude-sonnet-4-20250514' },
  { value: 'openrouter', label: 'OpenRouter', requiresKey: true, defaultModel: 'anthropic/claude-sonnet-4-20250514' },
  { value: 'ollama', label: 'Ollama (Local)', requiresKey: false, defaultModel: 'llama3.2' },
  { value: 'lmstudio', label: 'LM Studio (Local)', requiresKey: false, defaultModel: 'local-model' },
  { value: 'custom', label: 'Custom OpenAI-Compatible', requiresKey: false, defaultModel: 'gpt-4o' },
];

export function Settings() {
  const { llmConfig, setLLMConfig } = useStore();
  const isOverlay = useOverlayMode();

  const [provider, setProvider] = useState<LLMProvider>(llmConfig?.provider || 'openai');
  const [apiKey, setApiKey] = useState(llmConfig?.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(llmConfig?.baseUrl || '');
  const [model, setModel] = useState(llmConfig?.model || 'gpt-4o');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProvider = PROVIDERS.find((p) => p.value === provider);

  useEffect(() => {
    async function loadConfig() {
      const config = await getLLMConfig();
      if (config) {
        setProvider(config.provider);
        setApiKey(config.apiKey || '');
        setBaseUrl(config.baseUrl || '');
        setModel(config.model);
        setLLMConfig(config);
      }
    }
    loadConfig();
  }, [setLLMConfig]);

  const handleProviderChange = (newProvider: LLMProvider) => {
    setProvider(newProvider);
    const providerConfig = PROVIDERS.find((p) => p.value === newProvider);
    if (providerConfig) {
      setModel(providerConfig.defaultModel);
    }
    setBaseUrl('');
    setSaved(false);
  };

  const handleSave = async () => {
    setError(null);
    setSaved(false);

    if (selectedProvider?.requiresKey && !apiKey.trim()) {
      setError('API key is required for this provider');
      return;
    }

    const config: LLMConfig = {
      provider,
      apiKey: apiKey.trim() || undefined,
      baseUrl: baseUrl.trim() || undefined,
      model: model.trim(),
    };

    try {
      await saveLLMConfig(config);
      setLLMConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <SettingsIcon className="w-5 h-5" />
          Settings
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-lg space-y-6">
          {/* LLM Configuration */}
          <section>
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Bot className="w-4 h-4" />
              LLM Configuration
            </h3>

            <div className="space-y-4">
              {/* Provider */}
              <div>
                <label className="block text-sm font-medium mb-1">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                             bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* API Key */}
              {selectedProvider?.requiresKey && (
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                    <Key className="w-3 h-3" />
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setSaved(false);
                    }}
                    placeholder={`Enter your ${selectedProvider.label} API key`}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                               bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Your API key is stored locally in your browser.
                  </p>
                </div>
              )}

              {/* Base URL */}
              {(provider === 'custom' || provider === 'ollama' || provider === 'lmstudio') && (
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => {
                      setBaseUrl(e.target.value);
                      setSaved(false);
                    }}
                    placeholder={
                      provider === 'ollama'
                        ? 'http://localhost:11434/v1'
                        : provider === 'lmstudio'
                        ? 'http://localhost:1234/v1'
                        : 'https://api.example.com/v1'
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                               bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Model */}
              <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="Model name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                             bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {provider === 'openai' && 'e.g., gpt-4o, gpt-4o-mini, gpt-4-turbo'}
                  {provider === 'anthropic' && 'e.g., claude-sonnet-4-20250514, claude-3-5-haiku-20241022'}
                  {provider === 'openrouter' && 'e.g., anthropic/claude-sonnet-4-20250514, openai/gpt-4o'}
                  {provider === 'ollama' && 'e.g., llama3.2, codellama, mistral'}
                  {provider === 'lmstudio' && 'Use the model name shown in LM Studio'}
                  {provider === 'custom' && 'Enter the model identifier for your API'}
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg 
                           hover:bg-blue-700 transition-colors"
              >
                {saved ? (
                  <>
                    <Check className="w-4 h-4" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </section>

          {/* About */}
          <section className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="font-medium mb-4">About RepoLens</h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <p>
                RepoLens transforms Git repositories into queryable databases using PGlite,
                enabling accurate AI-powered repository understanding while keeping your code local.
              </p>
              <p>
                <strong>Core Principles:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Browser-first</li>
                <li>Local-first</li>
                <li>Bring Your Own LLM</li>
                <li>No required account</li>
              </ul>
            </div>
          </section>

          {/* Browser Overlay - Only show when NOT already in overlay mode */}
          {!isOverlay && (
            <section className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Browser Overlay
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-3">
                <p>
                  Install the RepoLens browser overlay to add a one-click &ldquo;Ingest&rdquo; button 
                  directly on GitHub and GitLab repository pages.
                </p>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">Installation Steps:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-blue-600 dark:text-blue-400">
                    <li>
                      Install a userscript manager like{' '}
                      <a 
                        href="https://www.tampermonkey.net/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        Tampermonkey
                      </a>{' '}
                      or{' '}
                      <a 
                        href="https://violentmonkey.github.io/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        Violentmonkey
                      </a>
                    </li>
                    <li>Click the install button below</li>
                    <li>Confirm the installation in your userscript manager</li>
                  </ol>
                </div>

                <a
                  href="/userscript/repolens.user.js"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg 
                             hover:bg-green-700 transition-colors font-medium"
                >
                  <Download className="w-4 h-4" />
                  Install Browser Overlay
                  <ExternalLink className="w-3 h-3" />
                </a>

                <p className="text-xs text-gray-500">
                  The overlay adds a &ldquo;🔍 RepoLens&rdquo; button to repository pages, allowing 
                  you to ingest any repository with a single click.
                </p>
              </div>
            </section>
          )}

          {/* Overlay Mode Indicator - Only show when IN overlay mode */}
          {isOverlay && (
            <section className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="font-medium mb-4 flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check className="w-4 h-4" />
                Overlay Mode Active
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>
                  You&apos;re currently using RepoLens through the browser overlay.
                  All features are available in this mode.
                </p>
                <p className="text-xs text-gray-500">
                  Tip: Use the minimize button in the overlay header to save screen space while keeping RepoLens accessible.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
