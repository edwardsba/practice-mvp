/**
 * Round AX: person_list / history_list parsers and in_person form behaviour.
 */
import assert from "node:assert/strict"

import { LRAMP_ELEMENTS } from "@/lib/assessments/definitions/lramp"
import {
  cleanHistoryListValues,
  cleanPersonListValues,
  DEFAULT_LIST_FIELD_LABELS,
  formatHistoryListEntryLine,
  formatPersonListEntryLine,
  IN_PERSON_LABEL,
  IN_PERSON_VALUE,
  listFieldLabel,
  parseFormListConfig,
  parseHistoryListEntry,
  parsePersonListEntry,
  serializeHistoryListEntry,
  serializePersonListEntry,
  setPersonPassedAway,
  type FormListConfig,
} from "@/lib/assessments/form-lists"
import { buildAnswerSections } from "@/lib/assessments/answer-rows"
import {
  cleanAnswers,
  optionsForElement,
  toResponseRows,
  validateAnswers,
  visibleElementKeys,
  type FormAnswers,
  type FormElement,
} from "@/lib/assessments/form-rules"

function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name)
  console.log(`ok — ${name}`)
}

const siblingConfig: FormListConfig = {
  addButtonLabel: "+ Add a brother or sister",
  fields: ["firstName", "age", "relationship", "livesWith"],
  relationshipChoices: [
    { label: "Brother", value: "brother" },
    { label: "Sister", value: "sister" },
    { label: "Other", value: "other" },
  ],
}

// --- Parsing person_list ---

check(
  "person parse keeps known fields",
  parsePersonListEntry(
    JSON.stringify({
      firstName: "Jane",
      age: 47,
      relationship: "sister",
      livesWith: "yes",
      unknown: "drop me",
      ageAsString: "nope",
    }),
    siblingConfig
  ),
  { firstName: "Jane", age: 47, relationship: "sister", livesWith: "yes" }
)

check(
  "person parse drops blank entry",
  parsePersonListEntry(JSON.stringify({ firstName: "  ", unknown: 1 }), siblingConfig),
  null
)

check(
  "person parse rejects bad age and bad relationship",
  parsePersonListEntry(
    JSON.stringify({ firstName: "Sam", age: 200, relationship: "cousin", livesWith: "maybe" }),
    siblingConfig
  ),
  { firstName: "Sam" }
)

check(
  "person clean drops blanks and unknown-only JSON",
  cleanPersonListValues(
    [
      serializePersonListEntry({ firstName: "A", age: 10 }),
      "{}",
      "not-json",
      serializePersonListEntry({}),
      JSON.stringify({ junk: true }),
    ],
    siblingConfig
  ),
  [serializePersonListEntry({ firstName: "A", age: 10 })]
)

check(
  "person collapsed line (client audience)",
  formatPersonListEntryLine(
    { firstName: "Jane", age: 47, relationship: "sister", livesWith: "yes" },
    siblingConfig,
    "client"
  ),
  { name: "Jane", details: "47 · Sister · lives with you" }
)

check(
  "person collapsed line (readonly audience)",
  formatPersonListEntryLine(
    { firstName: "Jane", age: 47, relationship: "sister", livesWith: "no" },
    siblingConfig,
    "readonly"
  ),
  { name: "Jane", details: "47 · Sister · doesn't live with client" }
)

check(
  "person year range from–to",
  formatPersonListEntryLine(
    { firstName: "Jo", fromYear: 2005, toYear: 2011 },
    { addButtonLabel: "+ Add", fields: ["firstName", "fromYear", "toYear"] },
    "readonly"
  ),
  { name: "Jo", details: "2005–2011" }
)

check(
  "person fromYear alone → since",
  formatPersonListEntryLine(
    { firstName: "Jo", fromYear: 1999 },
    { addButtonLabel: "+ Add", fields: ["firstName", "fromYear"] },
    "readonly"
  ),
  { name: "Jo", details: "since 1999" }
)

check(
  "person toYear alone → until",
  formatPersonListEntryLine(
    { firstName: "Jo", toYear: 2011 },
    { addButtonLabel: "+ Add", fields: ["firstName", "toYear"] },
    "readonly"
  ),
  { name: "Jo", details: "until 2011" }
)

const pastRelationshipConfig: FormListConfig = {
  addButtonLabel: "+ Add a past relationship",
  fields: ["firstName", "relationship", "fromYear", "toYear", "howEnded"],
  relationshipChoices: [
    { label: "Married", value: "married" },
    { label: "De facto (lived together)", value: "defacto" },
    { label: "Engaged", value: "engaged" },
    {
      label: "Together, not living together",
      value: "in_relationship_not_living_together",
    },
    { label: "Dating", value: "dating" },
    { label: "Other", value: "other" },
  ],
  howEndedChoices: [
    { label: "Separated", value: "separated" },
    { label: "Divorced", value: "divorced" },
    { label: "Partner passed away", value: "partner_passed_away" },
    { label: "Other", value: "other" },
  ],
}

check(
  "past relationship collapsed line includes type, years, how ended",
  formatPersonListEntryLine(
    {
      firstName: "Sam",
      relationship: "married",
      fromYear: 2010,
      toYear: 2018,
      howEnded: "divorced",
    },
    pastRelationshipConfig,
    "client"
  ),
  { name: "Sam", details: "Married · 2010–2018 · Divorced" }
)

check(
  "past relationship parse keeps relationship type",
  parsePersonListEntry(
    JSON.stringify({
      firstName: "Sam",
      relationship: "defacto",
      fromYear: 2010,
      toYear: 2018,
      howEnded: "separated",
    }),
    pastRelationshipConfig
  ),
  {
    firstName: "Sam",
    relationship: "defacto",
    fromYear: 2010,
    toYear: 2018,
    howEnded: "separated",
  }
)

check(
  "default livesWith label is Lives with you?",
  DEFAULT_LIST_FIELD_LABELS.livesWith,
  "Lives with you?"
)

check(
  "setPersonPassedAway ticks and keeps age",
  setPersonPassedAway({ firstName: "Pat", age: 72, relationship: "mother" }, true),
  { firstName: "Pat", age: 72, relationship: "mother", passedAway: true }
)

check(
  "setPersonPassedAway unticks and clears deathYear",
  setPersonPassedAway(
    { firstName: "Pat", age: 72, passedAway: true, deathYear: 2012 },
    false
  ),
  { firstName: "Pat", age: 72 }
)

const passedAwayConfig: FormListConfig = {
  addButtonLabel: "+ Add a parent",
  fields: ["firstName", "age", "passedAway", "deathYear", "relationship"],
  relationshipChoices: [
    { label: "Mother", value: "mother" },
    { label: "Father", value: "father" },
  ],
}

check(
  "person parse keeps age when passedAway is true",
  parsePersonListEntry(
    JSON.stringify({
      firstName: "Pat",
      age: 72,
      passedAway: true,
      deathYear: 2012,
      relationship: "mother",
    }),
    passedAwayConfig
  ),
  { firstName: "Pat", age: 72, relationship: "mother", passedAway: true, deathYear: 2012 }
)

check(
  "person parse keeps deathYear only with passedAway",
  parsePersonListEntry(
    JSON.stringify({ firstName: "Pat", deathYear: 2012, relationship: "mother" }),
    passedAwayConfig
  ),
  { firstName: "Pat", relationship: "mother" }
)

check(
  "person parse drops out-of-range deathYear",
  parsePersonListEntry(
    JSON.stringify({
      firstName: "Pat",
      passedAway: true,
      deathYear: 1800,
      relationship: "mother",
    }),
    passedAwayConfig
  ),
  { firstName: "Pat", relationship: "mother", passedAway: true }
)

check(
  "person collapsed line: passed away with year and age",
  formatPersonListEntryLine(
    { firstName: "Sarah", age: 58, passedAway: true, deathYear: 2012, relationship: "mother" },
    passedAwayConfig,
    "readonly"
  ),
  { name: "Sarah", details: "Mother · passed away in 2012 aged 58" }
)

check(
  "person collapsed line: passed away aged only",
  formatPersonListEntryLine(
    { firstName: "Pat", age: 72, passedAway: true, relationship: "mother" },
    passedAwayConfig,
    "readonly"
  ),
  { name: "Pat", details: "Mother · passed away aged 72" }
)

check(
  "person collapsed line: passed away in year only",
  formatPersonListEntryLine(
    { firstName: "Pat", passedAway: true, deathYear: 2012, relationship: "mother" },
    passedAwayConfig,
    "readonly"
  ),
  { name: "Pat", details: "Mother · passed away in 2012" }
)

check(
  "list labels: custom used, unknown keys and non-strings dropped",
  parseFormListConfig({
    addButtonLabel: "+ Add another",
    fields: ["firstName", "passedAway", "what"],
    labels: {
      firstName: "Given name",
      passedAway: "Has died",
      what: "Event",
      when: "Around when",
      nope: "Ignored",
      age: 12,
      livesWith: "  ",
    },
  }),
  {
    addButtonLabel: "+ Add another",
    fields: ["firstName", "passedAway"],
    labels: {
      firstName: "Given name",
      passedAway: "Has died",
      what: "Event",
      when: "Around when",
    },
  }
)

check(
  "listFieldLabel falls back to defaults",
  [
    listFieldLabel(null, "livesWith"),
    listFieldLabel({ addButtonLabel: "+ Add", labels: { what: "Event" } }, "what"),
    listFieldLabel({ addButtonLabel: "+ Add", labels: { what: "Event" } }, "when"),
  ],
  ["Lives with you?", "Event", "When"]
)

// --- Parsing history_list ---

check(
  "history parse keeps what/when, drops unknown",
  parseHistoryListEntry(JSON.stringify({ what: "Depression", when: "about age 25", extra: 1 })),
  { what: "Depression", when: "about age 25" }
)

check(
  "history parse drops blank",
  parseHistoryListEntry(JSON.stringify({ what: "  ", when: "" })),
  null
)

check(
  "history clean drops blanks",
  cleanHistoryListValues([
    serializeHistoryListEntry({ what: "Depression", when: "2019" }),
    "{}",
    serializeHistoryListEntry({}),
  ]),
  [serializeHistoryListEntry({ what: "Depression", when: "2019" })]
)

check(
  "history collapsed line",
  formatHistoryListEntryLine({ what: "Depression", when: "about age 25" }),
  "Depression · from about age 25"
)

check(
  "list config parse",
  parseFormListConfig({
    addButtonLabel: "+ Add another",
    fields: ["firstName", "nope", "age"],
    relationshipChoices: [{ label: "Brother", value: "brother" }],
  }),
  {
    addButtonLabel: "+ Add another",
    fields: ["firstName", "age"],
    relationshipChoices: [{ label: "Brother", value: "brother" }],
  }
)

// --- in_person ---

const withInPerson: FormElement = {
  elementKey: "talk",
  elementType: "yes_no",
  questionText: "Any concerns?",
  groupLabel: null,
  subgroupLabel: null,
  displayOrder: 1,
  isRequired: true,
  parentElementKey: null,
  showWhen: null,
  requiredGroupKey: null,
  helpText: null,
  allowInPerson: true,
  options: [
    { label: "Yes", value: "yes", displayOrder: 1, scoreValue: 2 },
    { label: "No", value: "no", displayOrder: 2, scoreValue: 0 },
  ],
}

const followUp: FormElement = {
  elementKey: "detail",
  elementType: "short_text",
  questionText: "Say more",
  groupLabel: null,
  subgroupLabel: null,
  displayOrder: 2,
  isRequired: true,
  parentElementKey: "talk",
  showWhen: { key: "talk", in: ["yes"] },
  requiredGroupKey: null,
  helpText: null,
  options: [],
}

check(
  "in_person is last option",
  optionsForElement(withInPerson).map((o) => o.value),
  ["yes", "no", IN_PERSON_VALUE]
)
check(
  "in_person label",
  optionsForElement(withInPerson).find((o) => o.value === IN_PERSON_VALUE)?.label,
  IN_PERSON_LABEL
)

const answeredInPerson: FormAnswers = { talk: [IN_PERSON_VALUE] }
check("in_person counts as answered", validateAnswers([withInPerson, followUp], answeredInPerson), [])
check(
  "in_person does not fire yes show_when",
  [...visibleElementKeys([withInPerson, followUp], answeredInPerson)].sort(),
  ["talk"]
)

const scored = toResponseRows([withInPerson], answeredInPerson)
check("in_person scores 0", scored, [
  {
    elementKey: "talk",
    responseValue: IN_PERSON_VALUE,
    responseOrder: null,
    scoreValue: 0,
  },
])

const yesAnswers: FormAnswers = { talk: ["yes"], detail: ["more"] }
check(
  "yes still opens follow-up",
  [...visibleElementKeys([withInPerson, followUp], yesAnswers)].sort(),
  ["detail", "talk"]
)
check(
  "yes still scores from option",
  toResponseRows([withInPerson], { talk: ["yes"] })[0]?.scoreValue,
  2
)

// Group "at least one" accepts in_person
const groupA: FormElement = {
  ...withInPerson,
  elementKey: "g1",
  isRequired: false,
  requiredGroupKey: "g",
  allowInPerson: true,
}
const groupB: FormElement = {
  ...withInPerson,
  elementKey: "g2",
  isRequired: false,
  requiredGroupKey: "g",
  allowInPerson: true,
}
check(
  "in_person satisfies at-least-one group",
  validateAnswers([groupA, groupB], { g1: [IN_PERSON_VALUE] }),
  []
)

// --- person_list / history_list in form rules ---

const peopleEl: FormElement = {
  elementKey: "siblings",
  elementType: "person_list",
  questionText: "Brothers and sisters",
  groupLabel: "Family",
  subgroupLabel: null,
  displayOrder: 1,
  isRequired: true,
  parentElementKey: null,
  showWhen: null,
  requiredGroupKey: null,
  helpText: null,
  options: [],
  listConfig: siblingConfig,
}

const historyEl: FormElement = {
  elementKey: "mh",
  elementType: "history_list",
  questionText: "Mental health history",
  groupLabel: "History",
  subgroupLabel: null,
  displayOrder: 1,
  isRequired: false,
  parentElementKey: null,
  showWhen: null,
  requiredGroupKey: null,
  helpText: null,
  options: [],
  listConfig: { addButtonLabel: "+ Add another" },
}

const dirtyLists: FormAnswers = {
  siblings: [
    serializePersonListEntry({ firstName: "Jane", relationship: "sister" }),
    "{}",
    serializePersonListEntry({ firstName: "  " }),
  ],
  mh: [
    serializeHistoryListEntry({ what: "Depression", when: "about age 25" }),
    serializeHistoryListEntry({}),
  ],
}

const cleaned = cleanAnswers([peopleEl, historyEl], dirtyLists)
check("cleanAnswers drops blank list entries", cleaned, {
  siblings: [serializePersonListEntry({ firstName: "Jane", relationship: "sister" })],
  mh: [serializeHistoryListEntry({ what: "Depression", when: "about age 25" })],
})

check("required person_list empty fails", validateAnswers([peopleEl], {}).length > 0, true)
check(
  "required person_list with entry passes",
  validateAnswers([peopleEl], {
    siblings: [serializePersonListEntry({ firstName: "Jane" })],
  }),
  []
)

const sections = buildAnswerSections([peopleEl, historyEl], cleaned)
const familyRows = sections.find((s) => s.groupLabel === "Family")?.rows ?? []
const historyRows = sections.find((s) => s.groupLabel === "History")?.rows ?? []
check(
  "results person_list line",
  familyRows
    .filter((r) => r.kind === "answer")
    .map((r) => (r.kind === "answer" ? r.answer : null)),
  [{ kind: "list", values: ["Jane · Sister"] }]
)

const livesWithEl: FormElement = {
  ...peopleEl,
  elementKey: "kids",
  listConfig: {
    addButtonLabel: "+ Add a child",
    fields: ["firstName", "livesWith"],
  },
}
const livesWithAnswers: FormAnswers = {
  kids: [serializePersonListEntry({ firstName: "Sam", livesWith: "yes" })],
}
const livesWithSections = buildAnswerSections([livesWithEl], livesWithAnswers)
check(
  "results person_list uses readonly livesWith wording",
  livesWithSections[0]?.rows
    .filter((r) => r.kind === "answer")
    .map((r) => (r.kind === "answer" ? r.answer : null)),
  [{ kind: "list", values: ["Sam · lives with client"] }]
)
check(
  "results history_list line",
  historyRows
    .filter((r) => r.kind === "answer")
    .map((r) => (r.kind === "answer" ? r.answer : null)),
  [{ kind: "list", values: ["Depression · from about age 25"] }]
)

const inPersonSections = buildAnswerSections([withInPerson], answeredInPerson)
check(
  "results in_person label",
  inPersonSections[0]?.rows
    .filter((r) => r.kind === "answer")
    .map((r) => (r.kind === "answer" ? r.answer : null)),
  [{ kind: "text", value: IN_PERSON_LABEL }]
)

// --- Existing LRAMP definition still validates ---

const lrampEmpty = validateAnswers(
  LRAMP_ELEMENTS,
  Object.fromEntries(LRAMP_ELEMENTS.map((el) => [el.elementKey, []])) as FormAnswers
)
assert.ok(lrampEmpty.length > 0, "LRAMP with no answers still has required errors")
check(
  "LRAMP elements unchanged types",
  LRAMP_ELEMENTS.every(
    (el) =>
      el.elementType === "radio" ||
      el.elementType === "yes_no" ||
      el.elementType === "checkbox" ||
      el.elementType === "tick" ||
      el.elementType === "text_list" ||
      el.elementType === "long_text" ||
      el.elementType === "short_text" ||
      el.elementType === "date"
  ),
  true
)
check(
  "LRAMP has no allowInPerson / listConfig required",
  LRAMP_ELEMENTS.every((el) => el.allowInPerson !== true && el.listConfig == null),
  true
)

const lrampYes = LRAMP_ELEMENTS.find((el) => el.elementType === "yes_no")
assert.ok(lrampYes)
check(
  "LRAMP yes_no without flag has no in_person option",
  optionsForElement(lrampYes!).some((o) => o.value === IN_PERSON_VALUE),
  false
)

console.log("form-lists.selftest.ts: ok")
