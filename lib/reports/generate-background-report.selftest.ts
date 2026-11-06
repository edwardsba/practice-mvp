import assert from "node:assert/strict"

import type { ScreeningAnswers } from "@/lib/client-background/interview-history"
import { significantOtherParagraphs } from "@/lib/reports/background-family-paragraphs"
import {
  emptyClientRelationshipStatus,
  emptyDemographics,
  emptyEvent,
  emptyReasonForAttending,
  emptyRisk,
  emptyStressors,
  type ClientBackgroundData,
  type EventRecord,
  type RelationshipRecord,
} from "@/lib/client-background/types"
import {
  generateBackgroundReport,
  lowerKeepingTypedCase,
  numberedLetterOutline,
  chooseReportInterviews,
  type BackgroundReportSource,
} from "@/lib/reports/generate-background-report"
import type { LetterBodyNode } from "@/lib/reports/letter-body-types"

function person(
  partial: Partial<RelationshipRecord> & Pick<RelationshipRecord, "relationshipRecordId" | "relationshipToClient">
): RelationshipRecord {
  return {
    sex: "",
    givenName: "",
    displayOrder: 0,
    dateOfBirth: "",
    approximateAge: null,
    approximateAgeRecordedOn: "",
    healthStatus: "",
    deceased: false,
    ageAtDeath: null,
    dateOfDeath: "",
    healthOrCauseOfDeath: "",
    childType: "",
    childTypeDetail: "",
    supportive: "",
    conflict: "",
    qualityOfRelationship: "",
    dependency: "",
    livingSituation: "",
    caregiverRelationship: "",
    caregiverRelationshipDetail: "",
    notKnown: false,
    ...partial,
  }
}

function event(partial: Partial<EventRecord> & Pick<EventRecord, "eventType">): EventRecord {
  return {
    ...emptyEvent(partial.eventType, partial.displayOrder ?? 0),
    eventRecordId: partial.eventRecordId ?? "event-1",
    ...partial,
  }
}

function benSource(): BackgroundReportSource {
  const demographics = emptyDemographics()
  demographics.identity.sex = "Male"
  demographics.identity.pronouns = "he/him"
  demographics.identity.raceEthnicity = "Australian"
  demographics.identity.primaryLanguage = "English"
  demographics.identity.religion = "Catholic"
  demographics.identity.disability = false
  demographics.education.level = "Trade apprenticeship"
  demographics.education.fieldOfStudy = "carpentry"
  demographics.education.currentlyStudying = true
  demographics.education.currentlyStudyingDetail = "a certificate IV"
  demographics.occupation.workStatus = "full_time"
  demographics.occupation.role = "carpenter"
  demographics.occupation.necessities.food = true
  demographics.occupation.necessities.transport = true
  demographics.livingSituation.livesWith = "with_partner_and_children"
  demographics.livingSituation.housingType = "Private rental"
  demographics.livingSituation.housingStability = "Stable"

  const data: ClientBackgroundData = {
    dateOfBirth: "1970-01-15",
    backgroundCapturedAt: null,
    relationshipStatus: { ...emptyClientRelationshipStatus(), relationshipStatus: "married" },
    demographics,
    stressors: {
      ...emptyStressors(),
      family: "yes",
      socialLife: "no",
      intimateRelationships: "no",
      workStudy: "no",
      financial: "yes",
      ownHealth: "no",
      othersHealth: "no",
      lossOfLovedOne: "no",
      legalPoliceAccidents: "no",
      mainReason: "I can't switch off",
    },
    reason: {
      ...emptyReasonForAttending(),
      referralType: "medical",
      referrerConcerns: "low mood",
    },
    relationships: [
      person({
        relationshipRecordId: "wife",
        relationshipToClient: "current_partner",
        sex: "Female",
        givenName: "Should Not Appear",
      }),
      person({ relationshipRecordId: "prior-1", relationshipToClient: "prior_partner", givenName: "Pat" }),
      person({ relationshipRecordId: "prior-2", relationshipToClient: "prior_partner", givenName: "Jo" }),
      person({
        relationshipRecordId: "child-1",
        relationshipToClient: "child_biological",
        givenName: "Child One",
        dateOfBirth: "2017-05-01",
      }),
      person({
        relationshipRecordId: "child-2",
        relationshipToClient: "child_biological",
        givenName: "Child Two",
        dateOfBirth: "2019-03-01",
      }),
      person({
        relationshipRecordId: "child-3",
        relationshipToClient: "child_biological",
        givenName: "Child Three",
        dateOfBirth: "2020-04-01",
      }),
      person({
        relationshipRecordId: "mother",
        relationshipToClient: "mother",
        givenName: "Margaret",
        healthStatus: "good",
      }),
      person({
        relationshipRecordId: "father",
        relationshipToClient: "father",
        givenName: "John",
        healthStatus: "deceased",
        deceased: true,
        dateOfDeath: "1993",
      }),
      person({
        relationshipRecordId: "sib-1",
        relationshipToClient: "sibling_full",
        givenName: "Sibling One",
        dateOfBirth: "1978-01-01",
      }),
      person({
        relationshipRecordId: "sib-2",
        relationshipToClient: "sibling_full",
        givenName: "Sibling Two",
        dateOfBirth: "1981-06-01",
      }),
      person({
        relationshipRecordId: "step-sib",
        relationshipToClient: "sibling_step",
        givenName: "Step Sibling",
        dateOfBirth: "1998-03-01",
      }),
    ],
    events: [
      event({
        eventRecordId: "leg",
        eventType: "illness_injury",
        title: "A broken leg",
        description: "SECRET DESCRIPTION must not appear",
        startPrecision: "year",
        startValue: "1982",
        displayOrder: 1,
      }),
      event({
        eventRecordId: "depression",
        eventType: "illness_injury",
        title: "Depression",
        description: "Another secret description",
        startPrecision: "date",
        startValue: "2000-06-01",
        displayOrder: 2,
      }),
      event({
        eventRecordId: "harm-1",
        eventType: "self_harm",
        title: "Cutting episode",
        description: "Harm description must not appear",
        startPrecision: "date",
        startValue: "1984-06-01",
        displayOrder: 3,
      }),
      event({
        eventRecordId: "harm-2",
        eventType: "self_harm",
        title: "Overdose",
        startPrecision: "date",
        startValue: "1988-03-01",
        displayOrder: 4,
      }),
      event({
        eventRecordId: "mother-mood",
        eventType: "emotional_problems",
        about: "significant_other",
        title: "Anxiety",
        description: "Family description must not appear",
        relationshipRecordId: "mother",
        startPrecision: "year",
        startValue: "1990",
        displayOrder: 5,
      }),
      event({
        eventRecordId: "brother-mood",
        eventType: "emotional_problems",
        about: "significant_other",
        title: "Low mood",
        aboutOther: "Brother",
        startPrecision: "year",
        startValue: "2001",
        displayOrder: 6,
      }),
    ],
    risk: emptyRisk(),
  }

  const screening: ScreeningAnswers = {
    illness_injury: "yes",
    traumatic_events: "yes",
    emotional_problems: "not_asked",
    substance_use: "no",
    self_harm: "yes",
    psychiatric_admission: "no",
    previous_therapy: "no",
    other_significant_events: "no",
    family_illness: "no",
    family_emotional_problems: "yes",
    family_substance_use: "no",
    family_self_harm: "no",
    family_psychiatric_admission: "no",
    family_significant_events: "no",
  }

  return {
    reportDate: "2026-10-29",
    clientFirstName: "Ben01",
    clientLastName: "Lee",
    dateOfBirth: "1970-01-15",
    practitionerName: "Ben Edwards",
    practitionerReportIntroduction: [
      "I am Benjamin Edwards, a registered psychologist.",
      "",
      "I have been registered as a psychologist since 2014.",
      "   ",
      "My principal therapeutic modalities include CBT.",
    ].join("\n"),
    data,
    screening,
    interviews: [{ date: "2026-10-01" }],
    selfReportDate: "2026-09-01",
    numberOfChildren: 3,
    referral: {
      title: "Dr",
      firstName: "Harry",
      lastName: "Nguyen",
      profession: "General practitioner",
      date: "2026-07-20",
    },
  }
}

function textOf(node: LetterBodyNode): string {
  if (node.text) return node.text
  return (node.content ?? []).map(textOf).join("")
}

const draft = generateBackgroundReport(benSource())
const outline = numberedLetterOutline(draft.document)
const body = outline.join("\n")

assert.equal(draft.document.content[0]?.type, "heading")
assert.equal(textOf(draft.document.content[0]), "Purpose and Scope")
assert.equal(draft.document.content.at(-1)?.type, "paragraph")
assert.equal(textOf(draft.document.content.at(-1)!), "Yours sincerely,")
assert.doesNotMatch(body, /BACKGROUND REPORT/i)
assert.doesNotMatch(body, /29 October 2026/)
assert.doesNotMatch(body, /\bdenied\b/i)
assert.doesNotMatch(body, /SECRET/i)
assert.match(body, /Ben01's mother \(Margaret\)/)
assert.doesNotMatch(body, /SAGE|PHQ|questionnaire|treatment commenced|mental state|\bMSE\b/i)

assert.deepEqual(
  outline.filter((line) => /^\d+ /.test(line)),
  [
    "1 Purpose and Scope",
    "2 Sources",
    "3 Presenting Problem",
    "4 Demographics",
    "5 Client History",
    "6 Family and Significant Others",
    "7 Summary",
  ]
)

assert.deepEqual(
  outline.filter((line) => line.startsWith("1.")),
  [
    "1.1. I am Benjamin Edwards, a registered psychologist.",
    "1.2. I have been registered as a psychologist since 2014.",
    "1.3. My principal therapeutic modalities include CBT.",
    "1.4. This report summarises my background assessment of Ben01 Lee.",
    "1.5. The report addresses Ben01's presenting problem, demographics, client history, and family and significant others.",
  ]
)
assert.equal(
  draft.omitted.some((item) => item.id === "report-introduction"),
  false
)

assert.deepEqual(
  outline.filter((line) => line.startsWith("2.")),
  [
    "2.1. Referral from Dr Harry Nguyen, GP, 20 July 2026.",
    "2.2. Clinical interview, 1 October 2026.",
  ]
)

const presenting = outline.filter((line) => line.startsWith("3.")).join("\n")
assert.match(presenting, /Ben01 was referred by his GP, Dr Harry Nguyen, on 20 July 2026, with concerns about low mood\./)
assert.match(presenting, /Ben01 reported current difficulties with family and finances\./)
assert.doesNotMatch(presenting, /social life|work or study|denied/i)
assert.match(presenting, /He described the main problem as "I can't switch off"\./)
assert.doesNotMatch(presenting, /His partner came to the first appointment/)
assert.doesNotMatch(presenting, /He attended on his own initiative/)
assert.equal(presenting.includes("willingly"), false)
assert.equal(lowerKeepingTypedCase("GP"), "GP")
assert.equal(lowerKeepingTypedCase("TAFE"), "TAFE")
assert.equal(lowerKeepingTypedCase("Social Worker"), "social worker")
assert.equal(lowerKeepingTypedCase("GP/Psychiatrist"), "GP/psychiatrist")
assert.equal(lowerKeepingTypedCase("McKenzie"), "McKenzie")
assert.doesNotMatch(presenting, /He wants to feel more like himself\./)
assert.doesNotMatch(presenting, /own initiative|encouragement of others/)

const demographics = outline.filter((line) => line.startsWith("4.")).join("\n")
assert.match(demographics, /Ben01 is a 56-year-old male \(he\/him\)\./)
assert.match(
  demographics,
  /He describes his cultural background as Australian and his religion as Catholic, and he mainly speaks English at home\./
)
assert.doesNotMatch(demographics, /married to his wife|parents divorced|father died|full siblings|has three children/)
assert.match(
  demographics,
  /He lives with his wife and children in a private rental and describes his housing as stable\./
)
assert.match(
  demographics,
  /His highest level of education is a trade apprenticeship in carpentry\. He is currently studying a certificate IV\./
)
assert.match(demographics, /He works full-time as a carpenter\./)
assert.match(demographics, /He reported difficulty affording food and transport\./)
assert.doesNotMatch(demographics, /reported no disability/)
assert.doesNotMatch(demographics, /not currently taking medication/)

assert.equal(outline.includes("5 Client History"), true)
assert.equal(outline.includes("6 Family and Significant Others"), true)
assert.equal(outline.includes("Risk Assessment"), false)
assert.doesNotMatch(body, /ASSIST/)
assert.match(
  outline.find((line) => line.startsWith("5.1.")) ?? "",
  /Ben01 reported illnesses or injuries: a broken leg at age 12 \(1982\) and depression at age 30 \(2000\)\./
)
assert.match(
  outline.find((line) => line.startsWith("5.2.")) ?? "",
  /Ben01 reported self-harm: cutting episode at age 14 \(1984\) and overdose at age 18 \(1988\)\./
)
assert.match(
  outline.find((line) => line.startsWith("6.1.")) ?? "",
  /Ben01's mother \(Margaret\) has a history of anxiety\. A brother of Ben01's has a history of low mood\./
)
assert.match(body, /\[Summary — practitioner to write\.\]/)
assert.doesNotMatch(body, /reported experiencing traumatic|family history of substance/)
assert.doesNotMatch(body, /including \./)
assert.doesNotMatch(body, /including at\b/)

assert.ok(draft.omitted.some((item) => item.message === "Traumatic events is Yes, with no entries."))
assert.ok(draft.omitted.some((item) => item.message === "Emotional problems not asked"))
assert.equal(
  draft.omitted.some((item) => item.message === "Medication is Yes, with no entries."),
  false
)

const clearNecessities = benSource()
for (const key of Object.keys(clearNecessities.data.demographics.occupation.necessities) as Array<
  keyof typeof clearNecessities.data.demographics.occupation.necessities
>) {
  clearNecessities.data.demographics.occupation.necessities[key] = false
}
const clearText = numberedLetterOutline(generateBackgroundReport(clearNecessities).document).join("\n")
assert.match(clearText, /He reported no difficulty affording basic necessities\./)
assert.doesNotMatch(clearText, /difficulty affording food/)

const unknownNecessities = benSource()
unknownNecessities.selfReportDate = null
unknownNecessities.data.demographics.occupation.workStatus = ""
unknownNecessities.data.demographics.occupation.role = ""
unknownNecessities.data.demographics.occupation.previousJobs = []
for (const key of Object.keys(unknownNecessities.data.demographics.occupation.necessities) as Array<
  keyof typeof unknownNecessities.data.demographics.occupation.necessities
>) {
  unknownNecessities.data.demographics.occupation.necessities[key] = false
}
assert.doesNotMatch(
  numberedLetterOutline(generateBackgroundReport(unknownNecessities).document).join("\n"),
  /basic necessities/
)

const emptyIntro = benSource()
emptyIntro.practitionerReportIntroduction = "\n  \n"
const emptyIntroDraft = generateBackgroundReport(emptyIntro)
const emptyIntroLines = numberedLetterOutline(emptyIntroDraft.document).filter((line) => line.startsWith("1."))
assert.equal(emptyIntroLines[0], "1.1. I am Ben Edwards.")
assert.ok(
  emptyIntroDraft.omitted.some(
    (item) =>
      item.message === "Your report introduction is empty — add it in your practitioner profile" &&
      item.target === "practitioner"
  )
)

const missingDeath = benSource()
const father = missingDeath.data.relationships.find((row) => row.relationshipToClient === "father")
assert.ok(father)
father.dateOfDeath = ""
const missingDeathDraft = generateBackgroundReport(missingDeath)
assert.doesNotMatch(numberedLetterOutline(missingDeathDraft.document).join("\n"), /His father is deceased\./)
assert.ok(missingDeathDraft.omitted.some((item) => item.message === "Father's year of death not recorded"))

const openParents = benSource()
const openParentsDraft = generateBackgroundReport(openParents)
assert.doesNotMatch(numberedLetterOutline(openParentsDraft.document).join("\n"), /His parents are divorced\./)
assert.equal(
  openParentsDraft.omitted.some((item) => item.message === "When his parents separated not recorded"),
  false
)

const theySource = benSource()
theySource.clientFirstName = "Alex"
theySource.data.demographics.identity.pronouns = "they/them"
theySource.data.demographics.identity.sex = "Female"
const theyText = numberedLetterOutline(generateBackgroundReport(theySource).document).join("\n")
assert.doesNotMatch(theyText, /\bthey is\b/i)
assert.doesNotMatch(theyText, /\bthey has\b/i)
assert.doesNotMatch(theyText, /\bthey was\b/i)
assert.match(theyText, /Alex is a 56-year-old female \(they\/them\)\./)
assert.doesNotMatch(theyText, /married to their wife|divorced in 1978|died in 1993/)
assert.doesNotMatch(theyText, /not currently taking medication/)

function emptySource(): BackgroundReportSource {
  return {
    reportDate: "2026-10-29",
    clientFirstName: "Ben01",
    clientLastName: "Lee",
    dateOfBirth: null,
    practitionerName: "Ben Edwards",
    practitionerReportIntroduction: "I am Ben Edwards.",
    data: {
      dateOfBirth: null,
      backgroundCapturedAt: null,
      relationshipStatus: emptyClientRelationshipStatus(),
      demographics: emptyDemographics(),
      stressors: emptyStressors(),
      reason: emptyReasonForAttending(),
      relationships: [],
      events: [],
      risk: emptyRisk(),
    },
    screening: null,
    interviews: [],
    selfReportDate: null,
    numberOfChildren: null,
    referral: null,
  }
}

const noInterview = generateBackgroundReport(emptySource())
const blankOutline = numberedLetterOutline(noInterview.document)
assert.equal(noInterview.document.type, "doc")
assert.equal(noInterview.document.content[0]?.type, "heading")
assert.deepEqual(
  blankOutline.filter((line) => /^\d+ /.test(line)),
  [
    "1 Purpose and Scope",
    "2 Sources",
    "3 Presenting Problem",
    "4 Demographics",
    "5 Client History",
    "6 Family and Significant Others",
    "7 Summary",
  ]
)
assert.match(blankOutline.join("\n"), /\[Presenting problem — not yet recorded\.\]/)
assert.match(blankOutline.join("\n"), /\[Demographics — not yet recorded\.\]/)
assert.equal(blankOutline.includes("Risk Assessment"), false)
assert.doesNotMatch(blankOutline.join("\n"), /ASSIST/)
assert.equal(blankOutline.includes("5 Client History"), true)
assert.equal(blankOutline.includes("6 Family and Significant Others"), true)
assert.match(blankOutline.join("\n"), /\[No client history recorded\.\]/)
assert.match(blankOutline.join("\n"), /\[No family or significant other history recorded\.\]/)
assert.match(blankOutline.join("\n"), /\[No sources recorded\.\]/)
assert.equal(
  blankOutline.some((line) => line.includes("Clinical interview")),
  false
)
assert.doesNotMatch(blankOutline.join("\n"), /including \.|including at\b/)

const kept = chooseReportInterviews([
  {
    status: "completed",
    startedAt: "2026-10-15T01:00:00.000Z",
    completedAt: "2026-10-15T02:00:00.000Z",
    date: "2026-10-15",
  },
  {
    status: "completed",
    startedAt: "2026-10-15T03:00:00.000Z",
    completedAt: "2026-10-15T04:00:00.000Z",
    date: "2026-10-15",
  },
  {
    status: "in_progress",
    startedAt: "2026-10-20T01:00:00.000Z",
    completedAt: null,
    date: "2026-10-20",
  },
])
assert.equal(kept.answerIndex, 1)
assert.deepEqual(kept.dates, ["2026-10-15"])
assert.equal(kept.writtenFromIncomplete, false)

const fallback = chooseReportInterviews([
  { status: "in_progress", startedAt: "2026-10-01T00:00:00.000Z", completedAt: null, date: "2026-10-01" },
  { status: "in_progress", startedAt: "2026-10-20T00:00:00.000Z", completedAt: null, date: "2026-10-20" },
])
assert.equal(fallback.answerIndex, 1)
assert.deepEqual(fallback.dates, ["2026-10-20"])
assert.equal(fallback.writtenFromIncomplete, true)

const duplicateDates = benSource()
duplicateDates.interviews = [{ date: "2026-10-15" }, { date: "2026-10-15" }]
const duplicateSources = numberedLetterOutline(generateBackgroundReport(duplicateDates).document).filter((line) =>
  line.includes("Clinical interview")
)
assert.deepEqual(duplicateSources, ["2.2. Clinical interview, 15 October 2026."])

const incomplete = benSource()
incomplete.screeningFromIncomplete = true
assert.ok(
  generateBackgroundReport(incomplete).omitted.some(
    (item) => item.message === "Report written from an interview that is not yet completed" && item.target === "interview"
  )
)

const december = emptySource()
december.clientFirstName = "Alex"
december.dateOfBirth = "1974-12-15"
december.data.dateOfBirth = "1974-12-15"
december.data.demographics.identity.pronouns = "they/them"
december.data.demographics.identity.sex = "Female"
december.reportDate = "2027-03-01"
december.screening = {
  illness_injury: "yes",
  traumatic_events: "yes",
  emotional_problems: "yes",
  substance_use: "yes",
  other_significant_events: "yes",
}
december.data.events = [
  event({
    eventRecordId: "blank-illness",
    eventType: "illness_injury",
    title: "",
    startPrecision: "",
    startValue: "",
  }),
  event({
    eventRecordId: "fall",
    eventType: "illness_injury",
    title: "A fall",
    startPrecision: "",
    startValue: "",
    displayOrder: 2,
  }),
  event({
    eventRecordId: "untitled-illness-year",
    eventType: "illness_injury",
    title: "",
    startPrecision: "year",
    startValue: "2020",
    displayOrder: 3,
  }),
  event({
    eventRecordId: "trauma-2026",
    eventType: "traumatic_event",
    title: "",
    startPrecision: "year",
    startValue: "2026",
  }),
  event({
    eventRecordId: "emotion-2005",
    eventType: "emotional_problems",
    title: "",
    startPrecision: "year",
    startValue: "2005",
  }),
  event({
    eventRecordId: "substance-2020",
    eventType: "substance_use",
    title: "",
    startPrecision: "year",
    startValue: "2020",
  }),
  event({
    eventRecordId: "blank-other",
    eventType: "significant_history",
    title: "",
    startPrecision: "",
    startValue: "",
  }),
]
december.data.relationships = [
  person({
    relationshipRecordId: "mother",
    relationshipToClient: "mother",
    healthStatus: "good",
  }),
  person({
    relationshipRecordId: "father",
    relationshipToClient: "father",
    healthStatus: "deceased",
    deceased: true,
    dateOfDeath: "2026",
  }),
]
const decemberText = numberedLetterOutline(generateBackgroundReport(december).document).join("\n")
assert.match(decemberText, /experiencing a traumatic event at age 51 \(2026\)/)
assert.match(decemberText, /a history of emotional problems at age 30 \(2005\)/)
assert.match(decemberText, /substance use at age 45 \(2020\)/)
assert.match(decemberText, /reported another significant event\./)
assert.match(decemberText, /a fall/)
assert.doesNotMatch(decemberText, /parents divorced|father died/)
assert.doesNotMatch(decemberText, /including \./)
assert.doesNotMatch(decemberText, /including at\b/)

function siblingText(births: string[]): string {
  const source = emptySource()
  source.dateOfBirth = "1970-01-15"
  source.data.dateOfBirth = "1970-01-15"
  source.data.demographics.identity.sex = "Male"
  source.data.demographics.identity.pronouns = "he/him"
  source.data.relationships = births.map((dateOfBirth, index) =>
    person({
      relationshipRecordId: `sib-${index}`,
      relationshipToClient: "sibling_full",
      dateOfBirth,
    })
  )
  return numberedLetterOutline(generateBackgroundReport(source).document).join("\n")
}
assert.doesNotMatch(siblingText(["1978-01-01", "1981-06-01"]), /siblings/)
assert.doesNotMatch(siblingText(["1978", ""]), /siblings/)
assert.doesNotMatch(siblingText(["", ""]), /siblings/)

const wording = emptySource()
wording.clientFirstName = "Alex"
wording.dateOfBirth = "1990-01-01"
wording.data.dateOfBirth = "1990-01-01"
wording.data.demographics.identity.pronouns = "they/them"
wording.data.demographics.identity.sex = "Female"
wording.data.demographics.identity.genderIdentity = "Non-binary"
wording.data.demographics.identity.disability = true
wording.data.demographics.identity.disabilityDetail = "Hearing loss, left ear."
wording.data.demographics.education.level = "Trade apprenticeship"
wording.data.demographics.education.fieldOfStudy = "Electrical"
wording.data.demographics.livingSituation.livesWith = "with_partner_and_children"
wording.data.demographics.livingSituation.housingType = "Private rental"
wording.data.demographics.livingSituation.housingStability = "Stable"
wording.data.demographics.occupation.workStatus = "self_employed"
wording.data.demographics.occupation.role = "electrician"
const wordingText = numberedLetterOutline(generateBackgroundReport(wording).document).join("\n")
assert.match(wordingText, /Alex is \d+ years old and identifies as non-binary \(they\/them\)/)
assert.match(wordingText, /in electrical\./)
assert.match(
  wordingText,
  /They live with their partner and children in a private rental and describe their housing as stable\./
)
assert.match(wordingText, /They are self-employed as an electrician\./)
assert.match(wordingText, /Alex reported a disability \(hearing loss, left ear\)\./)
assert.doesNotMatch(wordingText, /including \.|including at\b/)

wording.data.demographics.education.fieldOfStudy = "IT"
const acronymText = numberedLetterOutline(generateBackgroundReport(wording).document).join("\n")
assert.match(acronymText, /in IT\./)
assert.doesNotMatch(acronymText, /in iT/)

function ownHomeText(pronouns: string, sex: string, firstName: string): string {
  const source = emptySource()
  source.clientFirstName = firstName
  source.dateOfBirth = "1970-01-15"
  source.data.dateOfBirth = "1970-01-15"
  source.data.demographics.identity.pronouns = pronouns
  source.data.demographics.identity.sex = sex
  source.data.relationshipStatus.relationshipStatus = "married"
  source.data.relationships = [
    person({
      relationshipRecordId: "partner",
      relationshipToClient: "current_partner",
      sex: sex === "Female" ? "Male" : "Female",
    }),
  ]
  source.data.demographics.livingSituation.livesWith = "with_partner_and_children"
  source.data.demographics.livingSituation.housingType = "Own home"
  source.data.demographics.livingSituation.housingStability = "Stable"
  return numberedLetterOutline(generateBackgroundReport(source).document).join("\n")
}

const hisHome = ownHomeText("he/him", "Male", "Ben01")
const herHome = ownHomeText("she/her", "Female", "Ben01")
const theirHome = ownHomeText("they/them", "Female", "Alex")
assert.match(hisHome, /in his own home and describes his housing as stable\./)
assert.match(herHome, /in her own home and describes her housing as stable\./)
assert.match(theirHome, /in their own home and describe their housing as stable\./)
assert.doesNotMatch(`${hisHome}\n${herHome}`, /a home they own/)

const namedHome = emptySource()
namedHome.clientFirstName = "Ben01"
namedHome.data.demographics.identity.sex = ""
namedHome.data.demographics.identity.pronouns = ""
namedHome.data.demographics.livingSituation.livesWith = "with_partner_and_children"
namedHome.data.demographics.livingSituation.housingType = "Own home"
namedHome.data.demographics.livingSituation.housingStability = "Stable"
assert.match(
  numberedLetterOutline(generateBackgroundReport(namedHome).document).join("\n"),
  /in Ben01's own home/
)

function dutiesText(pronouns: string, sex: string, firstName: string): string {
  const source = emptySource()
  source.clientFirstName = firstName
  source.dateOfBirth = "1970-01-15"
  source.data.dateOfBirth = "1970-01-15"
  source.data.demographics.identity.pronouns = pronouns
  source.data.demographics.identity.sex = sex
  source.data.demographics.occupation.workStatus = "home_duties_or_carer"
  return numberedLetterOutline(generateBackgroundReport(source).document).join("\n")
}
assert.match(dutiesText("he/him", "Male", "Ben01"), /He has home duties or caring responsibilities\./)
assert.match(dutiesText("they/them", "Female", "Alex"), /They have home duties or caring responsibilities\./)

function roundText(patch: (source: BackgroundReportSource) => void): string {
  const source = emptySource()
  source.clientFirstName = "Ben01"
  source.dateOfBirth = "1975-01-01"
  source.data.dateOfBirth = "1975-01-01"
  source.reportDate = "2026-10-29"
  source.data.demographics.identity.sex = "Male"
  source.data.demographics.identity.pronouns = "he/him"
  patch(source)
  return numberedLetterOutline(generateBackgroundReport(source).document).join("\n")
}

const relationships = roundText((source) => {
  source.data.relationshipStatus.relationshipStatus = "married"
  source.data.relationships = [
    person({
      relationshipRecordId: "wife",
      relationshipToClient: "current_partner",
      sex: "Female",
    }),
    person({
      relationshipRecordId: "defacto",
      relationshipToClient: "prior_partner",
      sex: "Female",
    }),
    person({
      relationshipRecordId: "ex",
      relationshipToClient: "prior_partner",
      sex: "Female",
    }),
    person({
      relationshipRecordId: "c1",
      relationshipToClient: "child_biological",
      dateOfBirth: "2017-05-01",
    }),
    person({
      relationshipRecordId: "c2",
      relationshipToClient: "child_biological",
      dateOfBirth: "2019-03-01",
    }),
    person({
      relationshipRecordId: "c3",
      relationshipToClient: "child_biological",
      dateOfBirth: "2020-04-01",
    }),
    person({
      relationshipRecordId: "step",
      relationshipToClient: "child_step",
      dateOfBirth: "2012-01-01",
    }),
    person({
      relationshipRecordId: "older-child",
      relationshipToClient: "child_biological",
      dateOfBirth: "2001-01-01",
    }),
    person({
      relationshipRecordId: "donor",
      relationshipToClient: "child_biological",
      dateOfBirth: "2015-01-01",
    }),
  ]
})
assert.doesNotMatch(relationships, /married to his wife|biological children|previous relationship|de facto relationship|marriage ended|donor conception/)

const single = roundText((source) => {
  source.data.relationshipStatus.relationshipStatus = "single"
})
assert.doesNotMatch(single, /currently single|previous significant relationship/)

const family = roundText((source) => {
  source.data.relationships = [
    person({
      relationshipRecordId: "mother",
      relationshipToClient: "mother",
      sex: "Female",
      dateOfBirth: "1950-01-01",
    }),
    person({
      relationshipRecordId: "father",
      relationshipToClient: "father",
      sex: "Male",
      deceased: true,
      healthStatus: "deceased",
      dateOfDeath: "1998",
      healthOrCauseOfDeath: "suicide",
    }),
    person({
      relationshipRecordId: "step-parent",
      relationshipToClient: "step_parent",
      sex: "Male",
    }),
    person({
      relationshipRecordId: "nan",
      relationshipToClient: "other_caregiver",
      caregiverRelationship: "grandparent",
      caregiverRelationshipDetail: "maternal grandmother",
    }),
    person({
      relationshipRecordId: "brother",
      relationshipToClient: "sibling_full",
      sex: "Male",
      dateOfBirth: "1978-01-01",
    }),
    person({
      relationshipRecordId: "sister",
      relationshipToClient: "sibling_full",
      sex: "Female",
      dateOfBirth: "1981-06-01",
    }),
    person({
      relationshipRecordId: "dead-brother",
      relationshipToClient: "sibling_full",
      sex: "Male",
      deceased: true,
      healthStatus: "deceased",
      dateOfDeath: "1994",
      healthOrCauseOfDeath: "suicide",
    }),
    person({
      relationshipRecordId: "step-sib",
      relationshipToClient: "sibling_step",
      sex: "Male",
      dateOfBirth: "1998-03-01",
    }),
  ]
})
assert.doesNotMatch(family, /father died|remarried|grandmother|siblings|suicide/)

const repartnered = roundText((source) => {
  source.data.relationships = [
    person({
      relationshipRecordId: "mother",
      relationshipToClient: "mother",
      sex: "Female",
    }),
    person({ relationshipRecordId: "step", relationshipToClient: "step_parent", sex: "Male" }),
  ]
})
assert.doesNotMatch(repartnered, /de facto relationship/)

const adopted = roundText((source) => {
  source.clientFirstName = "Tom"
  source.dateOfBirth = "1970-01-15"
  source.data.dateOfBirth = "1970-01-15"
  source.data.relationships = [
    person({
      relationshipRecordId: "adoptive-mother",
      relationshipToClient: "mother",
      sex: "Female",
      dateOfBirth: "1944-01-01",
    }),
    person({
      relationshipRecordId: "adoptive-father",
      relationshipToClient: "father",
      sex: "Male",
      deceased: true,
      healthStatus: "deceased",
      dateOfDeath: "2011",
    }),
    person({
      relationshipRecordId: "birth-mother",
      relationshipToClient: "parent",
      sex: "Female",
      dateOfBirth: "1952-01-01",
    }),
    person({
      relationshipRecordId: "birth-father",
      relationshipToClient: "parent",
      sex: "Male",
      notKnown: true,
    }),
    person({
      relationshipRecordId: "adoptive-sister",
      relationshipToClient: "sibling_adoptive",
      sex: "Female",
      dateOfBirth: "1974-01-01",
    }),
    person({
      relationshipRecordId: "half",
      relationshipToClient: "sibling_half",
      sex: "Female",
      dateOfBirth: "1981-01-01",
    }),
    person({ relationshipRecordId: "birth-step", relationshipToClient: "step_parent", sex: "Male" }),
  ]
})
assert.doesNotMatch(adopted, /adopted|adoptive|birth mother|birth father|half-sibling/)

const work = roundText((source) => {
  source.data.demographics.occupation.workStatus = "unemployed"
  source.data.demographics.occupation.previousJobs = [
    { id: "1", employer: "Secret Employer", role: "electrician", started: "2010", ended: "2025" },
    { id: "2", employer: "Other Employer", role: "apprentice electrician", started: "1993", ended: "1997" },
  ]
})
assert.match(work, /He is currently unemployed\. He previously worked as an electrician \(2010–2025\) and an apprentice electrician \(1993–1997\)\./)
assert.doesNotMatch(work, /Secret Employer|Other Employer/)

const medication = roundText((source) => {
  source.data.events = [
    event({
      eventRecordId: "med",
      eventType: "medication",
      title: "Sertraline",
      endOngoing: true,
      resolvedOrOngoing: "ongoing",
      startPrecision: "year",
      startValue: "2025",
      prescriberName: "Dr Harry TestDoc, GP",
    }),
  ]
})
assert.match(medication, /Ben01 is currently taking sertraline, supervised by Dr Harry TestDoc, GP\./)

const history = roundText((source) => {
  source.data.events = [
    event({
      eventRecordId: "depression",
      eventType: "emotional_problems",
      title: "Depression",
      startPrecision: "year",
      startValue: "2005",
      endPrecision: "year",
      endValue: "2007",
    }),
    event({
      eventRecordId: "admission",
      eventType: "psychiatric_admission",
      title: "Admission",
      admissionType: "psychiatric_inpatient",
      admissionLength: "two weeks",
      conditionEventId: "depression",
      startPrecision: "year",
      startValue: "2006",
      displayOrder: 2,
    }),
    event({
      eventRecordId: "therapy",
      eventType: "previous_therapy",
      title: "Psychologist",
      conditionEventId: "depression",
      startPrecision: "year",
      startValue: "2006",
      endPrecision: "year",
      endValue: "2007",
      displayOrder: 3,
    }),
    event({
      eventRecordId: "sertraline",
      eventType: "medication",
      title: "Sertraline",
      conditionEventId: "depression",
      endOngoing: true,
      resolvedOrOngoing: "ongoing",
      startPrecision: "year",
      startValue: "2025",
      displayOrder: 4,
    }),
    event({
      eventRecordId: "temazepam",
      eventType: "medication",
      title: "Temazepam",
      startPrecision: "year",
      startValue: "2006",
      endPrecision: "year",
      endValue: "2007",
    }),
    event({
      eventRecordId: "cutting",
      eventType: "self_harm",
      title: "Cutting",
      selfHarmType: "non_lethal",
      startPrecision: "year",
      startValue: "1989",
      endPrecision: "year",
      endValue: "1991",
    }),
  ]
})
assert.match(
  history,
  /Ben01 reported a history of depression from age 30 to 32 \(2005–2007\)\. He was admitted to a psychiatric unit at age 31 \(2006\) for two weeks, saw a psychologist from age 31 to 32 \(2006–2007\), and has been treated with sertraline since age 50 \(2025\)\./
)
assert.match(history, /Ben01 reported self-harm: cutting from age 14 to 16/)
assert.match(history, /Ben01 also reported taking temazepam from age 31 to 32/)
const selfHarmAt = history.indexOf("self-harm: cutting from age 14")
const unlinkedAt = history.indexOf("also reported taking temazepam")
const mentalAt = history.indexOf("history of depression")
assert.ok(mentalAt < selfHarmAt && selfHarmAt < unlinkedAt)

const checks = generateBackgroundReport(
  (() => {
    const source = emptySource()
    source.data.relationshipStatus.relationshipStatus = "married"
    source.data.relationships = [
      person({ relationshipRecordId: "sam", relationshipToClient: "prior_partner", givenName: "Sam" }),
      person({ relationshipRecordId: "child", relationshipToClient: "child_biological", dateOfBirth: "2016-01-01" }),
      person({
        relationshipRecordId: "mum",
        relationshipToClient: "mother",
        givenName: "Jane",
        sex: "Female",
      }),
    ]
    source.data.events = [
      event({
        eventRecordId: "anxiety",
        eventType: "emotional_problems",
        title: "Anxiety",
      }),
      event({
        eventRecordId: "temazepam",
        eventType: "medication",
        title: "Temazepam",
      }),
    ]
    return source
  })()
)
const messages = checks.omitted.map((item) => item.message)
assert.ok(messages.some((message) => message.includes("Married") && message.includes("no current partner")))
assert.equal(messages.some((message) => message.includes("other parent not recorded")), false)
assert.equal(messages.some((message) => message.includes("adoption date")), false)
assert.ok(messages.some((message) => message.includes("Anxiety") && message.includes("needs detail")))
assert.ok(messages.some((message) => message === "Medication 'Temazepam' is not linked to a condition"))
assert.equal(messages.some((message) => message.includes("no start date")), false)

const disruption = benSource()
disruption.data.demographics.education.disruption = true
disruption.data.demographics.education.disruptionDetail = "Left school at 16 to work."
assert.match(
  numberedLetterOutline(generateBackgroundReport(disruption).document).join("\n"),
  /His schooling was disrupted: left school at 16 to work\./
)

const untitledHarm = emptySource()
untitledHarm.clientFirstName = "Ben01"
untitledHarm.dateOfBirth = "1974-12-12"
untitledHarm.data.dateOfBirth = "1974-12-12"
untitledHarm.data.demographics.identity.sex = "Male"
untitledHarm.data.demographics.identity.pronouns = "he/him"
untitledHarm.reportDate = "2026-11-04"
untitledHarm.data.events = [
  event({ eventRecordId: "h1", eventType: "self_harm", title: "", selfHarmType: "non_lethal", startPrecision: "year", startValue: "1986" }),
  event({ eventRecordId: "h2", eventType: "self_harm", title: "", selfHarmType: "non_lethal", startPrecision: "year", startValue: "1992" }),
  event({
    eventRecordId: "h3",
    eventType: "self_harm",
    title: "Overdose",
    selfHarmType: "potentially_lethal",
    startPrecision: "date",
    startValue: "2026-10-01",
  }),
  event({
    eventRecordId: "mother-depression",
    eventType: "emotional_problems",
    title: "Mother depression",
    about: "significant_other",
    relationshipRecordId: "mother",
  }),
]
untitledHarm.data.relationships = [
  person({ relationshipRecordId: "mother", relationshipToClient: "mother", sex: "Female" }),
]
const harmText = numberedLetterOutline(generateBackgroundReport(untitledHarm).document).join("\n")
assert.match(
  harmText,
  /Ben01 reported self-harm at age 11 \(1986\) and age 17 \(1992\), and an overdose at age 51 \(2026\)\./
)
assert.doesNotMatch(harmText, /non-lethal|non lethal/)
assert.match(harmText, /Ben01's mother has a history of depression\./)
const harmLines = harmText.split("\n")
assert.equal(
  harmLines.some((line) => line.startsWith("5.") && line.includes("mother has a history")),
  false
)
assert.ok(harmLines.some((line) => line.startsWith("6.") && line.includes("mother has a history of depression")))

const treatedMother = significantOtherParagraphs(
  "Tom",
  [person({ relationshipRecordId: "sally", relationshipToClient: "mother", sex: "Female", givenName: "Sally" })],
  [
    event({
      eventRecordId: "sally-depression",
      eventType: "emotional_problems",
      title: "Depression",
      about: "significant_other",
      relationshipRecordId: "sally",
    }),
    event({
      eventRecordId: "sally-admission",
      eventType: "psychiatric_admission",
      admissionType: "psychiatric_inpatient",
      title: "Admission",
      startPrecision: "year",
      startValue: "1992",
      about: "significant_other",
      relationshipRecordId: "sally",
      conditionEventId: "sally-depression",
    }),
    event({
      eventRecordId: "sally-medication",
      eventType: "medication",
      title: "",
      endOngoing: true,
      resolvedOrOngoing: "ongoing",
      about: "significant_other",
      relationshipRecordId: "sally",
      conditionEventId: "sally-depression",
    }),
  ]
).join(" ")
assert.equal(
  treatedMother,
  "Tom's mother (Sally) has a history of depression, for which she was admitted to a psychiatric unit (1992) and takes medication."
)

const treatedFather = significantOtherParagraphs(
  "Tom",
  [person({ relationshipRecordId: "john", relationshipToClient: "father", sex: "Male", givenName: "John", deceased: true, healthStatus: "deceased" })],
  [
    event({
      eventRecordId: "john-depression",
      eventType: "emotional_problems",
      title: "Depression",
      about: "significant_other",
      relationshipRecordId: "john",
    }),
    event({
      eventRecordId: "john-medication",
      eventType: "medication",
      title: "Sertraline",
      endOngoing: true,
      resolvedOrOngoing: "ongoing",
      about: "significant_other",
      relationshipRecordId: "john",
      conditionEventId: "john-depression",
    }),
  ]
).join(" ")
assert.equal(treatedFather, "Tom's father (John, deceased) had a history of depression, for which he took sertraline.")

function previousCount(count: number): string {
  return roundText((source) => {
    source.data.relationshipStatus.relationshipStatus = "single"
    source.data.relationships = Array.from({ length: count }, (_, index) =>
      person({
        relationshipRecordId: `prior-${index}`,
        relationshipToClient: "prior_partner",
        sex: "Female",
      })
    )
  })
}
assert.doesNotMatch(previousCount(0), /currently single|previous significant relationship/)
assert.doesNotMatch(previousCount(1), /previous significant relationship|Most recently|Before that/)
assert.doesNotMatch(previousCount(3), /previous significant relationship|dating relationship/)

const oneChild = roundText((source) => {
  source.data.relationships = [
    person({
      relationshipRecordId: "only",
      relationshipToClient: "child_biological",
      childType: "biological",
      dateOfBirth: "2001-01-01",
    }),
  ]
})
assert.doesNotMatch(oneChild, /child in total|biological child/)

const laterNone = roundText((source) => {
  source.data.relationships = [
    person({
      relationshipRecordId: "mother",
      relationshipToClient: "mother",
      sex: "Female",
      dateOfBirth: "1950-01-01",
    }),
    person({
      relationshipRecordId: "father",
      relationshipToClient: "father",
      sex: "Male",
      deceased: true,
      healthStatus: "deceased",
      dateOfDeath: "1998",
    }),
  ]
})
assert.doesNotMatch(laterNone, /later relationship/)

const twoLater = roundText((source) => {
  source.dateOfBirth = "1970-01-15"
  source.data.dateOfBirth = "1970-01-15"
  source.data.relationships = [
    person({
      relationshipRecordId: "mother",
      relationshipToClient: "mother",
      sex: "Female",
    }),
    person({ relationshipRecordId: "step-1", relationshipToClient: "step_parent", sex: "Male" }),
    person({ relationshipRecordId: "step-2", relationshipToClient: "step_parent", sex: "Male" }),
  ]
})
assert.doesNotMatch(twoLater, /later relationship/)

const bareLater = roundText((source) => {
  source.data.relationships = [
    person({ relationshipRecordId: "mother", relationshipToClient: "mother", sex: "Female" }),
    person({ relationshipRecordId: "step-1", relationshipToClient: "step_parent" }),
    person({ relationshipRecordId: "step-2", relationshipToClient: "step_parent" }),
  ]
})
assert.doesNotMatch(bareLater, /later relationship/)

const mixedLater = roundText((source) => {
  source.dateOfBirth = "1970-01-15"
  source.data.dateOfBirth = "1970-01-15"
  source.data.relationships = [
    person({ relationshipRecordId: "mother", relationshipToClient: "mother", sex: "Female" }),
    person({ relationshipRecordId: "step-1", relationshipToClient: "step_parent" }),
    person({ relationshipRecordId: "step-2", relationshipToClient: "step_parent" }),
  ]
})
assert.doesNotMatch(mixedLater, /later relationship/)

const repeatedNames = roundText((source) => {
  source.data.relationships = [
    person({ relationshipRecordId: "mother", relationshipToClient: "mother", sex: "Female" }),
    person({ relationshipRecordId: "father", relationshipToClient: "father", sex: "Male" }),
  ]
  source.data.events = [
    event({
      eventRecordId: "mother-depression",
      eventType: "emotional_problems",
      title: "Depression",
      about: "significant_other",
      relationshipRecordId: "mother",
    }),
    event({
      eventRecordId: "father-depression",
      eventType: "emotional_problems",
      title: "Depression",
      about: "significant_other",
      relationshipRecordId: "father",
    }),
  ]
})
assert.match(repeatedNames, /Ben01's mother has a history of depression\. His father has a history of depression\./)
assert.doesNotMatch(repeatedNames, /Ben01's father has a history of depression/)

const missingReferrer = emptySource()
missingReferrer.data.reason.referralType = "family_or_friend"
assert.ok(
  generateBackgroundReport(missingReferrer).omitted.some((item) => item.message === "Referral: who referred the client not recorded")
)
const namedReferrer = emptySource()
namedReferrer.data.reason.referralType = "family_or_friend"
namedReferrer.data.reason.referrerIsOther = true
namedReferrer.data.reason.referrerOther = "a neighbour"
assert.equal(
  generateBackgroundReport(namedReferrer).omitted.some((item) => item.message === "Referral: who referred the client not recorded"),
  false
)

console.log("generate-background-report self-test passed")
