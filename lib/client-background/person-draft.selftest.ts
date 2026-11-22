import assert from "node:assert/strict"

import {
  EMPTY_PERSON_DRAFT_ERROR,
  ONE_CURRENT_RELATIONSHIP_ERROR,
  personDraftHasRequiredContent,
  refuseEmptyPersonDraft,
  refuseSecondCurrentFromBlocks,
} from "@/lib/client-background/person-draft"
import {
  addToRelationshipMenuOptions,
  addToRelationshipMenuHeading,
  addingToContextLine,
  childTypeOptionLabel,
} from "@/lib/client-background/add-to-relationship"
import { countUnsavedRelationshipChanges } from "@/lib/client-background/unsaved-changes"
import { emptyBlockAnswers, type RelationshipBlock } from "@/lib/client-background/types"

// —— Empty person draft refused (Save validation) ——
assert.equal(personDraftHasRequiredContent({ givenName: "", blockRoleType: "" }), false)
assert.equal(refuseEmptyPersonDraft({ givenName: "", blockRoleType: "" }), EMPTY_PERSON_DRAFT_ERROR)
assert.equal(personDraftHasRequiredContent({ givenName: "Jordan", blockRoleType: "" }), true)
assert.equal(refuseEmptyPersonDraft({ givenName: "Jordan", blockRoleType: "" }), null)
assert.equal(personDraftHasRequiredContent({ givenName: "", blockRoleType: "biological" }), true)
assert.equal(refuseEmptyPersonDraft({ givenName: "", blockRoleType: "step_child" }), null)

// —— Second client_current refused ——
assert.equal(
  refuseSecondCurrentFromBlocks([{ kind: "client_current" }], "client_current"),
  ONE_CURRENT_RELATIONSHIP_ERROR
)
assert.equal(refuseSecondCurrentFromBlocks([], "client_current"), null)
assert.equal(refuseSecondCurrentFromBlocks([{ kind: "client_previous" }], "client_current"), null)
assert.equal(refuseSecondCurrentFromBlocks([{ kind: "client_current" }], "client_previous"), null)

// —— Partner/Child menu for intimate relationship line ——
assert.deepEqual(addToRelationshipMenuOptions("client_current"), [
  { role: "partner", label: "Partner" },
  { role: "child", label: "Child" },
])
assert.deepEqual(addToRelationshipMenuOptions("client_previous"), [
  { role: "partner", label: "Partner" },
  { role: "child", label: "Child" },
])
assert.deepEqual(addToRelationshipMenuOptions("parent_other"), [
  { role: "partner", label: "Partner" },
  { role: "sibling", label: "Sibling" },
])
assert.deepEqual(addToRelationshipMenuOptions("caregiver_arrangement"), [])
assert.deepEqual(addToRelationshipMenuOptions("biological_parents"), [])

assert.equal(
  addToRelationshipMenuHeading({
    status: "married",
    startedOn: "2014",
    endedOn: "",
    kind: "client_current",
  }),
  "Add to Married (since 2014)"
)

assert.equal(
  addingToContextLine(
    {
      relationshipBlockId: "b1",
      status: "married",
      startedOn: "2014",
      endedOn: "",
      kind: "client_current",
    },
    [
      {
        relationshipRecordId: "p1",
        relationshipBlockId: "b1",
        blockRole: "partner",
        givenName: "Jordan",
        displayOrder: 0,
      } as never,
    ]
  ),
  "Adding to: Married (since 2014) · Jordan"
)

assert.equal(childTypeOptionLabel("step_child", "Jordan"), "Step-child (Jordan's)")
assert.equal(childTypeOptionLabel("biological", "Jordan"), "Biological")

// —— Unsaved changes counter ——
const block = (id: string, status: string): RelationshipBlock =>
  ({
    relationshipBlockId: id,
    kind: "client_current",
    parentRecordId: null,
    parentSide: "",
    status,
    statusDetail: "",
    arrangementType: "",
    arrangementDetail: "",
    startedOn: "",
    endedOn: "",
    childrenAnswer: "",
    siblingsAnswer: "",
    displayOrder: 0,
  }) as RelationshipBlock

const baseline = {
  blocks: [block("b1", "married")],
  blockAnswers: emptyBlockAnswers(),
  relationshipStatus: { relationshipStatus: "married" as const, relationshipStatusOther: "" },
}
assert.equal(countUnsavedRelationshipChanges(baseline, baseline), 0)
assert.equal(
  countUnsavedRelationshipChanges(baseline, {
    ...baseline,
    relationshipStatus: { relationshipStatus: "dating", relationshipStatusOther: "" },
  }),
  1
)
assert.equal(
  countUnsavedRelationshipChanges(baseline, {
    ...baseline,
    blocks: [block("b1", "dating")],
  }),
  1
)
assert.equal(
  countUnsavedRelationshipChanges(baseline, {
    ...baseline,
    blockAnswers: { ...emptyBlockAnswers(), previousRelationships: "yes" },
  }),
  1
)

console.log("person-draft.selftest.ts: ok")
