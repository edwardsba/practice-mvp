import assert from "node:assert/strict"

import {
  agePrecisionNote,
  assessAge,
  describeClientAge,
  displayedAge,
  resolveAgeOnlyBoundary,
  typedAgeMatches,
  yearFromTypedAge,
} from "@/lib/client-background/age"
import { daysInMonth, formatPartialDate, parsePartialDate } from "@/lib/client-background/partial-date"
import { sanitizeOccupation, sanitizeRelationship } from "@/lib/client-background/sanitize"
import { estimatedCurrentAge } from "@/lib/client-background/visibility"

assert.equal(formatPartialDate(parsePartialDate("1964")), "1964")
assert.equal(formatPartialDate(parsePartialDate("1964-06")), "1964-06")
assert.equal(formatPartialDate(parsePartialDate("1964-06-15")), "1964-06-15")
assert.equal(formatPartialDate(parsePartialDate("1964-02-31")), "1964-02-31")
assert.equal(formatPartialDate(parsePartialDate("2000-06-15T00:00:00.000Z")), "2000-06-15")
assert.equal(daysInMonth(2024, 2), 29)
assert.equal(daysInMonth(2023, 2), 28)

const asOf = "2026-10-06"
assert.equal(yearFromTypedAge(30, { kind: "today", asOf }), "1996")
assert.deepEqual(assessAge(parsePartialDate("1996"), parsePartialDate(asOf), "person"), {
  kind: "approximate",
  years: 30,
})
assert.deepEqual(assessAge(parsePartialDate("1964-12-01"), parsePartialDate(asOf), "person"), {
  kind: "exact",
  years: 61,
})
assert.deepEqual(assessAge(parsePartialDate("1964-01-01"), parsePartialDate(asOf), "person"), {
  kind: "exact",
  years: 62,
})
assert.deepEqual(assessAge(parsePartialDate("1986-10"), parsePartialDate(asOf), "person"), {
  kind: "ambiguous",
  low: 39,
  high: 40,
})
assert.equal(displayedAge(assessAge(parsePartialDate("1996"), parsePartialDate(asOf), "person")), "~30")
assert.equal(agePrecisionNote(assessAge(parsePartialDate("1964-01-01"), parsePartialDate(asOf), "person")), "Exact")
assert.equal(agePrecisionNote(assessAge(parsePartialDate("1996"), parsePartialDate(asOf), "person")), "Approximate")
assert.equal(
  agePrecisionNote(assessAge(parsePartialDate("1986-10"), parsePartialDate(asOf), "person")),
  "could be 39 or 40"
)

const birth = "2000-06-15"
assert.equal(yearFromTypedAge(18, { kind: "since-birth", birthDate: birth }), "2018")
assert.deepEqual(describeClientAge(birth, "year", "2018"), { kind: "approximate", years: 18 })
assert.deepEqual(describeClientAge(birth, "year_month", "2018-06"), { kind: "ambiguous", low: 17, high: 18 })
assert.deepEqual(describeClientAge(birth, "year_month", "2018-07"), { kind: "approximate", years: 18 })
assert.deepEqual(describeClientAge(birth, "year_month", "2018-05"), { kind: "approximate", years: 17 })
assert.deepEqual(describeClientAge(birth, "date", "2018-06-14"), { kind: "exact", years: 17 })
assert.deepEqual(describeClientAge(birth, "date", "2018-06-15"), { kind: "exact", years: 18 })
assert.deepEqual(describeClientAge(birth, "year", "1999"), { kind: "before_birth" })
assert.deepEqual(describeClientAge(birth, "year_month", "2000-01"), { kind: "before_birth" })
assert.deepEqual(describeClientAge(birth, "year", "2000"), { kind: "approximate", years: 0 })
assert.deepEqual(describeClientAge(null, "year", "2018"), { kind: "none" })
assert.deepEqual(describeClientAge(null, "age", "14"), { kind: "approximate", years: 14 })
assert.equal(yearFromTypedAge(10, { kind: "since-birth", birthDate: "" }), null)
assert.equal(displayedAge(describeClientAge(birth, "year", "1999")), "Before client was born")
assert.equal(typedAgeMatches(describeClientAge(birth, "date", "2018-06-15"), 18), true)
assert.equal(typedAgeMatches(describeClientAge(birth, "year_month", "2018-06"), 17), true)
assert.equal(typedAgeMatches(describeClientAge(birth, "year_month", "2018-06"), 16), false)

assert.deepEqual(resolveAgeOnlyBoundary("age", "10", birth), { precision: "year", value: "2010" })
assert.deepEqual(resolveAgeOnlyBoundary("age", "10", null), { precision: "", value: "" })
assert.deepEqual(resolveAgeOnlyBoundary("date", "2010-01-01", birth), {
  precision: "date",
  value: "2010-01-01",
})

const converted = sanitizeRelationship({
  relationshipRecordId: "mother",
  relationshipToClient: "mother",
  approximateAge: 70,
  approximateAgeRecordedOn: "2020-06-01",
})
assert.equal(converted.dateOfBirth, "1950")
assert.equal(converted.approximateAge, null)
assert.equal(converted.approximateAgeRecordedOn, "")

const kept = sanitizeRelationship({
  relationshipRecordId: "father",
  relationshipToClient: "father",
  dateOfBirth: "1964-06",
  approximateAge: 70,
  approximateAgeRecordedOn: "2020-06-01",
})
assert.equal(kept.dateOfBirth, "1964-06")
assert.equal(kept.approximateAge, null)

const movedJob = sanitizeOccupation({
  previousJobs: [{ id: "job-1", role: "Nurse", dates: "2015" }],
})
assert.equal(movedJob.previousJobs[0]?.started, "2015")
assert.equal(movedJob.previousJobs[0]?.ended, "")

const keptRange = sanitizeOccupation({
  previousJobs: [{ id: "job-2", role: "Teacher", started: "2016-03", ended: "2018" }],
})
assert.equal(keptRange.previousJobs[0]?.started, "2016-03")
assert.equal(keptRange.previousJobs[0]?.ended, "2018")

assert.equal(estimatedCurrentAge({ dateOfBirth: "1950", healthStatus: "" }, "2026-10-02"), 76)
assert.equal(estimatedCurrentAge({ dateOfBirth: "1964-01-01", healthStatus: "deceased" }, "2026-10-02"), null)

console.log("partial date selftest passed")
