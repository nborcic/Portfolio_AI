import { useState } from "react";

export function AdminInvite() {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const create = async () => {
    setLoading(true);
    setLink(null);
    try {
      const res = await fetch("/api/invite/create", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setLink(data.link);
    } catch {
      setLink("Error creating invite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-lg font-medium">Create invite link</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Send this link; recipient enters name (no email).
      </p>
      <button
        type="button"
        onClick={create}
        disabled={loading}
        className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create link"}
      </button>
      {link && (
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <p className="break-all text-sm text-amber-400">{link}</p>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(link)}
            className="mt-2 text-xs text-zinc-500 hover:text-zinc-400"
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
}
