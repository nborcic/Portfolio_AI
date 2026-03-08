import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type Source = { content: string; document_id?: string };

const SourcesContext = createContext<{
  sources: Source[];
  setSources: (s: Source[]) => void;
} | null>(null);

export function SourcesProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<Source[]>([]);
  const set = useCallback((s: Source[]) => setSources(s), []);
  return (
    <SourcesContext.Provider value={{ sources, setSources: set }}>
      {children}
    </SourcesContext.Provider>
  );
}

export function useSources() {
  const ctx = useContext(SourcesContext);
  if (!ctx) throw new Error("useSources must be used within SourcesProvider");
  return ctx;
}
