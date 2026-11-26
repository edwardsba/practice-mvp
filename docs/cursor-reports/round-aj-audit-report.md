# Round AJ audit: intake interview redesign (read-only)

Branch: `test/intake-interview` (from `main` at `84cabd9`).  
**Audit only.** This commit adds this report. No application code, migrations, seed files, or other files were changed. No PR opened (prompt guardrail). No database access. No local dev server. No secrets or real client clinical content.

Test client IDs referenced by the redesign brief (not queried this round): Tom Example (test) `0a546f0c-a164-46a1-a766-47f36216a229`; Ben01 McTesty `100f2b7e-55ad-4ff7-b7e4-a4fa60e4433e`. Tom's Background report text must stay unchanged through later build rounds.

## Commit

- `d0357e8` — Round AJ audit report only (on `test/intake-interview` at `84cabd9` + report)
- Follow-up commit on the same branch — corrections from deeper path audit (report file only; still no app/migration/seed changes, no PR)

## Files changed

- `docs/cursor-reports/round-aj-audit-report.md` (this file only; both commits)

## Command results

| Command | Result |
|---------|--------|
| `git fetch origin main` | OK; local `main` = `84cabd9` |
| `git checkout -b test/intake-interview` | OK |
| `npx tsc --noEmit` | **Did not run cleanly.** `npx` resolved the wrong package (`tsc@2.0.4`, not project TypeScript). `./node_modules/.bin/tsc` missing because `node_modules/` is not installed in this environment. Per guardrails, dependencies were **not** installed (that would write files beyond the report). Branch itself is clean of code changes. |
| Database / secrets | Not used (audit is code/schema read-only). |

Path existence: every path named below was checked with `test -f` on this branch and exists unless noted as historical migration-only.

---

## Part 1: the current interview

### 1.1 Files that make up the interview today

**Route / shell**

| File | Role |
|------|------|
| `app/clients/[client_id]/background/interview/page.tsx` | Server page: auth, requires in-progress interview, loads background + self-report + funding + medical contacts + LRAMP href; renders `InterviewPage` with `page=background\|history`. |
| `components/client-background/interview-page.tsx` | Client shell: Background/History tabs, section open state, autosave phase bar, Save and leave, Complete wiring, Worth-checking jump, Background sections (funding, identity, education, occupation, relationships, living). |
| `components/client-background/interview-card.tsx` | Client Background page card: start / continue interview, answered count, Worth checking. |
| `components/client-background/interview-section-card.tsx` | Collapsible interview section card + sessionStorage open-state helpers + `needsBadge`. |
| `components/client-background/interview-autosave.tsx` | Generic `AutosaveFields`: 350ms debounce on `change`, `registerFlush`, failed-save retry. |
| `components/client-background/interview-history.tsx` | History tab: screening save, history tree, stressors autosave, Complete confirm dialog (unanswered → Not asked + Worth checking). |

**Background-tab UI used by the interview**

| File | Role |
|------|------|
| `components/client-background/demographics-section.tsx` | Identity / education / occupation / living field editors (interview uses the `*FieldsEditor` exports). |
| `components/client-background/relationship-blocks-section.tsx` | Intimate + caregivers relationship blocks; **section Save** (not field autosave); drafts until Save. |
| `components/client-background/relationship-panel-shared.tsx` | Shared person/block panel fields and shell. |
| `components/client-background/relationship-edit-footer.tsx` | Discard / Save footer for relationship sections and panels. |
| `components/client-background/relationship-tree-section.tsx` | Relationship tree display (also Client Background; interview uses blocks section primarily). |
| `components/client-background/new-relationship-panel.tsx` | New relationship block draft panel. |
| `components/client-background/new-person-draft-form.tsx` | New person draft until Save. |
| `components/client-background/add-to-relationship-menu.tsx` | Add-to-relationship menu. |
| `components/client-background/discard-changes-dialog.tsx` | Discard confirmation. |
| `components/client-background/fields.tsx` | Shared field controls including `PartialDatePicker` (age ↔ year). |
| `components/clients/referral-funding-quick-view.tsx` | Referral/funding quick-view lines. |
| `components/funding/interview-funding-add-panel.tsx` | Interview-only side panel wrapping `FundingApprovalForm`. |
| `components/funding/funding-approval-form.tsx` | Create/edit funding approval (+ may create claim). |

**History-tab UI**

| File | Role |
|------|------|
| `components/client-background/history-tree-section.tsx` | Four-level history tree + screening radios in interview presentation; issue/event side panels. |
| `components/client-background/history-section.tsx` | Older/history entry forms still used by tree panels. |
| `components/client-background/smart-history-forms.tsx` | Smart new-issue / new-event forms. |
| `components/client-background/context-strip.tsx` | Grey About/For/Category strip on history panels. |
| `components/client-background/tree-levels.tsx` | Tree visual layers. |
| `components/client-background/medication-stressors.tsx` | Stressors fields (+ legacy medication helpers); interview History uses `StressorsFields`. |
| `components/client-background/worth-checking.tsx` | Worth-checking link list + `scrollToBackgroundCheck`. |
| `components/medical-contacts/prescriber-field.tsx` | Prescriber picker on medication events (from medical contacts / professionals). |

**Server actions**

| File | Role |
|------|------|
| `app/clients/[client_id]/background/actions.ts` | Interview actions: start/complete interview, save screening, identity/education/occupation/living/stressors/risk, relationship block mutations, history issue/event mutations. |

**Loaders / mutations / domain (`lib/client-background/`)**

| File | Role |
|------|------|
| `load.ts` | `loadClientBackground`, `loadInProgressInterview`, `loadBackgroundInterviewCard`, `loadLatestBackgroundSelfReport`, `loadReasonSupport`. |
| `mutations.ts` | Upsert demographics/stressors/risk; start/save screening/complete interview; history issue/event writes; `ensureFamilyOfOrigin`. |
| `block-mutations.ts` | Relationship blocks/people answers; `saveRelationshipStatusWithCurrentBlock`. |
| `interview-history.ts` | Screening keys, Yes/No/Not asked, finalize/count unanswered, question groups. |
| `checks.ts` | `backgroundChecks` / Worth checking rules + interview page target mapping. |
| `types.ts` | Demographics, blocks, stressors, risk, living, relationship enums. |
| `sanitize.ts` / `map.ts` | JSON ↔ typed records; orientation column merge on read. |
| `age.ts` / `partial-date.ts` | Age ↔ year helpers; partial dates. |
| `history-tree.ts` / `history-issues.ts` / `history-links.ts` / `condition-groups.ts` / `smart-event-fields.ts` / `form-context.ts` / `tree.ts` | History tree/issue/link helpers. |
| `relationship-blocks.ts` / `relationship-tree.ts` / `relationship-panel-display.ts` / `person-draft.ts` / `add-to-relationship.ts` / `visibility.ts` / `unsaved-changes.ts` | Relationship editor helpers. |
| `professionals.ts` / `medication.ts` | Professional options; medication helpers. |
| `*.selftest.ts` | Ad-hoc self-tests for the above. |

**Schema / report / self-report touchpoints**

| File | Role |
|------|------|
| `db/schema/20-client-background.ts` | `client_backgrounds`, relationship/event/issue tables, `client_background_interviews`. |
| `lib/background-questionnaire/to-client-background.ts` | Maps BACKGROUND_SR answers → interview "Client: …" suggestions. |
| `lib/reports/load-background-report-source.ts` | Loads living background + chosen interview `screening_json` for Background report. |
| `lib/reports/generate-background-report.ts` (+ prose helpers / Tom fixture selftests) | Background report wording; depends on living demographics + relationships, not on interview UI. |
| `lib/reports/relationship-block-report.ts` | Partner/children/parents prose from relationship **blocks** (uses `client_current.status` for partnered openings; falls back to `client_backgrounds.relationship_status` when there is no current block). |

### 1.2 How saving works today

**Autosave (`AutosaveFields`)** — identity, education, occupation, living situation, stressors:

- Listens for DOM `change` on the section root; debounces **350ms**, then calls the matching server action (`saveIdentityAction`, etc.).
- Updates a shared phase map (`saved` / `saving` / `error`) shown in the sticky header.
- On error, stores a **retry** callback that clears `lastSaved` and re-runs.
- Registers a **flush** that cancels the timer, runs any pending save, and awaits in-flight work.

**Save and leave** — `InterviewPage.leave()`:

- `await flushAll()` over every registered flusher, then navigates to `/clients/[id]/background`.
- Does **not** complete the interview.

**`registerFlush`**:

- Interview page owns a `Set` of flush functions.
- Autosave sections register; relationship blocks register an inflight waiter; history screening registers an inflight waiter.
- Complete and Save and leave both flush first.

**Failed-save retry**:

- Header shows "Couldn't save — retry" when any phase is `error` and not currently saving; click runs each failed section's retry.

**What saves at once vs only on Save**

| Area | When it persists |
|------|------------------|
| Identity / education / occupation / living | Autosave on field `change` (+ flush on leave/complete) |
| History screening Yes/No/Not asked | **Immediate** on each radio choice → `saveInterviewScreeningAction` → `screening_json` |
| Stressors | Autosave like demographics |
| Relationship status, block answers (`previous_relationships`, …), block status/dates/children/siblings answers | **Only on section Save** (Intimate / Caregivers). Browser drafts until then. Discard restores baseline. |
| Relationship people (new/edit) | Panel **Save** (`saveRelationshipPersonDraftAction` / related) |
| History issues / events / treatment answers | Panel **Save** (`createEventAction` / `updateEventAction` / issue actions) — not via `AutosaveFields` |
| Referral / funding add panel | Nothing until funding form Save |
| Complete | Flushes autosaves; then `completeBackgroundInterviewAction` finalizes interview row (does not itself re-save relationship drafts — flush covers registered flushers only; unsaved relationship section drafts are **not** auto-committed unless the section registered a flush that saves them — today the relationship flusher only awaits inflight saves, it does **not** call Save section) |

Practical implication: unsaved Intimate/Caregivers drafts can be lost on Save and leave / Complete unless the practitioner hit Save section first.

### 1.3 `client_background_interviews`

Schema (`db/schema/20-client-background.ts`): one row per clinician-led interview; unique partial index = one `in_progress` per client.

| Column | Use |
|--------|-----|
| `status` | `in_progress` or `completed`. Route redirects away if none in progress. |
| `screening_json` | History screening answers (current keys only after `sanitizeScreening`). Updated on each screening click; rewritten on complete via `finalScreeningAnswers` (entries force `yes`; blanks → `not_asked`). |
| `snapshot_json` | Set **only on complete**: demographics, relationshipStatus, relationships, events, screening, stressors at that moment. Not read by the live Background report loader (report uses living `client_backgrounds` + current children). |
| `self_report_id` | BACKGROUND_SR `assessment_results` id verified on complete, or null. |
| `completed_at` | Set on complete; also drives `clients.background_captured_at`. |

**Complete checks today** (`InterviewHistory` confirm dialog):

1. Flush autosaves.
2. List **unanswered** via `unansweredInterviewLabels`: unanswered screening category keys + each issue missing `treatmentAnswer` + unanswered stressors. Completing records those as Not asked (screening finalize + stressor fill in `completeBackgroundInterview`).
3. Run **`getChecks` → `backgroundChecks`**: referral missing; partner status vs people; children count vs self-report; lives-with pick-list vs person `living_situation`; work role/previous jobs; screening Yes with no entries; disability detail; history detail/unlinked treatment; issue Who; block/member needs; children/siblings answers; unplaced/unlinked people.
4. Show Worth checking links (`worth-checking.tsx`); Complete still allowed.
5. Persist complete + snapshot; navigate to Client Background.

There is **no** hard block that every screening key is answered before Complete — unanswered become Not asked.

### 1.4 Where Yes / No / Not asked answers are stored

**History screening** — `client_background_interviews.screening_json`  
Allowed values: `yes` \| `no` \| `not_asked` (`SCREENING_ANSWERS`).  
Current keys (`HISTORY_QUESTION_KEYS`):  
Client: `emotional_problems`, `substance_use`, `illness_injury`, `self_harm`, `traumatic_events`, `other_significant_events`, `other_treatment`.  
Family: `family_emotional_problems`, `family_substance_use`, `family_illness`, `family_self_harm`, `family_significant_events`.

**Block-level Yes / None / Not asked** — `client_backgrounds` columns + per-block columns  
Allowed values: `yes` \| `none` \| `not_asked` (`BLOCK_ANSWERS`). Empty string in UI = unanswered.

| Field | Storage |
|-------|---------|
| Previous relationships | `client_backgrounds.previous_relationships` |
| Other children | `client_backgrounds.other_children` |
| Mother's other relationships | `client_backgrounds.mother_other_relationships` |
| Father's other relationships | `client_backgrounds.father_other_relationships` |
| Caregiver arrangements | `client_backgrounds.caregiver_arrangements` |
| Children (per intimate block) | `client_relationship_blocks.children_answer` |
| Siblings (per caregiver/parent block) | `client_relationship_blocks.siblings_answer` |

**Issue treatment answer** — `client_history_issues.treatment_answer`: `yes` \| `none` \| `not_asked` (`TREATMENT_ANSWERS`).

**Stressors** — `client_backgrounds.stressors_json`: per key `yes` \| `no` \| `not_asked` \| null, plus `mainReason` string.

---

## Part 2: double-ups

### 2.1 Relationship status

Domains overlap only for partnered codes. Copy A uses `CLIENT_RELATIONSHIP_STATUSES` (includes `single` / `separated` / `divorced` / `widowed`). Copy B on `client_current` uses `CURRENT_BLOCK_STATUSES` (partnered only). Previous blocks use `PREVIOUS_BLOCK_STATUSES` (endings) — those are not a double-up of A.

**Copy A — `client_backgrounds.relationship_status` (+ `relationship_status_other`)**

- **Writes:** `saveClientRelationshipStatus` / `saveRelationshipStatusWithCurrentBlock` (`lib/client-background/mutations.ts`, `lib/client-background/block-mutations.ts`); interview Intimate Save via `saveRelationshipStatusBlockAction`. `saveClientRelationshipStatusAction` exists but is **unused by UI** (column-only; no block sync).
- **Reads:** load/`toClientRelationshipStatus`; `backgroundChecks`; relationship tree; Background report non-partnered fallback and partner noun in housing (`generate-background-report.ts` `livingItem`).
- **Tom's report:** **Yes** — needed when there is no current block / for housing partner noun; partnered prose primarily comes from B.

**Copy B — `client_relationship_blocks.status` on `kind = client_current`**

- **Writes:** created/updated from A when partnered via `saveRelationshipStatusWithCurrentBlock`; also editable on the block and saved via `updateRelationshipBlock` / section Save. **Sync hole:** editing B through `updateRelationshipBlock` does **not** write back to A → drift risk.
- **Reads:** block UI; Worth checking; **report** `lib/reports/relationship-block-report.ts` (`currentOpening` / `partnersFromBlocks`) for partnered sentences.
- **Tom's report:** **Yes** — partnered openings use B (`client_current.status`). Previous-block statuses also drive previous-relationship prose (not a double-up of A).

**Recommend keep:** A as canonical **client** status (required for non-partnered). Keep previous-block statuses as relationship-unit endings. Treat `client_current.status` as a derived mirror of A for partnered codes (or always sync B → A on edit). Do not drop A.

**Safe removal order:** (1) Close the sync hole (current-block status edits always update A, or remove non-`statusSource` editing). (2) Delete unused `saveClientRelationshipStatusAction`. (3) Tom report + Worth checking regression. (4) Optionally stop dual-editing B as independent; column drop only if B becomes fully derived (last).

### 2.2 Sexual orientation

**Copy A — `identity_json.sexualOrientation` (+ `Other`)**

- **Writes:** `saveIdentity` → `identity_json` (interview Identity autosave; demographics editors).
- **Reads:** UI; self-report Use mapping; Background report `orientationPhrase` via identity.
- **Tom's report:** **Yes** — uses identity orientation.

**Copy B — `client_backgrounds.sexual_orientation` (+ `_other` columns)**

- **Writes:** same `saveIdentity` path dual-writes via `orientationColumns`.
- **Reads:** `demographicsFromStored` **prefers columns when set**, overlaying into identity.
- **Tom's report:** only via the merge into identity (seed writes both).

**Recommend keep:** `identity_json` (one demographics blob). Drop duplicate columns after backfill/verify identity_json is complete for all rows.

**Safe removal order:** (1) Confirm every row's identity_json has orientation when columns do (read-only SQL by Claude later). (2) Stop writing columns; read identity_json only. (3) Tom report selftest. (4) Drop columns in a later removal migration.

### 2.3 Lives with

**Copy A — `living_situation_json.livesWith` (+ `livesWithOther`)**

- **Writes:** `saveLivingSituation` (interview Living autosave).
- **Reads:** Living editor pick-list; Worth checking `lives-with` rule; **Background report housing paragraph** (`livingItem` in `lib/reports/generate-background-report.ts` — **A only**).
- **Tom's report:** **Yes** — housing sentence is driven by this pick-list (Tom fixture: `with_partner_and_children`).

**Copy B — `client_relationship_records.living_situation` (+ `dependency`)**

- **Writes:** person Save on relationship panels (`livingSituation`, `dependency`).
- **Reads:** person UI; Worth checking (`markedLivingWith`); client panel summary via `lib/clients/background-summary.ts` (primary “lives with …” from people; A only for alone fallback). **`dependency` is not used by the Background report.**
- **Tom's report:** people are seeded with `lives_with_client_full_time`, but **letter housing prose ignores B** today.

**Recommend keep (redesign):** person-level living ticks (+ new "Others in the home") as household composition source of truth; keep `housingType` / `housingStability` on living_situation_json (and A only for alone / no fixed address / other until report catches up). **Retire** categorical `livesWith` as authoritative “who”.

**Safe removal order (Tom-safe):** (1) Additive: others-in-home + interview tick UI; keep writing `livesWith` for now. (2) Point report `livingItem` at people (like `background-summary`) **only when** Tom fixture text stays identical. (3) Stop writing/showing pick-list. (4) Drop `livesWith` keys from JSON shape in a later round.

### 2.4 Tom Background report — dependency matrix (double-ups)

| Fact | Report uses? | Where |
|------|--------------|--------|
| `relationship_status` columns | **Yes** | Non-partnered fallback in `partnersFromBlocks`; partner noun in `livingItem` |
| `client_current.status` | **Yes** | `currentOpening` / partnered prose in `lib/reports/relationship-block-report.ts` |
| Orientation (merged identity) | **Yes** | `orientationPhrase` |
| Orientation columns alone | Indirect (preferred on load today) | `demographicsFromStored` |
| `livesWith` JSON | **Yes** | `livingItem` |
| Person `living_situation` | **No** (fixture only) | — |
| Person `dependency` | **No** | — |

---

## Part 3: things to be removed

### 3.1 Risk and protective factors (`components/client-background/risk-section.tsx`, `client_backgrounds.risk_json`)

| Kind | References |
|------|------------|
| UI | `components/client-background/risk-section.tsx` — **not imported anywhere** (orphan). Client Background page shows a stub: "The read-only Risk view is not part of this release yet." (`components/client-background/client-background-page.tsx` accordion id `risk`). |
| Actions | `saveRiskAction` in `app/clients/[client_id]/background/actions.ts`; `saveRisk` in `lib/client-background/mutations.ts`. |
| Schema / load | `client_backgrounds.risk_json` (created in `db/migrations/0057_client_background.sql`); `lib/client-background/load.ts` → `sanitizeRisk` / `emptyRisk`; `lib/client-background/sanitize.ts`; `lib/client-background/types.ts` (`RISK_FACTORS`, `PROTECTIVE_FACTORS`, …). |
| Tests / fixtures | `lib/client-background/checks.selftest.ts`, `lib/reports/tom-example-fixture.ts`, `lib/reports/generate-background-report.selftest.ts`, `lib/clients/background-summary.selftest.ts` use `emptyRisk()`. |
| Background report | **Does not** emit risk/protective prose (PROJECT_MAP: risk not in the letter). |
| Note | LRAMP assessment files also say "risk" / `fillRiskSection` — those are **LRAMP**, not `risk_json`. Do not delete with this section. |

### 3.2 "Other treatment not linked to an issue" (`other_treatment`)

Two related but distinct things: the **screening question** (to remove from the interview) and the **`other_treatment` event type** (still used as a treatment/nested event under issues — do not conflate).

| Kind | References |
|------|------------|
| Screening key / UI | `lib/client-background/interview-history.ts` (`HISTORY_QUESTION_GROUPS`, `HISTORY_QUESTIONS.other_treatment`); `lib/client-background/history-tree.ts` section title; history tree interview presentation / add button. |
| Routing of unlinked admissions/therapy/meds | `historyQuestionKeyForEvent`, `eventsForQuestion`, `answeredCategoryKeys` in `lib/client-background/interview-history.ts`; `otherTreatmentYes` in `lib/client-background/history-issues.ts`. |
| Event type (keep unless separately retired) | `EVENT_TYPES` / smart forms (`lib/client-background/smart-event-fields.ts`); migrations `db/migrations/0076_history_issues.sql`, `db/migrations/0077_history_events.sql`. |
| Checks | `backgroundChecks` in `lib/client-background/checks.ts` — history Yes-with-no-entries for `other_treatment`. |
| Selftests | `lib/client-background/interview-history.selftest.ts`, `history-tree.selftest.ts`, `history-issues.selftest.ts`, `smart-event-fields.selftest.ts`. |
| Report | Omission label via `HISTORY_QUESTION_GROUPS` in `lib/reports/generate-background-report.ts`; unlinked treatment prose in `lib/reports/background-report-prose.ts`. |
| Self-report | No direct `other_treatment` Client line in `lib/background-questionnaire/to-client-background.ts` (medication prompts are separate). |

### 3.3 Retired screening keys still in data

`sanitizeScreening` **only keeps** current `HISTORY_QUESTION_KEYS`; retired keys are ignored on read but may remain in stored JSON.

Documented / migrated historically:

- `abuse`, `childhood_events` — folded into `traumatic_events` / `other_significant_events` in `db/migrations/0065_history_restructure.sql`.
- `medication_history` — written in migration `db/migrations/0067_background_relationships_history.sql` from old `medication_json`.
- `psychiatric_admission`, `previous_therapy`, `medication_history`, `family_psychiatric_admission` — removed from live `HISTORY_QUESTION_GROUPS` (Round O); still read in migration `db/migrations/0076_history_issues.sql` and in **backfill planner** `planHistoryIssueBackfill` (`lib/client-background/history-issues.ts` + `lib/client-background/history-issues.selftest.ts`) for deriving issue `treatmentAnswer` from old interviews.

`sanitizeScreening` keeps only current `HISTORY_QUESTION_KEYS` (comment: retired hospital/therapy/medication keys ignored on read). Keys may remain in stored JSON until rewritten. Event types `psychiatric_admission` / `previous_therapy` / `medication` remain live **treatment** types — not the same as retired screening keys.

They are not in the live interview UI. Cleanup = stop reading in backfill helpers once unused, then optional JSON scrub migration (removal round).

### 3.4 Stressors inside the interview (report only; data stays)

| Kind | References |
|------|------------|
| UI | History tab `InterviewSectionCard` "Stressors" + `StressorsFields` in `components/client-background/medication-stressors.tsx`. |
| Storage | `client_backgrounds.stressors_json` (incl. `mainReason`). |
| Save | `saveStressorsAction` / `saveStressors`; complete fills unanswered with `not_asked`. |
| Checks / counts | `unansweredInterviewLabels`, interview answer totals, Complete dialog. |
| Report | Presenting-problem / stressors wording in `generate-background-report.ts` (still uses living stressors; out of interview later, data stays). |
| Self-report | `lib/background-questionnaire/to-client-background.ts` stressors + `mainReason` Client lines. |

### 3.5 Background and History page tabs

| Kind | References |
|------|------------|
| UI | `InterviewPage` `PageButton` group; `?page=history` via `router.replace`. |
| State | `sectionOpenStorageKey(..., "background" \| "history")` in `components/client-background/interview-section-card.tsx`. |
| Checks | `interviewPageForCheck` splits targets across the two pages. |
| Complete button | Shown only on History tab header. |

Redesign replaces this with one page and numbered sections 1–9.

---

## Part 4: funding

### 4.1 Where claims are created; auto Medicare on new client

**Created today:**

- `upsertClaim` in `lib/actions/funding.ts` — Claims new/edit forms.
- Funding approval save path in the same file — can create/attach claims (including a Private claim helper insert around the `insert(claims)` near line 1452).
- Interview add panel → `FundingApprovalForm` → those actions.
- Seeds: `db/seed-funding.ts`, Tom seed `scripts/seed-test-client-tom.ts` (`ensureTomMedicareApproval`).

**New client today:** `createClient` in `app/clients/actions.ts` inserts only into `clients` (name, DOB, email, phone). **No claim.**

**To auto-create Medicare with every new client**, change at least:

- `createClient` (and any other client-create path) to resolve the practice's Medicare `claim_types` row and `insert` into `claims`.
- Mirror the `findOrCreatePrivateClaim` pattern in `lib/actions/funding.ts` (find active claim for type; else insert) — but keyed by stable Medicare **code** (see 4.2), not name.
- Tom/Ben seeds become idempotent no-ops if claim already exists.
- Client-delete guards already count active claims (`lib/delete/delete-utils.ts`).
- UI that assumed "no claim yet" empty states.

### 4.2 Telling Medicare apart by name

Name checks today:

| Location | Behaviour |
|----------|-----------|
| `lib/funding/format.ts` | `isMedicareClaimType` = name trim/lower equals `"medicare"`; `isInsuranceClaimType` = everything else |
| `components/funding/claim-form.tsx` | Show Medicare card/IRN vs insurer fields |
| `components/funding/funding-approval-form.tsx` | Medicare referrer rules / field visibility |
| `app/funding/claims/[claim_id]/page.tsx` | Display branches |
| `app/funding/approvals/[approval_id]/page.tsx` | Display branches |
| `lib/actions/funding.ts` | Referrer required when Medicare; `findOrCreatePrivateClaim` matches Private by name |
| `lib/delete/delete-utils.ts` | Active Medicare approvals for a professional: SQL `lower(trim(claim_type_name)) = 'medicare'` |
| `lib/funding/referral.ts` / appointment-type helpers | `"Private"` name constant / lookups |

There is **no** `isNdisClaimType`; NDIS is only a seeded name (`db/seed-funding.ts`).

**Sturdier approach:** add a stable `code` (or `system_key`) on `claim_types` — e.g. `medicare`, `ndis`, `insurer`, `workcover`, `private` — set in seed/migration; resolve by code, not display name. Touch: `db/schema/12-funding.ts` + migration; seeds; `lib/funding/format.ts` helpers; claim/approval forms and pages; `upsertClaim` / approval validation / `findOrCreatePrivateClaim`; `lib/delete/delete-utils.ts`; appointment-type claim pickers; selftests. Keep `claim_type_name` for display labels.

### 4.3 One Medicare and one NDIS claim per client (`is_active` soft-delete)

`claims.is_active` soft-deletes. Enforcement options:

1. **Partial unique index** on `(client_id, claim_type_id) WHERE is_active = true` — allows inactive history, one active row per type. Works once Medicare/NDIS are single claim_type rows per practice.
2. Better with **codes:** unique on `(client_id)` for rows whose type code is `medicare` (and separately `ndis`), still `WHERE is_active`.
3. App-level check in `upsertClaim` / auto-create as defence in depth.

Inactive rows remain for audit; recreating after soft-delete inserts a new active row (unique allows it).

### 4.4 Interview "Referral and funding" section

- **Shows:** `ReferralFundingQuickView` lines (active claims / approvals / referrals) with links to funding pages.
- **Edits:** "+ Add referral or funding approval" opens `InterviewFundingAddPanel` → `FundingApprovalForm` (create approval, optionally claim). No inline Medicare card editor in the interview itself.
- **Worth checking:** `referralRecorded` false → "Referral not recorded".
- Not the same as the future section 2 (Yes/No/N/A for Medicare/NDIS/insurer/WorkCover with automatic Medicare claim).

---

## Part 5: what's new

### 5.1 Preferred name

- **Not on `clients` today.** `preferred_name` exists on **`practitioner_profiles`** only (`db/schema/01-core.ts`).
- Natural store: **`clients.preferred_name`** (same pattern as practitioners). Display: prefer preferred name in interview header / letters only where product asks (Tom report must not change unless preferred name is empty for Tom).

### 5.2 Country of birth and year of arrival

- Natural store: **`identity_json`** (demographics identity) — e.g. `countryOfBirth`, `yearOfArrival` — unless a census-style report needs first-class columns later.
- **Existing age ↔ date helper to reuse:**
  - `yearFromTypedAge` / `assessAge` / `typedAgeMatches` in `lib/client-background/age.ts`
  - UI: `PartialDatePicker` in `components/client-background/fields.tsx` (modes `person` and `client-at-event`: typing age fills year; date derives age; age is never stored).
  - Arrival: age-at-arrival ↔ year-of-arrival from client's DOB mirrors `client-at-event` / `since-birth` (`yearFromTypedAge(..., { kind: "since-birth", birthDate })`).
  - Note: relationship **age at death** stores `age_at_death` but the panel edits death with `PartialDatePicker` `mode="date-only"` — there is no live age↔date mutual UI for death today; do not assume death is the template — use the person / client-at-event modes instead.

### 5.3 "Others in the home" + dependant tick

- Family-tree people already have `living_situation` + `dependency` on `client_relationship_records`.
- Non-tree housemates need a **new** store — options: (a) relationship records with a new role/kind (e.g. `household_other`), or (b) `living_situation_json.othersInHome: [{ name, dependent }]`. Prefer (a) if they may appear in history Who later; (b) if they are living-only.
- Dependant tick for tree people: reuse/clarify `dependency` (today: `neither` / `they_depend_on_me` / `i_depend_on_them` / `mutual`) or a dedicated boolean if "dependant" is narrower.

### 5.4 Per-item answers and marks for nine sections

Belong to **one interview date** → store on **`client_background_interviews`**, not only on living `client_backgrounds`.

Today `screening_json` only covers history category keys; living facts live on background tables; there is no "to confirm" mark.

**Recommendation:**

- Add additive JSON on the interview row, e.g. `answers_json` / `marks_json` (or one structured `interview_state_json`): per section item `{ value: yes\|no\|not_applicable\|confirmed, mark?: to_confirm\|… }`.
- Keep writing living facts to their source tables when confirmed (clients, identity_json, claims flags, relationship ticks, history events).
- `screening_json` can migrate into the new structure then be retired.
- `snapshot_json` remains the completion freeze; extend it to include the new answers/marks.
- Review prefill: load last interview's values into the new in-progress row with every item `to_confirm` until tapped — same idea as MSE `confirmedKeys` in `lib/assessments/form-rules.ts` / `PractitionerAssessmentForm` (edit mode starts confirmed; new review starts unconfirmed).

### 5.5 Medical contacts (section 4 reuse)

- Editor today: **`components/medical-contacts/medical-contacts-section.tsx`** on client Edit details (`app/clients/[client_id]/edit/page.tsx`), with actions in `app/clients/[client_id]/medical-contacts/actions.ts` and `lib/medical-contacts/*`.
- Emergency contacts: **`components/emergency-contacts/emergency-contacts-section.tsx`** (`client_emergency_contacts`) — keep as the simple list for section 4.
- Interview currently **loads** medical contacts for history medication pickers only; it does **not** embed `MedicalContactsSection`. Section 4 should reuse that component (or the same actions + list UI).

---

## Part 6: shared pieces

### 6.1 Assessment form pieces to generalize

| Piece | Today | Make general |
|-------|--------|--------------|
| Number / letter chip row | `PractitionerAssessmentForm` chip strip (`sectionStatuses`, `progressChipAriaLabel`, colour via `progressClass`) | Extract a presentational `SectionProgressChips` that takes `{ id, label, status, badgeText }[]` + scroll-to-section — not FormElement-specific. |
| Section card + status | Assessment collapsible sections + interview `InterviewSectionCard` / `needsBadge` | One `InterviewOrAssessmentSectionCard` (or rename) with status pill props (`left` / `to_confirm` / `done` / `skipped`). |
| "Pre-filled" tag | `AssessmentFormCore` amber "Pre-filled" when `prefilledKeys` | Tiny `PrefilledTag` used by assessment + interview review items. |
| Confirm dialog | `components/assessments/confirm-prefilled-dialog.tsx` | Already generic copy props — move to `components/ui` or `components/shared` and reuse for interview leave/complete-with-unconfirmed. |
| Rules | `lib/assessments/form-rules.ts` (`SectionStatus`, `to_confirm`, `prefilledElementKeys`, `sectionStatuses`) | Split **pure status types/helpers** from assessment-element specifics so interview items (not FormElements) can compute the same statuses. |

Do **not** fork a second chip/status implementation inside client-background.

### 6.2 Self-report "Client: …" lines today

From `backgroundAnswersToClientBackground` (`lib/background-questionnaire/to-client-background.ts`):

- **Identity:** sex, gender identity, pronouns, sexual orientation, race/ethnicity, religion, primary language, disability (+ detail)
- **Education:** level, field of study, currently studying, disruption
- **Occupation:** work status, role, employer, previous job, necessities
- **Relationship status** (client-level)
- **Children count** prompt (`numberOfChildren` label)
- **Living:** housing type, lives with, housing stability
- **History screening:** only `family_emotional_problems`, `family_substance_use` mapped today
- **Medication prompts:** currently taking, previously taken / ever medication, ever admitted, previous therapy (shown near history/med UI — not full category screening)
- **Stressors:** each stressor key + main reason

Interview fields **without** a Client line today include most client-history screening keys, block Yes/None answers, person-level living ticks, funding, emergency/medical contacts, preferred name, country of birth / arrival.

---

## Part 7: proposed build rounds

Each round should be mergeable alone; **additive schema first; removals last (usually two steps: stop write/read, then drop)**. Tom Background report selftests must stay green every round.

| Round | Goal | DB (additive unless noted) |
|-------|------|----------------------------|
| **AJ0** | This audit report | None |
| **AJ1** | Shared shell primitives: extract chips / section status / Pre-filled tag / confirm dialog for reuse; no behaviour change | None |
| **AJ2** | Interview answers/marks JSON on `client_background_interviews`; start/review prefills with `to_confirm`; keep old screening path working in parallel | Additive columns on `client_background_interviews` (e.g. `answers_json`) |
| **AJ3** | One-page nine-section shell (replace Background/History tabs); section Done / Nothing to record; number chips | None (or tiny UI-only) |
| **AJ4** | Section 1 contact details + preferred name; wire opt-outs | Additive `clients.preferred_name` |
| **AJ5** | Claim type `code`; auto Medicare claim on `createClient`; interview section 2 funding Yes/No/N/A | Additive `claim_types.code` (+ backfill); app uniqueness; later partial unique index |
| **AJ6** | Section 3 demographics: country of birth / year of arrival via `PartialDatePicker` / `yearFromTypedAge`; keep disability/education/occupation/hardship | Additive identity_json keys (no migration if JSON-only) |
| **AJ7** | Section 4: embed emergency + medical contact editors | None |
| **AJ8** | Sections 5–6: reuse relationship blocks; enforce siblings eldest-first (already); align Yes/No/N/A language | None |
| **AJ9** | Section 7 living: tick people + others-in-home; dual-write `livesWith` until report catches up | Additive others-in-home storage |
| **AJ10** | Background report housing from ticks **with Tom text lock**; then stop writing `livesWith` | None, then stop-write |
| **AJ11** | Sections 8–9 history reorder; remove `other_treatment` question; treatment only under issues | None first; then stop writing screening key |
| **AJ12** | Remove stressors + main reason from interview UI (data kept); remove risk UI/actions/orphan; strip Background/History tab code | None |
| **AJ13** | Removals step A: stop dual-write orientation columns; stop reading retired screening keys in backfill helpers | None |
| **AJ14** | Removals step B (Claude-applied SQL): drop `sexual_orientation` columns if unused; drop `risk_json` if unused; scrub retired screening keys; drop `livesWith` from docs/types; optional unique indexes for Medicare/NDIS | Drop / scrub migrations **last** |

Throughout: do not change Tom's Background report letter text; any report generator change needs fixture lockstep.

---

## Decisions the prompt left open

1. **Others in the home** — new relationship-record role vs JSON list on `living_situation_json`.
2. **Dependant tick** — reuse `dependency` enum vs a dedicated boolean on people / others.
3. **Interview marks storage shape** — expand `screening_json` vs new `answers_json` / `marks_json` vs single `interview_state_json`.
4. **Preferred name in letters** — whether Background / other reports ever print it (Tom must stay unchanged).
5. **Auto Medicare claim** — create bare claim only vs claim + empty approval; start/end dates defaults.
6. **Claim type codes** — exact code set (`medicare` / `ndis` / `insurer` / `workcover` / …) and whether insurer/WorkCover share one code.
7. **NDIS uniqueness** — confirm NDIS is always a single claim_type row per practice (name today) before DB unique index.
8. **Relationship `client_current.status`** — keep as derived mirror of A vs bidirectional sync on every block edit (must close the `updateRelationshipBlock` → A hole before any removal).
9. **Complete rules** — redesign Done-per-section vs today's "complete with Not asked"; whether Worth checking still soft-warns.
10. **Unsaved relationship drafts on leave** — flush should save sections automatically, warn, or keep current "only Save section persists" behaviour.
11. **`snapshot_json` consumers** — none for live report today; whether review/rebuild should read snapshot or living tables.
12. **Self-report mapping** — which new fields get Client lines; whether lives-with Client line is retired with the pick-list.

---

## Guardrail check

- `git diff --name-only main` after this commit: only `docs/cursor-reports/round-aj-audit-report.md`.
- No migrations, seeds, app code, or PR.
)
