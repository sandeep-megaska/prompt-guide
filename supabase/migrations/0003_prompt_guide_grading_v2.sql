alter table public.pg_lab_attempts
  add column if not exists feedback_version text not null default 'v2',
  add column if not exists rubric_snapshot_json jsonb,
  add column if not exists critique_json jsonb,
  add column if not exists rewrite_json jsonb,
  add column if not exists model_critique text,
  add column if not exists model_rewrite text,
  add column if not exists tokens_in integer,
  add column if not exists tokens_out integer,
  add column if not exists latency_ms integer,
  add column if not exists grader_confidence numeric(5,2),
  add column if not exists highest_impact_fix text;

create index if not exists pg_lab_attempts_feedback_version_idx
  on public.pg_lab_attempts (feedback_version);

alter table public.pg_labs
  add column if not exists rubric_version text not null default 'v1';
