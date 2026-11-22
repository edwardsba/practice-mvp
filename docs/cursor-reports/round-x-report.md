# Round X report — Relationships: + on the line, one current, manual save

Branch: `test/client-page-panels`  
Base: `0252c23` (Round W report)

## Commits

- `cc41bab` — Rewrite interview relationship blocks for draft-until-Save
- `47dd73e` — Round X: relationships draft-until-Save, + menu, one current
- `b33914f` — Fix Escape handler null narrowing for Vercel build
- This commit — Round X report only

## What changed

### Part 1 — Nothing saved until Save

- **"+ Add relationship / arrangement"** and **"+ Partner / Child / Sibling"** open browser-only drafts. No database write until **Save**.
- Single server action: `saveRelationshipPersonDraft` / `saveRelationshipPersonDraftAction` creates the block (if new) and the person in one transaction.
- Save stays disabled until a name or a type is filled; the server refuses empty people with the same rule (`refuseEmptyPersonDraft`).
- Cancel / ✕ / overlay dismiss with unsaved draft content uses in-page **Discard changes?** (Discard / Keep editing) via shared `DiscardChangesDialog` — not `window.confirm`.
- **Interview** (`relationship-blocks-section.tsx`): status pickers, yes/no answers, and block fields stay in local draft. Each section (Intimate / Caregivers) has **Discard** and **Save section**, plus **"N unsaved changes"** (`countUnsavedRelationshipChanges`). `beforeunload` warns when a section is dirty.
- Existing person / block edit panels use the shared footer: **Remove** (left, existing people only), **Cancel** and **Save** (right).

**Code path — no write before Save (Check 1):**  
`startNewRelationship` / `openNewRelationship` / `openNewPerson` / `startAddToRelationship` only call `setSelection(...)`. They do not call any server action. The first write is `saveRelationshipPersonDraftAction` from the draft form’s Save button.

### Part 2 — + on each relationship line

- Round **+** (44×44, outline, `aria-label="Add to this relationship"`) on every intimate relationship line (current and previous) and on parents’ other relationship lines.
- Shared `AddToRelationshipMenu`: heading **"Add to \<status\> (\<dates\>)"**; intimate → **Partner** / **Child**; parent_other → **Partner** / **Sibling**.
- **Child** / **Partner** / **Sibling** open shared `NewPersonDraftForm` with context line **"Adding to: …"**; Child Type options use `block_role_type` values (step-child label includes partner name when known). Saved into the **same** block (`block_role` = partner | child | sibling).

### Part 3 — One current relationship only

- **Current intimate relationship and children:** "+ Add relationship" hidden while a current block exists; shown only when there is none (`relationshipSectionAllowsAdd(..., { kind: "client_current" })` and interview button gated the same way). Ending / removing the current block brings it back.
- **Previous:** "+ Add relationship" kept at the bottom, plus + on each line.
- **Server:** create / move-into `client_current` refuses a second with:  
  `"This client already has a current relationship. Add another partner to it with +, or end it first."`  
  Covered in `createRelationshipBlock`, `saveRelationshipPersonDraft`, and `moveBlockMember` (NEW_CURRENT). Move-target list omits "+ New current relationship" when one already exists.

### Part 4 — Migration (written, not run)

- `db/migrations/0080_one_current_relationship.sql` — partial unique index `client_relationship_blocks_one_current` on `(client_id) where kind = 'client_current'`.
- Drizzle schema `db/schema/20-client-background.ts` updated to match.
- **Not applied by the agent.** Claude applies after review.

### Part 5 — Age box

- **Skipped per Ben (23 Nov follow-up).** Person form keeps the linked **Age** box and **Date of birth or age** pickers exactly as they were. No change to `fields.tsx` PartialDatePicker person mode.

## Shared components (one each)

| Component | Role |
|-----------|------|
| `AddToRelationshipMenu` | Round + menu |
| `NewPersonDraftForm` | New person draft (Partner / Child / Sibling) |
| `NewRelationshipPanel` | New relationship / arrangement draft (browser-only) |
| `RelationshipEditFooter` | Remove / Cancel / Save |
| `RelationshipSectionFooter` | Discard / Save section + unsaved count |
| `DiscardChangesDialog` | Discard changes? |

## Removed

- `discardEmptyRelationshipDraft` (lib)
- `discardEmptyRelationshipDraftAction` (actions)
- `createRelationshipWithMember` / `createRelationshipWithMemberAction` (replaced by `saveRelationshipPersonDraft`)
- `isEmptyNewRelationshipDraft` / `lib/client-background/new-relationship-draft.ts`
- `lib/client-background/new-relationship-draft.selftest.ts`
- Create-on-open / save-on-change paths for new relationships and interview status/answers/dates (interview section now drafts locally until Save section)
- `schedulePersonSave` / `scheduleBlockSave` autosave on interview person/block panels

## Other Client Background sections (Part 1 check — report only, unchanged)

| Section | Finding |
|---------|---------|
| **History** | New issue / New event: browser draft, write on Save. **Exception:** Who → "+ Add person" still calls `createUnplacedPersonAction` immediately (create-on-open empty person). |
| **Demographics / Living situation** | Local draft; persist on form Save (`saveDemographicsAction` / `saveLivingSituationAction`). Not save-on-change. |
| **Emergency contacts** | Separate dialog create/update pattern; not create-on-open for empty rows in the relationship sense. |
| **Medical contacts** | Dialog / ensure-on-select patterns; unchanged this round. |
| **Interview (non-relationship)** | `interview-autosave.tsx` still save-on-change for other interview fields; relationships section no longer uses that for status/answers/dates. |

## Checks

1. **Ben01 — add then go back without Save → no new rows.** Code path: selection-only open (`setSelection` / `startNewRelationship` / `openNewPerson`); first DB write is `saveRelationshipPersonDraftAction` on Save. Cancel / reload leaves nothing.
2. **Tom’s tree:** + on Married shows exactly Partner and Child. "+ Add relationship" hidden in Current (while married block exists), shown in Previous.
3. **Partner via +** lands in the existing current block (`relationshipBlockId` passed into `saveRelationshipPersonDraft`; no new block).
4. **Server refuses second current:** offline self-test `refuseSecondCurrentFromBlocks([{ kind: "client_current" }], "client_current")` → `ONE_CURRENT_RELATIONSHIP_ERROR` in `person-draft.selftest.ts`. Mutations call the same helper before insert/move.
5. **Interview:** "N unsaved changes" + Discard / Save section; status/answers/block patches are local (`setStatus` / `setAnswer` / `patchBlock`) until Save section.
6. **Person form Age box:** unchanged (Part 5 skipped).
7. **Tom Background report self-tests:** pass unchanged (`lib/reports/tom-example.selftest.ts`, `generate-background-report.selftest.ts`).

## Self-tests added

- `lib/client-background/person-draft.selftest.ts` — empty person refused; second `client_current` refused; Partner/Child (and parent Partner/Sibling) menu options; unsaved-change counting; context / step-child labels.

## Command results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | Pass (after `b33914f`) |
| `npx next build` | Pass (after `b33914f`; earlier tip `47dd73e` failed Vercel on Escape null-narrowing) |
| `lib/client-background/*.selftest.ts` | All pass |
| `lib/funding/*.selftest.ts` | All pass |
| `lib/clients/*.selftest.ts` | All pass |
| `lib/medical-contacts/*.selftest.ts` | All pass |
| `lib/reports/tom-example.selftest.ts` | Pass |
| `lib/reports/generate-background-report.selftest.ts` | Pass |
| `tom-example-db.selftest.ts` | Skipped (per prompt) |

## Files changed (vs `0252c23`)

```
PROJECT_MAP.md
app/clients/[client_id]/background/actions.ts
components/client-background/add-to-relationship-menu.tsx          (new)
components/client-background/discard-changes-dialog.tsx            (new)
components/client-background/new-person-draft-form.tsx             (new)
components/client-background/new-relationship-panel.tsx
components/client-background/relationship-blocks-section.tsx
components/client-background/relationship-edit-footer.tsx          (new)
components/client-background/relationship-tree-section.tsx
db/migrations/0080_one_current_relationship.sql                    (new, not run)
db/schema/20-client-background.ts
lib/client-background/add-to-relationship.ts                       (new)
lib/client-background/block-mutations.ts
lib/client-background/new-relationship-draft.ts                    (deleted)
lib/client-background/new-relationship-draft.selftest.ts           (deleted)
lib/client-background/person-draft.ts                              (new)
lib/client-background/person-draft.selftest.ts                     (new)
lib/client-background/relationship-tree.ts
lib/client-background/relationship-tree.selftest.ts
lib/client-background/round-r.selftest.ts
lib/client-background/unsaved-changes.ts                           (new)
docs/cursor-reports/round-x-report.md                              (this file)
```

## Preview

- Branch preview URL: https://practice-mvp-git-test-client-page-panels-benedwards-practicemvp.vercel.app
- Deploy status: Ready (commit `b33914f`)
- Ready at: 2026-11-23 09:50 Australia/Sydney

## Decisions the prompt left open

1. **Part 5 Age** — Skipped after Ben’s follow-up; Age + Date of birth or age left as one linked control.
2. **Other-children "+ Add relationship" on Interview** — Still opens `NewRelationshipPanel`; Save uses `primaryRoleForKind` → `child` (no partner in that kind). Not a Partner/Child + menu case.
3. **Caregiver arrangements** — No round + menu (only intimate + parent_other). "+ Add arrangement" remains the section add control.
4. **Discard on Escape for existing person/block edit** — Parent may prompt Discard when leaving edit mode even if the panel draft is unchanged (safe over-ask).
5. **Unsaved-change counting** — One count per changed block, per changed answer key, and for client status (not per individual field inside a block).
6. **History Who → + Add person** — Still create-on-open; reported, not changed this round.
7. **No PR** — Pushed to `test/client-page-panels` only, per guardrails.
