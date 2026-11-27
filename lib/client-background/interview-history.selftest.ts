import assert from "node:assert/strict"

import {
  HISTORY_QUESTION_GROUPS,
  HISTORY_QUESTION_KEYS,
  HISTORY_QUESTIONS,
  answeredInterviewCount,
  backgroundInterviewSourceLine,
  historyQuestionKeyForEvent,
  interviewAnswerTotal,
  unansweredInterviewLabels,
  type HistoryQuestionKey,
} from "@/lib/client-background/interview-history"
import {
  emptyEvent,
  emptyStressors,
  type EventRecord,
  type EventType,
  type HistoryIssue,
  type StressorsRecord,
} from "@/lib/client-background/types"

const BIRTH = "2000-06-15"

function entry(
  eventType: EventType,
  partial: Partial<EventRecord> = {}
): Pick<EventRecord, "eventType" | "about" | "startPrecision" | "startValue" | "conditionGroupId" | "parentEventId"> {
  return { ...emptyEvent(eventType, 0), ...partial }
}

const expected: { key: HistoryQuestionKey; event: ReturnType<typeof entry> }[] = [
  { key: "emotional_problems", event: entry("emotional_problems", { about: "self" }) },
  { key: "self_harm", event: entry("self_harm", { about: "self" }) },
  { key: "substance_use", event: entry("substance_use", { about: "self" }) },
  { key: "illness_injury", event: entry("illness_injury", { about: "self" }) },
  { key: "traumatic_events", event: entry("traumatic_event", { about: "self" }) },
  {
    key: "other_significant_events",
    event: entry("significant_history", { about: "self", startPrecision: "date", startValue: "2018-06-14" }),
  },
  // Unlinked treatments are not a screening category — they fall to significant events.
  {
    key: "other_significant_events",
    event: entry("psychiatric_admission", { about: "self" }),
  },
  {
    key: "family_emotional_problems",
    event: entry("family_events", { about: "significant_other", startPrecision: "date", startValue: "2010-01-01" }),
  },
  { key: "family_emotional_problems", event: entry("emotional_problems", { about: "significant_other" }) },
  { key: "family_self_harm", event: entry("self_harm", { about: "significant_other" }) },
  { key: "family_substance_use", event: entry("substance_use", { about: "significant_other" }) },
  { key: "family_illness", event: entry("illness_injury", { about: "significant_other" }) },
  { key: "family_significant_events", event: entry("significant_history", { about: "significant_other" }) },
]

for (const item of expected) {
  const key = historyQuestionKeyForEvent(item.event, BIRTH)
  assert.equal(key, item.key, `${item.event.eventType} → ${item.key}`)
}

assert.equal("other_treatment" in HISTORY_QUESTIONS, false)
assert.deepEqual(
  HISTORY_QUESTION_GROUPS.map((group) => ({ title: group.title, keys: [...group.keys] })),
  [
    {
      title: "Client history",
      keys: [
        "illness_injury",
        "substance_use",
        "emotional_problems",
        "self_harm",
        "traumatic_events",
        "other_significant_events",
      ],
    },
    {
      title: "Significant other history",
      keys: [
        "family_illness",
        "family_substance_use",
        "family_emotional_problems",
        "family_self_harm",
        "family_significant_events",
      ],
    },
  ]
)

const issues: HistoryIssue[] = [
  {
    issueId: "i1",
    category: "emotional_problems",
    about: "self",
    relationshipRecordId: null,
    aboutOther: "",
    title: "Depression",
    treatmentAnswer: "",
    displayOrder: 0,
  },
]

const gaps = unansweredInterviewLabels({}, [], null, emptyStressors(), issues)
assert.deepEqual(gaps.slice(0, 3), ["Physical health", "Substance use", "Mental health"])
assert.equal(gaps.includes("Other treatment not linked to an issue"), false)
assert.equal(gaps.includes("Treatment (Depression)"), false)
assert.ok(gaps.includes("Significant events"))
assert.equal(gaps.includes("Hospital admission"), false)
assert.equal(gaps.includes("Medication"), false)
assert.equal(gaps.includes("Previous therapy"), false)
assert.equal(gaps.at(-1), "Legal matters, police or accidents")
assert.equal(gaps.length, HISTORY_QUESTION_KEYS.length + 9)

const answeredStressors: StressorsRecord = { ...emptyStressors(), family: "yes", financial: "no" }
const remaining = unansweredInterviewLabels({}, [], null, answeredStressors, [])
assert.equal(remaining[0], "Physical health")
assert.equal(remaining.includes("Family"), false)
assert.equal(remaining.includes("Financial"), false)
assert.ok(remaining.includes("Social life"))
assert.equal(interviewAnswerTotal(0), HISTORY_QUESTION_KEYS.length + 9)
assert.equal(interviewAnswerTotal(2), HISTORY_QUESTION_KEYS.length + 9)
assert.equal(answeredInterviewCount({}, [], null, emptyStressors(), []), 0)
assert.equal(answeredInterviewCount({ emotional_problems: "yes" }, [], null, emptyStressors(), []), 1)
assert.equal(
  answeredInterviewCount({}, [], null, answeredStressors, []),
  interviewAnswerTotal(0) - remaining.length
)
assert.equal(backgroundInterviewSourceLine(null), "No background interview yet.")
assert.equal(
  backgroundInterviewSourceLine({ status: "in_progress", dateLabel: "25 Oct 2026", screening: {} }),
  "Yes / No / Not asked answers are from the background interview of 25 Oct 2026 (in progress). Change them in the interview."
)

console.log("background interview history selftest passed")
