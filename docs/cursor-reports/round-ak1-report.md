# Round AK.1 report: interview fixes after first testing

Branch: `test/intake-interview` (from Round AK at `1a05866`).  
**No PR** (prompt guardrail). No migrations this round (`0085` already applied). No local dev server. No `lib/reports/`, `scripts/`, `app/api/`, or `app/q/` changes. Tom's Background report text unchanged (self-tests green). Assessment form / Client Background / claims / self-report behaviour unchanged.

## Commits

- `2470008` — Round AK.1: split parents' other, validate answers, Edit/Done editors
- _(this commit)_ — Round AK.1 report only (`docs/cursor-reports/round-ak1-report.md`)

## Files changed

**New**

- `lib/client-background/interview-facts.ts` — pure fact-line helpers (section 3 demographics + relationship/history short lists)
- `components/client-background/interview-editor-panel.tsx` — shared Edit shell with Done
- `docs/cursor-reports/round-ak1-report.md` (this file)

**Updated**

- `lib/client-background/interview-answers.ts` — `s6_mother_other` / `s6_father_other`; `allowedValuesForKind` / `validateItemAnswer`; sanitize drops wrong types / old key
- `lib/client-background/interview-answers.selftest.ts` — split mirrors, validation, section 3 facts
- `lib/client-background/mutations.ts` — refuse invalid item key/value before save
- `components/client-background/interview-item-row.tsx` — fact lines + Edit
- `components/client-background/interview-page.tsx` — editors closed until Edit; Done flushes
- `PROJECT_MAP.md` — AK.1 note

## Command results

| Command | Result |
|---------|--------|
| `./node_modules/.bin/tsc --noEmit` | OK |
| `npx next build` | OK |
| Lint (changed TS/TSX only) | 0 errors (2 pre-existing-style warnings only) |
| Required `npx tsx` self-tests (incl. Tom report; skip `tom-example-db`) | All green |
| Database / migrations | Not touched |

## Preview URL

- Branch alias: https://practice-mvp-git-test-intake-interview-benedwards-practicemvp.vercel.app  
- This deploy: https://practice-homiezjfk-benedwards-practicemvp.vercel.app  

Vercel commit status on `2470008`: **success**. Preview is SSO-protected.

---

## Checks

### 1. Section 6 five items; one-column mirrors

Yes. Order: Biological parents → Mother's other relationships (`s6_mother_other`) → Father's other relationships (`s6_father_other`) → Other caregiver arrangements → Siblings. Mother mirrors only `mother_other_relationships`; father only `father_other_relationships`. Old `s6_parents_other` dropped by sanitize.

### 2. Wrong values / unknown keys refused and dropped

Rule lives in **`allowedValuesForKind`** (used by `isValueAllowedForKind`, `validateItemAnswer`, sanitize, setItemAnswer, options).  
`saveInterviewItemAnswer` calls `validateItemAnswer` first and returns an error without writing. `sanitizeInterviewAnswers` drops items whose value is not allowed for that item's kind (and drops unknown keys including `s6_parents_other`).

### 3. Every section opens with no editor showing

Yes. `openEditor` starts `null`. Demographics / relationships / history / living / funding add panel only render inside `InterviewEditorPanel` when Edit is tapped.

### 4. Section 3 facts in full, one per line

Yes. `formatSection3FactLines` / per-item helpers emit "Label: value" lines (sex, gender if different, pronouns, orientation, culture, religion, language; disability + access; education; occupation; financial). Empty facts omitted; if none at all, the row shows "Not recorded".

### 5. Edit opens only that item's editor (or shared once)

Yes. Identity / disability → identity editor; education → education; occupation / financial → occupation; any §5 item → intimate blocks once; any §6 → caregivers once; §7 → living; §8 / §9 → that history group once; §2 → funding panel (add). §1 / §4 Edit still navigates to Edit details (Round AL).

### 6. Done flushes and closes; facts update

Yes. Done runs the same flush set as Save and leave (autosave + relationship section Save), syncs demographics from refs, then closes the editor so fact lines re-read current data.

### 7. Editing doesn't change answers or confirmed state

Yes. Editors only mutate living client data. Interview answers change only via answer buttons / Nothing to record.

### 8. Save and leave and Complete flush open editors

Yes. Both call `flushAll()` (all registered flushers, including relationship Saves and autosave) before leave / Complete dialogs.

### 9. Tom's report text unchanged

`lib/reports/tom-example.selftest.ts` and `lib/reports/generate-background-report.selftest.ts` passed. No `lib/reports/` edits.

---

## Anything removed

- Combined item `s6_parents_other` (replaced by mother/father items; leftover JSON keys dropped on sanitize)
- Always-open demographics / relationship / history / living editors on the interview page (now behind Edit)

## Decisions the prompt left open

1. **Section 2 funding quick view** — remains visible as read-only lines for confirm; only the add panel / funding editor opens on Edit (prompt called out the add panel specifically).  
2. **Section 1 / 4 Edit** — still navigate to `/clients/.../edit` (Round AL embeds).  
3. **Yes-item facts** — short lists shown when the answer is Yes (or always for biological parents CNA); otherwise no "Nothing recorded yet" clutter for No / N/A.  
4. **History fact lines** — compact issue/treatment summaries from current issues + events; not a full tree dump.  
5. **Stressors** — still an always-visible un-numbered card (not one of the nine; not behind Edit).
