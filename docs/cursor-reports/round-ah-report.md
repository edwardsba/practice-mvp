# Round AH report — MSE on the shared form and shared results view

Branch: `test/mse-shared` (from `main` at `ee27e9c`).

## Commits

| SHA | Message |
|-----|---------|
| `a416a55` | Round AH: move MSE onto shared form with pre-filled answers |
| *(this commit)* | Round AH report only |

## Files changed

**Migrations (not applied by the agent)**

- `db/migrations/0083_mse_shared_form.sql` — five MSE groups; Orientation/Memory option reshape; delete `object`
- `db/migrations/0084_mse_result_backfill.sql` — idempotent `assessment_results` for mse instances without one

**Seed / docs**

- `db/seed-mse.ts` — matches 0083 definition
- `AGENTS.md` — “Assessments: one shared form, one shared results view”
- `PROJECT_MAP.md` — Clinical Process #5 points at that rule; MSE on shared form

**Shared form (general pre-filled rule)**

- `lib/assessments/form-rules.ts` (+ `form-rules.selftest.ts`) — defaults, pre-filled vs confirmed, section status precedence, dialog copy
- `lib/assessments/draft-storage.ts` — persists `confirmedKeys`
- `lib/assessments/load-form-definition.ts` — loads `isDefaultSelection` / `isReportingBaseline`
- `components/assessments/form/radio-option-list.tsx` — `onOptionActivate` (re-tap confirms)
- `components/assessments/form/element-control.tsx` / `assessment-form-core.tsx` — Pre-filled tag + activate
- `components/assessments/practitioner-assessment-form.tsx` — chips, confirm dialog, draft confirmed set
- `components/assessments/confirm-prefilled-dialog.tsx` — app Dialog (not `window.confirm`)
- `app/clients/[client_id]/assessments/new/[assessment_code]/page.tsx` — `defaultAnswersFromElements` on new

**Routing / session note**

- `lib/assessments/practitioner-routes.ts` (+ selftest) — `mse` removed from `LEGACY_START` and `SHARED_FORM_EXCLUDED_CLIENT_CODES`; `LEGACY_START` empty
- `app/session-notes/[session_note_id]/page.tsx` — MSE start/View/Edit → shared routes
- `lib/session-notes/load-context.ts` — MSE `assessmentResultId` for View link

**Scoring / results**

- `lib/mse/noted.ts` (+ selftest) — noted-count rule (Insight/Judgement: only Poor)
- `lib/assessments/scoring/score-assessment.ts` — `mse` branch
- `lib/assessments/save-practitioner-assessment.ts` — scores mse even when `scoring_enabled` is false
- `lib/assessments/mse-summary.ts` + `result-summaries.ts` — one-line sentence summary
- `lib/assessments/load-results.ts` — Score column uses mse severity text
- `components/assessments/answers/result-summary-box.tsx` — empty-label rows render full-width

**Sentence / letter**

- `lib/mse/session-note-sentence.ts` (+ selftest) — suicidality included
- `lib/mse/insert-words.ts` / `option-display-order.ts` — new Orientation/Memory labels; legacy labels kept
- `lib/mse/load-session-note-sentence.ts` / `load-report-results.ts` — comments cleaned
- `lib/assessment-summary/mse-template.selftest.ts` — letter paragraph includes suicidality

**Guard**

- `lib/assessments/shared-form-guard.selftest.ts` — radio allow-list + empty `LEGACY_START`

**Kept on disk (unlinked; remove in Round AI)**

- `app/clients/[client_id]/mse/**`, `app/clients/[client_id]/asq/**`
- `lib/assessments/load-mse.ts`, `lib/assessments/mse-grouping.ts`

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
| All `lib/assessments/**/*.selftest.ts` (incl. `shared-form-guard`) | Pass |
| All `lib/mse/*.selftest.ts` | Pass |
| All `lib/assessment-summary/*.selftest.ts` | Pass |
| `lib/reports/tom-example.selftest.ts` | Pass (Tom Background report text unchanged) |
| `lib/reports/generate-background-report.selftest.ts` | Pass |
| `tom-example-db.selftest.ts` | Skipped |

Guard probe: temporary `app/_guard_probe/probe.tsx` with `type="radio"` → self-test failed with AGENTS.md hint; file removed → pass. Not committed.

## Migration names

1. `0083_mse_shared_form.sql` — definition/options only (template elements `assessment_instance_id IS NULL`)
2. `0084_mse_result_backfill.sql` — insert missing mse `assessment_results` (`WHERE NOT EXISTS`)

Claude applies both. Agent did not run them.

## Preview URL

https://practice-2j4oapx9e-benedwards-practicemvp.vercel.app  

(Vercel Preview for `a416a55` on `test/mse-shared` — Deployment has completed / success)

## Exact MSE result-row values (shared save / Part 6)

Columns the shared practitioner save writes for an MSE (via `scoreAssessment` mse branch + scored insert path):

| Column | Value |
|--------|--------|
| `status` | `'scored'` (schema default; scored path) |
| `score` | `NULL` |
| `severity` | `'Within limits'` when noted count is 0; otherwise `'N noted'` (e.g. `'2 noted'`) |
| `structured_score_json` | `{"notedCount": N, "notedElementKeys": ["mse_…", …]}` (keys in response order among noted) |
| `acute_risk_rating` | not set (null) |
| `assessment_date` | practitioner-chosen date → `practiceLocalToUtc` noon practice TZ |

Noted rule (`lib/mse/noted.ts` / SQL backfill): non-baseline options count, except Insight/Judgement where only option label `Poor` counts (Fair and Good do not).

Backfill `assessment_date`: `COALESCE(submitted_at, created_at, now())` for historical instances that never had a form date.

## Checks

1. **Does 0083 leave Production’s legacy MSE working?** Yes. It only updates template elements/options. Groups become Presentation / Perceptions / Thoughts / Cognitions / Discernment (legacy `groupMseQuestions` still renders by `group_label`). New Memory option appears as an extra radio. Renamed Orientation values have zero historical responses on the old values being rewritten (`place`/`person`); `object` delete is guarded to 0 responses. Existing responses (`none`, etc.) still join by `option_value`.

2. **New MSE for Ben01: 15 pre-selected, five yellow chips, section 1 open?** By design after 0083 + this code: `defaultAnswersFromElements` selects every default; all five sections start `to_confirm` (amber “N pre-filled”); new mode opens only the first section. *(UI not exercised in a browser in this run — no local/dev DB apply of 0083.)*

3. **Re-tapping a pre-selected answer confirms it?** Yes — shared `RadioOptionList` `onOptionActivate` fires on every row click including re-tap; confirmed keys stored in the localStorage draft.

4. **Save dialog?** Yes — after required validation passes, if any pre-filled remain: title “Confirm pre-filled answers?”; singular/plural body with section list joining; **Go back** closes and opens every `to_confirm` section; **Confirm and save** confirms all then saves. Dialog is `ConfirmPrefilledDialog` (shadcn Dialog), not `window.confirm`.

5. **After saving: result row, Score text, sentence summary, 15-row table?** Yes in code: scored insert with severity + structured JSON; assessments list Score via `scoreLabel` = severity; summary box one full-width sentence from `buildMseSessionNoteSentence`; shared answer table five sections / 15 answers. *(Needs 0083/0084 applied for live Ben01 / existing instances.)*

6. **Session note links?** Start → `buildPractitionerStartHref(…, "mse")`; View → `/clients/{id}/results/{assessmentResultId}`; Edit → `buildPractitionerEditHref`. Heading and sentence unchanged. **Legacy MSE links left:** only inside the unlinked legacy pages under `app/clients/[client_id]/mse/` (and their internal redirects). No other app entry points still point at `/mse/…`.

7. **LRAMP / ASQ / client questionnaires unchanged for pre-fill?** Yes — no `is_default_selection` → empty defaults, no Pre-filled tags, no confirm dialog. Self-tests cover “no defaults” path; LRAMP section statuses still done/left/skipped only.

8. **Suicidality in sentence and letter? Tom unchanged?** Yes — `mse_suicidality` in `MSE_ELEMENT_KEY_TO_FIELD` and Thoughts group; insert-words + mse-template selftest include suicidality. Tom Background selftests passed unchanged. (`lib/reports/` not edited.)

9. **Guard self-test?** Fail with temporary radio file + AGENTS.md hint; pass after removal. Passes with empty `LEGACY_START`.

## Anything removed

- `mse` from `LEGACY_START` and from `SHARED_FORM_EXCLUDED_CLIENT_CODES`
- Session-note links to legacy `/mse/new` and `/mse/{instanceId}`
- “suicidality deliberately excluded” comments / engine omission
- Orientation option `object` (migration, guarded; seed no longer creates it)

Nothing deleted from disk for legacy MSE/ASQ pages or `load-mse.ts` / `mse-grouping.ts`.

## Decisions the prompt left open

1. **Done chip wording:** sections with any default-selection option show header badge **“Confirmed”** when done; sections without defaults keep **“Complete”**. Progress chips use amber **“N pre-filled”** for `to_confirm` and **“N left”** for unanswered.
2. **Summary box line:** one `ResultSummaryLine` with empty `label` and the sentence as `value`; shared box’s “Summary” heading stays; empty-label rows render full-width (general shared-box rule).
3. **MSE still `scoring_enabled = false` on the definition;** shared save calls `scoreAssessment` for `mse` anyway and uses the scored insert path (`status = 'scored'`).
4. **Backfill `assessment_date`:** `COALESCE(submitted_at, created_at, now())` (historical instances had no form date field).
5. **No PR** opened or updated (Round AH guardrail).
6. **Preview URL** is the Vercel deployment `environment_url` for commit `a416a55` (per-deployment host, not a branch alias).
7. **Checks 2–5 live UI** against Ben01 were not run in-browser here (migrations not applied; no local DB). Behaviour is covered by code + self-tests; Claude should verify after applying 0083/0084.
