import assert from "node:assert/strict"

import {
  NEW_CURRENT_RELATIONSHIP,
  NEW_PREVIOUS_RELATIONSHIP,
  answerAfterBlockCount,
  moveDestinationKind,
  moveDestinations,
  statusesForBlock,
} from "@/lib/client-background/relationship-blocks"
import type { RelationshipBlock, RelationshipRecord } from "@/lib/client-background/types"
import {
  childrenFromBlocks,
  combinedLaterClause,
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
assert.equal(answerAfterBlockCount(2), "yes")
assert.equal(answerAfterBlockCount(1), "yes")
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
  if (status === "divorced") assert.match(clause, /was married to a woman \(49 years old\) from 1998 to 2003 \(5 years\), and the marriage ended in divorce/)
  if (status === "married_separated") assert.match(clause, /was married to a woman \(49 years old\) from 1998 to 2003 \(5 years\), and they separated/)
  if (status === "defacto_separated") assert.match(clause, /was in a de facto relationship with a woman \(49 years old\) from 1998 to 2003 \(5 years\), which ended in separation/)
  if (status === "engagement_ended") assert.match(clause, /was engaged to a woman \(49 years old\) from 1998 to 2003 \(5 years\)/)
  if (status === "relationship_ended") assert.match(clause, /was in a relationship with a woman \(49 years old\) from 1998 to 2003 \(5 years\)/)
  if (status === "widowed") assert.match(clause, /which ended when his wife died/)
  if (status === "partner_died") assert.match(clause, /which ended when his partner died/)
}
const twoPartners = endedRelationshipClause({ ...endedBlock, status: "divorced" }, [wife, herPartner], he, "2026-11-05")
assert.match(twoPartners, /a woman \(49 years old\) and a man \(51 years old\)/)

const currentA = block({ relationshipBlockId: "now-1", kind: "client_current", status: "married", startedOn: "2014", displayOrder: 0 })
const currentB = block({ relationshipBlockId: "now-2", kind: "client_current", status: "dating", displayOrder: 1 })
const ann = person({ relationshipRecordId: "ann", relationshipToClient: "current_partner", sex: "Female", relationshipBlockId: "now-1", blockRole: "partner" })
const bea = person({ relationshipRecordId: "bea", relationshipToClient: "current_partner", sex: "Female", relationshipBlockId: "now-2", blockRole: "partner" })
const twoCurrent = partnersFromBlocks("Ben01", he, "married", [currentA, currentB], [ann, bea], "2026-11-05")
assert.match(twoCurrent ?? "", /Ben01 has been married to his wife since 2014 \(12 years\)\. They do not have any children/)
assert.match(twoCurrent ?? "", /Ben01 has been dating a woman\. They do not have any children/)

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
assert.match(siblingText ?? "", /one maternal step-brother/)

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

const destinations = moveDestinations([
  block({ relationshipBlockId: "now", kind: "client_current", status: "married" }),
  block({ relationshipBlockId: "then", kind: "client_previous", status: "divorced" }),
])
assert.deepEqual(
  destinations.map((item) => item.id),
  ["now", "then", NEW_CURRENT_RELATIONSHIP, NEW_PREVIOUS_RELATIONSHIP]
)
assert.equal(moveDestinationKind([block({ relationshipBlockId: "now", kind: "client_current" })], NEW_PREVIOUS_RELATIONSHIP), "client_previous")
assert.ok(destinations.some((item) => item.label === "+ New previous relationship"))
assert.match(combinedLaterClause("divorced", 2) ?? "", /has remarried twice, and both marriages ended in divorce/)
const twice = parentsFromBlocks(
  "Ben01",
  he,
  "1970-01-15",
  [
    block({ relationshipBlockId: "m1", kind: "parent_other", parentSide: "mother", status: "divorced" }),
    block({ relationshipBlockId: "m2", kind: "parent_other", parentSide: "mother", status: "divorced" }),
  ],
  [],
  {
    previousRelationships: "not_asked",
    otherChildren: "not_asked",
    motherOtherRelationships: "yes",
    fatherOtherRelationships: "not_asked",
    caregiverArrangements: "not_asked",
  },
  "2026-11-05"
)
assert.match(twice ?? "", /Ben01's mother has remarried twice, and both marriages ended in divorce/)
assert.doesNotMatch(twice ?? "", /she remarried and remarried/)

const adoptedText = siblingsFromBlocks(
  "Ben01",
  he,
  "1970-01-15",
  [
    block({ relationshipBlockId: "bio", kind: "biological_parents" }),
    block({ relationshipBlockId: "mum-later", kind: "parent_other", parentSide: "mother" }),
  ],
  [
    person({ relationshipRecordId: "harry", relationshipToClient: "sibling_full", givenName: "Harry", sex: "Male", dateOfBirth: "1968-01-01", relationshipBlockId: "bio", blockRole: "sibling", blockRoleType: "full" }),
    person({ relationshipRecordId: "ann", relationshipToClient: "sibling_full", givenName: "Ann", sex: "Female", dateOfBirth: "1974-01-01", relationshipBlockId: "bio", blockRole: "sibling", blockRoleType: "full" }),
    person({ relationshipRecordId: "michael", relationshipToClient: "sibling_full", givenName: "Michael", sex: "Male", deceased: true, dateOfDeath: "1989", relationshipBlockId: "bio", blockRole: "sibling", blockRoleType: "full" }),
    person({ relationshipRecordId: "nick", relationshipToClient: "sibling_adoptive", givenName: "Nick", sex: "Male", dateOfBirth: "1971-01-01", relationshipBlockId: "bio", blockRole: "sibling", blockRoleType: "adopted" }),
    person({ relationshipRecordId: "rose", relationshipToClient: "sibling_half", givenName: "Rose", sex: "Female", dateOfBirth: "1986-01-01", relationshipBlockId: "mum-later", blockRole: "sibling", blockRoleType: "half" }),
  ],
  "2026-11-05"
)
assert.match(adoptedText ?? "", /the second-eldest of his full siblings/)
assert.match(adoptedText ?? "", /three full siblings \(Harry, 58; Ann, 52; and Michael, deceased\)/)
assert.match(adoptedText ?? "", /one adopted brother \(Nick, 55\)/)
assert.match(adoptedText ?? "", /one maternal half-sister \(Rose, 40\)/)
assert.match(adoptedText ?? "", /five siblings in total/)
const fullAt = (adoptedText ?? "").indexOf("three full siblings")
const adoptedAt = (adoptedText ?? "").indexOf("one adopted brother")
const halfAt = (adoptedText ?? "").indexOf("one maternal half-sister")
assert.ok(fullAt >= 0 && fullAt < adoptedAt && adoptedAt < halfAt)

const semicolon = parentsFromBlocks(
  "Ben01",
  he,
  "1970-01-15",
  [
    block({ relationshipBlockId: "m-married", kind: "parent_other", parentSide: "mother", status: "divorced", startedOn: "1981", endedOn: "1990" }),
    block({ relationshipBlockId: "m-now", kind: "parent_other", parentSide: "mother", status: "defacto", startedOn: "2010" }),
  ],
  [
    person({ relationshipRecordId: "phil", relationshipToClient: "step_parent", givenName: "Phil", sex: "Male", relationshipBlockId: "m-married", blockRole: "partner" }),
    person({ relationshipRecordId: "larry", relationshipToClient: "step_parent", givenName: "Larry", sex: "Male", relationshipBlockId: "m-now", blockRole: "partner" }),
  ],
  {
    previousRelationships: "not_asked",
    otherChildren: "not_asked",
    motherOtherRelationships: "yes",
    fatherOtherRelationships: "not_asked",
    caregiverArrangements: "not_asked",
  },
  "2026-11-05"
)
assert.match(semicolon ?? "", /that marriage ended when he was 20; since 2010 she has been in a de facto relationship \(Larry\)/)
assert.doesNotMatch(semicolon ?? "", /20, and since 2010/)

console.log("relationship blocks selftest passed")
