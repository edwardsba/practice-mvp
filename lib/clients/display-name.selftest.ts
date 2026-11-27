import assert from "node:assert/strict"

import { formatClientDisplayName } from "@/lib/clients/display-name"

assert.equal(formatClientDisplayName("Jane", null, "Citizen"), "Jane Citizen")
assert.equal(formatClientDisplayName("Jane", "", "Citizen"), "Jane Citizen")
assert.equal(
  formatClientDisplayName("Jane", "Jenny", "Citizen"),
  "Jane (Jenny) Citizen"
)
assert.equal(
  formatClientDisplayName(" Jane ", " Jenny ", " Citizen "),
  "Jane (Jenny) Citizen"
)

console.log("display-name.selftest.ts: ok")