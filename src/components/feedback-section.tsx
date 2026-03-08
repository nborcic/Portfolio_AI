import { useState, useEffect } from "react";

const LABELS = [
  "Clarity of answers",
  "Relevance to documents",
  "Response speed",
  "Ease of use",
  "Source quality",
  "Overall satisfaction",
] as const;

type FeedbackItem = {
  id: string;
  user_id: string;
  session_date: string;
  q1?: number;
  q2?: number;
  q3?: number;
  q4?: number;
  q5?: number;
  q6?: number;
  comment?: string;
  created_at: string;
  profiles?: { display_name: string };
};

export function FeedbackSection() {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [values, setValues] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");

  useEffect(() => {
    fetch("/api/feedback")
      .then((r) => r.ok && r.json())
      .then((d) => (Array.isArray(d) ? setFeedback(d) : null))
      .catch(() => {});
  }, [submitted]);

  const today = new Date().toISOString().slice(0, 10);

  const submit = async () => {
    const payload = {
      session_date: today,
      ...Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, v])
      ),
      comment: comment.trim() || undefined,
    };
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setSubmitted(true);
      setOpen(false);
    }
  };

  return (
    <div className="shrink-0 border-t border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2 text-left text-sm text-zinc-500 hover:text-zinc-400"
      >
        {open ? "Hide feedback" : "Session feedback"}
      </button>

      {open && (
        <div className="border-t border-zinc-800 p-4">
          <h3 className="mb-3 text-sm font-medium">Rate today&apos;s session</h3>
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            {LABELS.map((label, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-400">{label}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        setValues((v) => ({ ...v, [`q${i + 1}`]: n }))
                      }
                      className={`h-7 w-7 rounded text-xs ${
                        values[`q${i + 1}`] === n
                          ? "bg-amber-600 text-white"
                          : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Additional comments (optional)"
            className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
            rows={2}
          />
          <button
            type="button"
            onClick={submit}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
          >
            Submit feedback
          </button>

          {feedback.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-medium text-zinc-500">
                All feedback (visible to logged-in users)
              </h4>
              {feedback.slice(0, 5).map((f) => (
                <FeedbackCard key={f.id} item={f} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ item }: { item: FeedbackItem }) {
  const [showComment, setShowComment] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<
    { id: string; content: string; profiles?: { display_name: string } }[]
  >([]);

  const scores = [item.q1, item.q2, item.q3, item.q4, item.q5, item.q6].filter(
    (s): s is number => typeof s === "number"
  );
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "-";

  const loadComments = async () => {
    const res = await fetch(`/api/feedback/${item.id}/comments`);
    if (res.ok) {
      const data = await res.json();
      setComments(data);
    }
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    const res = await fetch("/api/feedback/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback_id: item.id, content: commentText.trim() }),
    });
    if (res.ok) {
      setCommentText("");
      setShowComment(false);
      loadComments();
    }
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-zinc-400">
          {item.profiles?.display_name ?? "Anonymous"} · {item.session_date}
        </span>
        <span className="text-amber-500">Avg: {avg}</span>
      </div>
      {item.comment && (
        <p className="mt-1 text-zinc-300">{item.comment}</p>
      )}
      <button
        type="button"
        onClick={() => {
          setShowComment(!showComment);
          if (!showComment) loadComments();
        }}
        className="mt-2 text-amber-500 hover:text-amber-400"
      >
        {showComment ? "Cancel" : "Comment"}
      </button>
      {showComment && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
          />
          <button
            type="button"
            onClick={addComment}
            className="rounded bg-amber-600 px-2 py-1 text-white"
          >
            Post
          </button>
        </div>
      )}
      {comments.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-zinc-800 pt-2">
          {comments.map((c) => (
            <p key={c.id} className="text-zinc-500">
              {c.profiles?.display_name}: {c.content}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
