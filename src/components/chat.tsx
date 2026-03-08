import { useState, useEffect } from "react";
import { useSources } from "@/contexts/sources-context";

const STORAGE_KEY = "chat-messages";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { content: string; document_id?: string }[];
  created_at: string;
};

function loadStoredMessages(): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: Message[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

export function Chat() {
  const { setSources, setSourcesOpen } = useSources();
  const [messages, setMessages] = useState<Message[]>(loadStoredMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Persist to sessionStorage whenever messages change (tab close = cleared)
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);
    setSources([]);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Request failed");

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content,
        sources: data.sources,
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, assistantMsg]);
      setSources(data.sources ?? []);
    } catch (e) {
      const err = e instanceof Error ? e.message : "Something went wrong";
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Error: ${err}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && (
            <p className="py-8 text-center text-zinc-500">
              Ask a question about Nikola.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg px-4 py-3 ${
                m.role === "user"
                  ? "ml-8 bg-zinc-800"
                  : "mr-8 bg-zinc-900"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{m.content}</p>
              {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSources(m.sources ?? []);
                    setSourcesOpen(true);
                  }}
                  className="mt-2 text-xs text-amber-500 hover:text-amber-400"
                >
                  View sources ({m.sources.length})
                </button>
              )}
            </div>
          ))}
          {loading && (
            <div className="mr-8 rounded-lg bg-zinc-900 px-4 py-3">
              <p className="text-sm text-zinc-500">Thinking…</p>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-zinc-800 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mx-auto flex max-w-2xl gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </>
  );
}

