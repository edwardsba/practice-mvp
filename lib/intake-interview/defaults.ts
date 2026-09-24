import type {
  EducationFields,
  EventRecord,
  FamilyHistoryFields,
  FamilyOfOriginRosterInput,
  FinancialFields,
  IdentityFields,
  IntakeInterviewPayload,
  LivingSituationFields,
  NecessityAccess,
  OccupationFields,
  OccupationJob,
  PartnersChildrenRosterInput,
  RelationshipRecord,
  SocialSupportFields,
} from "@/lib/intake-interview/types"

function emptyNecessity(): NecessityAccess {
  return { hasDifficulty: false, detail: "" }
}

export function emptyOccupationJob(isCurrent = false): OccupationJob {
  return {
    id: isCurrent ? "current" : "",
    title: "",
    employer: "",
    startYear: "",
    endYear: isCurrent ? "" : "",
    issues: "",
  }
}

export function emptyIdentity(): IdentityFields {
  return {
    sex: "",
    genderDiffersFromSex: false,
    genderIdentity: "",
    pronouns: "",
    race: "",
    ethnicity: "",
    culturalReligiousBackground: "",
    primaryLanguage: "",
    interpreterNeeded: false,
    interpreterNeeds: "",
    disability: "",
    accessibilityNeeds: "",
  }
}

export function emptyFamilyOfOriginRoster(): FamilyOfOriginRosterInput {
  return {
    parentsMaritalStatus: "",
    parentsMaritalStatusOther: "",
    parentCount: null,
    stepParentCount: null,
    fullSiblingCount: null,
    halfSiblingCount: null,
    stepSiblingCount: null,
    clientBirthOrder: "",
  }
}

export function emptyPartnersChildrenRoster(): PartnersChildrenRosterInput {
  return {
    currentPartnerCount: null,
    priorPartnerCount: null,
    unlinkedChildCount: null,
    childrenByPartnerId: {},
  }
}

export function emptyLivingSituation(): LivingSituationFields {
  return {
    householdComposition: "",
    housingType: "",
    housingStability: "",
  }
}

export function emptyEducation(): EducationFields {
  return {
    level: "",
    fieldOfStudy: "",
    currentlyStudying: null,
    currentlyStudyingDetail: "",
    disruption: null,
    disruptionDetail: "",
    showEducationalEventHistory: false,
    educationalEvents: [],
  }
}

export function emptyOccupation(): OccupationFields {
  return {
    currentJob: emptyOccupationJob(true),
    previousJobs: [],
  }
}

export function emptyFinancial(): FinancialFields {
  return {
    financialConcerns: "",
    food: emptyNecessity(),
    prescriptions: emptyNecessity(),
    transport: emptyNecessity(),
    leisure: emptyNecessity(),
    phoneInternet: emptyNecessity(),
  }
}

export function emptySocialSupport(): SocialSupportFields {
  return {
    familySupport: { hasSupport: null, quality: "", detail: "" },
    pets: { petCount: null, types: "", significance: "" },
    friendships: {
      hasCloseFriends: null,
      approximateCount: null,
      quality: "",
      detail: "",
    },
    religiousEngagement: {
      engaged: null,
      tradition: "",
      detail: "",
      suicideProtectiveBelief: null,
      suicideProtectiveBeliefDetail: "",
    },
    groups: [],
  }
}

export function emptyFamilyHistory(): FamilyHistoryFields {
  return { selectedRelationshipIds: [] }
}

export function emptyPayload(interviewDate: string): IntakeInterviewPayload {
  return {
    interviewDate,
    identity: emptyIdentity(),
    familyOfOriginRoster: emptyFamilyOfOriginRoster(),
    partnersChildrenRoster: emptyPartnersChildrenRoster(),
    familyHistory: emptyFamilyHistory(),
    relationships: [],
    events: [],
    livingSituation: emptyLivingSituation(),
    education: emptyEducation(),
    occupation: emptyOccupation(),
    financial: emptyFinancial(),
    socialSupport: emptySocialSupport(),
  }
}

export function emptyEventRecord(
  partial: Pick<EventRecord, "eventCategory" | "subDomain"> &
    Partial<EventRecord>
): EventRecord {
  return {
    eventRecordId: crypto.randomUUID(),
    personKind: "self",
    relationshipRecordId: null,
    endorsed: false,
    reasonDescription: "",
    ageDateStart: "",
    ageDateEnd: "",
    resolvedOrOngoing: "",
    severityImpact: "",
    treated: null,
    treatmentType: "",
    treatmentDetail: "",
    outcome: "",
    displayOrder: 0,
    ...partial,
  }
}

export function emptyRelationshipRecord(
  partial: Partial<RelationshipRecord> &
    Pick<RelationshipRecord, "relationshipToClient" | "section" | "rosterKey">
): RelationshipRecord {
  return {
    relationshipRecordId: crypto.randomUUID(),
    displayOrder: 0,
    givenName: "",
    linkedPartnerRecordId: null,
    age: null,
    deceased: false,
    ageAtDeath: null,
    healthOrCauseOfDeath: "",
    lengthOfRelationship: "",
    relationshipStatus: "",
    timeSinceEnded: "",
    qualityOfRelationship: "",
    dependency: "",
    livingSituation: "",
    ...partial,
  }
}
