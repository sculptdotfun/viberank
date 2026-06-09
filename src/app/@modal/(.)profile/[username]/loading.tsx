// Shown the instant a board row is clicked, while the server renders the
// sheet. Mirrors ProfileSheet's layout so the content swap doesn't jump.
export default function SheetLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm backdrop-in" />

      <div className="sheet-up relative w-full max-w-2xl bg-surface-1 border border-border border-b-0 rounded-t-xl shadow-2xl">
        <div className="pt-3 pb-2 px-5 flex items-center justify-center border-b border-border-subtle">
          <div className="w-10 h-1 rounded-full bg-surface-4" aria-hidden />
        </div>

        <div className="px-5 py-5 animate-pulse" aria-hidden>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-full bg-surface-3" />
            <div className="space-y-2">
              <div className="h-5 w-40 rounded bg-surface-3" />
              <div className="h-3.5 w-24 rounded bg-surface-3" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[68px] rounded-lg bg-background border border-border-subtle" />
            ))}
          </div>

          <div className="h-[88px] rounded-lg bg-background border border-border-subtle mb-3" />
          <div className="h-[64px] rounded-lg bg-background border border-border-subtle mb-5" />
          <div className="h-10 rounded-md bg-surface-3" />
        </div>
      </div>
    </div>
  );
}
