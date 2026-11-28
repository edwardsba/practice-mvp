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

let partial = emptyInterviewAnswers()
partial = setItemAnswer(partial, "s2_medicare", "yes")
check(
  "status some questions → to answer",
  interviewSectionStatus(section2, partial).status,
  "left"
)
check(
  "unanswered count for section 2",
  unansweredQuestionCount(section2, partial),
  2
)

let s2Ready = emptyInterviewAnswers()
s2Ready = setItemAnswer(s2Ready, "s2_medicare", "yes")
s2Ready = setItemAnswer(s2Ready, "s2_ndis", "no")
s2Ready = setItemAnswer(s2Ready, "s2_insurance", "not_applicable")
check(
  "status all questions answered → ready",
  interviewSectionStatus(section2, s2Ready).status,
  "to_confirm"
)

const done: InterviewAnswersJson = {
  version: 1,
  items: s2Ready.items,
  sections: { "2": { confirmed: true, confirmedAt: "2026-01-01T00:00:00.000Z" } },
}
check("status confirmed → done", interviewSectionStatus(section2, done).status, "done")

// --- Confirm section ---
const refused = confirmSectionAnswers(emptyInterviewAnswers(), 2, {})
assert.equal(refused.ok, false, "confirm refused while questions unanswered")
if (!refused.ok) {
  check("refuse unanswered count", refused.unanswered, 3)
  assert.match(refused.error, /Answer 3 questions first/)
  console.log("ok — refuse error message")
}

const extras = section4ExtraItems({
  answers: emptyInterviewAnswers(),
  emergencyContacts: [{ id: "ec1", label: "Alex" }],
  gpContacts: [{ id: "gp1", label: "Dr GP" }],
  otherMedicalContacts: [{ id: "mc1", label: "Physio" }],
})

let s4 = emptyInterviewAnswers()
s4 = setItemAnswer(s4, "s4_emergency", "yes")
s4 = setItemAnswer(s4, "s4_gp", "no")
s4 = setItemAnswer(s4, "s4_other_professionals", "not_applicable")
const confirmedS4 = confirmSectionAnswers(
  s4,
  4,
  {
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
  check("questions stay confirmed", confirmedS4.answers.items.s4_emergency, {
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
}
const review = prefillAnswersForReview(source)
check("review copies items unconfirmed", review.items.s1_name, {
  value: "confirmed",
  confirmed: false,
})
check("review copies question unconfirmed", review.items.s2_medicare, {
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

console.log("interview-confirm-section.selftest.ts: ok")
