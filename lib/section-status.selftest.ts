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
check("interview section in progress", interviewSectionStatus(section1, partial).status, "left")

const toConfirmAnswers = {
  version: 1 as const,
  items: Object.fromEntries(
    section1.items.map((item) => [item.key, { value: "confirmed" as const, confirmed: false }])
  ),
}
check(
  "interview section to_confirm",
  interviewSectionStatus(section1, toConfirmAnswers).status,
  "to_confirm"
)

const doneAnswers = {
  version: 1 as const,
  items: Object.fromEntries(
    section1.items.map((item) => [item.key, { value: "confirmed" as const, confirmed: true }])
  ),
}
check("interview section done", interviewSectionStatus(section1, doneAnswers).status, "done")

check("pill not started", statusPillLabel({ status: "not_started", left: 3, toConfirm: 0, hasDefaults: false }), "Not started")
check("pill left", statusPillLabel({ status: "left", left: 2, toConfirm: 0, hasDefaults: false }), "2 left")
check(
  "pill to confirm",
  statusPillLabel({ status: "to_confirm", left: 0, toConfirm: 4, hasDefaults: false }),
  "4 to confirm"
)
check("pill done", statusPillLabel({ status: "done", left: 0, toConfirm: 0, hasDefaults: false }), "Done")

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
