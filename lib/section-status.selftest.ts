import assert from "node:assert/strict"

import {
  aggregateSectionStatus,
  itemStatus,
  progressChipAriaLabel,
  sectionProgressClass,
  statusPillLabel,
} from "@/lib/section-status"
import { statusColours } from "@/lib/ui/status-colours"
import {
  emptyInterviewAnswers,
  INTERVIEW_SECTIONS,
  interviewSectionStatus,
  setItemAnswer,
} from "@/lib/client-background/interview-answers"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

check("itemStatus left", itemStatus({ hasValue: false, confirmed: false }), "left")
check("itemStatus to_confirm", itemStatus({ hasValue: true, confirmed: false }), "to_confirm")
check("itemStatus done", itemStatus({ hasValue: true, confirmed: true }), "done")

check(
  "assessment-like not_started",
  aggregateSectionStatus([
    { hasValue: false, confirmed: false },
    { hasValue: false, confirmed: false },
  ]),
  { status: "not_started", left: 2, toConfirm: 0, hasDefaults: false }
)

check(
  "assessment-like in progress (left)",
  aggregateSectionStatus([
    { hasValue: true, confirmed: true },
    { hasValue: false, confirmed: false },
  ]),
  { status: "left", left: 1, toConfirm: 0, hasDefaults: false }
)

check(
  "assessment-like to_confirm",
  aggregateSectionStatus([
    { hasValue: true, confirmed: false },
    { hasValue: true, confirmed: false },
  ]),
  { status: "to_confirm", left: 0, toConfirm: 2, hasDefaults: false }
)

check(
  "assessment-like done",
  aggregateSectionStatus([{ hasValue: true, confirmed: true }]),
  { status: "done", left: 0, toConfirm: 0, hasDefaults: false }
)

const section1 = INTERVIEW_SECTIONS[0]
check(
  "interview section not_started",
  interviewSectionStatus(section1, emptyInterviewAnswers()).status,
  "not_started"
)

let partial = emptyInterviewAnswers()
partial = setItemAnswer(partial, "s1_name", "confirmed")
check(
  "interview details-only section with a detail touched → ready to confirm",
  interviewSectionStatus(section1, partial).status,
  "to_confirm"
)

const section2 = INTERVIEW_SECTIONS[1]
const section2Partial = setItemAnswer(emptyInterviewAnswers(), "s2_medicare", "yes")
check("interview section with questions left → left", interviewSectionStatus(section2, section2Partial), {
  groupLabel: section2.id,
  letter: "2",
  title: section2.title,
  status: "left",
  left: 2,
  toConfirm: 0,
  clientChanges: 0,
  hasDefaults: false,
})

const toConfirmAnswers = {
  version: 1 as const,
  items: Object.fromEntries(
    section1.items.map((item) => [item.key, { value: "confirmed" as const, confirmed: false }])
  ),
  sections: {},
  clientDecisions: {},
}
check(
  "interview section to_confirm",
  interviewSectionStatus(section1, toConfirmAnswers).status,
  "to_confirm"
)

const itemsConfirmed = {
  version: 1 as const,
  items: Object.fromEntries(
    section1.items.map((item) => [item.key, { value: "confirmed" as const, confirmed: true }])
  ),
  sections: {},
  clientDecisions: {},
}
check(
  "interview section needs Confirm section to be done",
  interviewSectionStatus(section1, itemsConfirmed).status,
  "to_confirm"
)
const doneAnswers = {
  ...itemsConfirmed,
  sections: { "1": { confirmed: true as const, confirmedAt: "2026-11-27T00:00:00.000Z" } },
}
check("interview section done", interviewSectionStatus(section1, doneAnswers).status, "done")

check("pill not started", statusPillLabel({ status: "not_started", left: 3, toConfirm: 0, hasDefaults: false }), "Not started")
check("pill left", statusPillLabel({ status: "left", left: 2, toConfirm: 0, hasDefaults: false }), "2 to answer")
check(
  "pill to confirm",
  statusPillLabel({ status: "to_confirm", left: 0, toConfirm: 4, hasDefaults: false }),
  "4 to confirm"
)
check(
  "pill ready to confirm",
  statusPillLabel({ status: "to_confirm", left: 0, toConfirm: 0, hasDefaults: false }),
  "Ready to confirm"
)
check("pill done", statusPillLabel({ status: "done", left: 0, toConfirm: 0, hasDefaults: false }), "Done")
check(
  "pill client changes (plural)",
  statusPillLabel({ status: "to_confirm", left: 0, toConfirm: 0, clientChanges: 2, hasDefaults: false }),
  "2 client changes"
)
check(
  "pill client change (singular)",
  statusPillLabel({ status: "to_confirm", left: 0, toConfirm: 0, clientChanges: 1, hasDefaults: false }),
  "1 client change"
)

const section3 = INTERVIEW_SECTIONS.find((section) => section.number === 3)!
const section7 = INTERVIEW_SECTIONS.find((section) => section.number === 7)!
const section3Answered = setItemAnswer(
  setItemAnswer(emptyInterviewAnswers(), "s3_disability", "no"),
  "s3_financial",
  "no"
)
const s3Waiting = interviewSectionStatus(section3, section3Answered, [], { waitingClientChanges: 2 })
check("questions done + waiting client fields → to_confirm", s3Waiting.status, "to_confirm")
check("questions done + waiting → pill N client changes", statusPillLabel(s3Waiting), "2 client changes")
const s3Unanswered = interviewSectionStatus(section3, emptyInterviewAnswers(), [], { waitingClientChanges: 2 })
check("questions left wins over client changes", statusPillLabel(s3Unanswered), "2 to answer")
check("client changes only count once questions are done", s3Unanswered.clientChanges, 0)
const s7Waiting = interviewSectionStatus(section7, emptyInterviewAnswers(), [], { waitingClientChanges: 1 })
check("details-only section with a waiting client field is started", s7Waiting.status, "to_confirm")
check("details-only section pill shows the client change", statusPillLabel(s7Waiting), "1 client change")
assert.match(progressChipAriaLabel(s7Waiting), /1 client change/)
console.log("ok — chip aria-label includes client changes")

assert.equal(
  sectionProgressClass({ status: "not_started" }),
  statusColours.neutral.chip,
  "not_started uses neutral chip"
)
assert.equal(
  sectionProgressClass({ status: "left" }),
  statusColours.attention.chip,
  "left uses attention chip"
)
assert.equal(
  sectionProgressClass({ status: "to_confirm" }),
  statusColours.attention.chip,
  "to_confirm uses attention chip"
)
assert.equal(
  sectionProgressClass({ status: "done" }),
  statusColours.done.chip,
  "done uses done chip"
)

const aria = progressChipAriaLabel({
  groupLabel: "contact",
  letter: "1",
  title: "Contact details",
  status: "not_started",
  left: 7,
  toConfirm: 0,
  hasDefaults: false,
})
assert.match(aria, /not started/)
console.log("ok — progressChipAriaLabel includes not started")

console.log("section-status.selftest.ts: ok")
