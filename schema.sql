-- Run once in a NEW Supabase project: SQL Editor -> New query -> Run.
-- Child is anonymous Supabase Auth user; parent uses normal email/password Auth.
create extension if not exists pgcrypto;

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  learner_user_id uuid unique references auth.users(id) on delete set null,
  nickname text not null default 'Исследователь' check (length(nickname) <= 30),
  pair_code text unique default upper(substr(encode(gen_random_bytes(12),'hex'),1,16)),
  pair_expires_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);
create table if not exists public.attempts (
  id uuid primary key,
  child_id uuid not null references public.children(id) on delete cascade,
  chapter integer not null default 1,
  task_id text not null,
  kind text not null,
  word text not null,
  skill text not null,
  given_answer text not null default '',
  expected_answer text not null default '',
  correct boolean not null,
  hint_used boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists attempts_child_date on public.attempts (child_id,created_at desc);
create table if not exists public.progress (
  child_id uuid primary key references public.children(id) on delete cascade,
  game_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.homework_assignments (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  title text not null default 'Повторение',
  words text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

alter table public.children enable row level security;
alter table public.attempts enable row level security;
alter table public.progress enable row level security;
alter table public.homework_assignments enable row level security;

create policy "parent manages own children" on public.children
  for all to authenticated
  using (parent_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false)
  with check (parent_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy "learner sees own profile" on public.children for select to authenticated
  using (learner_user_id=(select auth.uid()));

create policy "parent and learner can read attempts" on public.attempts for select to authenticated using (
  exists(select 1 from public.children c where c.id=child_id
    and (c.parent_id=(select auth.uid()) or c.learner_user_id=(select auth.uid())))
);
create policy "learner records own attempts" on public.attempts for insert to authenticated with check (
  exists(select 1 from public.children c where c.id=child_id and c.learner_user_id=(select auth.uid()))
);
-- Upsert idempotency may need UPDATE permission on duplicate attempts; use explicit narrow policy.
create policy "learner updates own attempts" on public.attempts for update to authenticated using (
  exists(select 1 from public.children c where c.id=child_id and c.learner_user_id=(select auth.uid()))
) with check (
  exists(select 1 from public.children c where c.id=child_id and c.learner_user_id=(select auth.uid()))
);
create policy "parent and learner read progress" on public.progress for select to authenticated using (
  exists(select 1 from public.children c where c.id=child_id
    and (c.parent_id=(select auth.uid()) or c.learner_user_id=(select auth.uid())))
);
create policy "learner creates own progress" on public.progress for insert to authenticated with check (
  exists(select 1 from public.children c where c.id=child_id and c.learner_user_id=(select auth.uid()))
);
create policy "learner updates own progress" on public.progress for update to authenticated using (
  exists(select 1 from public.children c where c.id=child_id and c.learner_user_id=(select auth.uid()))
) with check (
  exists(select 1 from public.children c where c.id=child_id and c.learner_user_id=(select auth.uid()))
);
create policy "parent assigns homework" on public.homework_assignments for insert to authenticated with check (
  exists(select 1 from public.children c where c.id=child_id and c.parent_id=(select auth.uid())
    and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false)
);
create policy "family reads homework" on public.homework_assignments for select to authenticated using (
  exists(select 1 from public.children c where c.id=child_id
    and (c.parent_id=(select auth.uid()) or c.learner_user_id=(select auth.uid())))
);

-- Pairing is one-time and requires authenticated anonymous user, no public access.
create or replace function public.claim_child(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare claimed uuid;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false then
    raise exception 'Only an anonymous learner can pair';
  end if;
  update public.children
     set learner_user_id = auth.uid(), pair_code = null, pair_expires_at = null
   where pair_code = upper(trim(p_code))
     and pair_expires_at > now() and learner_user_id is null
   returning id into claimed;
  if claimed is null then raise exception 'Code is invalid, expired or already used'; end if;
  return claimed;
end;
$$;
revoke all on function public.claim_child(text) from public, anon;
grant execute on function public.claim_child(text) to authenticated;

-- To reconnect after replacing a child's browser/device, parent may reset learner_user_id
-- and regenerate pair_code in their own children record; old attempts remain attached to child_id.
