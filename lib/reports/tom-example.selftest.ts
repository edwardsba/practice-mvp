import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { generateBackgroundReport, numberedLetterOutline } from "@/lib/reports/generate-background-report"
import type { RelationshipBlock, RelationshipRecord } from "@/lib/client-background/types"
import { partnersFromBlocks, relationshipDuration } from "@/lib/reports/relationship-block-report"
import { TOM_REPORT_DATE, tomExampleSource } from "@/lib/reports/tom-example-fixture"
import type { ReportVoice } from "@/lib/reports/background-report-prose"

const source = tomExampleSource()
const letter = numberedLetterOutline(generateBackgroundReport(source).document).join("\n")
const expected = readFileSync(new URL("./tom-example-report.txt", import.meta.url), "utf8").trim()
assert.equal(letter.replaceAll("\r\n", "\n"), expected.replaceAll("\r\n", "\n"))

function opening(patch: (identity: typeof source.data.demographics.identity) => void): string {
  const next = tomExampleSource()
  patch(next.data.demographics.identity)
  const text = numberedLetterOutline(generateBackgroundReport(next).document).join("\n")
  return text.split("\n").find((line) => line.startsWith("4.1.")) ?? ""
}

assert.match(opening(() => {}), /Tom is a 56-year-old male \(he\/him\) who identifies as heterosexual\./)
assert.match(
  opening((identity) => {
    identity.sexualOrientation = ""
  }),
  /Tom is a 56-year-old male \(he\/him\)\./
)
assert.match(
  opening((identity) => {
    identity.genderIdentity = "Non-binary"
    identity.pronouns = "they/them"
    identity.sexualOrientation = "gay"
  }),
  /Tom is 56 years old and identifies as gay and non-binary \(they\/them\)\./
)
assert.match(
  opening((identity) => {
    identity.genderIdentity = "Non-binary"
    identity.pronouns = "they/them"
    identity.sexualOrientation = ""
  }),
  /Tom is 56 years old and identifies as non-binary \(they\/them\)\./
)
assert.match(
  opening((identity) => {
    identity.sexualOrientation = "another"
    identity.sexualOrientationOther = "panromantic"
  }),
  /who identifies as panromantic\./
)
assert.match(
  opening((identity) => {
    identity.sexualOrientation = "prefer_not_to_say"
  }),
  /Tom is a 56-year-old male \(he\/him\)\./
)
assert.doesNotMatch(
  opening((identity) => {
    identity.sexualOrientation = "prefer_not_to_say"
  }),
  /prefer not to say/i
)

assert.equal(relationshipDuration("2014", "", "2026-11-05"), "12 years")
assert.equal(relationshipDuration("2005", "2011", "2026-11-05"), "6 years")
assert.equal(relationshipDuration("2026-01", "2026-09", "2026-11-05"), "8 months")
assert.equal(relationshipDuration("", "2011", "2026-11-05"), "")

const he: ReportVoice = { kind: "he", subject: "he", Subject: "He", possessive: "his", Possessive: "His", object: "him" }
const jordan = source.data.relationships.find((person) => person.givenName === "Jordan") as RelationshipRecord
function current(status: string): RelationshipBlock {
  return {
    relationshipBlockId: "now",
    kind: "client_current",
    parentRecordId: null,
    parentSide: "",
    status,
    statusDetail: "",
    arrangementType: "",
    arrangementDetail: "",
    startedOn: "2014",
    endedOn: "",
    noChildren: true,
    displayOrder: 0,
  }
}
const partner = { ...jordan, relationshipBlockId: "now" }
for (const [status, pattern] of [
  ["married", /has been married to his wife \(Jordan, 49\) since 2014 \(12 years\)/],
  ["defacto", /has been in a de facto relationship with a woman \(Jordan, 49\) since 2014 \(12 years\)/],
  ["engaged", /has been engaged to a woman \(Jordan, 49\) since 2014 \(12 years\)/],
  ["dating", /has been dating a woman \(Jordan, 49\) since 2014 \(12 years\)/],
  ["in_relationship_not_living_together", /has been in a relationship with a woman \(Jordan, 49\) since 2014 \(12 years\) \(not living together\)/],
  ["other", /has been in a relationship with a woman \(Jordan, 49\) since 2014 \(12 years\)/],
] as const) {
  const text = partnersFromBlocks("Tom", he, status, [current(status)], [partner], TOM_REPORT_DATE) ?? ""
  assert.match(text, pattern)
  assert.match(text, /They do not have any children/)
}
const earlier = source.data.relationshipBlocks?.find((item) => item.relationshipBlockId === "tom-pam")
const pam = source.data.relationships.find((person) => person.givenName === "Pam")
assert.ok(earlier && pam)
const previously = partnersFromBlocks("Tom", he, "single", [earlier], [pam], TOM_REPORT_DATE) ?? ""
assert.match(previously, /Previously, Tom was in a de facto relationship/)

console.log("tom example report selftest passed")
