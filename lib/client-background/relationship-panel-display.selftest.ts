import assert from "node:assert/strict"

import {
  childrenAnswerLabel,
  dateWithDuration,
  partOfLine,
  partnerLivingSituationShort,
  personCardSubtitle,
  personFormGroupOrder,
  PERSON_FORM_GROUP_IDS,
  PERSON_FORM_GROUP_LABELS,
  relationshipPanelSubtitle,
  relationshipViewGroups,
} from "@/lib/client-background/relationship-panel-display"
import { refuseEmptyPersonDraft, EMPTY_PERSON_DRAFT_ERROR } from "@/lib/client-background/person-draft"
import type { RelationshipBlock, RelationshipRecord } from "@/lib/client-background/types"

function person(partial: Partial<RelationshipRecord> & Pick<RelationshipRecord, "relationshipRecordId">): RelationshipRecord {
  return {
    relationshipToClient: "child_biological",
    sex: "",
    givenName: "",
    displayOrder: 0,
    dateOfBirth: "",
    healthStatus: "",
    deceased: false,
    ageAtDeath: null,
    dateOfDeath: "",
    healthOrCauseOfDeath: "",
    childTypeDetail: "",
    supportive: "",
    conflict: "",
    qualityOfRelationship: "",
    dependency: "",
    livingSituation: "",
    caregiverRelationship: "",
    caregiverRelationshipDetail: "",
    notKnown: false,
    relationshipBlockId: "b1",
    blockRole: "child",
    blockRoleType: "",
    placementReview: "",
    ...partial,
  }
}

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
    childrenAnswer: "",
    siblingsAnswer: "",
    displayOrder: 0,
    ...partial,
  }
}

// —— Card subtitle: role · age · type ——
assert.equal(
  personCardSubtitle(
    person({
      relationshipRecordId: "c1",
      givenName: "Max",
      sex: "Male",
      dateOfBirth: "2020-01-01",
      blockRole: "child",
      blockRoleType: "adopted",
    }),
    block({ relationshipBlockId: "b1", kind: "client_current", status: "married", startedOn: "2014" }),
    "2026-11-05"
  ),
  "Son · 6 · adopted"
)

assert.equal(
  personCardSubtitle(
    person({
      relationshipRecordId: "c2",
      givenName: "Sam",
      sex: "Female",
      dateOfBirth: "2018",
      blockRole: "child",
      blockRoleType: "step_child",
    }),
    block({ relationshipBlockId: "b1", kind: "client_current", status: "married", startedOn: "2014" }),
    "2026-11-05"
  ),
  "Daughter · 8 · step-child"
)

assert.equal(
  personCardSubtitle(
    person({
      relationshipRecordId: "p1",
      givenName: "Jordan",
      sex: "Female",
      dateOfBirth: "1977-01-01",
      blockRole: "partner",
      livingSituation: "lives_with_client_full_time",
      relationshipToClient: "current_partner",
    }),
    block({ relationshipBlockId: "b1", kind: "client_current", status: "married", startedOn: "2014" }),
    "2026-11-05"
  ),
  "Wife · 49 · lives with client"
)

assert.equal(partnerLivingSituationShort("lives_with_client_full_time"), "lives with client")
assert.equal(partnerLivingSituationShort("does_not_live_with_client"), "does not live with client")

// —— Part of line ——
const married = block({
  relationshipBlockId: "b1",
  kind: "client_current",
  status: "married",
  startedOn: "2014",
  childrenAnswer: "yes",
})
const jordan = person({
  relationshipRecordId: "p1",
  givenName: "Jordan",
  sex: "Female",
  blockRole: "partner",
  relationshipToClient: "current_partner",
  livingSituation: "lives_with_client_full_time",
})
const max = person({
  relationshipRecordId: "c1",
  givenName: "Max",
  sex: "Male",
  dateOfBirth: "2020-01-01",
  blockRole: "child",
  blockRoleType: "adopted",
})

assert.equal(partOfLine(max, married, [jordan, max], "Tom"), "Child of Tom and Jordan · Married since 2014")
assert.equal(partOfLine(jordan, married, [jordan, max], "Tom"), "Wife · Married since 2014")

// —— Duration text ——
assert.equal(dateWithDuration("2014", "", "2026-11-05"), "2014 · 12 years")
assert.equal(dateWithDuration("2005", "2011", "2026-11-05"), "2005 · 6 years")
assert.equal(dateWithDuration("", "", "2026-11-05"), "")

// —— Group order for each role ——
for (const role of ["child", "partner", "sibling", "parent", "caregiver"] as const) {
  assert.deepEqual(personFormGroupOrder(role), PERSON_FORM_GROUP_IDS)
}
assert.equal(PERSON_FORM_GROUP_LABELS.details, "Person's details")
assert.equal(PERSON_FORM_GROUP_LABELS.health, "Health")
assert.equal(PERSON_FORM_GROUP_LABELS.living, "Home")
assert.equal(PERSON_FORM_GROUP_LABELS.quality, "Relationship with client")

assert.deepEqual(
  relationshipViewGroups("client_current").map((g) => g.label),
  ["Relationship", "Partner", "Children"]
)
assert.deepEqual(
  relationshipViewGroups("biological_parents").map((g) => g.label),
  ["Relationship", "Parents", "Siblings"]
)
assert.deepEqual(
  relationshipViewGroups("parent_other").map((g) => g.label),
  ["Relationship", "Partner", "Siblings"]
)
assert.deepEqual(
  relationshipViewGroups("caregiver_arrangement").map((g) => g.label),
  ["Arrangement", "Caregiver"]
)
assert.deepEqual(
  relationshipViewGroups("client_other_children").map((g) => g.label),
  ["Relationship", "Children"]
)

assert.equal(relationshipPanelSubtitle({ kind: "client_current" }), "Current relationship")
assert.equal(relationshipPanelSubtitle({ kind: "client_previous" }), "Previous relationship")

assert.equal(childrenAnswerLabel("yes"), "Yes")
assert.equal(childrenAnswerLabel("none"), "None")
assert.equal(childrenAnswerLabel("not_asked"), "Not asked")
assert.equal(childrenAnswerLabel(""), "Not recorded")

// —— Empty History person refused ——
assert.equal(refuseEmptyPersonDraft({ givenName: "", blockRoleType: "" }), EMPTY_PERSON_DRAFT_ERROR)
assert.equal(refuseEmptyPersonDraft({ givenName: "Ella", blockRoleType: "" }), null)

console.log("relationship-panel-display.selftest.ts: ok")
