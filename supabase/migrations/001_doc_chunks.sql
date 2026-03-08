-- pgvector for embeddings (Supabase has this; enable if needed)
create extension if not exists vector;

-- Single table: chunks from docs/ folder. No auth, no RLS.
create table if not exists public.doc_chunks (
  id uuid primary key default gen_random_uuid(),
  source_file text not null,
  content text not null,
  embedding vector(384) not null,
  created_at timestamptz default now()
);

-- Optional: add index for faster search on large chunk counts (run after you have data)
-- create index idx_doc_chunks_embedding on public.doc_chunks
--   using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Similarity search: returns content for top matches above threshold
create or replace function match_doc_chunks(
  query_embedding vector(384),
  match_threshold float default 0.3,
  match_count int default 5
)
returns table (content text)
language plpgsql
security definer
as $$
begin
  return query
  select dc.content
  from public.doc_chunks dc
  where 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Allow service role (and anon if you want) to read/write; no RLS on this table
alter table public.doc_chunks enable row level security;

create policy "allow_all_doc_chunks" on public.doc_chunks
  for all using (true) with check (true);

-- Truncate table (used by app when reloading docs)
create or replace function public.truncate_doc_chunks()
returns void
language sql
security definer
as $$
  truncate public.doc_chunks;
$$;
