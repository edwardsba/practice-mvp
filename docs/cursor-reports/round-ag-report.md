# Round AG report — ASQ moves onto the shared practitioner form and results view

Branch: `test/asq-shared` (from `main` at `1117193`)  
No PR opened (prompt guardrail). No database changes. No migrations.  
No local dev server. Secrets and live client identifiers omitted.

## Commits

- `682b73f` — Round AG: ASQ on shared practitioner form and results layout
- This commit — Round AG report only

## Files changed (feature commit)

### New

- `lib/assessments/asq-summary.ts` — ASQ result summary rows (screen outcome, Yes count, optional acute risk)
- `lib/assessments/asq-summary.selftest.ts`

### Modified

- `lib/assessments/asq.ts` — `asqFlagsFromResponses` (single flag-derivation helper)
- `lib/assessments/asq.selftest.ts` — flag-helper check kept alongside the eight `asqScreenOutcome` cases
- `lib/assessments/scoring/score-assessment.ts` — ASQ branch: sum of integer option scores + `asqScreenOutcome(asqFlagsFromResponses(...))`; `structuredScoreJson` null
- `lib/assessments/scoring/score-assessment.selftest.ts` — eight flag-combination golden fixtures (severity + score totals)
- `lib/assessments/practitioner-routes.ts` — removed `ASQ` from `LEGACY_START` (and from the dead client-exclusion list); ASQ qualifies for `canCompleteInSharedForm` and `usesSharedResultsLayout`
- `lib/assessments/practitioner-routes.selftest.ts` — ASQ → true for both gates
- `lib/assessments/result-summaries.ts` — registry entry `ASQ: asqResultSummary`; optional extras for stored severity / acute risk
- `lib/assessments/save-practitioner-assessment.ts` — `dataType` fallback `""` (Part 5); scored path unchanged otherwise
- `app/api/assessments/submit/route.ts` — `dataType` fallback `""` only (Part 5)
- `app/clients/[client_id]/asq/new/actions.ts` — legacy save/update uses `asqFlagsFromResponses` (pages kept, unlinked)
- `app/clients/[client_id]/results/[result_id]/page.tsx` — ASQ takes shared early branch; removed unused default-branch ASQ pieces; Edit via `buildPractitionerEditHref` in shared view
- `app/session-notes/[session_note_id]/page.tsx` — ASQ administer link via `buildPractitionerStartHref`
- `PROJECT_MAP.md` — Clinical #5 notes

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
| All `lib/assessments/**/*.selftest.ts` (incl. scoring, asq, asq-summary, practitioner-routes) | Pass |
| `lib/reports/tom-example.selftest.ts` | Pass (Tom report text unchanged) |
| `lib/reports/generate-background-report.selftest.ts` | Pass |
| `tom-example-db.selftest.ts` | Skipped |

## Migration names

None.

## Branch preview URL

https://practice-mvp-git-test-asq-shared-benedwards-practicemvp.vercel.app

(Confirmed after push via Vercel commit status when available.)

## Checks

### 1. ASQ scoring branch and eight-combination self-tests

`scoreAssessment` ASQ branch (`lib/assessments/scoring/score-assessment.ts`):

- `isAsq` at line 107
- Branch at lines 231–234: `resultScore = totalScore` (sum of integer option scores from the shared loop), `severity = asqScreenOutcome(asqFlagsFromResponses(responses))`, `structuredScoreJson` null

`asqFlagsFromResponses` lives once in `lib/assessments/asq.ts` (line 17) and is also used by the legacy ASQ actions.

Golden self-tests in `score-assessment.selftest.ts` cover all eight historical/recent/current combinations. Expected severity is taken from `asqScreenOutcome` (same helper as today); expected score is 0–3 from the minimal Yes set (Q1 for recent, Q4 historical, Q5 current). All eight passed and match `asqScreenOutcome` exactly.

### 2. ASQ saves the same result columns and audit events

Shared scored new save (`lib/assessments/save-practitioner-assessment.ts`):

| Column / event | Lines (new save) |
|----------------|------------------|
| `score` | 194 |
| `severity` | 195 |
| `structuredScoreJson` | 196 (null for ASQ) |
| `assessmentDate` | 197 (from form date; DB `status` default remains `scored` — not set explicitly, same as client submit / old ASQ) |
| audit `assessment.submitted` | 207 |
| audit `assessment_result.scored` | 216 |

Shared scored edit:

| Column / event | Lines |
|----------------|-------|
| `score` / `severity` / `structuredScoreJson` / `assessmentDate` | 369–372 |
| audit `assessment.updated` | 391 |

ASQ seed has `scoringEnabled: true`, so the shared path uses the scored branch (not the LRAMP unscored `status: "completed"` path).

### 3. ASQ results page — summary box + answer table; default-branch removals

With `usesSharedResultsLayout` true for ASQ, the early shared branch renders `SharedPractitionerResultView` with:

- Summary via `asqResultSummary`: **Screen outcome** (stored `severity`), **Questions answered Yes** (`N of 5`), **Acute risk rating** only when `acute_risk_rating` is set
- Answer table via `AnswerSections`
- Edit via `buildPractitionerEditHref` (shared view)

Removed from the default Results branch (were only used when `isAsq`; ASQ no longer reaches that branch):

| Removed (at `1117193`) | What it was |
|------------------------|-------------|
| line 311 `const isAsq = …` | ASQ flag for default branch |
| lines 1089–1091 `maxScore = isAsq ? 5 : …` | hardcoded ASQ max score |
| lines 1180–1190 Edit ASQ link to `/asq/{id}/edit` | legacy edit href |
| line 1226 `{isAsq ? "Screen outcome" : "Severity"}` | ASQ-only summary label |

Also dropped the unused `appendReturnTo` import that only served the legacy Edit ASQ link.

### 4. Session note ASQ block, Progress Report, `getAsqRecentAndCurrentFlags`

Unchanged readers of stored ASQ values:

- Session note still loads score / severity (via existing loaders); only the **administer** href now uses `buildPractitionerStartHref` for `ASQ` (shared new route + `session_note_id` / `returnTo`). View still goes to `/results/{id}`.
- Progress Report path (`lib/assessment-summary/asq-template.ts`, `app/clients/.../reports/actions.ts`) untouched this round; still reads stored responses / flags.
- `getAsqRecentAndCurrentFlags` in `lib/assessments/asq.ts` unchanged.
- Assessments list ASQ row formatting unchanged (`assessments-table.tsx`).

Tom example selftest passed — report text unchanged.

### 5. Grep for old ASQ links (`asq/new` and `/asq/` in `app/`, `components/`, `lib/`)

After this round, matches outside `app/clients/[client_id]/asq/` itself:

| Path | Note |
|------|------|
| `lib/sage-sr/import-sage-sr-report.ts:147` | Comment only (pattern reference) |

Inside `app/clients/[client_id]/asq/` (kept for Round AI; not linked):

- `asq/new/page.tsx`, `asq/new/asq-form.tsx`, `asq/[instance_id]/edit/page.tsx` — internal imports only

No remaining navigate/href targets to the old pages from session notes, results, Start, or shared components. `LEGACY_START` no longer contains `ASQ`.

### 6. Part 5 dataType fallback

Both call sites now pass `dataType: meta?.dataType ?? ""` so a row with no metadata is not counted in the integer total:

- `app/api/assessments/submit/route.ts` line 258
- `lib/assessments/save-practitioner-assessment.ts` lines 142 and 332 (new + edit)

### 7. Existing ASQ instances on shared edit / results

- ASQ is practitioner-only (`clientCompletable: false`); instances are not created via questionnaire access links, so `instanceHasAccessLink` is false and shared edit is allowed.
- Shared edit loads answers via `loadAssessmentInstanceForForm` → `answersFromResponseRows`, which treats `response_order` null as 0 — fine for radio answers (legacy ASQ writes null `response_order`; shared radio rows also use null).
- Shared results early branch loads the same response rows into `answers` for the summary + answer table.
- Edit control on the shared results view is `buildPractitionerEditHref` (`components/assessments/answers/shared-practitioner-result.tsx`); the old `/asq/{id}/edit` link is gone.

## Anything removed

- `ASQ` entry from `LEGACY_START` (and from `SHARED_FORM_EXCLUDED_CLIENT_CODES`, which was redundant for practitioner-only ASQ)
- Default Results-branch ASQ-only UI: `isAsq`, hardcoded max score 5, “Edit ASQ” legacy href, “Screen outcome” label branch
- `appendReturnTo` import on the results page (only used by the removed Edit ASQ link)

Legacy ASQ pages under `app/clients/[client_id]/asq/` were **not** deleted (Round AI).

## Decisions the prompt left open

- Extended `ResultSummaryBuilder` with an optional third `extras` argument (`severity`, `acuteRiskRating`) so ASQ can show the **stored** severity and conditional acute risk without a second registry. LRAMP ignores extras.
- Removed `ASQ` from `SHARED_FORM_EXCLUDED_CLIENT_CODES` as well as `LEGACY_START` (prompt only required the latter; ASQ is not client-completable, so either way it uses the practitioner-only shared path).
- Shared scored edit audits `assessment.updated` only (no `assessment_result.rescored`); matches the prompt’s edit-audit list and the existing shared save, not the legacy ASQ update action.
- Shared form sets `assessment_date` from the form date field (noon practice-local), not `new Date()` as the legacy ASQ action did — same column, different value source already used by LRAMP / other shared instruments.
