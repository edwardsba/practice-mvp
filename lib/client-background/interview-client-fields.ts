/**
 * Self-report vs file comparison for Background interview sections 1–4 and 7
 * (Round AR). Field keys are stable clientDecisions keys.
 * Pure — no database.
 */

import type { ClientBackgroundSuggestions } from "@/lib/background-questionnaire/to-client-background"
import type { Demographics, NecessityAccess } from "@/lib/client-background/types"
import { householdFromLivesWith } from "@/lib/client-background/household"

export type ClientDecisionChoice = "used" | "kept"

export type ClientFieldDecision = {
  choice: ClientDecisionChoice
  at: string
}

export type ClientFieldStateKind = "same" | "empty" | "different" | "none"

export type ClientFieldState = {
  fieldKey: string
  /** Text after "Client: " */
  label: string
  kind: ClientFieldStateKind
  /** Interview item that owns this field (for section grouping). */
  itemKey: string
}

/** Fine-grained fields the self-report can suggest for overview rows. */
export const CLIENT_FIELD_KEYS = [
  "identity.sex",
  "identity.genderIdentity",
  "identity.pronouns",
  "identity.sexualOrientation",
  "identity.raceEthnicity",
  "identity.religion",
  "identity.primaryLanguage",
  "identity.disability",
  "education.level",
  "education.fieldOfStudy",
  "education.currentlyStudying",
  "education.disruption",
  "occupation.workStatus",
  "occupation.role",
  "occupation.employer",
  "occupation.previousJob",
  "occupation.necessities",
  "living.housingType",
  "living.livesWith",
  "living.housingStability",
] as const

export type ClientFieldKey = (typeof CLIENT_FIELD_KEYS)[number]

const ITEM_FOR_FIELD: Record<ClientFieldKey, string> = {
  "identity.sex": "s3_identity",
  "identity.genderIdentity": "s3_identity",
  "identity.pronouns": "s3_identity",
  "identity.sexualOrientation": "s3_identity",
  "identity.raceEthnicity": "s3_identity",
  "identity.religion": "s3_identity",
  "identity.primaryLanguage": "s3_identity",
  "identity.disability": "s3_disability",
  "education.level": "s3_education",
  "education.fieldOfStudy": "s3_education",
  "education.currentlyStudying": "s3_education",
  "education.disruption": "s3_education",
  "occupation.workStatus": "s3_occupation",
  "occupation.role": "s3_occupation",
  "occupation.employer": "s3_occupation",
  "occupation.previousJob": "s3_occupation",
  "occupation.necessities": "s3_financial",
  "living.housingType": "s7_housing_type",
  "living.livesWith": "s7_who",
  "living.housingStability": "s7_housing_security",
}

export function interviewItemKeyForClientField(fieldKey: string): string | null {
  if ((CLIENT_FIELD_KEYS as readonly string[]).includes(fieldKey)) {
    return ITEM_FOR_FIELD[fieldKey as ClientFieldKey]
  }
  return null
}

export function clientFieldsForItem(itemKey: string): ClientFieldKey[] {
  return CLIENT_FIELD_KEYS.filter((key) => ITEM_FOR_FIELD[key] === itemKey)
}

export function sectionNumbersForClientFields(): number[] {
  return [3, 7]
}

function fileEmptyString(value: string | null | undefined): boolean {
  return !value?.trim()
}

function yesNoDetailMatches(
  file: { flag: boolean | null; detail: string },
  apply: { value: boolean; detail: string }
): boolean {
  if (file.flag !== apply.value) return false
  if (!apply.value) return true
  return file.detail.trim() === apply.detail.trim()
}

function necessitiesMatch(file: NecessityAccess, apply: NecessityAccess): boolean {
  return (Object.keys(apply) as (keyof NecessityAccess)[]).every((key) => file[key] === apply[key])
}

function fileEmptyNecessities(file: NecessityAccess): boolean {
  return (Object.keys(file) as (keyof NecessityAccess)[]).every((key) => !file[key])
}

/**
 * Compare one self-report suggestion to the living demographics file.
 * Returns null when there is no client answer for that field.
 */
export function compareClientField(
  fieldKey: ClientFieldKey,
  suggestions: ClientBackgroundSuggestions | null | undefined,
  demographics: Demographics
): { label: string; kind: Exclude<ClientFieldStateKind, "none"> } | null {
  if (!suggestions) return null
  const identity = demographics.identity
  const education = demographics.education
  const occupation = demographics.occupation
  const living = demographics.livingSituation

  switch (fieldKey) {
    case "identity.sex": {
      const s = suggestions.identity.sex
      if (!s) return null
      if (fileEmptyString(identity.sex)) return { label: s.label, kind: "empty" }
      return { label: s.label, kind: identity.sex === s.apply ? "same" : "different" }
    }
    case "identity.genderIdentity": {
      const s = suggestions.identity.genderIdentity
      if (!s) return null
      if (fileEmptyString(identity.genderIdentity)) return { label: s.label, kind: "empty" }
      return {
        label: s.label,
        kind: identity.genderIdentity === s.apply ? "same" : "different",
      }
    }
    case "identity.pronouns": {
      const s = suggestions.identity.pronouns
      if (!s) return null
      const file =
        identity.pronouns === "Other" ? identity.pronounsOther.trim() || "Other" : identity.pronouns.trim()
      if (!file) return { label: s.label, kind: "empty" }
      return { label: s.label, kind: file === s.apply ? "same" : "different" }
    }
    case "identity.sexualOrientation": {
      const s = suggestions.identity.sexualOrientation
      if (!s) return null
      if (!identity.sexualOrientation) return { label: s.label, kind: "empty" }
      const same =
        identity.sexualOrientation === s.apply.sexualOrientation &&
        (s.apply.sexualOrientation !== "another" ||
          identity.sexualOrientationOther.trim() === s.apply.sexualOrientationOther.trim())
      return { label: s.label, kind: same ? "same" : "different" }
    }
    case "identity.raceEthnicity": {
      const s = suggestions.identity.raceEthnicity
      if (!s) return null
      if (fileEmptyString(identity.raceEthnicity)) return { label: s.label, kind: "empty" }
      return {
        label: s.label,
        kind: identity.raceEthnicity === s.apply ? "same" : "different",
      }
    }
    case "identity.religion": {
      const s = suggestions.identity.religion
      if (!s) return null
      if (fileEmptyString(identity.religion)) return { label: s.label, kind: "empty" }
      return { label: s.label, kind: identity.religion === s.apply ? "same" : "different" }
    }
    case "identity.primaryLanguage": {
      const s = suggestions.identity.primaryLanguage
      if (!s) return null
      if (fileEmptyString(identity.primaryLanguage)) return { label: s.label, kind: "empty" }
      return {
        label: s.label,
        kind: identity.primaryLanguage === s.apply ? "same" : "different",
      }
    }
    case "identity.disability": {
      const s = suggestions.identity.disability
      if (!s) return null
      if (identity.disability === null) return { label: s.label, kind: "empty" }
      return {
        label: s.label,
        kind: yesNoDetailMatches(
          { flag: identity.disability, detail: identity.disabilityDetail },
          s.apply
        )
          ? "same"
          : "different",
      }
    }
    case "education.level": {
      const s = suggestions.education.level
      if (!s) return null
      if (fileEmptyString(education.level)) return { label: s.label, kind: "empty" }
      return { label: s.label, kind: education.level === s.apply ? "same" : "different" }
    }
    case "education.fieldOfStudy": {
      const s = suggestions.education.fieldOfStudy
      if (!s) return null
      if (fileEmptyString(education.fieldOfStudy)) return { label: s.label, kind: "empty" }
      return {
        label: s.label,
        kind: education.fieldOfStudy === s.apply ? "same" : "different",
      }
    }
    case "education.currentlyStudying": {
      const s = suggestions.education.currentlyStudying
      if (!s) return null
      if (education.currentlyStudying === null) return { label: s.label, kind: "empty" }
      return {
        label: s.label,
        kind: yesNoDetailMatches(
          { flag: education.currentlyStudying, detail: education.currentlyStudyingDetail },
          s.apply
        )
          ? "same"
          : "different",
      }
    }
    case "education.disruption": {
      const s = suggestions.education.disruption
      if (!s) return null
      if (education.disruption === null) return { label: s.label, kind: "empty" }
      return {
        label: s.label,
        kind: yesNoDetailMatches(
          { flag: education.disruption, detail: education.disruptionDetail },
          s.apply
        )
          ? "same"
          : "different",
      }
    }
    case "occupation.workStatus": {
      const s = suggestions.occupation.workStatus
      if (!s) return null
      if (!occupation.workStatus) return { label: s.label, kind: "empty" }
      const same =
        occupation.workStatus === s.apply.workStatus &&
        (s.apply.workStatus !== "other" ||
          occupation.workStatusOther.trim() === s.apply.workStatusOther.trim())
      return { label: s.label, kind: same ? "same" : "different" }
    }
    case "occupation.role": {
      const s = suggestions.occupation.role
      if (!s) return null
      if (fileEmptyString(occupation.role)) return { label: s.label, kind: "empty" }
      return { label: s.label, kind: occupation.role === s.apply ? "same" : "different" }
    }
    case "occupation.employer": {
      const s = suggestions.occupation.employer
      if (!s) return null
      if (fileEmptyString(occupation.employer)) return { label: s.label, kind: "empty" }
      return { label: s.label, kind: occupation.employer === s.apply ? "same" : "different" }
    }
    case "occupation.previousJob": {
      const s = suggestions.occupation.previousJob
      if (!s) return null
      if (occupation.previousJobs.length === 0) return { label: s.label, kind: "empty" }
      const same = occupation.previousJobs.some(
        (job) =>
          job.role.trim() === s.apply.role.trim() &&
          job.employer.trim() === s.apply.employer.trim()
      )
      return { label: s.label, kind: same ? "same" : "different" }
    }
    case "occupation.necessities": {
      const s = suggestions.occupation.necessities
      if (!s) return null
      if (fileEmptyNecessities(occupation.necessities)) return { label: s.label, kind: "empty" }
      return {
        label: s.label,
        kind: necessitiesMatch(occupation.necessities, s.apply) ? "same" : "different",
      }
    }
    case "living.housingType": {
      const s = suggestions.living.housingType
      if (!s) return null
      if (fileEmptyString(living.housingType)) return { label: s.label, kind: "empty" }
      return { label: s.label, kind: living.housingType === s.apply ? "same" : "different" }
    }
    case "living.livesWith": {
      const s = suggestions.living.livesWith
      if (!s) return null
      if (!living.household) return { label: s.label, kind: "empty" }
      const suggestedHousehold = householdFromLivesWith(s.apply.livesWith)
      const same =
        living.household === suggestedHousehold &&
        (s.apply.livesWith !== "other" ||
          living.livesWithOther.trim() === s.apply.livesWithOther.trim())
      return { label: s.label, kind: same ? "same" : "different" }
    }
    case "living.housingStability": {
      const s = suggestions.living.housingStability
      if (!s) return null
      if (fileEmptyString(living.housingStability)) return { label: s.label, kind: "empty" }
      return {
        label: s.label,
        kind: living.housingStability === s.apply ? "same" : "different",
      }
    }
  }
}

export function clientFieldStates(
  suggestions: ClientBackgroundSuggestions | null | undefined,
  demographics: Demographics,
  decisions: Readonly<Record<string, ClientFieldDecision>>
): ClientFieldState[] {
  const out: ClientFieldState[] = []
  for (const fieldKey of CLIENT_FIELD_KEYS) {
    const compared = compareClientField(fieldKey, suggestions, demographics)
    if (!compared) {
      out.push({
        fieldKey,
        label: "",
        kind: "none",
        itemKey: ITEM_FOR_FIELD[fieldKey],
      })
      continue
    }
    const decided = Boolean(decisions[fieldKey])
    let kind = compared.kind
    // After Use client's / Keep, the row stops counting as waiting.
    if (decided && (kind === "empty" || kind === "different")) {
      // Keep shows as same (only file value); used also becomes same after save.
      kind = "same"
    }
    out.push({
      fieldKey,
      label: compared.label,
      kind,
      itemKey: ITEM_FOR_FIELD[fieldKey],
    })
  }
  return out
}

/** Fields still waiting for Use client's / Keep (empty or different, undecided). */
export function waitingClientFields(
  states: readonly ClientFieldState[]
): ClientFieldState[] {
  return states.filter((state) => state.kind === "empty" || state.kind === "different")
}

export function waitingClientFieldsForSection(
  states: readonly ClientFieldState[],
  sectionNumber: number
): ClientFieldState[] {
  const prefix =
    sectionNumber === 3 ? "s3_" : sectionNumber === 7 ? "s7_" : null
  if (!prefix) return []
  return waitingClientFields(states).filter((state) => state.itemKey.startsWith(prefix))
}

/** Display label for a multi-field Client: line, e.g. "Pronouns · he/him". */
export function clientFieldDisplayLabel(fieldKey: ClientFieldKey, answerLabel: string): string {
  const titles: Partial<Record<ClientFieldKey, string>> = {
    "identity.sex": "Sex",
    "identity.genderIdentity": "Gender identity",
    "identity.pronouns": "Pronouns",
    "identity.sexualOrientation": "Sexual orientation",
    "identity.raceEthnicity": "Race / ethnicity",
    "identity.religion": "Religion",
    "identity.primaryLanguage": "Primary language",
    "identity.disability": "Disability or access needs",
    "education.level": "Level",
    "education.fieldOfStudy": "Field of study",
    "education.currentlyStudying": "Currently studying",
    "education.disruption": "Education disruption",
    "occupation.workStatus": "Work status",
    "occupation.role": "Role",
    "occupation.employer": "Employer",
    "occupation.previousJob": "Previous job",
    "occupation.necessities": "Basic necessities",
    "living.housingType": "Housing type",
    "living.livesWith": "Who lives in the home",
    "living.housingStability": "Housing security",
  }
  const title = titles[fieldKey]
  if (!title) return answerLabel
  // Single-field interview items (disability, financial, housing) keep plain Client: label.
  if (
    fieldKey === "identity.disability" ||
    fieldKey === "occupation.necessities" ||
    fieldKey === "living.housingType" ||
    fieldKey === "living.livesWith" ||
    fieldKey === "living.housingStability"
  ) {
    return answerLabel
  }
  return `${title} · ${answerLabel}`
}

export function acceptClientChangesButtonLabel(count: number): string {
  if (count === 1) return "Accept 1 client change and confirm"
  return `Accept ${count} client changes and confirm`
}

export function clientChangesPillLabel(count: number): string {
  if (count === 1) return "1 client change"
  return `${count} client changes`
}
