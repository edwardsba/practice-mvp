<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This project uses **Next.js 16** (App Router) with breaking changes vs older docs/training data.
APIs, conventions, and file structure may differ. Before changing routing, caching, request
APIs, Proxy, or Server Actions, check the installed package docs under
`node_modules/next/dist/docs/` (when present) or the current Next.js 16 docs. Heed deprecation notices.

Notable Next 16 conventions already used here:

- Root `proxy.ts` exports `proxy` (not `middleware.ts` / `middleware`)
- `params`, `searchParams`, and `cookies()` are async — always `await` them
- Lint via `npm run lint` (ESLint directly); do not use removed `next lint`
<!-- END:nextjs-agent-rules -->

# practice-mvp — Agent Guide

Australian mental-health **clinical practice management** app for practitioners: clients,
appointments, psychometric assessments, session notes, treatment/crisis plans, reports,
funding (Medicare/NDIS/insurer), contacts, and communications.

Treat all client and clinical data as sensitive health information.

## Stack

| Area | Choice |
|------|--------|
| Framework | Next.js 16.2.x, React 19, TypeScript (strict), App Router |
| DB | PostgreSQL + Drizzle ORM (`pg` pool in `lib/db.ts`) |
| Auth / storage | Supabase Auth (email/password) + Supabase Storage |
| UI | Tailwind CSS 4, shadcn (radix-nova), Lucide, CVA, `cn()` |
| Email | Resend |
| PDF | PDFKit (server), PDF.js (browser preview) |
| Rich text | Tiptap (report letter body) |
| Dates | `date-fns` + `date-fns-tz`; practice TZ `Australia/Sydney` |
| Locale | `en-AU` formatting; Medicare / NDIS / AHPRA-oriented fields |

## Directory map

| Path | Purpose |
|------|---------|
| `app/` | Routes, route-local UI, Server Actions (`actions.ts`), API Route Handlers |
| `components/` | Shared UI by domain; `components/ui` = shadcn primitives |
| `lib/` | Domain logic, loaders, PDF/email helpers, shared actions |
| `db/schema/` | Numbered Drizzle schema modules (`01-…`–`17-…`), re-exported from `index.ts` |
| `db/migrations/` | Numbered SQL migrations |
| `db/apply-*.ts`, `db/seed-*.ts` | Migration applicators and seed scripts |
| `scripts/` | Install/build helpers (e.g. PDF.js worker copy) |
| `public/` | Static assets; `public/pdfjs/` is **generated** — do not edit or commit |
| `proxy.ts` | Session refresh + auth gate for non-public routes |

Prefer putting reusable business logic in `lib/<domain>/`, not in pages or route handlers.

## Auth and tenancy (critical)

- Identity: Supabase user → app `users` row **by email** → first active `practitionerProfiles` → first active `practitionerPracticeMemberships`.
- Entry point: `requirePractitionerContext()` / `getPractitionerContext()` in `lib/auth.ts`.
- Context fields: `userId`, `practiceId`, `practitionerProfileId`, `email`.
- **Scope every tenant-owned read/update/delete by `context.practiceId`.** Do not trust a client-supplied `practiceId` or bare entity ID without verifying practice ownership.
- Tenant isolation is enforced in application queries — do not assume DB RLS covers a missing filter.
- `lib/supabase/admin.ts` (service role) is server-only **by convention only** — unlike `lib/db.ts`, it has no build-time `import "server-only"` guard, so a bad import wouldn't be caught until runtime (missing env var). Never import it from client code.
- Public routes in `proxy.ts`: `/login`, `/q/*`, `/api/assessments/submit`, `/api/cron/*`. Preserve these when changing the proxy.
- Questionnaire access uses hashed, expiring tokens (`app/q/[token]`).
- Cron: `Authorization: Bearer ${CRON_SECRET}` on `/api/cron/*` (see `vercel.json`).

Current limitation: first active membership only; effectively single-practice / single-timezone deployment. See `lib/dates/practice-time.ts` before multi-timezone work.

## Data layer and migrations

- Schema: camelCase TS properties ↔ snake_case Postgres columns/tables.
- UUID PKs with `defaultRandom()`; most tenant tables have `practiceId`.
- Statuses are usually text (not PG enums); clinical payloads often `jsonb`.
- Soft delete commonly via `isActive`. Clinical records use finalisation + versioning (`versionNumber`, `isCurrentVersion`, `previousVersionId`) — **do not overwrite finalised history**.
- Set `updatedAt` on updates; use transactions when mutating clinical data + audit/links/versions together.
- Write `auditEvents` for significant mutations (especially deletes and clinical state changes).

**Migration workflow is partly manual** (Drizzle journal is incomplete vs numbered SQL through `0047+`):

1. Update the relevant numbered file under `db/schema/`.
2. Add numbered SQL under `db/migrations/` (prefer idempotent where practical).
3. Add `db/apply-<name>-migration.ts` that loads env and runs that SQL.
4. Add a matching `package.json` script if other migrations have one.

Do **not** assume `drizzle-kit migrate` / `db:push` reflects production history. Confirm intended workflow before applying migrations.

## Server Actions vs API routes

**Server Actions** (`"use server"`, often `actions.ts`) — authenticated UI mutations:

- Call `requirePractitionerContext()` inside the action.
- Parse/validate `FormData`; form field names are snake_case.
- Return small state: `{ error?: string; success?: boolean }`.
- `revalidatePath` after mutations; `redirect` after create/finalise/delete when appropriate.
- Client forms: `useActionState(action, {})` + `<form action={formAction}>`.

**Route Handlers** (`app/api/**/route.ts`) — HTTP boundaries:

- Public assessment submit, PDF downloads, email send, signature upload, cron, fetch-driven modals.
- Authenticated handlers still use practitioner context + practice scoping.
- Return explicit JSON status codes for API errors.

Shared mutations that span multiple routes may live under `lib/actions/`.

## UI conventions

- Pages are Server Components by default; `"use client"` only at interactive boundaries.
- Shell/headers: `AppShell`, `ListPageHeader`, `EntityPageHeader`.
- Use existing `components/ui` primitives and `cn()` from `lib/utils.ts`; do not introduce a parallel UI kit.
- Await params then alias: `const { client_id: clientId } = await params`.
- Tiptap: set `immediatelyRender: false` to avoid SSR/CSR mismatches.
- PDFKit is server-only (`serverExternalPackages` in `next.config.ts`).

## Domain quick map

| Domain | Routes / UI | Logic | Schema |
|--------|-------------|-------|--------|
| Clients | `app/clients/` | `lib/delete/`, client actions | `01-core` |
| Appointments / calendar | `app/appointments/`, `app/calendar/` | `lib/appointments/` | `08`, `14` |
| Assessments / batteries | `app/clients/...`, `app/q/` | `lib/assessments/`, `lib/assessment-summary/` | `02`, `03`, `05`, `17` |
| Session notes | `app/session-notes/` | `lib/session-notes/` | `09` |
| Reports | `app/clients/.../reports/`, `app/reports/` | `lib/reports/` | `04`, `16` |
| Funding | `app/funding/` | `lib/funding/`, `lib/actions/funding.ts` | `12` |
| Contacts | `app/contacts/` | `lib/contacts/`, `lib/actions/contacts.ts` | `10` |
| Treatment / crisis plans | under `app/clients/[client_id]/` | `lib/treatment-plans/`, `lib/crisis-plans/` | `06`, `07` |
| Communications / email | client communications + modals | `lib/email/`, `lib/communications/` | `13`, `15` |
| Practice / practitioner | `app/practice/`, `app/practitioner/`, `app/settings/` | `lib/practitioner/` | `11` |

Assessment instruments are data-driven (definitions/elements/options). Seed via `npm run seed:*` scripts. Batteries can append modules from DB trigger rules.

Appointment automations: `lib/appointments/run-automations.ts` via daily cron (`08:00 UTC`).

## Naming

- Files/dirs: kebab-case. Components/types: PascalCase. Functions/values: camelCase.
- Route params: snake_case (`[client_id]`, `[report_id]`, …).
- Imports: `@/` alias.
- Loaders often named `load…ForPractice` / `load…ForClient`.
- Constants for statuses/codes: UPPER_SNAKE where existing code does.

## Dates and localisation

- Use helpers from `lib/dates/practice-time.ts` (`todayDateString`, `practiceLocalToUtc`, etc.).
- Do not casually parse date-only strings as UTC.
- `PRACTICE_TIMEZONE` is hardcoded; multi-TZ needs cron/query changes, not only this constant.
- Prefer existing appointment/format helpers for display.

## Environment

No committed `.env.example`. Typical vars (from code usage):

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`
- `CRON_SECRET`

Never log or return secrets, raw assessment tokens, or unnecessary clinical payloads.

Storage buckets include report/session-note/treatment/crisis PDFs and practitioner signatures — use existing helpers in `lib/`.

## Testing and validation

No Jest/Vitest/Playwright suite. Ad hoc self-tests (`*.selftest.ts`) under `lib/` use `node:assert/strict`; run with `npx tsx <file>`.

After substantive changes:

1. `npm run lint`
2. `npm run build`
3. Relevant `*.selftest.ts` if assessment/summary logic changed
4. Manual check for DB, email, PDF, or clinical workflows touched

## Scripts agents use often

```bash
npm run dev
npm run build
npm run lint
npm run copy:pdf-worker   # also runs on postinstall
```

Domain seeds and migrations are many one-off `seed:*` / `db:*` scripts in `package.json` — look up the exact name before running. Prefer reading the matching `db/apply-*.ts` or `db/seed-*.ts` first.

## Do / don't

**Do**

- Authenticate and practice-scope at every protected entry point.
- Preserve soft-delete guards, finalisation, versioning, and audit logging.
- Keep pages server-rendered; colocate route-specific actions next to the route.
- Match existing form (`useActionState`) and header/shell patterns.
- Follow the schema + SQL + applicator migration pair convention.

**Don't**

- Trust browser-supplied ownership of practice-scoped entities.
- Edit or commit `.next/` or `public/pdfjs/`.
- Overwrite finalised clinical records in place.
- Add dependencies when an existing util/pattern already covers the need.
- Introduce `middleware.ts` alongside `proxy.ts`.
- Expose the Supabase service-role client to the browser.
