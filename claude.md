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

## Actual Database Schema (verified 2026-04)

### Data flow
```
makes → models → vehicle_generations
                        ↓
              source_documents   (raw NHTSA complaint data)
                        ↓
                     issues      (one row per unique component/source pair)
                        ↓
               vehicle_issues    (junction — links issue to generation + stores scores)
                        ↓
                  issue_jobs     (junction — links issue to job)
                        ↓
                      jobs       (the repair guide)
                        ↓
                  job_parts      (junction — links job to parts)
                        ↓
                     parts       (part options, tiered by quality)
```

### `makes`
- `id` (uuid), `name` (text)

### `models`
- `id` (uuid), `make_id` (uuid FK → makes), `name` (text)

### `vehicle_generations`
- `id` (uuid), `model_id` (uuid FK → models)
- `name` (text) — e.g. "8th Gen"
- `year_start` (int), `year_end` (int) — NOTE: `year_start`/`year_end`, NOT `start_year`/`end_year`
- `platform_code` (text, nullable), `notes` (text, nullable)

### `source_documents`
- `id` (uuid), `source_id` (uuid FK → sources)
- `url` (text), `external_id` (text, nullable)
- `raw_text` (text), `raw_json` (jsonb, nullable)
- `content_hash` (text) — SHA-256, used for deduplication
- `document_type` (text, default 'generic') — use `"nhtsa_complaint"` for NHTSA data
- `vehicle_generation_id` (uuid, nullable) — links doc to generation
- `status` (text, default 'new'), `fetched_at` (timestamptz), `created_at` (timestamptz)

### `sources`
- `id` (uuid), `source_type` (text), `name` (text)
- `base_url` (text, nullable), `subreddit` (text, nullable)
- `is_active` (boolean, default true), `notes` (text, nullable)
- Always look up or create a sources row before inserting source_documents

### `issues`
- `id` (uuid), `title` (text), `summary` (text)
- `component` (text) — normalized component name e.g. "Engine"
- `system_tag` (text, nullable) — same value as component
- `safety_level` (integer, default 0) — 0=low, 1=medium, 2=high. MUST be integer not string.
- `source` (text) — e.g. "nhtsa_complaints"
- `created_at` (timestamptz)
- NOTE: issues do NOT have vehicle_generation_id — that link lives in vehicle_issues
- Upsert conflict key: `(component, source)`

### `vehicle_issues` (junction — issue ↔ generation + scores)
- `id` (uuid), `vehicle_generation_id` (uuid FK), `issue_id` (uuid FK)
- `rank_score` (numeric) — use complaint count as proxy
- `frequency_score` (numeric) — complaint_count / max_complaint_count, 0–1 scale
- `severity_score` (numeric) — 0.8 if crash/fire, 0.4 otherwise
- `urgency_score` (numeric, nullable)
- `confidence` (numeric) — default 0.7 for NHTSA data
- `mileage_start` / `mileage_end` (int, nullable)
- `cost_diy_parts_low` / `cost_diy_parts_high` (numeric) — placeholder 0
- `cost_shop_low` / `cost_shop_high` (numeric) — placeholder 0
- `cost_of_failure_low` / `cost_of_failure_high` (numeric, nullable)
- Upsert conflict key: `(vehicle_generation_id, issue_id)`

### `jobs`
- `id` (uuid), `title` (text)
- `layman_steps` (text) — plain text, NOT an array
- `difficulty` (text) — `"diy_easy"` | `"diy_moderate"` | `"professional"`
- `tool_list` (text, nullable) — plain text, NOT an array
- `disclaimer` (text, nullable)
- `time_minutes_low` (int, nullable), `time_minutes_high` (int, nullable)
- `created_at` (timestamptz)
- NOTE: jobs do NOT have issue_id — that link lives in issue_jobs

### `issue_jobs` (junction — issue ↔ job)
- `id` (uuid), `issue_id` (uuid FK), `job_id` (uuid FK)
- `recommended_order` (int, default 1), `notes` (text, nullable)
- Upsert conflict key: `(issue_id, job_id)`

### `parts`
- `id` (uuid), `name` (text)
- `quality_tier` (text, default 'oem_equivalent') — `"economy"` | `"daily_driver"` | `"performance"`
- `part_type` (text, nullable), `brand` (text, nullable)
- `upgrade_reason` (text, nullable), `warranty_months` (int, nullable)

### `job_parts` (junction — job ↔ part)
- `id` (uuid), `job_id` (uuid FK), `part_id` (uuid FK)
- `recommended_rank` (int, default 1), `fitment_notes` (text, nullable)

### `shop_accounts` (future — Phase 3 mechanic referral)
- `id` (uuid), `owner_user_id` (uuid), `shop_name` (text)
- `website` (text, nullable), `phone` (text, nullable)

### `leads` (future — Phase 3 mechanic referral)
- `id` (uuid), `shop_account_id` (uuid), `user_vehicle_id` (uuid)
- `job_id` (uuid), `message` (text, nullable)

### `user_vehicles` (future — Phase 2 My Garage)
- `id` (uuid), `user_id` (uuid), `vehicle_generation_id` (uuid)
- `year` (int), `mileage` (int, nullable), `ownership_mode` (text)

### Deprecated tables — never write to these:
- `issue_candidates`, `job_candidates` — old staging tables, ignore entirely

---

## Ingest Route (`/api/ingest/nhtsa`)

**Accepts:** `POST { make, model, year, vehicleGenerationId }`

**Flow:**
1. Look up or create a row in `sources` where `source_type = "nhtsa"` and `name = "NHTSA Complaints"`
2. Call NHTSA complaints API: `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=MAKE&model=MODEL&modelYear=YEAR`
3. NHTSA response shape: `{ results: [{ ODINumber, components, summary, crash, fire, numberOfDeaths, numberOfInjuries, productDescription }] }`
4. For each complaint, build a text blob, SHA-256 hash it, upsert into `source_documents` on `content_hash` conflict
5. Store `vehicle_generation_id` on each `source_documents` row
6. Store full complaint object in `raw_json`
7. Return `{ ok, fetched, inserted, skipped }`

---

## Extract Route (`/api/extract`)

**Accepts:** `POST { vehicleGenerationId }`

**Flow:**
1. Fetch `source_documents` where `vehicle_generation_id = vehicleGenerationId` and `document_type = "nhtsa_complaint"`
2. Parse `raw_json.components`, run through `normalizeComponent()`, group + count by normalized name
3. Take top 25 by complaint count
4. For each component write in this exact order:
   - Upsert `issues` on `(component, source)` → capture issue `id`
   - Upsert `vehicle_issues` on `(vehicle_generation_id, issue_id)` with scores
   - If issue was newly created: insert `jobs`, then insert `issue_jobs`
5. Return `{ ok, documentsProcessed, uniqueComponents, issuesCreated, jobsCreated, skipped }`

---

## Admin Page (`/admin/ingest`)

Only show two sections:
1. **NHTSA Ingestion** — fields for make, model, year, vehicleGenerationId + "Ingest" button
2. **Extraction** — field for vehicleGenerationId + "Run Extraction" button

Remove: Dealer ingestion section, Reddit ingestion section (both deprecated).
Update description copy — no mention of "candidates" or "review."

---

## Pages & Routing

| Page | Path | Notes |
|---|---|---|
| Home | `app/page.tsx` | Vehicle search entry point |
| Results | `app/vehicle/results/` | Uses `?gen=` URL param for generation ID |
| Job Detail | `app/job/[jobId]/` | Shows full repair guide |
| Admin Ingest | `app/admin/ingest/` | Dev only — trigger pipeline |

---

## Issue Display Rules

Fetch issues via `vehicle_issues` joined to `issues`, ordered by `rank_score DESC`.

Difficulty labels:
- `diy_easy` → "You can do this at home"
- `diy_moderate` → "Handy owners can tackle this"
- `professional` → "Best left to a mechanic"

Safety badges (safety_level is an integer):
- `2` → red badge "Safety concern"
- `1` → yellow badge "Watch this"
- `0` → no badge

---

## Env Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## Code Style

- TypeScript everywhere — no `any` types if avoidable
- Keep components small and focused
- Plain, friendly UI copy — no jargon
- No over-engineering — content + data site, not complex SaaS
- Simpler is always better

---

## What NOT to Build

- ❌ No candidate/promote/staging — fully removed
- ❌ No user accounts yet — later phase
- ❌ No repair shop finder yet — Phase 3
- ❌ No VIN lookup — not in MVP scope
- ❌ Top 25 issues per generation only — do not ingest everything
- ❌ Never write to issue_candidates or job_candidates