# Practice MVP: Design guide

> **Read this before designing, mocking up or building anything.** It is the single source of truth for how every page, field and control in Practice MVP looks and behaves. Readable copy for review: the "Practice MVP: Design guide" doc on claude.ai, kept identical to this file.

## 0. How to use this guide (GU)

| # | Section | Code |
| --- | --- | --- |
| 0 | How to use this guide | GU |
| 1 | Pages | PG |
| 2 | Text and spacing | TX |
| 3 | Buttons and links | BT |
| 4 | Fields and forms | FM |
| 5 | Panels, dialogs and confirmations | PN |
| 6 | Lists, tables, trees and empty states | LS |
| 7 | Colours and status | CL |
| 8 | Dates, numbers and wording | DT |
| 9 | Phone and touch | PH |
| 10 | Client-facing pages | CP |
| 11 | Assessments and results | AS |
| 12 | Background interview and trees | IV |
| 13 | Navigation and the back arrow | NV |
| A | Appendix: Known gaps | — |
| B | Appendix: Change log | — |

- **GU-1 Rule IDs.** Every rule has an ID: its section code and a number, e.g. FM-3. Prompts, mockups and reviews cite IDs ("follow FM-3"). An ID is never renumbered or reused. A retired rule is deleted here and recorded in the Change log.
- **GU-2 Who reads it.** Every new Claude chat and every Cursor session reads this guide before starting. Cursor gets it through `.cursor/rules/design-guide.mdc` (always on) and the pointer at the top of `AGENTS.md`.
- **GU-3 One master.** This file is the master. The claude.ai doc is its readable copy, and Claude keeps the two identical: every change lands in both in the same step.
- **GU-4 Code holds the values.** Colours come from `lib/ui/status-colours.ts`, and shared parts from `components/ui` and `components/shared`. The guide names which to use and when; it never repeats hex codes or class strings.
- **GU-5 Changing it.** A new pattern is agreed with Ben, added here with the next free ID and a Change log row, then built. If the code and the guide disagree, the guide wins, and the gap goes in Known gaps. Cursor never changes this file unless a prompt says exactly what to change.
- **GU-6 Keeping it tidy.**
  - A new topic becomes a new numbered section at the end (before the appendices), with its own code, added to the contents table. Existing sections are never renumbered.
  - Each section opens with one sentence saying what it covers. A section that grows past about a screen is split into lettered parts (e.g. IV-A, IV-B), keeping its rule IDs.
  - Feature-specific detail (one screen's exact layout) belongs in that feature's mockup board and code comments. The guide keeps the rule that applies everywhere.
- **GU-7 Mockups** on the design canvas follow this guide. A mockup is never a source of truth on its own.

## 1. Pages (PG)

Every signed-in page uses `AppShell` and one of two shared headers, with content in a single centred column.

- **PG-1 Headers.**

| Page type | Header | Example |
| --- | --- | --- |
| List or hub | `ListPageHeader`: page title, one primary action on the right | Clients, Funding, Settings lists |
| One record | `EntityPageHeader`: small grey kicker (what it is), large name, one summary line, status badge and one action on the right | Client page, a report, an assessment result |
| Create or edit | `EntityPageHeader` with the kicker "New …" or "Edit …" | New appointment type |

- **PG-2 Back.** `BackButton` sits above the header and follows section 13 (NV): it goes one step up the hierarchy and reads "← Back to …". Never a browser back.
- **PG-3 Width.** The content column is `max-w-3xl`, centred. Wide tables and the calendar may go wider; nothing else does.
- **PG-4 Sections.** A page is a stack of section cards (white, thin border, rounded, 16 px padding), 16 px apart. Each card has a short heading and, when relevant, a status pill on the right.
- **PG-5 Actions.** One primary action per page, top right in the header. Actions for one section sit in that section's header or footer, never floating.
- **PG-6 Long forms** (assessments, the interview) use numbered, foldable sections, with progress chips at the top and one Save or Confirm per section.

## 2. Text and spacing (TX)

One font (Geist), five sizes, and muted grey for anything secondary.

- **TX-1 Sizes.**

| Use | Size and weight |
| --- | --- |
| Page title | 24 px, semibold |
| Section heading | 15–16 px, semibold |
| Body, field values, buttons | 14–15 px (16 px in inputs on phones, so iOS doesn't zoom) |
| Field labels | 13–14 px, medium |
| Hints, metadata, kickers | 12–13 px, muted grey |

- **TX-2 Muted text** (`text-muted-foreground`) is for hints, summaries and "Not recorded". Never use colour to mean "secondary".
- **TX-3 Empty values** are grey italic "Not recorded" (fields) or "None recorded" (lists and presence items).
- **TX-4 Spacing** is in multiples of 4 px: 16 px between cards, 12–14 px inside them, 6–8 px between a label and its control.
- **TX-5 Wording** is plain, short and in sentence case, with Australian spelling.

## 3. Buttons and links (BT)

A button does something; a link goes somewhere.

- **BT-1 Variants.** Use the shared `Button` (`components/ui/button.tsx`) with one of these variants.

| Variant | Use for | Where |
| --- | --- | --- |
| Primary (`default`, dark) | The one main action: Save, Confirm section, Send, Next | Right-most in a footer; header action |
| Outline | Secondary actions: Cancel, Back, Edit, Keep | Left of the primary |
| Ghost | Quiet actions in lists and headers: the Back button, icon buttons | Inline |
| Destructive | Remove, Delete, Cancel appointment | Far left of a footer, away from Save |
| Client purple | Only "Use client's" (`clientUseButtonClass`) | On a purple Client: line |

- **BT-2 One primary per area.** Two dark buttons side by side is a mistake.
- **BT-3 Footer order:** Remove (left) · Cancel · Save (right).
- **BT-4 Disabled** buttons say why underneath, in muted text, e.g. "Decide 1 possible match first."
- **BT-5 Links** are blue, underlined on hover, and only for navigation or opening something. Blue is never a status colour.
- **BT-6 A value as a link.** In the interview and on info pages, the value itself opens its editor (black text, thin grey underline). There are no separate "Edit" links next to values.
- **BT-7 Add buttons:** ⊕ in a circle on tree lines; a dashed "+ Add …" button below lists in forms.

## 4. Fields and forms (FM)

There are two kinds of form, each with one shared look: assessment forms (the shared form engine) and record forms (the side panel).

### 4A. Assessment forms (client and practitioner)

- **FM-1 Elements.** Only the form engine's elements are used. No one-off fields. Details: AGENTS.md, "Assessment form elements: one look".

| Element | Look |
| --- | --- |
| `yes_no`, `radio` | Full-width rows, one per line, each with a light border; the selected row gets a dark border and light fill |
| `checkbox`, `tick` | The same rows, with square ticks |
| `short_text`, `long_text`, `date` | Full-width boxes, 44 px tall (long text taller) |
| `text_list` | Growing boxes; an empty one always trails |
| `person_list`, `history_list` | Saved entries collapse to one line with Edit; the open entry shows its fields one per line, with Remove and Done; a dashed "+ Add …" below; field wording set by the form; on client forms the entry opens in a sheet (CP-7) |
| In-person option | "I'd rather talk about it in person", always the last row, when switched on |

- **FM-2 Follow-up questions** sit under their answer, indented, with a 2 px grey line.
- **FM-3 Pre-filled** answers carry the amber "Pre-filled" tag until confirmed.
- **FM-4 Errors:** a red outline on the question and one red line under it, e.g. "Please answer this question."

### 4B. Record forms (people, events, contacts, claims) open in the side panel

- **FM-5 One field per line**, full width, grouped exactly as on the info page. Exception: Age and its Passed away tick share one line; the year they passed away sits on the next line.
- **FM-6 Choices:** four or fewer are tap buttons (`ChoiceButtons`); more are a dropdown.
- **FM-7 Dates** use Year / Month / Day on one line (`PartialDatePicker`), the only side-by-side exception.
- **FM-8 Manual save.** Nothing saves until Save is pressed. No autosave, no background updates.

## 5. Panels, dialogs and confirmations (PN)

Use the side panel to look at or edit one item, and a dialog only to ask a short question.

- **PN-1 Which to use.**

| Need | Use |
| --- | --- |
| View or edit one person, event, contact or claim | Shared `SidePanel`: info page first, Edit opens the form |
| Add a new item from a tree or list | Shared `SidePanel`, opening straight to the form |
| Confirm something risky (delete, discard changes, send) | Small dialog (`components/ui/dialog.tsx`): title, one sentence, Cancel · action |
| Send, choose, or pick from a short menu | Dialog or dropdown menu |
| A whole new record with many sections | Its own page, not a dialog |

- **PN-2 Side panel.** It slides in from the right over a dimmed page, with × top right. Tapping outside or Escape closes it; if the form has changes, it asks "Discard changes?" first. Details: AGENTS.md, "Trees and panels: one look".
- **PN-3 Save** in the panel shows the item's info page. Close or tap outside to go back.
- **PN-4 No browser pop-ups.** Never `window.confirm` or `window.alert`. They can't be styled, and they break on phones.

## 6. Lists, tables, trees and empty states (LS)

Pick the shape by what the reader does with it.

- **LS-1 Shapes.**

| Shape | When | Look |
| --- | --- | --- |
| Lined rows | A record's fields (interview sections 1–4 and 7, info pages) | Small grey label above; value below; thin rule between rows |
| Table (`components/ui/table.tsx`) | Many records compared across the same columns (clients, appointments, results) | Header row; newest first; a row opens the record |
| Tree | Relationships and history | Shared tree levels: left bars, 4 px dark at level 2, 2 px lighter at levels 3–4, square corners; ⊕ on lines that can hold something |
| Card list | A handful of mixed items on a hub page | Section cards |

- **LS-2 Empty states** say what's missing and offer the next step, e.g. "No claims yet." with the add action. Empty fields use grey italic "Not recorded".
- **LS-3 Info pages** show every field, empty or not, in groups divided by a thin line, with Connected links last.
- **LS-4 Results tables** show the question on the left and the answer on the right, in form order.

## 7. Colours and status (CL)

Every colour has one meaning and comes from `lib/ui/status-colours.ts`.

- **CL-1 One file.** No colour classes or hex values anywhere else. The guard test `lib/ui/status-colours-guard.selftest.ts` enforces it.
- **CL-2 Meanings.**

| Colour | Meaning | Used for |
| --- | --- | --- |
| Grey (neutral) | Not started; nothing to flag | Untouched sections, empty states |
| Amber (attention) | Needs your attention | In progress, Pre-filled, warnings, "to discuss" highlights, funding running low |
| Green (done) | Done or active | Confirmed sections, active claims |
| Red (problem) | Problem or risk | Errors, failed saves, urgent risk |
| Purple (client) | The client's own words | "Client:" lines and the Use client's button, in the interview only |
| Blue | Links only | Navigation |

- **CL-3 Pills, chips and badges** take their colour from the same file (`pill`, `chip`, `badge`).
- **CL-4 Tree lines** use `treeBarColours`. These are hierarchy shades, not statuses.
- **CL-5 A new meaning** is added to the colour file first, with Ben's agreement, then used.
- **CL-6 Mockups** copy their colour values from the colour file.

## 8. Dates, numbers and wording (DT)

All dates show in the practice's time zone, in one format, from one shared helper.

- **DT-1 Formats.**

| What | Format | Example |
| --- | --- | --- |
| A date | Day, short month, year | 28 Nov 2026 |
| Date and time | Date, then 12-hour time | 28 Nov 2026, 2:30 pm |
| A month | Short month, year | Nov 2026 |
| A partial date (history) | Whatever is known | 2019 · Mar 2019 · about age 25 |
| Age | A number; "aged … years" in sentences | 51 · aged 51 years |
| Money | $ with cents | $1,234.50 |

- **DT-2 Phone numbers** are shown in groups: 0412 345 678.
- **DT-3 Labels** are questions or short nouns: "Date of birth", "Do they live with you?".
- **DT-4 Messages** are one short sentence: "Saved.", "Couldn't save. Try again."
- **DT-5 Voice.** Client-facing wording talks to the client ("you"); practitioner wording talks about the client ("client").

## 9. Phone and touch (PH)

Every screen is designed for a 390 px phone first, then widened for desktop.

- **PH-1 Touch targets** are at least 44 × 44 px: buttons, radio rows, ⊕, value links and list rows.
- **PH-2 One column** on phones. Side-by-side fields only for Year / Month / Day.
- **PH-3 Inputs** use 16 px text, so iOS doesn't zoom in.
- **PH-4 Side panels** take about 88% of the width on a phone, and a fixed width on desktop.
- **PH-5 Footers.** In side panels and practitioner forms, Save or Confirm stays visible at the bottom. On client forms, Back / Next sits directly under the section, never fixed, so it never rides on top of the keyboard.
- **PH-6 Typing** never closes the keyboard or moves the page. Fields keep focus while typing.

## 10. Client-facing pages (CP)

What clients see (assessment links and, later, the pre-session form) is calm, plain and the same for every assessment.

- **CP-1 No app chrome:** no menu and no practitioner data. Just the practice name, the assessment title and a short intro.
- **CP-2 The shared form engine only:** numbered sections with progress chips, Save and finish later, Back / Next, and a final "Send to my psychologist".
- **CP-3 Nothing is required** unless clinically necessary. Every sensitive question offers "I'd rather talk about it in person".
- **CP-4 Wording speaks to the client** ("you"), at a reading age of about 12.
- **CP-5 After sending:** one thank-you screen; the link can't be used again.
- **CP-6 Colours:** only grey, amber and green for progress, and red for errors. Purple is never shown to clients.
- **CP-7 People and history entries** on client forms open in a sheet over a greyed page: full height on phones, a centred dialog on desktop. Done adds the entry; Cancel, × or tapping outside discards a new one. When it closes, the page centres the entry and the "+ Add another …" button. On phones, Done and Cancel sit at the end of the sheet's content, never in a fixed footer, so the keyboard never covers them.

## 11. Assessments and results (AS)

Every assessment, client or practitioner, is data in the database, filled in on the shared form and shown on the shared results view.

- **AS-1 No assessment-specific pages.** Adding an assessment means adding its definition, elements and options. It never gets its own page, form or results layout.
- **AS-2 The only per-assessment code** allowed is a scoring rule (`lib/assessments/scoring/`) and a summary box (`lib/assessments/result-summaries.ts`).
- **AS-3 Results page:** a summary box at the top with the result at a glance, then every answer in a question-left / answer-right table, in form order.
- **AS-4 Practitioner forms** (MSE, LRAMP) use the same form, with lettered sections, progress chips and one Save.
- **AS-5 Assessment lists** for a client show the name, date, status pill and result summary, newest first.
- **AS-6 Element keys are unique across all assessments.** New keys start with the assessment's short code (e.g. `bsr_sex`), so a later assessment can never take over an existing question.

## 12. Background interview and trees (IV)

The interview fills in the client's record, one numbered section at a time, and every section ends with one Confirm.

- **IV-1 Sections 1–4 and 7** are lined rows. The value is the edit link; empty shows grey italic "Not recorded" or "None recorded". There are no Yes / No / N/A boxes.
- **IV-2 Sections 5, 6, 8 and 9** show the shared trees inline, with no Yes / No boxes on headings. ⊕ adds an item. Empty headings show "None recorded".
- **IV-3 Client answers** are purple "Client:" lines:
  - same as the file: the purple line only;
  - file empty: the purple line with Use client's;
  - different: the purple line, the file value, then Use client's and Keep;
  - possible match (trees): the purple line, the file line, then Use client's, Keep, or Add as new person.
- **IV-4 Use client's on a person or item** opens the full Add form, pre-filled. Save shows the info page.
- **IV-5 Blank or "in person".** If the client left it blank or chose "in person", the heading is highlighted amber, with "Ask in session: add with ⊕, or Nothing to report". Confirm waits until each one is done.
- **IV-6 Confirm** reads "Accept N client changes and confirm" while client answers are waiting. It creates the remaining entries from the client's details.
- **IV-7 Server values.** The server always reads values from the stored self-report and the stored file, never from the page.
- **IV-8 A confirmed section** turns green and folds away.

## 13. Navigation and the back arrow (NV)

Every page has a type, and its type decides which pages its back arrow may return to: Back always goes one step up the hierarchy, to the parent that opened the page, or to the page's default parent.

- **NV-1 Every page has a type.** A page that fits none of these is not built until Ben agrees a type (GU-5).

| Type | What it is | Examples | Back arrow |
| --- | --- | --- | --- |
| Home | The dashboard | Home | None |
| Main list | A practice-wide list, opened from the menu | Clients, Calendar, All appointments, Professionals, Appointment types | None |
| Entity details | A person or organisation other records hang from | Client, Professional, Organisation | Yes |
| Sub-list | One kind of record for one entity | The client's Appointments, Reports, Claims | Yes |
| Section page | One part of an entity, too big for its details page | Background, Feedback over time | Yes |
| Record details | One record or document | Appointment, Session note, Result, Report, Claim, Appointment type | Yes |
| Record form | Any New or Edit page | Edit client, New appointment, Edit report type | Yes |
| Guided form | A long, sectioned form on the shared form engine | Start assessment, New assessment, Background interview | Yes |

Practice details and Practitioner profile are entity pages opened straight from the menu, so like Home and Main lists they have no back arrow. Login, client pages (CP) and redirect-only pages have no type and no back arrow.

- **NV-2 Default and allowed parents.** Each type has one default parent, which always exists, plus the other types it may go back to. "Same client" means the parent belongs to the same client (or the same record family, for settings and contacts).

| Type | Default parent | Also allowed |
| --- | --- | --- |
| Main list | — | — |
| Entity details | Its Main list | Home, Calendar, any Record details that links to it, any Entity details that links to it (e.g. a professional's organisation, the professional who referred a client) |
| Sub-list | Its Entity details | — |
| Section page | The Entity details or Sub-list it belongs to | Record details for the same client |
| Record details | Its Sub-list | Entity details, Section page and Record details for the same client; the matching Main list; Calendar; Home |
| Record form (Edit) | The record it edits, or its Entity details when the record has no page of its own (e.g. an emergency contact) | — |
| Record form (New) | The list it adds to | Any page allowed as a parent of the record it creates |
| Guided form | Its Section page or Sub-list | Record details for the same client |

Record forms and Guided forms are never a parent. Section 13B lists every page with its type and default parent.

- **NV-3 Each page remembers one parent.**
  1. When page A opens page B, B remembers A only if A's type is allowed for B (NV-2) and A belongs to the same client.
  2. A form, or any page that isn't allowed, is ignored. B then keeps the parent it already remembers; if it has none, it takes the form's remembered parent when that is allowed for B; otherwise it uses its default parent.
  3. The newest allowed opener replaces the old one.
  4. Returning is not opening. If A's own remembered parent is B, nothing changes. This stops loops (session note → result → back to session note).
  5. Back goes to the remembered parent. If there is none, or it no longer exists, Back goes to the default parent.
  6. The memory lives in the browser tab. A new tab, a bookmark or a pasted link starts with the default parent.
  7. Never use browser history (`router.back`, `history.back`) for the back arrow.
- **NV-4 Forms.** A form's back arrow does the same as its Cancel: it goes to the form's parent, and if the form has changes it asks "Discard changes?" first (PN-2, PN-4). Save never returns to the form: Edit → Save shows the record; New → Save shows the new record.
- **NV-5 The label** always says where Back goes, worked out from the same parent as the address. It is never typed separately on a page.

| Destination type | Label | Example |
| --- | --- | --- |
| Home | Back to home | ← Back to home |
| Main list | Its menu name, lower case | ← Back to all appointments · ← Back to clients · ← Back to calendar |
| Entity details | The entity's name | ← Back to Sasha Tumasovs · ← Back to Woollahra Medical |
| Sub-list | Its list name | ← Back to appointments · ← Back to session notes |
| Section page | Its page name | ← Back to background |
| Record details (dated) | The record kind, then its date (DT-1) | ← Back to session note, 12 Nov 2026 |
| Record details (undated) | The record kind, or the item's own name for settings | ← Back to treatment plan · ← Back to Standard session |
| Record form | The form name | ← Back to edit appointment |

- **NV-5 continued.**
  - Never a bare "← Back". A Main list says "all …" where the menu does, so it can't be confused with the client's own list.
  - Sentence case, Australian spelling (TX-5). Names longer than 32 characters are cut with "…".
  - While the page loads, show the default parent's label, never a blank or disabled button.
- **NV-6 Look and place.** The back arrow is the shared `BackButton`, a ghost button above the header, on the left (PG-2, BT-1). Side panels have × instead (PN-2).
- **NV-7 Links between pages.** A page may link to another page only if the destination allows the linking page's type as a parent (NV-2). A link that breaks this is a gap: raise it with Ben to add the type to NV-2, or remove the link. Links into a page with no back arrow (Home, Main lists, Practice details, Practitioner profile) are always allowed.
- **NV-8 Every page is registered.** Every `app/**/page.tsx` has one entry in the page registry, `lib/navigation/page-registry.ts`, giving its route, type, how to find its default parent from its data, and its label. The guard test `lib/navigation/page-registry-guard.selftest.ts` fails when a page has no entry, or when an entry's default parent breaks NV-2. Pages never pass their own back address or label.
- **NV-9 Building or changing a page.** Cursor follows these steps every time:
  1. Pick the page's type from NV-1. If none fits, stop and ask Ben.
  2. Add or update its registry entry (NV-8): type, default parent, label.
  3. Put the shared `BackButton` above the header (unless the type has none), with no address or label passed in.
  4. Check every link into and out of the page against NV-2 and NV-7, and flag any that breaks them.
  5. For forms, make Back and Cancel go to the form's parent, and make Save show the record (NV-4).
  6. Run the registry guard test.
  7. In the final message, state the page's type, default parent and allowed parents.
- **NV-10 Create and return.** A form may open a New form for a record it needs (Edit professional → New organisation; Funding approval → New claim). That form's Cancel and Save go back to the form that opened it, and Save brings the new record back already selected. These handoffs are the only use of `safeReturnTo`, and parent memory ignores them.

### 13B. Page map

Every page, with its type and default parent. Pages marked † are known gaps (Appendix A).

| Page | Route | Type | Default parent |
| --- | --- | --- | --- |
| Home | `/dashboard` | Home | — |
| Calendar | `/calendar` | Main list | — |
| Clients | `/clients` | Main list | — |
| All appointments | `/appointments` | Main list | — |
| All session notes | `/session-notes` | Main list | — |
| All reports | `/reports` | Main list | — |
| All claims | `/funding/claims` | Main list | — |
| All funding approvals | `/funding/approvals` | Main list | — |
| Professionals | `/contacts/professionals` | Main list | — |
| Organisations | `/contacts/organisations` | Main list | — |
| Professions | `/settings/professions` | Main list | — |
| Appointment types | `/settings/appointment-types` | Main list | — |
| Email templates | `/settings/email-templates` | Main list | — |
| Email variables | `/settings/email-variables` | Main list | — |
| Report types | `/settings/report-types` | Main list | — |
| Assessments (settings) | `/settings/assessments` | Main list | — |
| Claim types | `/funding/claim-types` | Main list | — |
| Funding approval types | `/funding/approval-types` | Main list | — |
| Practice details | `/practice` | Entity details (menu) | — |
| Practitioner profile | `/practitioner` | Entity details (menu) | — |
| Client | `/clients/[client_id]` | Entity details | Clients |
| Professional | `/contacts/professionals/[professional_id]` | Entity details | Professionals |
| Organisation | `/contacts/organisations/[organisation_id]` | Entity details | Organisations |
| Edit client | `/clients/[client_id]/edit` | Record form | Client |
| Edit emergency contact | `/clients/[client_id]/emergency-contacts/[contact_id]/edit` | Record form | Client |
| New professional | `/contacts/professionals/new` | Record form | Professionals |
| Edit professional | `/contacts/professionals/[professional_id]/edit` | Record form | Professional |
| New organisation | `/contacts/organisations/new` | Record form | Organisations |
| Edit organisation | `/contacts/organisations/[organisation_id]/edit` | Record form | Organisation |
| Edit practice details | `/practice/edit` | Record form | Practice details |
| Edit practitioner profile | `/practitioner/edit` | Record form | Practitioner profile |
| New membership | `/practitioner/memberships/new` | Record form | Practitioner profile |
| Edit membership | `/practitioner/memberships/[membership_id]/edit` | Record form | Practitioner profile |
| Appointments (client) | `/clients/[client_id]/appointments` | Sub-list | Client |
| Session notes (client) | `/clients/[client_id]/session-notes` | Sub-list | Client |
| Assessments (client) | `/clients/[client_id]/assessments` | Sub-list | Client |
| Reports (client) | `/clients/[client_id]/reports` | Sub-list | Client |
| Claims (client) | `/clients/[client_id]/claims` | Sub-list | Client |
| Communications | `/clients/[client_id]/communications` | Sub-list | Client |
| Background | `/clients/[client_id]/background` | Section page | Client |
| Feedback over time | `/clients/[client_id]/assessments/feedback` | Section page | Assessments (client) |
| Background interview | `/clients/[client_id]/background/interview` | Guided form | Background |
| Start assessment | `/clients/[client_id]/assessments/start` | Guided form | Assessments (client) |
| New assessment | `/clients/[client_id]/assessments/new/[assessment_code]` | Guided form | Assessments (client) |
| Edit assessment | `/clients/[client_id]/assessments/edit/[instance_id]` | Guided form | Assessments (client) |
| Appointment | `/appointments/[appointment_id]` | Record details | Appointments (client) |
| Session note | `/session-notes/[session_note_id]` | Record details | Session notes (client) |
| Result | `/clients/[client_id]/results/[result_id]` | Record details | Assessments (client) |
| Report | `/clients/[client_id]/reports/[report_id]` | Record details | Reports (client) |
| SAGE-SR report | `/clients/[client_id]/reports/sage-sr/[report_id]` | Record details | Reports (client) |
| Treatment plan † | `/clients/[client_id]/treatment-plan/[plan_id]` | Record details | Client |
| Crisis plan † | `/clients/[client_id]/crisis-plan/[plan_id]` | Record details | Client |
| Claim | `/funding/claims/[claim_id]` | Record details | Claims (client) |
| Funding approval † | `/funding/approvals/[approval_id]` | Record details | Claim |
| Appointment type | `/settings/appointment-types/[type_id]` | Record details | Appointment types |
| Report type | `/settings/report-types/[type_id]` | Record details | Report types |
| Assessment (settings) | `/settings/assessments/[assessment_code]` | Record details | Assessments (settings) |
| Funding approval type | `/funding/approval-types/[type_id]` | Record details | Funding approval types |
| New appointment | `/appointments/new` | Record form | Appointments (client), or All appointments when opened without a client |
| Edit appointment | `/appointments/[appointment_id]/edit` | Record form | Appointment |
| New report | `/clients/[client_id]/reports/new` | Record form | Reports (client) |
| Edit report | `/clients/[client_id]/reports/[report_id]/edit` | Record form | Report |
| New treatment plan † | `/clients/[client_id]/treatment-plan/new` | Record form | Client |
| Edit treatment plan | `/clients/[client_id]/treatment-plan/[plan_id]/edit` | Record form | Treatment plan |
| New crisis plan † | `/clients/[client_id]/crisis-plan/new` | Record form | Client |
| Edit crisis plan | `/clients/[client_id]/crisis-plan/[plan_id]/edit` | Record form | Crisis plan |
| New claim | `/funding/claims/new` | Record form | Claims (client), or All claims when opened without a client |
| Edit claim | `/funding/claims/[claim_id]/edit` | Record form | Claim |
| New funding approval | `/funding/approvals/new` | Record form | Claim |
| Edit funding approval | `/funding/approvals/[approval_id]/edit` | Record form | Funding approval |
| New appointment type | `/settings/appointment-types/new` | Record form | Appointment types |
| Edit appointment type | `/settings/appointment-types/[type_id]/edit` | Record form | Appointment type |
| New report type | `/settings/report-types/new` | Record form | Report types |
| Edit report type | `/settings/report-types/[type_id]/edit` | Record form | Report type |
| New funding approval type | `/funding/approval-types/new` | Record form | Funding approval types |
| Edit funding approval type | `/funding/approval-types/[type_id]/edit` | Record form | Funding approval type |
| New email template | `/settings/email-templates/new` | Record form | Email templates |
| Edit email template | `/settings/email-templates/[template_id]/edit` | Record form | Email templates |

Outside the map: `/` and `/clients/[client_id]/intake-interview` (redirects; the second is to be retired), `/login`, `/q/[token]` (client page, CP).

## Appendix A: Known gaps

This is where the system doesn't match the guide yet. Add a row when a gap is found; delete it when fixed, and note the fix in the Change log. Last checked 28 Nov 2026 against `main` (`618765a`).

**Under ongoing review:** NV (section 13, Navigation). It's checked in every round's review and by the monthly health audit. Any back arrow that lands somewhere unexpected becomes a new parent-memory selftest.

| Rule | Area | Gap | Planned fix |
| --- | --- | --- | --- |
| CP-2 | Scored client questionnaires | PHQ-9, GAD-7 and others still use the old radio-only client page | Move onto the shared client form |
| PH-1, BT-1 | Buttons | The default button is 32 px tall, below the 44 px touch target | Raise the default size |
| AS-1 | Results page | Special layouts for PSF, SAGE-SR (3 reports), PHQ-9 and GAD-7 | Move each onto the shared results view with a summary box |
| PN-4 | Confirmations | `window.confirm` in the history tree, history section and funding approval form | Shared confirm dialog |
| CL-1 | Colours | Three relationship components hard-code hex colours | Use `treeBarColours` |
| PG-1 | Page headers | Dashboard, calendar, communications, three "new" settings pages, assessment new / edit pages | Add the shared headers |
| DT-1 | Dates | About 38 files format dates themselves; three separate `formatDisplayDate` helpers | One date helper in `lib/dates/` |
| PN-1 | Dialogs | 16 dialogs and 4 side panels, chosen without a rule | Review each against PN-1 |
| IV-2, IV-3, IV-5 | Interview trees | Tree headings still have Yes / No / N/A buttons; no tree client suggestions yet | Round AZ |
| AS-6 | Background self-report | Its 42 element keys have no prefix (`sex`, `partner`, `employer`) | Rename to `bsr_` keys in a clean-up round |
| NV-2 | Treatment plan, crisis plan | Record details with no Sub-list above them; default parent is the client for now | To decide with Ben: a versions Sub-list, or allow one-current-record pages under an entity |
| NV-2 | Funding approvals | Hang off a Claim (Record details), not a Sub-list; default parent is the claim for now | To decide with Ben: treat Claim as an entity, or allow a record to own records |
| NV-1 | Professionals, organisations | Entity details with no Sub-lists, unlike Client | To decide with Ben (e.g. clients referred) |
| NV-7 | Background interview | Has its own LRAMP button, but the interview is one assessment in a battery | A battery page that launches each assessment (to design with Ben) |
| NV-7 | Session note | "Schedule appointment" opens the Calendar | Show the next appointment on the note; book in a side panel (mockup first) |

## Appendix B: Change log

One row per change to the guide, newest first. Retired rules are recorded here and never reused.

| Date | Rules | Change | Agreed in |
| --- | --- | --- | --- |
| 28 Nov 2026 | CP-7 | Sheet buttons sit in the content on phones, not a fixed footer | Round AY.4 (phone testing) |
| 28 Nov 2026 | CP-7, FM-1, FM-5 | Client-form people and history entries open in a sheet; Age and Passed away share a line; year they passed away added | Round AY.3 (phone testing) |
| 28 Nov 2026 | NV-2, NV-7, NV-10, 13B | Linked Entity details allowed as parents; links into pages with no back arrow always allowed; Edit form parent when the record has no page; added NV-10 Create and return; 13B parents without a client | Round NV.1 |
| 28 Nov 2026 | NV-1 to NV-9, PG-2 | Added section 13 Navigation: page types, default and allowed parents, one remembered parent per page, back labels, page registry and guard test, page map (13B); PG-2 now points to NV | Chat with Ben |
| 28 Nov 2026 | PH-5, FM-1 | Client-form footer not fixed; radio rows always outlined | Round AY.2 (phone testing) |
| 28 Nov 2026 | GU-2, GU-3 | Committed to the repo as `docs/design-guide.md`; Cursor always-on rule added | Round DG |
| 28 Nov 2026 | AS-6 | Added: element keys are unique across all assessments; new keys take the assessment's prefix | Review of round AY |
| 28 Nov 2026 | All | First version: sections 0–12, rule IDs, Known gaps and Change log | Chat with Ben |
