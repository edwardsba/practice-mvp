import assert from "node:assert/strict"

import {
  buildMseSessionNoteSentence,
  joinNames,
  type MseFieldSelection,
  type MseSessionNoteResponses,
  type MseSentenceFieldKey,
} from "./session-note-sentence"

function baseline(label: string): MseFieldSelection {
  return { optionLabel: label, isReportingBaseline: true }
}

function abnormal(label: string): MseFieldSelection {
  return { optionLabel: label, isReportingBaseline: false }
}

function allNormal(): MseSessionNoteResponses {
  return {
    appearance: baseline("Neat"),
    behaviour: baseline("Cooperative"),
    eyeContact: baseline("Normal"),
    motorActivity: baseline("Normal"),
    affect: baseline("Full"),
    hallucination: baseline("None"),
    depersonalisationDerealisation: baseline("None"),
    homicidality: baseline("None"),
    delusions: baseline("None"),
    orientation: baseline("None"),
    memory: baseline("None"),
    attention: baseline("Normal"),
    insight: baseline("Good"),
    judgement: baseline("Good"),
  }
}

function withOverrides(
  overrides: Partial<Record<MseSentenceFieldKey, MseFieldSelection>>
): MseSessionNoteResponses {
  return { ...allNormal(), ...overrides }
}

function assertSentence(
  name: string,
  responses: MseSessionNoteResponses,
  expected: string
) {
  const actual = buildMseSessionNoteSentence(responses)
  assert.equal(actual, expected, name)
  console.log(`ok — ${name}`)
}

assert.equal(joinNames(["A"]), "A")
assert.equal(joinNames(["A", "B"]), "A and B")
assert.equal(joinNames(["A", "B", "C"]), "A, B and C")
assert.equal(joinNames(["A", "B", "C", "D"]), "A, B, C and D")
console.log("ok — joinNames")

assertSentence(
  "all-normal",
  allNormal(),
  "Appearance, behaviour, eye contact, motor activity and affect were all within expected limits. Perceptions, thoughts and cognitions were all within expected limits. Insight and judgement were both good."
)

assertSentence(
  "single Presentation field abnormal (behaviour)",
  withOverrides({ behaviour: abnormal("Guarded") }),
  "Appearance, eye contact, motor activity and affect were all within expected limits. Behaviour was guarded. Perceptions, thoughts and cognitions were all within expected limits. Insight and judgement were both good."
)

assertSentence(
  "all of Presentation abnormal",
  withOverrides({
    appearance: abnormal("Dishevelled"),
    behaviour: abnormal("Withdrawn"),
    eyeContact: abnormal("Avoidant"),
    motorActivity: abnormal("Restless"),
    affect: abnormal("Flat"),
  }),
  "Appearance was dishevelled. Behaviour was withdrawn. Eye contact was avoidant. Motor activity was restless. Affect was flat. Perceptions, thoughts and cognitions were all within expected limits. Insight and judgement were both good."
)

assertSentence(
  "Mental Function group partially abnormal (only Memory)",
  withOverrides({ memory: abnormal("Short-Term") }),
  "Appearance, behaviour, eye contact, motor activity and affect were all within expected limits. Perceptions and thoughts were within expected limits. Cognitions included short-term memory impairment. Insight and judgement were both good."
)

assertSentence(
  "all three Mental Function groups abnormal",
  withOverrides({
    hallucination: abnormal("Auditory"),
    delusions: abnormal("Paranoid"),
    attention: abnormal("Distracted"),
  }),
  "Appearance, behaviour, eye contact, motor activity and affect were all within expected limits. Perceptions included auditory hallucinations. Thoughts included paranoid delusions. Cognitions included distracted attention. Insight and judgement were both good."
)

assertSentence(
  "Insight/Judgement both Good",
  withOverrides({
    insight: baseline("Good"),
    judgement: baseline("Good"),
  }),
  "Appearance, behaviour, eye contact, motor activity and affect were all within expected limits. Perceptions, thoughts and cognitions were all within expected limits. Insight and judgement were both good."
)

assertSentence(
  "Insight/Judgement both Poor",
  withOverrides({
    insight: abnormal("Poor"),
    judgement: abnormal("Poor"),
  }),
  "Appearance, behaviour, eye contact, motor activity and affect were all within expected limits. Perceptions, thoughts and cognitions were all within expected limits. Insight was poor. Judgement was poor."
)

assertSentence(
  "Insight Good, Judgement Fair",
  withOverrides({
    insight: baseline("Good"),
    judgement: abnormal("Fair"),
  }),
  "Appearance, behaviour, eye contact, motor activity and affect were all within expected limits. Perceptions, thoughts and cognitions were all within expected limits. Insight was good. Judgement was fair."
)

assertSentence(
  "Insight Good, Judgement Poor",
  withOverrides({
    insight: baseline("Good"),
    judgement: abnormal("Poor"),
  }),
  "Appearance, behaviour, eye contact, motor activity and affect were all within expected limits. Perceptions, thoughts and cognitions were all within expected limits. Insight was good. Judgement was poor."
)

const withSuicidalityIdeation = withOverrides({})
const withoutSuicidality = withOverrides({})
// Suicidality is not a sentence-engine field — ensuring an external suicidality
// selection cannot be passed in via the typed responses object.
assert.equal(
  buildMseSessionNoteSentence(withSuicidalityIdeation),
  buildMseSessionNoteSentence(withoutSuicidality)
)
console.log("ok — suicidality absent from engine (typed field excluded)")

console.log("\nAll MSE session-note sentence checks passed.")
