import assert from "node:assert/strict"

import {
  buildStartAssessmentList,
  chooseTodaysSessionNote,
  startAttachmentLine,
} from "@/lib/assessments/start-list"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

const defs = [
  {
    assessmentCode: "PHQ9",
    assessmentName: "PHQ-9",
    clientCompletable: true,
    practitionerCompletable: true,
    elementCount: 9,
    isActive: true,
  },
  {
    assessmentCode: "LRAMP",
    assessmentName: "Linehan Risk Assessment and Management Protocol (LRAMP)",
    clientCompletable: false,
    practitionerCompletable: true,
    elementCount: 98,
    isActive: true,
  },
  {
    assessmentCode: "mse",
    assessmentName: "Mental Status Examination",
    clientCompletable: false,
    practitionerCompletable: true,
    elementCount: 20,
    isActive: true,
  },
  {
    assessmentCode: "ASQ",
    assessmentName: "ASQ",
    clientCompletable: false,
    practitionerCompletable: true,
    elementCount: 5,
    isActive: true,
  },
  {
    assessmentCode: "EMPTY",
    assessmentName: "Empty",
    clientCompletable: false,
    practitionerCompletable: true,
    elementCount: 0,
    isActive: true,
  },
]

{
  const { practitioner, client } = buildStartAssessmentList(defs)
  check(
    "practitioner codes A–Z: ASQ, LRAMP, mse",
    practitioner.map((r) => r.assessmentCode),
    ["ASQ", "LRAMP", "mse"]
  )
  check(
    "practitioner all enabled",
    practitioner.every((r) => r.enabled),
    true
  )
  check(
    "client section includes PHQ9 disabled",
    client.find((r) => r.assessmentCode === "PHQ9"),
    {
      assessmentCode: "PHQ9",
      assessmentName: "PHQ-9",
      enabled: false,
      section: "client",
    }
  )
  check(
    "empty definitions excluded",
    [...practitioner, ...client].some((r) => r.assessmentCode === "EMPTY"),
    false
  )
}

{
  const today = "2026-11-25"
  check(
    "zero notes → null",
    chooseTodaysSessionNote([], today),
    null
  )
  check(
    "one today note → that note",
    chooseTodaysSessionNote(
      [
        { sessionNoteId: "a", sessionDate: "2026-11-24" },
        { sessionNoteId: "b", sessionDate: today },
      ],
      today
    ),
    { sessionNoteId: "b", sessionDate: today }
  )
  check(
    "two today notes → null",
    chooseTodaysSessionNote(
      [
        { sessionNoteId: "a", sessionDate: today },
        { sessionNoteId: "b", sessionDate: today },
      ],
      today
    ),
    null
  )
  check(
    "attachment line with note",
    startAttachmentLine({ sessionNoteId: "b", sessionDate: today }, today),
    `Will attach to today's session note (${today})`
  )
  check(
    "attachment line without note",
    startAttachmentLine(null, today),
    "Not attached to a session note"
  )
}

console.log("start-list.selftest.ts: ok")
