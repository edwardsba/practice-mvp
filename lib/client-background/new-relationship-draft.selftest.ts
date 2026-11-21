import assert from "node:assert/strict"

import { isEmptyNewRelationshipDraft } from "@/lib/client-background/new-relationship-draft"

const emptyBlock = {
  status: "",
  statusDetail: "",
  arrangementType: "" as const,
  arrangementDetail: "",
  startedOn: "",
  endedOn: "",
  childrenAnswer: "" as const,
  siblingsAnswer: "" as const,
  noChildren: false,
}

const emptyPartner = {
  givenName: "",
  sex: "",
  dateOfBirth: "",
  healthStatus: "" as const,
  dateOfDeath: "",
  blockRoleType: "",
  caregiverRelationship: "",
  notKnown: false,
  deceased: false,
}

assert.equal(isEmptyNewRelationshipDraft(emptyBlock, emptyPartner), true)

assert.equal(
  isEmptyNewRelationshipDraft({ ...emptyBlock, status: "married" }, emptyPartner),
  false
)

assert.equal(
  isEmptyNewRelationshipDraft(emptyBlock, { ...emptyPartner, givenName: "Alex" }),
  false
)

assert.equal(
  isEmptyNewRelationshipDraft(
    { ...emptyBlock, arrangementType: "foster_care" as const },
    { ...emptyPartner, blockRoleType: "foster_carer" }
  ),
  false
)

console.log("new-relationship-draft.selftest.ts: ok")
