import assert from "node:assert/strict"

import {
  HISTORY_CATEGORY_ADD_LABELS,
  historyCategoryAddLabel,
  historyVisualLayer,
} from "@/lib/client-background/history-tree"
import {
  NEW_RELATIONSHIP_ENTRY_POINTS,
  NEW_RELATIONSHIP_FORM_ID,
  newRelationshipFormIdForEntryPoint,
} from "@/lib/client-background/new-relationship-form"
import {
  relationshipHeadingAllowsAdd,
  relationshipSectionAddSpec,
  relationshipSectionAllowsAdd,
} from "@/lib/client-background/relationship-tree"

// —— Visual layer rule: anything directly under a category is layer 2 ——
assert.equal(historyVisualLayer("band", { parentLayer: 1 }), 2)
assert.equal(historyVisualLayer("row", { parentLayer: 1 }), 2)
assert.equal(historyVisualLayer("row", { parentLayer: 2 }), 3)
assert.equal(historyVisualLayer("row", { parentLayer: 2, tag: "Episode" }), 3)
assert.equal(historyVisualLayer("row", { parentLayer: 2, tag: "Treatment" }), 3)
assert.equal(historyVisualLayer("row", { parentLayer: 3, tag: "Step" }), 4)
assert.equal(historyVisualLayer("row", { parentLayer: 3 }), 4)
assert.equal(historyVisualLayer("note"), 2)
assert.equal(historyVisualLayer("actions"), 2)

// —— Singular add-label map (next to category definitions) ——
assert.equal(HISTORY_CATEGORY_ADD_LABELS["Mental health"], "+ Add mental health issue")
assert.equal(HISTORY_CATEGORY_ADD_LABELS["Substance use"], "+ Add substance use issue")
assert.equal(HISTORY_CATEGORY_ADD_LABELS["Physical health"], "+ Add physical health issue")
assert.equal(HISTORY_CATEGORY_ADD_LABELS["Self-harm"], "+ Add self-harm")
assert.equal(HISTORY_CATEGORY_ADD_LABELS["Traumatic events"], "+ Add traumatic event")
assert.equal(HISTORY_CATEGORY_ADD_LABELS["Other significant events"], "+ Add significant event")
assert.equal(historyCategoryAddLabel("Self-harm"), "+ Add self-harm")
assert.equal(historyCategoryAddLabel("Traumatic events"), "+ Add traumatic event")
assert.equal(historyCategoryAddLabel("Other significant events"), "+ Add significant event")
assert.notEqual(historyCategoryAddLabel("Traumatic events"), "+ Add traumatic events")

// —— Both entry points resolve to the same New relationship form ——
assert.equal(NEW_RELATIONSHIP_ENTRY_POINTS.interview, "interview-relationships")
assert.equal(NEW_RELATIONSHIP_ENTRY_POINTS.clientBackground, "client-background-relationships")
assert.equal(newRelationshipFormIdForEntryPoint("interview"), NEW_RELATIONSHIP_FORM_ID)
assert.equal(newRelationshipFormIdForEntryPoint("clientBackground"), NEW_RELATIONSHIP_FORM_ID)
assert.equal(
  newRelationshipFormIdForEntryPoint("interview"),
  newRelationshipFormIdForEntryPoint("clientBackground")
)

// —— Client Background section add buttons ——
assert.deepEqual(relationshipSectionAddSpec("Current intimate relationship and children"), {
  label: "+ Add relationship",
  kind: "client_current",
})
assert.deepEqual(relationshipSectionAddSpec("Previous intimate relationships and children"), {
  label: "+ Add relationship",
  kind: "client_previous",
})
assert.deepEqual(relationshipSectionAddSpec("Mother (Sally) · other relationships"), {
  label: "+ Add relationship",
  kind: "parent_other",
  parentSide: "mother",
})
assert.deepEqual(relationshipSectionAddSpec("Father · other relationships"), {
  label: "+ Add relationship",
  kind: "parent_other",
  parentSide: "father",
})
assert.deepEqual(relationshipSectionAddSpec("Other caregiver arrangements"), {
  label: "+ Add arrangement",
  kind: "caregiver_arrangement",
})
assert.equal(relationshipSectionAddSpec("Biological parents"), null)
assert.equal(relationshipSectionAllowsAdd([{ kind: "note", text: "None" }]), false)
// "Not asked" still allows ⊕ (Father · other relationships case).
assert.equal(relationshipSectionAllowsAdd([{ kind: "note", text: "Not asked" }]), true)
assert.equal(relationshipHeadingAllowsAdd("not_asked"), true)
assert.equal(relationshipHeadingAllowsAdd("none"), false)
assert.equal(
  relationshipSectionAllowsAdd([
    { kind: "block", id: "b1", heading: "Married", meta: "", children: [], interactive: true },
  ]),
  true
)
assert.equal(
  relationshipSectionAllowsAdd(
    [{ kind: "block", id: "b1", heading: "Married", meta: "", children: [], interactive: true }],
    { kind: "client_current" }
  ),
  false
)
assert.equal(relationshipSectionAllowsAdd([], { kind: "client_current" }), true)

console.log("round-r selftest passed")
