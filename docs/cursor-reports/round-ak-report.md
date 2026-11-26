# Round AK report: Background interview shell

Branch: `test/intake-interview` (from Round AJ at `443b7d6` / `main` `84cabd9`).  
**No PR** (prompt guardrail). Migration file written only — not applied. No local dev server. No `lib/reports/`, `scripts/`, `app/api/`, or `app/q/` changes. Tom's Background report text unchanged (self-tests green).

Test client IDs (not queried for clinical content): Tom Example (test) `0a546f0c-a164-46a1-a766-47f36216a229`; Ben01 McTesty `100f2b7e-55ad-4ff7-b7e4-a4fa60e4433e`.

## Commits

- `53a6bfb` — Round AK shell: nine-section interview page, shared chips/status/dialog, `answers_json` migration + mirrors, Complete / Save-and-leave rules
- _(this commit)_ — Round AK report only (`docs/cursor-reports/round-ak-report.md`)

## Files changed

**New**

- `db/migrations/0085_interview_answers.sql`
- `lib/section-status.ts`
- `lib/client-background/interview-answers.ts`
- `lib/client-background/interview-answers.selftest.ts`
- `components/shared/section-progress-chips.tsx`
- `components/shared/section-status-pill.tsx`
- `components/shared/prefilled-tag.tsx`
- `components/shared/confirm-prefilled-dialog.tsx`
- `components/client-background/interview-answer-buttons.tsx`
- `components/client-background/interview-item-row.tsx`
- `components/client-background/interview-numbered-section.tsx`
- `docs/cursor-reports/round-ak-report.md` (this file)

**Updated**

- `db/schema/20-client-background.ts` — `answersJson`
- `lib/client-background/mutations.ts` — start prefill, item/bulk save, complete + snapshot
- `lib/client-background/load.ts` — load `answers`
- `app/clients/[client_id]/background/actions.ts` — item/bulk answer actions; complete `confirmAllItems`
- `app/clients/[client_id]/background/interview/page.tsx` — drop `?page=`; pass contact/answers props
- `components/client-background/interview-page.tsx` — one-page nine sections + chips + Complete rules
- `components/client-background/history-tree-section.tsx` — `groupFilter`, `hideScreeningControls`
- `components/client-background/relationship-blocks-section.tsx` — `visibleSections`, `embedWithoutChrome`, `hideTopLevelAnswers`, flush calls section Save
- `components/client-background/interview-section-card.tsx` — open-state page key `"interview"`
- `lib/assessments/form-rules.ts` — re-export shared status; `sectionStatuses` uses `aggregateSectionStatus`
- `lib/assessments/form-rules.selftest.ts` — shared status checks
- `components/assessments/practitioner-assessment-form.tsx` / `form/assessment-form-core.tsx` / `confirm-prefilled-dialog.tsx` — use shared chips/pill/Pre-filled/dialog
- `PROJECT_MAP.md` — interview shell note

## Migration

`db/migrations/0085_interview_answers.sql` — additive:

```sql
ALTER TABLE client_background_interviews
  ADD COLUMN IF NOT EXISTS answers_json jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Drizzle: `answersJson` on `clientBackgroundInterviews`. Claude applies SQL after review. Journal left unchanged (same practice as 0083/0084).

## Command results

| Command | Result |
|---------|--------|
| `npm ci` | OK (required this round; `node_modules` was missing last round) |
| `./node_modules/.bin/tsc --noEmit` | OK |
| `npx next build` | OK |
| Lint (changed TS/TSX only) | New files clean. Pre-existing `set-state-in-effect` / unused-var warnings remain in untouched lines of relationship-blocks / history-tree / practitioner form / form-rules |
| `npx tsx` self-tests listed in the brief (incl. Tom report; skip `tom-example-db`) | All green |
| `lib/assessments/shared-form-guard.selftest.ts` | OK — no allow-list change (interview answer buttons use `role="radio"`, not `type="radio"` / `RadioGroup`) |
| Database / apply migration | Not run (guardrail) |

## Preview URL

- Branch alias: https://practice-mvp-git-test-intake-interview-benedwards-practicemvp.vercel.app  
- This deploy: https://practice-nyvx02yki-benedwards-practicemvp.vercel.app  

Vercel commit status on `53a6bfb`: **success**. Preview is SSO-protected (same as prior rounds).

---

## Checks

### 1. Tabs gone; nine sections; Stressors un-numbered after 9

Yes. Background / History tab buttons and `?page=` switching removed. Order: Contact details → Funding → Demographics → Emergency contacts and treating professionals → Intimate relationships and children → Primary caregivers and siblings → Living situation → Client history → Significant other history (interview heading only; family group editor unchanged) → **Stressors** (un-numbered `InterviewSectionCard`, no chip, not in Complete counts).

### 2. Chips

Yes. Sticky row of 9 equal-width number-only chips via shared `SectionProgressChips`. Colours from `sectionProgressClass` (orange left / amber to_confirm / green done). Full status in `aria-label` and `title` via `progressChipAriaLabel`. Tap opens the section and scrolls to `#interview-section-N`.

### 3. One control per answer — radios hidden in the interview

Hidden **only in interview presentation** when `hideScreeningControls` / `hideTopLevelAnswers`:

| Control | Where hidden | Still used elsewhere |
|---------|--------------|----------------------|
| History screening Yes / No / Not asked (`TreeInlineSelect` per category) | Interview §§8–9 (`hideScreeningControls`) | Client Background history tree (`presentation="cards"`); any interview path that still passes `onScreeningChange` without hide |
| Previous significant relationships `AnswerSelect` | Interview §5 | Client Background / blocks section without hide |
| Mother · other relationships `AnswerSelect` (via `AnsweredSideSection`) | Interview §6 | Same |
| Father · other relationships `AnswerSelect` | Interview §6 | Same |
| Other caregiver arrangements `AnswerSelect` | Interview §6 | Same |

Not hidden: Other children `AnswerSelect`; per-block Children / Siblings radios; Client Background page unchanged.

History tree: one component; `groupFilter="client"` / `"significant_other"` so §8 and §9 each show one group without copying the tree.

### 4. Shared implementations (one each)

| Piece | Shared file | Consumers |
|-------|-------------|-----------|
| Progress chips | `components/shared/section-progress-chips.tsx` | Assessment form + interview |
| Number badge + status pill | `components/shared/section-status-pill.tsx` | Assessment form + interview |
| Pre-filled tag | `components/shared/prefilled-tag.tsx` | Assessment form core + interview item rows |
| Confirm pre-filled dialog | `components/shared/confirm-prefilled-dialog.tsx` | Assessment form; interview; assessments path re-exports |
| Status helpers | `lib/section-status.ts` (`SectionStatus`, `itemStatus`, `aggregateSectionStatus`, `progressChipAriaLabel`, …) | `form-rules` re-exports + interview answers |

### 5. Review prefill

Starting when a completed interview exists: `latestCompletedAnswers` copies `answers_json.items` with every `confirmed: false` (`prefillAnswersForReview`). First interview: empty `{}`. Summary lines always from current client data (contact, demographics, contacts, living), not from the old interview JSON.

### 6. Save and leave saves relationship drafts

Yes. `RelationshipBlocksSection` flush now awaits in-flight panel work **then** calls intimate / caregivers section Save when those sections are dirty (fixes audit 1.2). Then navigates to Client Background; interview stays in progress.

### 7. Complete paths

1. Flush (including relationship Saves).  
2. Any of nine sections with items **left** → **Not finished** dialog (Go back only; opens those sections).  
3. Else any **to confirm** → shared **Confirm pre-filled answers?** (`Confirm and complete` / Go back).  
4. Else / after confirm → Worth checking (soft) → complete (`completed_at`, `snapshot_json` includes `answers`, `background_captured_at`). Confirm-and-complete sets `confirmAllItems` so every item is `confirmed: true` first.  
Old “unanswered screening → Not asked on Complete” no longer applies to the nine sections; Stressors keep `markUnansweredStressors`.

### 8. Mirrors

| Interview item | Writes | Mapping |
|----------------|--------|---------|
| `s8_*` / `s9_*` (history keys) | `screening_json` | yes→yes; no→no; not_applicable→**no**; missing not written on save (Complete still finalises via `finalScreeningAnswers`) |
| `s5_previous` | `previous_relationships` | yes→yes; no\|not_applicable→none |
| `s6_parents_other` | **both** `mother_other_relationships` and `father_other_relationships` | same |
| `s6_caregiver` | `caregiver_arrangements` | same |

Saves immediately on tap via `saveInterviewItemAnswer` (practice-scoped in-progress interview + `assertClient`).

### 9. Ownership on new server actions

`saveInterviewItemAnswerAction` / `saveInterviewAnswersBulkAction`: `requirePractitionerContext()` then mutations that `assertClient(clientId, practiceId)` and update only the practice-scoped `in_progress` interview row. Block mirrors update `client_backgrounds` scoped by client + practice.

### 10. Tom's report text unchanged

`lib/reports/tom-example.selftest.ts` and `lib/reports/generate-background-report.selftest.ts` both passed. No edits under `lib/reports/`.

---

## Anything removed

- Interview Background / History tab UI and `?page=` routing for the interview page  
- Interview Complete gated to History tab only (Complete is always in the sticky header)  
- Duplicate screening / listed block answer radios **in the interview only** (not deleted from the codebase)

`InterviewHistory` component left in the repo but no longer mounted by the interview page (stressors + Complete live on `InterviewPage`).

## Decisions the prompt left open

1. **Parents' other relationships** — one YNA item mirrors **both** mother and father block columns (cannot set them independently in the interview shell).  
2. **Section 1 / 4 editors** — read-only summaries + Edit links only (Round AL embeds properly).  
3. **Living “Who lives in the home”** — Living answer type stored in `answers_json` only; existing living pick-list editor unchanged until Round AM.  
4. **Open-all / Close-all** — removed with the tabs; chips + per-section chevrons remain.  
5. **Default open** — sections 1–2 start open when no sessionStorage state; others closed until chip/header open.  
6. **GP vs other professionals** — summary heuristic: main contact or profession name containing “general” treated as GP for the summary line only.  
7. **Drizzle journal** — no new journal entry for 0085 (matches 0083/0084 practice on this branch).  
8. **shared-form-guard** — no allow-list entry; segmented buttons use ARIA `role="radio"` rather than HTML `type="radio"`.
