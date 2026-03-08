import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminUpload } from "@/components/admin-upload";
import { AdminInvite } from "@/components/admin-invite";

export function AdminPage() {
  const navigate = useNavigate();
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.user) {
          navigate("/auth", { replace: true });
          return;
        }
        if (!d?.profile?.is_admin) navigate("/", { replace: true });
        else setOk(true);
      })
      .catch(() => navigate("/auth", { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!ok) return null;

  return (
    <div className="min-h-screen p-6 bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="text-sm text-amber-500 hover:text-amber-400">
          ← Back
        </a>
        <h1 className="mt-4 text-xl font-semibold">Admin</h1>
        <AdminInvite />
        <AdminUpload />
      </div>
    </div>
  );
}
