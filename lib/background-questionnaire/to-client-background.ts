/**
 * Map BACKGROUND_SR v2 → interview pre-fill suggestions (sections 3 and 7).
 * Sections 5, 6, 8, 9 are deferred — the v2 model still exposes those fields.
 */

import { HARD_TO_AFFORD_LABELS, LIVES_WITH_SELF_REPORT_LABELS } from "@/lib/assessments/definitions/background-sr"
import type { BackgroundSelfReportV2 } from "@/lib/background-questionnaire/types"
import {
  EMPLOYED_WORK_STATUSES,
  NECESSITY_KEYS,
  WORK_STATUS_LABELS,
  emptyNecessities,
  type NecessityAccess,
  type WorkStatus,
} from "@/lib/client-background/types"

/**
 * One client answer the interview can show.
 * `label` is the text after "Client: ".
 * `apply` is what Use writes. Prompt-only answers omit it.
 */
export type AppliedAnswer<T> = {
  label: string
  apply: T
}

export type YesNoDetailApply = {
  value: boolean
  detail: string
}

export type ClientBackgroundSuggestions = {
  identity: {
    sex?: AppliedAnswer<string>
    genderIdentity?: AppliedAnswer<string>
    pronouns?: AppliedAnswer<string>
    /** No longer suggested from BACKGROUND_SR v2; kept optional for typed Apply paths. */
    sexualOrientation?: AppliedAnswer<{ sexualOrientation: string; sexualOrientationOther: string }>
    raceEthnicity?: AppliedAnswer<string>
    religion?: AppliedAnswer<string>
    primaryLanguage?: AppliedAnswer<string>
    disability?: AppliedAnswer<YesNoDetailApply>
    accessibilityNeeds?: AppliedAnswer<string>
  }
  education: {
    level?: AppliedAnswer<string>
    fieldOfStudy?: AppliedAnswer<string>
    currentlyStudying?: AppliedAnswer<YesNoDetailApply>
    disruption?: AppliedAnswer<YesNoDetailApply>
  }
  occupation: {
    workStatus?: AppliedAnswer<{ workStatus: WorkStatus; workStatusOther: string }>
    role?: AppliedAnswer<string>
    employer?: AppliedAnswer<string>
    previousJob?: AppliedAnswer<{ role: string; employer: string }>
    necessities?: AppliedAnswer<NecessityAccess>
  }
  living: {
    housingType?: AppliedAnswer<string>
    housingStability?: AppliedAnswer<string>
    /** Display-only who-lives-with line — no Use client's / Keep. */
    whoLivesWithLabel?: string
  }
  /**
   * Deferred (sections 5/6/8/9) — not populated from v2 yet.
   * Optional so existing UI prop types still compile.
   */
  relationshipStatus?: AppliedAnswer<{
    relationshipStatus: string
    relationshipStatusOther: string
  }>
  numberOfChildren?: { label: string; count: number }
  history?: Partial<Record<string, AppliedAnswer<"yes" | "no">>>
  medication?: {
    currentlyTaking?: AppliedAnswer<"yes" | "no">
    previouslyTaken?: AppliedAnswer<"yes" | "no">
    everAdmitted?: AppliedAnswer<"yes" | "no">
    previousTherapy?: AppliedAnswer<"yes" | "no">
    everMedication?: AppliedAnswer<"yes" | "no">
  }
  stressors?: Partial<Record<string, AppliedAnswer<"yes" | "no">>> & {
    mainReason?: AppliedAnswer<string>
  }
}

function textAnswer(value: string): AppliedAnswer<string> | undefined {
  const text = value.trim()
  if (!text) return undefined
  return { label: text, apply: text }
}

function yesNoDetail(
  value: "yes" | "no" | "in_person" | null,
  detail: string
): AppliedAnswer<YesNoDetailApply> | undefined {
  if (value === "yes") {
    const text = detail.trim()
    return {
      label: text ? `Yes — ${text}` : "Yes",
      apply: { value: true, detail: text },
    }
  }
  if (value === "no") return { label: "No", apply: { value: false, detail: "" } }
  return undefined
}

function employed(status: WorkStatus | null): status is WorkStatus {
  return status !== null && (EMPLOYED_WORK_STATUSES as readonly string[]).includes(status)
}

/** Build the display-only "who lives with you" client line. */
export function formatWhoLivesWithClientLabel(
  livesWith: BackgroundSelfReportV2["livesWith"],
  livesWithOthers: string
): string | undefined {
  if (livesWith.length === 0) return undefined
  const others = livesWithOthers.trim()
  const parts = livesWith.map((key) => {
    const base = LIVES_WITH_SELF_REPORT_LABELS[key] ?? key
    if (
      others &&
      (key === "other_family" || key === "flatmates_friends" || key === "someone_else")
    ) {
      return `${base} (${others})`
    }
    return base
  })
  return parts.join(", ")
}

export function backgroundSelfReportToClientBackground(
  report: BackgroundSelfReportV2
): ClientBackgroundSuggestions {
  const identity: ClientBackgroundSuggestions["identity"] = {}
  const sex = textAnswer(report.sex ?? "")
  if (sex) identity.sex = sex
  if (report.genderDiffers === "yes") {
    const genderIdentity = textAnswer(report.genderIdentity)
    if (genderIdentity) identity.genderIdentity = genderIdentity
    const pronouns = textAnswer(report.pronouns)
    if (pronouns) identity.pronouns = pronouns
  }
  const raceEthnicity = textAnswer(report.culturalBackground)
  if (raceEthnicity) identity.raceEthnicity = raceEthnicity
  const religion = textAnswer(report.religion)
  if (religion) identity.religion = religion
  const primaryLanguage = textAnswer(report.language)
  if (primaryLanguage) identity.primaryLanguage = primaryLanguage
  const disability = yesNoDetail(report.disability, report.disabilityDetail)
  if (disability) identity.disability = disability
  const accessibilityNeeds = textAnswer(report.accessNeeds)
  if (accessibilityNeeds) identity.accessibilityNeeds = accessibilityNeeds

  const education: ClientBackgroundSuggestions["education"] = {}
  if (report.educationLevel) {
    education.level = { label: report.educationLevel, apply: report.educationLevel }
  }
  const fieldOfStudy = textAnswer(report.fieldOfStudy)
  if (fieldOfStudy) education.fieldOfStudy = fieldOfStudy
  const currentlyStudying = yesNoDetail(report.currentlyStudying, report.studyingDetail)
  if (currentlyStudying) education.currentlyStudying = currentlyStudying
  const disruption = yesNoDetail(report.studyInterrupted, report.interruptedDetail)
  if (disruption) education.disruption = disruption

  const occupation: ClientBackgroundSuggestions["occupation"] = {}
  if (report.workStatus) {
    const other = report.workStatus === "other" ? report.workOther.trim() : ""
    occupation.workStatus = {
      label:
        report.workStatus === "other"
          ? other || "Other"
          : WORK_STATUS_LABELS[report.workStatus],
      apply: { workStatus: report.workStatus, workStatusOther: other },
    }
  }
  if (employed(report.workStatus)) {
    const role = textAnswer(report.jobRole)
    if (role) occupation.role = role
    const employer = textAnswer(report.employer)
    if (employer) occupation.employer = employer
  }
  if (report.workStatus === "unemployed" || report.workStatus === "unable_to_work") {
    const role = report.recentJob.trim()
    if (role) {
      occupation.previousJob = {
        label: role,
        apply: { role, employer: "" },
      }
    }
  }
  if (report.hardToAfford.length > 0) {
    const picked = new Set(report.hardToAfford)
    const necessities = emptyNecessities()
    for (const key of NECESSITY_KEYS) necessities[key] = picked.has(key)
    occupation.necessities = {
      label: report.hardToAfford.map((key) => HARD_TO_AFFORD_LABELS[key]).join(", "),
      apply: necessities,
    }
  }

  const living: ClientBackgroundSuggestions["living"] = {}
  if (report.housingType) {
    living.housingType = { label: report.housingType, apply: report.housingType }
  }
  if (report.housingSecurity) {
    living.housingStability = {
      label: report.housingSecurity,
      apply: report.housingSecurity,
    }
  }
  const whoLivesWithLabel = formatWhoLivesWithClientLabel(report.livesWith, report.livesWithOthers)
  if (whoLivesWithLabel) living.whoLivesWithLabel = whoLivesWithLabel

  return { identity, education, occupation, living }
}
