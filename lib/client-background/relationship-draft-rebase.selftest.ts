import assert from "node:assert/strict"

import {
  rebaseBlockAnswerDrafts,
  rebaseBlockDrafts,
  rebaseStatusDraft,
  sameRelationshipBlock,
} from "@/lib/client-background/relationship-draft-rebase"
import { emptyBlockAnswers, type RelationshipBlock } from "@/lib/client-background/types"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

function block(id: string, patch: Partial<RelationshipBlock> = {}): RelationshipBlock {
  return {
    relationshipBlockId: id,
    kind: "client_current",
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
    ...patch,
  }
}

check("same block", sameRelationshipBlock(block("a"), block("a")), true)
check("status differs", sameRelationshipBlock(block("a"), block("a", { status: "married" })), false)

const saved = [block("current"), block("parents", { kind: "biological_parents" })]
const draft = [block("current", { status: "married" }), saved[1]!]

const otherTreeSaved = [saved[0]!, block("parents", { kind: "biological_parents", siblingsAnswer: "yes" })]
check(
  "other tree's save keeps this tree's unsaved status",
  rebaseBlockDrafts(draft, saved, otherTreeSaved),
  [block("current", { status: "married" }), otherTreeSaved[1]]
)

const serverChangedCurrent = [block("current", { status: "defacto" }), saved[1]!]
check(
  "incoming change to the same block wins",
  rebaseBlockDrafts(draft, saved, serverChangedCurrent),
  serverChangedCurrent
)

check(
  "removed blocks drop; new blocks arrive",
  rebaseBlockDrafts(draft, saved, [saved[1]!, block("caregiver", { kind: "caregiver_arrangement" })]),
  [saved[1], block("caregiver", { kind: "caregiver_arrangement" })]
)

const answersBase = emptyBlockAnswers()
const answersDraft = { ...answersBase, otherChildren: "yes" as const }
const mirrored = { ...answersBase, previousRelationships: "none" as const }
check(
  "mirror update keeps other unsaved answers",
  rebaseBlockAnswerDrafts(answersDraft, answersBase, mirrored),
  { ...answersBase, previousRelationships: "none", otherChildren: "yes" }
)
check(
  "incoming answer change wins",
  rebaseBlockAnswerDrafts(answersDraft, answersBase, { ...answersBase, otherChildren: "none" }),
  { ...answersBase, otherChildren: "none" }
)

const statusSaved = { relationshipStatus: "single" as const, relationshipStatusOther: "" }
const statusDraft = { relationshipStatus: "married" as const, relationshipStatusOther: "" }
check("status draft kept", rebaseStatusDraft(statusDraft, statusSaved, { ...statusSaved }), statusDraft)
check(
  "incoming status wins",
  rebaseStatusDraft(statusDraft, statusSaved, { relationshipStatus: "defacto", relationshipStatusOther: "" }),
  { relationshipStatus: "defacto", relationshipStatusOther: "" }
)

console.log("\nrelationship-draft-rebase.selftest.ts: ok")
