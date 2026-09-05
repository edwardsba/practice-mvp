# Project map

Living feature-status list for practice-mvp. This is the place to check what's
built, what's partial, what's deliberately deferred, and what's a known
architectural limitation — rather than reconstructing that picture from memory
or commit messages.

Last full cross-check against `origin/main` at `d356841` (schema, routes, and
templates — not the handover summary). Update the matching row when a feature's
status changes.

## Legend

| Status | Meaning |
|--------|---------|
| **Built** | In production use: schema, routes, and UI exist for the core path |
| **Partial** | Something exists, but it isn't the full intended feature — or the remaining work is streamlining, not a missing capability |
| **Not built** | No implementation |
| **Deferred** | Explicitly chosen not to build (not an accidental gap) |
| **Known limitation** | Architectural constraint of the current deployment; not a feature to add casually |

Open sub-questions (left unresolved on purpose — do not guess in a session):

- Practice Process #2 (client holidays): client-side absences vs practitioner leave vs both
- Compliance & Infrastructure #6 (backup / disaster recovery): research against Australian health-record retention standards and the current Supabase tier, not yet done

---

## Clinical Process

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Client clinical file | Built | Practice-scoped client records in `clients` (`db/schema/01-core.ts`): demographics, contact, notes, communication opt-outs. Routes under `app/clients/`. Soft-delete via `isActive`. |
| 2 | Psychometric assessments & outcome monitoring | Built | Data-driven instruments (`db/schema/02-assessment-definitions.ts`) with hashed, expiring questionnaire tokens (`app/q/[token]`). Pre-session battery is PHQ-9 / GAD-7 / ASSIST / BTP (`lib/assessments/battery-codes.ts`); results on `/clients/[client_id]/assessments`. Seed via `npm run seed:*`. |
| 3 | Diagnostic intake battery | Built | Adaptive diagnostic battery (`db/schema/17-diagnostic-battery.ts`) with DB trigger rules that append modules. Distinct from the pre-session battery. Created from the client communications modal (`createDiagnosticBatteryInstance`). This is the *assessment* intake, not a waitlist/intake pipeline (see Practice Process #3). |
| 4 | SAGE-SR import & diagnostic report | Built | PDF import/parse (`lib/sage-sr/`), plus a dedicated `sage_sr_diagnostic_reports` table and full document path: compose, draft edit, finalise, PDFKit download, send (`app/clients/.../reports/sage-sr/`, `lib/reports/generate-sage-sr-diagnostic-pdf.ts`). Own table, not folded into `simple_reports`. |
| 5 | In-session measures (MSE, ASQ) | Built | Practitioner-completed MSE and ASQ on the client, linked into session notes and progress reports. Seeded instruments; ASQ also has a selftest (`lib/assessments/asq.selftest.ts`). |
| 6 | Session notes | Built | Draft → finalise, versioning, PDF cache in Supabase Storage, send, and per-client PDF export (`db/schema/09-session-notes.ts`, `lib/session-notes/`, `components/session-notes/export-session-notes-button.tsx`). Practice-wide list at `/session-notes`. |
| 7 | Treatment plans | Built | Versioned plans with preview-before-save, PDF, and send (`db/schema/06-treatment-plans.ts`, `lib/treatment-plans/`). Page order: Diagnosis (manual free text for now; diagnostic-assessment autofill is not built), Treatment targets, Treatment modalities (CBT/DBT + Other), Case formulation model, then operational sections (ongoing assessment tools, risk, support services), then Psychoeducation / Alternate responses / Quality of life. Ongoing-assessment checkboxes drive the default pre-session battery. Progress Reports still use a hardcoded CBT sentence (`lib/reports/treatment-plan-summary.ts`) — wiring Treatment Modalities into that sentence is a later step. Entry is from the client overview, not the client sidebar (the sidebar's "Treatment Plans" / "Behavioural Targets" rows are still disabled stubs). |
| 8 | Case formulation | Partial | Not a structured formulation document. Treatment plans store `caseFormulationJson` as a curated multi-select of cited published models — currently one entry, Beck & Bredemeier (2016), in `CASE_FORMULATION_OPTIONS` (`lib/treatment-plans/fields.ts`). No "Other" free-text (citations must stay exact). A full model-library page (own assessments) is planned separately. No formulation document, diagram, or free-text case conceptualisation. |
| 9 | Crisis / safety plans | Built | Versioned crisis plans with emergency-contact sync, PDF, and send (`db/schema/07-crisis-plan.ts`, `lib/crisis-plans/`). Same preview-before-save pattern as treatment plans. |
| 10 | Clinical reports & correspondence | Built | Progress Report and Referral Acknowledgement via `simple_reports` (Tiptap letter body, snapshot, PDF, send). Report types/templates in Settings (`lib/reports/templates.ts`). SAGE-SR Diagnostic Report is #4 above. Practice-wide list at `/reports`. |
| 11 | Feedback reports | Not built | No client-facing outcome-feedback / session-feedback document type, template, or route. Distinct from progress reports (which are practitioner correspondence). |
| 12 | Clinical communications | Built | Email via Resend; per-client communications log (`db/schema/13-communications.ts`). Manual send of assessments, diagnostic battery, treatment/crisis plans, and reports; templates under Settings. |

---

## Practice Process

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Calendar & appointments | Built | Calendar (`/calendar`), appointment CRUD, types, face-to-face/online mode, funding-approval link, status transitions (`lib/status/index.ts`). Practitioner weekly availability blocks feed mode resolution (`lib/appointments/resolve-mode.ts`). No recurring series. `clients.onlineBookingPermitted` is a stored permission only — there is no public booking portal. |
| 2 | Client holidays | Not built | No holiday/absence/leave table, route, or calendar overlay. **Scope still open:** client-side absences vs practitioner leave vs both. Do not guess; Ben to pick up. |
| 3 | Waitlist / intake workflow | Not built | No waitlist, referral-triage queue, or pre-client enquiry pipeline. The diagnostic *battery* (#3 Clinical) is an assessment sent to an existing client, not an intake list. |
| 4 | Email appointment reminders | Built | Daily cron (`vercel.json` 08:00 UTC; `/api/cron/appointment-automations`) sends the `appointment_reminder` template two days ahead (`lib/appointments/run-automations.ts`). Honours `commsOptOut` / `reminderOptOut`. Same sweep completes due appointments and sends pre/post-session mail. |
| 5 | SMS reminders | Not built | Reminders are email-only (Resend). No SMS provider, schema, or send path. |
| 6 | Pre- and post-session questionnaire automation | Built | Same cron sweep creates/sends the pre-session battery and post-session questionnaire, with per-client opt-outs and audit events. Same-day appointments are handled on create so the overnight sweep cannot miss them. |
| 7 | Reporting automation | Partial | Funding approval types declare report requirements by appointment number; the dashboard counts outstanding reports; Create Report can be pre-filled from a requirement (`lib/funding/reporting-requirements.ts`). The engine is in place. Remaining ask is UX streamlining of that flow, not a missing feature. |
| 8 | Payment automation | Deferred | No payments, invoices, Stripe/Xero/Tyro, or checkout. Explicitly out of scope for now, not an accidental gap. |
| 9 | Medicare rebate automation | Deferred | Claims can store Medicare card number and IRN (`db/schema/12-funding.ts`) for administration. No PRODA / ECLIPSE / bulk-bill lodgement. Explicitly deferred. |
| 10 | Contacts / referral network | Built | Professionals, organisations, professions, and membership links (`db/schema/10-contacts.ts`). Used as referrers on funding approvals and as report recipients. Nav: Contacts; Settings → Professions. |
| 11 | Funding & claims administration | Built | Claim types, claims, funding approval types (with report requirements), approvals, and a client funding panel (`db/schema/12-funding.ts`, `lib/actions/funding.ts`). Medicare/NDIS/insurer-oriented fields; this is record-keeping, not claiming into Medicare (see #9). |
| 12 | Emergency contacts | Built | Per-client emergency contacts (`client_emergency_contacts` in `db/schema/07-crisis-plan.ts`), shown on the client overview and synced into crisis plans (`lib/crisis-plans/sync-emergency-contacts.ts`). |
| 13 | Client lifecycle status | Built | `clients.clientStatus`: active / on_hold / discharged / inactive, with allowed transitions (`lib/status/index.ts`, `ClientStatusControl` on the client overview). Separate from soft-delete `isActive`. |
| 14 | Settings / configuration layer | Built | Practice details, practitioner profile (AHPRA, signature, calendar hours, availability), appointment types, email templates/variables, report types, assessments, claim types, funding approval types. Nav: Settings + Profile. |
| 15 | Dashboard | Built | `/dashboard`: today's appointments, outstanding reports, missing finalised notes, active clients without an upcoming appointment (`lib/dashboard/load.ts`). |

---

## Compliance & Infrastructure

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Audit logging | Partial | `audit_events` (`db/schema/04-reports-and-audit.ts`) is written on significant mutations (deletes, clinical state changes, automations, email send). There is no practitioner-facing audit log to review or export those events. |
| 2 | CI / automated test gate | Not built | No GitHub Action (or other CI) that runs `tsc` / ESLint / selftests on push or PR. The only workflow is the appointment-automations cron ping (`.github/workflows/appointment-automations-cron.yml`). Ad-hoc `*.selftest.ts` files exist under `lib/` and are run with `npx tsx`; they are not a gate. |
| 3 | Error monitoring | Not built | No Sentry (or similar). Failures surface as action/API error strings and server logs only. |
| 4 | Two-factor authentication | Not built | Supabase Auth email/password only (`lib/auth.ts`, `/login`). No TOTP/MFA enrolment or challenge. |
| 5 | Data retention / export | Not built | No retention schedule, legal-hold, or bulk client-record export. Session-note PDF export exists for a single client; that is a clinical convenience, not a Privacy Act / health-records export. Soft-delete (`isActive`) is not a retention policy. |
| 6 | Backup / disaster recovery | Not built | **Not investigated yet.** Needs a follow-up against Australian health-record retention standards (state Health Records Acts + Privacy Act APPs) and whatever backup/PITR the current Supabase tier already provides. Do not treat this row as an answer. |
| 7 | Multi-practitioner / multi-timezone | Known limitation | `getPractitionerContext()` takes the first active profile and first active membership (`lib/auth.ts`) — effectively single-practice. `PRACTICE_TIMEZONE` is hardcoded to `Australia/Sydney`; a per-practice TZ needs cron/query changes, not only `lib/dates/practice-time.ts`. Schema already has memberships and `practices.timezone`. |
| 8 | Rate limiting | Not built | Public questionnaire routes (`/q/*`, `/api/assessments/submit`) and cron are ungated beyond token expiry / `CRON_SECRET`. No application-level rate limiter. (`express-rate-limit` appears only as a transitive dependency.) |
| 9 | Authentication & tenancy scoping | Built | Session refresh and auth gate in `proxy.ts` (public: `/login`, `/q/*`, `/api/assessments/submit`, `/api/cron/*`). Protected entry points use `requirePractitionerContext()` and must filter by `context.practiceId`. Tenant isolation is application-query enforcement — do not assume DB RLS covers a missing filter. Questionnaire access is hashed, expiring tokens. |

---

## How to keep this current

- When you land, defer, or materially change a feature, update the matching row in the same change (or immediately after).
- Use **Partial** when a stub or adjacent feature could be mistaken for the real thing (case formulation is the canonical example).
- Use **Deferred** only for an explicit "we are not building this," not for "hasn't been reached yet."
- Do not mark **Built** from a handover doc or memory — point at the schema/route that proves it.
- Leave the two open sub-questions (#2 Practice, #6 Compliance) for Ben unless he has since decided them.
