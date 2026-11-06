import assert from "node:assert/strict"

import {
  HISTORY_QUESTION_GROUPS,
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
  emptyReasonForAttending,
  emptyStressors,
  type EventRecord,
  type EventType,
  type ReasonForAttending,
  type StressorsRecord,
} from "@/lib/client-background/types"

const BIRTH = "2000-06-15"

function entry(
  eventType: EventType,
  partial: Partial<EventRecord> = {}
): Pick<EventRecord, "eventType" | "about" | "startPrecision" | "startValue"> {
  return { ...emptyEvent(eventType, 0), ...partial }
}

const expected: { key: HistoryQuestionKey; event: ReturnType<typeof entry> }[] = [
  { key: "emotional_problems", event: entry("emotional_problems", { about: "self" }) },
  { key: "self_harm", event: entry("self_harm", { about: "self" }) },
  { key: "substance_use", event: entry("substance_use", { about: "self" }) },
  { key: "psychiatric_admission", event: entry("psychiatric_admission", { about: "self" }) },
  { key: "previous_therapy", event: entry("previous_therapy", { about: "self" }) },
  { key: "medication_history", event: entry("medication", { about: "self" }) },
  { key: "illness_injury", event: entry("illness_injury", { about: "self" }) },
  { key: "traumatic_events", event: entry("traumatic_event", { about: "self" }) },
  {
    key: "other_significant_events",
    event: entry("significant_history", { about: "self", startPrecision: "date", startValue: "2018-06-14" }),
  },
  {
    key: "family_emotional_problems",
    event: entry("family_events", { about: "significant_other", startPrecision: "date", startValue: "2010-01-01" }),
  },
  {
    key: "other_significant_events",
    event: entry("significant_history", { about: "self", startPrecision: "", startValue: "" }),
  },
  {
    key: "other_significant_events",
    event: entry("significant_history", { about: "self", startPrecision: "date", startValue: "2018-06-15" }),
  },
  {
    key: "family_emotional_problems",
    event: entry("family_events", { about: "significant_other", startPrecision: "date", startValue: "2020-01-01" }),
  },
  { key: "family_emotional_problems", event: entry("emotional_problems", { about: "significant_other" }) },
  { key: "family_self_harm", event: entry("self_harm", { about: "significant_other" }) },
  { key: "family_substance_use", event: entry("substance_use", { about: "significant_other" }) },
  { key: "family_psychiatric_admission", event: entry("psychiatric_admission", { about: "significant_other" }) },
  { key: "family_illness", event: entry("illness_injury", { about: "significant_other" }) },
  { key: "family_significant_events", event: entry("significant_history", { about: "significant_other" }) },
  { key: "family_significant_events", event: entry("previous_therapy", { about: "significant_other" }) },
]

const seen = new Set<HistoryQuestionKey>()
for (const item of expected) {
  const key = historyQuestionKeyForEvent(item.event, BIRTH)
  assert.equal(key, item.key)
  seen.add(key)
}

assert.equal(seen.size, HISTORY_QUESTION_KEYS.length)
assert.equal(seen.has("medication_history"), true)
assert.deepEqual(
  HISTORY_QUESTION_GROUPS.map((group) => ({ title: group.title, keys: [...group.keys] })),
  [
    {
      title: "Client history",
      keys: [
        "illness_injury",
        "traumatic_events",
        "emotional_problems",
        "substance_use",
        "self_harm",
        "psychiatric_admission",
        "previous_therapy",
        "medication_history",
        "other_significant_events",
      ],
    },
    {
      title: "Significant others",
      keys: [
        "family_illness",
        "family_emotional_problems",
        "family_substance_use",
        "family_self_harm",
        "family_psychiatric_admission",
        "family_significant_events",
      ],
    },
  ]
)

const gaps = unansweredInterviewLabels({}, [], null, emptyStressors(), emptyReasonForAttending())
assert.deepEqual(gaps.slice(0, 2), ["Referral type", "Illness / injury"])
assert.equal(gaps[1], "Illness / injury")
assert.equal(gaps[2], "Traumatic events")
assert.ok(gaps.includes("Medication"))
assert.ok(gaps.indexOf("Medication") > gaps.indexOf("Previous therapy"))
assert.ok(gaps.indexOf("Medication") < gaps.indexOf("Other significant events"))
assert.equal(gaps.filter((label) => label === "Illness / injury").length, 2)
assert.equal(gaps.filter((label) => label === "Hospital admission").length, 2)
assert.ok(gaps.includes("Significant events"))
assert.equal(gaps.includes("Childhood events"), false)
assert.equal(gaps.includes("Abuse"), false)
assert.equal(gaps.includes("Client's motivation"), false)
assert.ok(gaps.indexOf("Family") > gaps.indexOf("Emotional problems"))
assert.equal(gaps.at(-1), "Legal matters, police or accidents")
assert.equal(gaps.includes("Currently taking medication"), false)
assert.equal(gaps.filter((label) => label === "Family").length, 1)
assert.equal(gaps.length, HISTORY_QUESTION_KEYS.length + 1 + 9)

const answeredStressors: StressorsRecord = { ...emptyStressors(), family: "yes", financial: "no" }
const answeredReason: ReasonForAttending = {
  ...emptyReasonForAttending(),
  referralType: "self",
}
const remaining = unansweredInterviewLabels({}, [], null, answeredStressors, answeredReason)
assert.equal(remaining[0], "Illness / injury")
assert.equal(remaining.includes("Medication"), true)
assert.equal(remaining.includes("Referral type"), false)
assert.equal(remaining.includes("Attended willingly"), false)
assert.equal(remaining.includes("Currently taking medication"), false)
assert.equal(remaining.includes("Family"), false)
assert.equal(remaining.includes("Financial"), false)
assert.ok(remaining.includes("Social life"))
assert.equal(remaining.length, HISTORY_QUESTION_KEYS.length + 7)
assert.equal(INTERVIEW_ANSWER_TOTAL, 25)
assert.equal(gaps.length, INTERVIEW_ANSWER_TOTAL)
assert.equal(
  answeredInterviewCount({}, [], null, emptyStressors(), emptyReasonForAttending()),
  0
)
assert.equal(
  answeredInterviewCount({}, [], null, emptyStressors(), emptyReasonForAttending()),
  0
)
assert.equal(
  answeredInterviewCount(
    { medication_history: "yes" },
    [],
    null,
    emptyStressors(),
    emptyReasonForAttending()
  ),
  1
)
assert.equal(
  answeredInterviewCount({}, [], null, answeredStressors, answeredReason),
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
