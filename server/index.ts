import { Hono } from "hono";
import { randomBytes } from "crypto";
import { z } from "zod";
import { createSupabaseFromContext } from "./lib/supabase.js";
import { createAdminClient } from "./lib/admin.js";
import { embedText, embedTexts } from "./lib/embedding.js";
import { chunkText } from "./lib/chunk.js";

const app = new Hono();

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";
const TOP_K = 5;
const SIMILARITY_THRESHOLD = 0.5;
const SYSTEM_PROMPT = `You answer questions ONLY using the provided context. If the context does not contain enough information to answer, respond exactly: "I don't know based on the provided data." Do not guess, infer, or use external knowledge.`;

// --- Auth ---
app.post("/api/auth/verify", async (c) => {
  const { supabase, setCookiesOnResponse } = createSupabaseFromContext(c);
  const body = await c.req.json();
  const token_hash = body?.token_hash;
  if (!token_hash) return c.json({ error: "token_hash required" }, 400);
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash,
    type: "magiclink",
  });
  if (error) return c.json({ error: error.message }, 400);
  return setCookiesOnResponse(c.json({ user: data.user }));
});

app.get("/api/auth/me", async (c) => {
  const { supabase } = createSupabaseFromContext(c);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return c.json({ user: null });
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("display_name, is_admin").eq("id", user.id).single();
  return c.json({ user, profile: profile ?? null });
});

app.post("/api/auth/signout", async (c) => {
  const { supabase, setCookiesOnResponse } = createSupabaseFromContext(c);
  await supabase.auth.signOut();
  const origin = c.req.header("origin") ?? c.req.url;
  return setCookiesOnResponse(c.redirect(new URL("/auth", origin).toString()));
});

app.get("/api/auth/signout", async (c) => {
  const { supabase, setCookiesOnResponse } = createSupabaseFromContext(c);
  await supabase.auth.signOut();
  const origin = c.req.header("origin") ?? c.req.url;
  return setCookiesOnResponse(c.redirect(new URL("/auth", origin).toString()));
});

// --- Invite ---
app.post("/api/invite/create", async (c) => {
  const { supabase, setCookiesOnResponse } = createSupabaseFromContext(c);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return c.json({ error: "Admin only" }, 403);
  const token = randomBytes(32).toString("hex");
  const { error } = await admin.from("invites").insert({ token, created_by: user.id });
  if (error) return c.json({ error: error.message }, 500);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5173";
  return setCookiesOnResponse(c.json({ link: `${baseUrl}/auth?token=${token}`, token }));
});

const redeemSchema = z.object({ token: z.string(), name: z.string().min(1).max(100) });
app.post("/api/invite/redeem", async (c) => {
  const body = await c.req.json();
  const parsed = redeemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { token, name } = parsed.data;
  const admin = createAdminClient();
  const { data: invite, error: inviteErr } = await admin.from("invites").select("id").eq("token", token).is("used_at", null).single();
  if (inviteErr || !invite) return c.json({ error: "Invalid or used invite" }, 400);
  const { data: anon, error: signUpErr } = await admin.auth.admin.createUser({
    email: `${token}@invite.local`,
    password: randomBytes(32).toString("hex"),
    email_confirm: true,
  });
  if (signUpErr || !anon.user) return c.json({ error: signUpErr?.message ?? "Signup failed" }, 500);
  await admin.from("invites").update({ used_at: new Date().toISOString() }).eq("id", invite.id);
  await admin.from("profiles").insert({ id: anon.user.id, display_name: name });
  const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email: anon.user.email! });
  const hashedToken = linkData?.properties?.hashed_token;
  if (!hashedToken) return c.json({ error: "Could not generate session" }, 500);
  return c.json({ token_hash: hashedToken });
});

// --- Chat ---
app.post("/api/chat", async (c) => {
  const { supabase, setCookiesOnResponse } = createSupabaseFromContext(c);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json();
  const message = typeof body?.message === "string" ? body.message.trim() : null;
  if (!message) return c.json({ error: "message required" }, 400);
  const admin = createAdminClient();
  const queryEmbedding = await embedText(message);
  const { data: chunks } = await admin.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_threshold: SIMILARITY_THRESHOLD,
    match_count: TOP_K,
  });
  const context = Array.isArray(chunks) && chunks.length > 0
    ? chunks.map((x: { content: string }) => x.content).join("\n\n")
    : "";
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
  const sources = Array.isArray(chunks)
    ? chunks.map((x: { content: string; document_id?: string }) => ({ content: x.content, document_id: x.document_id }))
    : [];
  await admin.from("chat_messages").insert([
    { user_id: user.id, role: "user", content: message },
    { user_id: user.id, role: "assistant", content, sources },
  ]);
  return setCookiesOnResponse(c.json({ content, sources }));
});

app.get("/api/chat/history", async (c) => {
  const { supabase } = createSupabaseFromContext(c);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const { data, error } = await supabase.from("chat_messages").select("id, role, content, sources, created_at").eq("user_id", user.id).order("created_at", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
});

// --- Documents ---
const MAX_DOCS = 4;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "text/plain"];

async function extractText(buffer: Buffer, _name: string, mime: string): Promise<string> {
  if (mime === "text/plain") return buffer.toString("utf-8");
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text ?? "";
}

app.post("/api/documents/upload", async (c) => {
  const { supabase } = createSupabaseFromContext(c);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return c.json({ error: "Admin only" }, 403);
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return c.json({ error: "No file" }, 400);
  if (!ALLOWED_TYPES.includes(file.type)) return c.json({ error: "Only PDF and TXT allowed" }, 400);
  const { data: docs } = await admin.from("documents").select("size_bytes");
  const currentTotal = (docs ?? []).reduce((s, d) => s + (d.size_bytes ?? 0), 0);
  if ((docs ?? []).length >= MAX_DOCS) return c.json({ error: `Max ${MAX_DOCS} documents` }, 400);
  if (currentTotal + file.size > MAX_TOTAL_BYTES) return c.json({ error: "Total size limit 5MB" }, 400);
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractText(buffer, file.name, file.type);
  const storagePath = `documents/${crypto.randomUUID()}_${file.name}`;
  const { error: uploadErr } = await admin.storage.from("documents").upload(storagePath, buffer, { upsert: false });
  if (uploadErr) return c.json({ error: uploadErr.message }, 500);
  const { data: doc, error: docErr } = await admin.from("documents").insert({
    name: file.name,
    storage_path: storagePath,
    size_bytes: file.size,
  }).select("id").single();
  if (docErr) return c.json({ error: docErr.message }, 500);
  const chunks = chunkText(text);
  const embeddings = await embedTexts(chunks);
  const rows = chunks.map((content, i) => ({
    document_id: doc.id,
    content,
    embedding: embeddings[i],
    chunk_index: i,
  }));
  const { error: chunkErr } = await admin.from("document_chunks").insert(rows);
  if (chunkErr) {
    await admin.from("documents").delete().eq("id", doc.id);
    return c.json({ error: chunkErr.message }, 500);
  }
  return c.json({ id: doc.id, name: file.name });
});

// --- Feedback ---
const feedbackSchema = z.object({
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  q1: z.number().min(1).max(5).optional(),
  q2: z.number().min(1).max(5).optional(),
  q3: z.number().min(1).max(5).optional(),
  q4: z.number().min(1).max(5).optional(),
  q5: z.number().min(1).max(5).optional(),
  q6: z.number().min(1).max(5).optional(),
  comment: z.string().max(2000).optional(),
});

app.post("/api/feedback", async (c) => {
  const { supabase } = createSupabaseFromContext(c);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json();
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { error } = await supabase.from("feedback").upsert(
    { user_id: user.id, session_date: parsed.data.session_date, ...parsed.data },
    { onConflict: "user_id,session_date" }
  );
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.get("/api/feedback", async (c) => {
  const { supabase } = createSupabaseFromContext(c);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const { data, error } = await supabase.from("feedback").select("id, user_id, session_date, q1, q2, q3, q4, q5, q6, comment, created_at, profiles(display_name)").order("created_at", { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
});

app.post("/api/feedback/comments", async (c) => {
  const { supabase } = createSupabaseFromContext(c);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json();
  const parsed = z.object({ feedback_id: z.string().uuid(), content: z.string().min(1).max(500) }).safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { error } = await supabase.from("feedback_comments").insert({
    feedback_id: parsed.data.feedback_id,
    user_id: user.id,
    content: parsed.data.content,
  });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.get("/api/feedback/:id/comments", async (c) => {
  const { supabase } = createSupabaseFromContext(c);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const id = c.req.param("id");
  const { data, error } = await supabase.from("feedback_comments").select("id, content, user_id, created_at, profiles(display_name)").eq("feedback_id", id).order("created_at", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
});

// --- Cron ---
app.get("/api/cron/cleanup", async (c) => {
  if (c.req.header("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return c.json({ error: "Unauthorized" }, 401);
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await admin.from("chat_messages").delete().lt("created_at", today);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// --- Bootstrap ---
app.get("/api/bootstrap", async (c) => {
  if (c.req.query("secret") !== process.env.BOOTSTRAP_SECRET) return c.json({ error: "Unauthorized" }, 401);
  const admin = createAdminClient();
  const { data: profiles } = await admin.from("profiles").select("id").order("created_at", { ascending: true }).limit(1);
  if (!profiles?.length) return c.json({ error: "No profiles yet" }, 400);
  const { error } = await admin.from("profiles").update({ is_admin: true }).eq("id", profiles[0].id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true, admin_id: profiles[0].id });
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
      // fall through to SPA
    }
    const index = path.join(dist, "index.html");
    if (fs.existsSync(index)) {
      return c.html(fs.readFileSync(index, "utf-8"));
    }
    return c.notFound();
  });
}

import { serve } from "@hono/node-server";
serve(app, { port: 3001 });
console.log("API: http://localhost:3001");

export default app;
