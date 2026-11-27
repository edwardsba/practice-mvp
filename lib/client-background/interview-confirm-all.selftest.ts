import assert from "node:assert/strict"

import {
  confirmAllShownInSection,
  emptyInterviewAnswers,
  section4ExtraItems,
  sectionHasConfirmAllTargets,
  setItemAnswer,
  type InterviewAnswersJson,
} from "@/lib/client-background/interview-answers"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

const extras = section4ExtraItems({
  answers: emptyInterviewAnswers(),
  emergencyContacts: [{ id: "ec1", label: "Alex" }],
  gpContacts: [{ id: "gp1", label: "Dr GP" }],
  otherMedicalContacts: [{ id: "mc1", label: "Physio" }],
})

assert.equal(sectionHasConfirmAllTargets(emptyInterviewAnswers(), 1), true)
assert.equal(sectionHasConfirmAllTargets(emptyInterviewAnswers(), 4, extras), true)

let answers: InterviewAnswersJson = emptyInterviewAnswers()
answers = setItemAnswer(answers, "s1_name", "confirmed")
answers = {
  version: 1,
  items: {
    ...answers.items,
    s1_phone: { value: "confirmed", confirmed: false },
    s1_email: { value: "not_applicable", confirmed: true },
  },
}

const after = confirmAllShownInSection(answers, 1)
check("confirm all sets unanswered cna to confirmed", after.items.s1_preferred_name, {
  value: "confirmed",
  confirmed: true,
})
check("confirm all confirms prefilled cna", after.items.s1_phone, {
  value: "confirmed",
  confirmed: true,
})
check("confirm all leaves already confirmed", after.items.s1_name, {
  value: "confirmed",
  confirmed: true,
})
check("confirm all leaves not_applicable", after.items.s1_email, {
  value: "not_applicable",
  confirmed: true,
})

let s2 = emptyInterviewAnswers()
s2 = setItemAnswer(s2, "s2_medicare", "yes")
s2 = {
  version: 1,
  items: {
    ...s2.items,
    s2_ndis: { value: "no", confirmed: false },
  },
}
const afterS2 = confirmAllShownInSection(s2, 2)
check("confirm all never changes yna yes", afterS2.items.s2_medicare, {
  value: "yes",
  confirmed: true,
})
check("confirm all never changes yna no", afterS2.items.s2_ndis, {
  value: "no",
  confirmed: false,
})
assert.equal(afterS2.items.s2_insurance, undefined, "confirm all does not invent yna answers")

const s4: InterviewAnswersJson = {
  version: 1,
  items: {
    s4_emergency: { value: "yes", confirmed: true },
    [`s4_ec:ec1`]: { value: "confirmed", confirmed: false },
  },
}
const afterS4 = confirmAllShownInSection(s4, 4, extras)
check("confirm all confirms s4_ec prefilled", afterS4.items["s4_ec:ec1"], {
  value: "confirmed",
  confirmed: true,
})
check("confirm all sets unanswered s4_mc", afterS4.items["s4_mc:gp1"], {
  value: "confirmed",
  confirmed: true,
})
check("confirm all sets other s4_mc", afterS4.items["s4_mc:mc1"], {
  value: "confirmed",
  confirmed: true,
})
check("confirm all leaves parent yna", afterS4.items.s4_emergency, {
  value: "yes",
  confirmed: true,
})

const allDone = confirmAllShownInSection(after, 1)
assert.equal(sectionHasConfirmAllTargets(allDone, 1), false, "no targets when all confirmed")

console.log("interview-confirm-all.selftest.ts: ok")
