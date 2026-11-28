import assert from "node:assert/strict"

import {
  confirmSectionAnswers,
  emptyInterviewAnswers,
  INTERVIEW_SECTIONS,
  interviewSectionStatus,
  prefillAnswersForReview,
  sanitizeInterviewAnswers,
  section4ExtraItems,
  setItemAnswer,
  unansweredQuestionCount,
  type InterviewAnswersJson,
} from "@/lib/client-background/interview-answers"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

const section1 = INTERVIEW_SECTIONS.find((s) => s.number === 1)!
const section2 = INTERVIEW_SECTIONS.find((s) => s.number === 2)!
const section4 = INTERVIEW_SECTIONS.find((s) => s.number === 4)!
const section5 = INTERVIEW_SECTIONS.find((s) => s.number === 5)!

// --- Section status ---
check(
  "status not started",
  interviewSectionStatus(section1, emptyInterviewAnswers()).status,
  "not_started"
)

const prefilledDetails: InterviewAnswersJson = {
  version: 1,
  items: Object.fromEntries(
    section1.items.map((item) => [item.key, { value: "confirmed" as const, confirmed: false }])
  ),
  sections: {},
  clientDecisions: {},
}
check(
  "status pre-filled details → ready to confirm",
  interviewSectionStatus(section1, prefilledDetails).status,
  "to_confirm"
)
check(
  "pill ready uses toConfirm 0",
  interviewSectionStatus(section1, prefilledDetails).toConfirm,
  0
)

// Section 2 is all presence details — Confirm available (unanswered 0); pill not started until touched
check(
  "section 2 empty → not started (no questions to answer)",
  interviewSectionStatus(section2, emptyInterviewAnswers()).status,
  "not_started"
)
check(
  "section 2 unanswered questions",
  unansweredQuestionCount(section2, emptyInterviewAnswers()),
  0
)
check(
  "section 2 left is 0 so Confirm is available",
  interviewSectionStatus(section2, emptyInterviewAnswers()).left,
  0
)

const s2Presence: InterviewAnswersJson = {
  version: 1,
  items: {
    s2_medicare: { value: "yes", confirmed: true },
    s2_ndis: { value: "not_applicable", confirmed: true },
    s2_insurance: { value: "not_applicable", confirmed: true },
  },
  sections: {},
  clientDecisions: {},
}
check(
  "section 2 items signed but section not → ready",
  interviewSectionStatus(section2, s2Presence).status,
  "to_confirm"
)

const done: InterviewAnswersJson = {
  version: 1,
  items: s2Presence.items,
  sections: { "2": { confirmed: true, confirmedAt: "2026-01-01T00:00:00.000Z" } },
  clientDecisions: {},
}
check("status confirmed → done", interviewSectionStatus(section2, done).status, "done")

// Tree section still refuses while questions unanswered
const refusedTree = confirmSectionAnswers(emptyInterviewAnswers(), 5, {})
assert.equal(refusedTree.ok, false, "confirm refused while tree questions unanswered")
if (!refusedTree.ok) {
  check("refuse unanswered count", refusedTree.unanswered, 3)
  assert.match(refusedTree.error, /Answer 3 questions first/)
  console.log("ok — refuse error message")
}

// Section 2 confirms immediately; presence from data
const confirmedS2 = confirmSectionAnswers(
  emptyInterviewAnswers(),
  2,
  { s2_medicare: true, s2_ndis: false, s2_insurance: false },
  [],
  "2026-06-01T12:00:00.000Z"
)
assert.equal(confirmedS2.ok, true, "section 2 confirms with no questions")
if (confirmedS2.ok) {
  check("s2 medicare → yes", confirmedS2.answers.items.s2_medicare, {
    value: "yes",
    confirmed: true,
  })
  check("s2 ndis empty → n/a", confirmedS2.answers.items.s2_ndis, {
    value: "not_applicable",
    confirmed: true,
  })
}

const extras = section4ExtraItems({
  answers: emptyInterviewAnswers(),
  emergencyContacts: [{ id: "ec1", label: "Alex" }],
  gpContacts: [{ id: "gp1", label: "Dr GP" }],
  otherMedicalContacts: [{ id: "mc1", label: "Physio" }],
})

const confirmedS4 = confirmSectionAnswers(
  emptyInterviewAnswers(),
  4,
  {
    s4_emergency: true,
    s4_gp: false,
    s4_other_professionals: true,
    "s4_ec:ec1": true,
    "s4_mc:gp1": false,
    "s4_mc:mc1": true,
  },
  extras,
  "2026-06-01T12:00:00.000Z"
)
assert.equal(confirmedS4.ok, true, "confirm section 4 ok")
if (confirmedS4.ok) {
  check("details with value → confirmed", confirmedS4.answers.items["s4_ec:ec1"], {
    value: "confirmed",
    confirmed: true,
  })
  check("details empty → not_applicable", confirmedS4.answers.items["s4_mc:gp1"], {
    value: "not_applicable",
    confirmed: true,
  })
  check("other details with value", confirmedS4.answers.items["s4_mc:mc1"], {
    value: "confirmed",
    confirmed: true,
  })
  check("sections[4] set", confirmedS4.answers.sections["4"], {
    confirmed: true,
    confirmedAt: "2026-06-01T12:00:00.000Z",
  })
  check("presence emergency → yes from data", confirmedS4.answers.items.s4_emergency, {
    value: "yes",
    confirmed: true,
  })
  check("presence gp empty → n/a", confirmedS4.answers.items.s4_gp, {
    value: "not_applicable",
    confirmed: true,
  })
  check("presence other → yes", confirmedS4.answers.items.s4_other_professionals, {
    value: "yes",
    confirmed: true,
  })
  check(
    "section 4 with per-record rows → done",
    interviewSectionStatus(section4, confirmedS4.answers, extras).status,
    "done"
  )
}

const confirmedS1 = confirmSectionAnswers(
  emptyInterviewAnswers(),
  1,
  { s1_name: true, s1_phone: false },
  [],
  "2026-06-01T12:00:00.000Z"
)
assert.equal(confirmedS1.ok, true, "section 1 (no questions) confirms")
if (confirmedS1.ok) {
  check("s1_name from presence", confirmedS1.answers.items.s1_name, {
    value: "confirmed",
    confirmed: true,
  })
  check("s1_phone empty → n/a", confirmedS1.answers.items.s1_phone, {
    value: "not_applicable",
    confirmed: true,
  })
}

// Tree section still needs questions answered
let s5 = emptyInterviewAnswers()
s5 = setItemAnswer(s5, "s5_current", "yes")
s5 = setItemAnswer(s5, "s5_previous", "no")
s5 = setItemAnswer(s5, "s5_children", "not_applicable")
check(
  "section 5 all questions answered → ready",
  interviewSectionStatus(section5, s5).status,
  "to_confirm"
)

// --- Review prefill ---
const source: InterviewAnswersJson = {
  version: 1,
  items: {
    s1_name: { value: "confirmed", confirmed: true },
    s2_medicare: { value: "yes", confirmed: true },
    "s4_ec:live": { value: "confirmed", confirmed: true },
  },
  sections: {
    "1": { confirmed: true, confirmedAt: "2026-01-01T00:00:00.000Z" },
    "2": { confirmed: true, confirmedAt: "2026-01-01T00:00:00.000Z" },
  },
  clientDecisions: {},
}
const review = prefillAnswersForReview(source)
check("review copies items unconfirmed", review.items.s1_name, {
  value: "confirmed",
  confirmed: false,
})
check("review copies presence unconfirmed", review.items.s2_medicare, {
  value: "yes",
  confirmed: false,
})
check("review does not copy sections", review.sections, {})

const sanitized = sanitizeInterviewAnswers({
  version: 1,
  items: { s2_ndis: { value: "no", confirmed: true } },
  sections: {
    "2": { confirmed: true, confirmedAt: "2026-02-02T00:00:00.000Z" },
    "99": { confirmed: true, confirmedAt: "x" },
  },
})
check("sanitize keeps section 2", sanitized.sections["2"], {
  confirmed: true,
  confirmedAt: "2026-02-02T00:00:00.000Z",
})
check("sanitize drops bad section key", sanitized.sections["99"], undefined)
check("sanitize keeps legacy presence no", sanitized.items.s2_ndis, {
  value: "no",
  confirmed: true,
})

console.log("interview-confirm-section.selftest.ts: ok")
