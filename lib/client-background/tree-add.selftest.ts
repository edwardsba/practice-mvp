import assert from "node:assert/strict"

import {
  addChoicesForBlockKind,
  historyTreeAddChoices,
  relationshipTreeAddChoices,
  treeBarStyle,
} from "@/lib/client-background/tree-add"
import { treeBarColours } from "@/lib/ui/status-colours"

// —— Level → bar style ——
assert.equal(treeBarStyle(1), null)
assert.deepEqual(treeBarStyle(2), { widthPx: 4, color: treeBarColours.dark, indentPx: 0 })
assert.deepEqual(treeBarStyle(3), { widthPx: 2, color: treeBarColours.mid, indentPx: 18 })
assert.deepEqual(treeBarStyle(4), { widthPx: 2, color: treeBarColours.light, indentPx: 38 })

// —— Relationship ⊕ ——
assert.deepEqual(relationshipTreeAddChoices({ type: "heading", section: "relationship" }), [
  { id: "relationship", label: "Relationship" },
])
assert.deepEqual(relationshipTreeAddChoices({ type: "heading", section: "arrangement" }), [
  { id: "arrangement", label: "Arrangement" },
])
assert.deepEqual(relationshipTreeAddChoices({ type: "heading", section: "other_children" }), [
  { id: "relationship", label: "Relationship" },
])
assert.deepEqual(relationshipTreeAddChoices({ type: "block", blockKind: "client_current" }), [
  { id: "partner", label: "Partner" },
  { id: "child", label: "Child" },
])
assert.deepEqual(relationshipTreeAddChoices({ type: "block", blockKind: "client_previous" }), [
  { id: "partner", label: "Partner" },
  { id: "child", label: "Child" },
])
assert.deepEqual(relationshipTreeAddChoices({ type: "block", blockKind: "parent_other" }), [
  { id: "partner", label: "Partner" },
  { id: "sibling", label: "Sibling" },
])
assert.deepEqual(relationshipTreeAddChoices({ type: "block", blockKind: "biological_parents" }), [
  { id: "sibling", label: "Sibling" },
])
assert.deepEqual(relationshipTreeAddChoices({ type: "block", blockKind: "caregiver_arrangement" }), [
  { id: "caregiver", label: "Caregiver" },
  { id: "sibling", label: "Sibling" },
])
assert.deepEqual(relationshipTreeAddChoices({ type: "block", blockKind: "client_other_children" }), [
  { id: "child", label: "Child" },
])
assert.deepEqual(addChoicesForBlockKind("client_current"), [
  { id: "partner", label: "Partner" },
  { id: "child", label: "Child" },
])

// —— History ⊕ ——
assert.deepEqual(historyTreeAddChoices({ type: "heading", mode: "condition" }), [
  { id: "issue", label: "Issue" },
])
assert.deepEqual(historyTreeAddChoices({ type: "heading", mode: "event" }), [
  { id: "event", label: "Event" },
])
assert.deepEqual(historyTreeAddChoices({ type: "issue" }), [
  { id: "episode", label: "Episode" },
  { id: "treatment", label: "Treatment" },
  { id: "other", label: "Other event" },
])
assert.deepEqual(historyTreeAddChoices({ type: "nestable_event" }), [
  { id: "event", label: "Event" },
])

console.log("tree-add selftest passed")
