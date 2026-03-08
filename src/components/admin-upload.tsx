import { useState } from "react";

export function AdminUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setSuccess(`Uploaded: ${data.name}`);
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-zinc-500">
        Max 4 documents, 5MB total. PDF and TXT only.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="file"
          accept=".pdf,.txt"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-amber-600 file:px-4 file:py-2 file:text-white"
        />
        <button
          type="button"
          onClick={upload}
          disabled={!file || loading}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {loading ? "Uploading…" : "Upload"}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-green-400">{success}</p>}
    </div>
  );
}
