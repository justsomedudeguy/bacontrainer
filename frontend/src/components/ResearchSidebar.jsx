import { ProviderSettingsCard } from './ProviderSettingsCard.jsx';

export function ResearchSidebar({
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
  courtlistenerStatus,
  courtlistenerConfig,
  onCourtListenerConfigChange
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-black/10 bg-white/80 p-5 shadow-card backdrop-blur">
        <p className="text-xs uppercase tracking-[0.24em] text-brass">Research Sources</p>
        <h2 className="mt-2 font-display text-2xl text-ink">CourtListener Grounding</h2>

        <div className="mt-5 rounded-2xl border border-black/10 bg-parchment/70 p-4 text-sm text-ink/80">
          <p className="font-medium text-ink">Automatic retrieval</p>
          <p className="mt-2">
            The chat automatically routes questions across case law, PACER dockets and filings, judges, and oral arguments, then cites the CourtListener material it found.
          </p>
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-medium text-ink">CourtListener Token (Optional Override)</span>
          <input
            className="w-full rounded-2xl border border-black/10 bg-parchment px-4 py-3 text-sm text-ink outline-none transition focus:border-ember focus:ring-2 focus:ring-ember/20"
            value={courtlistenerConfig?.apiToken || ''}
            onChange={(event) => onCourtListenerConfigChange('apiToken', event.target.value)}
            type="password"
            placeholder="Paste a CourtListener token if you want to override the server default"
            autoComplete="off"
            disabled={disabled}
          />
          <p className="mt-2 text-xs leading-6 text-ink/65">
            This optional browser token is stored locally for your machine, just like the provider keys.
          </p>
        </label>

        <div className="mt-5 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-ink/80">
          <p className="font-medium text-ink">CourtListener status</p>
          <p className="mt-2">{courtlistenerStatus?.summary || 'CourtListener status unavailable.'}</p>
          <p className="mt-2">
            Server default token: {courtlistenerStatus?.configured ? 'available' : 'not set'}
          </p>
          <p className="mt-2">
            Default base URL: {courtlistenerStatus?.defaultBaseUrl || 'n/a'}
          </p>
          <p className="mt-2">
            Browser override: {courtlistenerStatus?.supportsBrowserToken ? 'supported' : 'not supported'}
          </p>
        </div>
      </div>

      <ProviderSettingsCard
        appMode={appMode}
        providers={providers}
        providerStatus={providerStatus}
        selectedProviderId={selectedProviderId}
        selectedProviderConfig={selectedProviderConfig}
        model={model}
        onProviderChange={onProviderChange}
        onProviderConfigChange={onProviderConfigChange}
        onModelChange={onModelChange}
        disabled={disabled}
        missingApiKey={missingApiKey}
        title="Shared Model Settings"
        eyebrow="LLM Provider"
      />
    </div>
  );
}
