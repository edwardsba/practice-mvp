import assert from "node:assert/strict"

import { clientAgeAtStart, compareEventsChronologically, lifeStageAtStart } from "@/lib/client-background/age"
import { livingWithClientLines, personName, relationshipLineLabel } from "@/lib/client-background/tree"
import type { RelationshipRecord } from "@/lib/client-background/types"
import { isMinorChild, relationshipFieldVisibility } from "@/lib/client-background/visibility"

function person(
  partial: Partial<RelationshipRecord> & Pick<RelationshipRecord, "relationshipRecordId" | "relationshipToClient">
): RelationshipRecord {
  return {
    sex: "",
    givenName: "",
    displayOrder: 0,
    dateOfBirth: "",
    approximateAge: null,
    approximateAgeRecordedOn: "",
    healthStatus: "",
    deceased: false,
    ageAtDeath: null,
    dateOfDeath: "",
    healthOrCauseOfDeath: "",
    childType: "",
    childTypeDetail: "",
    supportive: "",
    conflict: "",
    qualityOfRelationship: "",
    dependency: "",
    livingSituation: "",
    caregiverRelationship: "",
    caregiverRelationshipDetail: "",
    notKnown: false,
    ...partial,
  }
}

const mother = person({ relationshipRecordId: "mother", relationshipToClient: "mother", givenName: "Jane" })
const stepParent = person({ relationshipRecordId: "step", relationshipToClient: "step_parent", givenName: "Alex" })
const fullSibling = person({ relationshipRecordId: "sib", relationshipToClient: "sibling_full", givenName: "Sam" })
const caregiver = person({
  relationshipRecordId: "care",
  relationshipToClient: "other_caregiver",
  givenName: "Nan",
  caregiverRelationship: "grandparent",
})
const partner = person({ relationshipRecordId: "partner", relationshipToClient: "current_partner", givenName: "Jo" })

assert.equal(clientAgeAtStart("2000-06-15", "date", "2018-06-14"), 17)
assert.equal(clientAgeAtStart("2000-06-15", "date", "2018-06-15"), 18)
assert.equal(clientAgeAtStart("2000-06-15", "year", "2018"), 18)
assert.equal(clientAgeAtStart("2000-06-15", "year_month", "2018-06"), null)
assert.equal(clientAgeAtStart(null, "age", "14"), 14)
assert.equal(clientAgeAtStart(null, "date", "2018-06-15"), null)
assert.equal(lifeStageAtStart("2000-06-15", "date", "2018-06-14"), "childhood")
assert.equal(lifeStageAtStart("2000-06-15", "date", "2018-06-15"), "adulthood")
assert.equal(lifeStageAtStart(null, "year", "2018"), null)

assert.equal(relationshipLineLabel(mother, undefined, "2026-10-02"), "Mother – Jane")
assert.equal(relationshipLineLabel({ ...mother, dateOfBirth: "1964-01-01" }, undefined, "2026-10-02"), "Mother – Jane – 62")
assert.equal(relationshipLineLabel({ ...mother, dateOfBirth: "1950" }, undefined, "2026-10-02"), "Mother – Jane – ~76")
assert.equal(
  relationshipLineLabel({ ...mother, dateOfBirth: "1964-01-01", healthStatus: "deceased" }, undefined, "2026-10-02"),
  "Mother – Jane"
)
assert.equal(relationshipLineLabel(stepParent, "De facto", "2026-10-02"), "Step-parent – Alex – De facto")
assert.equal(relationshipLineLabel(fullSibling, undefined, "2026-10-02"), "Sibling – Sam")
assert.equal(relationshipLineLabel(caregiver, undefined, "2026-10-02"), "Other primary caregiver – Nan (Grandparent)")
assert.equal(
  relationshipLineLabel({ ...caregiver, caregiverRelationship: "" }, undefined, "2026-10-02"),
  "Other primary caregiver – Nan"
)
assert.equal(personName(mother), "Jane")
assert.equal(personName({ ...mother, givenName: "" }), "Mother")

const asOf = "2026-10-02"
const motherVisibility = relationshipFieldVisibility(mother, asOf)
assert.equal(motherVisibility.dateOfBirth, true)
assert.equal(motherVisibility.health, true)
assert.equal(motherVisibility.supportive, true)
assert.equal(motherVisibility.comment, true)
assert.equal(motherVisibility.dependency, true)
assert.equal(motherVisibility.livingSituation, true)
assert.equal(motherVisibility.notKnown, true)
assert.equal(motherVisibility.childType, false)

const priorPartnerVisibility = relationshipFieldVisibility(
  person({ relationshipRecordId: "ex", relationshipToClient: "prior_partner", dateOfBirth: "1980-01-01", healthStatus: "good" }),
  asOf
)
assert.equal(priorPartnerVisibility.dateOfBirth, true)
assert.equal(priorPartnerVisibility.health, false)
assert.equal(priorPartnerVisibility.supportive, true)
assert.equal(priorPartnerVisibility.comment, true)
assert.equal(priorPartnerVisibility.dependency, false)
assert.equal(priorPartnerVisibility.livingSituation, false)
assert.equal(priorPartnerVisibility.notKnown, false)
assert.equal(priorPartnerVisibility.childType, false)

const minorVisibility = relationshipFieldVisibility(
  person({ relationshipRecordId: "kid", relationshipToClient: "child_biological", dateOfBirth: "2015-01-01" }),
  asOf
)
assert.equal(minorVisibility.dependency, false)
assert.equal(minorVisibility.livingSituation, true)
assert.equal(minorVisibility.childType, true)

const deceasedVisibility = relationshipFieldVisibility(
  person({ relationshipRecordId: "late", relationshipToClient: "father", healthStatus: "deceased", dateOfBirth: "1950-01-01" }),
  asOf
)
assert.equal(deceasedVisibility.dependency, false)
assert.equal(deceasedVisibility.livingSituation, false)
assert.equal(deceasedVisibility.health, true)
assert.equal(deceasedVisibility.dateOfBirth, true)
assert.equal(deceasedVisibility.notKnown, true)

assert.equal(
  isMinorChild(person({ relationshipRecordId: "kid", relationshipToClient: "child_biological", dateOfBirth: "2015-01-01" }), "2026-10-02"),
  true
)
assert.equal(
  isMinorChild(person({ relationshipRecordId: "year-kid", relationshipToClient: "child_biological", dateOfBirth: "2014" }), "2026-10-02"),
  true
)
assert.equal(
  isMinorChild(person({ relationshipRecordId: "year-grown", relationshipToClient: "child_biological", dateOfBirth: "2014" }), "2034-01-01"),
  false
)

assert.deepEqual(
  livingWithClientLines([
    person({
      relationshipRecordId: "partner",
      relationshipToClient: "current_partner",
      givenName: "Jo",
      livingSituation: "lives_with_client_full_time",
    }),
    person({
      relationshipRecordId: "child",
      relationshipToClient: "child_biological",
      givenName: "Mia",
      livingSituation: "lives_with_client_part_time",
    }),
    partner,
  ]),
  ["Current partner — Jo", "Child — Mia (part-time)"]
)

const undated = { startPrecision: "" as const, startValue: "", displayOrder: 2 }
const earlier = { startPrecision: "year" as const, startValue: "1990", displayOrder: 1 }
const later = { startPrecision: "year" as const, startValue: "2010", displayOrder: 0 }
assert.ok(compareEventsChronologically(undated, earlier, null) < 0)
assert.ok(compareEventsChronologically(earlier, later, null) < 0)
assert.ok(compareEventsChronologically(later, undated, "1980-01-01") > 0)

console.log("client background tree and age selftest passed")
