# Round AI.1 report — Start list shows assessment name, not code

Branch: `test/remove-legacy-asq-mse` (continued from Round AI at `1c08955`).  
No PR opened (prompt guardrail). No database changes. No migrations. No local dev server.  
Secrets and live client identifiers omitted.

## Commits

| SHA | Message |
|-----|---------|
| `5a1455a` | Round AI.1: Start list shows assessment name only |
| *(this commit)* | Round AI.1 report only |

## Files changed

**New**

- `app/clients/[client_id]/assessments/start/start-assessment-row.tsx` — one Start-list row: `assessment_name` title; optional `href` (Start) or `badge` (disabled)

**Modified**

- `app/clients/[client_id]/assessments/start/page.tsx` — all three row kinds use `StartAssessmentRow`; code line removed; links still via `buildPractitionerStartHref`

## Command results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | Pass |
| `npx eslint` on Start page + row component | Pass |
| `npx next build` | Pass |
| All `lib/client-background/*.selftest.ts` | Pass |
| All `lib/funding/*.selftest.ts` | Pass |
| All `lib/clients/*.selftest.ts` | Pass |
| All `lib/medical-contacts/*.selftest.ts` | Pass |
| All `lib/navigation/*.selftest.ts` | Pass |
| All `lib/assessments/**/*.selftest.ts` (incl. `start-list`) | Pass |
| All `lib/mse/*.selftest.ts` | Pass |
| All `lib/assessment-summary/*.selftest.ts` | Pass |
| `lib/reports/tom-example.selftest.ts` | Pass (Tom report text unchanged) |
| `lib/reports/generate-background-report.selftest.ts` | Pass |
| `tom-example-db.selftest.ts` | Skipped |

## Migration names

none

## Branch preview URL

https://practice-i3vaffzql-benedwards-practicemvp.vercel.app

(Vercel Preview for `5a1455a` on `test/remove-legacy-asq-mse` — Deployment has completed / success)

## Checks

### 1. Do all rows on the Start page show the name only, with no code line?

Yes. Each row renders only `row.assessmentName` as the title (`font-medium`). The previous bold `assessmentCode` line and muted name subtitle are gone for practitioner, enabled-client, and disabled-client rows.

### 2. Do the Start links still go to the same URLs as before?

Yes. Enabled rows still pass `buildPractitionerStartHref({ clientId, assessmentCode: row.assessmentCode, sessionNoteId: todaysNote?.sessionNoteId ?? null, returnTo: startReturnTo })` into `StartAssessmentRow`’s `href`. That helper was unchanged this round (shared `/clients/{id}/assessments/new/{code}?session_note_id&returnTo`). Disabled rows have no link (badge only).

### 3. Is there now one row component, used by all three row kinds?

Yes. `StartAssessmentRow` is used for practitioner rows, enabled client questionnaires, and disabled (“Coming soon”) rows. No second copy elsewhere.

### 4. Which other places show the code as a label (Part 3)?

Listed only; **not changed** this round:

| Place | What it shows |
|-------|----------------|
| `app/settings/assessments/page.tsx` | Table cell with `definition.assessmentCode` (Settings › Assessments — on purpose) |
| `app/settings/assessments/[assessment_code]/page.tsx` | Details “Assessment code” field with `definition.assessmentCode` (on purpose) |
| `app/clients/[client_id]/assessments/assessments-table.tsx` | Type column via `formatAssessmentType(code, name)` → short labels from `ASSESSMENT_TYPE_LABELS` (e.g. `mse` → `"MSE"`, `LRAMP` → `"LRAMP"`) or falls back to `assessmentName`; filter chips also use short code-style labels |

No other `app/` / `components/` JSX was found that renders raw `assessmentCode` as practitioner-facing label text.

## Anything removed

- The duplicate Start-row markup (three copies of code + name + Start/badge)
- The bold assessment-code title line on the Start page

## Decisions the prompt left open

None.
)
