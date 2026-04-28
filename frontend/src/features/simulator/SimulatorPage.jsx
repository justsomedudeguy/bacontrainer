import { Composer } from '../../components/Composer.jsx';
import { StatusBanner } from '../../components/StatusBanner.jsx';
import { TranscriptPanel } from '../../components/TranscriptPanel.jsx';

export function SimulatorPage({
  transcript,
  selectedScenario,
  userInput,
  onUserInputChange,
  onSubmit,
  onAnalyze,
  onReset,
  status,
  error,
  notice,
  isLoading,
  isSubmitting,
  isAnalyzing,
  isInventing,
  isReady,
  missingApiKey
}) {
  return (
    <>
      <section className="rounded-[32px] border border-black/10 bg-white/75 px-6 py-6 shadow-card backdrop-blur">
        <p className="text-xs uppercase tracking-[0.26em] text-brass">Legal Literacy Simulator</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-4xl text-ink sm:text-5xl">
              Practice Fourth Amendment police encounters with live roleplay and a separate explainer.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/75 sm:text-base">
              Send as many roleplay turns as you need, then request a separate legal analysis when you are ready to step out of character.
            </p>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-orange-50 px-4 py-3 text-sm text-ink/80">
            <p className="font-medium text-ink">Current flow</p>
            <p className="mt-1">Continue the story in context until you click Legal Analysis.</p>
          </div>
        </div>
      </section>

      <StatusBanner error={error} status={status} notice={notice} />

      <TranscriptPanel
        transcript={transcript}
        headingEyebrow="Transcript"
        title={selectedScenario?.title || 'Loading scenario...'}
        description={
          selectedScenario?.summary ||
          'Scenario roleplay and separate post-turn analysis appear together here.'
        }
        emptyState="The transcript will appear here after the scenario is initialized."
      />

      <Composer
        value={userInput}
        onChange={onUserInputChange}
        onSubmit={onSubmit}
        onAnalyze={onAnalyze}
        onReset={onReset}
        disabled={isLoading || isSubmitting || isAnalyzing || isInventing || !isReady}
        submitDisabled={
          isLoading ||
          isSubmitting ||
          isAnalyzing ||
          isInventing ||
          !isReady ||
          missingApiKey ||
          !userInput.trim()
        }
        analysisDisabled={
          isLoading ||
          isSubmitting ||
          isAnalyzing ||
          isInventing ||
          !isReady ||
          missingApiKey ||
          transcript.length === 0
        }
        helperText={
          missingApiKey
            ? 'Add an API key in the provider settings before sending the next turn.'
            : 'Write exactly how you would answer the officer. Keep sending turns to continue the roleplay, then request Legal Analysis when you want the explainer.'
        }
        submitting={isSubmitting}
        analyzing={isAnalyzing}
      />
    </>
  );
}
