# Round AA report — One funding approval page, easy adding, correct Active/Inactive

Branch: `test/client-page-panels`  
Base tip before this round: `32f279b` (Round Z report)

## Commits

- `3d2d712` — Round AA: one funding approval page, easier adding, Active by end date
- This commit — Round AA report only

## What changed

### Part 1 — Every approval/referral link goes to the funding approval page

Links to a single funding approval or referral now go to `/funding/approvals/[approval_id]` (with `?returnTo=…` when coming from claims / client / background / interview).

Surfaces updated:

- Claims overview approval cards → **Funding approval details ›**
- Client page quick view lines
- Client Background quick view lines
- Interview quick view lines
- Claim detail page approval links (and appointment → approval links)

`returnTo` is validated by `safeReturnTo` in `lib/navigation/safe-return-to.ts`: must start with `/clients/` or `/funding/`, and must not contain `//`, `://`, or `..`. Used by `BackButton` / `resolveBackNavigation`, New/Edit claim and approval pages, and form save redirects. Unsafe values fall back to today’s default back behaviour.

### Part 2 — Retire the summary pop-up

Removed `ReferralFundingCard` from claims overview, Client Background, and Interview. Those surfaces use the shared `ReferralFundingQuickView`. Interview keeps **+ Add referral or funding approval**, which opens `FundingApprovalForm` in `RelationshipPanelShell` (`InterviewFundingAddPanel`): client locked, nothing saved until Save, Cancel/✕ with edits asks **Discard changes?** via the Round X dialog.

Kept shared data helpers: `getReferralFundingCardData`, `buildReferralFundingCardProps`, types in `referral-funding-card-props.ts` (still used by New/Edit approval pages and the Interview add panel).

### Part 3 — Adding from the claims overview

Top **+ Add** menu (≥ 44 px): New claim / New funding approval / New referral.  
Per claim: **+ Funding approval** and **+ Referral** (claim + client preset).  
Referrals without a claim section: **+ Referral** when the section is shown.

Presets: `client_id`, `claim_id`, `kind=approval|referral`, `returnTo`. New claim locks the client when `client_id` is given.

`FundingApprovalForm` has a Referral / Funding approval choice at the top. Referral hides funding fields and saves with no funding approval type. Switching Funding approval → Referral on a record with funding values asks first, then clears those fields on Save.

### Part 4 — Active / Inactive claims

Soft-deleted claims (`is_active = false`) are hidden on the overview and quick view.  
For remaining claims: **Active** = no end date, or end date ≥ today (Australia/Sydney); **Inactive** = end date before today. Approvals do not affect it. Helper: `isClaimPeriodActive` in `lib/funding/claim-period-active.ts`.

## Removed

- `components/funding/referral-funding-card.tsx` (entire summary pop-up / panel-only open path)
- Claims overview use of `ReferralFundingCard` / `panelOnly` / `openApprovalId`
- Client Background and Interview embedding of `ReferralFundingCard`
- Bottom **+ New claim** link on the overview (replaced by the **+ Add** menu)
- Combined **+ Add referral or funding approval** per claim (replaced by the two text links)

## Self-tests added

- `lib/navigation/safe-return-to.selftest.ts`
- `lib/funding/claim-period-active.selftest.ts`
- `lib/funding/funding-form-kind.selftest.ts`
- Updates in `lib/funding/claims-page.selftest.ts` (deleted claims excluded; period Active/Inactive; quick-view fundingApprovalId)

## Command results

| Command | Result |
|---------|--------|
| `./node_modules/.bin/tsc --noEmit` | Pass |
| `npx next build` | Pass |
| `lib/navigation/safe-return-to.selftest.ts` | Pass |
| `lib/funding/claim-period-active.selftest.ts` | Pass |
| `lib/funding/funding-form-kind.selftest.ts` | Pass |
| `lib/funding/claims-page.selftest.ts` | Pass |
| All `lib/client-background/*.selftest.ts` | Pass |
| All `lib/clients/*.selftest.ts` | Pass |
| All `lib/funding/*.selftest.ts` | Pass |
| All `lib/medical-contacts/*.selftest.ts` | Pass |
| `lib/reports/tom-example.selftest.ts` | Pass (unchanged) |
| `lib/reports/generate-background-report.selftest.ts` | Pass (unchanged) |
| `tom-example-db.selftest.ts` | Skipped (as instructed) |

## Branch preview URL

https://practice-mvp-git-test-client-page-panels-benedwards-practicemvp.vercel.app

## Checks

1. **Ben01 deleted WorkCover / Active** — Soft-deleted claims are filtered in `buildClaimsPageModel`; period Active uses end date. Not verified against live Ben01 data here (no DB in this environment). Offline tests cover deleted exclusion and end-date cases. Confirm on preview.
2. **Approval/referral links → `/funding/approvals/[id]`** — Implemented on overview, quick views, claim detail. Back uses safe `returnTo` to overview / background / interview / client.
3. **`ReferralFundingCard` gone** — File deleted; see Removed above.
4. **Background + Interview shared quick-view lines** — Both use `ReferralFundingQuickView` with lines from `buildReferralFundingQuickView`.
5. **Interview add pop-up** — `InterviewFundingAddPanel`: embedded form, discard dialog, refresh on Save. Nothing written before Save (same server action as the full form).
6. **Overview + Add menu** — Three destinations with client locked and claim/kind presets; Save returns via `returnTo` to the overview.
7. **New Referral → no funding type / REFERRAL** — Form saves empty `funding_approval_type_id`; overview kind uses `approvalCardKind` (null type → REFERRAL).
8. **`returnTo` safety** — Self-test rejects external, `//`, `..`, and scheme paths.
9. **Tom Background report self-tests** — Pass unchanged; `lib/reports/` not modified.

## Report only (no change)

### Does the funding approval page show referral details?

| Detail | Shown? |
|--------|--------|
| Referral source / who | **No** |
| Referral date | **No** |
| Referrer comments | **No** |

It does show a professional **Referrer** line (name + organisation) when `referrerId` is set. Self / family / other source, who, referral date, and comments are not on this page.

### Does `FundingApprovalForm` let you type “Appointments attended”?

**No.** The field is read-only (muted). It displays the computed attended count from linked completed appointments (`initialValues.appointmentsAttended`). It is not a form input and does not save.

## Decisions the prompt left open

1. **Claim quick-view line with no approval yet** — Links to the claims overview (`/clients/[id]/claims`) instead of a funding approval URL (nothing to open).
2. **Claim Form Save with `returnTo` to overview** — Returns straight to the overview (does not append `created_claim_id`). Still appends `created_claim_id` when returning into a `/funding/approvals` mid-flow.
3. **Kind switch confirm** — Used `window.confirm("This will clear the funding details. Continue?")` rather than a custom dialog.
4. **Referral claim field** — Optional (empty allowed) so unattached referrals can still be created; funding approvals still require a claim.
5. **Back labels** — Added specific labels for claims / background / interview `returnTo` paths.
6. **PR** — Updated existing PR #6 on this branch rather than opening a new one.

## Files changed (feature commit)

- `PROJECT_MAP.md`
- `app/clients/[client_id]/background/interview/page.tsx`
- `app/clients/[client_id]/background/page.tsx`
- `app/clients/[client_id]/claims/page.tsx`
- `app/clients/[client_id]/page.tsx`
- `app/funding/approvals/[approval_id]/edit/page.tsx`
- `app/funding/approvals/[approval_id]/page.tsx`
- `app/funding/approvals/new/page.tsx`
- `app/funding/claims/[claim_id]/edit/page.tsx`
- `app/funding/claims/[claim_id]/page.tsx`
- `app/funding/claims/new/page.tsx`
- `components/client-background/client-background-page.tsx`
- `components/client-background/interview-page.tsx`
- `components/clients/referral-funding-quick-view.tsx`
- `components/funding/claim-form.tsx`
- `components/funding/claims-funding-page.tsx`
- `components/funding/funding-approval-form.tsx`
- `components/funding/interview-funding-add-panel.tsx` (new)
- `components/funding/referral-funding-card.tsx` (deleted)
- `lib/funding/claim-period-active.ts` + selftest (new)
- `lib/funding/claims-page.ts` + selftest
- `lib/funding/funding-form-kind.ts` + selftest (new)
- `lib/funding/load-claims-page.ts`
- `lib/funding/referral-funding-card.selftest.ts`
- `lib/navigation/back.ts`
- `lib/navigation/safe-return-to.ts` + selftest (new)
