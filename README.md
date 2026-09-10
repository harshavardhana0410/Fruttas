# Frutta Kitchen Ops

Digital replacement for two paper forms used in Frutta's commercial kitchens:

1. **Frutta Kitchen Audit Report** — 16-point daily Yes/No inspection
2. **Item Check List** — per-item planned vs actual quantity, taste, measuring type

React 18 + TypeScript + Vite + Tailwind v4 on the front, Supabase (Postgres,
Auth, Realtime, Storage) behind it.

This is a food-safety compliance system. Two rules shape the whole design:

- **A filed submission is immutable.** No edit, no delete, for anyone.
- **Scores are computed by the database, never the client.** A client that
  scores its own audit is not an audit.

---

## Running it

### 1. Database

You need either Docker (for a local stack) or a hosted Supabase project.

**Local:**
```bash
npx supabase start
npx supabase db reset      # applies migrations + seed
```

**Hosted:**
```bash
npx supabase link --project-ref <your-ref>
npx supabase db push
npx supabase functions deploy create-team-member
```

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` — printed by
`supabase start`, or under Dashboard → Project Settings → API.

**Only the publishable key.** Vite inlines every `VITE_`-prefixed variable into
the bundle, so a `service_role` key there is a full database breach. Being
gitignored does not make it secret once it has been bundled.

### 3. The admin account

Public signup is disabled (`config.toml`), so the first account is created
through the Auth admin API. The `on_auth_user_created` trigger promotes the
**first account on an empty database** to admin automatically.

Local: Studio → Authentication → Add user.

Hosted:
```bash
curl -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"<a real password>","email_confirm":true,"user_metadata":{"name":"Your Name"}}'
```

Confirm it worked:
```sql
select name, staff_id, role from public.profiles;
-- exactly one row, role = 'admin'
```

### 4. App

```bash
npm install
npm run dev
```

Sign in with that email and password. Then, in order: add a kitchen, add team
members, and the app is live.

---

## What is in the database

| Table | Holds |
|---|---|
| `kitchens` | Sites. Carries its own `timezone` — see below |
| `profiles` | One row per auth user. Role and kitchen assignment live here |
| `inspection_points` | The audit template. Archived, never deleted |
| `item_presets` | Suggestions offered while filling the item list |
| `submissions` | One row per filed form. Immutable |
| `audit_answers` | 16 rows per audit, with the point wording snapshotted |
| `submission_items` | The item rows of an item check list |
| `answer_photos` | Pointers into the private `audit-photos` bucket |

Seeded on a fresh database: **one admin** (via the trigger) and the **16 real
inspection points** transcribed from the paper form. Nothing else. No kitchens,
no submissions, no fabricated history.

---

## Design decisions that will look wrong until you read why

**`audit_answers` duplicates the inspection point's wording.**
Not a normalisation mistake. Admins can reword the template; if answers only
held `point_id`, editing it would retroactively change what every historical
audit claims to have checked. In a compliance system that is falsifying
records. `point_id` survives only as a soft link for failure aggregation.

**`kitchens.timezone` exists, and `form_date` comes from it.**
Servers run UTC. An audit filed at 02:00 IST would otherwise be filed against
the previous day, silently corrupting the daily compliance record.

**Submissions have no INSERT policy.**
Writes go exclusively through `submit_audit` / `submit_item_list`, which are
`security definer` and compute `issues` and `compliance` themselves. Anything
the client sends for kitchen, date, submitter or score is discarded.

**Role is read from `profiles`, not from JWT claims.**
Claims are stale until the token refreshes. When an admin is demoted, it should
take effect now, not in an hour.

**Drafts stay in `localStorage`.**
Deliberately device-local and synchronous. Kitchens have unreliable Wi-Fi and a
half-filled checklist must survive a refresh without a round trip.

**`WITH ORDINALITY`, not `row_number() over ()`.**
An empty window has no defined ordering. Item serials would come back shuffled
and the filed list would not match what the person entered.

---

## Frontend structure

```
src/
  styles/tokens.css     design tokens; base CSS lives inside @layer
  lib/
    supabase.ts         the single client
    data.ts             every read and write in the app
    session.tsx         auth context, motion + online hooks
    useRealtime.ts      submission and template subscriptions
    types.ts            shared types (camelCase; data.ts maps to snake_case)
    format.ts           dates, variance, number helpers
  components/           layout, ui, forms, data
  pages/                one file per route
supabase/
  migrations/           schema, RLS, RPCs, realtime, storage
  seed.sql              16 inspection points, nothing else
  functions/
    create-team-member/ the only operation needing service_role
```

`data.ts` remains the single seam. Components never touch Supabase directly.

---

## Design constraints (frontend)

Deliberate, not oversights:

- Colour is semantic only — status badges, Yes/No selection, compliance
  figures. Never section backgrounds or button fills.
- One border treatment: `1px` hairline. Two shadows exist in the whole app.
- Serif for page titles and dashboard figures only; never inside a form.
- Monospace for every number meant to be compared or scanned.
- 48px minimum touch targets, 52px for Yes/No. Under 420px the quantity
  steppers stack rather than shrink.
- Entry animation is opt-in behind `prefers-reduced-motion: no-preference`, so
  content is visible by default. No animation may be why someone cannot read a
  checklist.
- Base CSS sits inside `@layer`. Unlayered CSS beats Tailwind's layered
  utilities regardless of specificity and silently breaks every `text-*` class.

---

## Known gaps

- **Photo upload is best-effort.** If it fails, the audit still files — the
  record matters more than the attachment. Failures are currently silent.
- **`Print` and `Export PDF`** both open the browser print dialog, which has
  "Save as PDF". There is no PDF library.
- **Offline banner reflects `navigator.onLine` only.** Real queue-and-sync
  needs a service worker.
- **Theme control stores a preference**; the app is light-only this phase.
- **Records search covers submitter and client ID**, not kitchen name — kitchen
  is a separate dropdown filter.
- **The role selector was removed from sign-in.** Role comes from `profiles`.
