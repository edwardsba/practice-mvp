import assert from "node:assert/strict"

import type { ScreeningAnswers } from "@/lib/client-background/interview-history"
import {
  emptyClientRelationshipStatus,
  emptyDemographics,
  emptyEvent,
  emptyMedication,
  emptyReasonForAttending,
  emptyRisk,
  emptyStressors,
  type ClientBackgroundData,
  type EventRecord,
  type PartnershipRecord,
  type RelationshipRecord,
} from "@/lib/client-background/types"
import {
  generateBackgroundReport,
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
    lengthOfRelationship: "",
    relationshipStatus: "",
    timeSinceEnded: "",
    supportive: "",
    conflict: "",
    qualityOfRelationship: "",
    dependency: "",
    livingSituation: "",
    caregiverRelationship: "",
    linkedPartnerRecordId: null,
    partnershipRecordId: null,
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
    medication: { ...emptyMedication(), currentlyTaking: "no", previouslyTaken: "yes" },
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
      referredByMedicalProfessional: "yes",
      referrerConcerns: "low mood",
      familyInvolved: "yes",
      familyInvolvement: "His partner came to the first appointment.",
      ownInitiative: "yes",
      attendedWillingly: "yes",
      clientMotivation: "He wants to feel more like himself.",
    },
    relationships: [
      person({
        relationshipRecordId: "wife",
        relationshipToClient: "current_partner",
        sex: "Female",
        givenName: "Should Not Appear",
        lengthOfRelationship: "12 years",
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
    partnerships: [
      {
        partnershipRecordId: "parents",
        partnerAId: "mother",
        partnerBId: "father",
        relationshipStatus: "divorced",
        started: "1968",
        ended: "1978-06-01",
        qualityOfRelationship: "",
      } satisfies PartnershipRecord,
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
        attribution: "family",
        title: "Margaret anxiety",
        description: "Family description must not appear",
        relationshipRecordId: "mother",
        startPrecision: "year",
        startValue: "1990",
        displayOrder: 5,
      }),
      event({
        eventRecordId: "brother-mood",
        eventType: "emotional_problems",
        attribution: "family",
        title: "Brother low mood",
        familyRelation: "Brother",
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
assert.doesNotMatch(body, /SECRET|Cutting episode|Overdose|Margaret|John|Should Not Appear|Child One|Sibling One/i)
assert.doesNotMatch(body, /SAGE|PHQ|questionnaire|treatment commenced|mental state|\bMSE\b/i)

assert.deepEqual(
  outline.filter((line) => /^\d+ /.test(line)),
  [
    "1 Purpose and Scope",
    "2 Sources",
    "3 Presenting Problem",
    "4 Demographics",
    "5 Relevant History",
    "6 Risk Assessment",
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
    "1.5. The report addresses Ben01's presenting problem, demographics, relevant history and risk.",
  ]
)
assert.equal(
  draft.omitted.some((item) => item.id === "report-introduction"),
  false
)

assert.deepEqual(
  outline.filter((line) => line.startsWith("2.")),
  [
    "2.1. Referral from Dr Harry Nguyen, general practitioner, 20 July 2026.",
    "2.2. Clinical interview, 1 October 2026.",
  ]
)

const presenting = outline.filter((line) => line.startsWith("3.")).join("\n")
assert.match(presenting, /Ben01 was referred by his general practitioner, Dr Harry Nguyen, on 20 July 2026, with concerns about low mood\./)
assert.match(presenting, /His partner came to the first appointment\./)
assert.match(presenting, /Ben01 reported current difficulties with family and financial\./)
assert.doesNotMatch(presenting, /social life|work or study|denied/i)
assert.match(presenting, /He described the main problem as "I can't switch off"\./)
assert.match(presenting, /He attended on his own initiative and willingly\./)
assert.match(presenting, /He wants to feel more like himself\./)

const demographics = outline.filter((line) => line.startsWith("4.")).join("\n")
assert.match(demographics, /Ben01 is a 56-year-old male \(he\/him\)\./)
assert.match(demographics, /He identifies as Australian, speaks English at home and is Catholic\./)
assert.match(
  demographics,
  /He has been married to his wife for 12 years, and has had two previous significant relationships\./
)
assert.match(demographics, /He has three children, aged 9, 7 and 6\./)
assert.doesNotMatch(demographics, /three children, aged nine|has 3 children/)
assert.match(demographics, /His parents divorced when he was 8\./)
assert.match(demographics, /His father died when Ben01 was 23\./)
assert.match(demographics, /He has two siblings, aged 48 and 45, and one step-sibling, aged 28\./)
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
assert.match(demographics, /He reported no disability\./)
assert.match(demographics, /He is not currently taking medication for emotional problems\./)

assert.ok(outline.includes("Client history"))
assert.ok(outline.includes("Family history"))
const medicationAt = outline.findIndex((line) => line.startsWith("5.3."))
const familyHeadingAt = outline.indexOf("Family history")
const familyItemAt = outline.findIndex((line) => line.startsWith("5.4."))
assert.ok(outline.indexOf("Client history") < outline.findIndex((line) => line.startsWith("5.1.")))
assert.ok(medicationAt < familyHeadingAt && familyHeadingAt < familyItemAt)
assert.match(outline.find((line) => line.startsWith("5.1.")) ?? "", /Ben01 reported a history of illness or injury, including a broken leg at around age 12 \(1982\) and depression at age 30 \(2000\)\./)
assert.match(
  outline.find((line) => line.startsWith("5.2.")) ?? "",
  /He reported a history of self-harm, at age 14 \(1984\) and age 18 \(1988\)\./
)
assert.match(
  outline.find((line) => line.startsWith("5.3.")) ?? "",
  /He has previously taken medication for emotional problems\./
)
assert.match(
  outline.find((line) => line.startsWith("5.4.")) ?? "",
  /He reported a family history of emotional problems \(his mother and brother\)\./
)
assert.match(outline.find((line) => line.startsWith("5.5.")) ?? "", /\[Alcohol and other drugs — to be added \(ASSIST\)\.\]/)
assert.match(body, /\[Risk assessment — to be added \(LRAMP\)\.\]/)
assert.match(body, /\[Summary — practitioner to write\.\]/)
assert.doesNotMatch(body, /reported experiencing traumatic|family history of substance/)
assert.doesNotMatch(body, /including \./)
assert.doesNotMatch(body, /including at\b/)

assert.ok(draft.omitted.some((item) => item.message === "Traumatic events is Yes, with no entries."))
assert.ok(draft.omitted.some((item) => item.message === "Emotional problems not asked"))
assert.equal(
  draft.omitted.some((item) => item.message === "Medication history is Yes, with no entries."),
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
assert.match(numberedLetterOutline(missingDeathDraft.document).join("\n"), /His father is deceased\./)
assert.ok(missingDeathDraft.omitted.some((item) => item.message === "Father's year of death not recorded"))

const openParents = benSource()
openParents.data.partnerships[0].ended = ""
const openParentsDraft = generateBackgroundReport(openParents)
assert.match(numberedLetterOutline(openParentsDraft.document).join("\n"), /His parents are divorced\./)
assert.ok(openParentsDraft.omitted.some((item) => item.message === "When his parents separated not recorded"))

const theySource = benSource()
theySource.clientFirstName = "Alex"
theySource.data.demographics.identity.pronouns = "they/them"
theySource.data.demographics.identity.sex = "Female"
const theyText = numberedLetterOutline(generateBackgroundReport(theySource).document).join("\n")
assert.doesNotMatch(theyText, /\bthey is\b/i)
assert.doesNotMatch(theyText, /\bthey has\b/i)
assert.doesNotMatch(theyText, /\bthey was\b/i)
assert.match(theyText, /Alex is a 56-year-old female \(they\/them\)\./)
assert.match(theyText, /They have been married to their wife for 12 years/)
assert.match(theyText, /They have three children/)
assert.match(theyText, /when they were 8/)
assert.match(theyText, /died when Alex was 23/)
assert.match(theyText, /They are not currently taking medication/)

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
      medication: emptyMedication(),
      stressors: emptyStressors(),
      reason: emptyReasonForAttending(),
      relationships: [],
      partnerships: [],
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
    "5 Relevant History",
    "6 Risk Assessment",
    "7 Summary",
  ]
)
assert.match(blankOutline.join("\n"), /\[Presenting problem — not yet recorded\.\]/)
assert.match(blankOutline.join("\n"), /\[Demographics — not yet recorded\.\]/)
assert.match(blankOutline.join("\n"), /\[Relevant history — not yet recorded\.\]/)
assert.match(blankOutline.join("\n"), /\[Alcohol and other drugs — to be added \(ASSIST\)\.\]/)
assert.equal(blankOutline.includes("Client history"), false)
assert.equal(blankOutline.includes("Family history"), false)
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
    attribution: "self",
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
    attribution: "self",
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
december.data.partnerships = [
  {
    partnershipRecordId: "parents",
    partnerAId: "mother",
    partnerBId: "father",
    relationshipStatus: "divorced",
    started: "",
    ended: "2026",
    qualityOfRelationship: "",
  },
]
const decemberText = numberedLetterOutline(generateBackgroundReport(december).document).join("\n")
assert.match(decemberText, /experiencing traumatic events, at around age 51 \(2026\)/)
assert.match(decemberText, /a history of emotional problems, at around age 30 \(2005\)/)
assert.match(decemberText, /a history of substance use, from around age 45 \(2020\)/)
assert.match(decemberText, /reported other significant life events\./)
assert.match(decemberText, /including a fall and at around age 45 \(2020\)/)
assert.match(decemberText, /parents divorced when they were 51/)
assert.match(decemberText, /father died when Alex was 51/)
assert.doesNotMatch(decemberText, /including \./)
assert.doesNotMatch(decemberText, /including at\b/)

function siblingLine(births: string[]): string {
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
  const text = numberedLetterOutline(generateBackgroundReport(source).document).join("\n")
  const match = text.match(/has two siblings[^.]*\./)
  assert.ok(match, text)
  return match[0]
}
assert.equal(siblingLine(["1978-01-01", "1981-06-01"]), "has two siblings, aged 48 and 45.")
assert.equal(siblingLine(["1978", ""]), "has two siblings, one aged about 48.")
assert.equal(siblingLine(["", ""]), "has two siblings.")

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
assert.match(wordingText, /they identify as non-binary/)
assert.match(wordingText, /in electrical\./)
assert.match(
  wordingText,
  /They live with their partner and children in a private rental and describe their housing as stable\./
)
assert.match(wordingText, /They are self-employed as an electrician\./)
assert.match(wordingText, /They reported a disability: hearing loss, left ear\./)
assert.doesNotMatch(wordingText, /including \.|including at\b/)

wording.data.demographics.education.fieldOfStudy = "IT"
const acronymText = numberedLetterOutline(generateBackgroundReport(wording).document).join("\n")
assert.match(acronymText, /in IT\./)
assert.doesNotMatch(acronymText, /in iT/)

console.log("generate-background-report self-test passed")
