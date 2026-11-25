# Round AF report — shared scoring + Start client questionnaires + shared answer table

Branch: `test/shared-scoring` (from `main` at `b5b42b8`)  
No PR opened (prompt guardrail). No database changes. No migrations.  
No local dev server. Secrets and live client identifiers omitted.

## Commits

- `2de369d` — Round AF: shared scoring, Start client questionnaires, shared answer table
- This commit — Round AF report only

## Files changed (feature commit)

### New

- `lib/assessments/scoring/score-assessment.ts` — `scoreAssessment(input)` shared entry point
- `lib/assessments/scoring/score-assessment.selftest.ts` — golden fixtures per code (+ PHQ-9 client/practitioner parity)
- `lib/assessments/section-presentation.ts` — letter vs number badges; ungrouped single section
- `lib/assessments/section-presentation.selftest.ts`
- `lib/assessments/instance-access-link.ts` — `instanceHasAccessLink` (link-completed check)

### Modified

- `app/api/assessments/submit/route.ts` — scoring block replaced with `scoreAssessment`; validation / battery / triggers / audit unchanged
- `lib/assessments/practitioner-routes.ts` — `canCompleteInSharedForm` + `usesSharedResultsLayout` (replaced `usesSharedPractitionerForm`)
- `lib/assessments/practitioner-routes.selftest.ts`
- `lib/assessments/save-practitioner-assessment.ts` — scored saves call `scoreAssessment`; refuse link-completed edits; LRAMP unscored path unchanged
- `lib/assessments/load-form-definition.ts` — `isActive`, `elementScoreMetaByKey` (domainCode / dataType)
- `lib/assessments/start-list.ts` / `.selftest.ts` — enable client rows via `canCompleteInSharedForm`; BTP note
- `lib/assessments/form-rules.ts` — `sectionStatuses` uses presentation helper; ungrouped section; `showSectionProgressBar`
- `lib/assessments/answer-rows.ts` — ungrouped / numbered section presentation for shared answer table
- `components/assessments/practitioner-assessment-form.tsx` — numbered badges; hide progress when ungrouped
- `app/clients/.../assessments/new|edit|start` pages — `canCompleteInSharedForm`; edit refuses access-link instances; Start enables client questionnaires
- `app/clients/.../results/[result_id]/page.tsx` — `usesSharedResultsLayout` for LRAMP early branch; default branch uses `AnswerSections`; Edit when shared edit would accept
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
| All `lib/assessments/**/*.selftest.ts` (incl. scoring + section-presentation) | Pass |
| `lib/reports/tom-example.selftest.ts` | Pass (Tom report text unchanged) |
| `lib/reports/generate-background-report.selftest.ts` | Pass |
| `tom-example-db.selftest.ts` | Skipped |

## Migration names

None.

## Branch preview URL

https://practice-mvp-git-test-shared-scoring-benedwards-practicemvp.vercel.app

(Confirmed after push via Vercel commit status when available.)

## Checks

### 1. Result columns the submit route writes from scoring

Inventory of columns the submit route sets on `assessment_results` from scoring / insert:

| Column | Set by scoring / insert today? | Returned by `scoreAssessment`? |
|--------|--------------------------------|--------------------------------|
| `score` | Yes | Yes (`score`) |
| `severity` | Yes | Yes (`severity`) |
| `structured_score_json` | Yes | Yes (`structuredScoreJson`) |
| `assessment_date` | Yes (caller `now`) | No — caller sets |
| `status` | No explicit value; DB default `'scored'` | No — same default on practitioner scored save |
| `acute_risk_rating` | **Never** set by this route | Not returned (ASQ’s own path unchanged) |
| FKs / ids | Yes (instance / client / practice) | No — caller sets |

Confirmed: `scoreAssessment` returns every scoring-derived column the route writes (`score`, `severity`, `structuredScoreJson`).

### 2. Moved branches (old line ranges on `b5b42b8` submit route) — no logic edits

Old file: `app/api/assessments/submit/route.ts` at `b5b42b8`.

| Branch | Old lines | Notes |
|--------|-----------|-------|
| Special-code flags | 143–163 | Moved into `scoreAssessment` |
| Default `totalScore` / PSF score accumulation | 266–295 | Moved into `scoreAssessment` (same skip list + `dataType === "integer"`) |
| `scoredResponses` map | 327–334 | Built inside `scoreAssessment` from input |
| BTP | 336–338 | Included (sets score 0) |
| PSF | 339–342 | |
| LEVEL1_XC | 343–346 | |
| PC_PTSD5 | 347–349 | |
| ASRS_PART_A | 350–353 | |
| ASRS_PART_B | 354–357 | |
| DASS21 | 358–361 | |
| PHQ15 | 362–364 | |
| SUBSTANCE_USE_L2 | 365–368 | |
| DES_B | 369–371 | |
| SCI | 372–374 | |
| ASRM | 375–377 | |
| PID5_FBF | 378–381 | |
| SPECIFIC_DISORDER_SELECTOR | 382–385 | |
| PANIC_DISORDER | 386–388 | |
| AGORAPHOBIA | 389–391 | |
| SOCIAL_ANXIETY | 392–394 | |
| SEPARATION_ANXIETY | 395–397 | |
| SPECIFIC_PHOBIA | 398–400 | |
| PCL5 | 401–406 | Local rename `totalScore` → `pcl5Total` only to avoid shadowing the accumulator |
| Default (`severityFromAssessmentCode`) | 407–410 | PHQ-9, GAD-7, ASSIST, others |

**Shape-only change (not calculation):** input rows now carry `dataType` (and optional `responseValue` / element id) so the shared module can own the integer total / PSF accumulation that previously lived beside the branch table. Thresholds, rounding, and severity wording are unchanged. Instrument helpers (`calculate*`, `severity.ts`, `pcl5.ts`, …) were not edited.

### 3. Golden self-test results per code

`npx tsx lib/assessments/scoring/score-assessment.selftest.ts` — all ok:

| Code | Fixture coverage |
|------|------------------|
| PHQ9 | Mild boundary (5), all-3s Severe (27), severity table 4/5/9/10/14/15/19/20, Ben01-style client=practitioner parity |
| GAD7 | All-2s Moderate (14); severity 4/5/9/10/14/15 |
| ASSIST | Six 1s; severity 3/4/26/27 |
| DASS21 | All zeros; depression-only max 42 |
| PCL5 | All zero; totals 27/28/30/31; provisional criteria met at low score |
| PHQ15 | Sum 15 + severity bands |
| PSF | Mixed signed scores |
| LEVEL1_XC | Max-per-domain |
| PC_PTSD5 | Gate off → 0; gate on → 5 |
| ASRS_PART_A | Positive screen |
| ASRS_PART_B | Raw passthrough |
| SUBSTANCE_USE_L2 | Endorsed count + item scores |
| DES_B | All 2s → 16 |
| SCI | Threshold 16 / above |
| ASRM | 5 less likely / 10 high probability |
| PID5_FBF | Impulsivity facet only |
| SPECIFIC_DISORDER_SELECTOR | Mixed selector scores |
| PANIC_DISORDER / AGORAPHOBIA / SOCIAL_ANXIETY / SEPARATION_ANXIETY / SPECIFIC_PHOBIA | All 2s → 20 Moderate; subtype band edges 4/5/15/25/35 |
| BTP | Score 0 |

Expected values computed from each instrument helper + severity table, then compared to `scoreAssessment`.

### 4. Submit route behaviour unchanged

Unchanged: request validation, resubmit vs first submit, response row persistence, battery-next token validation, `evaluateAndAppendTriggers`, battery mark/complete, audit events (`assessment.submitted`, `assessment_result.scored`), JSON response shapes (`success`, `nextUrl`, `batteryComplete`).

**Lines that changed (relative to pre-move route):** removed per-instrument scoring imports; removed inline `is*` scoring block and total/PSF accumulation; added `scoreAssessment(...)` call and assigned `resultScore` / `severity` / `structuredScore` from its return. Trigger call still passes the same `score` / `structuredScore` values.

### 5. `canCompleteInSharedForm` and `usesSharedResultsLayout`

**`canCompleteInSharedForm` used in:**

- `app/clients/.../assessments/new/[assessment_code]/page.tsx`
- `app/clients/.../assessments/edit/[instance_id]/page.tsx`
- `lib/assessments/save-practitioner-assessment.ts` (new + edit)
- `lib/assessments/start-list.ts` (client row `enabled`)
- `app/clients/.../results/[result_id]/page.tsx` (default-branch Edit visibility)

**Accepts today (from code + seeds):**

- Practitioner-only, non-legacy, active, with elements: **LRAMP** (and any future same-shaped code).
- Active client+practitioner questionnaires with elements, excluding `BTP`, `BACKGROUND_SR`, `ASQ`, `mse`: e.g. **PHQ9, GAD7, ASSIST, DASS21, PHQ15, LEVEL1_XC, PC_PTSD5, ASRS / ASRS_PART_A / ASRS_PART_B, SUBSTANCE_USE_L2, DES_B, SCI, ASRM, PID5_FBF, SPECIFIC_DISORDER_SELECTOR, PANIC_DISORDER, AGORAPHOBIA, SOCIAL_ANXIETY, SEPARATION_ANXIETY, SPECIFIC_PHOBIA, PCL5**.

**Refuses:** ASQ, mse (legacy); BTP, BACKGROUND_SR (excluded list); PSF (`practitionerCompletable: false`); SAGE_SR_* (both completable false); inactive / no elements.

**`usesSharedResultsLayout` used in:**

- `app/clients/.../results/[result_id]/page.tsx` (early LRAMP branch only)

**Accepts today:** practitioner-only non-legacy → **LRAMP** only among seeded instruments. Scored questionnaires stay on the default Results layout.

### 6. Edit refused for link-completed instances

Check: `instanceHasAccessLink(instanceId)` in `lib/assessments/instance-access-link.ts` — any `assessment_access_links` row for the instance.

- Edit page: `notFound()` when true.
- `saveEditPractitionerAssessment`: returns error *“This assessment was completed by the client and cannot be edited.”*
- Results Edit link: shown only when `canCompleteInSharedForm` **and** `!instanceHasAccessLink(...)`.

### 7. Practitioner PHQ-9 same results as client link (same answers)

Self-test fixture in `score-assessment.selftest.ts`: fixed PHQ-9 item scores → `expectedTotal` + `severityFromAssessmentCode("PHQ9", …)`; both “client path” and “practitioner path” call the same `scoreAssessment` and deep-equal. Practitioner save writes those same `score` / `severity` / `structuredScoreJson` columns with default status `scored`, matching submit.

### 8. Results page — default branch answer list only

Change is confined to the final default return (after ASQ/PSF/SAGE/Background early branches): Summary card kept; “Question responses” table replaced with `AnswerSections` + `buildAnswerSections`. ASQ summary wording, PSF, SAGE-SR, Background self-report, and LRAMP early branch untouched (aside from renaming the LRAMP gate to `usesSharedResultsLayout`).

## Anything removed

- `usesSharedPractitionerForm` (replaced by the two named gates).
- Inline scoring imports and branch table from the submit route (logic lives once in `scoreAssessment`).
- Start page “Coming soon” on rows that `canCompleteInSharedForm` enables.

## Decisions the prompt left open

- Whether plain (non-`X. `) group labels should be numbered per-section index even when mixed with lettered labels — implemented as per-section: lettered keep letter; plain use `index + 1`.
- Ungrouped Results section title when `group_label` is null: used `"Responses"` as the accordion title (form hides the section chrome entirely).
- `ASRS` (combined seed definition, both completable) is enabled on Start if present with elements; Part A/B remain separate codes.
- BTP scoring branch moved into `scoreAssessment` even though BTP is excluded from the shared form, so submit still has a single scoring entry point.
