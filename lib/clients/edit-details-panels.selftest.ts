import assert from "node:assert/strict"

import {
  buildEditDetailsHref,
  EDIT_DETAILS_PANEL_IDS,
  editDetailsPanelElementId,
  isEditDetailsPanelId,
  parseEditDetailsOpenParam,
} from "@/lib/clients/edit-details-panels"

assert.deepEqual(
  [...EDIT_DETAILS_PANEL_IDS],
  [
    "details",
    "demographics",
    "relationships",
    "history",
    "emergency",
    "communication",
  ]
)

for (const id of EDIT_DETAILS_PANEL_IDS) {
  assert.equal(isEditDetailsPanelId(id), true)
  assert.equal(parseEditDetailsOpenParam(id), id)
  assert.equal(editDetailsPanelElementId(id), `edit-panel-${id}`)
}

assert.equal(isEditDetailsPanelId("nope"), false)
assert.equal(parseEditDetailsOpenParam("nope"), null)
assert.equal(parseEditDetailsOpenParam(undefined), null)
assert.equal(parseEditDetailsOpenParam(null), null)
assert.equal(parseEditDetailsOpenParam(["details", "history"]), "details")
assert.equal(parseEditDetailsOpenParam(["bogus"]), null)

assert.equal(
  buildEditDetailsHref("abc"),
  "/clients/abc/edit"
)
assert.equal(
  buildEditDetailsHref("abc", "details"),
  "/clients/abc/edit?open=details"
)
assert.equal(
  buildEditDetailsHref("abc", "communication", { saved: true }),
  "/clients/abc/edit?open=communication&saved=1"
)
assert.equal(
  buildEditDetailsHref("abc", null, { saved: true }),
  "/clients/abc/edit?saved=1"
)

console.log("edit-details-panels.selftest.ts: ok")
