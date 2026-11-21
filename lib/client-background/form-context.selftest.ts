import assert from "node:assert/strict"

import { formatContextStrip, resolveFormContext } from "@/lib/client-background/form-context"
import { emptyHistoryIssue, type RelationshipBlock, type RelationshipRecord } from "@/lib/client-background/types"

const sally: RelationshipRecord = {
  relationshipRecordId: "sally",
  relationshipToClient: "mother",
  sex: "Female",
  givenName: "Sally",
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
  relationshipBlockId: "bio",
  blockRole: "parent",
  blockRoleType: "mother",
}

const motherOther: RelationshipBlock = {
  relationshipBlockId: "mo1",
  kind: "parent_other",
  parentRecordId: "sally",
  parentSide: "mother",
  status: "",
  statusDetail: "",
  arrangementType: "",
  arrangementDetail: "",
  startedOn: "",
  endedOn: "",
  childrenAnswer: "",
  siblingsAnswer: "",
  displayOrder: 0,
}

const depression = {
  issueId: "dep",
  ...emptyHistoryIssue("emotional_problems", "self", 0),
  title: "Depression",
}

const sallyCtx = resolveFormContext(
  { clientName: "Tom", about: "self", block: motherOther, person: sally },
  [sally]
)
assert.equal(formatContextStrip(sallyCtx.lines), "For: Sally (mother) · other relationships")
assert.equal(sallyCtx.blockId, "mo1")
assert.equal(sallyCtx.parentSide, "mother")

const aboutTom = resolveFormContext({
  clientName: "Tom",
  about: "self",
})
assert.equal(formatContextStrip(aboutTom.lines), "About: Tom (client)")
assert.equal(aboutTom.about, "self")

const depressionCtx = resolveFormContext({
  clientName: "Tom",
  about: "self",
  category: "emotional_problems",
  issue: depression,
})
assert.equal(formatContextStrip(depressionCtx.lines), "About: Tom (client) · For: Mental health › Depression")
assert.equal(depressionCtx.issueId, "dep")
assert.equal(depressionCtx.category, "emotional_problems")

const newIssueCtx = resolveFormContext({
  clientName: "Tom",
  about: "significant_other",
  category: "emotional_problems",
})
assert.equal(
  formatContextStrip(newIssueCtx.lines),
  "About: Family and significant others · Category: Mental health"
)
assert.equal(newIssueCtx.about, "significant_other")

console.log("form-context.selftest.ts: ok")
