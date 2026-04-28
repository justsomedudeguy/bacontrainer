export function AppShell({ children, sidebar }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8eb,transparent_35%),linear-gradient(180deg,#f8f1df_0%,#f3ead7_45%,#efe2cb_100%)] text-ink">
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8 lg:px-8">
        <section className="flex min-w-0 flex-1 flex-col gap-6">{children}</section>
        <aside className="w-full lg:w-[360px] lg:flex-shrink-0">{sidebar}</aside>
      </main>
    </div>
  );
}
