# Round Colours report: one colour per meaning

Branch: `test/colour-guideline` from `main` at `77910a3` (PR #12).  
**No PR** (prompt guardrail). No database changes. No local dev server. No `scripts/`, `app/api/`, or `app/q/` colour hits. Tom's Background report text unchanged (`tom-example.selftest.ts` and `generate-background-report.selftest.ts` green). Colours only — layout, wording, and behaviour unchanged.

## Commits

- `2a833d1` — Add shared status colours and convert palette uses
- _(this commit)_ — Round Colours report only (`docs/cursor-reports/round-colours-report.md`)

## Files changed

**New**

- `lib/ui/status-colours.ts` — single source for soft / pill / chip / badge / text (+ helpers)
- `lib/ui/status-colours-guard.selftest.ts` — palette-class guard
- `docs/cursor-reports/round-colours-report.md` (this file)

**Updated**

- `AGENTS.md` — "Colours: one meaning each." table + rule
- `PROJECT_MAP.md` — Compliance & Infrastructure #10 pointer
- `components/ui/badge.tsx` — `success` / `warning` / `destructive` from status colours
- `lib/section-status.ts` — `sectionProgressClass`: left→neutral, to_confirm→attention, done→done
- `components/shared/section-status-pill.tsx` — pill text tones from status colours
- `components/shared/prefilled-tag.tsx` → attention
- Assessment / interview / funding / report / form consumers listed in Check 1

## Command results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | OK |
| `npx next build` | OK |
| Lint (changed TS/TSX) | Pre-existing `react-hooks/set-state-in-effect` in files touched only for colour imports; new colour module / badge / pills / section-status clean |
| Required `npx tsx` self-tests (incl. `lib/ui/`, Tom report; skip `tom-example-db`) | All green |
| Database / migrations | Not touched |

## Preview URL

- Branch alias: https://practice-mvp-git-test-colour-guideline-benedwards-practicemvp.vercel.app
- This deploy (`2a833d1`): https://practice-inxm4ps04-benedwards-practicemvp.vercel.app

Vercel commit status on `2a833d1`: **success**. Preview is SSO-protected.

---

## Checks

### 1. Before → after (every file, old classes → shared name)

| File | Old (palette) | New (shared name / export) |
|------|---------------|----------------------------|
| `lib/ui/status-colours.ts` | _(new)_ | Defines **neutral / attention / done / problem / client** |
| `lib/section-status.ts` `sectionProgressClass` | left: `border-orange-500 bg-orange-50 text-orange-900`; to_confirm: amber; done: emerald | **neutral** / **attention** / **done** `.chip` |
| `components/shared/section-status-pill.tsx` | `text-orange-800` / `text-amber-800` / `text-emerald-800` | **neutral** / **attention** / **done** `.text` |
| `components/shared/prefilled-tag.tsx` | `text-amber-800` | **attention** (`attentionPrefilledTagClass`) |
| `components/ui/badge.tsx` | inline emerald / amber / red badge strings | **done** / **attention** / **problem** `.badge` |
| `components/assessments/practitioner-assessment-form.tsx` | `border-blue-500` + `text-blue-800` (not saved) | **attention** (`attentionSaveBannerClass`) |
| `components/client-background/fields.tsx` | blue Client / Use row | **client** (`.text`, `clientSuggestionRowClass`, `clientUseButtonClass`) |
| `components/client-background/interview-page.tsx` | blue self-report banner; amber worth-checking | **client** `.soft`; **attention** `.soft` |
| `components/client-background/interview-history.tsx` | amber worth-checking | **attention** `.soft` |
| `components/client-background/interview-card.tsx` | `text-amber-800` worth checking | **attention** `.text` |
| `components/client-background/history-section.tsx` | amber "Needs detail" / "Not linked" | **attention** `.pill` |
| `components/client-background/history-tree-section.tsx` | sky client med box; amber "Needs who"; indigo/emerald Episode/Treatment tags | **client** `.soft`; **attention** `.pill`; Episode/Treatment → theme `secondary` / `muted` (see Decisions) |
| `components/client-background/relationship-blocks-section.tsx` | amber Needs / Not placed; blue Client line | **attention** `.pill` / `.soft`; **client** `.text` |
| `components/clients/referral-funding-quick-view.tsx` | amber report tag | **attention** (`attentionStatusBadgeClass`) |
| `components/funding/claims-funding-page.tsx` | emerald sent / amber pending tags | **done** / **attention** status badge classes |
| `components/report/background-worth-checking.tsx` | amber box | **attention** `.soft` |
| `components/report/sage-sr-diagnostic-report-content-view.tsx` | amber exclusion box (highlight only) | **attention** `.soft` — generated text unchanged |
| `app/.../sage-sr-diagnostic-report-editor.tsx` | amber exclusion box + text | **attention** `.soft` / `.text` — text content unchanged |
| `app/.../import-sage-sr-dialog.tsx` | `text-emerald-600` success | **done** `.text` |
| `app/.../results/[result_id]/page.tsx` | `border-red-200` alerts card | **problem** (`problemBorderClass`) |
| `app/practice/practice-form.tsx` | `text-emerald-700` saved | **done** (`doneSuccessMessageClass`) |
| `app/practitioner/practitioner-form.tsx` | `text-emerald-700` saved | **done** (`doneSuccessMessageClass`) |
| `AGENTS.md` / `PROJECT_MAP.md` | — | Rule + map pointer |

### 2. No `orange-` left in `app/`, `components/`, or `lib/`

Confirmed (`rg orange-` → none). Left chips no longer use orange.

### 3. Guard passes; fails on a test palette class

- `npx tsx lib/ui/status-colours-guard.selftest.ts` → OK (allow-list: `status-colours.ts`, the guard itself).
- Appended `bg-orange-500` to `components/shared/section-status-pill.tsx` → assert failed naming that file; restored the file; guard OK again.

### 4. Chips and pills (assessment form + interview)

Shared `sectionProgressClass` / `SectionStatusPill`: **left = neutral**, **to_confirm = attention**, **done = done**. Skipped stays dashed muted. Both surfaces share these helpers.

### 5. Final shades and contrast (≥4.5:1)

| Name | Light (text on bg) | Ratio | Dark (text on bg) | Ratio |
|------|--------------------|------:|-------------------|------:|
| neutral | `neutral-800` `#262626` on `neutral-50` `#fafafa` | **14.50:1** | `neutral-100` `#f5f5f5` on `neutral-900` `#171717` | **16.44:1** |
| attention | `amber-950` `#451a03` on `amber-50` `#fffbeb` | **14.44:1** | `amber-100` `#fef3c7` on `amber-950` `#451a03` | **13.45:1** |
| done | `emerald-900` `#064e3b` on `emerald-50` `#ecfdf5` | **9.23:1** | `emerald-100` `#d1fae5` on `emerald-950` `#022c22` | **13.36:1** |
| problem | `red-900` `#7f1d1d` on `red-50` `#fef2f2` | **9.16:1** | `red-100` `#fee2e2` on `red-950` `#450a0a` | **13.22:1** |
| client | `blue-900` `#1e3a8a` on `blue-50` `#eff6ff` | **9.52:1** | `blue-100` `#dbeafe` on `blue-950` `#172554` | **12.04:1** |
| client Use button | white on `blue-700` `#1d4ed8` | **6.70:1** | — | — |

Neutral vs attention also differ in lightness (cool grey vs warm amber backgrounds; `neutral-800` vs `amber-950` text).

### 6. Anything that didn't fit a meaning

- **History tree Episode / Treatment categorical tags** (`history-tree-section.tsx` `Tag`): not a status meaning. Converted from indigo/emerald palette to theme tokens (`bg-secondary` / `bg-muted`) so no sixth colour and the guard stays clean. Other/Step already used zinc.
- **`text-destructive` / `bg-destructive` theme tokens** for form errors and delete controls: left as theme tokens (prompt: delete keeps destructive theme; errors already used theme tokens). Not Tailwind palette classes.
- **Selected tree meta hex** `text-[#1e3a8a]` in history tree: not a Tailwind palette utility; left unchanged (selection chrome, not a status meaning).

### 7. Tom's report text unchanged

`npx tsx lib/reports/tom-example.selftest.ts` and `generate-background-report.selftest.ts` passed. No edits under `lib/reports/` generators/wording; SAGE exclusion UI colour only.

---

## Anything removed

- Orange for "left / to answer" chips and pills (replaced by **neutral**).
- Direct Tailwind palette colour class strings under `app/`, `components/`, and `lib/` (except `lib/ui/status-colours.ts`).

## Decisions the prompt left open

1. **Episode / Treatment kind tags** — categorical, not a status meaning. Mapped to theme `secondary` / `muted` rather than inventing a sixth colour or keep-listing indigo/emerald.
2. **"Not saved yet" banner** (was blue) — treated as **attention** (needs practitioner action), not **client**.
3. **SAGE-SR exclusion clause on-screen box** — treated as **attention** (caveat highlight); generated clause text unchanged.
4. **No `client` Badge variant** added — nothing needed a Badge `client`; Client: lines use status-colour exports directly.
5. **Zinc Other/Step tags** and **theme `destructive`** — outside the five-name palette families; left as-is.
)
