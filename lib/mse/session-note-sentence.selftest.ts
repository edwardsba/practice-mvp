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
    suicidality: baseline("None"),
    orientation: baseline("Fully oriented"),
    memory: baseline("Intact"),
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
  "Mental Function group partially abnormal (only Memory, new label)",
  withOverrides({ memory: abnormal("Short-term impaired") }),
  "Appearance, behaviour, eye contact, motor activity and affect were all within expected limits. Perceptions and thoughts were within expected limits. Cognitions included short-term memory impairment. Insight and judgement were both good."
)

assertSentence(
  "legacy Memory Short-Term still maps",
  withOverrides({ memory: abnormal("Short-Term") }),
  "Appearance, behaviour, eye contact, motor activity and affect were all within expected limits. Perceptions and thoughts were within expected limits. Cognitions included short-term memory impairment. Insight and judgement were both good."
)

assertSentence(
  "new Orientation label",
  withOverrides({
    orientation: abnormal("Disoriented to time and place"),
  }),
  "Appearance, behaviour, eye contact, motor activity and affect were all within expected limits. Perceptions and thoughts were within expected limits. Cognitions included disorientation to time and place. Insight and judgement were both good."
)

assertSentence(
  "legacy Orientation Time still maps",
  withOverrides({ orientation: abnormal("Time") }),
  "Appearance, behaviour, eye contact, motor activity and affect were all within expected limits. Perceptions and thoughts were within expected limits. Cognitions included disorientation to time. Insight and judgement were both good."
)

assertSentence(
  "short- and long-term memory impairment",
  withOverrides({
    memory: abnormal("Short- and long-term impaired"),
  }),
  "Appearance, behaviour, eye contact, motor activity and affect were all within expected limits. Perceptions and thoughts were within expected limits. Cognitions included short- and long-term memory impairment. Insight and judgement were both good."
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
  "Suicidality Ideation",
  withOverrides({ suicidality: abnormal("Ideation") }),
  "Appearance, behaviour, eye contact, motor activity and affect were all within expected limits. Perceptions and cognitions were within expected limits. Thoughts included suicidal ideation. Insight and judgement were both good."
)

assertSentence(
  "Suicidality Plan",
  withOverrides({ suicidality: abnormal("Plan") }),
  "Appearance, behaviour, eye contact, motor activity and affect were all within expected limits. Perceptions and cognitions were within expected limits. Thoughts included a suicide plan. Insight and judgement were both good."
)

assertSentence(
  "Suicidality Intent",
  withOverrides({ suicidality: abnormal("Intent") }),
  "Appearance, behaviour, eye contact, motor activity and affect were all within expected limits. Perceptions and cognitions were within expected limits. Thoughts included suicidal intent. Insight and judgement were both good."
)

assertSentence(
  "Suicidality Self-Harm",
  withOverrides({ suicidality: abnormal("Self-Harm") }),
  "Appearance, behaviour, eye contact, motor activity and affect were all within expected limits. Perceptions and cognitions were within expected limits. Thoughts included self-harm. Insight and judgement were both good."
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

console.log("\nAll MSE session-note sentence checks passed.")
