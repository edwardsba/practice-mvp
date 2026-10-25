import assert from "node:assert/strict"

import {
  HISTORY_QUESTION_KEYS,
  INTERVIEW_ANSWER_TOTAL,
  answeredInterviewCount,
  backgroundInterviewSourceLine,
  historyQuestionKeyForEvent,
  unansweredInterviewLabels,
  type HistoryQuestionKey,
} from "@/lib/client-background/interview-history"
import {
  emptyEvent,
  emptyMedication,
  emptyStressors,
  type EventRecord,
  type EventType,
  type MedicationRecord,
  type StressorsRecord,
} from "@/lib/client-background/types"

const BIRTH = "2000-06-15"

function entry(
  eventType: EventType,
  partial: Partial<EventRecord> = {}
): Pick<EventRecord, "eventType" | "attribution" | "startPrecision" | "startValue"> {
  return { ...emptyEvent(eventType, 0), ...partial }
}

const expected: { key: HistoryQuestionKey; event: ReturnType<typeof entry> }[] = [
  { key: "emotional_problems", event: entry("emotional_problems", { attribution: "self" }) },
  { key: "self_harm", event: entry("self_harm", { attribution: "self" }) },
  { key: "substance_use", event: entry("substance_use", { attribution: "self" }) },
  { key: "psychiatric_admission", event: entry("psychiatric_admission", { attribution: "self" }) },
  { key: "previous_therapy", event: entry("previous_therapy", { attribution: "self" }) },
  { key: "illness_injury", event: entry("illness_injury", { attribution: "self" }) },
  {
    key: "childhood_events",
    event: entry("significant_history", { attribution: "self", startPrecision: "date", startValue: "2018-06-14" }),
  },
  {
    key: "childhood_events",
    event: entry("family_events", { attribution: "self_linked", startPrecision: "date", startValue: "2010-01-01" }),
  },
  {
    key: "other_significant_events",
    event: entry("significant_history", { attribution: "self", startPrecision: "", startValue: "" }),
  },
  {
    key: "other_significant_events",
    event: entry("significant_history", { attribution: "self", startPrecision: "date", startValue: "2018-06-15" }),
  },
  {
    key: "other_significant_events",
    event: entry("family_events", { attribution: "family", startPrecision: "date", startValue: "2020-01-01" }),
  },
  { key: "abuse", event: entry("abuse", { attribution: "self" }) },
  { key: "family_emotional_problems", event: entry("emotional_problems", { attribution: "family" }) },
  { key: "family_self_harm", event: entry("self_harm", { attribution: "family" }) },
  { key: "family_substance_use", event: entry("substance_use", { attribution: "family" }) },
  { key: "family_psychiatric_admission", event: entry("psychiatric_admission", { attribution: "family" }) },
  { key: "family_illness", event: entry("illness_injury", { attribution: "family" }) },
  { key: "family_significant_events", event: entry("significant_history", { attribution: "family" }) },
  { key: "family_significant_events", event: entry("previous_therapy", { attribution: "family" }) },
]

const seen = new Set<HistoryQuestionKey>()
for (const item of expected) {
  const key = historyQuestionKeyForEvent(item.event, BIRTH)
  assert.equal(key, item.key)
  seen.add(key)
}

assert.equal(seen.size, HISTORY_QUESTION_KEYS.length)

const gaps = unansweredInterviewLabels({}, [], null, emptyMedication(), emptyStressors())
assert.equal(gaps[0], "Emotional problems")
assert.equal(gaps.at(-1), "Legal matters, police or accidents")
assert.ok(gaps.includes("Currently taking medication"))
assert.equal(gaps.filter((label) => label === "Family").length, 1)
assert.equal(gaps.length, HISTORY_QUESTION_KEYS.length + 1 + 9)

const answeredMedication: MedicationRecord = { ...emptyMedication(), currentlyTaking: "not_asked" }
const answeredStressors: StressorsRecord = { ...emptyStressors(), family: "yes", financial: "no" }
const remaining = unansweredInterviewLabels({}, [], null, answeredMedication, answeredStressors)
assert.equal(remaining.includes("Currently taking medication"), false)
assert.equal(remaining.includes("Family"), false)
assert.equal(remaining.includes("Financial"), false)
assert.ok(remaining.includes("Social life"))
assert.equal(remaining.length, HISTORY_QUESTION_KEYS.length + 7)
assert.equal(INTERVIEW_ANSWER_TOTAL, 25)
assert.equal(gaps.length, INTERVIEW_ANSWER_TOTAL)
assert.equal(answeredInterviewCount({}, [], null, emptyMedication(), emptyStressors()), 0)
assert.equal(
  answeredInterviewCount({}, [], null, answeredMedication, answeredStressors),
  INTERVIEW_ANSWER_TOTAL - remaining.length
)
assert.equal(backgroundInterviewSourceLine(null), "No background interview yet.")
assert.equal(
  backgroundInterviewSourceLine({ status: "in_progress", dateLabel: "25 Oct 2026", screening: {} }),
  "Yes / No / Not asked answers are from the background interview of 25 Oct 2026 (in progress). Change them in the interview."
)
assert.equal(
  backgroundInterviewSourceLine({ status: "completed", dateLabel: "1 Jan 2026", screening: {} }),
  "Yes / No / Not asked answers are from the background interview of 1 Jan 2026 (completed). Change them in the interview."
)

console.log("background interview history selftest passed")
