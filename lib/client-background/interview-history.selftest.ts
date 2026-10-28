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
  emptyMedication,
  emptyReasonForAttending,
  emptyStressors,
  type EventRecord,
  type EventType,
  type MedicationRecord,
  type ReasonForAttending,
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
  { key: "traumatic_events", event: entry("traumatic_event", { attribution: "self" }) },
  {
    key: "other_significant_events",
    event: entry("significant_history", { attribution: "self", startPrecision: "date", startValue: "2018-06-14" }),
  },
  {
    key: "other_significant_events",
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

assert.equal(seen.size, HISTORY_QUESTION_KEYS.length - 1)
assert.equal(seen.has("medication_history"), false)
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
      title: "Family history",
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

const gaps = unansweredInterviewLabels({}, [], null, emptyMedication(), emptyStressors(), emptyReasonForAttending())
assert.deepEqual(gaps.slice(0, 5), [
  "Referred by a medical professional",
  "Family involved in them attending",
  "Came on their own initiative",
  "Attended willingly",
  "Currently taking medication",
])
assert.equal(gaps[5], "Illness / injury")
assert.equal(gaps[6], "Traumatic events")
assert.ok(gaps.includes("Medication history"))
assert.ok(gaps.indexOf("Medication history") > gaps.indexOf("Previous therapy"))
assert.ok(gaps.indexOf("Medication history") < gaps.indexOf("Other significant events"))
assert.ok(gaps.indexOf("Family illness") < gaps.indexOf("Family emotional problems"))
assert.equal(gaps.includes("Childhood events"), false)
assert.equal(gaps.includes("Abuse"), false)
assert.equal(gaps.includes("Client's motivation"), false)
assert.ok(gaps.indexOf("Family") > gaps.indexOf("Emotional problems"))
assert.equal(gaps.at(-1), "Legal matters, police or accidents")
assert.ok(gaps.includes("Currently taking medication"))
assert.equal(gaps.filter((label) => label === "Family").length, 1)
assert.equal(gaps.length, HISTORY_QUESTION_KEYS.length + 4 + 1 + 9)

const answeredMedication: MedicationRecord = { ...emptyMedication(), currentlyTaking: "not_asked" }
const answeredStressors: StressorsRecord = { ...emptyStressors(), family: "yes", financial: "no" }
const answeredReason: ReasonForAttending = {
  ...emptyReasonForAttending(),
  referredByMedicalProfessional: "no",
  familyInvolved: "not_asked",
  ownInitiative: "yes",
  attendedWillingly: "somewhat",
  clientMotivation: "Wants to understand what is going on",
}
const remaining = unansweredInterviewLabels({}, [], null, answeredMedication, answeredStressors, answeredReason)
assert.equal(remaining[0], "Illness / injury")
assert.equal(remaining.includes("Medication history"), true)
assert.equal(remaining.includes("Referred by a medical professional"), false)
assert.equal(remaining.includes("Attended willingly"), false)
assert.equal(remaining.includes("Currently taking medication"), false)
assert.equal(remaining.includes("Family"), false)
assert.equal(remaining.includes("Financial"), false)
assert.ok(remaining.includes("Social life"))
assert.equal(remaining.length, HISTORY_QUESTION_KEYS.length + 7)
assert.equal(INTERVIEW_ANSWER_TOTAL, 29)
assert.equal(gaps.length, INTERVIEW_ANSWER_TOTAL)
assert.equal(
  answeredInterviewCount({}, [], null, emptyMedication(), emptyStressors(), emptyReasonForAttending()),
  0
)
assert.equal(
  answeredInterviewCount({}, [], null, emptyMedication(), emptyStressors(), {
    ...emptyReasonForAttending(),
    attendedWillingly: "somewhat",
    clientMotivation: "Still not counted",
  }),
  1
)
assert.equal(
  answeredInterviewCount(
    {},
    [],
    null,
    { ...emptyMedication(), previouslyTaken: "yes" },
    emptyStressors(),
    emptyReasonForAttending()
  ),
  1
)
assert.equal(
  answeredInterviewCount({}, [], null, answeredMedication, answeredStressors, answeredReason),
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
