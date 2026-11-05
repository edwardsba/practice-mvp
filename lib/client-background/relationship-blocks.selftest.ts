import assert from "node:assert/strict"

import {
  answerAfterBlockCount,
  mapRelationshipsToBlocks,
  previousStatusFromPartner,
  statusesForBlock,
} from "@/lib/client-background/relationship-blocks"
import type { PartnershipRecord, RelationshipBlock, RelationshipRecord } from "@/lib/client-background/types"
import {
  childrenFromBlocks,
  endedRelationshipClause,
  parentsFromBlocks,
  partnersFromBlocks,
  siblingsFromBlocks,
} from "@/lib/reports/relationship-block-report"
import type { ReportVoice } from "@/lib/reports/background-report-prose"

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
    lengthOfRelationship: "",
    relationshipStatus: "",
    howEnded: "",
    laterRelationships: "",
    childType: "",
    childTypeDetail: "",
    timeSinceEnded: "",
    supportive: "",
    conflict: "",
    qualityOfRelationship: "",
    dependency: "",
    livingSituation: "",
    caregiverRelationship: "",
    caregiverRelationshipDetail: "",
    startedOn: "",
    endedOn: "",
    partnerType: "",
    parentType: "",
    adoptedOn: "",
    notKnown: false,
    otherParentKind: "",
    otherParentDetail: "",
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

assert.deepEqual(statusesForBlock("client_current"), [
  "married",
  "defacto",
  "engaged",
  "dating",
  "in_relationship_not_living_together",
  "other",
])
assert.ok(statusesForBlock("client_previous").includes("divorced"))
assert.ok(statusesForBlock("client_previous").includes("partner_died"))
assert.equal(statusesForBlock("client_previous").includes("never_in_a_relationship"), false)
assert.ok(statusesForBlock("biological_parents").includes("never_in_a_relationship"))
assert.ok(statusesForBlock("biological_parents").includes("married"))
assert.ok(statusesForBlock("parent_other").includes("married"))
assert.equal(statusesForBlock("parent_other").includes("never_in_a_relationship"), false)
assert.deepEqual(statusesForBlock("caregiver_arrangement"), [])
assert.deepEqual(statusesForBlock("client_other_children"), [])

assert.equal(previousStatusFromPartner("married", "divorced"), "divorced")
assert.equal(previousStatusFromPartner("married", "separated"), "married_separated")
assert.equal(previousStatusFromPartner("married", "partner_died"), "widowed")
assert.equal(previousStatusFromPartner("defacto", "separated"), "defacto_separated")
assert.equal(previousStatusFromPartner("defacto", "partner_died"), "partner_died")
assert.equal(previousStatusFromPartner("engaged", "separated"), "engagement_ended")
assert.equal(previousStatusFromPartner("dating", "separated"), "relationship_ended")
assert.equal(previousStatusFromPartner("", "partner_died"), "partner_died")
assert.equal(previousStatusFromPartner("married", ""), "")

assert.equal(answerAfterBlockCount(2), "yes")
assert.equal(answerAfterBlockCount(1), "yes")
assert.equal(answerAfterBlockCount(0), "not_asked")

const ben = mapRelationshipsToBlocks({
  clientStatus: "married",
  people: [
    person({ relationshipRecordId: "wife", relationshipToClient: "current_partner", sex: "Female", givenName: "Ann", startedOn: "2014", displayOrder: 1 }),
    person({
      relationshipRecordId: "sam",
      relationshipToClient: "prior_partner",
      givenName: "Sam",
      partnerType: "married",
      howEnded: "divorced",
      startedOn: "1998",
      endedOn: "2003",
      displayOrder: 2,
    }),
    person({
      relationshipRecordId: "older",
      relationshipToClient: "prior_partner",
      givenName: "Pat",
      partnerType: "defacto",
      howEnded: "separated",
      startedOn: "1990",
      endedOn: "1994",
      displayOrder: 3,
    }),
    person({
      relationshipRecordId: "child-linked",
      relationshipToClient: "child_biological",
      givenName: "Chris",
      childType: "biological",
      linkedPartnerRecordId: "wife",
    }),
    person({
      relationshipRecordId: "child-donor",
      relationshipToClient: "child_biological",
      givenName: "River",
      childType: "biological",
      otherParentKind: "donor_conception",
    }),
    person({
      relationshipRecordId: "child-loose",
      relationshipToClient: "child_biological",
      givenName: "Loose",
      childType: "biological",
    }),
    person({ relationshipRecordId: "mother", relationshipToClient: "mother", sex: "Female", givenName: "Margaret", laterRelationships: "yes" }),
    person({ relationshipRecordId: "father", relationshipToClient: "father", sex: "Male", givenName: "John", laterRelationships: "none" }),
    person({ relationshipRecordId: "sib-full", relationshipToClient: "sibling_full", givenName: "Alex" }),
    person({ relationshipRecordId: "step-parent", relationshipToClient: "step_parent", sex: "Male", givenName: "Steve" }),
    person({
      relationshipRecordId: "half",
      relationshipToClient: "sibling_half",
      givenName: "Helen",
      partnershipRecordId: "mother-steve",
    }),
    person({ relationshipRecordId: "donald", relationshipToClient: "sibling_step", givenName: "Donald" }),
    person({
      relationshipRecordId: "gran",
      relationshipToClient: "other_caregiver",
      givenName: "Nan",
      caregiverRelationship: "grandparent",
      startedOn: "1978",
      endedOn: "1982",
    }),
    person({
      relationshipRecordId: "adoptive-mother",
      relationshipToClient: "mother",
      sex: "Female",
      givenName: "Ada",
      parentType: "adoptive",
      adoptedOn: "1972",
    }),
    person({ relationshipRecordId: "adoptive-sib", relationshipToClient: "sibling_adoptive", givenName: "Ian" }),
  ],
  partnerships: [
    partnership({
      partnershipRecordId: "parents",
      partnerAId: "mother",
      partnerBId: "father",
      relationshipStatus: "divorced",
      started: "1968",
      ended: "1978",
    }),
    partnership({
      partnershipRecordId: "mother-steve",
      partnerAId: "mother",
      partnerBId: "step-parent",
      relationshipStatus: "married",
      started: "1986",
      ended: "",
    }),
  ],
})

function membership(id: string) {
  const row = ben.membership.find((item) => item.relationshipRecordId === id)
  assert.ok(row, id)
  return row
}

function blockOf(id: string) {
  const member = membership(id)
  const block = ben.blocks.find((item) => item.relationshipBlockId === member.relationshipBlockId)
  assert.ok(block, id)
  return block
}

assert.equal(blockOf("wife").kind, "client_current")
assert.equal(blockOf("wife").status, "married")
assert.equal(blockOf("wife").startedOn, "2014")
assert.equal(membership("child-linked").relationshipBlockId, membership("wife").relationshipBlockId)
assert.equal(membership("child-linked").blockRole, "child")

assert.equal(blockOf("sam").kind, "client_previous")
assert.equal(blockOf("sam").status, "divorced")
assert.equal(blockOf("older").status, "defacto_separated")
const previous = ben.blocks.filter((block) => block.kind === "client_previous").sort((a, b) => a.displayOrder - b.displayOrder)
assert.equal(previous[0].relationshipBlockId, blockOf("sam").relationshipBlockId)
assert.equal(previous[1].relationshipBlockId, blockOf("older").relationshipBlockId)

assert.equal(blockOf("child-donor").kind, "client_other_children")
assert.equal(blockOf("child-loose").kind, "client_other_children")
assert.equal(membership("child-donor").placementReview, "")
assert.equal(membership("child-loose").placementReview, "unlinked_child")

assert.equal(blockOf("mother").kind, "biological_parents")
assert.equal(blockOf("father").kind, "biological_parents")
assert.equal(blockOf("sib-full").kind, "biological_parents")
assert.equal(membership("sib-full").blockRoleType, "full")
assert.equal(blockOf("mother").status, "divorced")
assert.equal(blockOf("mother").endedOn, "1978")

assert.equal(blockOf("step-parent").kind, "parent_other")
assert.equal(blockOf("step-parent").parentSide, "mother")
assert.equal(blockOf("step-parent").status, "married")
assert.equal(membership("half").relationshipBlockId, membership("step-parent").relationshipBlockId)
assert.equal(membership("half").blockRole, "sibling")
assert.equal(membership("half").blockRoleType, "half")

assert.equal(membership("donald").relationshipBlockId, null)
assert.equal(membership("donald").placementReview, "unplaced")

assert.equal(blockOf("gran").kind, "caregiver_arrangement")
assert.equal(blockOf("gran").arrangementType, "grandparent_care")
assert.equal(blockOf("gran").startedOn, "1978")
assert.equal(membership("gran").blockRole, "caregiver")

assert.equal(blockOf("adoptive-mother").arrangementType, "adoption")
assert.equal(blockOf("adoptive-mother").startedOn, "1972")
assert.equal(membership("adoptive-sib").relationshipBlockId, membership("adoptive-mother").relationshipBlockId)
assert.equal(membership("adoptive-sib").blockRoleType, "adoptive")

assert.equal(ben.answers.previousRelationships, "yes")
assert.equal(ben.answers.otherChildren, "yes")
assert.equal(ben.answers.motherOtherRelationships, "yes")
assert.equal(ben.answers.fatherOtherRelationships, "none")
assert.equal(ben.answers.caregiverArrangements, "yes")

const cleared = mapRelationshipsToBlocks({
  clientStatus: "",
  people: [person({ relationshipRecordId: "mother", relationshipToClient: "mother", laterRelationships: "yes" })],
  partnerships: [],
})
assert.equal(cleared.answers.motherOtherRelationships, "yes")
assert.equal(cleared.blocks.filter((block) => block.kind === "parent_other").length, 0)
assert.equal(answerAfterBlockCount(0), "not_asked")

const he: ReportVoice = { kind: "he", subject: "he", Subject: "He", possessive: "his", Possessive: "His", object: "him" }

function block(partial: Partial<RelationshipBlock> & Pick<RelationshipBlock, "relationshipBlockId" | "kind">): RelationshipBlock {
  return {
    parentRecordId: null,
    parentSide: "",
    status: "",
    statusDetail: "",
    arrangementType: "",
    arrangementDetail: "",
    startedOn: "",
    endedOn: "",
    noChildren: false,
    displayOrder: 0,
    ...partial,
  }
}

const wife = person({
  relationshipRecordId: "wife",
  relationshipToClient: "current_partner",
  sex: "Female",
  dateOfBirth: "1977-01-01",
  relationshipBlockId: "ended",
  blockRole: "partner",
})
const herPartner = person({
  relationshipRecordId: "other-partner",
  relationshipToClient: "current_partner",
  sex: "Male",
  dateOfBirth: "1975-01-01",
  relationshipBlockId: "ended",
  blockRole: "partner",
})
const endedBlock = block({
  relationshipBlockId: "ended",
  kind: "client_previous",
  startedOn: "1998",
  endedOn: "2003",
})
for (const status of ["divorced", "married_separated", "defacto_separated", "engagement_ended", "relationship_ended", "widowed", "partner_died"] as const) {
  const clause = endedRelationshipClause({ ...endedBlock, status }, [wife], he, "2026-11-05")
  if (status === "divorced") assert.match(clause, /was married to his wife, 49, from 1998 to 2003, and the marriage ended in divorce/)
  if (status === "married_separated") assert.match(clause, /was married to his wife, 49, from 1998 to 2003, and they separated/)
  if (status === "defacto_separated") assert.match(clause, /was in a de facto relationship with a woman, 49, from 1998 to 2003, which ended in separation/)
  if (status === "engagement_ended") assert.match(clause, /was engaged to a woman, 49, from 1998 to 2003/)
  if (status === "relationship_ended") assert.match(clause, /was in a relationship with a woman, 49, from 1998 to 2003/)
  if (status === "widowed") assert.match(clause, /which ended when his wife died/)
  if (status === "partner_died") assert.match(clause, /which ended when his partner died/)
}
const twoPartners = endedRelationshipClause({ ...endedBlock, status: "divorced" }, [wife, herPartner], he, "2026-11-05")
assert.match(twoPartners, /his wife, 49, and her partner, 51/)

const currentA = block({ relationshipBlockId: "now-1", kind: "client_current", status: "married", startedOn: "2014", displayOrder: 0 })
const currentB = block({ relationshipBlockId: "now-2", kind: "client_current", status: "dating", displayOrder: 1 })
const ann = person({ relationshipRecordId: "ann", relationshipToClient: "current_partner", sex: "Female", relationshipBlockId: "now-1", blockRole: "partner" })
const bea = person({ relationshipRecordId: "bea", relationshipToClient: "current_partner", sex: "Female", relationshipBlockId: "now-2", blockRole: "partner" })
const twoCurrent = partnersFromBlocks("Ben01", he, "married", [currentA, currentB], [ann, bea], "2026-11-05")
assert.match(twoCurrent ?? "", /Ben01 has been married to his wife since 2014, with no children/)
assert.match(twoCurrent ?? "", /Ben01 has been dating a woman, with no children/)

const other = block({ relationshipBlockId: "others", kind: "client_other_children" })
const loose = person({
  relationshipRecordId: "loose",
  relationshipToClient: "child_biological",
  relationshipBlockId: "others",
  blockRole: "child",
  blockRoleType: "biological",
  childType: "biological",
  dateOfBirth: "2016-01-01",
})
assert.match(childrenFromBlocks("Ben01", [other], [loose], "2026-11-05") ?? "", /one child in total, a biological child aged/)

const motherBlock = block({
  relationshipBlockId: "mum-later",
  kind: "parent_other",
  parentSide: "mother",
  status: "married",
  startedOn: "1981",
  endedOn: "1990",
})
const bare = block({ relationshipBlockId: "mum-bare", kind: "parent_other", parentSide: "mother" })
const parentsText = parentsFromBlocks(
  "Ben01",
  he,
  "1970-01-15",
  [
    block({ relationshipBlockId: "bio", kind: "biological_parents", status: "divorced", endedOn: "1978" }),
    block({ relationshipBlockId: "adopt", kind: "caregiver_arrangement", arrangementType: "adoption", startedOn: "1972" }),
    motherBlock,
    bare,
  ],
  [
    person({ relationshipRecordId: "mother", relationshipToClient: "mother", sex: "Female", relationshipBlockId: "bio", blockRole: "parent", blockRoleType: "mother" }),
    person({ relationshipRecordId: "father", relationshipToClient: "father", sex: "Male", healthStatus: "deceased", deceased: true, dateOfDeath: "1993", relationshipBlockId: "bio", blockRole: "parent", blockRoleType: "father" }),
    person({ relationshipRecordId: "sib-a", relationshipToClient: "sibling_full", sex: "Male", dateOfBirth: "1978-01-01", relationshipBlockId: "bio", blockRole: "sibling", blockRoleType: "full" }),
    person({ relationshipRecordId: "sib-b", relationshipToClient: "sibling_full", sex: "Male", relationshipBlockId: "bio", blockRole: "sibling", blockRoleType: "full" }),
    person({ relationshipRecordId: "donald", relationshipToClient: "sibling_step", sex: "Male", dateOfBirth: "1998-01-01", relationshipBlockId: "mum-later", blockRole: "sibling", blockRoleType: "step" }),
  ],
  {
    previousRelationships: "not_asked",
    otherChildren: "not_asked",
    motherOtherRelationships: "yes",
    fatherOtherRelationships: "none",
    caregiverArrangements: "yes",
  },
  "2026-11-05"
)
assert.match(parentsText ?? "", /Ben01 was adopted in 1972, at the age of 2/)
assert.match(parentsText ?? "", /His parents divorced in 1978, when Ben01 was 8/)
assert.match(parentsText ?? "", /His father died in 1993, when Ben01 was 23/)
assert.match(parentsText ?? "", /one other relationship/)
assert.match(parentsText ?? "", /His father has had no later relationships/)

const siblingText = siblingsFromBlocks(
  "Ben01",
  he,
  "1970-01-15",
  [
    block({ relationshipBlockId: "bio", kind: "biological_parents" }),
    block({ relationshipBlockId: "mum-later", kind: "parent_other", parentSide: "mother" }),
  ],
  [
    person({ relationshipRecordId: "sib-a", relationshipToClient: "sibling_full", sex: "Male", dateOfBirth: "1978-01-01", relationshipBlockId: "bio", blockRole: "sibling", blockRoleType: "full" }),
    person({ relationshipRecordId: "sib-b", relationshipToClient: "sibling_full", sex: "Male", relationshipBlockId: "bio", blockRole: "sibling", blockRoleType: "full" }),
    person({ relationshipRecordId: "donald", relationshipToClient: "sibling_step", sex: "Male", dateOfBirth: "1998-01-01", relationshipBlockId: "mum-later", blockRole: "sibling", blockRoleType: "step" }),
  ],
  "2026-11-05"
)
assert.match(siblingText ?? "", /both brothers, one aged/)
assert.match(siblingText ?? "", /one maternal step-sibling/)

const deadBrother = person({
  relationshipRecordId: "dead-bro",
  relationshipToClient: "sibling_full",
  sex: "Male",
  dateOfBirth: "1968-01-01",
  deceased: true,
  dateOfDeath: "1989",
  relationshipBlockId: "bio",
  blockRole: "sibling",
  blockRoleType: "full",
})
const youngerBrother = person({
  relationshipRecordId: "young-bro",
  relationshipToClient: "sibling_full",
  sex: "Male",
  dateOfBirth: "1972-01-01",
  relationshipBlockId: "bio",
  blockRole: "sibling",
  blockRoleType: "full",
})
const deathText = siblingsFromBlocks("Ben01", he, "1970-01-15", [block({ relationshipBlockId: "bio", kind: "biological_parents" })], [deadBrother, youngerBrother], "2026-11-05")
assert.match(deathText ?? "", /His first brother died when Ben01 was 19/)

console.log("relationship blocks selftest passed")
