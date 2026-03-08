# Portfolio AI

Simple RAG chat over your own documents. No auth. Put PDF/TXT files in the `docs/` folder; embeddings are stored in Supabase (pgvector) and reused across restarts.

## Stack

- **Vite** + **React** (frontend)
- **Hono** (API)
- **Supabase** (pgvector for embeddings only)
- **Groq** (chat, free tier)
- **Hugging Face** (embeddings, free tier)


On startup the server reads `docs/`, chunks and embeds with HF, and upserts into Supabase. Chat uses the DB for similarity search.

Serves the app and API on port 3001.
