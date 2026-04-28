export function Composer({
  value,
  onChange,
  onSubmit,
  onAnalyze,
  onReset,
  disabled,
  submitDisabled,
  analysisDisabled,
  helperText,
  submitting,
  analyzing
}) {
  return (
    <section className="rounded-[30px] border border-black/10 bg-white/80 p-5 shadow-card backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-brass">Your Response</p>
          <h2 className="mt-2 font-display text-2xl text-ink">
            Continue The Scenario
          </h2>
        </div>
      </div>

      <div className="relative mt-4">
        <textarea
          className="min-h-[150px] w-full resize-y rounded-[28px] border border-black/10 bg-parchment px-5 py-4 pb-20 pr-36 text-sm leading-7 text-ink outline-none transition focus:border-ember focus:ring-2 focus:ring-ember/20"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type how you would respond to the officer..."
          disabled={disabled}
        />
        <button
          type="button"
          className="absolute bottom-4 right-4 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onSubmit}
          disabled={submitDisabled}
        >
          {submitting ? 'Sending...' : 'Send Turn'}
        </button>
      </div>

      {helperText ? (
        <p className="mt-3 text-sm text-ink/70">{helperText}</p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-medium text-ink transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onReset}
          disabled={disabled}
        >
          Reset Scenario
        </button>
        <button
          type="button"
          className="rounded-full bg-ember px-5 py-3 text-sm font-medium text-white transition hover:bg-ember/90 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onAnalyze}
          disabled={analysisDisabled}
        >
          {analyzing ? 'Analyzing...' : 'Legal Analysis'}
        </button>
      </div>
    </section>
  );
}
