export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onReset,
  disabled,
  submitDisabled,
  helperText,
  submitting
}) {
  return (
    <section className="rounded-[30px] border border-black/10 bg-white/80 p-5 shadow-card backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-brass">Ask A Question</p>
          <h2 className="mt-2 font-display text-2xl text-ink">Legal Research Chat</h2>
        </div>
      </div>

      <textarea
        className="mt-4 min-h-[150px] w-full rounded-[28px] border border-black/10 bg-parchment px-5 py-4 text-sm leading-7 text-ink outline-none transition focus:border-ember focus:ring-2 focus:ring-ember/20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ask any legal question, such as a doctrine question, a case lookup, or a docket-oriented research question..."
        disabled={disabled}
      />

      {helperText ? <p className="mt-3 text-sm text-ink/70">{helperText}</p> : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onSubmit}
          disabled={submitDisabled}
        >
          {submitting ? 'Researching...' : 'Ask Question'}
        </button>
        <button
          type="button"
          className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-medium text-ink transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onReset}
          disabled={disabled}
        >
          New Chat
        </button>
      </div>
    </section>
  );
}
