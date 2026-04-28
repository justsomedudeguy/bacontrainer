export function StatusBanner({ error, status, notice }) {
  if (!error && !status && !notice) {
    return null;
  }

  const toneClasses = error
    ? 'border-red-300 bg-red-50 text-red-900'
    : notice
      ? 'border-sky-200 bg-sky-50 text-sky-950'
      : 'border-amber-200 bg-amber-50 text-amber-900';

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm shadow-card ${toneClasses}`}>
      {error || notice || status}
    </div>
  );
}
