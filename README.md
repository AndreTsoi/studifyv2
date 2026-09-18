# Study Journal

**Turn your study reflections into a clearer next step.**

A Next.js + TypeScript journal with device-local storage, automatic AI reflection after device-level permission, and minimal setup. Built from the original Study Analyzer README, then reframed around student reflections rather than exam-based productivity scores.

## Experience

- Journal: required context, location label, one or more study methods, and a reflection. Course and duration are optional. Custom locations and methods are remembered.
- On first use with AI connected, the review step asks permission to automatically send saved entries and study context to OpenAI. Permission is remembered on this device and can be disabled in Settings. Save & reflect saves locally first, then requests a tentative interpretation and at most one follow-up. Without permission or a connection, saving remains local. There is no automatic backfill.
- Students write their own takeaway, correct the AI, and choose optional next steps.
- Patterns groups actual entries by location and method. Optional AI interpretation considers up to 12 latest entries and links to supporting entries.
- Next steps contains intentions linked to the source reflection, with optional dates and completion tracking.

No GPS, syllabus upload, mandatory course setup, or generated productivity scores. Sample entries are isolated from personal records and never presented as live AI output.

## Run

Requires Node.js 24 LTS and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Settings offers a sample journal.

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

Clearing browser data removes entries. Devices, browser profiles, and site origins have separate storage. Saving alone sends no journal content to the server. AI requests send only the selected entries with visible disclosure; provider data policies still apply. Redis holds short-lived counters and daily hashed IP identifiers, not journal content. Google Fonts supplies fonts; hosting providers may record ordinary access logs.

## Earlier Study Analyzer records

The earlier tracker remains at `/history`, linked in Settings. It still uses `study-analyzer.v1` for courses, sessions, grades, backups, and PDF/Word reports. Existing course names are suggested in a new journal. Historical sessions are not converted into fabricated reflections.

Journal backups cover journal entries; export earlier tracker data separately when moving devices. The earlier algorithms are described in `ANALYTICS.md` and no longer drive the main journal experience.

## Deploy

Import this directory into Vercel as a Next.js project with Node.js 24. The journal works with no environment variables; add the server-side values above for AI. `vercel.json` supplies the framework preset. The app is locally built and previewed but has not been published to Vercel.

## Structure

- `components/journal.tsx`: journal, entry form, reflections, patterns, next steps.
- `lib/journal.ts`: journal schemas, historical dates, grouping, demo fixture.
- `lib/ai-contract.ts`: bounded requests, evidence validation, reflection prompt.
- `app/api/reflect/route.ts`: provider integration and shared request allowance.
- `app/history/page.tsx`: preserved tracker and reports.
- `tests/`: journal validation and earlier analysis tests.

## Verification

14 automated tests cover required journal context, optional fields, remembered multi-select methods, valid backups, duplicate IDs, dates, evidence IDs, bounded AI requests, and earlier grading rules. Production compilation and type checking pass.

Browser checks cover Save only, required fields, remembered custom choices, takeaways, completed next steps after reload, and navigation. The unconfigured AI endpoint returns 503 without a provider call.

Live OpenAI/Upstash integration and response quality have not been verified because credentials were unavailable. Evaluate representative student reflections before enabling public AI access.

Future work includes deletion with recovery, stronger concurrent-write handling, journal PDF/Word exports, provider integration tests, and measured reflection-quality evaluation. Practice generation is outside the current primary experience.

## Home dashboard and navigation

Home is the default page. It shows the last seven calendar days of recorded entries and optional study duration, open next steps, the latest entry with a personal takeaway, three recent sessions, and real AI suggestions awaiting review. Missing durations are explicitly counted; no productivity scores or fabricated AI summaries are shown. Journal remains the complete searchable entry history.

Opening an entry preserves a return link to its source section. The new-entry popup closes using its close button, Escape, or a click outside its bounds. Unfinished entry fields and selected location/methods are retained in memory when dismissed and reopened in the same tab. These drafts are not saved across reloads and are cleared when switching sample/personal workspaces; successful saves clear the corresponding draft.

Browser verification covered dashboard updates after saving a takeaway or completing a step, links to journal history and back to Home, outside-click/Escape dismissal, draft restoration, and the mobile dashboard layout. The production build passes.

## Visual design

The journal interface uses warm neutral surfaces, dark ink, a restrained green accent, serif page titles, and ruled lists. Home prioritizes recent writing alongside upcoming actions; totals are an inline strip rather than separate cards. Empty AI suggestion panels are hidden until real suggestions exist. The earlier tracker retains its previous visual theme.

Session logging uses four steps: session details, location and methods, reflection, and review. Next validates the current step; Back preserves answers. Closing and reopening the composer restores its draft and step until the page reloads.

Navigation: Home (log sessions, recent entries, saved next steps), Journal (search and edit past entries), Insights (context comparisons, saved takeaways, optional AI themes). After permission, the primary action is Save & reflect. AI reflection appears directly in the saved entry, with loading and retry states. Personal takeaways remain expandable. Connection failures never discard saved entries.
