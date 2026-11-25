# Round AD report — shared results view (summary + answer table), LRAMP first

Branch: `test/lramp` (from Round AC.2 report `b332b6d`)  
No PR opened (prompt guardrail). No database changes. No migrations.

## Commits

- `3c76822` — Round AD: shared results view (summary + answer sections) for LRAMP
- This commit — Round AD report only

## Files changed (feature commit)

### New

- `lib/assessments/answer-rows.ts` + `answer-rows.selftest.ts`
- `lib/assessments/lramp-summary.ts` + `lramp-summary.selftest.ts`
- `lib/assessments/result-summaries.ts` — code → summary builder registry (LRAMP only)
- `components/assessments/answers/answer-sections.tsx`
- `components/assessments/answers/result-summary-box.tsx`
- `components/assessments/answers/shared-practitioner-result.tsx`

### Modified

- `lib/assessments/lramp-session-summary.ts` — uses shared `lrampShortDisposition`
- `lib/assessments/load-results.ts` — one extra F1 query for LRAMP rows → `scoreLabel`
- `lib/session-notes/load-context.ts` — expose `assessmentResultId` on LRAMP instance
- `app/clients/[client_id]/results/[result_id]/page.tsx` — early shared-form branch
- `app/clients/[client_id]/assessments/assessments-table.tsx` — Score uses `scoreLabel`
- `app/session-notes/[session_note_id]/page.tsx` — View link before Edit
- `PROJECT_MAP.md` — Clinical #5 notes shared results layout

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
| All `lib/assessments/*.selftest.ts` | Pass (incl. new answer-rows / lramp-summary; session-summary still green) |
| `lib/reports/tom-example.selftest.ts` | Pass (Tom report text unchanged) |
| `lib/reports/generate-background-report.selftest.ts` | Pass |
| `tom-example-db.selftest.ts` | Skipped |

## Migration names

None.

## Branch preview URL

https://practice-mvp-git-test-lramp-benedwards-practicemvp.vercel.app

Vercel commit status for `3c76822`: success (deployment completed). Preview behind Vercel SSO; Ben01 result checked via self-test fixture of the same B1=Yes / F1=b shape (no live DB in this environment).

## Checks

### 1. Every existing results layout unchanged

Early branch in `app/clients/[client_id]/results/[result_id]/page.tsx`: after practice-scoped client + result load, if `usesSharedPractitionerForm({ assessmentCode, clientCompletable, practitionerCompletable })` is true, render `SharedPractitionerResultView` and **return**.  

Nothing else in the page moved: BACKGROUND_SR, SAGE_SR_*, PSF, and the default (PHQ-9 / GAD-7 / ASQ / …) branches are untouched below that return. Only additive fields on the result select (`clientCompletable`, `practitionerCompletable`, `sessionNoteId`, `practitionerProfileId`).

### 2. Ben01-shaped LRAMP result (self-test fixture)

Fixture mirrors the described instance (B1 = Yes, F1 = b, F2 = next individual session, C four Yes, D four Yes + one Somewhat, E4 techniques + Other nested):

- Summary: Final disposition lead **B.** + full F1 label; Re-evaluate “Next individual session”; Formal assessment “Conducted”; Risk factors “4 Yes”; Protective factors “4 Yes · 1 Somewhat”.
- Section C: subheadings “Acute risk factors” then “Population-specific risk factors” in form order; C01 before C16.
- E4: techniques and Other appear after E4 at depth 1, option labels not codes.

### 3. B1 = No path

`buildAnswerSections` marks C and D `skipped: true` with empty rows; the answer UI shows header + “Not asked” and does not expand. Summary self-test: Risk / Protective = “Not asked”, Formal assessment = “Not conducted”.

### 4. Score column short disposition

For LRAMP rows, Score shows e.g. “B. Some imminent danger” via `scoreLabel` from `lrampShortDisposition`.  

**Query added** in `loadAssessmentResultsForClient`: one `assessment_responses` join to `assessment_elements` where `element_key = 'lramp_f1'` and `assessment_instance_id IN (…all LRAMP instance ids on the list…)`, practice- and client-scoped — not one query per row.

### 5. Session-note View + Edit return path

- View → `/clients/{clientId}/results/{assessmentResultId}?returnTo={sessionNoteUrl}` (before Edit).
- Results Back → `safeReturnTo(returnTo)` else Assessments.
- Edit → `buildPractitionerEditHref` with `returnTo` = this results URL (including its own `returnTo` when present), so Edit → Save/Cancel can return to results, then Back to the session note.

### 6. Ownership checks on the new branch

Same gates as the page already uses, plus extras on the shared path:

- `requirePractitionerContext()`
- Client: `clientId` + `practiceId` + `isActive`
- Result: `resultId` + `clientId` + `practiceId`
- Responses: filtered by instance id + `clientId` + `practiceId`
- Session note (if linked): `sessionNoteId` + `practiceId` + `clientId`
- `usesSharedPractitionerForm` before rendering

## Anything removed

- Duplicated `firstClauseOfLabel` / short-disposition logic from `lramp-session-summary.ts` (now imports `lrampShortDisposition` from `lramp-summary.ts`).

## Decisions the prompt left open

1. **Summary registry module** — `lib/assessments/result-summaries.ts` (not inside the page or answer-rows).
2. **List F1 labels** — resolved via in-repo `LRAMP_ELEMENTS` after the batch F1 query (avoids a second definition load for the list).
3. **Letter badge on results** — neutral bordered badge (same size/placement as the form), without progress colour states.
4. **Session note link date** — `session_notes.session_date` formatted en-AU short month in practice TZ; “not attached” when no `session_note_id`.
5. **Live Ben01 preview** — not opened (SSO); summary/answer behaviour verified with an offline fixture matching the stated answers.
