# Round AC.1 report — limit shared practitioner form to intended assessments

Branch: `test/lramp` (from Round AC report `c62e4ae`)  
No PR opened (prompt guardrail). No database changes. No migrations.

## Commits

- `356aacb` — Round AC.1: gate shared practitioner form to non-legacy practitioner-only assessments
- This commit — Round AC.1 report only

## Files changed (feature commit)

### New

- `lib/assessments/practitioner-routes.selftest.ts`

### Modified

- `lib/assessments/practitioner-routes.ts` — `usesSharedPractitionerForm`
- `lib/assessments/save-practitioner-assessment.ts` — gate both save actions; remove `void instanceId` / `void cleanAnswers` / unused `cleanAnswers` import
- `app/clients/[client_id]/assessments/new/[assessment_code]/page.tsx` — `notFound()` unless rule is true
- `app/clients/[client_id]/assessments/edit/[instance_id]/page.tsx` — `notFound()` unless rule is true for the instance’s definition

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
| All `lib/assessments/*.selftest.ts` | Pass (incl. new `practitioner-routes.selftest.ts`) |
| `lib/reports/tom-example.selftest.ts` | Pass |
| `lib/reports/generate-background-report.selftest.ts` | Pass |
| `tom-example-db.selftest.ts` | Skipped |

`usesSharedPractitionerForm` self-tests: LRAMP → true; ASQ → false; mse → false; PHQ9 (both completable) → false; made-up practitioner-only → true; not practitioner-completable → false.

## Branch preview URL

https://practice-mvp-git-test-lramp-benedwards-practicemvp.vercel.app

Vercel commit status for `356aacb`: success (deployment completed). Preview still behind Vercel SSO (same as Round AC); no interactive walkthrough attempted.

## Checks

### 1. Every place the rule is enforced

| Location | Behaviour |
|----------|-----------|
| `lib/assessments/practitioner-routes.ts` — `usesSharedPractitionerForm` | Single pure rule: `practitionerCompletable && !clientCompletable && code ∉ LEGACY_START` |
| New page `…/assessments/new/[assessment_code]` | `notFound()` unless rule is true for the loaded definition |
| Edit page `…/assessments/edit/[instance_id]` | Loads definition by **instance** `assessmentCode`; `notFound()` unless rule is true |
| `saveNewPractitionerAssessment` | Error unless rule is true for the posted definition |
| `saveEditPractitionerAssessment` | After confirming posted code’s definition id matches the **instance’s** `assessmentDefinitionId`, error unless rule is true for that definition |

Confirmed (already correct; no code change this round):

| Location | Behaviour |
|----------|-----------|
| Session note LRAMP block | Hardcoded `…/assessments/new/LRAMP` (LRAMP passes the rule) |
| Interview “Start LRAMP” | `buildPractitionerStartHref({ assessmentCode: "LRAMP", … })` only |
| Start page practitioner section | Still uses `practitionerStartTarget` unchanged (ASQ/MSE → legacy paths; others → shared path). Shared path then 404s for non-qualifying codes via the new page gate |

### 2. Edit action checks the instance’s own definition

Yes. `saveEditPractitionerAssessment` loads the instance by id (practice-scoped), loads the definition from the posted `assessment_code`, requires `definition.assessmentDefinitionId === instance.assessmentDefinitionId`, then applies `usesSharedPractitionerForm` to that definition’s code and completable flags. A mismatched posted code fails before the rule; a matching ASQ/MSE/PHQ-9 instance fails the rule.

The edit **page** also loads the definition from `instance.assessmentCode` (not a query param) before gating.

### 3. ASQ, MSE, client questionnaire, battery unchanged

- No edits under ASQ or MSE pages.
- No edits under `app/q/`, `app/api/`, `lib/reports/`, or `scripts/`.
- No battery or client-questionnaire route/action changes.
- `LEGACY_START` still routes ASQ → `asq/new` and mse → `mse/new` via `practitionerStartTarget` / `buildPractitionerStartHref`.
- Client-completable instruments (e.g. PHQ-9) fail `usesSharedPractitionerForm` even when also practitioner-completable.

## Anything removed

- `void instanceId` and `void cleanAnswers` in `save-practitioner-assessment.ts`
- Unused `cleanAnswers` import and the unused `instanceId` local (assignment was only for the void)

## Decisions the prompt left open

1. **Error copy on gated saves** — New save still returns `"Assessment definition not found."` when the rule fails (same shape as a missing definition). Edit save uses a distinct `"This assessment cannot be edited with the shared form."` Neither was specified; kept new-path wording minimal and made edit-path explicit.
2. **Start page rows for dual-completable codes** — Left `practitionerStartTarget` unchanged per prompt. A dual-completable code that is not in `LEGACY_START` still links to the shared new URL and hits `notFound()` there. Filtering those rows out of the Start page practitioner section was not requested.
3. **Loading edit definition by posted code vs instance code** — Kept posted-code load + definition-id match to the instance (with rule on that definition). Equivalent to trusting only the instance once ids match; no extra DB join added.
