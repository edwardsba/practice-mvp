import assert from "node:assert/strict"

import { clientAgeAtStart, lifeStageAtStart } from "@/lib/client-background/age"
import { buildRelationshipTree } from "@/lib/client-background/tree"
import type { PartnershipRecord, RelationshipRecord } from "@/lib/client-background/types"

function person(partial: Partial<RelationshipRecord> & Pick<RelationshipRecord, "relationshipRecordId" | "relationshipToClient">): RelationshipRecord {
  return {
    gender: "",
    givenName: "",
    displayOrder: 0,
    age: null,
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

console.log("client background tree and age selftest passed")
