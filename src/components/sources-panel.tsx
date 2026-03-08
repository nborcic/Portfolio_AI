import { useSources } from "@/contexts/sources-context";

export function SourcesPanel() {
  const { sources } = useSources();

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {sources.length === 0 ? (
        <p className="text-sm text-zinc-500">Click &quot;View sources&quot; on an answer.</p>
      ) : (
        <div className="space-y-3">
          {sources.map((s, i) => (
            <div
              key={i}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-300"
            >
              {s.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
