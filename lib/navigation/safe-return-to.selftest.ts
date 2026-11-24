import assert from "node:assert/strict"

import { safeReturnTo } from "@/lib/navigation/safe-return-to"

assert.equal(safeReturnTo("/clients/abc/claims"), "/clients/abc/claims")
assert.equal(
  safeReturnTo("/funding/approvals/xyz"),
  "/funding/approvals/xyz"
)
assert.equal(safeReturnTo("/clients/abc"), "/clients/abc")
assert.equal(safeReturnTo("/funding/claims/new"), "/funding/claims/new")
assert.equal(safeReturnTo("/session-notes"), "/session-notes")
assert.equal(
  safeReturnTo("/session-notes/abc-123"),
  "/session-notes/abc-123"
)

assert.equal(safeReturnTo(null), null)
assert.equal(safeReturnTo(undefined), null)
assert.equal(safeReturnTo(""), null)
assert.equal(safeReturnTo("   "), null)

assert.equal(safeReturnTo("https://evil.example/"), null)
assert.equal(safeReturnTo("http://evil.example/clients/x"), null)
assert.equal(safeReturnTo("//evil.example/clients/x"), null)
assert.equal(safeReturnTo("/\\evil"), null)
assert.equal(safeReturnTo("/clients/../funding"), null)
assert.equal(safeReturnTo("/clients/abc/../../etc"), null)
assert.equal(safeReturnTo("/dashboard"), null)
assert.equal(safeReturnTo("/appointments"), null)
assert.equal(safeReturnTo("clients/abc"), null)

console.log("safe-return-to.selftest.ts: ok")
