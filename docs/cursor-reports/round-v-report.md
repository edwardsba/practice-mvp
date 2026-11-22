# Round V report — Emergency contacts as cards

Branch: `test/client-page-panels`  
Base: `d0b8b78` (Round U)

## Commits

- _(filled after commit)_

## What changed

### Part 1 — Edit details › Emergency (and Medical) cards

- Replaced the Emergency contacts table with tappable cards matching Medical contacts (`rounded-md border px-3 py-2`, same spacing).
- Shared shell: `components/clients/tappable-contact-card.tsx` — whole-card `<button>`, hover/focus fill only (`hover:bg-muted` / `focus-visible:bg-muted`, no outline ring).
- Emergency card lines: **Name · Role** (role omitted if empty); phone or “No phone recorded”; email or “No email recorded”.
- No Edit/Remove on the card. Tap opens `EmergencyContactDialog` in edit mode. Accessible name: `Edit {name}`.
- Remove lives in the dialog footer (left), via existing `DeleteConfirmationButton` + `deleteEmergencyContact`. Add mode has no Remove.
- Removed the section’s own “Emergency contacts” card header (panel already has the sub-heading). Removed the header “Add emergency contact” button.
- Bottom link: `+ Add emergency contact` (History-style text link).
- Medical contacts matched: tappable cards (no Edit/Remove), Remove in the edit form footer with confirmation; blocked with “Supervises a medication in History. Change the medication first.” when the card’s supervises line shows an ongoing medication; `+ Add medical contact` is the same bottom link style (muted / not clickable when disabled, existing hint kept).

### Part 2 — Client page › Emergency details

- Row label renamed to **Emergency contacts**.
- Lists every contact, one per line: `Name (role) · phone · email` (omit missing parts). No “+ N more”.
- Empty: `None recorded`.
- Helper + self-test updated in `lib/clients/emergency-details-summary.ts` / `.selftest.ts`.

## Separate edit page links

`/clients/[client_id]/emergency-contacts/[contact_id]/edit` is left in place. After this round, nothing in the app UI links to it (the table links were the only callers). Direct URL still works.

## Command results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | Pass |
| `npx next build` | Pass |
| Self-tests (`lib/client-background/*.selftest.ts`, `lib/funding/*.selftest.ts`, `lib/clients/*.selftest.ts`, `lib/medical-contacts/*.selftest.ts`, `lib/reports/tom-example.selftest.ts`, `lib/reports/generate-background-report.selftest.ts`) | All pass |
| `tom-example-db.selftest.ts` | Skipped (per prompt) |

## Diff scope vs `d0b8b78`

```
app/clients/[client_id]/page.tsx
components/clients/tappable-contact-card.tsx
components/emergency-contacts/emergency-contact-dialog.tsx
components/emergency-contacts/emergency-contacts-section.tsx
components/medical-contacts/medical-contacts-section.tsx
lib/clients/emergency-details-summary.selftest.ts
lib/clients/emergency-details-summary.ts
docs/cursor-reports/round-v-report.md
```

## Preview

- Branch preview URL: _(filled after deploy Ready)_
- Deploy status: _(filled after deploy Ready)_

## Manual UI checks (Tom / Ben01)

Not run in this environment: no local dev server (per guardrail), and the preview requires practitioner login which was not available to the agent. Code path uses the same dialogs/actions as before; recommend a quick pass on Ben01 for add / edit / remove + keyboard open on both card types.

## Decisions the prompt left open

1. **Shared card shell** — Extracted a small `TappableContactCard` used by both Emergency and Medical cards (prompt said “if it’s simple”).
2. **Medical remove blocked upfront** — Pre-disable Remove when `supervisesLine !== "No current medication"` (ongoing meds). Past-only History medications still fail on the server and surface via the confirmation error (edit page was out of scope for a new `removalBlocked` flag).
3. **Emergency section alignment** — Edit page still wraps Emergency in `-mx-4`; the section applies `mx-4` so cards line up with Medical without touching `edit/page.tsx`.
4. **DeleteConfirmationButton in dialogs** — Kept the existing component; stripped its page-level `mt-8 border-t` via a parent selector so Remove sits in the footer row opposite Save.
5. **Client page multi-line display** — Helper returns newline-joined lines; the field uses `whitespace-pre-line`.
6. **PROJECT_MAP** — Not updated (layout-only refinement of existing Emergency / Medical contacts UI).
