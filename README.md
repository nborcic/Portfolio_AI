# Portfolio AI

Vite + React + TypeScript + Tailwind RAG app. Invite-only auth, admin document upload, strict RAG answers, session feedback.

## Stack

- **Vite 6** + **React 19** (frontend)
- **Hono** (API server on Node)
- **Supabase** (auth, Postgres, pgvector, storage)
- **Groq** (chat, free tier)
- **Hugging Face** (embeddings, free tier)

## Setup

1. **Supabase**
   - Create project at supabase.com
   - Run migrations: paste `supabase/migrations/*.sql` in SQL editor
   - Create storage bucket `documents` (or run migration 002)
   - Copy URL + anon key + service role key

2. **Env** – copy `.env.example` to `.env.local` and fill (see `.env.example`).

3. **First admin**
   - Create invite: `npm run seed` (uses `SUPABASE_SERVICE_ROLE_KEY`)
   - Open the printed link, enter your name, sign in
   - Call `GET /api/bootstrap?secret=YOUR_BOOTSTRAP_SECRET` once

4. **Invite flow**
   - Admin goes to `/admin` → Create invite link
   - Send link → user enters name (no email)

## Dev

```bash
npm install
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:3001 (proxied from `/api`)

## Build + production

```bash
npm run build
npm run start
```

Serves API + static build on port 3001. For cron, call `GET /api/cron/cleanup` with `Authorization: Bearer YOUR_CRON_SECRET` (e.g. from Vercel Cron or a scheduler).

## Limits

- 4 documents max, 5MB total
- PDF and TXT only
- Chat history cleared daily (cron)
