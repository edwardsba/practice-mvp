# Round AC report — shared practitioner form + LRAMP + "+ Add assessment"

Branch: `test/lramp` (from Round AB `57a7d79`; `main` at `516e1bf`)  
No PR opened (prompt guardrail). No migrations this round.

## Commits

- `9985be3` — Round AC: shared practitioner assessment form, LRAMP UI, Add assessment menu
- This commit — Round AC report only

## Files changed (feature commit)

### New

- `lib/assessments/load-form-definition.ts`
- `lib/assessments/load-instance-for-form.ts`
- `lib/assessments/save-practitioner-assessment.ts`
- `lib/assessments/draft-storage.ts`
- `lib/assessments/practitioner-routes.ts`
- `lib/assessments/start-list.ts` + `start-list.selftest.ts`
- `lib/assessments/lramp-session-summary.ts` + `lramp-session-summary.selftest.ts`
- `components/assessments/form/assessment-form-core.tsx`
- `components/assessments/form/element-control.tsx`
- `components/assessments/form/text-list-input.tsx`
- `components/assessments/practitioner-assessment-form.tsx`
- `components/assessments/add-assessment-menu.tsx`
- `app/clients/[client_id]/assessments/new/[assessment_code]/page.tsx`
- `app/clients/[client_id]/assessments/edit/[instance_id]/page.tsx`
- `app/clients/[client_id]/assessments/start/page.tsx`

### Modified

- `lib/assessments/form-rules.ts` — `sectionStatuses`, `answersFromResponseRows`, label helpers
- `lib/assessments/form-rules.selftest.ts` — section + response-order coverage
- `lib/navigation/safe-return-to.ts` (+ selftest) — allow `/session-notes/` return paths
- `lib/session-notes/load-context.ts` — load linked LRAMP for session note
- `app/session-notes/[session_note_id]/page.tsx` — LRAMP block
- `app/clients/[client_id]/assessments/page.tsx` — `+ Add assessment` menu
- `app/clients/[client_id]/assessments/import-sage-sr-dialog.tsx` — optional controlled open / hideTrigger
- `app/clients/[client_id]/assessments/assessments-table.tsx` — LRAMP / mse labels
- `app/clients/[client_id]/background/interview/page.tsx` — Start LRAMP href
- `components/client-background/interview-page.tsx` — Start LRAMP in header
- `PROJECT_MAP.md`

## Command results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | Pass |
| `npx next build` | Pass |
| All `lib/client-background/*.selftest.ts` | Pass |
| All `lib/funding/*.selftest.ts` | Pass |
| All `lib/clients/*.selftest.ts` | Pass |
| All `lib/medical-contacts/*.selftest.ts` | Pass |
| All `lib/navigation/*.selftest.ts` | Pass |
| All `lib/assessments/*.selftest.ts` | Pass (incl. new start-list / lramp-session-summary / extended form-rules) |
| `lib/reports/tom-example.selftest.ts` | Pass (unchanged) |
| `lib/reports/generate-background-report.selftest.ts` | Pass (unchanged) |
| `tom-example-db.selftest.ts` | Skipped |

## Migration names

None. Round AB `0081` / `0082` already applied.

## Branch preview URL

https://practice-mvp-git-test-lramp-benedwards-practicemvp.vercel.app

Vercel commit status: success.

## Checks

### 1. Client questionnaire, battery, ASQ, MSE unchanged

Shared files touched (why):

| File | Why |
|------|-----|
| `lib/assessments/form-rules.ts` | Additive pure helpers only; existing Round AB APIs unchanged |
| `lib/navigation/safe-return-to.ts` | Allow `/session-notes/` so LRAMP returnTo works; clients/funding behaviour unchanged |
| `lib/session-notes/load-context.ts` | Additive `lrampInstance` field; MSE/ASQ loaders untouched |
| `app/session-notes/[session_note_id]/page.tsx` | New LRAMP card only; MSE/ASQ/mood blocks unchanged |
| `app/clients/.../assessments/page.tsx` | Replaced Import SAGE-SR header button with menu that still opens the same dialog |
| `import-sage-sr-dialog.tsx` | Optional controlled props; default trigger behaviour preserved |
| `assessments-table.tsx` | Label map only |
| `interview-page.tsx` / interview route | Additive Start LRAMP link |
| `PROJECT_MAP.md` | Status note |

ASQ/MSE routes and actions not modified. `app/q/`, battery, and `app/api/` not touched. Client form not switched onto the shared core.

### 2. Preview walkthrough (Ben01) — blocked

Could not complete interactive LRAMP paths on preview. Vercel Deployment Protection SSO (`Log in to Vercel`) blocks the preview URL; no Vercel account, protection-bypass secret, or app login credentials are available in this environment.

Screenshot of blocker: `/opt/cursor/artifacts/vercel-sso-blocker.png`

**Instance ids:** none (no saves performed).

Offline verification that supports the intended behaviour:

- `sectionStatuses` self-test: B1=No → C and D **Skipped**; fully answered paths → Done; unanswered “at least one” group counts once.
- Save path uses `validateAnswers` → open only errored sections (client form logic) → server re-validates → `cleanAnswers` / `toResponseRows`.
- Session note LRAMP block and Assessments list wiring are in place for after a successful Save.

Needs a human (or credentials) on preview to confirm Save/Edit and report instance ids.

### 3. B1 Yes→No drops C/D answers

`cleanAnswers` / `toResponseRows` drop hidden elements (Round AB + self-tests). Hidden C/D answers are never written on Save. Not re-confirmed on preview (SSO block).

### 4. Growing lists

`TextListInput` + `cleanAnswers` / `toResponseRows` (self-test 9): order 1,2,3; blanks dropped; Remove supported in UI.

### 5. Unsaved drafts

`lib/assessments/draft-storage.ts` — localStorage keyed by client + assessment code (+ instance id). Restored on mount; cleared on successful Save (before redirect) and on Discard/Cancel.

### 6. Server action ownership checks

`lib/assessments/save-practitioner-assessment.ts`:

**New save (`saveNewPractitionerAssessment`):**

1. `requirePractitionerContext()`
2. Client belongs to practice (`clients.clientId` + `practiceId` + `isActive`)
3. If `session_note_id` present: `loadSessionNoteForPractice` and `note.clientId === clientId`
4. Definition exists and `practitionerCompletable`

**Edit save (`saveEditPractitionerAssessment`):**

1. `requirePractitionerContext()`
2. Client belongs to practice
3. Instance matches `instanceId` + `clientId` + `practiceId`
4. Definition matches the instance’s `assessmentDefinitionId`

### 7. Assessments list null score

`app/clients/[client_id]/assessments/assessments-table.tsx` — `formatScore` returns `"—"` when `score === null` (same path as other unscored tools). LRAMP label added to `ASSESSMENT_TYPE_LABELS`.

### 8. Start page list

`buildStartAssessmentList` (self-tested): practitioner section ASQ, LRAMP, mse (A–Z, enabled); other active instruments with elements in the client section, disabled + “Coming soon”.

### 9. Interview Start LRAMP button

`app/clients/[client_id]/intake-interview/page.tsx` only redirects to Client Background — no risk UI there. **Start LRAMP** was placed in the live Interview header actions (`components/client-background/interview-page.tsx`, route `/clients/[id]/background/interview`), using the same today’s-session-note rule as the Start page, `returnTo` = the interview.

## Anything removed

- Assessments page header no longer shows a standalone “Import SAGE-SR report” button; that action is menu item 3 and still opens the same dialog.

## Decisions the prompt left open

1. **`safeReturnTo` and session notes** — Extended to allow `/session-notes` and `/session-notes/…` (needed for LRAMP returnTo; labels already existed in `resolveBackNavigation`).
2. **F1 summary “first clause”** — Special-cased the four F1 options to match the example wording (`Not imminently dangerous`, etc.).
3. **Option-button rule** — Side-by-side buttons when ≤4 options and every label ≤40 characters (covers C/D rating radios; long F1 options stay as a vertical list).
4. **Import SAGE-SR dialog** — Added optional controlled `open` / `onOpenChange` / `hideTrigger` so the menu can open it without a second dialog.
5. **Intake-interview route** — Left as redirect; Start LRAMP lives on the real Interview page.
6. **Preview walkthrough** — Blocked by Vercel SSO; no credentials in this environment.
7. **No PR** — Per Round AC guardrails.
