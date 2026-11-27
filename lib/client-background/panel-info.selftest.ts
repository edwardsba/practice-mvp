import assert from "node:assert/strict"

import {
  NOT_RECORDED,
  eventInfoGroups,
  issueInfoGroups,
  personInfoGroups,
  relationshipInfoGroups,
} from "@/lib/client-background/panel-info"
import { relationshipHeadingAllowsAdd } from "@/lib/client-background/relationship-tree"
import type {
  EventRecord,
  HistoryIssue,
  RelationshipBlock,
  RelationshipRecord,
} from "@/lib/client-background/types"
import { emptyEvent } from "@/lib/client-background/types"

function person(partial: Partial<RelationshipRecord>): RelationshipRecord {
  return {
    relationshipRecordId: "p1",
    relationshipBlockId: "b1",
    relationshipToClient: "current_partner",
    givenName: "",
    sex: "",
    dateOfBirth: "",
    dateOfDeath: "",
    deceased: false,
    ageAtDeath: null,
    healthOrCauseOfDeath: "",
    childTypeDetail: "",
    notKnown: false,
    healthStatus: "",
    supportive: "",
    conflict: "",
    qualityOfRelationship: "",
    dependency: "",
    livingSituation: "",
    blockRole: "partner",
    blockRoleType: "",
    caregiverRelationship: "",
    caregiverRelationshipDetail: "",
    displayOrder: 0,
    placementReview: "",
    ...partial,
  }
}

function block(partial: Partial<RelationshipBlock>): RelationshipBlock {
  return {
    relationshipBlockId: "b1",
    kind: "client_previous",
    parentRecordId: null,
    parentSide: "",
    status: "",
    statusDetail: "",
    arrangementType: "",
    arrangementDetail: "",
    startedOn: "",
    endedOn: "",
    childrenAnswer: "",
    siblingsAnswer: "",
    displayOrder: 0,
    ...partial,
  }
}

// —— Person: every field present; empties marked Not recorded ——
const emptyPersonGroups = personInfoGroups(person({}))
assert.equal(emptyPersonGroups.length, 4)
assert.equal(emptyPersonGroups[0]!.title, "Person's details")
assert.equal(emptyPersonGroups[1]!.title, "Health")
assert.equal(emptyPersonGroups[2]!.title, "Home")
assert.equal(emptyPersonGroups[3]!.title, "Relationship with client")
for (const group of emptyPersonGroups) {
  assert.ok(group.fields.length > 0, group.id)
  for (const row of group.fields) {
    if (row.empty) assert.equal(row.value, NOT_RECORDED)
  }
}
const named = personInfoGroups(
  person({ givenName: "Phil", sex: "Male", dateOfBirth: "1970-01-01" }),
  { asOf: "2026-01-01" }
)
assert.equal(named[0]!.fields.find((f) => f.label === "Name")!.value, "Phil")
assert.equal(named[0]!.fields.find((f) => f.label === "Name")!.empty, false)
assert.equal(named[0]!.fields.find((f) => f.label === "Sex")!.value, "Male")

// —— Relationship ——
const relGroups = relationshipInfoGroups(
  block({ status: "divorced", startedOn: "1972", endedOn: "2020" })
)
assert.equal(relGroups.length, 1)
assert.equal(relGroups[0]!.title, "Relationship")
assert.equal(
  relGroups[0]!.fields.find((f) => f.label === "Relationship status")!.value,
  "Divorced"
)
const emptyRel = relationshipInfoGroups(block({}))
assert.ok(emptyRel[0]!.fields.some((f) => f.empty && f.value === NOT_RECORDED))

// —— Issue ——
const issue: HistoryIssue = {
  issueId: "i1",
  category: "emotional_problems",
  about: "self",
  relationshipRecordId: null,
  aboutOther: "",
  title: "",
  treatmentAnswer: "",
  displayOrder: 0,
}
const issueGroups = issueInfoGroups(issue)
assert.equal(issueGroups.map((g) => g.title).join(","), "Issue,Course")
assert.ok(issueGroups[0]!.fields.some((f) => f.label === "Title" && f.empty))

// —— Event ——
const event: EventRecord = {
  ...emptyEvent("emotional_problems", 0),
  eventRecordId: "e1",
  title: "",
  description: "",
}
const eventGroups = eventInfoGroups(event)
assert.equal(eventGroups[0]!.title, "Event")
assert.ok(eventGroups[0]!.fields.some((f) => f.label === "Title" && f.value === NOT_RECORDED))
assert.ok(eventGroups[0]!.fields.some((f) => f.label === "Description" && f.empty))

// —— ⊕ on headings regardless of names / Not asked (Father case) ——
assert.equal(relationshipHeadingAllowsAdd("not_asked"), true)
assert.equal(relationshipHeadingAllowsAdd(""), true)
assert.equal(relationshipHeadingAllowsAdd(null), true)
assert.equal(relationshipHeadingAllowsAdd("yes"), true)
assert.equal(relationshipHeadingAllowsAdd("none"), false)

console.log("panel-info selftest passed")
