# Studify

**Turn your study reflections into a clearer next step.**

A Next.js + TypeScript study journal with device-local storage, optional AI reflection after device-level permission, and no account required.

## Experience

- Journal: required context, location label, one or more study methods, and a reflection. Course and duration are optional. Custom locations and methods are remembered.
- On first use with AI connected, the review step asks permission to automatically send saved entries and study context to OpenAI. Permission is remembered on this device and can be disabled in Settings. Save & reflect saves locally first, then requests a tentative interpretation and at most one follow-up. Without permission or a connection, saving remains local. There is no automatic backfill.
- Students write their own takeaway, correct the AI, and choose optional next steps.
- Insights groups actual entries by location and method. Optional AI interpretation considers up to 12 latest entries and links to supporting entries.
- Next steps contains intentions linked to the source reflection, with optional dates and completion tracking.

No GPS, syllabus upload, mandatory course setup, or generated productivity scores. Sample entries are isolated from personal records and never presented as live AI output.

## Run

Requires Node.js 24 LTS and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000 for the landing page; the app lives at `/journal`. Settings offers a sample journal.

```sh
npm test
npm run build
npm start
```

TypeScript 6 and worker threads retain full type checking in environments that restrict subprocesses.

## Enable real AI

Copy `.env.example` to `.env.local` and set these server-only values:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
AI_DAILY_LIMIT=100
```

Restart the server. On Vercel, add project environment variables and redeploy. Never expose credentials with NEXT_PUBLIC_. Both OpenAI and the shared allowance store must be configured before AI is enabled. There is no simulated response fallback.

The reflection endpoint uses OpenAI Responses with structured JSON output and store:false. Evidence IDs are checked against the actual input entries. This validates references, not the truth of the interpretation. The prompt distinguishes self-reported feelings from demonstrated learning and avoids causal claims or numerical productivity scores.

An atomic Redis reservation limits requests globally to 100 per UTC day by default and to 10 per hashed IP/day. Failed provider attempts still consume an allowance. Budget-store failure blocks requests instead of allowing unmetered use. Request bodies are capped at 48 KB and model output at 1,200 tokens. This is a call limit, not a dollar-denominated billing cap. Configure provider spend controls and deployment traffic protection before public access.

Campus networks can share an IP allowance. The endpoint trusts Vercel's forwarded IP header when available; other hosting needs trusted-proxy configuration. The global allowance is enforced independently of the client IP.

References: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenAI text generation](https://developers.openai.com/api/docs/guides/text), [Upstash REST API](https://upstash.com/docs/redis/features/restapi).

## Storage and privacy

Journal records use the validated version 2 schema and localStorage key `study-journal.v2`. Settings offers JSON backup/import; replacement requires confirmation. Cross-tab updates refresh the interface; concurrent writes remain last-write-wins.

Entries can be deleted from the entry page, or all at once in Settings. Deleting, deleting all, and importing a backup each show an Undo toast for 8 seconds; any other saved change ends the undo window.

Backups are manual downloads (`studify-backup-YYYY-MM-DD.json`). The app records the last backup (`studify-last-backup`) and shows it in Settings. Home shows a reminder when 3+ entries have never been backed up, or when entries created since the last backup are a week old or number 10+. "Later" snoozes it for 3 days (`studify-backup-snooze`). The sample journal never counts as a backup.

Clearing browser data removes entries. Devices, browser profiles, and site origins have separate storage. Saving alone sends no journal content to the server. AI requests send only the selected entries with visible disclosure; provider data policies still apply. Redis holds short-lived counters and daily hashed IP identifiers, not journal content. Google Fonts supplies fonts; hosting providers may record ordinary access logs.

## Deploy

Import this directory into Vercel as a Next.js project with Node.js 24. The journal works with no environment variables; add the server-side values above for AI. `vercel.json` supplies the framework preset. The app is locally built and previewed but has not been published to Vercel.

## Structure

- `components/landing.tsx`, `app/landing.css`: public landing page at `/`. Visitors with saved entries go straight to `/journal`.
- `components/journal.tsx`, `app/journal.css`: the app — sidebar, Home dashboard, journal, entry page, insights, next steps, settings, and the entry form.
- `app/globals.css`: base element styles and shared primitives only.
- `lib/journal.ts`: journal schemas, dates, grouping, backup download, demo fixture.
- `lib/ai-contract.ts`: bounded requests, evidence validation, reflection prompt.
- `app/api/reflect/route.ts`: provider integration and shared request allowance.
- `app/icon.svg`, `app/apple-icon.png`, `app/manifest.ts`: browser and home-screen icons, install metadata.
- `tests/`: journal validation tests.

## Verification

9 automated tests cover required journal context, optional fields, remembered multi-select methods, valid backups, duplicate IDs, dates, evidence IDs, bounded AI requests, entry deletion, and backup reminders. Production compilation and type checking pass.

Browser checks cover Save only, required fields, remembered custom choices, takeaways, completed next steps after reload, and navigation. The unconfigured AI endpoint returns 503 without a provider call.

Live OpenAI/Upstash integration and response quality have not been verified because credentials were unavailable. Evaluate representative student reflections before enabling public AI access.

Future work includes stronger concurrent-write handling, journal PDF/Word exports, provider integration tests, and measured reflection-quality evaluation. Practice generation is outside the current primary experience.

## Layout and navigation

A left sidebar holds **Log a session** (the primary action) above the pages: Home, Journal, Insights, and Next steps, with Settings at the bottom. On narrow screens it becomes a top bar of icons.

- **Home**: a daily quote with last-session, entry, and next-step counts; this week's study time with a per-day chart built from real entries (minutes when durations exist, otherwise sessions); recent sessions; and open next steps you can tick off.
- **Journal**: search, subject chips, and entries grouped by month. Opening an entry shows its notes, the AI reflection, and an always-visible takeaway and next-step form.
- **Insights**: totals, optional AI themes across recent entries, and where/how you studied as expandable bars. Counts reflect what was recorded, not productivity.
- **Next steps**: open and done lists with due dates; overdue steps are highlighted.
- **Settings**: backup export/import with last-backup status, delete all entries, the automatic-reflection switch with connection status, and the sample journal.

Session logging uses four steps: session details, location and methods, reflection, and review. Next validates the current step; Back preserves answers. Closing and reopening the form restores its draft until the page reloads. Opening an entry keeps a return link to where you came from.

The visual language is monochrome ink on an off-white canvas with white rounded panels, pill tags, and soft tinted accents. No productivity scores or fabricated AI summaries are shown.
