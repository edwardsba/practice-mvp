# Round W report — Children and Living situation lines

Branch: `test/client-page-panels`  
Base: `c0a320e` (Round V)

## Commits

- `362daa5` — Round W: children and living-situation panel wording
- This commit — Round W report only

## What changed

Client page **Background and history** panel only (`lib/clients/background-summary.ts`). Shared helpers (`livingWithClientLines`, Background report, Client Background, interview) unchanged.

### Children

- Counts by `block_role` = `child` and `block_role_type` across all relationships (current and previous).
- Non-step types (`biological`, `adopted`, and any other non-`step_child`) → children; `step_child` → step-children.
- Examples: `4 children, 1 step-child` · `1 child` · `2 step-children`.
- No child records: `None` / `Not asked` / `Not recorded` (unchanged answers).

### Living situation

- Format: `<housing type> · lives with <groups>` with grouped counts (not repeated role words).
- Groups in order: partner → children → step-children → parents/caregivers → siblings → others.
- Partner uses Relationships-section wording (`wife` / `husband` / `partner`); several partners → `N partners`.
- Part-time: `(part time)` or `(N part time)` on the affected group.
- Nobody living with client: `Own home · lives alone` when recorded alone; otherwise housing type only; neither → `Not recorded`.

## Tom’s panel lines (exact)

| Row | Value |
|-----|--------|
| Children | `4 children, 1 step-child` |
| Living situation | `Own home · lives with wife, 3 children and 1 step-child` |

(Tom’s Background report text is unchanged — verified via `lib/reports/tom-example.selftest.ts`.)

## Command results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` (via `./node_modules/.bin/tsc --noEmit`) | Pass |
| `npx next build` | Pass |
| Self-tests (`lib/client-background/*.selftest.ts`, `lib/funding/*.selftest.ts`, `lib/clients/*.selftest.ts`, `lib/medical-contacts/*.selftest.ts`, `lib/reports/tom-example.selftest.ts`, `lib/reports/generate-background-report.selftest.ts`) | All pass |
| `tom-example-db.selftest.ts` | Skipped (per prompt) |

## Diff scope vs `c0a320e`

```
lib/clients/background-summary.ts
lib/clients/background-summary.selftest.ts
docs/cursor-reports/round-w-report.md
```

`app/clients/[client_id]/page.tsx` unchanged (already calls `buildBackgroundPanelSummary`).

## Preview

- Branch preview URL: https://practice-mvp-git-test-client-page-panels-benedwards-practicemvp.vercel.app
- Deploy status: Ready
- Ready at: 2026-11-22 19:46 Australia/Sydney

## Decisions the prompt left open

1. **Partner wording source** — Used the Relationships tree rule: current block `status === "married"` + sex → `wife`/`husband`; otherwise `partner` (not “female/male partner”). Multiple partners always use the count form (`2 partners`).
2. **Parents and caregivers as one group** — Clear single mother/father → that word; one of each with no other parents → `both parents`; otherwise `N parent(s)`. A single caregiver uses a short role word (`grandmother`, etc.); multiple caregivers → `N caregivers`. Parent + caregiver phrases join with `and` inside the same group slot.
3. **“Anyone else”** — People living with the client who are not partner/child/parent/sibling/caregiver by `blockRole`. A single clear `blockRoleType` (e.g. `housemate`) is used as the role word; otherwise `1 other` / `N others`.
4. **Housing-only when livesWith is set but no people** — If demographics say e.g. “with partner and children” but no relationship `living_situation` marks anyone as living with the client, show housing type only (do not invent a people list from the demographics label). Alone still appends `lives alone`.
5. **`relationship_to_client` for parents** — Mother/father detection prefers `blockRoleType`, with a fallback to `relationshipToClient` only for parent labelling (children still ignore `relationship_to_client` entirely).
6. **PROJECT_MAP** — Not updated (panel wording only; feature status unchanged).
