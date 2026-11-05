-- English Wasteland chapter 2: independent progress so chapter 1 is never overwritten.
-- Already applied to the linked Supabase project. Run only for a fresh installation.
create table if not exists public.chapter_progress (
 child_id uuid not null references public.children(id) on delete cascade,
 chapter integer not null check (chapter between 2 and 100),
 game_state jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(),
 primary key(child_id,chapter)
);
alter table public.chapter_progress enable row level security;
grant select, insert, update on public.chapter_progress to authenticated;
create policy "parent and learner read chapter progress" on public.chapter_progress
 for select to authenticated using (
 exists(select 1 from public.children c where c.id=child_id
   and (c.parent_id=(select auth.uid()) or c.learner_user_id=(select auth.uid())))
 );
create policy "learner inserts chapter progress" on public.chapter_progress
 for insert to authenticated with check (
 exists(select 1 from public.children c where c.id=child_id and c.learner_user_id=(select auth.uid()))
 );
create policy "learner updates chapter progress" on public.chapter_progress
 for update to authenticated using (
 exists(select 1 from public.children c where c.id=child_id and c.learner_user_id=(select auth.uid()))
 ) with check (
 exists(select 1 from public.children c where c.id=child_id and c.learner_user_id=(select auth.uid()))
 );