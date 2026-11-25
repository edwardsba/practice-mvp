# Merge report — `test/asq-shared` → `main` (Round AG)

## Summary

Merges Round AG into `main`: ASQ uses the shared practitioner form (start / edit / save), shared scoring (`asqFlagsFromResponses` + `asqScreenOutcome`), and the shared results layout (summary box + answer table). Legacy ASQ pages remain on disk but unlinked. Part 5 exactness fix: `dataType` fallback `""` in submit and shared save. **No database changes** in this round or this merge.

## Verified branch commit

`e9ecc16` — Round AG report only (tip of `test/asq-shared` before the merge-report commit)

Ancestor check: `main` at `1117193` is an ancestor of `test/asq-shared` (2 Round AG commits before this report).

## Report commit

pending — this file, committed on `test/asq-shared` before the PR

## Pull request

pending

## Merge commit on `main`

pending

## Command results (verified on `e9ecc16`)

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | Pass |
| `npx next build` | Pass |
| All `lib/client-background/*.selftest.ts` | Pass |
| All `lib/funding/*.selftest.ts` | Pass |
| All `lib/clients/*.selftest.ts` | Pass |
| All `lib/medical-contacts/*.selftest.ts` | Pass |
| All `lib/navigation/*.selftest.ts` | Pass |
| All `lib/assessments/**/*.selftest.ts` | Pass |
| `lib/reports/tom-example.selftest.ts` | Pass (Tom report text unchanged) |
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
