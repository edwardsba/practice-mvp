import assert from "node:assert/strict"

import { describeClientAge, displayedAge } from "@/lib/client-background/age"

const birth = "1974-12-12"
assert.deepEqual(describeClientAge(birth, "year", "1986"), { kind: "approximate", years: 11 })
assert.equal(displayedAge(describeClientAge(birth, "year", "1986")), "~11")
assert.deepEqual(describeClientAge(birth, "date", "2026-10-01"), { kind: "exact", years: 51 })
assert.equal(displayedAge(describeClientAge(birth, "date", "2026-10-01")), "51")

console.log("round E background selftest passed")
