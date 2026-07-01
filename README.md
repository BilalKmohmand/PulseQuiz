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

Create a table named `students` with the following shape:

| column        | type   | constraints                              |
|---------------|--------|-------------------------------------------|
| id            | uuid   | primary key, default `uuid_generate_v4()` |
| name          | text   | unique, not null                          |
| password_hash | text   | not null                                  |

Student passwords are hashed with bcrypt before being stored. No other tables are required for auth.

## Install & run locally

```bash
npm install
npm run dev
```

Visit http://localhost:3000.

## Usage notes

- Students must register with a unique name and a password that is **at least 8 characters**. The UI disables buttons and shows progress copy while Supabase requests run.
- Teacher access stays hidden unless the PIN is entered (PIN is defined inside `src/app/page.tsx` but never shown in the UI).
- Quiz content, leaderboard entries, and unlocked session state are cached in `localStorage`, while student credentials live only in Supabase.

## Folder highlights

- `src/app/page.tsx` – full teacher/student experience plus Supabase auth calls.
- `src/lib/supabaseClient.ts` – client factory that reads the env vars above.
# PulseQuiz
