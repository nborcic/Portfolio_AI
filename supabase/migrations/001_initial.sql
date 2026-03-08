-- Enable pgvector for embeddings
create extension if not exists vector;

-- Users (extends Supabase auth; we store display name)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- Invite links (admin creates; user redeems)
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  used_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Documents (admin uploads; max 4, 5MB total)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null,
  size_bytes bigint not null,
  uploaded_at timestamptz default now()
);

-- Document chunks with embeddings (for RAG)
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  content text not null,
  embedding vector(384),
  chunk_index int not null,
  created_at timestamptz default now()
);

create index idx_chunks_document on public.document_chunks(document_id);
-- Skip ivfflat until you have enough chunks; sequential scan is fine for <1k chunks

-- Chat messages (per user, per day; cron deletes daily)
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb,
  created_at timestamptz default now()
);

create index idx_chat_user_created on public.chat_messages(user_id, created_at desc);

-- Feedback (whole session; 6 categories + text)
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_date date not null,
  q1 int check (q1 between 1 and 5),
  q2 int check (q2 between 1 and 5),
  q3 int check (q3 between 1 and 5),
  q4 int check (q4 between 1 and 5),
  q5 int check (q5 between 1 and 5),
  q6 int check (q6 between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique(user_id, session_date)
);

-- Comments on feedback (visible to all logged-in users)
create table public.feedback_comments (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chat_messages enable row level security;
alter table public.feedback enable row level security;
alter table public.feedback_comments enable row level security;

-- Profiles: users see own
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Invites: admins create; service role can insert (for seed)
create policy "invites_admin_all" on public.invites for all using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin)
);
-- Allow insert with created_by null for seed script (service role bypasses RLS)

-- Documents: admins manage; all authenticated read
create policy "documents_admin_all" on public.documents for all using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin)
);
create policy "documents_authenticated_read" on public.documents for select using (auth.uid() is not null);

-- Chunks: same as documents (service role for embeddings)
create policy "chunks_admin_all" on public.document_chunks for all using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin)
);
create policy "chunks_authenticated_read" on public.document_chunks for select using (auth.uid() is not null);

-- Chat: users see own
create policy "chat_own" on public.chat_messages for all using (auth.uid() = user_id);

-- Feedback: all authenticated read; users insert/update own
create policy "feedback_read_all" on public.feedback for select using (auth.uid() is not null);
create policy "feedback_insert_own" on public.feedback for insert with check (auth.uid() = user_id);
create policy "feedback_update_own" on public.feedback for update using (auth.uid() = user_id);

-- Feedback comments: all authenticated read; users insert own
create policy "feedback_comments_read" on public.feedback_comments for select using (auth.uid() is not null);
create policy "feedback_comments_insert" on public.feedback_comments for insert with check (auth.uid() = user_id);

-- RPC for similarity search (used by API with service role)
create or replace function match_chunks(
  query_embedding vector(384),
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language plpgsql
security definer
as $$
begin
  return query
  select
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;
