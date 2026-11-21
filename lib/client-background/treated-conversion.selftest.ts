import assert from "node:assert/strict"

import { planTreatedFieldConversion } from "@/lib/client-background/treated-conversion"
import { emptyEvent, type EventRecord } from "@/lib/client-background/types"

function event(partial: Partial<EventRecord> & Pick<EventRecord, "eventRecordId" | "eventType">): EventRecord {
  return { ...emptyEvent(partial.eventType, partial.displayOrder ?? 0), ...partial }
}

const depressionTherapy = event({
  eventRecordId: "dep1",
  eventType: "emotional_problems",
  title: "Depression",
  startPrecision: "year",
  startValue: "2005",
  conditionGroupId: "issue-dep1",
  treated: true,
  treatmentType: "Therapy",
  treatmentDetail: "CBT",
  outcome: "Improved",
})

const depressionPsych = event({
  eventRecordId: "dep2",
  eventType: "emotional_problems",
  title: "Depression",
  startPrecision: "year",
  startValue: "2010",
  conditionGroupId: "issue-dep2",
  treated: true,
  treatmentType: "Psychology",
  treatmentDetail: "Weekly sessions",
})

const overdose = event({
  eventRecordId: "od",
  eventType: "self_harm",
  title: "Overdose",
  startPrecision: "year",
  startValue: "1988",
  treated: true,
  treatmentType: "Hospital",
  treatmentDetail: "Emergency department visit",
})

const substanceNone = event({
  eventRecordId: "su",
  eventType: "substance_use",
  title: "Alcohol",
  startPrecision: "year",
  startValue: "2000",
  conditionGroupId: "issue-su",
  treated: false,
})

const plan = planTreatedFieldConversion([depressionTherapy, depressionPsych, overdose, substanceNone])

assert.equal(plan.treatments.length, 3)

const therapy = plan.treatments.find((item) => item.sourceEventRecordId === "dep1")
assert.ok(therapy)
assert.equal(therapy!.eventType, "previous_therapy")
assert.equal(therapy!.conditionGroupId, "issue-dep1")
assert.equal(therapy!.parentEventId, null)
assert.match(therapy!.description, /CBT/)
assert.match(therapy!.description, /Improved/)

const psych = plan.treatments.find((item) => item.sourceEventRecordId === "dep2")
assert.ok(psych)
assert.equal(psych!.eventType, "previous_therapy")
assert.equal(psych!.title, "psychologist")

const ed = plan.treatments.find((item) => item.sourceEventRecordId === "od")
assert.ok(ed)
assert.equal(ed!.eventType, "psychiatric_admission")
assert.equal(ed!.admissionType, "emergency_department")
assert.equal(ed!.parentEventId, "od")
assert.equal(ed!.conditionGroupId, null)

assert.deepEqual(plan.issueTreatmentYes.sort(), ["issue-dep1", "issue-dep2"])
assert.deepEqual(plan.issueTreatmentNone, ["issue-su"])

console.log("treated-conversion.selftest.ts: ok")
