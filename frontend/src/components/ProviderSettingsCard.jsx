export function ProviderSettingsCard({
  appMode,
  providers,
  providerStatus,
  selectedProviderId,
  selectedProviderConfig,
  model,
  onProviderChange,
  onProviderConfigChange,
  onModelChange,
  disabled,
  missingApiKey,
  title = 'Provider Settings',
  eyebrow = 'Model Access'
}) {
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);
  const selectedProviderStatus = providerStatus?.[selectedProviderId];
  const apiKeyLabel = selectedProvider?.requiresApiKey ? 'API Key' : 'API Key (Optional)';
  const selectedProviderConfigured =
    Boolean(selectedProvider?.configured) || Boolean(selectedProviderStatus?.configured);
  const isGeminiProvider = selectedProvider?.id === 'gemini';
  const usesServerDefaultAuth = selectedProviderConfigured;
  const usesServerDefaultKey =
    Boolean(selectedProvider?.requiresApiKey) && usesServerDefaultAuth;

  return (
    <div className="rounded-[28px] border border-black/10 bg-white/80 p-5 shadow-card backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-brass">{eyebrow}</p>
          <h2 className="mt-2 font-display text-2xl text-ink">{title}</h2>
        </div>
        <span className="rounded-full bg-ink px-3 py-1 text-xs uppercase tracking-[0.2em] text-white">
          {appMode || 'live'}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Provider</span>
          <select
            className="w-full rounded-2xl border border-black/10 bg-parchment px-4 py-3 text-sm text-ink outline-none transition focus:border-ember focus:ring-2 focus:ring-ember/20"
            value={selectedProviderId}
            onChange={(event) => onProviderChange(event.target.value)}
            disabled={disabled}
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Model</span>
          <input
            className="w-full rounded-2xl border border-black/10 bg-parchment px-4 py-3 text-sm text-ink outline-none transition focus:border-ember focus:ring-2 focus:ring-ember/20"
            value={model}
            onChange={(event) => onModelChange(event.target.value)}
            placeholder="Enter a model name"
            disabled={disabled}
          />
        </label>

        {selectedProvider?.supportsCustomBaseUrl ? (
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Base URL</span>
            <input
              className="w-full rounded-2xl border border-black/10 bg-parchment px-4 py-3 text-sm text-ink outline-none transition focus:border-ember focus:ring-2 focus:ring-ember/20"
              value={selectedProviderConfig?.baseUrl || ''}
              onChange={(event) => onProviderConfigChange('baseUrl', event.target.value)}
              placeholder="Enter the provider base URL"
              disabled={disabled}
            />
          </label>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">{apiKeyLabel}</span>
          <input
            className="w-full rounded-2xl border border-black/10 bg-parchment px-4 py-3 text-sm text-ink outline-none transition focus:border-ember focus:ring-2 focus:ring-ember/20"
            value={selectedProviderConfig?.apiKey || ''}
            onChange={(event) => onProviderConfigChange('apiKey', event.target.value)}
            type="password"
            placeholder={
              isGeminiProvider && usesServerDefaultAuth
                ? 'Optional Gemini API key override'
                : usesServerDefaultKey
                ? 'Optional API key override for this browser'
                : selectedProvider?.requiresApiKey
                ? 'Paste an API key to continue'
                : 'Optional API key for compatible gateways'
            }
            autoComplete="off"
            disabled={disabled}
          />
          <p className="mt-2 text-xs leading-6 text-ink/65">
            {usesServerDefaultAuth
              ? 'This browser can leave the API key field blank and use the server default auth.'
              : 'Browser-entered keys are stored locally in this browser so they persist across reloads until you clear them.'}
          </p>
        </label>
      </div>

      <div className="mt-5 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-ink/80">
        <p className="font-medium text-ink">Selected provider notes</p>
        <p className="mt-2">{selectedProviderStatus?.summary || 'Provider status unavailable.'}</p>
        <p className="mt-2">
          Server default auth: {selectedProviderConfigured ? 'available' : 'not set'}
        </p>
        <p className="mt-2">
          Default model: {selectedProviderStatus?.defaultModel || 'n/a'}
        </p>
        {selectedProvider?.supportsCustomBaseUrl ? (
          <p className="mt-2">
            Default base URL: {selectedProviderStatus?.defaultBaseUrl || 'n/a'}
          </p>
        ) : null}
        {missingApiKey ? (
          <p className="mt-2 font-medium text-ember">
            Enter an API key to continue with this provider.
          </p>
        ) : null}
      </div>
    </div>
  );
}
