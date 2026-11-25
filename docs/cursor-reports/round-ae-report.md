# Round AE report — Send list from DB, server-side safety, small fixes

Branch: `test/lramp` (from Round AD report `ef60294`)  
No PR opened (prompt guardrail). No database changes. No migrations.  
`DATABASE_URL` was unavailable in this environment; Part 0 audit and Ben01 Send list are from seed/code, not a live DB query.

## Commits

- `dd010e4` — Round AE: DB-backed send list, client-completable gate, dead-code cleanup
- This commit — Round AE report only

## Files changed (feature commit)

### New

- `lib/assessments/sendable-assessments.ts` — exceptions, ordering, link/send decisions, `PRE_SESSION_BATTERY_*`
- `lib/assessments/sendable-assessments.selftest.ts`
- `lib/assessments/load-sendable-assessments.ts`

### Modified

- `lib/assessments/battery-codes.ts` — aliases onto `PRE_SESSION_BATTERY_*` (default pre-session set only)
- `lib/assessments/battery-defaults.ts` — `buildSendAssessmentChips`; automations still use `getDefaultBatteryAssessments`
- `lib/assessments/resolve-battery-chain.ts` — validate/canonicalise against sendable DB defs; refuse others
- `lib/assessments/create-battery-instance.ts` — any sendable code; BTP instance elements unchanged
- `lib/assessments/create-assessment-link.ts` — `canCreateClientAssessmentLink` (active + client_completable)
- `lib/assessments/load-results.ts` — LRAMP Score from `loadFormDefinitionByCode("LRAMP")` once per list
- `app/api/assessments/create-battery/route.ts` — pass codes through; 400 on “can't be sent”
- `app/clients/[client_id]/{page,assessments/page,communications/page}.tsx` — load sendable + build chips
- `PROJECT_MAP.md`

### Deleted

- `app/clients/[client_id]/send-assessment-button.tsx`
- `app/clients/[client_id]/send-battery-button.tsx`
- `components/email/send-email-modal.tsx`

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
| All `lib/assessments/*.selftest.ts` | Pass (incl. new sendable-assessments) |
| `lib/appointments/*.selftest.ts` | None present |
| `lib/reports/tom-example.selftest.ts` | Pass (Tom report text unchanged) |
| `lib/reports/generate-background-report.selftest.ts` | Pass |
| `tom-example-db.selftest.ts` | Skipped |

## Migration names

None.

## Branch preview URL

https://practice-mvp-git-test-lramp-benedwards-practicemvp.vercel.app

Vercel commit status for `dd010e4`: success (deployment completed). Preview behind Vercel SSO.

## Checks

### 1. Part 0 audit table + exceptions

Audit of every seed definition with `client_completable = true` (active), for send-alone / battery-chain use via `/q` + `/api/assessments/submit` + Results:

| Code | Renders | Scores + result | Chain OK | Results OK | Notes |
|------|---------|-----------------|----------|------------|-------|
| BTP | OK | OK | OK | OK | No static elements; instance elements from SMART goals at create |
| PHQ9 | OK | OK | OK | OK | Default pre-session |
| GAD7 | OK | OK | OK | OK | Default pre-session |
| ASSIST | OK | OK | OK | OK | |
| PSF | OK | OK | OK | OK | Dedicated Results branch |
| LEVEL1_XC | OK | OK | OK | OK | Triggers no-op outside diagnostic battery |
| PC_PTSD5 | OK | OK | OK | OK | |
| ASRS | OK | OK | OK | OK | |
| ASRS_PART_A | OK | OK | OK | OK | |
| ASRS_PART_B | OK | OK | OK | OK | |
| DASS21 | OK | OK | OK | OK | |
| PHQ15 | OK | OK | OK | OK | |
| SUBSTANCE_USE_L2 | OK | OK | OK | OK | |
| DES_B | OK | OK | OK | OK | |
| SCI | OK | OK | OK | OK | |
| ASRM | OK | OK | OK | OK | |
| PID5_FBF | OK | OK | OK | OK | |
| SPECIFIC_DISORDER_SELECTOR | OK | OK | OK | OK | |
| PANIC_DISORDER | OK | OK | OK | OK | |
| AGORAPHOBIA | OK | OK | OK | OK | |
| SOCIAL_ANXIETY | OK | OK | OK | OK | |
| SEPARATION_ANXIETY | OK | OK | OK | OK | |
| SPECIFIC_PHOBIA | OK | OK | OK | OK | |
| PCL5 | OK | OK | OK | OK | |
| BACKGROUND_SR | OK* | Fail† | Fail | OK | *Own form; †`submit-background`, not battery submit; form has no next-link |

Not client_completable (not in Send list; refused by link/battery gates): LRAMP, mse, ASQ, SAGE_SR_*.

**Exceptions list** (`SEND_LIST_EXCEPTIONS` in `sendable-assessments.ts`):

```ts
BACKGROUND_SR: "sent through its own template"
```

### 2. Final Send list order (Ben01, from code)

`buildSendAssessmentChips(loadSendableAssessments(), plan, smartGoals)`:

1. Leading (when present): **BTP** (only if SMART goals), **PHQ-9**, **GAD-7**, **ASSIST**
2. Then A–Z by display label (assessmentName / clientDisplayName): ASRM, ASRS (+ Part A/B), DASS-21, DES-B, Level 1 XC, Level 2 PHQ-15 / Substance Use, severity measures (Agoraphobia…), PCL-5, PC-PTSD-5, PID-5-FBF, PSF, SCI, Specific Disorder Selector, …

**Defaults unchanged:** selection still follows treatment-plan battery defaults (`getDefaultBatteryAssessments` rules) — typically PHQ-9 + GAD-7 selected; BTP selected only with SMART goals; other sendable chips start unselected.

### 3. LRAMP / MSE / ASQ refused on both server paths

- **create-link / `createAssessmentLink`:** `canCreateClientAssessmentLink` — not `client_completable` → `"This assessment can't be sent to a client."` (ASQ, mse, LRAMP all `client_completable: false` in seeds/migration).
- **create-battery / `resolveBatteryChainCodes`:** code not in sendable map → `"{code} can't be sent to a client."`

### 4. Pre-session automations + Resend battery unchanged

- `lib/appointments/run-automations.ts` and `lib/appointments/prepare-battery-email.ts` still call `batteryCodesFromTreatmentPlan` → `getDefaultBatteryAssessments` (the four pre-session codes only), then `createBatteryInstance`.
- `components/session-notes/resend-battery-button.tsx` → prepare/send battery-email APIs → same treatment-plan codes.
- They never used the Send-chip loader; resolving those four codes still succeeds.

### 5. LRAMP seed file usage (grep)

`LRAMP_ELEMENTS` / `definitions/lramp` imports only in:

- `db/generate-lramp-sql.ts` (generator)
- `lib/assessments/*selftest.ts` (form-rules, answer-rows, lramp-summary, lramp-session-summary)
- the definition module itself

`load-results.ts` now uses `loadFormDefinitionByCode("LRAMP")`.

### 6. Deleted files + unused grep

Deleted:

- `app/clients/[client_id]/send-assessment-button.tsx`
- `app/clients/[client_id]/send-battery-button.tsx`
- `components/email/send-email-modal.tsx`

Pre-delete grep: only those three referenced each other; no other imports. Live UI already used `SendCommunicationModal`.

## Anything removed

- The three dead send files above.
- Battery-create whitelist that dropped non-`BATTERY_ASSESSMENT_CODES` silently (`normalizeBatteryCodes` on the create-battery route).
- `load-results` dependency on the LRAMP seed file for Score labels.

## Decisions the prompt left open

1. **Constant rename** — Introduced `PRE_SESSION_BATTERY_CODES` / labels / sequence as the clear “default pre-session set”; kept `BATTERY_ASSESSMENT_CODES` as a deprecated alias for automations/defaults.
2. **Diagnostic modules on Send list** — Offered (audit OK; diagnostic triggers are no-ops outside a diagnostic battery). Could exclude later if product wants Send = outcome measures only.
3. **BTP without static elements** — Explicitly allowed in `qualifiesAsSendable` despite the “has elements” rule.
4. **Display labels for long DSM names** — `clientDisplayName` when set, else full `assessmentName` (chips may wrap).
5. **No live DB** — Audit and Ben01 list inferred from seeds/code; loader queries DB at runtime in preview/production.
