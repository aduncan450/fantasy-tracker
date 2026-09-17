-- Run once in the Supabase SQL editor.
create table if not exists public.leagues (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.leagues enable row level security;

create policy "public can read league" on public.leagues for select to anon, authenticated using (true);
create policy "authenticated commissioner can insert" on public.leagues for insert to authenticated with check (true);
create policy "authenticated commissioner can update" on public.leagues for update to authenticated using (true) with check (true);

-- Single-admin project: create the commissioner user, then disable public signups in Auth settings.
