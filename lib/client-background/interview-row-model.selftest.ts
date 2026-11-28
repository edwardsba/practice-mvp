import assert from "node:assert/strict"

import type { ClientBackgroundSuggestions } from "@/lib/background-questionnaire/to-client-background"
import {
  clientFieldStates,
  clientFieldStatesForItem,
  type ClientFieldDecision,
} from "@/lib/client-background/interview-client-fields"
import {
  clientFieldFileText,
  formatLivingWhoFactLines,
  formatSection3FactLines,
  section3ValueLines,
  section7ValueLines,
} from "@/lib/client-background/interview-facts"
import {
  editValueAriaLabel,
  interviewRowModel,
  plainValueLines,
  valuePartsText,
} from "@/lib/client-background/interview-row-model"
import { emptyDemographics, emptyNecessities, type Demographics } from "@/lib/client-background/types"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

const suggestions: ClientBackgroundSuggestions = {
  identity: {
    sex: { label: "Male", apply: "Male" },
    pronouns: { label: "he/him", apply: "he/him" },
    primaryLanguage: { label: "Greek", apply: "Greek" },
  },
  education: {},
  occupation: {
    workStatus: { label: "Full-time", apply: { workStatus: "full_time", workStatusOther: "" } },
    role: { label: "Nurse", apply: "Nurse" },
    previousJob: { label: "Chef · Bistro", apply: { role: "Chef", employer: "Bistro" } },
    necessities: { label: "Food", apply: { ...emptyNecessities(), food: true } },
  },
  living: {
    housingType: { label: "Private rental", apply: "Private rental" },
    housingStability: { label: "Secure", apply: "Secure" },
  },
  history: {},
  medication: {},
  stressors: {},
}

function rowFor(
  itemKey: string,
  demographics: Demographics,
  decisions: Record<string, ClientFieldDecision> = {}
) {
  const states = clientFieldStatesForItem(clientFieldStates(suggestions, demographics, decisions), itemKey)
  const lines = itemKey.startsWith("s3_")
    ? section3ValueLines(demographics)[itemKey]
    : section7ValueLines(demographics.livingSituation)[itemKey]
  return interviewRowModel(lines, states, (fieldKey) => clientFieldFileText(fieldKey, demographics))
}

const empty = emptyDemographics()

// Single-field rows (section 7 housing type).
check("single field, no client answer → file only", rowFor("s7_who", empty), { choices: [], value: [] })
check("single field, empty file → choice with Not recorded, no file line", rowFor("s7_housing_type", empty), {
  choices: [
    {
      fieldKey: "living.housingType",
      clientLabel: "Private rental",
      fileText: "",
      emptyText: "Not recorded",
      title: "Housing type",
    },
  ],
  value: [],
})
const ownHome = { ...empty, livingSituation: { ...empty.livingSituation, housingType: "Own home" } }
check("single field, different → choice with the file value; value moved into the pair", rowFor("s7_housing_type", ownHome), {
  choices: [
    {
      fieldKey: "living.housingType",
      clientLabel: "Private rental",
      fileText: "Own home",
      emptyText: "Not recorded",
      title: "Housing type",
    },
  ],
  value: [],
})
const rental = { ...empty, livingSituation: { ...empty.livingSituation, housingType: "Private rental" } }
check("single field, same → only the client line", rowFor("s7_housing_type", rental), {
  choices: [],
  value: [{ kind: "client", fieldKey: "living.housingType", text: "Private rental" }],
})
check(
  "single field, different + kept → file only",
  rowFor("s7_housing_type", ownHome, { "living.housingType": { choice: "kept", at: "x" } }),
  { choices: [], value: [{ kind: "file", text: "Own home" }] }
)
check(
  "single field, empty + kept → nothing (row shows Not recorded)",
  rowFor("s7_housing_type", empty, { "living.housingType": { choice: "kept", at: "x" } }),
  { choices: [], value: [] }
)

// Multi-field row (identity): same, different, empty and none together.
const identityFile: Demographics = {
  ...empty,
  identity: { ...empty.identity, sex: "Male", pronouns: "she/her", religion: "Catholic" },
}
const identityRow = rowFor("s3_identity", identityFile)
check("multi-field: one choice per differing / empty sub-field, in field order", identityRow.choices, [
  {
    fieldKey: "identity.pronouns",
    clientLabel: "Pronouns · he/him",
    fileText: "Pronouns: she/her",
    emptyText: "Pronouns: not recorded",
    title: "Pronouns",
  },
  {
    fieldKey: "identity.primaryLanguage",
    clientLabel: "Main language · Greek",
    fileText: "",
    emptyText: "Main language: not recorded",
    title: "Main language",
  },
])
check("multi-field: same sub-field shows as the client line; no-answer sub-field stays", identityRow.value, [
  { kind: "client", fieldKey: "identity.sex", text: "Sex · Male" },
  { kind: "file", text: "Religion: Catholic" },
])
check(
  "aria-label reads the visible value",
  editValueAriaLabel("Identity", valuePartsText(identityRow.value)),
  "Edit Identity, Client: Sex · Male, Religion: Catholic"
)
check("aria-label when nothing is recorded", editValueAriaLabel("Identity", ""), "Edit Identity, not recorded")

// Occupation: combined role line, and the "Most recent job" line that isn't the client's job.
const nurse: Demographics = {
  ...empty,
  occupation: { ...empty.occupation, workStatus: "full_time", role: "Nurse", employer: "Local Health" },
}
check("role same but employer not asked → combined line stays on file", rowFor("s3_occupation", nurse).value, [
  { kind: "client", fieldKey: "occupation.workStatus", text: "Work status · Full-time" },
  { kind: "file", text: "Role and employer: Nurse · Local Health" },
])
const unemployed: Demographics = {
  ...empty,
  occupation: {
    ...empty.occupation,
    workStatus: "unemployed",
    previousJobs: [
      { id: "a", role: "Barista", employer: "Café", started: "", ended: "" },
      { id: "b", role: "Chef", employer: "Bistro", started: "", ended: "" },
    ],
  },
}
const unemployedRow = rowFor("s3_occupation", unemployed)
check(
  "previous job on file but not first → Most recent job stays, client line added",
  unemployedRow.value,
  [
    { kind: "file", text: "Most recent job: Barista · Café" },
    { kind: "client", fieldKey: "occupation.previousJob", text: "Previous job · Chef · Bistro" },
  ]
)
const otherJob: Demographics = {
  ...unemployed,
  occupation: { ...unemployed.occupation, previousJobs: [unemployed.occupation.previousJobs[0]] },
}
const otherJobRow = rowFor("s3_occupation", otherJob)
check(
  "previous job different → Most recent job moves into the pair",
  otherJobRow.choices.find((choice) => choice.fieldKey === "occupation.previousJob")?.fileText,
  "Previous jobs: Barista · Café"
)
assert.ok(
  !otherJobRow.value.some((part) => part.kind === "file" && part.text.startsWith("Most recent job")),
  "different previous job not shown twice"
)
console.log("ok — different previous job not shown twice")

// Financial: question row with one client field among two lines.
const strained: Demographics = {
  ...empty,
  occupation: {
    ...empty.occupation,
    financialConcerns: true,
    financialConcernsDetail: "rent",
    necessities: { ...emptyNecessities(), food: true },
  },
}
check("financial: client line replaces Hard to afford; concerns stay", rowFor("s3_financial", strained).value, [
  { kind: "file", text: "Financial concerns: Yes — rent" },
  { kind: "client", fieldKey: "occupation.necessities", text: "Hard to afford · Food" },
])

// Plain rows (sections 1, 2, 4).
check("plain lines drop bare Not recorded", plainValueLines(["Not recorded"]), [])
check("plain lines keep labelled Not recorded", plainValueLines(["Phone: Not recorded"]), [
  { text: "Phone: Not recorded", fields: [] },
])

// Fact text is unchanged by tagging.
const busy: Demographics = {
  ...identityFile,
  identity: {
    ...identityFile.identity,
    genderDiffersFromSex: true,
    genderIdentity: "Non-binary",
    disability: true,
    disabilityDetail: "ADHD",
    accessibilityNeeds: "Ramp",
  },
  education: {
    level: "Year 12",
    fieldOfStudy: "Art",
    currentlyStudying: false,
    currentlyStudyingDetail: "",
    disruption: true,
    disruptionDetail: "illness",
  },
  occupation: strained.occupation,
}
const tagged = section3ValueLines(busy)
check(
  "section 3 fact text unchanged",
  Object.fromEntries(Object.entries(tagged).map(([key, lines]) => [key, lines.map((entry) => entry.text)])),
  formatSection3FactLines(busy)
)
check("section 7 who line", section7ValueLines({ ...empty.livingSituation, household: "alone" }).s7_who, [
  { text: "Lives alone", fields: ["living.livesWith"] },
])
check(
  "living who fact lines unchanged",
  formatLivingWhoFactLines(
    {
      ...empty.livingSituation,
      household: "with_others",
      othersInHome: [{ id: "o1", who: "Flatmate", dependant: false }],
    },
    []
  ),
  ["Lives with others", "Flatmate · dependant: no"]
)

console.log("interview-row-model.selftest.ts: ok")
