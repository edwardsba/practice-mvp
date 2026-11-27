import assert from "node:assert/strict"

import { formatAustralianPhone } from "@/lib/format/phone"

assert.equal(formatAustralianPhone("0400123456"), "0400 123 456")
assert.equal(formatAustralianPhone("0400 123 456"), "0400 123 456")
assert.equal(formatAustralianPhone("0400-123-456"), "0400 123 456")
assert.equal(formatAustralianPhone("+61400123456"), "0400 123 456")
assert.equal(formatAustralianPhone("61400123456"), "0400 123 456")
assert.equal(formatAustralianPhone("+61 400 123 456"), "0400 123 456")

assert.equal(formatAustralianPhone("0290000000"), "(02) 9000 0000")
assert.equal(formatAustralianPhone("02 9000 0000"), "(02) 9000 0000")
assert.equal(formatAustralianPhone("(02) 9000 0000"), "(02) 9000 0000")
assert.equal(formatAustralianPhone("+61290000000"), "(02) 9000 0000")
assert.equal(formatAustralianPhone("0398765432"), "(03) 9876 5432")

assert.equal(formatAustralianPhone("not a phone"), "not a phone")
assert.equal(formatAustralianPhone("1800 123 456"), "1800 123 456")
assert.equal(formatAustralianPhone(""), "")
assert.equal(formatAustralianPhone(null), "")
assert.equal(formatAustralianPhone(undefined), "")
assert.equal(formatAustralianPhone("  0400 111 222  "), "0400 111 222")

console.log("phone.selftest.ts: ok")
