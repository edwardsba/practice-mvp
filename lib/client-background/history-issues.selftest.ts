import assert from "node:assert/strict"

import {
  comparePartialStarts,
  episodeForTreatment,
  mixedIssueEvents,
  planHistoryIssueBackfill,
  subEventsFor,
  treatmentAnswerAfterChange,
  treatmentsForIssue,
} from "@/lib/client-background/history-issues"
import { emptyEvent, type EventRecord } from "@/lib/client-background/types"

const DOB = "1970-03-12"

function event(partial: Partial<EventRecord> & Pick<EventRecord, "eventRecordId" | "eventType">): EventRecord {
  return { ...emptyEvent(partial.eventType, partial.displayOrder ?? 0), ...partial }
}

const depression1 = event({
  eventRecordId: "ep1",
  eventType: "emotional_problems",
  title: "Depression",
  startPrecision: "year",
  startValue: "2000",
  endPrecision: "year",
  endValue: "2002",
  conditionGroupId: "issue-dep",
  displayOrder: 1,
})
const admission = event({
  eventRecordId: "adm",
  eventType: "psychiatric_admission",
  title: "Admission",
  startPrecision: "year",
  startValue: "2001",
  conditionGroupId: "issue-dep",
  displayOrder: 2,
})
const therapy = event({
  eventRecordId: "thr",
  eventType: "previous_therapy",
  title: "Psychologist",
  startPrecision: "year",
  startValue: "2001",
  endPrecision: "year",
  endValue: "2002",
  conditionGroupId: "issue-dep",
  displayOrder: 3,
})
const depression2 = event({
  eventRecordId: "ep2",
  eventType: "emotional_problems",
  title: "Depression",
  startPrecision: "year",
  startValue: "2025",
  endOngoing: true,
  resolvedOrOngoing: "ongoing",
  conditionGroupId: "issue-dep",
  displayOrder: 4,
})
const sertraline = event({
  eventRecordId: "med",
  eventType: "medication",
  title: "Sertraline",
  startPrecision: "year",
  startValue: "2025",
  endOngoing: true,
  resolvedOrOngoing: "ongoing",
  conditionGroupId: "issue-dep",
  displayOrder: 5,
})
const sameYearEpisode = event({
  eventRecordId: "same-ep",
  eventType: "emotional_problems",
  title: "Anxiety",
  startPrecision: "year",
  startValue: "2010",
  conditionGroupId: "issue-anx",
  displayOrder: 1,
})
const sameYearTreatment = event({
  eventRecordId: "same-tx",
  eventType: "medication",
  title: "Sertraline",
  startPrecision: "year",
  startValue: "2010",
  conditionGroupId: "issue-anx",
  displayOrder: 2,
})
const partialMonth = event({
  eventRecordId: "partial",
  eventType: "medication",
  title: "Partial",
  startPrecision: "year_month",
  startValue: "2010-06",
  conditionGroupId: "issue-anx",
  displayOrder: 3,
})
const undated = event({
  eventRecordId: "undated",
  eventType: "previous_therapy",
  title: "Undated",
  conditionGroupId: "issue-anx",
  displayOrder: 4,
})

const depEvents = [depression1, admission, therapy, depression2, sertraline]
const mixed = mixedIssueEvents(depEvents, "issue-dep", DOB)
assert.deepEqual(
  mixed.map((item) =>
    item.kind === "episode" ? `Episode ${item.episodeNumber}` : item.event.eventRecordId
  ),
  ["Episode 1", "adm", "thr", "Episode 2", "med"]
)

const anxMixed = mixedIssueEvents([sameYearEpisode, sameYearTreatment, partialMonth, undated], "issue-anx", DOB)
assert.equal(anxMixed[0].kind, "episode")
assert.equal(anxMixed[1].kind, "treatment")
assert.equal(anxMixed[1].event.eventRecordId, "same-tx")
assert.equal(anxMixed[2].event.eventRecordId, "partial")
assert.equal(anxMixed[anxMixed.length - 1].event.eventRecordId, "undated")

assert.ok(comparePartialStarts(sameYearEpisode, sameYearTreatment, DOB) < 0)
assert.ok(comparePartialStarts(sameYearEpisode, undated, DOB) < 0)

assert.equal(episodeForTreatment(admission, [depression1, depression2], DOB)?.eventRecordId, "ep1")
assert.equal(episodeForTreatment(sertraline, [depression1, depression2], DOB)?.eventRecordId, "ep2")
assert.equal(episodeForTreatment(admission, [depression2, depression1], DOB)?.eventRecordId, "ep1")
const earlyMed = event({
  eventRecordId: "early",
  eventType: "medication",
  title: "Early",
  startPrecision: "year",
  startValue: "1990",
  conditionGroupId: "issue-dep",
})
assert.equal(episodeForTreatment(earlyMed, [depression1, depression2], DOB)?.eventRecordId, "ep1")

assert.equal(treatmentAnswerAfterChange("", 1), "yes")
assert.equal(treatmentAnswerAfterChange("none", 1), "yes")
assert.equal(treatmentAnswerAfterChange("yes", 0), "not_asked")
assert.equal(treatmentAnswerAfterChange("none", 0), "none")
assert.equal(treatmentAnswerAfterChange("not_asked", 0), "not_asked")

const step = event({
  eventRecordId: "step1",
  eventType: "psychiatric_admission",
  title: "Discharge",
  startPrecision: "year",
  startValue: "2001",
  parentEventId: "adm",
  conditionGroupId: "issue-dep",
})
const withStep = [...depEvents, step]
assert.deepEqual(
  subEventsFor(withStep, "adm").map((item) => item.eventRecordId),
  ["step1"]
)
assert.equal(treatmentsForIssue(withStep, "issue-dep").some((item) => item.eventRecordId === "step1"), false)

const plan = planHistoryIssueBackfill({
  events: [
    event({
      eventRecordId: "a",
      eventType: "emotional_problems",
      title: "Depression",
      conditionGroupId: "g1",
      startPrecision: "year",
      startValue: "2000",
    }),
    event({
      eventRecordId: "b",
      eventType: "psychiatric_admission",
      title: "Admission",
      conditionEventId: "a",
      startPrecision: "year",
      startValue: "2001",
    }),
    event({
      eventRecordId: "c",
      eventType: "illness_injury",
      title: "Broken leg",
      conditionGroupId: "g2",
      about: "self",
      startPrecision: "year",
      startValue: "1982",
    }),
    event({
      eventRecordId: "d",
      eventType: "emotional_problems",
      title: "Depression",
      conditionGroupId: "g3",
      about: "significant_other",
      relationshipRecordId: "rel-1",
    }),
    event({
      eventRecordId: "e",
      eventType: "medication",
      title: "Temazepam",
      about: "self",
    }),
  ],
  screening: {
    psychiatric_admission: "no",
    previous_therapy: "no",
    medication_history: "no",
    family_psychiatric_admission: "no",
  },
})
assert.equal(plan.issues.find((issue) => issue.issueId === "g1")?.treatmentAnswer, "yes")
assert.equal(plan.issues.find((issue) => issue.issueId === "g2")?.treatmentAnswer, "none")
assert.equal(plan.issues.find((issue) => issue.issueId === "g3")?.treatmentAnswer, "none")
assert.deepEqual(plan.treatmentGroupLinks, [{ eventRecordId: "b", conditionGroupId: "g1" }])
assert.equal(plan.otherTreatmentYes, true)

console.log("history issues selftest passed")
