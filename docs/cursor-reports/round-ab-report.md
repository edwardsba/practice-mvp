# Round AB report — shared assessment form core + LRAMP definition

Branch: `test/lramp` (from `main` at `516e1bf`)  
No PR opened (prompt guardrail).

## Commits

- `7973dc1` — Round AB: shared assessment form rules, schema columns, and LRAMP definition
- This commit — Round AB report only

## Files changed

### Feature commit (`7973dc1`)

- `db/schema/02-assessment-definitions.ts` — nullable form columns + element_type docs
- `db/schema/03-assessment-instances.ts` — `response_order` + storage-rule docs
- `db/migrations/0081_assessment_form_rules.sql` — additive `ADD COLUMN IF NOT EXISTS`
- `db/migrations/0082_lramp_definition.sql` — idempotent LRAMP seed (generated)
- `db/generate-lramp-sql.ts` — offline SQL generator (writes file only; no DB)
- `lib/assessments/form-rules.ts` — pure visibility / validate / clean / toResponseRows
- `lib/assessments/form-rules.selftest.ts` — synthetic + LRAMP path coverage
- `lib/assessments/definitions/lramp.ts` — LRAMP structure (seed source + self-tests)
- `PROJECT_MAP.md` — Clinical #5 notes LRAMP definition, UI not built

### Report commit

- `docs/cursor-reports/round-ab-report.md`

## Command results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | Pass |
| `npx next build` | Pass |
| `npx tsx lib/assessments/form-rules.selftest.ts` | Pass (checks 1–10) |
| All `lib/client-background/*.selftest.ts` | Pass |
| All `lib/funding/*.selftest.ts` | Pass |
| All `lib/clients/*.selftest.ts` | Pass |
| All `lib/medical-contacts/*.selftest.ts` | Pass |
| All `lib/navigation/*.selftest.ts` | Pass |
| All `lib/assessments/*.selftest.ts` | Pass |
| `lib/reports/tom-example.selftest.ts` | Pass (unchanged) |
| `lib/reports/generate-background-report.selftest.ts` | Pass (unchanged) |
| `tom-example-db.selftest.ts` | Skipped (as instructed) |

Migrations **not run** (Claude applies after review).

## Migration names (not run)

- `0081_assessment_form_rules.sql`
- `0082_lramp_definition.sql`

## Branch preview URL

https://practice-mvp-git-test-lramp-benedwards-practicemvp.vercel.app

Vercel commit status: success (deployment completed). Alias also reported: `https://practice-ce86qvy1w-benedwards-practicemvp.vercel.app`.

## Checks

### 1. Places that read `assessment_elements` / `assessment_responses`

Runtime readers (unchanged behaviour for existing assessments — new columns are nullable and unused by these paths):

| Surface | Files |
|---------|--------|
| Client questionnaire load | `lib/assessments/load-questionnaire.ts` |
| Submit route | `app/api/assessments/submit/route.ts` |
| Battery / BTP | `lib/assessments/btp.ts`, `lib/assessments/btp-results.ts`, `lib/assessments/impairment.ts`, `lib/assessments/max-score.ts` |
| ASQ | `lib/assessments/load-asq.ts`, `lib/assessments/asq.ts`, `app/clients/.../asq/**` |
| MSE | `lib/assessments/load-mse.ts`, `lib/mse/load-report-results.ts`, `lib/mse/load-session-note-sentence.ts`, `app/clients/.../mse/**` |
| Results page | `app/clients/[client_id]/results/[result_id]/page.tsx` |
| Settings › Assessments | `lib/actions/assessment-definitions.ts` (+ pages under `app/settings/assessments/`) |
| Summaries / session notes | `lib/session-notes/load-context.ts`, `lib/appointments/cascade-delete.ts` |

None of these select or require the new columns. Existing radio / integer scoring paths are unchanged. Additive only.

### 2. LRAMP cannot be sent to a client

- Definition: `client_completable = false`, `practitioner_completable = true` (in `0082` / `lramp.ts`).
- Send assessment chip list: `getDefaultBatteryAssessments` in `lib/assessments/battery-defaults.ts`, backed by hardcoded `BATTERY_ASSESSMENT_CODES` in `lib/assessments/battery-codes.ts` (`BTP`, `PHQ9`, `GAD7`, `ASSIST` only). LRAMP is not offered.
- Note: `createAssessmentLink` itself does not currently filter on `clientCompletable`; the Send UI / battery list is what keeps LRAMP off the client send path (same pattern as ASQ/MSE).

### 3. Settings › Assessments lists LRAMP

Once `0082` is applied, `getAssessmentDefinitions` / `getAssessmentDefinitionByCode` will return LRAMP. The detail page renders `element.elementType` as plain text — no type whitelist — so `yes_no`, `checkbox`, `tick`, `text_list`, `long_text`, `short_text`, and `date` display without code changes. Not verified against a live DB in this environment (migrations not run here).

### 4. Element and option counts in 0082

Recount from the prompt structure: **98 elements** (matches expectation). Options inserted: **229**.

Breakdown by type: radio 31, yes_no 18, checkbox 12, text_list 32, tick 2, long_text 1, short_text 1, date 1.

### 5. 0081 and 0082 are idempotent and additive only

- **0081:** `ADD COLUMN IF NOT EXISTS` only; no drops, renames, or NOT NULL.
- **0082:** definition `ON CONFLICT (assessment_code) DO NOTHING`; elements `ON CONFLICT (element_key) DO NOTHING`; options `WHERE NOT EXISTS` (same element + option value). No updates to existing instruments.

### 6. Generator never connects to the database

`db/generate-lramp-sql.ts` imports only Node `fs`/`path` and the LRAMP TypeScript definition. No `DATABASE_URL`, `pg`, Drizzle, or network. It writes `db/migrations/0082_lramp_definition.sql` and exits.

### 7. Background self-report types the new building blocks cannot yet express

Leave `lib/background-questionnaire/` alone (as instructed). Gaps vs current Background kinds/features:

- **`number`** inputs (with min/max) — no shared element type yet
- **Arbitrary predicate visibility** — Background uses `visible: (answers) => boolean` (and part-level logic such as “education level has field” / employed statuses); `show_when_json` only supports `{ key, in: [...] }` on a single referenced element
- **Nested `conditionals`** attached to a parent question with their own kinds and visibility functions
- **Typed multi-section JSON answer model** (`BackgroundAnswers` parts) rather than flat one-row-per-answer storage

Covered or close: radio, yes/no, text, textarea → radio / yes_no / short_text / long_text; checkboxes → checkbox; optional hints ≈ `help_text`.

## Anything removed

Nothing removed.

## Decisions the prompt left open

1. **Option value snake_case names** — Invented short values from the option labels (e.g. `history_at_intake`, `baseline_behaviours`). Labels/wording are exact per the prompt.
2. **`data_type` for LRAMP radios** — Set to `text` (same as MSE unscored radios), not `integer`.
3. **`toResponseRows` scoring** — Radio uses option `scoreValue`; yes_no / checkbox / tick / text / date score `0` (LRAMP options are all `0`).
4. **Checkbox `response_order`** — Numbered 1…n in answer order; tick (single `ticked`) stores `response_order` null.
5. **Notes under yes/no parents without their own `show_when`** (e.g. `lramp_e7_notes`, `lramp_e6_1_notes`) — Visible whenever the parent is visible, including when the parent answer is No (per prompt legend).
6. **`createAssessmentLink` and `clientCompletable`** — Not changed this round; Send list filtering remains the practical gate.
7. **No PR** — Per Round AB guardrails.
