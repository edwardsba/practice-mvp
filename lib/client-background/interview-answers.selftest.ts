import assert from "node:assert/strict"

import {
  applyNothingToRecord,
  blockAnswersFromInterview,
  emptyInterviewAnswers,
  interviewItemStatus,
  interviewSectionStatus,
  INTERVIEW_SECTIONS,
  mirrorBlockValue,
  mirrorScreeningValue,
  prefillAnswersForReview,
  screeningFromInterviewAnswers,
  setItemAnswer,
  type InterviewAnswersJson,
} from "@/lib/client-background/interview-answers"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

check("empty item → left", interviewItemStatus(undefined), "left")
check(
  "unconfirmed value → to_confirm",
  interviewItemStatus({ value: "yes", confirmed: false }),
  "to_confirm"
)
check("confirmed value → done", interviewItemStatus({ value: "yes", confirmed: true }), "done")

const section1 = INTERVIEW_SECTIONS[0]
const empty = emptyInterviewAnswers()
check("empty section → left with all items", interviewSectionStatus(section1, empty).status, "left")
check("empty section left count", interviewSectionStatus(section1, empty).left, section1.items.length)

const prefilled: InterviewAnswersJson = {
  version: 1,
  items: Object.fromEntries(section1.items.map((item) => [item.key, { value: "confirmed" as const, confirmed: false }])),
}
check("all to confirm → to_confirm", interviewSectionStatus(section1, prefilled).status, "to_confirm")
check("to confirm count", interviewSectionStatus(section1, prefilled).toConfirm, section1.items.length)

const mixed: InterviewAnswersJson = {
  version: 1,
  items: {
    [section1.items[0].key]: { value: "confirmed", confirmed: true },
  },
}
check("any left wins over to_confirm", interviewSectionStatus(section1, mixed).status, "left")

const done: InterviewAnswersJson = {
  version: 1,
  items: Object.fromEntries(section1.items.map((item) => [item.key, { value: "confirmed" as const, confirmed: true }])),
}
check("all confirmed → done", interviewSectionStatus(section1, done).status, "done")

const section4 = INTERVIEW_SECTIONS.find((s) => s.number === 4)!
const partial: InterviewAnswersJson = {
  version: 1,
  items: {
    s4_emergency: { value: "yes", confirmed: true },
  },
}
const afterNothing = applyNothingToRecord(partial, 4)
check("nothing to record keeps existing", afterNothing.items.s4_emergency, {
  value: "yes",
  confirmed: true,
})
check("nothing to record fills unanswered", afterNothing.items.s4_gp, {
  value: "not_applicable",
  confirmed: true,
})
check("nothing to record fills remaining", afterNothing.items.s4_other_professionals, {
  value: "not_applicable",
  confirmed: true,
})
assert.equal(section4.items.length, 3)

const source: InterviewAnswersJson = {
  version: 1,
  items: {
    s1_name: { value: "confirmed", confirmed: true },
    s8_emotional_problems: { value: "yes", confirmed: true },
  },
}
const review = prefillAnswersForReview(source)
check("review prefill copies values with confirmed false", review, {
  version: 1,
  items: {
    s1_name: { value: "confirmed", confirmed: false },
    s8_emotional_problems: { value: "yes", confirmed: false },
  },
})

const tapped = setItemAnswer(
  { version: 1, items: { s2_medicare: { value: "yes", confirmed: false } } },
  "s2_medicare",
  "yes"
)
check("tapping same answer confirms", tapped.items.s2_medicare, { value: "yes", confirmed: true })

check("screening mirror yes", mirrorScreeningValue("yes"), "yes")
check("screening mirror no", mirrorScreeningValue("no"), "no")
check("screening mirror not_applicable → no", mirrorScreeningValue("not_applicable"), "no")
check("screening mirror confirmed ignored", mirrorScreeningValue("confirmed"), null)

check("block mirror yes", mirrorBlockValue("yes"), "yes")
check("block mirror no → none", mirrorBlockValue("no"), "none")
check("block mirror not_applicable → none", mirrorBlockValue("not_applicable"), "none")
check("block mirror unanswered", mirrorBlockValue(undefined), "")

const withHistory: InterviewAnswersJson = {
  version: 1,
  items: {
    s8_emotional_problems: { value: "yes", confirmed: true },
    s8_substance_use: { value: "not_applicable", confirmed: true },
    s9_family_emotional_problems: { value: "no", confirmed: true },
    s5_previous: { value: "yes", confirmed: true },
    s6_parents_other: { value: "not_applicable", confirmed: true },
    s6_caregiver: { value: "no", confirmed: true },
  },
}
check("screeningFromInterviewAnswers mapping", screeningFromInterviewAnswers(withHistory), {
  emotional_problems: "yes",
  substance_use: "no",
  family_emotional_problems: "no",
})
check("blockAnswersFromInterview mapping", blockAnswersFromInterview(withHistory), {
  previousRelationships: "yes",
  motherOtherRelationships: "none",
  fatherOtherRelationships: "none",
  caregiverArrangements: "none",
})

console.log("\ninterview-answers.selftest.ts: ok")
