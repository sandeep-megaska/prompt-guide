create extension if not exists "pgcrypto";

create table if not exists public.pg_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  level text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pg_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.pg_courses(id) on delete cascade,
  title text not null,
  content_md text not null,
  sort_order int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pg_labs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  difficulty text not null,
  scenario_json jsonb not null,
  rubric_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pg_lab_attempts (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.pg_labs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_text text not null,
  feedback_json jsonb,
  score_total numeric(5,2) not null default 0,
  score_breakdown_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pg_lab_attempts_user_created_idx on public.pg_lab_attempts (user_id, created_at desc);
create index if not exists pg_lab_attempts_lab_created_idx on public.pg_lab_attempts (lab_id, created_at desc);

alter table public.pg_courses enable row level security;
alter table public.pg_lessons enable row level security;
alter table public.pg_labs enable row level security;
alter table public.pg_lab_attempts enable row level security;

create policy "courses_public_read" on public.pg_courses
  for select
  to anon, authenticated
  using (true);

create policy "lessons_public_read" on public.pg_lessons
  for select
  to anon, authenticated
  using (true);

create policy "labs_public_read" on public.pg_labs
  for select
  to anon, authenticated
  using (true);

create policy "attempts_user_select" on public.pg_lab_attempts
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "attempts_user_insert" on public.pg_lab_attempts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "attempts_user_update" on public.pg_lab_attempts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
