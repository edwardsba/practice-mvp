import assert from "node:assert/strict"

import {
  emptyBlockAnswers,
  emptyClientRelationshipStatus,
  emptyDemographics,
  emptyHistoryIssue,
  emptyRisk,
  emptyStressors,
  type ClientBackgroundData,
  type RelationshipBlock,
  type RelationshipRecord,
} from "@/lib/client-background/types"
import { buildBackgroundPanelSummary } from "@/lib/clients/background-summary"

function person(
  partial: Partial<RelationshipRecord> &
    Pick<RelationshipRecord, "relationshipRecordId" | "relationshipToClient" | "givenName">
): RelationshipRecord {
  return {
    relationshipBlockId: null,
    blockRole: "",
    blockRoleType: "",
    sex: "",
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
    ...partial,
  }
}

function base(partial: Partial<ClientBackgroundData> = {}): ClientBackgroundData {
  return {
    dateOfBirth: "1975-03-14",
    backgroundCapturedAt: null,
    relationshipStatus: emptyClientRelationshipStatus(),
    demographics: emptyDemographics(),
    stressors: emptyStressors(),
    relationships: [],
    relationshipBlocks: [],
    blockAnswers: emptyBlockAnswers(),
    events: [],
    issues: [],
    risk: emptyRisk(),
    ...partial,
  }
}

const empty = buildBackgroundPanelSummary(null)
assert.equal(empty.relationship, "Not recorded")
assert.equal(empty.children, "Not recorded")
assert.equal(empty.livingSituation, "Not recorded")
assert.equal(empty.occupation, "Not recorded")
assert.equal(empty.history, "None recorded")
assert.equal(empty.intakeInterview, "Not yet completed")

const currentBlock: RelationshipBlock = {
  relationshipBlockId: "b1",
  kind: "client_current",
  parentRecordId: null,
  parentSide: "",
  status: "married",
  statusDetail: "",
  arrangementType: "",
  arrangementDetail: "",
  startedOn: "2005-06-01",
  endedOn: "",
  childrenAnswer: "yes",
  siblingsAnswer: "",
  displayOrder: 0,
}

const partner = person({
  relationshipRecordId: "r1",
  relationshipBlockId: "b1",
  blockRole: "partner",
  relationshipToClient: "current_partner",
  givenName: "Jordan",
  livingSituation: "lives_with_client_full_time",
})

const child = person({
  relationshipRecordId: "r2",
  relationshipBlockId: "b1",
  blockRole: "child",
  relationshipToClient: "child_biological",
  givenName: "Sam",
  livingSituation: "lives_with_client_full_time",
})

const withData = buildBackgroundPanelSummary(
  base({
    relationshipStatus: {
      relationshipStatus: "married",
      relationshipStatusOther: "",
    },
    relationshipBlocks: [currentBlock],
    relationships: [partner, child],
    demographics: {
      ...emptyDemographics(),
      occupation: {
        ...emptyDemographics().occupation,
        workStatus: "full_time",
        role: "Accountant",
      },
      livingSituation: {
        ...emptyDemographics().livingSituation,
        housingType: "Own home",
        livesWith: "with_partner_and_children",
      },
    },
    issues: [
      { issueId: "i1", ...emptyHistoryIssue("emotional_problems", "self", 0), title: "Depression" },
      { issueId: "i2", ...emptyHistoryIssue("substance_use", "self", 1), title: "Alcohol" },
      { issueId: "i3", ...emptyHistoryIssue("illness_injury", "self", 2), title: "Back pain" },
      { issueId: "i4", ...emptyHistoryIssue("emotional_problems", "self", 3), title: "Anxiety" },
    ],
    backgroundCapturedAt: "2026-10-10T00:00:00.000Z",
  })
)

assert.equal(withData.relationship, "Married to Jordan (since 2005)")
assert.equal(withData.children, "1 child")
assert.match(withData.livingSituation, /Own home/)
assert.equal(withData.occupation, "Employed full time · Accountant")
assert.equal(withData.history, "Depression, Alcohol, Back pain · + 1 more")
assert.match(withData.intakeInterview, /^Completed /)

const noneChildren = buildBackgroundPanelSummary(
  base({
    relationshipBlocks: [
      {
        ...currentBlock,
        childrenAnswer: "none",
        relationshipBlockId: "b2",
      },
    ],
  })
)
assert.equal(noneChildren.children, "None")

const single = buildBackgroundPanelSummary(
  base({
    relationshipStatus: { relationshipStatus: "single", relationshipStatusOther: "" },
  })
)
assert.equal(single.relationship, "Single")

console.log("background-summary.selftest.ts: ok")
