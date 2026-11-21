import assert from "node:assert/strict"

import {
  eventTypeForSmartKind,
  fieldsForSmartKind,
  smartKindForEventType,
  treatmentTypeChoiceForEventType,
  RETIRED_HISTORY_FORM_FIELDS,
} from "@/lib/client-background/smart-event-fields"

assert.deepEqual(fieldsForSmartKind("episode"), ["started", "ended", "description"])
assert.ok(fieldsForSmartKind("episode", { category: "substance_use" }).includes("substance_status"))
assert.ok(fieldsForSmartKind("episode", { category: "substance_use" }).includes("abstinent_since"))

assert.deepEqual(fieldsForSmartKind("other"), ["title", "date", "description"])

const hospital = fieldsForSmartKind("treatment", { treatmentType: "hospital_admission" })
assert.ok(hospital.includes("admission_type"))
assert.ok(hospital.includes("facility"))
assert.ok(hospital.includes("admission_length"))
assert.ok(!hospital.includes("therapy_provider"))

const therapy = fieldsForSmartKind("treatment", { treatmentType: "therapy" })
assert.ok(therapy.includes("therapy_provider"))
assert.ok(!therapy.includes("admission_type"))

const medication = fieldsForSmartKind("treatment", { treatmentType: "medication" })
assert.ok(medication.includes("medication_name"))
assert.ok(medication.includes("prescriber"))

const otherTx = fieldsForSmartKind("treatment", { treatmentType: "other" })
assert.ok(otherTx.includes("other_title"))

assert.equal(eventTypeForSmartKind("other"), "other_event")
assert.equal(eventTypeForSmartKind("episode", { category: "emotional_problems" }), "emotional_problems")
assert.equal(eventTypeForSmartKind("treatment", { treatmentType: "hospital_admission" }), "psychiatric_admission")
assert.equal(eventTypeForSmartKind("treatment", { treatmentType: "therapy" }), "previous_therapy")
assert.equal(eventTypeForSmartKind("treatment", { treatmentType: "medication" }), "medication")
assert.equal(eventTypeForSmartKind("treatment", { treatmentType: "other" }), "other_treatment")

assert.equal(smartKindForEventType("other_event"), "other")
assert.equal(smartKindForEventType("previous_therapy"), "treatment")
assert.equal(smartKindForEventType("emotional_problems"), "episode")
assert.equal(treatmentTypeChoiceForEventType("other_treatment"), "other")

assert.ok(RETIRED_HISTORY_FORM_FIELDS.includes("condition"))
assert.ok(RETIRED_HISTORY_FORM_FIELDS.includes("treated"))
assert.ok(RETIRED_HISTORY_FORM_FIELDS.includes("for"))

console.log("smart-event-fields.selftest.ts: ok")
