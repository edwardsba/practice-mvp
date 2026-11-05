import {
  emptyBlockAnswers,
  isOneOf,
  RELATIONSHIP_TO_CLIENT,
  type BlockAnswer,
  type BlockKind,
  type ClientRelationshipStatusValue,
  type EventRecord,
  type EventType,
  type PartnershipRecord,
  type RelationshipBlock,
  type RelationshipBlockAnswers,
  type RelationshipRecord,
  type RelationshipToClient,
} from "@/lib/client-background/types"
import {
  sanitizeClientRelationshipStatus,
  sanitizeEvent,
  sanitizePartnership,
  sanitizeRelationship,
} from "@/lib/client-background/sanitize"

export function toRelationship(row: {
  relationshipRecordId: string
  relationshipToClient: string
  sex: string | null
  givenName: string | null
  displayOrder: number
  dateOfBirth: string | null
  approximateAge: number | null
  approximateAgeRecordedOn: string | null
  healthStatus: string | null
  deceased: boolean
  ageAtDeath: number | null
  dateOfDeath: string | null
  healthOrCauseOfDeath: string | null
  lengthOfRelationship: string | null
  relationshipStatus: string | null
  howEnded: string | null
  laterRelationships: string | null
  childType: string | null
  childTypeDetail: string | null
  timeSinceEnded: string | null
  supportive: string | null
  conflict: string | null
  qualityOfRelationship: string | null
  dependency: string | null
  livingSituation: string | null
  caregiverRelationship: string | null
  caregiverRelationshipDetail: string | null
  startedOn: string | null
  endedOn: string | null
  partnerType: string | null
  parentType: string | null
  adoptedOn: string | null
  notKnown: boolean
  otherParentKind: string | null
  otherParentDetail: string | null
  linkedPartnerRecordId: string | null
  partnershipRecordId: string | null
  relationshipBlockId?: string | null
  blockRole?: string | null
  blockRoleType?: string | null
  placementReview?: string | null
}): RelationshipRecord {
  const role: RelationshipToClient = isOneOf(row.relationshipToClient, RELATIONSHIP_TO_CLIENT)
    ? row.relationshipToClient
    : "parent"
  return sanitizeRelationship({
    ...row,
    relationshipToClient: role,
    sex: row.sex ?? "",
    givenName: row.givenName ?? "",
    dateOfBirth: row.dateOfBirth ?? "",
    approximateAge: row.approximateAge,
    approximateAgeRecordedOn: row.approximateAgeRecordedOn ?? "",
    dateOfDeath: row.dateOfDeath ?? "",
    healthOrCauseOfDeath: row.healthOrCauseOfDeath ?? "",
    lengthOfRelationship: row.lengthOfRelationship ?? "",
    relationshipStatus: row.relationshipStatus ?? "",
    howEnded: row.howEnded ?? "",
    laterRelationships: row.laterRelationships ?? "",
    childType: row.childType ?? "",
    childTypeDetail: row.childTypeDetail ?? "",
    timeSinceEnded: row.timeSinceEnded ?? "",
    supportive: row.supportive ?? "",
    conflict: row.conflict ?? "",
    qualityOfRelationship: row.qualityOfRelationship ?? "",
    dependency: row.dependency ?? "",
    livingSituation: row.livingSituation ?? "",
    caregiverRelationship: row.caregiverRelationship ?? "",
    caregiverRelationshipDetail: row.caregiverRelationshipDetail ?? "",
    startedOn: row.startedOn ?? "",
    endedOn: row.endedOn ?? "",
    partnerType: row.partnerType ?? "",
    parentType: row.parentType ?? "",
    adoptedOn: row.adoptedOn ?? "",
    notKnown: row.notKnown,
    otherParentKind: row.otherParentKind ?? "",
    otherParentDetail: row.otherParentDetail ?? "",
    relationshipBlockId: row.relationshipBlockId ?? null,
    blockRole: row.blockRole ?? "",
    blockRoleType: row.blockRoleType ?? "",
    placementReview: row.placementReview ?? "",
  })
}

export function toClientRelationshipStatus(
  row: {
    relationshipStatus: string | null
    relationshipStatusOther: string | null
  } | null
): ClientRelationshipStatusValue {
  return sanitizeClientRelationshipStatus({
    relationshipStatus: row?.relationshipStatus ?? "",
    relationshipStatusOther: row?.relationshipStatusOther ?? "",
  })
}

export function toRelationshipBlock(row: {
  relationshipBlockId: string
  kind: string
  parentRecordId: string | null
  parentSide: string | null
  status: string | null
  statusDetail: string | null
  arrangementType: string | null
  arrangementDetail: string | null
  startedOn: string | null
  endedOn: string | null
  noChildren: boolean
  displayOrder: number
}): RelationshipBlock {
  const kind: BlockKind = isOneOf(row.kind, [
    "client_current",
    "client_previous",
    "client_other_children",
    "biological_parents",
    "parent_other",
    "caregiver_arrangement",
  ] as const)
    ? row.kind
    : "client_current"
  const side = row.parentSide === "mother" || row.parentSide === "father" ? row.parentSide : ""
  const rawArrangement = row.arrangementType ?? ""
  const arrangement = isOneOf(rawArrangement, [
    "adoption",
    "grandparent_care",
    "kinship_care",
    "foster_care",
    "residential",
    "other",
  ] as const)
    ? rawArrangement
    : ""
  return {
    relationshipBlockId: row.relationshipBlockId,
    kind,
    parentRecordId: row.parentRecordId,
    parentSide: side,
    status: row.status ?? "",
    statusDetail: row.statusDetail ?? "",
    arrangementType: arrangement,
    arrangementDetail: row.arrangementDetail ?? "",
    startedOn: row.startedOn ?? "",
    endedOn: row.endedOn ?? "",
    noChildren: row.noChildren,
    displayOrder: row.displayOrder,
  }
}

export function toBlockAnswers(row: {
  previousRelationships: string | null
  otherChildren: string | null
  motherOtherRelationships: string | null
  fatherOtherRelationships: string | null
  caregiverArrangements: string | null
} | null): RelationshipBlockAnswers {
  const answer = (value: string | null | undefined): BlockAnswer | "" =>
    value === "yes" || value === "none" || value === "not_asked" ? value : ""
  if (!row) return emptyBlockAnswers()
  return {
    previousRelationships: answer(row.previousRelationships) || "not_asked",
    otherChildren: answer(row.otherChildren) || "not_asked",
    motherOtherRelationships: answer(row.motherOtherRelationships) || "not_asked",
    fatherOtherRelationships: answer(row.fatherOtherRelationships) || "not_asked",
    caregiverArrangements: answer(row.caregiverArrangements) || "not_asked",
  }
}

export function toPartnership(row: {
  partnershipRecordId: string
  partnerAId: string
  partnerBId: string
  relationshipStatus: string | null
  started: string | null
  ended: string | null
  qualityOfRelationship: string | null
}): PartnershipRecord {
  return sanitizePartnership({
    ...row,
    relationshipStatus: row.relationshipStatus ?? "",
    started: row.started ?? "",
    ended: row.ended ?? "",
    qualityOfRelationship: row.qualityOfRelationship ?? "",
  })
}

export function toEvent(row: {
  eventRecordId: string
  eventType: string
  title: string | null
  description: string | null
  startPrecision: string | null
  startValue: string | null
  endPrecision: string | null
  endValue: string | null
  endOngoing: boolean
  resolvedOrOngoing: string | null
  treated: boolean | null
  treatmentType: string | null
  treatmentDetail: string | null
  outcome: string | null
  attribution: string
  about: string | null
  aboutOther: string | null
  familyRelation: string | null
  familySide: string | null
  relationshipRecordId: string | null
  conditionEventId: string | null
  admissionType: string | null
  facility: string | null
  admissionLength: string | null
  prescriberProfessionalId: string | null
  prescriberName: string | null
  selfHarmType: string | null
  substanceStatus: string | null
  abstinentSincePrecision: string | null
  abstinentSinceValue: string | null
  displayOrder: number
}): EventRecord {
  return sanitizeEvent({
    ...row,
    eventType: row.eventType as EventType,
    title: row.title ?? "",
    description: row.description ?? "",
    startPrecision: row.startPrecision ?? "",
    startValue: row.startValue ?? "",
    endPrecision: row.endPrecision ?? "",
    endValue: row.endValue ?? "",
    resolvedOrOngoing: row.resolvedOrOngoing ?? "",
    treatmentType: row.treatmentType ?? "",
    treatmentDetail: row.treatmentDetail ?? "",
    outcome: row.outcome ?? "",
    about: row.about ?? "",
    aboutOther: row.aboutOther ?? "",
    familyRelation: row.familyRelation ?? "",
    familySide: row.familySide ?? "",
    conditionEventId: row.conditionEventId,
    admissionType: row.admissionType ?? "",
    facility: row.facility ?? "",
    admissionLength: row.admissionLength ?? "",
    prescriberProfessionalId: row.prescriberProfessionalId,
    prescriberName: row.prescriberName ?? "",
    selfHarmType: row.selfHarmType ?? "",
    substanceStatus: row.substanceStatus ?? "",
    abstinentSincePrecision: row.abstinentSincePrecision ?? "",
    abstinentSinceValue: row.abstinentSinceValue ?? "",
  })
}
