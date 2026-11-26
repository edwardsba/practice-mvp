# Round AI (step 1 of 2) — Audit: what removing the old ASQ and MSE pages would delete

Branch: `test/remove-legacy-asq-mse` (from `main` at `7e89bf4`).  
**Audit only.** This commit adds this report. No application code, migrations, or other files were changed. No PR opened (prompt guardrail). No database access. No local dev server.

## Commit

- This commit — Round AI audit report only (on `test/remove-legacy-asq-mse` at `7e89bf4` + report)

---

## A. Files that would be deleted

### A.1 Legacy ASQ routes (`app/clients/[client_id]/asq/`)

No `layout.tsx`, `loading.tsx`, or `error.tsx` under this tree. Four files only:

| File | What it does |
|------|----------------|
| `app/clients/[client_id]/asq/new/page.tsx` | Server page: loads client + ASQ questionnaire, renders legacy `AsqForm` for a new screen (optional `session_note_id`). |
| `app/clients/[client_id]/asq/new/asq-form.tsx` | Client form: radio Yes/No per question; `useActionState` → `saveAsqResult` (or injected edit action). |
| `app/clients/[client_id]/asq/new/actions.ts` | Server actions `saveAsqResult` / `updateAsqResult`: create/update instance + responses + scored `assessment_results` + audit; redirects to session note / client / shared results. |
| `app/clients/[client_id]/asq/[instance_id]/edit/page.tsx` | Server page: loads existing responses into `AsqForm` with `updateAsqResult`; overwrite warning. |

### A.2 Legacy MSE routes (`app/clients/[client_id]/mse/`)

No `layout.tsx`, `loading.tsx`, or `error.tsx`. Five files:

| File | What it does |
|------|----------------|
| `app/clients/[client_id]/mse/new/page.tsx` | Server page: loads client + MSE questionnaire, renders legacy `MseForm` (optional `session_note_id` / `returnTo`). |
| `app/clients/[client_id]/mse/new/mse-form.tsx` | Client form: groups questions via `groupMseQuestions`, radios in `CollapsibleSection`s; saves via `saveMseResult` / edit action. |
| `app/clients/[client_id]/mse/new/actions.ts` | Server actions `saveMseResult` / `updateMseResult`: create/update instance + responses + audit (no scored result row on this legacy path); redirects to session note / client / legacy MSE detail. |
| `app/clients/[client_id]/mse/[instance_id]/page.tsx` | Legacy MSE **results** page: grouped answer table, Edit link to `/mse/.../edit`, session-note links. |
| `app/clients/[client_id]/mse/[instance_id]/edit/page.tsx` | Server page: loads existing responses into `MseForm` with `updateMseResult`. |

### A.3 Modules used only by those legacy pages

Named in the Round AH hand-off, plus every other sole-use module found:

| File | What it does |
|------|----------------|
| `lib/assessments/load-mse.ts` | Loads active `mse` definition elements/options as `MseQuestion[]`; `getMseDefinitionId()`. Re-exports grouping helpers. |
| `lib/assessments/mse-grouping.ts` | Types `MseQuestion` / `MseQuestionGroup` and `groupMseQuestions()` by `groupLabel` / `subgroupLabel`. |
| `lib/assessments/load-asq.ts` | Loads active `ASQ` definition elements/options as `AsqQuestion[]`; `getAsqDefinitionId()`. **Only** imported by the legacy ASQ tree (not by shared form/scoring). |
| `components/session-notes/collapsible-section.tsx` | Collapsible UI used **only** by legacy `mse-form.tsx` (no other importers in `app/` or `components/`). |

**Not** sole-use (keep; shared / live):

- `lib/assessments/asq.ts`, `asq-summary.ts`, scoring, `result-summaries.ts`
- `lib/mse/*` except the legacy label rows inside `insert-words.ts` / `option-display-order.ts` (see §C)
- `components/session-notes/mse-status-badge.tsx`, `asq-status-badge.tsx`
- `lib/mse/load-session-note-sentence.ts`, `load-report-results.ts`, `session-note-sentence.ts`, `noted.ts`

---

## B. Who still uses them

Classification: **legacy-only** = goes with deletion; **live** = shared code still needs it (or a comment/doc reference that must be edited, not deleted with the file).

### B.1 Per file in §A

#### `app/clients/[client_id]/asq/new/page.tsx` — **legacy-only**

| Reference | Kind | Class |
|-----------|------|-------|
| Internal route only (unlinked from Start / session notes / results) | route | legacy-only |
| Round AG/AH reports, `PROJECT_MAP.md` “until Round AI” | docs | live doc text → update in step 2 |

No `href` / `redirect` / `revalidatePath` from outside this tree. `proxy.ts` has no ASQ-specific rule (normal auth gate).

#### `app/clients/[client_id]/asq/new/asq-form.tsx` — **legacy-only**

| Reference | Kind | Class |
|-----------|------|-------|
| `asq/new/page.tsx`, `asq/.../edit/page.tsx` | import | legacy-only |
| `shared-form-guard.selftest.ts` radio allow-list (“remove in Round AI”) | self-test | live until step 2 removes the allow-list entry |

#### `app/clients/[client_id]/asq/new/actions.ts` — **legacy-only** (file); uses **live** helpers

| Reference | Kind | Class |
|-----------|------|-------|
| `asq-form.tsx`, edit page | import | legacy-only |
| Imports `asqFlagsFromResponses` / `asqScreenOutcome` from `lib/assessments/asq.ts` | import | **live** module — keep `asq.ts` |
| Imports `getAsqDefinitionId` from `load-asq.ts` | import | legacy-only with `load-asq.ts` |
| `lib/sage-sr/import-sage-sr-report.ts:147` comment cites this file as a transaction pattern | comment | **live** file — rewrite comment in step 2 (point at shared save or another actions file) |
| Docs (round-ag-report, etc.) | docs | historical |

Redirects inside this file go to `/session-notes/...`, `/clients/...`, or `/clients/.../results/...` — not to other legacy ASQ routes. No `revalidatePath`.

#### `app/clients/[client_id]/asq/[instance_id]/edit/page.tsx` — **legacy-only**

Only imports sibling legacy ASQ modules + `load-asq`. No external importers.

#### `app/clients/[client_id]/mse/new/page.tsx` — **legacy-only**

Same pattern as ASQ new page. No external links.

#### `app/clients/[client_id]/mse/new/mse-form.tsx` — **legacy-only**

| Reference | Kind | Class |
|-----------|------|-------|
| MSE new/edit pages | import | legacy-only |
| `mse-grouping.ts` | import | legacy-only |
| `CollapsibleSection` | import | legacy-only (sole use) |
| `shared-form-guard.selftest.ts` allow-list | self-test | remove entry in step 2 |

#### `app/clients/[client_id]/mse/new/actions.ts` — **legacy-only**

| Reference | Kind | Class |
|-----------|------|-------|
| `mse-form` / edit page | import | legacy-only |
| `getMseDefinitionId` from `load-mse.ts` | import | legacy-only |
| `redirect(.../mse/${instanceId})` on update | redirect | legacy-only (dies with pages) |

#### `app/clients/[client_id]/mse/[instance_id]/page.tsx` — **legacy-only**

Self-contained results UI. Internal hrefs only (`/mse/.../edit`, session-note URLs). No external importers.

#### `app/clients/[client_id]/mse/[instance_id]/edit/page.tsx` — **legacy-only**

Fallback back-button href to `/mse/{instanceId}`. No external importers.

#### `lib/assessments/load-mse.ts` — **legacy-only**

Importers: MSE new page, MSE edit page, MSE actions (`getMseDefinitionId`). Re-exports from `mse-grouping`. **No** use by submit route, reports, session notes, or shared form.

#### `lib/assessments/mse-grouping.ts` — **legacy-only**

Importers: `load-mse.ts`, `mse-form.tsx`. Docs mention only.

#### `lib/assessments/load-asq.ts` — **legacy-only**

Importers: ASQ new/edit pages, ASQ actions, `asq-form` type.  
Note: `loadAsqForSession` in `lib/session-notes/load-context.ts` is a **different local function**, not this module.

#### `components/session-notes/collapsible-section.tsx` — **legacy-only**

Sole importer: `mse-form.tsx`. Step 2 should delete it with the MSE form (or it becomes dead code).

### B.2 Live surfaces that look related but do **not** import legacy files

| Surface | Uses | Risk if §A deleted |
|---------|------|---------------------|
| `components/session-notes/mse-status-badge.tsx` | `deriveAssessmentStatus` + `ASQ_STATUS_CONFIG` only | **None** — keep |
| Session note page (`app/session-notes/[session_note_id]/page.tsx`) | `MseStatusBadge`; View → `/results/{assessmentResultId}`; Start/Edit → `buildPractitionerStartHref` / `buildPractitionerEditHref` | **None** |
| `components/session-notes/asq-status-badge.tsx` + list pages / report form / `session-note-actions` | Boolean completed badge only | **None** |
| `app/api/assessments/submit/route.ts` | Shared scoring (`asq.ts` / `scoreAssessment`); no legacy ASQ/MSE imports | **None** |
| `lib/reports/`, `lib/assessment-summary/` | `asq-template`, `mse-template`, `insert-words`, `option-display-order`, `load-report-results` — **not** legacy pages/loaders | **None** if only §A + sole-use loaders deleted; **do not** delete whole `insert-words` / `option-display-order` files |
| `lib/assessments/asq.ts` | Shared scorer + (today) legacy actions | **Keep**; step 2 may drop the “legacy ASQ save actions” comment |
| `proxy.ts` | No `/asq` or `/mse` special cases | **None** |

### B.3 Old saved links (`/clients/{id}/asq/...`, `/clients/{id}/mse/...`)

Findings:

- No in-app `href` / Start / session-note / results entry points still target these routes (confirmed by repo grep outside the legacy trees; Round AG/AH already unlinked them).
- Session notes, emails (`lib/email`), and communications (`lib/communications`) do not embed these path strings in code.
- Audit events record clinical mutations, not deep links to `/asq` or `/mse`.
- Practitioner browser bookmarks or old chat/email URLs could still hit the App Router paths until the folders are deleted; after deletion those URLs 404.

**Recommendation: accept 404** (no redirects).

Rationale: nothing in the product still navigates there; ASQ never had a stable public results URL under `/asq/{instance}`; MSE view was `/mse/{instanceId}` while the shared view is `/results/{assessmentResultId}` — a correct redirect would need a DB lookup from instance → result, which is more machinery than the residual bookmark risk warrants. Step 2 should not add `next.config` / `proxy` redirects unless Ben asks for them.

---

## C. Old MSE answer wordings

### C.1 Entries step 2 would remove

**`lib/mse/insert-words.ts`**

- File comment L4: *“Old Orientation/Memory labels kept until Round AI removes the legacy pages.”*
- `orientation` — comment *“Legacy labels (kept until Round AI)”* plus:
  - `Place` → `"disorientation to place"`
  - `Object` → `"disorientation to object"`
  - `Person` → `"disorientation to person"`
  - `Time` → `"disorientation to time"`
- `memory` — comment *“Legacy labels (kept until Round AI)”* plus:
  - `"Short-Term"` → `"short-term memory impairment"`
  - `"Long-Term"` → `"long-term memory impairment"`

**`lib/mse/option-display-order.ts`**

- File comment L6: *“Old Orientation/Memory labels kept after the new ones until Round AI.”*
- `orientation` — comment + legacy: `None: 1`, `Place: 2`, `Object: 3`, `Person: 4`, `Time: 5` (keep the new Fully oriented / Disoriented… keys)
- `memory` — comment + legacy: `None: 1`, `"Short-Term": 2`, `"Long-Term": 3` (keep Intact / Short-term impaired / …)

Note: `None` under orientation/memory is also a Round-AI leftover (baselines are now `Fully oriented` / `Intact`). Other fields’ `None` keys (hallucination, etc.) are **current** labels — do not remove those.

**Live consumers of these maps (must keep the files):**

- `lib/mse/session-note-sentence.ts` → session-note sentence
- `lib/assessment-summary/mse-template.ts` → progress-report / letter paragraph  
Loaders join `assessment_responses.response_value` → **current** `assessment_options.option_label`, so after migration 0083 production sentences already use the new labels. Legacy map rows are only for old label strings still passed in (self-tests / any pre-0083 snapshot that stored labels literally).

### C.2 Self-test assertions that rely on legacy labels

In `lib/mse/session-note-sentence.selftest.ts` only:

1. `"legacy Memory Short-Term still maps"` — `abnormal("Short-Term")`
2. `"legacy Orientation Time still maps"` — `abnormal("Time")`

No other `*.selftest.ts` asserts `Place` / `Object` / `Person` / `Short-Term` / `Long-Term` for MSE insert words. `mse-template.selftest.ts` uses the **new** labels (`Fully oriented`, `Short-term impaired`, etc.).

Step 2: delete those two assertions (and keep the new-label cases).

### C.3 Claude to check (database)

- Confirm **no** active MSE template option still has `option_label` in (`Place`, `Object`, `Person`, `Time`, `Short-Term`, `Long-Term`) — or legacy baseline `None` on `mse_orientation` / `mse_memory` (should be `Fully oriented` / `Intact` after 0083).
- Confirm no `assessment_options` rows for mse Orientation/Memory still use the old labels (seed + 0083 should already match the new wording).
- Optional sanity: count responses whose `response_value` is `place`, `person`, or `object` (0083 rewrote/deleted those option values; Round AH expected zero). Values `time` / `none` / `short_term` / `long_term` remain valid and join to **new** labels.

---

## D. Guard self-test and route code

### D.1 Allow-list entries to remove (`shared-form-guard.selftest.ts`)

```ts
"app/clients/[client_id]/mse/new/mse-form.tsx":
  "Legacy MSE form — remove in Round AI",
"app/clients/[client_id]/asq/new/asq-form.tsx":
  "Legacy ASQ form — remove in Round AI",
```

After the files are deleted, these two entries **must** be removed or the allow-list would point at missing paths (the guard only fails on unexpected radios; stale allow-list keys are not currently asserted to exist — still remove them for honesty).

The empty-`LEGACY_START` assertion via `legacyStartEntriesForGuard()` stays or goes with §D.2.

### D.2 `PractitionerStartTarget` `"legacy"` / `LEGACY_START` / `legacyStartEntriesForGuard`

Current state (`lib/assessments/practitioner-routes.ts`):

- `LEGACY_START = {}` (empty); comment says keep empty until Round AI removes pages
- `PractitionerStartTarget` still has `{ kind: "legacy"; pathSuffix: string }`
- `practitionerStartTarget` / `buildPractitionerStartHref` still branch on `kind === "legacy"`
- `canCompleteInSharedForm` / `usesSharedResultsLayout` still treat membership in `LEGACY_START` as false
- `legacyStartEntriesForGuard()` exists only for the guard self-test
- `practitioner-routes.selftest.ts` does **not** cover the legacy branch (only shared gates for ASQ/mse/LRAMP/…)

**Recommendation: remove the legacy machinery** in step 2 (not keep an empty safety net).

Reason: ASQ and MSE were the only consumers; the map is already empty; dead branches and a guard that only asserts emptiness add noise. Simplify to always shared start hrefs; drop `legacyStartEntriesForGuard` and the guard’s `LEGACY_START` emptiness check (or replace with a one-line comment that legacy start paths must not return). Keep `SHARED_FORM_EXCLUDED_CLIENT_CODES` (BTP / BACKGROUND_SR) — unrelated.

---

## E. Anything else left over from the old ASQ and MSE

| Location | What |
|----------|------|
| `PROJECT_MAP.md` Clinical Process #5 | “Legacy MSE and ASQ pages remain on disk unlinked until Round AI.” |
| `lib/assessments/practitioner-routes.ts` header | “legacy MSE/ASQ pages remain on disk unlinked until Round AI” |
| `lib/assessments/asq.ts` | Comment: “shared scorer and the legacy ASQ save actions” |
| `lib/mse/insert-words.ts` / `option-display-order.ts` | Round AI keep-until comments + legacy keys (§C) |
| `lib/assessments/shared-form-guard.selftest.ts` | Allow-list “remove in Round AI” |
| `lib/sage-sr/import-sage-sr-report.ts` | Comment path to `asq/new/actions.ts` |
| `db/migrations/0083_mse_shared_form.sql` L2 | Comment: safe while legacy MSE pages still run — historical; leave as-is or soften in step 2 (no need to rewrite applied SQL) |
| `docs/cursor-reports/round-ag-report.md`, `round-ah-report.md`, `merge-asq-shared-report.md`, `merge-mse-shared-report.md`, `round-ab-report.md`, `round-ac1-report.md` | Historical Round AI / LEGACY_START / unlinked-page notes — leave as audit trail; do not rewrite past reports |
| `mse-form.tsx` `GROUP_DEFAULT_OPEN` | Still keys `"Mental Function"` (pre-0083 group name) — dies with the form |

No seed script still invents Place / Short-Term labels (`db/seed-mse.ts` already uses the new Orientation/Memory wording).

---

## F. Proposed step 2 (do not execute in this round)

### Delete (exact paths)

1. Entire trees:
   - `app/clients/[client_id]/asq/` (4 files)
   - `app/clients/[client_id]/mse/` (5 files)
2. Sole-use modules:
   - `lib/assessments/load-mse.ts`
   - `lib/assessments/mse-grouping.ts`
   - `lib/assessments/load-asq.ts`
   - `components/session-notes/collapsible-section.tsx`

### Edits (exact)

1. `lib/mse/insert-words.ts` — remove Round AI comment + legacy Orientation/Memory keys (§C.1).
2. `lib/mse/option-display-order.ts` — remove Round AI comment + legacy Orientation/Memory keys including `None` under those two fields only.
3. `lib/mse/session-note-sentence.selftest.ts` — remove the two legacy assertions (§C.2).
4. `lib/assessments/shared-form-guard.selftest.ts` — remove the two allow-list entries; adjust/remove `legacyStartEntriesForGuard` usage per §D.2.
5. `lib/assessments/practitioner-routes.ts` (+ selftest if needed) — remove `LEGACY_START`, legacy `PractitionerStartTarget` variant, legacy branch in `buildPractitionerStartHref`, and `legacyStartEntriesForGuard`; update header comment.
6. `PROJECT_MAP.md` #5 — drop “Legacy MSE and ASQ pages remain… Round AI”; note deletion complete / shared-only.
7. `lib/assessments/asq.ts` — drop “legacy ASQ save actions” from the comment.
8. `lib/sage-sr/import-sage-sr-report.ts` — retarget the pattern comment away from deleted `asq/new/actions.ts` (e.g. shared practitioner save or another live actions file).

### Redirects

- **None** (recommend 404). No `proxy.ts` / `next.config` changes for `/asq` or `/mse`.

### Checks step 2 should run

1. `npx tsc --noEmit`
2. `npm run lint`
3. `npm run build`
4. `npx tsx lib/assessments/shared-form-guard.selftest.ts`
5. `npx tsx lib/assessments/practitioner-routes.selftest.ts`
6. `npx tsx lib/mse/session-note-sentence.selftest.ts`
7. Broader: `lib/assessments/**/*.selftest.ts`, `lib/mse/*.selftest.ts`, `lib/assessment-summary/*.selftest.ts` (at least asq/mse/scoring/template)
8. Grep gate: no remaining imports of deleted paths; no `href` to `/asq/` or `/mse/` under `app/`, `components/`, `lib/`
9. Claude DB checks in §C.3 (agent does not touch the database)

### Out of scope for step 2

- No migrations
- No edits under `app/api/assessments/submit/` or `lib/reports/` beyond what is required if a comment/import somehow pointed at deleted files (currently none)
- No rewrite of historical cursor reports

---

## Claude to check

1. **MSE option labels:** no template options still labelled Place / Object / Person / Time / Short-Term / Long-Term (or Orientation/Memory baseline still `None`).
2. **Response values:** zero (or explained) responses with `place` / `person` / `object` on mse Orientation after 0083.
3. **0083/0084 applied** on Production (merge report says yes — confirm if step 2 timing needs it).
4. **Ben decision:** confirm 404 vs redirect for old URLs (§B.3 / open decisions).

---

## Decisions the prompt left open

1. **Old URL behaviour:** recommend **404**; Ben may still want redirects (especially `/mse/{instanceId}` → shared results via lookup).
2. **Legacy start machinery:** recommend **remove** empty `LEGACY_START` / `"legacy"` kind / `legacyStartEntriesForGuard`; alternatively keep as an empty safety net — prompt asked for one recommendation (§D.2).
3. **`CollapsibleSection`:** recommend **delete** (sole importer is legacy MSE form); keep only if Ben wants the primitive for future UI.
4. **Orientation/Memory `None` in `option-display-order`:** recommend remove with the Place/Short-Term set; confirm Claude DB check first.
5. **`PROJECT_MAP` status for Clinical #5:** stays Partial (LRAMP/other notes) vs flip wording only — step 2 should update the Round AI sentence either way; whether the row stays “Partial” is editorial.
6. **Sage-SR comment target:** which live file should replace `asq/new/actions.ts` in the import comment (shared `save-practitioner-assessment.ts` is the natural stand-in).
)
