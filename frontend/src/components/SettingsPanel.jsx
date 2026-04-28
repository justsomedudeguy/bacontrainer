import { ProviderSettingsCard } from './ProviderSettingsCard.jsx';

export function SettingsPanel({
  appMode,
  scenarios,
  providers,
  providerStatus,
  selectedScenarioId,
  selectedProviderId,
  selectedProviderConfig,
  model,
  scenarioIdea,
  onScenarioChange,
  onProviderChange,
  onProviderConfigChange,
  onModelChange,
  onScenarioIdeaChange,
  onInventScenario,
  disabled,
  missingApiKey,
  inventDisabled,
  inventing
}) {
  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId);

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-black/10 bg-white/80 p-5 shadow-card backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-brass">Session Setup</p>
            <h2 className="mt-2 font-display text-2xl text-ink">MVP Controls</h2>
          </div>
          <span className="rounded-full bg-ink px-3 py-1 text-xs uppercase tracking-[0.2em] text-white">
            {appMode || 'live'}
          </span>
        </div>

        <div className="mt-5 space-y-4">
          {selectedScenario ? (
            <div className="rounded-2xl border border-black/10 bg-parchment/70 p-4 text-sm text-ink/80">
              <p className="font-medium text-ink">Scenario focus</p>
              <p className="mt-2">{selectedScenario.summary}</p>
            </div>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Scenario</span>
            <select
              className="w-full rounded-2xl border border-black/10 bg-parchment px-4 py-3 text-sm text-ink outline-none transition focus:border-ember focus:ring-2 focus:ring-ember/20"
              value={selectedScenarioId}
              onChange={(event) => onScenarioChange(event.target.value)}
              disabled={disabled}
            >
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.title}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <p className="text-sm font-medium text-ink">Invent a new scenario</p>
            <textarea
              className="mt-3 min-h-[110px] w-full rounded-2xl border border-black/10 bg-parchment px-4 py-3 text-sm leading-6 text-ink outline-none transition focus:border-ember focus:ring-2 focus:ring-ember/20"
              value={scenarioIdea}
              onChange={(event) => onScenarioIdeaChange(event.target.value)}
              placeholder="Optional idea: prolonged stop for a dog sniff, false claim of warrant, bus sweep consent search, doorway request to step inside..."
              disabled={disabled}
            />
            <button
              type="button"
              className="mt-3 rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onInventScenario}
              disabled={inventDisabled}
            >
              {inventing ? 'Inventing...' : 'Invent Scenario'}
            </button>
          </div>
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
