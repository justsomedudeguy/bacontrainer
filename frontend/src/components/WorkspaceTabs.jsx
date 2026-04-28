export function WorkspaceTabs({ activeWorkspace, onChange }) {
  const tabs = [
    {
      id: 'simulator',
      label: 'Simulator',
      description: 'Practice live Fourth Amendment scenarios.'
    },
    {
      id: 'research',
      label: 'Legal Research',
      description: 'Ask open-ended legal questions with CourtListener grounding.'
    }
  ];

  return (
    <section className="rounded-[30px] border border-black/10 bg-white/80 p-4 shadow-card backdrop-blur">
      <div className="grid gap-3 sm:grid-cols-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeWorkspace;

          return (
            <button
              key={tab.id}
              type="button"
              className={`rounded-[26px] border px-5 py-4 text-left transition ${
                isActive
                  ? 'border-ink bg-ink text-white shadow-sm'
                  : 'border-black/10 bg-parchment/75 text-ink hover:bg-white'
              }`}
              onClick={() => onChange(tab.id)}
            >
              <p className="text-xs uppercase tracking-[0.22em] opacity-75">Workspace</p>
              <p className="mt-2 font-display text-2xl">{tab.label}</p>
              <p className={`mt-2 text-sm leading-6 ${isActive ? 'text-white/85' : 'text-ink/75'}`}>
                {tab.description}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
