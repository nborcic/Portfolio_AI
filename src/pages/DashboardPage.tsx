import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SourcesProvider } from "@/contexts/sources-context";
import { Chat } from "@/components/chat";
import { SourcesPanel } from "@/components/sources-panel";
import { FeedbackSection } from "@/components/feedback-section";

type Profile = { display_name: string; is_admin: boolean } | null;

export function DashboardPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.user) {
          navigate("/auth", { replace: true });
          return;
        }
        setProfile(d.profile ?? null);
      })
      .catch(() => navigate("/auth", { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleSignOut = () => {
    window.location.href = "/api/auth/signout";
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <SourcesProvider>
      <div className="flex h-screen flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h1 className="font-semibold">Portfolio AI</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">{profile?.display_name ?? "User"}</span>
            {profile?.is_admin && (
              <a href="/admin" className="text-sm text-amber-500 hover:text-amber-400">
                Admin
              </a>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm text-zinc-500 hover:text-zinc-400"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col overflow-hidden">
            <Chat />
          </div>
          <aside className="hidden w-80 shrink-0 flex-col border-l border-zinc-800 lg:flex">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-medium text-zinc-400">Sources</h2>
            </div>
            <SourcesPanel />
          </aside>
        </main>

        <FeedbackSection />
      </div>
    </SourcesProvider>
  );
}
