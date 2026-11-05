import { HISTORY_QUESTION_KEYS, type ScreeningAnswers } from "@/lib/client-background/interview-history"
import {
  emptyBlockAnswers,
  emptyClientRelationshipStatus,
  emptyDemographics,
  emptyEvent,
  emptyMedication,
  emptyReasonForAttending,
  emptyRisk,
  emptyStressors,
  type EventRecord,
  type EventType,
  type RelationshipBlock,
  type RelationshipRecord,
} from "@/lib/client-background/types"
import type { BackgroundReportSource } from "@/lib/reports/generate-background-report"

export const TOM_REPORT_DATE = "2026-11-05"
export const TOM_FIRST_NAME = "Tom"
export const TOM_LAST_NAME = "Example (test)"

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
    howEnded: "",
    laterRelationships: "",
    childType: "",
    childTypeDetail: "",
    timeSinceEnded: "",
    supportive: "",
    conflict: "",
    qualityOfRelationship: "",
    dependency: "",
    livingSituation: "",
    caregiverRelationship: "",
    caregiverRelationshipDetail: "",
    startedOn: "",
    endedOn: "",
    partnerType: "",
    parentType: "",
    adoptedOn: "",
    notKnown: false,
    otherParentKind: "",
    otherParentDetail: "",
    linkedPartnerRecordId: null,
    partnershipRecordId: null,
    relationshipBlockId: null,
    blockRole: "",
    blockRoleType: "",
    placementReview: "",
    ...partial,
  }
}

function block(partial: Partial<RelationshipBlock> & Pick<RelationshipBlock, "relationshipBlockId" | "kind">): RelationshipBlock {
  return {
    parentRecordId: null,
    parentSide: "",
    status: "",
    statusDetail: "",
    arrangementType: "",
    arrangementDetail: "",
    startedOn: "",
    endedOn: "",
    noChildren: false,
    displayOrder: 0,
    ...partial,
  }
}

function history(
  partial: Partial<EventRecord> & Pick<EventRecord, "eventRecordId" | "eventType">
): EventRecord {
  return { ...emptyEvent(partial.eventType as EventType, partial.displayOrder ?? 0), ...partial }
}

export function tomRelationships(): RelationshipRecord[] {
  return [
    person({ relationshipRecordId: "tom-jordan", relationshipToClient: "current_partner", sex: "Female", givenName: "Jordan", dateOfBirth: "1977-01-01", relationshipBlockId: "tom-current", blockRole: "partner", livingSituation: "lives_with_client_full_time", displayOrder: 0 }),
    person({ relationshipRecordId: "tom-henry", relationshipToClient: "child_biological", sex: "Male", givenName: "Henry", dateOfBirth: "2017-01-01", childType: "biological", relationshipBlockId: "tom-current", blockRole: "child", blockRoleType: "biological", livingSituation: "lives_with_client_full_time", displayOrder: 1 }),
    person({ relationshipRecordId: "tom-lily", relationshipToClient: "child_biological", sex: "Female", givenName: "Lily", dateOfBirth: "2019-01-01", childType: "biological", relationshipBlockId: "tom-current", blockRole: "child", blockRoleType: "biological", livingSituation: "lives_with_client_full_time", displayOrder: 2 }),
    person({ relationshipRecordId: "tom-max", relationshipToClient: "child_biological", sex: "Male", givenName: "Max", dateOfBirth: "2020-01-01", childType: "adopted", relationshipBlockId: "tom-current", blockRole: "child", blockRoleType: "adopted", livingSituation: "lives_with_client_full_time", displayOrder: 3 }),
    person({ relationshipRecordId: "tom-sam", relationshipToClient: "child_step", sex: "Male", givenName: "Sam", dateOfBirth: "2012-01-01", childType: "step_child", relationshipBlockId: "tom-current", blockRole: "child", blockRoleType: "step_child", livingSituation: "lives_with_client_full_time", displayOrder: 4 }),
    person({ relationshipRecordId: "tom-pam", relationshipToClient: "prior_partner", sex: "Female", givenName: "Pam", dateOfBirth: "1979-01-01", relationshipBlockId: "tom-pam", blockRole: "partner", displayOrder: 5 }),
    person({ relationshipRecordId: "tom-kim", relationshipToClient: "prior_partner", sex: "Female", givenName: "Kim", dateOfBirth: "1974-01-01", relationshipBlockId: "tom-kim", blockRole: "partner", displayOrder: 6 }),
    person({ relationshipRecordId: "tom-ella", relationshipToClient: "child_biological", sex: "Female", givenName: "Ella", dateOfBirth: "2001-01-01", childType: "biological", relationshipBlockId: "tom-kim", blockRole: "child", blockRoleType: "biological", displayOrder: 7 }),
    person({ relationshipRecordId: "tom-sally", relationshipToClient: "mother", sex: "Female", givenName: "Sally", dateOfBirth: "1950-01-01", healthStatus: "good", relationshipBlockId: "tom-bio", blockRole: "parent", blockRoleType: "mother", displayOrder: 8 }),
    person({ relationshipRecordId: "tom-john", relationshipToClient: "father", sex: "Male", givenName: "John", healthStatus: "deceased", deceased: true, dateOfDeath: "1998", relationshipBlockId: "tom-bio", blockRole: "parent", blockRoleType: "father", displayOrder: 9 }),
    person({ relationshipRecordId: "tom-harry", relationshipToClient: "sibling_full", sex: "Male", givenName: "Harry", dateOfBirth: "1968-01-01", relationshipBlockId: "tom-bio", blockRole: "sibling", blockRoleType: "full", displayOrder: 10 }),
    person({ relationshipRecordId: "tom-ann", relationshipToClient: "sibling_full", sex: "Female", givenName: "Ann", dateOfBirth: "1974-01-01", relationshipBlockId: "tom-bio", blockRole: "sibling", blockRoleType: "full", displayOrder: 11 }),
    person({ relationshipRecordId: "tom-michael", relationshipToClient: "sibling_full", sex: "Male", givenName: "Michael", deceased: true, healthStatus: "deceased", dateOfDeath: "1989", relationshipBlockId: "tom-bio", blockRole: "sibling", blockRoleType: "full", displayOrder: 12 }),
    person({ relationshipRecordId: "tom-phil", relationshipToClient: "step_parent", sex: "Male", givenName: "Phil", dateOfBirth: "1950-01-01", relationshipBlockId: "tom-phil", blockRole: "partner", displayOrder: 13 }),
    person({ relationshipRecordId: "tom-rose", relationshipToClient: "sibling_half", sex: "Female", givenName: "Rose", dateOfBirth: "1986-01-01", relationshipBlockId: "tom-phil", blockRole: "sibling", blockRoleType: "half", displayOrder: 14 }),
    person({ relationshipRecordId: "tom-bob", relationshipToClient: "sibling_step", sex: "Male", givenName: "Bob", dateOfBirth: "1981-01-01", relationshipBlockId: "tom-phil", blockRole: "sibling", blockRoleType: "step", displayOrder: 15 }),
    person({ relationshipRecordId: "tom-larry", relationshipToClient: "step_parent", sex: "Male", givenName: "Larry", dateOfBirth: "1956-01-01", relationshipBlockId: "tom-larry", blockRole: "partner", displayOrder: 16 }),
    person({ relationshipRecordId: "tom-joan", relationshipToClient: "other_caregiver", sex: "Female", givenName: "Joan", caregiverRelationship: "grandparent", caregiverRelationshipDetail: "maternal grandmother", relationshipBlockId: "tom-joan", blockRole: "caregiver", blockRoleType: "grandparent", displayOrder: 17 }),
  ]
}

export function tomBlocks(): RelationshipBlock[] {
  return [
    block({ relationshipBlockId: "tom-current", kind: "client_current", status: "married", startedOn: "2014", displayOrder: 0 }),
    block({ relationshipBlockId: "tom-pam", kind: "client_previous", status: "defacto_separated", startedOn: "2005", endedOn: "2011", noChildren: true, displayOrder: 0 }),
    block({ relationshipBlockId: "tom-kim", kind: "client_previous", status: "divorced", startedOn: "1998", endedOn: "2003", displayOrder: 1 }),
    block({ relationshipBlockId: "tom-bio", kind: "biological_parents", status: "divorced", startedOn: "1965", endedOn: "1978" }),
    block({ relationshipBlockId: "tom-phil", kind: "parent_other", parentRecordId: "tom-sally", parentSide: "mother", status: "divorced", startedOn: "1981", endedOn: "1990" }),
    block({ relationshipBlockId: "tom-larry", kind: "parent_other", parentRecordId: "tom-sally", parentSide: "mother", status: "defacto", startedOn: "2010" }),
    block({ relationshipBlockId: "tom-joan", kind: "caregiver_arrangement", arrangementType: "grandparent_care", startedOn: "1978", endedOn: "1982" }),
  ]
}

export function tomEvents(): EventRecord[] {
  return [
    history({ eventRecordId: "tom-leg", eventType: "illness_injury", title: "Broken leg", startPrecision: "year", startValue: "1982", endPrecision: "year", endValue: "1982", displayOrder: 1, about: "self" }),
    history({ eventRecordId: "tom-depression-1", eventType: "emotional_problems", title: "Depression", startPrecision: "year", startValue: "2000", endPrecision: "year", endValue: "2002", displayOrder: 2, about: "self" }),
    history({ eventRecordId: "tom-admission", eventType: "psychiatric_admission", title: "Psychiatric inpatient admission", admissionType: "psychiatric_inpatient", admissionLength: "2 weeks", startPrecision: "year", startValue: "2001", endPrecision: "year", endValue: "2001", conditionEventId: "tom-depression-1", displayOrder: 3, about: "self" }),
    history({ eventRecordId: "tom-psychologist", eventType: "previous_therapy", title: "Psychologist", startPrecision: "year", startValue: "2001", endPrecision: "year", endValue: "2002", conditionEventId: "tom-depression-1", displayOrder: 4, about: "self" }),
    history({ eventRecordId: "tom-depression-2", eventType: "emotional_problems", title: "Depression", startPrecision: "year", startValue: "2025", endOngoing: true, resolvedOrOngoing: "ongoing", displayOrder: 5, about: "self" }),
    history({ eventRecordId: "tom-sertraline", eventType: "medication", title: "Sertraline", startPrecision: "year", startValue: "2025", endOngoing: true, resolvedOrOngoing: "ongoing", prescriberProfessionalId: "tom-prescriber", prescriberName: "Dr Harry TestDoc", conditionEventId: "tom-depression-2", displayOrder: 6, about: "self" }),
    history({ eventRecordId: "tom-alcohol", eventType: "substance_use", title: "Alcohol", startPrecision: "year", startValue: "1988", endPrecision: "year", endValue: "2000", substanceStatus: "abstinent", displayOrder: 7, about: "self" }),
    history({ eventRecordId: "tom-rehab", eventType: "psychiatric_admission", title: "Residential rehab", admissionType: "residential_rehab", startPrecision: "year", startValue: "2000", endPrecision: "year", endValue: "2000", conditionEventId: "tom-alcohol", displayOrder: 8, about: "self" }),
    history({ eventRecordId: "tom-cutting", eventType: "self_harm", title: "Cutting", selfHarmType: "non_lethal", startPrecision: "year", startValue: "1984", endPrecision: "year", endValue: "1986", displayOrder: 9, about: "self" }),
    history({ eventRecordId: "tom-accident", eventType: "traumatic_event", title: "Serious car accident", startPrecision: "year", startValue: "1989", endPrecision: "year", endValue: "1989", displayOrder: 10, about: "self" }),
    history({ eventRecordId: "tom-moved", eventType: "significant_history", title: "Moved interstate", startPrecision: "year", startValue: "1985", endPrecision: "year", endValue: "1985", displayOrder: 11, about: "self" }),
    history({ eventRecordId: "tom-sally-depression", eventType: "emotional_problems", title: "Depression", about: "significant_other", relationshipRecordId: "tom-sally", attribution: "family", displayOrder: 12 }),
    history({ eventRecordId: "tom-john-alcohol", eventType: "substance_use", title: "Alcohol", about: "significant_other", relationshipRecordId: "tom-john", attribution: "family", displayOrder: 13 }),
    history({ eventRecordId: "tom-friend-alcohol", eventType: "substance_use", title: "Alcohol", about: "significant_other", aboutOther: "close friend", attribution: "family", displayOrder: 14 }),
  ]
}

export function tomScreening(): ScreeningAnswers {
  const yes = new Set([
    "illness_injury",
    "traumatic_events",
    "emotional_problems",
    "substance_use",
    "self_harm",
    "psychiatric_admission",
    "previous_therapy",
    "medication_history",
    "other_significant_events",
    "family_emotional_problems",
    "family_substance_use",
  ])
  return Object.fromEntries(HISTORY_QUESTION_KEYS.map((key) => [key, yes.has(key) ? "yes" : "no"]))
}

export function tomExampleSource(): BackgroundReportSource {
  const demographics = emptyDemographics()
  demographics.identity.sex = "Male"
  demographics.identity.pronouns = "he/him"
  demographics.identity.sexualOrientation = "heterosexual"
  demographics.identity.raceEthnicity = "Greek Australian"
  demographics.identity.religion = "Greek Orthodox"
  demographics.identity.primaryLanguage = "Greek"
  demographics.identity.disability = true
  demographics.identity.disabilityDetail = "Hearing impairment, left ear"
  demographics.identity.accessibilityNeeds = "Quiet room"
  demographics.education.level = "Bachelor degree"
  demographics.education.fieldOfStudy = "Commerce"
  demographics.education.currentlyStudying = true
  demographics.education.currentlyStudyingDetail = "Certificate IV in Work Health and Safety"
  demographics.education.disruption = true
  demographics.education.disruptionDetail = "Moved interstate in Year 10"
  demographics.occupation.workStatus = "full_time"
  demographics.occupation.role = "Site manager"
  demographics.occupation.previousJobs = [
    { id: "job-1", role: "Project coordinator", employer: "", started: "2010", ended: "2018" },
    { id: "job-2", role: "Site supervisor", employer: "", started: "2004", ended: "2010" },
  ]
  demographics.livingSituation.housingType = "Own home"
  demographics.livingSituation.livesWith = "with_partner_and_children"
  demographics.livingSituation.housingStability = "Stable"
  const stressors = emptyStressors()
  stressors.family = "no"
  stressors.socialLife = "no"
  stressors.intimateRelationships = "yes"
  stressors.workStudy = "yes"
  stressors.financial = "yes"
  stressors.ownHealth = "no"
  stressors.othersHealth = "no"
  stressors.lossOfLovedOne = "no"
  stressors.legalPoliceAccidents = "no"
  stressors.mainReason = "I can't stop worrying about money"
  const reason = emptyReasonForAttending()
  reason.referralType = "medical"
  reason.referrerProfessionalId = "tom-prescriber"
  reason.referralDate = "2026-10-03"
  reason.referrerConcerns = "low mood and stress"
  reason.referredByMedicalProfessional = "yes"
  reason.familyInvolved = "yes"
  reason.familyInvolvement = "His wife encouraged him to attend."
  reason.ownInitiative = "no"
  reason.clientMotivation = "Sleep better and stop arguing at home"
  const answers = emptyBlockAnswers()
  answers.previousRelationships = "yes"
  answers.otherChildren = "none"
  answers.motherOtherRelationships = "yes"
  answers.fatherOtherRelationships = "none"
  answers.caregiverArrangements = "yes"
  return {
    reportDate: TOM_REPORT_DATE,
    clientFirstName: TOM_FIRST_NAME,
    clientLastName: TOM_LAST_NAME,
    dateOfBirth: "1970-03-12",
    practitionerName: "Benjamin Edwards",
    practitionerReportIntroduction:
      "I am Benjamin Edwards, a registered psychologist. I have been registered as a psychologist since 2014. My principal therapeutic modalities include Cognitive Behaviour Therapy (CBT) and Dialectical Behaviour Therapy (DBT).",
    data: {
      dateOfBirth: "1970-03-12",
      backgroundCapturedAt: "2026-11-05T00:00:00.000Z",
      relationshipStatus: { ...emptyClientRelationshipStatus(), relationshipStatus: "married" },
      demographics,
      medication: emptyMedication(),
      stressors,
      reason,
      relationships: tomRelationships(),
      partnerships: [],
      relationshipBlocks: tomBlocks(),
      blockAnswers: answers,
      events: tomEvents(),
      risk: emptyRisk(),
    },
    screening: tomScreening(),
    interviews: [{ date: "2026-11-05" }],
    selfReportDate: null,
    numberOfChildren: 5,
    referral: {
      title: "Dr",
      firstName: "Harry",
      lastName: "TestDoc",
      profession: "GP",
      date: "2026-10-03",
    },
    professionals: [
      {
        professionalId: "tom-prescriber",
        title: "Dr",
        firstName: "Harry",
        lastName: "TestDoc",
        professionName: "GP",
      },
    ],
  }
}
