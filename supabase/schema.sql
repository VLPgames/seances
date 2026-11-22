-- À coller dans Supabase > SQL Editor > New query, puis "Run".
-- Une ligne par utilisateur, contenant toutes ses données (séances, historique, réglages).

create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

-- Chacun ne peut lire / écrire que SA ligne.
drop policy if exists "lecture perso" on public.user_data;
drop policy if exists "ajout perso" on public.user_data;
drop policy if exists "modif perso" on public.user_data;

create policy "lecture perso" on public.user_data
  for select using (auth.uid() = user_id);
create policy "ajout perso" on public.user_data
  for insert with check (auth.uid() = user_id);
create policy "modif perso" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
