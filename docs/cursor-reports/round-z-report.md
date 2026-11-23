# Round Z report — Claims, referrals and funding one page + Client page quick view

Branch: `test/client-page-panels`  
Base: `7f750de` (Round Y report)

## Commits

- `aaf9508` — Round Z: claims, referrals and funding one page + client quick view
- This commit — Round Z report only

## What changed

### Part 1 — Claims, referrals and funding page

Same URL: `/clients/[client_id]/claims`. Title **"Claims, referrals and funding"** with back link to the client.

Sections (hidden when empty), top to bottom:

1. **Referrals without a claim**
2. **Active claims** (newest first)
3. **Inactive claims** (newest first)

Bottom: **+ New claim** → existing new-claim flow.

**Claim card** (`CollapsibleFundingCard` variant `strong`): 2 px dark slate outline, shaded header, CLAIM label, claim type, Active/Inactive pill, chevron with `aria-expanded`. Closed summary e.g. `2 approvals · 7 claimed in 2026`. Open body: claim details box (filled fields only; Medicare as `···· 1234` + IRN; insurer/reference; Since / End date; large **Sessions claimed in \<year\>**; **Claim details ›**), then **Funding approvals and referrals (N)**, nested approval cards, **+ Add referral or funding approval** preset to that claim.

**Approval card** (variant `light`, indented): FUNDING APPROVAL or REFERRAL; name; `N of M used` / `N used` or referral date; status pill from `FUNDING_APPROVAL_STATUS_CONFIG`; body with Dates / Referrer / Referred / Comments / Sessions, progress bar when approved count exists, report tag (amber due / green sent), **Open referral and funding card ›** (reuses shared `ReferralFundingCard` panel). Unattached referrals also show amber **To attach** and **Attach to a claim ›**.

**Initial open state:** active claim cards open; newest approval inside each active claim open; everything else closed. Screen state only.

### Part 2 — Client page quick view

Referrals and funding panel control is **Open ›** (no Expand / embedded card). Lines from `buildReferralFundingQuickView`: unattached referrals first, then one line per active claim; if none active, most recent claim with Last claim · ended … fallback; empty state with **Add ›**. Hash anchors (`#claim-…` / `#referral-…`) for scroll-to on the claims page.

### Part 3 — Attach to a claim

In-page picker; nothing written until **Save**. Server action `attachFundingApprovalToClaim` checks approval and claim both belong to the same client and practice. No claims → message + **+ New claim**.

### Part 4 — Interview label

Inline status pickers in `relationship-blocks-section.tsx` now say **Relationship status** (options unchanged). Client-level picker remains **Current relationship status**.

### Shared helpers (`lib/funding/claims-page.ts`)

Grouping/ordering, initial open flags, calendar-year session count (Sydney date strings, 1 Jan–today, completed only, no yearly limit), approval kind/name/used line, quick-view lines. Loader: `lib/funding/load-claims-page.ts`.

## Counting rule (sessions claimed in year)

Completed appointments (`status === "completed"`) linked via `appointments.funding_approval_id` to any approval on that claim, with `appointment_date` from `YYYY-01-01` through today (`todayDateString()`, Australia/Sydney). Plain count — no “of N” limit stored or shown.

## Checks

1. **Ben01 sections / open state** — Not verified against live data in this environment (`DATABASE_URL` unavailable). Code builds active claims open + newest approval open; inactive claims closed; section order as specified. Confirm on preview with Ben01.
2. **Claim details vs approvals** — Details box first, then uppercase sub-heading, then indented approval cards (implemented).
3. **Independent open/close** — Shared `CollapsibleFundingCard` for claim and approval cards (implemented).
4. **Sessions claimed in 2026 (Ben01)** — Same counting rule as above. Exact per-claim numbers need a logged-in preview pass; offline self-tests cover the rule and year boundaries (31 Dec / 1 Jan).
5. **Tom Client page panel** — Quick view shows one active-claim line: claim type · newest approval name, used/approved · year count (helpers + UI). Confirm MHTP Review wording on preview.
6. **No-active-claim fallback + referral-without-claim** — Covered in `lib/funding/claims-page.selftest.ts`.
7. **Attach to a claim** — Picker holds selection until Save; Cancel closes with no write; ownership check in `attachFundingApprovalToClaim` (code path).
8. **Interview label** — Relationship status on status pickers in `relationship-blocks-section.tsx`.
9. **Tom Background report self-tests** — Pass unchanged (`tom-example.selftest.ts`, `generate-background-report.selftest.ts`). `lib/reports/` not modified.

## Scrolling

Yes — quick-view links use `#claim-{id}` / `#referral-{id}`; claims page scrolls that id into view on load (`scrollIntoView`).

## Removed

- Client claims page table listing
- Client page Expand control and embedded `ReferralFundingCard` in the Referrals and funding panel (card still used on the claims page via panel-only open)

## Self-tests added

`lib/funding/claims-page.selftest.ts`: grouping/ordering (unattached + several active claims), initial open flags, calendar-year count at year boundaries, Referral vs Funding approval kind/name, N of M / N used, quick-view active / inactive fallback / empty.

## Command results

| Command | Result |
|---------|--------|
| `./node_modules/.bin/tsc --noEmit` | Pass |
| `npx next build` | Pass |
| `lib/client-background/*.selftest.ts` | All pass |
| `lib/funding/*.selftest.ts` | All pass (incl. new claims-page) |
| `lib/clients/*.selftest.ts` | All pass |
| `lib/medical-contacts/*.selftest.ts` | All pass |
| `lib/reports/tom-example.selftest.ts` | Pass |
| `lib/reports/generate-background-report.selftest.ts` | Pass |
| `tom-example-db.selftest.ts` | Skipped (per prompt) |

## Files changed (vs `7f750de`)

```
PROJECT_MAP.md
app/clients/[client_id]/claims/page.tsx
app/clients/[client_id]/page.tsx
components/client-background/relationship-blocks-section.tsx
components/clients/referral-funding-quick-view.tsx          (new)
components/funding/attach-to-claim-picker.tsx               (new)
components/funding/claims-funding-page.tsx                  (new)
components/funding/collapsible-funding-card.tsx             (new)
components/funding/referral-funding-card.tsx
lib/actions/funding.ts
lib/funding/claims-page.ts                                  (new)
lib/funding/claims-page.selftest.ts                         (new)
lib/funding/load-claims-page.ts                             (new)
docs/cursor-reports/round-z-report.md                       (this file)
```

## Preview

- Branch preview URL: https://practice-mvp-git-test-client-page-panels-benedwards-practicemvp.vercel.app
- Deploy status: Ready (commit `aaf9508`)
- Ready at: 2026-11-23 14:43 Australia/Sydney

## Decisions the prompt left open

1. **Active vs inactive claim** — Used `claims.is_active` (true = Active, false = Inactive). Page loads both; soft-deleted (`is_active = false`) claims appear under Inactive claims.
2. **Claim details link on inactive claims** — Still links to `/funding/claims/[id]`; existing `getClaimById` only returns `is_active = true`, so inactive detail may 404 until that loader is widened (out of scope this round).
3. **Claim / approval “newest”** — Claims: start date, then createdAt. Approvals: start date, then referral date, then createdAt (as specified).
4. **Used line wording** — `N of M used` / `N used` (not “attended”) on this page and quick view.
5. **Referrer name on referrals** — `Dr Name (GP)` with GP short form for General Practitioner.
6. **Report tag** — Next incomplete requirement → amber `Report due at session N`; all complete → green `Report sent`.
7. **ReferralFundingCard reuse** — Extended with `panelOnly` + `openApprovalId` so the claims page opens the existing side panel without a second card implementation.
8. **Quick-view report tag** — Amber when any approval on the claim has a due (incomplete) report tag.
9. **No local DB** — Could not run live Ben01/Tom UI checks here; offline tests + preview deploy only.
