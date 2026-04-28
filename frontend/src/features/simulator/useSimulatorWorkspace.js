import { useEffect, useState } from 'react';
import { analyzeScenario, inventScenario, resetScenario, submitTurn } from '../../lib/api.js';

function toScenarioSummary(scenario) {
  return {
    id: scenario.id,
    title: scenario.title,
    summary: scenario.summary,
    generated: true
  };
}

function upsertScenario(scenarios, scenario) {
  return [...scenarios.filter((item) => item.id !== scenario.id), scenario];
}

function buildScenarioRequest(selectedScenarioId, inventedScenarios) {
  const inventedScenario = inventedScenarios.find(
    (scenario) => scenario.id === selectedScenarioId
  );

  if (!inventedScenario) {
    return {
      scenarioId: selectedScenarioId
    };
  }

  return {
    scenarioId: inventedScenario.id,
    scenario: inventedScenario
  };
}

export function useSimulatorWorkspace({
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
}) {
  const [scenarioIdea, setScenarioIdea] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isInventing, setIsInventing] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const scenarioOptions = [
    ...(bootstrap?.scenarios || []),
    ...inventedScenarios.map(toScenarioSummary)
  ];
  const selectedScenario =
    inventedScenarios.find((scenario) => scenario.id === selectedScenarioId) ||
    scenarioOptions.find((scenario) => scenario.id === selectedScenarioId);
  const notice = missingApiKey
    ? 'Enter an API key to continue with the selected provider.'
    : '';

  useEffect(() => {
    let isCancelled = false;

    async function initializeScenario() {
      if (!bootstrap || hasInitialized || !selectedScenarioId || !selectedProviderId) {
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const resetPayload = await resetScenario({
          ...buildScenarioRequest(selectedScenarioId, inventedScenarios),
          providerId: selectedProviderId,
          model,
          providerConfig: selectedProviderConfig
        });

        if (isCancelled) {
          return;
        }

        setTranscript(resetPayload.transcript);
        setStatus(`Loaded ${scenarioOptions.length} police-overreach scenarios.`);
        setHasInitialized(true);
      } catch (nextError) {
        if (!isCancelled) {
          setError(nextError.message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    initializeScenario();

    return () => {
      isCancelled = true;
    };
  }, [
    bootstrap,
    hasInitialized,
    inventedScenarios,
    model,
    scenarioOptions.length,
    selectedProviderConfig,
    selectedProviderId,
    selectedScenarioId
  ]);

  async function handleReset() {
    setError('');
    setStatus('Resetting scenario...');
    setIsSubmitting(true);

    try {
      const response = await resetScenario({
        ...buildScenarioRequest(selectedScenarioId, inventedScenarios),
        providerId: selectedProviderId,
        model,
        providerConfig: selectedProviderConfig
      });

      setTranscript(response.transcript);
      setUserInput('');
      setStatus(`Scenario reset for ${selectedScenario?.title || 'selected scenario'}.`);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (!userInput.trim()) {
      return;
    }

    if (missingApiKey) {
      setError('');
      setStatus('Enter an API key to continue.');
      return;
    }

    setError('');
    setStatus('Generating roleplay response...');
    setIsSubmitting(true);

    try {
      const response = await submitTurn({
        ...buildScenarioRequest(selectedScenarioId, inventedScenarios),
        providerId: selectedProviderId,
        model,
        transcript,
        userInput,
        providerConfig: selectedProviderConfig
      });

      setTranscript(response.transcript);
      setUserInput('');
      setStatus('Roleplay updated. Continue responding, or request Legal Analysis when you are ready.');
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAnalyze() {
    if (missingApiKey) {
      setError('');
      setStatus('Enter an API key to continue.');
      return;
    }

    setError('');
    setStatus('Generating legal analysis...');
    setIsAnalyzing(true);

    try {
      const response = await analyzeScenario({
        ...buildScenarioRequest(selectedScenarioId, inventedScenarios),
        providerId: selectedProviderId,
        model,
        transcript,
        providerConfig: selectedProviderConfig,
        courtlistenerConfig
      });

      setTranscript(response.transcript);
      setStatus('Legal analysis added. You can continue the roleplay or reset the scenario.');
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleInventScenario() {
    if (missingApiKey) {
      setError('');
      setStatus('Enter an API key to continue.');
      return;
    }

    setError('');
    setStatus('Inventing a new scenario...');
    setIsInventing(true);

    try {
      const response = await inventScenario({
        providerId: selectedProviderId,
        model,
        providerConfig: selectedProviderConfig,
        promptIdea: scenarioIdea
      });
      const nextInventedScenarios = upsertScenario(inventedScenarios, response.scenario);

      setInventedScenarios(nextInventedScenarios);
      setSelectedScenarioId(response.scenario.id);
      setScenarioIdea('');

      const resetPayload = await resetScenario({
        ...buildScenarioRequest(response.scenario.id, nextInventedScenarios),
        providerId: selectedProviderId,
        model,
        providerConfig: selectedProviderConfig
      });

      setTranscript(resetPayload.transcript);
      setUserInput('');
      setStatus(`New scenario ready: ${response.scenario.title}.`);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setIsInventing(false);
    }
  }

  function handleScenarioChange(nextScenarioId) {
    setSelectedScenarioId(nextScenarioId);
  }

  return {
    scenarioIdea,
    setScenarioIdea,
    scenarioOptions,
    selectedScenario,
    transcript,
    userInput,
    setUserInput,
    status,
    error,
    notice,
    isLoading,
    isSubmitting,
    isAnalyzing,
    isInventing,
    handleReset,
    handleSubmit,
    handleAnalyze,
    handleInventScenario,
    handleScenarioChange
  };
}
