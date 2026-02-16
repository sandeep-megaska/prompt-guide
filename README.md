# Prompt Guide

Prompt Guide is a Next.js (App Router + TypeScript) starter for prompt-engineering labs with Supabase Auth/Postgres and server-side OpenAI evaluation.

## Stack

- Next.js App Router + TypeScript
- Supabase Auth + Postgres + Row Level Security
- `@supabase/ssr` for SSR auth session handling
- OpenAI evaluation in server route handlers only

## 1) Create a new Supabase project

1. Create a project at https://supabase.com.
2. In **Project Settings > API**, copy:
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. (Optional) Copy service role key for maintenance tasks:
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

## 2) Configure environment variables

```bash
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (optional)

## 3) Supabase CLI workflow (new project)

```bash
supabase init
supabase link --project-ref <your-project-ref>
supabase db push
```

Migrations are numeric and stored in `supabase/migrations`:

- `0001_prompt_guide_base.sql`
- `0002_prompt_guide_seed.sql`

## 4) Install + run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## 5) Build verification

```bash
npm run build
```

## 6) Deploy to Vercel

1. Import this repo in Vercel.
2. Configure environment variables in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`
   - optional `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy.

## API contracts

### `POST /api/evaluate`

Request body:

```json
{ "labId": "uuid", "userPrompt": "..." }
```

Success response:

```json
{
  "ok": true,
  "attemptId": "uuid",
  "feedback": {
    "score_total": 0,
    "score_breakdown": {},
    "issues": [{ "title": "", "severity": "low", "fix": "" }],
    "rewrite": "",
    "explanation": "",
    "next_steps": [""]
  }
}
```

Failure behavior: if OpenAI returns non-parseable JSON, API returns `ok: false` and no attempt row is written.
