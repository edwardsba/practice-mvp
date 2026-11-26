# Round AI report — remove legacy ASQ and MSE pages

Branch: `test/remove-legacy-asq-mse` (continued from audit at `a266c85`; `main` at `7e89bf4`).  
No PR opened (prompt guardrail). No database changes. No migrations. No local dev server.  
Secrets and live client identifiers omitted.

## Commits

| SHA | Message |
|-----|---------|
| `a266c85` | Round AI audit: what removing legacy ASQ/MSE pages would delete |
| `7205bba` | Round AI: remove legacy ASQ and MSE pages |
| *(this commit)* | Round AI report only |

## Files deleted

**ASQ tree (`app/clients/[client_id]/asq/`)**

- `app/clients/[client_id]/asq/new/page.tsx`
- `app/clients/[client_id]/asq/new/asq-form.tsx`
- `app/clients/[client_id]/asq/new/actions.ts`
- `app/clients/[client_id]/asq/[instance_id]/edit/page.tsx`

**MSE tree (`app/clients/[client_id]/mse/`)**

- `app/clients/[client_id]/mse/new/page.tsx`
- `app/clients/[client_id]/mse/new/mse-form.tsx`
- `app/clients/[client_id]/mse/new/actions.ts`
- `app/clients/[client_id]/mse/[instance_id]/page.tsx`
- `app/clients/[client_id]/mse/[instance_id]/edit/page.tsx`

**Sole-use modules**

- `lib/assessments/load-mse.ts`
- `lib/assessments/mse-grouping.ts`
- `lib/assessments/load-asq.ts`
- `components/session-notes/collapsible-section.tsx`

## Files edited

- `lib/mse/insert-words.ts` — removed old Orientation/Memory keys and Round AI comments
- `lib/mse/option-display-order.ts` — removed old Orientation/Memory keys (incl. field-local `None`) and Round AI comments
- `lib/mse/session-note-sentence.selftest.ts` — removed two legacy-label assertions
- `lib/assessments/shared-form-guard.selftest.ts` — removed ASQ/MSE allow-list entries and `LEGACY_START` check
- `lib/assessments/practitioner-routes.ts` — removed `LEGACY_START`, `"legacy"` target, `practitionerStartTarget`, `legacyStartEntriesForGuard`; `buildPractitionerStartHref` always builds shared URLs
- `lib/assessments/asq.ts` — comment no longer mentions legacy ASQ save actions
- `lib/sage-sr/import-sage-sr-report.ts` — comment points at `lib/assessments/save-practitioner-assessment.ts`
- `PROJECT_MAP.md` — Clinical #5: ASQ and MSE use only the shared form and results view (status still Partial)

No other application files changed (apart from this report).

## Command results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | Pass |
| `npx eslint` on every edited `.ts` file | Pass |
| `npm run lint` (full repo) | Fail — **pre-existing** errors/warnings in unrelated files (react-hooks / pdfjs, etc.); **none** in files this round deleted or edited |
| `npx next build` | Pass (ASQ/MSE routes absent from route list) |
| All `lib/client-background/*.selftest.ts` | Pass |
| All `lib/funding/*.selftest.ts` | Pass |
| All `lib/clients/*.selftest.ts` | Pass |
| All `lib/medical-contacts/*.selftest.ts` | Pass |
| All `lib/navigation/*.selftest.ts` | Pass |
| All `lib/assessments/**/*.selftest.ts` (incl. `shared-form-guard`, `practitioner-routes`, scoring) | Pass |
| All `lib/mse/*.selftest.ts` | Pass |
| All `lib/assessment-summary/*.selftest.ts` | Pass |
| `lib/reports/tom-example.selftest.ts` | Pass (Tom report text unchanged) |
| `lib/reports/generate-background-report.selftest.ts` | Pass |
| `tom-example-db.selftest.ts` | Skipped |

## Migration names

none

## Branch preview URL

https://practice-n0twjxb0y-benedwards-practicemvp.vercel.app

(Vercel Preview for `7205bba` on `test/remove-legacy-asq-mse` — Deployment has completed / success)

## Checks

### 1. Grep — no deleted imports; no legacy `/asq` / `/mse` routes under `app/`, `components/`, `lib/`

```text
$ rg -n 'from ["'\''].*(load-mse|mse-grouping|load-asq|collapsible-section)|@/app/clients/\[client_id\]/(asq|mse)' app components lib --glob '*.{ts,tsx}'
(no matches)

$ rg -n '(/clients/\$\{[^}]+\}/(asq|mse)|/clients/[^"`'\'' ]*/(asq|mse)/)' app components lib --glob '*.{ts,tsx}'
(no matches)
```

### 2. Grep — no `LEGACY_START` / `legacyStartEntriesForGuard` / `kind: "legacy"` outside `docs/`

```text
$ rg -n 'LEGACY_START|legacyStartEntriesForGuard|kind:\s*"legacy"' --glob '!docs/**' --glob '!node_modules/**' --glob '!.git/**'
(no matches)
```

### 3. Guard self-test probe

Temporary `app/_guard_probe/probe.tsx` with `type="radio"` → self-test failed (`actual: ['app/_guard_probe/probe.tsx']`, message still points at AGENTS.md shared-form rule). File removed → pass. Not committed.

### 4. Session note / Start shared URLs

Checked by:

1. Reading `app/session-notes/[session_note_id]/page.tsx` — MSE/LRAMP/ASQ Start still use `buildPractitionerStartHref`; Edit uses `buildPractitionerEditHref`; View still `/clients/{id}/results/{assessmentResultId}`.
2. Reading `app/clients/[client_id]/assessments/start/page.tsx` — Start list still uses `buildPractitionerStartHref` for practitioner and client rows.
3. Executing `buildPractitionerStartHref` / `buildPractitionerEditHref` after the simplification:

| Call | URL |
|------|-----|
| mse + session note | `/clients/c1/assessments/new/mse?session_note_id=sn1&returnTo=…` |
| ASQ + session note | `/clients/c1/assessments/new/ASQ?session_note_id=sn1&returnTo=…` |
| LRAMP (Start page) | `/clients/c1/assessments/new/LRAMP?returnTo=…` |
| Edit | `/clients/c1/assessments/edit/i1?returnTo=…` |

Same shared paths as before (empty `LEGACY_START` already routed everything here).

### 5. File list vs Parts 1–2

Deleted and edited sets match Parts 1 and 2 exactly (listed above). **Anything else changed?** No — only this report commit afterwards.

## Decisions the prompt left open

None — Ben’s six decisions were applied as specified (404; remove legacy start machinery; delete `CollapsibleSection`; remove Orientation/Memory `None`; PROJECT_MAP wording; Sage-SR comment → `save-practitioner-assessment.ts`).
)
