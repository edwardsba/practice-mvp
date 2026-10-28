import assert from "node:assert/strict"

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
  type RelationshipRecord,
} from "@/lib/client-background/types"
import {
  generateBackgroundReport,
  numberedLetterOutline,
  type BackgroundReportSource,
} from "@/lib/reports/generate-background-report"

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
    ...emptyEvent(partial.eventType, 0),
    eventRecordId: partial.eventRecordId ?? "event-1",
    attribution: "self",
    ...partial,
  }
}

function benSource(overrides: Partial<BackgroundReportSource> = {}): BackgroundReportSource {
  const demographics = emptyDemographics()
  demographics.identity.pronouns = "he/him"
  demographics.identity.sex = "Male"
  demographics.identity.primaryLanguage = "English"
  const data: ClientBackgroundData = {
    dateOfBirth: "1974-01-01",
    backgroundCapturedAt: null,
    relationshipStatus: { ...emptyClientRelationshipStatus(), relationshipStatus: "defacto" },
    demographics,
    medication: { ...emptyMedication(), previouslyTaken: "yes", currentlyTaking: "no" },
    stressors: emptyStressors(),
    reason: {
      ...emptyReasonForAttending(),
      referredByMedicalProfessional: "yes",
      referrerConcerns: "low mood and worry",
      familyInvolved: "yes",
      familyInvolvement: "His partner came to the first appointment.",
      ownInitiative: "yes",
      attendedWillingly: "yes",
      clientMotivation: "He wants to feel more like himself.",
    },
    relationships: [
      person({
        relationshipRecordId: "partner",
        relationshipToClient: "current_partner",
        givenName: "Pat",
      }),
      person({
        relationshipRecordId: "child",
        relationshipToClient: "child_biological",
        givenName: "Ari",
        dateOfBirth: "2016-04-02",
      }),
      person({
        relationshipRecordId: "sibling",
        relationshipToClient: "sibling_full",
        givenName: "Sam",
        dateOfBirth: "1990",
      }),
      person({
        relationshipRecordId: "mother",
        relationshipToClient: "mother",
        givenName: "Joan",
        dateOfBirth: "1950-05-01",
      }),
    ],
    partnerships: [],
    events: [
      event({
        eventRecordId: "sh-1",
        eventType: "self_harm",
        title: "self-harm",
        startPrecision: "year",
        startValue: "1986",
        displayOrder: 1,
      }),
      event({
        eventRecordId: "sh-2",
        eventType: "self_harm",
        title: "self-harm",
        startPrecision: "year",
        startValue: "1992",
        displayOrder: 2,
      }),
      event({
        eventRecordId: "sh-3",
        eventType: "self_harm",
        title: "an overdose",
        startPrecision: "date",
        startValue: "2026-10-01",
        displayOrder: 3,
      }),
    ],
    risk: emptyRisk(),
  }

  return {
    reportDate: "2026-10-29",
    clientFirstName: "Ben",
    clientLastName: "Example",
    dateOfBirth: "1974-01-01",
    practitionerName: "Dr Alex Nguyen",
    profession: null,
    yearRegistered: null,
    data,
    screening: {
      illness_injury: "no",
      traumatic_events: "yes",
      emotional_problems: "not_asked",
      substance_use: "no",
      self_harm: "yes",
      psychiatric_admission: "no",
      previous_therapy: "no",
      other_significant_events: "no",
    },
    interviewDate: "2026-08-11",
    selfReportDate: "2026-08-09",
    numberOfChildren: 1,
    sageModules: [
      { name: "Core", date: "2026-08-09" },
      { name: "Background", date: "2026-08-10" },
      { name: "Personality", date: "2026-08-11" },
    ],
    questionnaires: [
      {
        fullName: "Patient Health Questionnaire",
        abbreviation: "PHQ-9",
        dates: ["2026-03-03"],
      },
      {
        fullName: "Generalised Anxiety Disorder scale",
        abbreviation: "GAD-7",
        dates: ["2026-03-03", "2026-06-02"],
      },
    ],
    firstAttendedAppointment: "2026-08-01",
    referral: {
      title: "Dr",
      firstName: "Harry",
      lastName: "Nguyen",
      profession: "General Practitioner",
      date: "2026-07-20",
    },
    ...overrides,
  }
}

const draft = generateBackgroundReport(benSource())
const outline = numberedLetterOutline(draft.document)
const text = outline.join("\n")
const messages = draft.omitted.map((item) => item.message)

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

assert.match(text, /2\.1\. The SAGE-SR Core, Background and Personality modules completed 9–11 August 2026\./)
assert.match(
  text,
  /2\.2\. The Patient Health Questionnaire \(PHQ-9\) completed 3 March 2026, the Generalised Anxiety Disorder scale \(GAD-7\) completed between March 2026 and June 2026 and the background self-report questionnaire completed 9 August 2026\./
)
assert.match(
  text,
  /2\.3\. Clinical interviews and treatment commenced in August 2026, including a background interview on 11 August 2026\./
)
assert.match(
  text,
  /2\.4\. A referral from his general practitioner, Dr Harry Nguyen, dated 20 July 2026\./
)

assert.match(text, /4\.\d+\. He is 52 years old and male\./)
assert.match(text, /has 1 child, aged 10/)
assert.match(text, /has 1 sibling, aged about 36/)
assert.doesNotMatch(text, /\bAri\b|\bSam\b|\bPat\b|\bJoan\b/)

const history = outline.filter((line) => line.startsWith("5."))
const traumatic = history.findIndex((line) => line.includes("history of traumatic events"))
const selfHarm = history.findIndex((line) => line.includes("self-harm at around age 12 (1986)"))
const medication = history.findIndex((line) => line.includes("previously taken medication"))
const denied = history.findIndex((line) => line.includes("denied any"))
assert.ok(traumatic >= 0 && selfHarm > traumatic && medication > selfHarm && denied > medication)
assert.match(
  history[selfHarm],
  /He reported self-harm at around age 12 \(1986\) and around age 18 \(1992\), and an overdose at age 52 \(1 October 2026\)\./
)
assert.match(history[denied], /denied any significant illness or injury/)
assert.match(history[denied], /previous individual or group therapy/)
assert.doesNotMatch(history[denied], /emotional problems|self-harm|traumatic events|medication/)
assert.doesNotMatch(text, /Emotional problems/)
assert.match(history[history.length - 1], /\[Alcohol and other drugs — to be added \(ASSIST\)\.\]/)

assert.ok(messages.includes("Emotional problems not asked"))
assert.ok(messages.includes("Family history not assessed"))
assert.ok(messages.includes("Current stressors not assessed"))
assert.ok(messages.includes("Client's own description of the problem not recorded"))
assert.ok(messages.includes("Years together not recorded"))
assert.ok(messages.includes("Parents' health not recorded"))
assert.doesNotMatch(text, /not asked|not recorded|Not asked/)

assert.match(text, /He attended on his own initiative and willingly\./)
assert.doesNotMatch(text, /\bShe\b|\bher\b/)

const headings = draft.document.content.filter((node) => node.type === "heading" && node.attrs?.numbered)
assert.equal(headings.length, 7)
assert.equal(JSON.stringify(headings).includes("1 Purpose"), false)

const noInterview = generateBackgroundReport(
  benSource({
    screening: null,
    interviewDate: null,
    selfReportDate: null,
    sageModules: [],
    questionnaires: [],
    firstAttendedAppointment: null,
    referral: null,
    data: {
      ...benSource().data,
      events: [],
      medication: emptyMedication(),
      reason: emptyReasonForAttending(),
      relationships: [],
      relationshipStatus: emptyClientRelationshipStatus(),
    },
  })
)
assert.equal(noInterview.document.type, "doc")
assert.ok(numberedLetterOutline(noInterview.document).some((line) => line.startsWith("1 Purpose")))
assert.ok(noInterview.omitted.some((item) => item.message === "Family history not assessed"))

console.log("generate-background-report.selftest: ok")
