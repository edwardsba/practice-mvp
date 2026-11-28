import assert from "node:assert/strict"

import {
  LINK_ALREADY_USED_MESSAGE,
  LinkAlreadyUsedError,
  assertAccessLinkClaimed,
  claimAccessLinkOutcome,
} from "@/lib/assessments/claim-access-link"

assert.deepEqual(claimAccessLinkOutcome([{ id: "a" }]), { claimed: true })
assert.deepEqual(claimAccessLinkOutcome([]), {
  claimed: false,
  error: LINK_ALREADY_USED_MESSAGE,
})

assert.doesNotThrow(() => assertAccessLinkClaimed([{ id: "a" }]))
assert.throws(
  () => assertAccessLinkClaimed([]),
  (error: unknown) =>
    error instanceof LinkAlreadyUsedError &&
    error.message === LINK_ALREADY_USED_MESSAGE
)

console.log("claim-access-link.selftest: ok")
