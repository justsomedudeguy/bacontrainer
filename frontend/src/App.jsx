import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell.jsx';
import { ResearchSidebar } from './components/ResearchSidebar.jsx';
import { SettingsPanel } from './components/SettingsPanel.jsx';
import { WorkspaceTabs } from './components/WorkspaceTabs.jsx';
import { LegalResearchPage } from './features/research/LegalResearchPage.jsx';
import { useLegalResearchWorkspace } from './features/research/useLegalResearchWorkspace.js';
import { SimulatorPage } from './features/simulator/SimulatorPage.jsx';
import { useSimulatorWorkspace } from './features/simulator/useSimulatorWorkspace.js';
import { fetchBootstrap } from './lib/api.js';
import { loadPersistentState, savePersistentState } from './lib/persistence.js';
import {
  buildProviderDefaults,
  buildInitialProviderConfigs,
  buildInitialProviderModels,
  resolveInitialProviderId
} from './lib/providerState.js';

function toPersistedScenarioSummary(scenario) {
  return {
    id: scenario.id,
    title: scenario.title,
    summary: scenario.summary
  };
}

export default function App() {
  const [persistedState] = useState(() => loadPersistentState());
  const [bootstrap, setBootstrap] = useState(null);
  const [bootstrapError, setBootstrapError] = useState('');
  const [activeWorkspace, setActiveWorkspace] = useState(
    persistedState.activeWorkspace || 'simulator'
  );
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    persistedState.selectedScenarioId || ''
  );
  const [selectedProviderId, setSelectedProviderId] = useState(
    persistedState.selectedProviderId || ''
  );
  const [serverDefaultProviderId, setServerDefaultProviderId] = useState(
    persistedState.serverDefaultProviderId || ''
  );
  const [selectedProviderUserSet, setSelectedProviderUserSet] = useState(
    Boolean(persistedState.selectedProviderUserSet)
  );
  const [providerConfigs, setProviderConfigs] = useState(
    persistedState.providerConfigs || {}
  );
  const [providerModels, setProviderModels] = useState(
    persistedState.providerModels || {}
  );
  const [providerDefaults, setProviderDefaults] = useState(
    persistedState.providerDefaults || {}
  );
  const [inventedScenarios, setInventedScenarios] = useState(
    persistedState.inventedScenarios || []
  );
  const [courtlistenerConfig, setCourtlistenerConfig] = useState(
    persistedState.courtlistenerConfig || {
      apiToken: ''
    }
  );

  useEffect(() => {
    let isCancelled = false;

    async function bootstrapApp() {
      try {
        const nextBootstrap = await fetchBootstrap();

        if (isCancelled) {
          return;
        }

        const scenarioOptions = [
          ...nextBootstrap.scenarios,
          ...inventedScenarios.map(toPersistedScenarioSummary)
        ];
        const nextProviderDefaults = buildProviderDefaults(nextBootstrap.providers);
        const nextProviderConfigs = buildInitialProviderConfigs(
          nextBootstrap.providers,
          providerConfigs,
          providerDefaults
        );
        const nextProviderModels = buildInitialProviderModels(
          nextBootstrap.providers,
          providerModels,
          providerDefaults
        );
        const nextSelectedProviderId = resolveInitialProviderId(
          nextBootstrap.providers,
          selectedProviderId,
          nextBootstrap.defaultProviderId,
          selectedProviderUserSet
        );
        const nextSelectedProviderUserSet =
          selectedProviderUserSet && nextSelectedProviderId === selectedProviderId;
        const nextSelectedScenarioId = scenarioOptions.some(
          (scenario) => scenario.id === selectedScenarioId
        )
          ? selectedScenarioId
          : nextBootstrap.defaultScenarioId;

        setBootstrap(nextBootstrap);
        setSelectedProviderId(nextSelectedProviderId);
        setSelectedProviderUserSet(nextSelectedProviderUserSet);
        setSelectedScenarioId(nextSelectedScenarioId);
        setServerDefaultProviderId(nextBootstrap.defaultProviderId);
        setProviderConfigs(nextProviderConfigs);
        setProviderModels(nextProviderModels);
        setProviderDefaults(nextProviderDefaults);
        setBootstrapError('');
      } catch (error) {
        if (!isCancelled) {
          setBootstrapError(error.message);
        }
      }
    }

    bootstrapApp();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    savePersistentState({
      activeWorkspace,
      selectedScenarioId,
      selectedProviderId,
      serverDefaultProviderId,
      selectedProviderUserSet,
      providerConfigs,
      providerModels,
      providerDefaults,
      inventedScenarios,
      courtlistenerConfig
    });
  }, [
    activeWorkspace,
    courtlistenerConfig,
    inventedScenarios,
    providerConfigs,
    providerDefaults,
    providerModels,
    selectedProviderId,
    selectedProviderUserSet,
    selectedScenarioId,
    serverDefaultProviderId
  ]);

  const providers = bootstrap?.providers || [];
  const providerStatus = bootstrap?.providerStatus || {};
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);
  const selectedProviderStatus = providerStatus?.[selectedProviderId];
  const selectedProviderConfigured =
    Boolean(selectedProvider?.configured) || Boolean(selectedProviderStatus?.configured);
  const selectedProviderConfig = providerConfigs[selectedProviderId] || {
    baseUrl: selectedProvider?.defaultBaseUrl || '',
    apiKey: ''
  };
  const model =
    providerModels[selectedProviderId] || selectedProvider?.defaultModel || '';
  const missingApiKey =
    Boolean(selectedProvider?.requiresApiKey) &&
    !selectedProviderConfigured &&
    !selectedProviderConfig.apiKey.trim();

  function handleProviderChange(nextProviderId) {
    setSelectedProviderId(nextProviderId);
    setSelectedProviderUserSet(true);
    setProviderModels((currentValue) => ({
      ...currentValue,
      [nextProviderId]:
        currentValue[nextProviderId] ||
        providers.find((provider) => provider.id === nextProviderId)?.defaultModel ||
        ''
    }));
  }

  function handleProviderConfigChange(field, value) {
    setProviderConfigs((currentValue) => ({
      ...currentValue,
      [selectedProviderId]: {
        ...(currentValue[selectedProviderId] || {
          baseUrl: selectedProvider?.defaultBaseUrl || '',
          apiKey: ''
        }),
        [field]: value
      }
    }));
  }

  function handleModelChange(value) {
    setProviderModels((currentValue) => ({
      ...currentValue,
      [selectedProviderId]: value
    }));
  }

  function handleCourtListenerConfigChange(field, value) {
    setCourtlistenerConfig((currentValue) => ({
      ...currentValue,
      [field]: value
    }));
  }

  const simulatorWorkspace = useSimulatorWorkspace({
    bootstrap,
    selectedScenarioId,
    setSelectedScenarioId,
    inventedScenarios,
    setInventedScenarios,
    selectedProviderId,
    selectedProviderConfig,
    model,
    missingApiKey,
    courtlistenerConfig
  });
  const legalResearchWorkspace = useLegalResearchWorkspace({
    bootstrap,
    selectedProviderId,
    selectedProviderConfig,
    model,
    missingApiKey,
    courtlistenerConfig
  });
  const sharedControlsDisabled =
    !bootstrap ||
    simulatorWorkspace.isLoading ||
    simulatorWorkspace.isSubmitting ||
    simulatorWorkspace.isAnalyzing ||
    simulatorWorkspace.isInventing ||
    legalResearchWorkspace.isSubmitting;

  return (
    <AppShell
      sidebar={
        <>
          <div className={activeWorkspace === 'simulator' ? 'block' : 'hidden'}>
            <SettingsPanel
              appMode={bootstrap?.appMode}
              scenarios={simulatorWorkspace.scenarioOptions}
              providers={providers}
              providerStatus={providerStatus}
              selectedScenarioId={selectedScenarioId}
              selectedProviderId={selectedProviderId}
              selectedProviderConfig={selectedProviderConfig}
              model={model}
              scenarioIdea={simulatorWorkspace.scenarioIdea}
              onScenarioChange={simulatorWorkspace.handleScenarioChange}
              onProviderChange={handleProviderChange}
              onProviderConfigChange={handleProviderConfigChange}
              onModelChange={handleModelChange}
              onScenarioIdeaChange={simulatorWorkspace.setScenarioIdea}
              onInventScenario={simulatorWorkspace.handleInventScenario}
              disabled={sharedControlsDisabled}
              missingApiKey={missingApiKey}
              inventDisabled={sharedControlsDisabled || !bootstrap || missingApiKey}
              inventing={simulatorWorkspace.isInventing}
            />
          </div>

          <div className={activeWorkspace === 'research' ? 'block' : 'hidden'}>
            <ResearchSidebar
              appMode={bootstrap?.appMode}
              providers={providers}
              providerStatus={providerStatus}
              selectedProviderId={selectedProviderId}
              selectedProviderConfig={selectedProviderConfig}
              model={model}
              onProviderChange={handleProviderChange}
              onProviderConfigChange={handleProviderConfigChange}
              onModelChange={handleModelChange}
              disabled={sharedControlsDisabled}
              missingApiKey={missingApiKey}
              courtlistenerStatus={bootstrap?.courtlistenerStatus}
              courtlistenerConfig={courtlistenerConfig}
              onCourtListenerConfigChange={handleCourtListenerConfigChange}
            />
          </div>
        </>
      }
    >
      <WorkspaceTabs
        activeWorkspace={activeWorkspace}
        onChange={setActiveWorkspace}
      />

      {bootstrapError ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-card">
          {bootstrapError}
        </div>
      ) : null}

      <div className={activeWorkspace === 'simulator' ? 'block' : 'hidden'}>
        <SimulatorPage
          transcript={simulatorWorkspace.transcript}
          selectedScenario={simulatorWorkspace.selectedScenario}
          userInput={simulatorWorkspace.userInput}
          onUserInputChange={simulatorWorkspace.setUserInput}
          onSubmit={simulatorWorkspace.handleSubmit}
          onAnalyze={simulatorWorkspace.handleAnalyze}
          onReset={simulatorWorkspace.handleReset}
          status={simulatorWorkspace.status}
          error={simulatorWorkspace.error}
          notice={simulatorWorkspace.notice}
          isLoading={simulatorWorkspace.isLoading}
          isSubmitting={simulatorWorkspace.isSubmitting}
          isAnalyzing={simulatorWorkspace.isAnalyzing}
          isInventing={simulatorWorkspace.isInventing}
          isReady={Boolean(bootstrap)}
          missingApiKey={missingApiKey}
        />
      </div>

      <div className={activeWorkspace === 'research' ? 'block' : 'hidden'}>
        <LegalResearchPage
          transcript={legalResearchWorkspace.transcript}
          userInput={legalResearchWorkspace.userInput}
          onUserInputChange={legalResearchWorkspace.setUserInput}
          onSubmit={legalResearchWorkspace.handleSubmit}
          onReset={legalResearchWorkspace.handleReset}
          status={legalResearchWorkspace.status}
          error={legalResearchWorkspace.error}
          notice={legalResearchWorkspace.notice}
          isLoading={legalResearchWorkspace.isLoading}
          isSubmitting={legalResearchWorkspace.isSubmitting}
          isReady={Boolean(bootstrap)}
        />
      </div>
    </AppShell>
  );
}
