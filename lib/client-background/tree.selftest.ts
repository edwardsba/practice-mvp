import assert from "node:assert/strict"

import { clientAgeAtStart, compareEventsChronologically, lifeStageAtStart } from "@/lib/client-background/age"
import {
  buildRelationshipTree,
  canonicalParentsLink,
  parentsRelationshipLabel,
  relationshipLineLabel,
} from "@/lib/client-background/tree"
import type { PartnershipRecord, RelationshipRecord } from "@/lib/client-background/types"
import { isMinorChild, relationshipFieldVisibility } from "@/lib/client-background/visibility"

function person(partial: Partial<RelationshipRecord> & Pick<RelationshipRecord, "relationshipRecordId" | "relationshipToClient">): RelationshipRecord {
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
    healthOrCauseOfDeath: "",
    lengthOfRelationship: "",
    relationshipStatus: "",
    timeSinceEnded: "",
    qualityOfRelationship: "",
    dependency: "",
    livingSituation: "",
    linkedPartnerRecordId: null,
    partnershipRecordId: null,
    ...partial,
  }
}

function partnership(partial: Partial<PartnershipRecord> & Pick<PartnershipRecord, "partnershipRecordId" | "partnerAId" | "partnerBId">): PartnershipRecord {
  return {
    relationshipStatus: "",
    started: "",
    ended: "",
    qualityOfRelationship: "",
    ...partial,
  }
}

const mother = person({ relationshipRecordId: "mother", relationshipToClient: "mother", givenName: "Jane", displayOrder: 0 })
const father = person({ relationshipRecordId: "father", relationshipToClient: "father", givenName: "Tom", displayOrder: 1 })
const fullSibling = person({
  relationshipRecordId: "sib",
  relationshipToClient: "sibling_full",
  givenName: "Sam",
  partnershipRecordId: "parents",
})
const stepParent = person({ relationshipRecordId: "step", relationshipToClient: "step_parent", givenName: "Alex" })
const halfSibling = person({
  relationshipRecordId: "half",
  relationshipToClient: "sibling_half",
  givenName: "Lee",
  partnershipRecordId: "step-link",
})
const partner = person({ relationshipRecordId: "partner", relationshipToClient: "current_partner", givenName: "Jo" })
const child = person({
  relationshipRecordId: "child",
  relationshipToClient: "child_biological",
  givenName: "Mia",
  linkedPartnerRecordId: "partner",
})
const unlinked = person({ relationshipRecordId: "unlinked", relationshipToClient: "child_step", givenName: "Kai" })

const tree = buildRelationshipTree(
  [child, halfSibling, partner, fullSibling, stepParent, father, mother, unlinked],
  [
    partnership({ partnershipRecordId: "parents", partnerAId: "mother", partnerBId: "father" }),
    partnership({ partnershipRecordId: "step-link", partnerAId: "mother", partnerBId: "step" }),
  ]
)

assert.deepEqual(tree.originParents.map((item) => item.relationshipRecordId), ["mother", "father"])
assert.deepEqual(tree.fullSiblings.map((item) => item.relationshipRecordId), ["sib"])
assert.equal(tree.otherFamily.length, 1)
assert.equal(tree.otherFamily[0]?.parent.relationshipRecordId, "mother")
assert.equal(tree.otherFamily[0]?.stepParents[0]?.person.relationshipRecordId, "step")
assert.deepEqual(
  tree.otherFamily[0]?.stepParents[0]?.siblings.map((item) => item.relationshipRecordId),
  ["half"]
)
assert.equal(tree.partners.length, 1)
assert.deepEqual(tree.partners[0]?.children.map((item) => item.relationshipRecordId), ["child"])
assert.deepEqual(tree.unlinkedChildren.map((item) => item.relationshipRecordId), ["unlinked"])
assert.equal(tree.unlinkedStepParents.length, 0)
assert.equal(tree.unlinkedStepSiblings.length, 0)

assert.equal(clientAgeAtStart("2000-06-15", "date", "2018-06-14"), 17)
assert.equal(clientAgeAtStart("2000-06-15", "date", "2018-06-15"), 18)
assert.equal(clientAgeAtStart("2000-06-15", "year", "2018"), 17)
assert.equal(clientAgeAtStart("2000-06-15", "year_month", "2018-06"), 17)
assert.equal(clientAgeAtStart(null, "age", "14"), 14)
assert.equal(clientAgeAtStart(null, "date", "2018-06-15"), null)
assert.equal(lifeStageAtStart("2000-06-15", "date", "2018-06-14"), "childhood")
assert.equal(lifeStageAtStart("2000-06-15", "date", "2018-06-15"), "adulthood")
assert.equal(lifeStageAtStart(null, "year", "2018"), null)

const link = canonicalParentsLink(
  [mother, father],
  [partnership({ partnershipRecordId: "parents", partnerAId: "mother", partnerBId: "father", relationshipStatus: "married" })]
)
assert.equal(link.partnership?.partnershipRecordId, "parents")
assert.equal(parentsRelationshipLabel(link.partnership!), "Parents' relationship – Married")
assert.equal(relationshipLineLabel(mother, undefined, "2026-10-02"), "Mother – Jane")
assert.equal(
  relationshipLineLabel({ ...mother, dateOfBirth: "1964-01-01" }, undefined, "2026-10-02"),
  "Mother – Jane – 62"
)
assert.equal(
  relationshipLineLabel(
    { ...mother, approximateAge: 70, approximateAgeRecordedOn: "2020-06-01" },
    undefined,
    "2026-10-02"
  ),
  "Mother – Jane – ~76"
)
assert.equal(relationshipLineLabel(stepParent, "De facto", "2026-10-02"), "Step-parent – Alex – De facto")
assert.equal(relationshipLineLabel(fullSibling, undefined, "2026-10-02"), "Full sibling – Sam")
assert.equal(relationshipFieldVisibility(fullSibling).lengthOfRelationship, false)
assert.equal(
  relationshipFieldVisibility(person({ relationshipRecordId: "half-vis", relationshipToClient: "sibling_half" }))
    .lengthOfRelationship,
  true
)
assert.equal(
  isMinorChild(
    person({ relationshipRecordId: "kid", relationshipToClient: "child_biological", dateOfBirth: "2015-01-01" }),
    "2026-10-02"
  ),
  true
)
assert.equal(
  isMinorChild(
    person({
      relationshipRecordId: "approx-kid",
      relationshipToClient: "child_biological",
      approximateAge: 10,
      approximateAgeRecordedOn: "2024-01-01",
    }),
    "2026-10-02"
  ),
  true
)
assert.equal(
  isMinorChild(
    person({
      relationshipRecordId: "approx-grown",
      relationshipToClient: "child_biological",
      approximateAge: 10,
      approximateAgeRecordedOn: "2024-01-01",
    }),
    "2034-01-01"
  ),
  false
)

const undated = { startPrecision: "" as const, startValue: "", displayOrder: 2 }
const earlier = { startPrecision: "year" as const, startValue: "1990", displayOrder: 1 }
const later = { startPrecision: "year" as const, startValue: "2010", displayOrder: 0 }
assert.ok(compareEventsChronologically(undated, earlier, null) < 0)
assert.ok(compareEventsChronologically(earlier, later, null) < 0)
assert.ok(compareEventsChronologically(later, undated, "1980-01-01") > 0)

console.log("client background tree and age selftest passed")
