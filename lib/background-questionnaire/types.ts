/**
 * BACKGROUND_SR v2 typed model (Round AY).
 * Built from shared-form response rows — not the old structuredScoreJson blob.
 */

import type { HistoryListEntry, PersonListEntry } from "@/lib/assessments/form-lists"
import type {
  ClientRelationshipStatus,
  NecessityKey,
  SexOption,
  WorkStatus,
} from "@/lib/client-background/types"

export const BACKGROUND_ASSESSMENT_CODE = "BACKGROUND_SR"

export type YesNoInPerson = "yes" | "no" | "in_person"

export const LIVES_WITH_SELF_REPORT_VALUES = [
  "partner",
  "children",
  "parents",
  "siblings",
  "other_family",
  "flatmates_friends",
  "someone_else",
  "alone",
] as const
export type LivesWithSelfReportValue = (typeof LIVES_WITH_SELF_REPORT_VALUES)[number]

export const PARENTS_TOGETHER_VALUES = [
  "yes_still_together",
  "together_until_passed_away",
  "separated_or_divorced",
  "never_together",
  "not_sure",
] as const
export type ParentsTogetherValue = (typeof PARENTS_TOGETHER_VALUES)[number]

export type BackgroundSelfReportV2 = {
  version: 2
  // 1. About you
  sex: SexOption | null
  genderDiffers: YesNoInPerson | null
  genderIdentity: string
  pronouns: string
  culturalBackground: string
  religion: string
  language: string
  disability: YesNoInPerson | null
  disabilityDetail: string
  accessNeeds: string
  // 2. Study and work
  educationLevel: string | null
  fieldOfStudy: string
  currentlyStudying: YesNoInPerson | null
  studyingDetail: string
  studyInterrupted: YesNoInPerson | null
  interruptedDetail: string
  workStatus: WorkStatus | null
  jobRole: string
  employer: string
  recentJob: string
  workOther: string
  hardToAfford: NecessityKey[]
  // 3. Your relationships
  relationshipStatus: ClientRelationshipStatus | null
  partner: PersonListEntry[]
  children: PersonListEntry[]
  previousRelationships: PersonListEntry[]
  // 4. The family you grew up with
  parents: PersonListEntry[]
  parentsTogether: ParentsTogetherValue | null
  siblings: PersonListEntry[]
  // 5. Your home
  livesWith: LivesWithSelfReportValue[]
  livesWithOthers: string
  housingType: string | null
  housingSecurity: string | null
  // 6. Your history
  histPhysical: YesNoInPerson | null
  histPhysicalList: HistoryListEntry[]
  histSubstance: YesNoInPerson | null
  histMental: YesNoInPerson | null
  histMentalList: HistoryListEntry[]
  histSelfharm: YesNoInPerson | null
  histTrauma: YesNoInPerson | null
  famMental: YesNoInPerson | null
  famSubstance: YesNoInPerson | null
}

/**
 * Latest submitted BACKGROUND_SR v2 result for a client.
 * `answers.familyHome.numberOfChildren` is a thin compatibility shim so
 * `lib/reports/load-background-report-source.ts` keeps compiling without edits.
 */
export type BackgroundSelfReport = {
  resultId: string
  assessmentDate: string
  report: BackgroundSelfReportV2
  answers: {
    familyHome: {
      numberOfChildren: number | null
    }
  }
}

export type BackgroundResponseRow = {
  elementKey: string
  responseValue: string
  responseOrder?: number | null
}
