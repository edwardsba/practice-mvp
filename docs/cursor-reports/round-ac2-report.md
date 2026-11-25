# Round AC.2 report — shared vertical radio list

Branch: `test/lramp` (from Round AC.1 report `54cd9df`)  
No PR opened (prompt guardrail). No database changes. No migrations.

## Commits

- `900be6d` — Round AC.2: shared vertical radio list for questionnaire and practitioner form
- This commit — Round AC.2 report only

## Files changed (feature commit)

### New

- `components/assessments/form/radio-option-list.tsx` — single shared `RadioOptionList`

### Modified

- `app/q/[token]/questionnaire-form.tsx` — `QuestionBlock` option rows → `RadioOptionList` (only change in this file)
- `components/assessments/form/element-control.tsx` — `radio` and `yes_no` → `RadioOptionList`; button-tile branches removed
- `lib/assessments/form-rules.ts` — deleted `shouldUseOptionButtons`

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
| All `lib/assessments/*.selftest.ts` | Pass |
| `lib/reports/tom-example.selftest.ts` | Pass |
| `lib/reports/generate-background-report.selftest.ts` | Pass |
| `tom-example-db.selftest.ts` | Skipped |

## Branch preview URL

https://practice-mvp-git-test-lramp-benedwards-practicemvp.vercel.app

Vercel commit status for `900be6d`: success (deployment completed). Preview behind Vercel SSO; no interactive walkthrough.

## Checks

### 1. Client questionnaire renders identically

`QuestionBlock` still owns the card shell, question label, carried-forward note, and “This question is required” error. Only the option rows were replaced with:

```tsx
<RadioOptionList
  options={question.options}
  value={value}
  onValueChange={onValueChange}
  required
/>
```

Classes / markup carried into `RadioOptionList` unchanged from the previous inline rows:

| Piece | Value |
|-------|--------|
| `RadioGroup` class | `gap-2` |
| Row label classes | `flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors` |
| Selected row | `border-primary bg-primary/5` |
| Unselected row | `border-transparent hover:bg-muted/60` |
| Radio item | `RadioGroupItem` with `className="mt-0.5"` |
| Label text | `span` with `text-sm leading-snug` |
| Props | `value`, `onValueChange`, `required` (always true, as before) |

Additive only: `min-h-11` on each row (44 px touch target required by this round). For typical single-line option text this does not change layout vs the previous `py-3` rows. Carried-forward note, required asterisk, and error paragraph remain in `QuestionBlock` untouched.

### 2. Every `radio` and `yes_no` in the practitioner form uses the shared list vertically

In `element-control.tsx`, `case "yes_no"` and `case "radio"` share one branch that renders only `RadioOptionList` (vertical `RadioGroup` with one full-width row per option). That covers LRAMP C/D rating radios, F1, and all Yes/No (`yes_no`) questions. No side-by-side grid remains for these types. Tick boxes (`checkbox`, `tick`) are unchanged.

### 3. Button-tile code fully removed

Deleted:

- `shouldUseOptionButtons` from `lib/assessments/form-rules.ts` (and its “Side-by-side option buttons…” comment)
- The `yes_no` 2-column button grid (`grid grid-cols-2`, `aria-pressed` buttons, filled-primary selected style)
- The `radio` branch that called `shouldUseOptionButtons` and rendered the short-option button grid (`grid-cols-2` / `grid-cols-2 sm:grid-cols-4`)
- The native `<fieldset>` / `<input type="radio">` fallback that used to render when options were “long”

There is exactly one radio-option-list component: `components/assessments/form/radio-option-list.tsx`.

### 4. Nothing else changed

- ASQ and MSE pages untouched
- Battery / client questionnaire submit flow untouched (questionnaire file change is option-row extraction only)
- No changes to save actions, form-rules validation/scoring helpers (aside from deleting `shouldUseOptionButtons`), `lib/reports/`, `scripts/`, or `app/api/`

## Anything removed

- `shouldUseOptionButtons`
- Side-by-side option-button UI for `yes_no` and short `radio` sets
- Practitioner-form native radio fieldset fallback (replaced by the shared list)

## Decisions the prompt left open

1. **`min-h-11` on shared rows** — Added to meet the “at least 44 px” requirement. Questionnaire previously relied on `py-3` alone; this is the only class difference vs the pre-extraction markup.
2. **`disabled` / `name` / `aria-labelledby` / `required` on the shared component** — Prompt listed `name`, `aria-labelledby`, and `required` as optional; `disabled` was needed for the practitioner form and is optional. Questionnaire still passes only `required` (always true). Practitioner passes `name={el-…}`, `aria-labelledby`, `required={element.isRequired}`, and `disabled`.
3. **Error border on radio rows** — Practitioner previously painted `border-destructive` on individual button/radio rows. The shared list matches the questionnaire (no per-row error class); the parent form still outlines the question card and shows the error message below the control.
4. **PROJECT_MAP** — Not updated; Clinical #5 already describes the shared practitioner form without mentioning option-button layout.
