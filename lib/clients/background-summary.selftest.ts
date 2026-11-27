import assert from "node:assert/strict"

import {
  emptyBlockAnswers,
  emptyClientRelationshipStatus,
  emptyDemographics,
  emptyHistoryIssue,
  emptyStressors,
  type ClientBackgroundData,
  type RelationshipBlock,
  type RelationshipRecord,
} from "@/lib/client-background/types"
import { buildBackgroundPanelSummary } from "@/lib/clients/background-summary"
import { tomExampleSource } from "@/lib/reports/tom-example-fixture"

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
  sex: "Female",
  livingSituation: "lives_with_client_full_time",
})

const child = person({
  relationshipRecordId: "r2",
  relationshipBlockId: "b1",
  blockRole: "child",
  blockRoleType: "biological",
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
        household: "with_others",
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
assert.equal(withData.livingSituation, "Own home · lives with wife and 1 child")
assert.equal(withData.occupation, "Employed full time · Accountant")
assert.equal(withData.history, "Depression, Alcohol, Back pain · + 1 more")
assert.match(withData.intakeInterview, /^Completed /)

// --- Children ---

const tom = tomExampleSource()
const tomSummary = buildBackgroundPanelSummary({
  dateOfBirth: tom.dateOfBirth,
  backgroundCapturedAt: "2026-10-01T00:00:00.000Z",
  relationshipStatus: tom.data.relationshipStatus,
  demographics: tom.data.demographics,
  stressors: tom.data.stressors,
  relationships: tom.data.relationships,
  relationshipBlocks: tom.data.relationshipBlocks,
  blockAnswers: tom.data.blockAnswers,
  events: tom.data.events,
  issues: tom.data.issues,
})
assert.equal(tomSummary.children, "4 children, 1 step-child")
assert.equal(
  tomSummary.livingSituation,
  "Own home · lives with wife, 3 children and 1 step-child"
)

const onlyStep = buildBackgroundPanelSummary(
  base({
    relationships: [
      person({
        relationshipRecordId: "s1",
        blockRole: "child",
        blockRoleType: "step_child",
        relationshipToClient: "child_step",
        givenName: "Alex",
      }),
      person({
        relationshipRecordId: "s2",
        blockRole: "child",
        blockRoleType: "step_child",
        relationshipToClient: "child_step",
        givenName: "Blair",
      }),
    ],
  })
)
assert.equal(onlyStep.children, "2 step-children")

const oneChild = buildBackgroundPanelSummary(
  base({
    relationships: [
      person({
        relationshipRecordId: "c1",
        blockRole: "child",
        blockRoleType: "adopted",
        relationshipToClient: "child_biological",
        givenName: "Max",
      }),
    ],
  })
)
assert.equal(oneChild.children, "1 child")

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

const notAskedChildren = buildBackgroundPanelSummary(
  base({
    relationshipBlocks: [
      {
        ...currentBlock,
        childrenAnswer: "not_asked",
        relationshipBlockId: "b3",
      },
    ],
  })
)
assert.equal(notAskedChildren.children, "Not asked")

const noChildrenRecords = buildBackgroundPanelSummary(base())
assert.equal(noChildrenRecords.children, "Not recorded")

// block_role_type wins over a disagreeing relationship_to_client
const typeWins = buildBackgroundPanelSummary(
  base({
    relationships: [
      person({
        relationshipRecordId: "d1",
        blockRole: "child",
        blockRoleType: "biological",
        relationshipToClient: "child_step",
        givenName: "Mislabelled",
      }),
      person({
        relationshipRecordId: "d2",
        blockRole: "child",
        blockRoleType: "step_child",
        relationshipToClient: "child_biological",
        givenName: "AlsoMislabelled",
      }),
    ],
  })
)
assert.equal(typeWins.children, "1 child, 1 step-child")

// --- Living situation ---

const husbandOnly = buildBackgroundPanelSummary(
  base({
    relationshipBlocks: [
      {
        ...currentBlock,
        status: "married",
        childrenAnswer: "",
      },
    ],
    relationships: [
      person({
        relationshipRecordId: "h1",
        relationshipBlockId: "b1",
        blockRole: "partner",
        relationshipToClient: "current_partner",
        givenName: "Chris",
        sex: "Male",
        livingSituation: "lives_with_client_full_time",
      }),
    ],
    demographics: {
      ...emptyDemographics(),
      livingSituation: {
        ...emptyDemographics().livingSituation,
        housingType: "Private rental",
      },
    },
  })
)
assert.equal(husbandOnly.livingSituation, "Private rental · lives with husband")

const partTimeChild = buildBackgroundPanelSummary(
  base({
    relationshipBlocks: [currentBlock],
    relationships: [
      person({
        relationshipRecordId: "pt1",
        relationshipBlockId: "b1",
        blockRole: "partner",
        relationshipToClient: "current_partner",
        givenName: "Jordan",
        sex: "Female",
        livingSituation: "lives_with_client_full_time",
      }),
      person({
        relationshipRecordId: "pt2",
        relationshipBlockId: "b1",
        blockRole: "child",
        blockRoleType: "biological",
        relationshipToClient: "child_biological",
        givenName: "Sam",
        livingSituation: "lives_with_client_part_time",
      }),
      person({
        relationshipRecordId: "pt3",
        relationshipBlockId: "b1",
        blockRole: "child",
        blockRoleType: "biological",
        relationshipToClient: "child_biological",
        givenName: "Lee",
        livingSituation: "lives_with_client_full_time",
      }),
      person({
        relationshipRecordId: "pt4",
        relationshipBlockId: "b1",
        blockRole: "child",
        blockRoleType: "biological",
        relationshipToClient: "child_biological",
        givenName: "Jo",
        livingSituation: "lives_with_client_full_time",
      }),
    ],
    demographics: {
      ...emptyDemographics(),
      livingSituation: {
        ...emptyDemographics().livingSituation,
        housingType: "Own home",
      },
    },
  })
)
assert.equal(
  partTimeChild.livingSituation,
  "Own home · lives with wife and 3 children (1 part time)"
)

const parentsAndSiblings = buildBackgroundPanelSummary(
  base({
    relationships: [
      person({
        relationshipRecordId: "ps1",
        blockRole: "parent",
        blockRoleType: "mother",
        relationshipToClient: "mother",
        givenName: "Sue",
        livingSituation: "lives_with_client_full_time",
      }),
      person({
        relationshipRecordId: "ps2",
        blockRole: "parent",
        blockRoleType: "father",
        relationshipToClient: "father",
        givenName: "Bob",
        livingSituation: "lives_with_client_full_time",
      }),
      person({
        relationshipRecordId: "ps3",
        blockRole: "sibling",
        blockRoleType: "full",
        relationshipToClient: "sibling_full",
        givenName: "Ann",
        livingSituation: "lives_with_client_full_time",
      }),
      person({
        relationshipRecordId: "ps4",
        blockRole: "sibling",
        blockRoleType: "full",
        relationshipToClient: "sibling_full",
        givenName: "Tim",
        livingSituation: "lives_with_client_full_time",
      }),
    ],
    demographics: {
      ...emptyDemographics(),
      livingSituation: {
        ...emptyDemographics().livingSituation,
        housingType: "Parent's home",
      },
    },
  })
)
assert.equal(
  parentsAndSiblings.livingSituation,
  "Parent's home · lives with both parents and 2 siblings"
)

const otherRole = buildBackgroundPanelSummary(
  base({
    relationships: [
      person({
        relationshipRecordId: "o1",
        relationshipToClient: "other_caregiver",
        givenName: "Pat",
        blockRole: "",
        blockRoleType: "housemate",
        livingSituation: "lives_with_client_full_time",
      }),
    ],
    demographics: {
      ...emptyDemographics(),
      livingSituation: {
        ...emptyDemographics().livingSituation,
        housingType: "Shared housing",
      },
    },
  })
)
assert.equal(otherRole.livingSituation, "Shared housing · lives with housemate")

const livesAlone = buildBackgroundPanelSummary(
  base({
    demographics: {
      ...emptyDemographics(),
      livingSituation: {
        ...emptyDemographics().livingSituation,
        housingType: "Own home",
        household: "alone",
      },
    },
  })
)
assert.equal(livesAlone.livingSituation, "Own home · lives alone")

const housingOnly = buildBackgroundPanelSummary(
  base({
    demographics: {
      ...emptyDemographics(),
      livingSituation: {
        ...emptyDemographics().livingSituation,
        housingType: "Own home",
        household: "with_others",
      },
    },
  })
)
assert.equal(housingOnly.livingSituation, "Own home")

const livingNothing = buildBackgroundPanelSummary(base())
assert.equal(livingNothing.livingSituation, "Not recorded")

const single = buildBackgroundPanelSummary(
  base({
    relationshipStatus: { relationshipStatus: "single", relationshipStatusOther: "" },
  })
)
assert.equal(single.relationship, "Single")

console.log("background-summary.selftest.ts: ok")
