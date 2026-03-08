import "dotenv/config";
import { Hono } from "hono";
import { embedText } from "./lib/embedding.js";
import { loadDocs, searchChunks } from "./lib/docs-store.js";

const app = new Hono();

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";
const TOP_K = 5;
const MIN_SIMILARITY = 0.3;
const SYSTEM_PROMPT = `You answer questions ONLY using the provided context. If the context does not contain enough information to answer, respond exactly: "I don't know based on the provided data." Do not guess, infer, or use external knowledge.`;

// Load docs from ./docs on startup (syncs to DB) — after server starts
const DOCS_DIR = process.env.DOCS_DIR ?? "docs";
function runInitialLoad() {
  loadDocs(DOCS_DIR)
    .then(({ count, chunks }) => {
      console.log(`Loaded ${count} files, ${chunks} chunks into DB from "${DOCS_DIR}"`);
    })
    .catch((e) => {
      console.error("Initial doc load failed:", e.message ?? e);
    });
}

setImmediate(runInitialLoad);

// --- Chat (no auth); history is session-only on client ---
app.post("/api/chat", async (c) => {
  const body = await c.req.json();
  const message = typeof body?.message === "string" ? body.message.trim() : null;
  if (!message) return c.json({ error: "message required" }, 400);

  const queryEmbedding = await embedText(message);
  const sources = await searchChunks(queryEmbedding, TOP_K, MIN_SIMILARITY);
  const context =
    sources.length > 0 ? sources.map((s) => s.content).join("\n\n") : "";

  const userPrompt = context
    ? `Context:\n${context}\n\nQuestion: ${message}`
    : `No relevant context found.\n\nQuestion: ${message}`;

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return c.json({ error: "Groq not configured" }, 500);

  const res = await fetch(GROQ_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  if (!res.ok) return c.json({ error: `Groq: ${await res.text()}` }, 502);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "I don't know based on the provided data.";

  return c.json({ content, sources });
});

// Reload docs
app.post("/api/docs/reload", async (c) => {
  const DOCS_DIR = process.env.DOCS_DIR ?? "docs";
  try {
    const result = await loadDocs(DOCS_DIR);
    return c.json(result);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Reload failed" }, 500);
  }
});

// Production: serve Vite build
if (process.env.NODE_ENV === "production") {
  const path = await import("path");
  const fs = await import("fs");
  const { fileURLToPath } = await import("url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.join(__dirname, "..", "dist");

  app.get("*", async (c) => {
    const p = c.req.path === "/" ? "/index.html" : c.req.path;
    const filePath = path.join(dist, p.replace(/^\//, ""));
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath);
        const types: Record<string, string> = {
          ".js": "application/javascript",
          ".css": "text/css",
          ".html": "text/html",
          ".json": "application/json",
          ".ico": "image/x-icon",
          ".svg": "image/svg+xml",
        };
        const ext = path.extname(filePath);
        return new Response(content, {
          status: 200,
          headers: { "Content-Type": types[ext] ?? "application/octet-stream" },
        });
      }
    } catch {
      // fall through
    }
    const index = path.join(dist, "index.html");
    if (fs.existsSync(index)) return c.html(fs.readFileSync(index, "utf-8"));
    return c.notFound();
  });
}

import { serve } from "@hono/node-server";
serve({
  fetch: app.fetch,
  port: 3001,
});
console.log("API: http://localhost:3001");
setImmediate(runInitialLoad);

export default app;
