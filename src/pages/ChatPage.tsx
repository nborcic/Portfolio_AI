import { SourcesProvider } from "@/contexts/sources-context";
import { Chat } from "@/components/chat";
import { SourcesPanel } from "@/components/sources-panel";
import { useSources } from "@/contexts/sources-context";

function SourcesToggle() {
  const { sourcesOpen, setSourcesOpen } = useSources();
  return (
    <button
      type="button"
      onClick={() => setSourcesOpen(!sourcesOpen)}
      className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
      aria-expanded={sourcesOpen}
    >
      {sourcesOpen ? "Hide sources" : "Sources"}
    </button>
  );
}

function SourcesSidebar() {
  const { sourcesOpen, setSourcesOpen } = useSources();
  return (
    <>
      {sourcesOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/40 lg:hidden"
          role="button"
          tabIndex={0}
          onClick={() => setSourcesOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setSourcesOpen(false)}
          aria-label="Close sources"
        />
      )}
      <aside
        className={`flex shrink-0 flex-col border-l border-zinc-800 bg-zinc-950 transition-[width] ${
          sourcesOpen
            ? "fixed right-0 top-0 z-20 h-full w-80 lg:relative lg:right-auto lg:top-auto lg:h-auto"
            : "hidden w-12 lg:flex"
        }`}
      >
        {sourcesOpen ? (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-medium text-zinc-400">Sources</h2>
              <button
                type="button"
                onClick={() => setSourcesOpen(false)}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                aria-label="Close sources"
              >
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <SourcesPanel />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-start pt-4">
            <button
              type="button"
              onClick={() => setSourcesOpen(true)}
              className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              aria-label="Open sources"
              title="Sources"
            >
              <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

export function ChatPage() {
  return (
    <SourcesProvider>
      <div className="flex h-screen flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h1 className="font-semibold">Portfolio AI</h1>
          <SourcesToggle />
        </header>

        <main className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col overflow-hidden">
            <Chat />
          </div>
          <SourcesSidebar />
        </main>
      </div>
    </SourcesProvider>
  );
}
