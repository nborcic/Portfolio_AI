import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const error = searchParams.get("error");
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (token) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => d?.user && navigate("/", { replace: true }))
      .catch(() => {});
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Redeem failed");

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_hash: data.token_hash }),
      });
      if (!verifyRes.ok) {
        const v = await verifyRes.json();
        throw new Error(v.error ?? "Session failed");
      }
      navigate("/", { replace: true });
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-zinc-400">Invalid invite link</h1>
          <p className="mt-2 text-sm text-zinc-500">Ask for a new invite.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl"
      >
        <h1 className="text-lg font-semibold">Enter your name</h1>
        <p className="mt-1 text-sm text-zinc-500">No email required.</p>

        {(error || err) && (
          <p className="mt-3 text-sm text-red-400">{error ?? err}</p>
        )}

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          autoFocus
          disabled={loading}
        />

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="mt-4 w-full rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
