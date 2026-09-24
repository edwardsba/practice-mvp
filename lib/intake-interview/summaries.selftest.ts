import assert from "node:assert/strict"

import {
  buildFamilyOfOriginSlots,
  buildPartnersChildrenSlots,
  mergeRosterRecords,
} from "@/lib/intake-interview/roster"
import {
  numberWord,
  summariseFamilyOfOrigin,
  summarisePartnersAndChildren,
} from "@/lib/intake-interview/summaries"
import type {
  FamilyOfOriginRosterInput,
  PartnersChildrenRosterInput,
  RelationshipRecord,
} from "@/lib/intake-interview/types"
import { applyRelationshipVisibilityDefaults, relationshipFieldVisibility } from "@/lib/intake-interview/visibility"

function roster(partial: Partial<FamilyOfOriginRosterInput>): FamilyOfOriginRosterInput {
  return {
    parentsMaritalStatus: "",
    parentsMaritalStatusOther: "",
    parentCount: null,
    stepParentCount: null,
    fullSiblingCount: null,
    halfSiblingCount: null,
    stepSiblingCount: null,
    clientBirthOrder: "",
    ...partial,
  }
}

function blankRecord(
  partial: Partial<RelationshipRecord> &
    Pick<RelationshipRecord, "relationshipToClient" | "rosterKey">
): RelationshipRecord {
  return {
    relationshipRecordId: "id-" + partial.rosterKey,
    section: partial.section ?? "partners_and_children",
    displayOrder: 0,
    givenName: "",
    linkedPartnerRecordId: null,
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
    ...partial,
  }
}

assert.equal(numberWord(0), "zero")
assert.equal(numberWord(3), "three")
assert.equal(numberWord(21), "21")

assert.equal(
  summariseFamilyOfOrigin(roster({})),
  "You were an only child."
)
assert.equal(
  summariseFamilyOfOrigin(roster({ fullSiblingCount: 2, clientBirthOrder: "eldest" })),
  "You were the eldest of three siblings."
)
assert.equal(
  summariseFamilyOfOrigin(roster({ fullSiblingCount: 1, clientBirthOrder: "youngest" })),
  "You were the youngest of two siblings."
)
assert.equal(
  summariseFamilyOfOrigin(
    roster({
      fullSiblingCount: 1,
      halfSiblingCount: 1,
      clientBirthOrder: "eldest",
    })
  ),
  "You were the eldest of three siblings (one full sibling and one half-sibling)."
)
assert.equal(
  summariseFamilyOfOrigin(roster({ fullSiblingCount: 2 })),
  "You have two full siblings."
)
assert.equal(
  summariseFamilyOfOrigin(roster({ clientBirthOrder: "only", fullSiblingCount: 2 })),
  "You were an only child."
)

const familySlots = buildFamilyOfOriginSlots(
  roster({
    parentCount: 2,
    stepParentCount: 1,
    fullSiblingCount: 2,
    halfSiblingCount: null,
    stepSiblingCount: 0,
  })
)
assert.equal(familySlots.length, 5)
assert.equal(familySlots.filter((s) => s.relationshipToClient === "parent").length, 2)
assert.equal(familySlots.filter((s) => s.relationshipToClient === "step_parent").length, 1)
assert.equal(familySlots.filter((s) => s.relationshipToClient === "sibling_full").length, 2)

const blankCounts = buildFamilyOfOriginSlots(roster({}))
assert.equal(blankCounts.length, 0)

const partnerId = "partner-1"
const existingPartner = blankRecord({
  relationshipRecordId: partnerId,
  relationshipToClient: "prior_partner",
  rosterKey: "prior_partner.0",
  section: "partners_and_children",
})
const partnersRoster: PartnersChildrenRosterInput = {
  currentPartnerCount: 1,
  priorPartnerCount: 1,
  unlinkedChildCount: 1,
  childrenByPartnerId: {
    [partnerId]: { biological: 2, step: 1 },
  },
}
const partnerSlots = buildPartnersChildrenSlots(partnersRoster, [existingPartner])
assert.equal(
  partnerSlots.filter((s) => s.relationshipToClient === "current_partner").length,
  1
)
assert.equal(
  partnerSlots.filter((s) => s.relationshipToClient === "prior_partner").length,
  1
)
assert.equal(
  partnerSlots.filter((s) => s.relationshipToClient === "child_biological").length,
  3
)
assert.equal(
  partnerSlots.filter((s) => s.relationshipToClient === "child_step").length,
  1
)

const merged = mergeRosterRecords([existingPartner], partnerSlots)
const kept = merged.find((r) => r.rosterKey === "prior_partner.0")
assert.equal(kept?.relationshipRecordId, partnerId)
assert.ok(merged.some((r) => r.rosterKey === "current_partner.0"))

const childSlots = partnerSlots.filter((s) => s.linkedPartnerRosterKey === "prior_partner.0")
const mergedChildren = mergeRosterRecords(merged, partnerSlots).filter(
  (r) => r.linkedPartnerRecordId === partnerId
)
assert.equal(childSlots.length, 3)
assert.equal(mergedChildren.length, 3)

assert.equal(
  summarisePartnersAndChildren(partnersRoster, merged),
  "You have a current partner, one prior partner, and four children."
)
assert.equal(
  summarisePartnersAndChildren(
    {
      currentPartnerCount: null,
      priorPartnerCount: null,
      unlinkedChildCount: null,
      childrenByPartnerId: {},
    },
    []
  ),
  "You have no current or prior partners and no children."
)

const prior = relationshipFieldVisibility({
  relationshipToClient: "prior_partner",
  age: 40,
})
assert.equal(prior.qualityOfRelationship, false)
assert.equal(prior.dependency, false)
assert.equal(prior.livingSituation, false)
assert.equal(prior.timeSinceEnded, true)

const minor = relationshipFieldVisibility({
  relationshipToClient: "child_biological",
  age: 12,
})
assert.equal(minor.dependency, false)
assert.equal(
  applyRelationshipVisibilityDefaults(
    blankRecord({
      relationshipToClient: "child_biological",
      rosterKey: "c",
      age: 12,
    })
  ).dependency,
  "they_depend_on_me"
)

const adultChild = relationshipFieldVisibility({
  relationshipToClient: "child_step",
  age: 19,
})
assert.equal(adultChild.dependency, true)

const parentVis = relationshipFieldVisibility({
  relationshipToClient: "parent",
  age: 60,
})
assert.equal(parentVis.qualityOfRelationship, true)
assert.equal(parentVis.timeSinceEnded, false)

console.log("intake-interview summaries/roster/visibility selftest passed")
