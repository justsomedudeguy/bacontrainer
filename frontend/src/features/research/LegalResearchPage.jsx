import { ChatComposer } from '../../components/ChatComposer.jsx';
import { StatusBanner } from '../../components/StatusBanner.jsx';
import { TranscriptPanel } from '../../components/TranscriptPanel.jsx';

export function LegalResearchPage({
  transcript,
  userInput,
  onUserInputChange,
  onSubmit,
  onReset,
  status,
  error,
  notice,
  isLoading,
  isSubmitting,
  isReady
}) {
  return (
    <>
      <section className="rounded-[32px] border border-black/10 bg-white/75 px-6 py-6 shadow-card backdrop-blur">
        <p className="text-xs uppercase tracking-[0.26em] text-brass">Independent Research</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-4xl text-ink sm:text-5xl">
              Ask open-ended legal questions and ground the answer in CourtListener when sources are available.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/75 sm:text-base">
              This workspace uses the same model access you configure for the simulator, but it runs an independent chat flow that can search case law, PACER materials, judges, and oral arguments.
            </p>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-orange-50 px-4 py-3 text-sm text-ink/80">
            <p className="font-medium text-ink">Current flow</p>
            <p className="mt-1">Ask a question, review the answer, then inspect the linked sources underneath the response.</p>
          </div>
        </div>
      </section>

      <StatusBanner error={error} status={status} notice={notice} />

      <TranscriptPanel
        headingEyebrow="Research Transcript"
        title="Legal Research Chat"
        description="Assistant answers appear here together with CourtListener retrieval status and linked source cards."
        emptyState="The legal research transcript will appear here after the chat initializes."
        transcript={transcript}
      />

      <ChatComposer
        value={userInput}
        onChange={onUserInputChange}
        onSubmit={onSubmit}
        onReset={onReset}
        disabled={isLoading || isSubmitting || !isReady}
        submitDisabled={isLoading || isSubmitting || !isReady || !userInput.trim()}
        helperText={
          notice ||
          'Ask doctrinal questions, case lookup questions, or docket-oriented questions. The assistant will mark when CourtListener grounding was unavailable.'
        }
        submitting={isSubmitting}
      />
    </>
  );
}
