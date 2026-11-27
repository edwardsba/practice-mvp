import assert from "node:assert/strict"

import {
  formatMedicareCardDisplay,
  formatMedicareCardNumber,
} from "@/lib/funding/format"

function check(name: string, actual: unknown, expected: unknown) {
  assert.equal(actual, expected, name)
  console.log(`ok — ${name}`)
}

check("10 digits grouped", formatMedicareCardNumber("2123456701"), "2123 45670 1")
check(
  "spaces ignored then grouped",
  formatMedicareCardNumber("2123 45670 1"),
  "2123 45670 1"
)
check("dashes ignored then grouped", formatMedicareCardNumber("2123-45670-1"), "2123 45670 1")
check("short input unchanged", formatMedicareCardNumber("212345"), "212345")
check("odd length unchanged", formatMedicareCardNumber("21234567012"), "21234567012")
check("null → null", formatMedicareCardNumber(null), null)
check("blank → null", formatMedicareCardNumber("   "), null)

check(
  "display with irn",
  formatMedicareCardDisplay("2123456701", "1"),
  "Card 2123 45670 1 · IRN 1"
)
check(
  "display card only",
  formatMedicareCardDisplay("2123456701", null),
  "Card 2123 45670 1"
)
check("display irn only", formatMedicareCardDisplay(null, "2"), "IRN 2")
check("display empty", formatMedicareCardDisplay(null, null), null)

console.log("format-medicare.selftest.ts: ok")
