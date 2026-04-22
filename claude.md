# claude.md — Tuunup Project Instructions for Claude Code

## What This App Does
Tuunup helps everyday car owners find and proactively replace the parts most likely to fail on their specific vehicle. Users pick their car, see the top known issues sorted easiest-to-fix first, and get plain-language repair guides with part recommendations.

**Keep it simple. The whole point is making car repair approachable for non-mechanics.**

---

## Stack
- **Framework:** Next.js (App Router) with TypeScript
- **Database:** Supabase (Postgres)
- **Deployment:** Vercel, auto-deploys from GitHub `main`
- **Import alias:** Use `@/` for all internal imports (configured in tsconfig)

---

## Supabase Clients
- **Public (read-only):** `@/lib/supabaseClient.ts`
- **Admin (write access):** `@/lib/supabaseAdmin.ts`
- Always use the admin client in API routes that write data
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client side

---

## Database Tables (Quick Reference)

```
makes → models → years → vehicle_generations
                                ↓
                             issues  (top 25 per generation, auto-populated)
                                ↓
                              jobs   (1 per issue — the repair guide)
                                ↓
                             parts   (up to 3 tiers per job: economy / daily_driver / performance)

source_documents  ← raw ingested data, never shown to users
```

Key fields on `issues`:
- `complaint_count` — used to rank which issues make the top 25
- `sort_order` — display order (1 = easiest/cheapest first)
- `fix_difficulty` — `diy_easy` | `diy_moderate` | `professional`
- `estimated_cost_low` / `estimated_cost_high` — repair cost in USD

---

## Data Ingestion Rules

1. **Fully automated** — no human approval step. Data ingests and goes live automatically.
2. **Top 25 issues only** per vehicle generation (ranked by `complaint_count`)
3. **Sort order** = cheapest + easiest fix first, most expensive + hardest last
4. **Deduplicate** using `content_hash` (SHA-256) on `source_documents` — skip if hash already exists
5. Primary source: **NHTSA Complaints API** — `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=MAKE&model=MODEL&modelYear=YEAR`

The old candidate/promote pattern is **deprecated**. Do not rebuild or reference it. Issues are written directly to the `issues` table after extraction.

---

## API Routes Pattern

All routes live in `app/api/[route]/route.ts` following Next.js App Router conventions.

| Route | Purpose |
|---|---|
| `/api/ingest/nhtsa` | Fetch + store NHTSA data into source_documents |
| `/api/extract` | Parse source_documents → write issues + jobs |
| `/api/vehicles` | Return makes/models/years for the vehicle selector UI |

When writing new routes:
- Use `import crypto from "crypto"` for hashing
- Always pass `source_document_id` when creating related records
- Return clear JSON error messages with appropriate HTTP status codes

---

## Pages & Routing

| Page | Path | Notes |
|---|---|---|
| Home | `app/page.tsx` | Vehicle search entry point |
| Results | `app/results/` | Uses `?gen=` URL param for generation ID |
| Job Detail | `app/job/[jobId]/` | Shows full repair guide |

Use server components by default. Only add `"use client"` when you need interactivity (e.g. dropdowns, buttons).

---

## Issue Display Rules

Always fetch issues ordered by `sort_order ASC`.

Display difficulty as friendly labels (not raw DB values):
- `diy_easy` → "You can do this at home"
- `diy_moderate` → "Handy owners can tackle this"
- `professional` → "Best left to a mechanic"

Safety badges:
- `high` → red badge "Safety concern"
- `medium` → yellow badge "Watch this"
- `low` → no badge

---

## Parts Tiers

Each job can have up to 3 part options. Display as a simple comparison — all tiers are better than the original OEM part.

| DB value | User label |
|---|---|
| `economy` | "Good" |
| `daily_driver` | "Better" |
| `performance` | "Best" |

`affiliate_url` is nullable — don't require it. It's a future monetization feature.

---

## Env Variables

Required locally in `.env.local` and in Vercel dashboard:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## Code Style

- TypeScript everywhere — no `any` types if avoidable
- Keep components small and focused
- Write UI copy in plain, friendly language — no jargon
- No over-engineering — this is a content + data site, not a complex SaaS
- When in doubt, simpler is better

---

## What NOT to Build

- ❌ No candidate/promote/staging workflow — it's been removed
- ❌ No user accounts (yet) — auth comes in a later phase
- ❌ No repair shop finder
- ❌ No VIN lookup (not in scope for MVP)
- ❌ Don't try to ingest every issue ever reported — top 25 per generation only
