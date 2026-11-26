# Merge report — `test/mse-shared` → `main` (Round AH + AH.1)

## Summary

Merges Round AH and AH.1 into `main`: MSE uses the shared practitioner form and results view (pre-filled answers, noted-count scoring, suicidality in the sentence/letter, AGENTS.md shared-form rule, guard self-test); AH.1 badge-only progress chips and `displayName` from `assessment_name`. Migrations **0083** and **0084** were already applied by Claude — **no database changes in this merge.** Legacy MSE/ASQ pages remain on disk unlinked until Round AI.

## Verified branch commit

`49a2ead` — Round AH.1 report only (tip of `test/mse-shared` before the merge-report commit)

Ancestor check: `main` at `ee27e9c` is an ancestor of `test/mse-shared` (4 Round AH/AH.1 commits before this report).

## Report commit

pending — this file, committed on `test/mse-shared` before the PR

## Pull request

pending

## Merge commit on `main`

pending

## Command results (verified on `49a2ead`)

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

## Branch preview status

pending

## Production deploy status

pending — https://practice-mvp.vercel.app

## Branch not deleted

pending

## Decisions the prompt left open

1. Final result lines in this file stay “pending” on the branch (filled only in the agent’s final chat message after Production is Ready).
2. Merge strategy: merge commit (not squash/rebase), per authorisation.
