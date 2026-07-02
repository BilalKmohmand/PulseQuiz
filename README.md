## Pulse Quiz Platform

Animated quiz experience built with Next.js, Tailwind, Framer Motion, and Supabase. Teachers unlock a cockpit with a PIN, upload multiple-choice questions, and publish a single 10-minute quiz that students can take after registering with strong credentials.

## Requirements

- Node.js 18+
- Supabase project (free tier is fine)

## Environment variables

Create a `.env.local` file in the project root and add your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Restart `npm run dev` after adding or changing env values.

## Supabase schema

The app uses three shared tables so every device sees the same quiz, roster, and results. Run this SQL in the Supabase SQL editor:

```sql
-- Student roster (plaintext password per request)
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  password text not null,
  created_at timestamptz default now()
);

-- Single active quiz (stored as JSON payload)
create table if not exists public.quizzes (
  id text primary key,
  payload jsonb not null,
  published_at timestamptz default now()
);

-- Student attempt results
create table if not exists public.results (
  id text primary key,
  quiz_id text,
  student_name text,
  score int,
  total int,
  percentage int,
  submitted_at timestamptz,
  duration int,
  answers jsonb,
  reason text
);

-- Enable RLS and allow the anon client full access (simple classroom setup)
alter table public.students enable row level security;
alter table public.quizzes enable row level security;
alter table public.results enable row level security;

create policy "anon all students" on public.students for all using (true) with check (true);
create policy "anon all quizzes"  on public.quizzes  for all using (true) with check (true);
create policy "anon all results"  on public.results  for all using (true) with check (true);
```

Passwords are stored as plain text in `students.password`. RLS is left fully open for a simple classroom deployment; tighten it if you need stricter access.

## Install & run locally

```bash
npm install
npm run dev
```

Visit http://localhost:3000.

## Importing a quiz from JSON

Teachers can paste JSON or upload a `.json` file in the builder to fill every question at once, then review and publish. Expected shape:

```json
{
  "title": "Photosynthesis Sprint",
  "description": "Quick check",
  "questions": [
    { "prompt": "2 + 2?", "options": ["3", "4", "5", "6"], "answerIndex": 1 }
  ]
}
```

- `title` and `description` are optional.
- Each question needs a `prompt` and at least two non-empty `options`.
- `answerIndex` is the zero-based index of the correct option (`answer` is also accepted); it defaults to `0` if omitted.

## Usage notes

- Students must register with a unique name and a password that is **at least 8 characters**. The UI disables buttons and shows progress copy while Supabase requests run.
- Teacher access stays hidden unless the PIN is entered (PIN is defined inside `src/app/page.tsx` but never shown in the UI).
- Quiz content, results, and the student roster are stored in Supabase and polled every few seconds so every device stays in sync. Only the logged-in session is cached in `localStorage`.

## Folder highlights

- `src/app/page.tsx` – full teacher/student experience plus Supabase auth calls.
- `src/lib/supabaseClient.ts` – client factory that reads the env vars above.
# PulseQuiz
