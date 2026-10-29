import assert from "node:assert/strict"

import { clientAgeAtStart, compareEventsChronologically, lifeStageAtStart } from "@/lib/client-background/age"
import {
  buildRelationshipTree,
  canonicalParentsLink,
  familyOfOriginSequence,
  parentsRelationshipLabel,
  relationshipLineLabel,
  relationshipLinkLine,
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
    dateOfDeath: "",
    healthOrCauseOfDeath: "",
    lengthOfRelationship: "",
    relationshipStatus: "",
    timeSinceEnded: "",
    qualityOfRelationship: "",
    dependency: "",
    livingSituation: "",
    caregiverRelationship: "",
    linkedPartnerRecordId: null,
    partnershipRecordId: null,
    supportive: "",
    conflict: "",
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
const looseChild = person({
  relationshipRecordId: "loose",
  relationshipToClient: "child_biological",
  givenName: "Noa",
})
const extraParent = person({
  relationshipRecordId: "parent",
  relationshipToClient: "parent",
  givenName: "Pat",
  displayOrder: 2,
})
const caregiver = person({
  relationshipRecordId: "care",
  relationshipToClient: "other_caregiver",
  givenName: "Nan",
  caregiverRelationship: "grandparent",
  displayOrder: 4,
})

const treePeople = [
  child,
  halfSibling,
  partner,
  fullSibling,
  stepParent,
  father,
  mother,
  unlinked,
  looseChild,
  extraParent,
  caregiver,
]
const treePartnerships = [
  partnership({ partnershipRecordId: "parents", partnerAId: "mother", partnerBId: "father" }),
  partnership({ partnershipRecordId: "step-link", partnerAId: "mother", partnerBId: "step" }),
]

const tree = buildRelationshipTree(treePeople, treePartnerships)

assert.deepEqual(tree.originParents.map((item) => item.relationshipRecordId), ["mother", "father", "parent"])
assert.deepEqual(tree.otherCaregivers.map((item) => item.relationshipRecordId), ["care"])
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
assert.deepEqual(tree.unlinkedChildren.map((item) => item.relationshipRecordId), ["loose"])
assert.deepEqual(tree.unlinkedStepChildren.map((item) => item.relationshipRecordId), ["unlinked"])
assert.equal(
  tree.unlinkedChildren.some((item) => item.relationshipToClient === "child_step"),
  false
)
assert.equal(
  tree.unlinkedStepChildren.some((item) => item.relationshipToClient === "child_biological"),
  false
)
assert.equal(tree.unlinkedStepParents.length, 0)
assert.equal(tree.unlinkedStepSiblings.length, 0)

assert.equal(clientAgeAtStart("2000-06-15", "date", "2018-06-14"), 17)
assert.equal(clientAgeAtStart("2000-06-15", "date", "2018-06-15"), 18)
assert.equal(clientAgeAtStart("2000-06-15", "year", "2018"), 18)
assert.equal(clientAgeAtStart("2000-06-15", "year_month", "2018-06"), null)
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
  relationshipLineLabel({ ...mother, dateOfBirth: "1950" }, undefined, "2026-10-02"),
  "Mother – Jane – ~76"
)
assert.equal(
  relationshipLineLabel(
    { ...mother, dateOfBirth: "1964-01-01", healthStatus: "deceased" },
    undefined,
    "2026-10-02"
  ),
  "Mother – Jane"
)
assert.equal(relationshipLineLabel(stepParent, "De facto", "2026-10-02"), "Step-parent – Alex – De facto")
assert.equal(relationshipLineLabel(fullSibling, undefined, "2026-10-02"), "Sibling – Sam")
assert.equal(
  relationshipLineLabel(caregiver, undefined, "2026-10-02"),
  "Other primary caregiver – Nan (grandparent)"
)
assert.equal(
  relationshipLineLabel({ ...caregiver, caregiverRelationship: "" }, undefined, "2026-10-02"),
  "Other primary caregiver – Nan"
)

const originOrder = familyOfOriginSequence(treePeople, treePartnerships)
const parentsRelationshipIndex = originOrder.findIndex((item) => item.kind === "parents-relationship")
const caregiverIndex = originOrder.findIndex((item) => item.kind === "person" && item.id === "care")
const siblingIndex = originOrder.findIndex((item) => item.kind === "person" && item.id === "sib")
assert.deepEqual(
  originOrder.flatMap((item) => (item.kind === "person" ? [item.id] : [])).slice(0, 3),
  ["mother", "father", "parent"]
)
assert.ok(parentsRelationshipIndex > 2)
assert.ok(caregiverIndex > parentsRelationshipIndex)
assert.ok(siblingIndex > caregiverIndex)
assert.equal(relationshipFieldVisibility(fullSibling).lengthOfRelationship, false)
assert.equal(
  relationshipFieldVisibility(person({ relationshipRecordId: "half-vis", relationshipToClient: "sibling_half" }))
    .lengthOfRelationship,
  false
)

const asOf = "2026-10-02"
const motherVisibility = relationshipFieldVisibility(mother, asOf)
assert.equal(motherVisibility.dateOfBirth, true)
assert.equal(motherVisibility.health, true)
assert.equal(motherVisibility.lengthOfRelationship, false)
assert.equal(motherVisibility.supportive, true)
assert.equal(motherVisibility.comment, true)
assert.equal(motherVisibility.dependency, true)
assert.equal(motherVisibility.livingSituation, true)
assert.equal(motherVisibility.clientRelationshipStatus, false)
assert.equal(motherVisibility.howItEnded, false)

const caregiverVisibility = relationshipFieldVisibility(caregiver, asOf)
assert.equal(caregiverVisibility.lengthOfRelationship, true)
assert.equal(caregiverVisibility.dependency, true)

const stepVisibility = relationshipFieldVisibility(stepParent, asOf)
assert.equal(stepVisibility.lengthOfRelationship, true)
assert.equal(stepVisibility.dateOfBirth, true)
assert.equal(stepVisibility.clientRelationshipStatus, false)

const stepSiblingVisibility = relationshipFieldVisibility(
  person({ relationshipRecordId: "step-sib", relationshipToClient: "sibling_step" }),
  asOf
)
assert.equal(stepSiblingVisibility.lengthOfRelationship, true)
assert.equal(stepSiblingVisibility.dateOfBirth, true)
assert.equal(stepSiblingVisibility.howItEnded, false)

const currentPartnerVisibility = relationshipFieldVisibility(partner, asOf)
assert.equal(currentPartnerVisibility.clientRelationshipStatus, true)
assert.equal(currentPartnerVisibility.howItEnded, false)
assert.equal(currentPartnerVisibility.timeSinceEnded, false)
assert.equal(currentPartnerVisibility.dateOfBirth, true)
assert.equal(currentPartnerVisibility.lengthOfRelationship, true)
assert.equal(currentPartnerVisibility.dependency, true)

const priorPartnerVisibility = relationshipFieldVisibility(
  person({
    relationshipRecordId: "ex",
    relationshipToClient: "prior_partner",
    dateOfBirth: "1980-01-01",
    healthStatus: "good",
  }),
  asOf
)
assert.equal(priorPartnerVisibility.dateOfBirth, false)
assert.equal(priorPartnerVisibility.health, false)
assert.equal(priorPartnerVisibility.lengthOfRelationship, true)
assert.equal(priorPartnerVisibility.supportive, true)
assert.equal(priorPartnerVisibility.comment, true)
assert.equal(priorPartnerVisibility.dependency, false)
assert.equal(priorPartnerVisibility.livingSituation, false)
assert.equal(priorPartnerVisibility.clientRelationshipStatus, false)
assert.equal(priorPartnerVisibility.howItEnded, true)
assert.equal(priorPartnerVisibility.timeSinceEnded, true)

const adultChildVisibility = relationshipFieldVisibility(
  person({
    relationshipRecordId: "grown",
    relationshipToClient: "child_biological",
    dateOfBirth: "2000-01-01",
  }),
  asOf
)
assert.equal(adultChildVisibility.dependency, true)
assert.equal(adultChildVisibility.lengthOfRelationship, false)
assert.equal(adultChildVisibility.livingSituation, true)

const stepChildVisibility = relationshipFieldVisibility(
  person({
    relationshipRecordId: "step-child",
    relationshipToClient: "child_step",
    dateOfBirth: "2000-01-01",
  }),
  asOf
)
assert.equal(stepChildVisibility.lengthOfRelationship, true)
assert.equal(stepChildVisibility.dependency, true)

const minorVisibility = relationshipFieldVisibility(
  person({
    relationshipRecordId: "kid",
    relationshipToClient: "child_biological",
    dateOfBirth: "2015-01-01",
  }),
  asOf
)
assert.equal(minorVisibility.dependency, false)
assert.equal(minorVisibility.livingSituation, true)

const deceasedVisibility = relationshipFieldVisibility(
  person({
    relationshipRecordId: "late",
    relationshipToClient: "father",
    healthStatus: "deceased",
    dateOfBirth: "1950-01-01",
  }),
  asOf
)
assert.equal(deceasedVisibility.dependency, false)
assert.equal(deceasedVisibility.livingSituation, false)
assert.equal(deceasedVisibility.health, true)
assert.equal(deceasedVisibility.dateOfBirth, true)
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
      relationshipRecordId: "year-kid",
      relationshipToClient: "child_biological",
      dateOfBirth: "2014",
    }),
    "2026-10-02"
  ),
  true
)
assert.equal(
  isMinorChild(
    person({
      relationshipRecordId: "year-grown",
      relationshipToClient: "child_biological",
      dateOfBirth: "2014",
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

const sally = person({ relationshipRecordId: "sally", relationshipToClient: "mother", givenName: "Sally" })
const phil = person({ relationshipRecordId: "phil", relationshipToClient: "prior_partner", givenName: "Phil" })
const henry = person({
  relationshipRecordId: "henry",
  relationshipToClient: "child_biological",
  givenName: "Henry",
  linkedPartnerRecordId: "phil",
})
const unlinkedChild = person({
  relationshipRecordId: "unlinked-child",
  relationshipToClient: "child_biological",
  givenName: "No partner",
})
const stepPhil = person({ relationshipRecordId: "step-phil", relationshipToClient: "step_parent", givenName: "Phil" })
const stepSibling = person({
  relationshipRecordId: "step-sib",
  relationshipToClient: "sibling_step",
  givenName: "Robin",
  partnershipRecordId: "sally-phil",
})
const linkPeople = [sally, phil, henry, unlinkedChild, stepPhil, stepSibling]
const linkPartnerships = [
  partnership({ partnershipRecordId: "sally-phil", partnerAId: "sally", partnerBId: "step-phil" }),
]
assert.deepEqual(relationshipLinkLine(henry, linkPeople, linkPartnerships), {
  label: "Associated partner",
  value: "Phil (Prior partner)",
})
assert.deepEqual(relationshipLinkLine(unlinkedChild, linkPeople, linkPartnerships), {
  label: "Associated partner",
  value: "Not linked to a partner",
})
assert.deepEqual(relationshipLinkLine(stepPhil, linkPeople, linkPartnerships), {
  label: "Associated parent",
  value: "Sally (Mother)",
})
assert.deepEqual(relationshipLinkLine(stepSibling, linkPeople, linkPartnerships), {
  label: "Associated step-parent",
  value: "Phil (Sally's partner)",
})

console.log("client background tree and age selftest passed")
