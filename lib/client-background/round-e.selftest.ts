import assert from "node:assert/strict"

import { describeClientAge, displayedAge } from "@/lib/client-background/age"
import { mapHowEnded } from "@/lib/client-background/how-ended"
import { laterRelationshipsAfterLinkChange } from "@/lib/client-background/later-relationships"

assert.equal(mapHowEnded("").howEnded, "")
assert.equal(mapHowEnded("we separated in 2011").howEnded, "separated")
assert.equal(mapHowEnded("Divorced").howEnded, "divorced")
assert.equal(mapHowEnded("his partner died").howEnded, "partner_died")
assert.equal(mapHowEnded("widowed").howEnded, "partner_died")
assert.deepEqual(mapHowEnded("she moved overseas"), { howEnded: "other", detail: "she moved overseas" })

assert.equal(laterRelationshipsAfterLinkChange(2), "yes")
assert.equal(laterRelationshipsAfterLinkChange(1), "yes")
assert.equal(laterRelationshipsAfterLinkChange(0), "not_asked")

const birth = "1974-12-12"
assert.deepEqual(describeClientAge(birth, "year", "1986"), { kind: "approximate", years: 11 })
assert.equal(displayedAge(describeClientAge(birth, "year", "1986")), "~11")
assert.deepEqual(describeClientAge(birth, "date", "2026-10-01"), { kind: "exact", years: 51 })
assert.equal(displayedAge(describeClientAge(birth, "date", "2026-10-01")), "51")

console.log("round E background selftest passed")
