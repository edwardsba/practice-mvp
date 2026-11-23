# Round Y report — Relationship and person panels, grouped and clear

Branch: `test/client-page-panels`  
Base: `2abd3fa` (Round X report)

## Commits

- `8c48190` — Round Y: group relationship and person panels; one person form
- This commit — Round Y report only

## What changed

### Shared group style

- New `PanelGroup` in `relationship-panel-shared.tsx`: 12 px uppercase semibold slate heading; from the second group, a 1 px rule with ~14 px space either side.
- View facts stay a two-column list (muted label / value; "Not recorded" when empty).
- New `PersonCard`: bold name, subtitle `role · age · type` (or partner living-situation wording), › chevron, min 44 px tall. Tap opens that person.

### Part 1 — "Relationship status" label

- Replaced **"How it ended"** and **"Status"** with **"Relationship status"** in `blockFacts` (view) and `BlockFields` (form).
- Status option values and option labels unchanged.

### Part 2 — Relationship view

Intimate (current / previous), in order:

1. **Relationship** — Relationship status; Started with duration (`2014 · 12 years`); Ended with duration (previous only); Children Yes / None / Not asked / Not recorded; Other status when status is Other.
2. **Partner** — one card per partner.
3. **Children (N)** — one card per child, or "None recorded".

Header title = status (e.g. Married). Subtitle = "Current relationship" / "Previous relationship" (and equivalents for other kinds).

Other kinds use the same pattern: Biological parents → Relationship / Parents / Siblings; parent other → Relationship / Partner / Siblings; caregiver → Arrangement / Caregiver; other children → Relationship / Children.

Footer unchanged: **Edit**.

### Part 3 — Relationship form (new and edit)

1. **Relationship** — Relationship status; Started and Ended side by side (Ended hidden for current); Children Yes / None / Not asked.
2. **Partner** (or Caregiver) — New: Name, Sex, Date of birth or age. Editing: existing partner card(s) + note *"Full details (health, living situation, quality of relationship) are on the person's own form."* Tap opens that person's form (edit).
3. **Children** — Editing: child cards. New: *"Add children after saving, with + on the relationship line."*

Footer unchanged (Remove / Cancel / Save). Round X save rules unchanged.

### Part 4 — One person form (add and edit)

`NewPersonDraftForm` now renders the same `PersonFields` as edit (full `PersonDraft`). Four groups, in order:

1. **Person's details** — Name; Sex and Type side by side (Type for child/sibling only; Parent select + Not known for parents; caregiver Relationship for caregivers); Age box + Date of birth or age (unchanged linked `PartialDatePicker`).
2. **Health** — Health; Year of death directly under Health when Deceased.
3. **Living situation** — Living situation, then Dependency.
4. **Quality of relationship** — Supportive and Conflict or strain side by side; Comment (`quality_of_relationship`).

Context line: add keeps "Adding to: …"; edit shows e.g. "Child of Tom and Jordan · Married since 2014".

Save still disabled until name or type; nothing written before Save. `saveRelationshipPersonDraft` / interview save path now pass all additive person fields on one Save (no schema change).

### Part 5 — Person view

Same four groups as the form. Type moved up into Person's details. Comment at the end of Quality of relationship. **Part of** replaces Relationships: tappable line opening the relationship view (e.g. "Child of Tom and Jordan · Married since 2014 ›").

Footer unchanged: **Move to…** and **Edit**.

### Part 6 — History "+ Add person"

**Code path:** `NewIssueForm` `onAddPerson` → `HistoryTreeSection.startUnplacedPersonDraft` → `setUnplacedDraftOpen(true)` only (no server call). Panel is shared `NewPersonDraftForm` (`role="unplaced"`). Cancel / ✕ / overlay dismiss closes with no write. Save → `createUnplacedPersonAction` → `createUnplacedPerson` (now refuses empty drafts via `refuseEmptyPersonDraft` and accepts the full person draft fields). First write is on Save.

`interview-autosave.tsx` not changed this round.

## Where each extra person field went

| Field | Group |
|-------|--------|
| Name, Sex, Type (child/sibling) | Person's details |
| Parent (mother/father), Not known | Person's details |
| Caregiver Relationship | Person's details |
| Age + Date of birth or age | Person's details (linked control, position only) |
| Health, Year of death | Health |
| Living situation, Dependency | Living situation |
| Supportive, Conflict or strain, Comment | Quality of relationship |

## Removed

- Separate limited add-person field set in `NewPersonDraftForm` (now uses full `PersonFields`).
- Flat ungrouped person / relationship fact lists and plain name-only people lists in the relationship panels (replaced by `PanelGroup` + cards).
- Person view "Relationships" section (replaced by **Part of**).
- History Who → create-on-open empty person (`createUnplacedPersonAction` called immediately).

## Checks

1. **"How it ended" / "Status"** — Gone from relationship panels; **"Relationship status"** is used in view and form. (Interview inline status pickers outside these panels still say "Status" — out of scope.)
2. **Tom Married view** — Relationship group includes Children: Yes; Partner card (Jordan); Children (4) cards with role · age · type (helpers cover this shape offline).
3. **Kim previous** — Ended with duration; partner card present (helpers: `dateWithDuration` / Ended year · duration).
4. **+ › Child on Ben01** — Opens `NewPersonDraftForm` → same `PersonFields` as editing Max; four groups in order Person's details → Health → Living situation → Quality of relationship.
5. **Health = Deceased** — Year of death renders immediately under Health in that group.
6. **Max view** — Type in Person's details; Comment last in Quality of relationship; Part of link present.
7. **History "+ Add person"** — Open then go back: `startUnplacedPersonDraft` only sets local UI state; no `createUnplacedPersonAction` until Save. Empty Save refused.
8. **Tom Background report self-tests** — Pass unchanged.

## Self-tests added

`lib/client-background/relationship-panel-display.selftest.ts`:

- Card subtitle (role · age · type), including step-child and partner "lives with client"
- Part of line
- Duration text (`2014 · 12 years`)
- Group order for child / partner / sibling / parent / caregiver
- Relationship view group labels per kind
- Empty History person refused (`refuseEmptyPersonDraft`)

## Command results

| Command | Result |
|---------|--------|
| `./node_modules/.bin/tsc --noEmit` | Pass |
| `npx next build` | Pass |
| `lib/client-background/*.selftest.ts` | All pass (including new display selftest) |
| `lib/funding/*.selftest.ts` | All pass |
| `lib/clients/*.selftest.ts` | All pass |
| `lib/medical-contacts/*.selftest.ts` | All pass |
| `lib/reports/tom-example.selftest.ts` | Pass |
| `lib/reports/generate-background-report.selftest.ts` | Pass |
| `tom-example-db.selftest.ts` | Skipped (per prompt) |

## Files changed (vs `2abd3fa`)

```
PROJECT_MAP.md
app/clients/[client_id]/background/actions.ts
app/clients/[client_id]/edit/page.tsx
components/client-background/client-background-page.tsx
components/client-background/history-tree-section.tsx
components/client-background/new-person-draft-form.tsx
components/client-background/new-relationship-panel.tsx
components/client-background/relationship-blocks-section.tsx
components/client-background/relationship-panel-shared.tsx
components/client-background/relationship-tree-section.tsx
lib/client-background/block-mutations.ts
lib/client-background/relationship-panel-display.ts          (new)
lib/client-background/relationship-panel-display.selftest.ts (new)
docs/cursor-reports/round-y-report.md                        (this file)
```

## Preview

- Branch preview URL: https://practice-mvp-git-test-client-page-panels-benedwards-practicemvp.vercel.app
- Deploy status: Ready (commit `8c48190`)
- Ready at: 2026-11-23 13:10 Australia/Sydney

## Decisions the prompt left open

1. **Partner living-situation short wording on cards** — Mapped full-time to "lives with client"; part-time to "lives with client part-time"; others to short lowercase phrases. Full labels stay on the form/view facts.
2. **Child/sibling type on cards** — Lowercase short forms (`adopted`, `step-child`, `biological`, …), not the full select labels.
3. **Relationship panel header title** — Status / arrangement text only (e.g. "Married"), not the old "Current · Married" move-label.
4. **Started duration on previous relationships** — Start year · full relationship duration; Ended = end year · same duration (matches the design examples).
5. **History unplaced person form** — Same four groups; Type hidden (no child/sibling role). Context line: "Adding an unplaced person for History Who".
6. **createUnplacedPerson** — Extended to accept the full draft fields and refuse empty drafts; no new columns.
7. **Interview relationship section** — Still uses shared `PersonFields` / `BlockFields` (so status label and person groups apply). Inline tree "Status" pickers outside the side panels left as-is.
8. **Siblings answer on new parent_other / caregiver forms** — Kept inside the Relationship / Arrangement group under the shared block fields.
