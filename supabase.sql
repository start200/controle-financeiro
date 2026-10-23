-- FinanFlow: execute uma vez no SQL Editor do seu projeto Supabase.
-- Cada usuário autenticado só consegue ler e alterar os próprios lançamentos.

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 110),
  kind text not null check (kind in ('expense', 'income')),
  category text not null check (char_length(trim(category)) between 1 and 70),
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  paid boolean not null default false,
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists entries_owner_due_idx on public.entries(user_id, due_date);
alter table public.entries enable row level security;

revoke all on table public.entries from anon;
revoke all on table public.entries from authenticated;
grant select, insert, update, delete on table public.entries to authenticated;

-- Pode executar novamente com segurança se precisar corrigir políticas.
drop policy if exists "entries_select_own" on public.entries;
drop policy if exists "entries_insert_own" on public.entries;
drop policy if exists "entries_update_own" on public.entries;
drop policy if exists "entries_delete_own" on public.entries;

create policy "entries_select_own" on public.entries
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "entries_insert_own" on public.entries
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "entries_update_own" on public.entries
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "entries_delete_own" on public.entries
  for delete to authenticated using ((select auth.uid()) = user_id);
