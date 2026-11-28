/**
 * Round AY: BACKGROUND_SR v2 response-row parser.
 */
import assert from "node:assert/strict"

import { IN_PERSON_VALUE, serializeHistoryListEntry, serializePersonListEntry } from "@/lib/assessments/form-lists"
import {
  emptyBackgroundSelfReportV2,
  hasBackgroundSelfReportV2Rows,
  parseBackgroundSelfReport,
} from "@/lib/background-questionnaire/parse"
import type { BackgroundResponseRow } from "@/lib/background-questionnaire/types"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

const emptyParsed = parseBackgroundSelfReport([])
check("empty rows → empty report", emptyParsed.report, emptyBackgroundSelfReportV2())
check("empty rows → no drops", [emptyParsed.droppedUnknownKeys, emptyParsed.droppedValues], [[], []])
check("empty rows are not v2", hasBackgroundSelfReportV2Rows([]), false)

const partner = serializePersonListEntry({ firstName: "Alex", fromYear: 2018 })
const child = serializePersonListEntry({ firstName: "Sam", age: 7, livesWith: "yes" })
const prev = serializePersonListEntry({
  firstName: "Jo",
  fromYear: 2005,
  toYear: 2011,
  howEnded: "divorced",
})
const parent = serializePersonListEntry({
  firstName: "Pat",
  relationship: "mother",
  passedAway: true,
})
const sibling = serializePersonListEntry({ firstName: "Lee", age: 40, relationship: "brother" })
const physical = serializeHistoryListEntry({ what: "Asthma", when: "childhood" })
const mental = serializeHistoryListEntry({ what: "Depression", when: "about age 25" })

const fullRows: BackgroundResponseRow[] = [
  { elementKey: "sex", responseValue: "Female" },
  { elementKey: "gender_differs", responseValue: "yes" },
  { elementKey: "gender_identity", responseValue: "non-binary" },
  { elementKey: "pronouns", responseValue: "they/them" },
  { elementKey: "cultural_background", responseValue: "Vietnamese Australian" },
  { elementKey: "religion", responseValue: "Buddhist" },
  { elementKey: "language", responseValue: "English" },
  { elementKey: "disability", responseValue: "yes" },
  { elementKey: "disability_detail", responseValue: "Low vision" },
  { elementKey: "access_needs", responseValue: "Large print" },
  { elementKey: "education_level", responseValue: "Bachelor degree" },
  { elementKey: "field_of_study", responseValue: "Nursing" },
  { elementKey: "currently_studying", responseValue: "no" },
  { elementKey: "study_interrupted", responseValue: "yes" },
  { elementKey: "interrupted_detail", responseValue: "Illness" },
  { elementKey: "work_status", responseValue: "full_time" },
  { elementKey: "job_role", responseValue: "Nurse" },
  { elementKey: "employer", responseValue: "City Hospital" },
  { elementKey: "hard_to_afford", responseValue: "food" },
  { elementKey: "hard_to_afford", responseValue: "phoneInternet", responseOrder: 1 },
  { elementKey: "relationship_status", responseValue: "married" },
  { elementKey: "partner", responseValue: partner },
  { elementKey: "children", responseValue: child },
  { elementKey: "previous_relationships", responseValue: prev },
  { elementKey: "parents", responseValue: parent },
  { elementKey: "parents_together", responseValue: "separated_or_divorced" },
  { elementKey: "siblings", responseValue: sibling },
  { elementKey: "lives_with", responseValue: "partner" },
  { elementKey: "lives_with", responseValue: "children", responseOrder: 1 },
  { elementKey: "lives_with", responseValue: "flatmates_friends", responseOrder: 2 },
  { elementKey: "lives_with_others", responseValue: "2 flatmates" },
  { elementKey: "housing_type", responseValue: "Private rental" },
  { elementKey: "housing_security", responseValue: "Some concern" },
  { elementKey: "hist_physical", responseValue: "yes" },
  { elementKey: "hist_physical_list", responseValue: physical },
  { elementKey: "hist_substance", responseValue: IN_PERSON_VALUE },
  { elementKey: "hist_mental", responseValue: "yes" },
  { elementKey: "hist_mental_list", responseValue: mental },
  { elementKey: "hist_selfharm", responseValue: "no" },
  // blank hist_trauma — omitted entirely
  { elementKey: "fam_mental", responseValue: "yes" },
  { elementKey: "fam_substance", responseValue: "no" },
  // junk
  { elementKey: "legacy_field", responseValue: "drop me" },
  { elementKey: "sex", responseValue: "Robot" }, // second invalid sex — first wins via firstOrNull… wait, both are kept in values; firstOrNull takes first
]

// Fix: the full set should have one sex value. Rebuild without the invalid second sex;
// put invalid values as separate drop cases.
const cleanFull = fullRows.filter(
  (row) => !(row.elementKey === "sex" && row.responseValue === "Robot")
)
cleanFull.push({ elementKey: "work_status", responseValue: "king" }) // invalid extra — first wins
cleanFull.push({ elementKey: "hard_to_afford", responseValue: "rent" })
cleanFull.push({ elementKey: "hist_physical_list", responseValue: "{}" })
cleanFull.push({ elementKey: "partner", responseValue: "not-json" })

const parsed = parseBackgroundSelfReport(cleanFull)
check("full set is v2", hasBackgroundSelfReportV2Rows(cleanFull), true)
check("sex", parsed.report.sex, "Female")
check("gender", [parsed.report.genderDiffers, parsed.report.genderIdentity, parsed.report.pronouns], [
  "yes",
  "non-binary",
  "they/them",
])
check("culture", [parsed.report.culturalBackground, parsed.report.religion, parsed.report.language], [
  "Vietnamese Australian",
  "Buddhist",
  "English",
])
check("disability", [parsed.report.disability, parsed.report.disabilityDetail, parsed.report.accessNeeds], [
  "yes",
  "Low vision",
  "Large print",
])
check("education", [parsed.report.educationLevel, parsed.report.fieldOfStudy], [
  "Bachelor degree",
  "Nursing",
])
check("study", [parsed.report.currentlyStudying, parsed.report.studyInterrupted, parsed.report.interruptedDetail], [
  "no",
  "yes",
  "Illness",
])
check("work", [parsed.report.workStatus, parsed.report.jobRole, parsed.report.employer], [
  "full_time",
  "Nurse",
  "City Hospital",
])
check("hard_to_afford keeps order of NECESSITY_KEYS", parsed.report.hardToAfford, [
  "food",
  "phoneInternet",
])
check("relationships", [
  parsed.report.relationshipStatus,
  parsed.report.partner,
  parsed.report.children,
  parsed.report.previousRelationships,
], [
  "married",
  [{ firstName: "Alex", fromYear: 2018 }],
  [{ firstName: "Sam", age: 7, livesWith: "yes" }],
  [{ firstName: "Jo", fromYear: 2005, toYear: 2011, howEnded: "divorced" }],
])
check("family of origin", [
  parsed.report.parents,
  parsed.report.parentsTogether,
  parsed.report.siblings,
], [
  [{ firstName: "Pat", relationship: "mother", passedAway: true }],
  "separated_or_divorced",
  [{ firstName: "Lee", age: 40, relationship: "brother" }],
])
check("lives_with with others", [parsed.report.livesWith, parsed.report.livesWithOthers], [
  ["partner", "children", "flatmates_friends"],
  "2 flatmates",
])
check("housing", [parsed.report.housingType, parsed.report.housingSecurity], [
  "Private rental",
  "Some concern",
])
check("history lists and in_person", [
  parsed.report.histPhysical,
  parsed.report.histPhysicalList,
  parsed.report.histSubstance,
  parsed.report.histMental,
  parsed.report.histMentalList,
  parsed.report.histSelfharm,
  parsed.report.histTrauma,
  parsed.report.famMental,
  parsed.report.famSubstance,
], [
  "yes",
  [{ what: "Asthma", when: "childhood" }],
  IN_PERSON_VALUE,
  "yes",
  [{ what: "Depression", when: "about age 25" }],
  "no",
  null,
  "yes",
  "no",
])

check("drops unknown keys", parsed.droppedUnknownKeys, ["legacy_field"])
assert.ok(
  parsed.droppedValues.some((d) => d.elementKey === "hard_to_afford" && d.responseValue === "rent"),
  "drops invalid hard_to_afford"
)
assert.ok(
  parsed.droppedValues.some((d) => d.elementKey === "hist_physical_list" && d.reason === "invalid_history_list"),
  "drops blank history JSON"
)
assert.ok(
  parsed.droppedValues.some((d) => d.elementKey === "partner" && d.reason === "invalid_person_list"),
  "drops invalid person JSON"
)
// Second work_status is ignored by firstOrNull; the invalid value is never read.
check("work_status keeps first valid row", parsed.report.workStatus, "full_time")

const blankTrauma = parseBackgroundSelfReport([{ elementKey: "hist_trauma", responseValue: "   " }])
check("blank hist_trauma → null and dropped", blankTrauma.report.histTrauma, null)
assert.ok(
  blankTrauma.droppedValues.some((d) => d.elementKey === "hist_trauma" && d.reason === "blank"),
  "blank hist_trauma recorded as dropped"
)

console.log("v2.selftest.ts: ok")
