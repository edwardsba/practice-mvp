/**
 * Self-report vs file comparison for Background interview sections 1–4 and 7
 * (Round AR). Field keys are stable clientDecisions keys.
 * Pure — no database.
 */

import type { ClientBackgroundSuggestions } from "@/lib/background-questionnaire/to-client-background"
import {
  EMPLOYED_WORK_STATUSES,
  NECESSITY_KEYS,
  type Demographics,
  type IdentityFields,
  type NecessityAccess,
} from "@/lib/client-background/types"
import {
  sanitizeEducation,
  sanitizeIdentity,
  sanitizeLivingSituation,
  sanitizeOccupation,
} from "@/lib/client-background/sanitize"

export type ClientDecisionChoice = "used" | "kept"

export type ClientFieldDecision = {
  choice: ClientDecisionChoice
  at: string
}

export type ClientFieldStateKind = "same" | "empty" | "different" | "none"

export type ClientFieldState = {
  fieldKey: ClientFieldKey
  /** Text after "Client: " */
  label: string
  /** How the client's answer compares with the file right now. */
  kind: ClientFieldStateKind
  /** Interview item that owns this field (for section grouping). */
  itemKey: string
  /** Use client's / Keep already recorded for this field. */
  decision: ClientDecisionChoice | null
  /** Empty or different with no decision yet: shows Use client's / Keep and counts as a client change. */
  waiting: boolean
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
  "identity.accessibilityNeeds",
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
  "identity.accessibilityNeeds": "s3_disability",
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
  "living.housingStability": "s7_housing_security",
}

export function isClientFieldKey(value: unknown): value is ClientFieldKey {
  return typeof value === "string" && (CLIENT_FIELD_KEYS as readonly string[]).includes(value)
}

export function interviewItemKeyForClientField(fieldKey: string): string | null {
  return isClientFieldKey(fieldKey) ? ITEM_FOR_FIELD[fieldKey] : null
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
    case "identity.accessibilityNeeds": {
      const s = suggestions.identity.accessibilityNeeds
      if (!s) return null
      if (fileEmptyString(identity.accessibilityNeeds)) return { label: s.label, kind: "empty" }
      return {
        label: s.label,
        kind: identity.accessibilityNeeds === s.apply ? "same" : "different",
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
  return CLIENT_FIELD_KEYS.map((fieldKey) => {
    const compared = compareClientField(fieldKey, suggestions, demographics)
    const kind = compared?.kind ?? "none"
    const decision = compared ? (decisions[fieldKey]?.choice ?? null) : null
    return {
      fieldKey,
      label: compared?.label ?? "",
      kind,
      itemKey: ITEM_FOR_FIELD[fieldKey],
      decision,
      waiting: (kind === "empty" || kind === "different") && decision === null,
    }
  })
}

/** Fields still waiting for Use client's / Keep (empty or different, undecided). */
export function waitingClientFields(
  states: readonly ClientFieldState[]
): ClientFieldState[] {
  return states.filter((state) => state.waiting)
}

export function clientFieldStatesForItem(
  states: readonly ClientFieldState[],
  itemKey: string
): ClientFieldState[] {
  return states.filter((state) => state.itemKey === itemKey)
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

/** Same wording as the interview fact lines ("Main language: …"). */
const CLIENT_FIELD_TITLES: Record<ClientFieldKey, string> = {
  "identity.sex": "Sex",
  "identity.genderIdentity": "Gender",
  "identity.pronouns": "Pronouns",
  "identity.sexualOrientation": "Sexual orientation",
  "identity.raceEthnicity": "Cultural or ethnic background",
  "identity.religion": "Religion",
  "identity.primaryLanguage": "Main language",
  "identity.disability": "Disability",
  "identity.accessibilityNeeds": "Access needs",
  "education.level": "Highest level",
  "education.fieldOfStudy": "Field",
  "education.currentlyStudying": "Currently studying",
  "education.disruption": "Study interrupted",
  "occupation.workStatus": "Work status",
  "occupation.role": "Role",
  "occupation.employer": "Employer",
  "occupation.previousJob": "Previous job",
  "occupation.necessities": "Hard to afford",
  "living.housingType": "Housing type",
  "living.housingStability": "Housing security",
}

export function clientFieldTitle(fieldKey: ClientFieldKey): string {
  return CLIENT_FIELD_TITLES[fieldKey]
}

/** The row's own label already names these fields, so their Client: line needs no title. */
const PLAIN_LABEL_FIELDS: ReadonlySet<ClientFieldKey> = new Set([
  "identity.disability",
  "identity.accessibilityNeeds",
  "living.housingType",
  "living.housingStability",
])

export function isClientFieldNamedByRow(fieldKey: ClientFieldKey): boolean {
  return PLAIN_LABEL_FIELDS.has(fieldKey)
}

/** Text after "Client: ", e.g. "Pronouns · he/him" in a multi-field row. */
export function clientFieldDisplayLabel(fieldKey: ClientFieldKey, answerLabel: string): string {
  if (PLAIN_LABEL_FIELDS.has(fieldKey)) return answerLabel
  return `${CLIENT_FIELD_TITLES[fieldKey]} · ${answerLabel}`
}

/** Demographics section a client field is saved through. */
export type ClientFieldSection = "identity" | "education" | "occupation" | "livingSituation"

export function clientFieldSection(fieldKey: ClientFieldKey): ClientFieldSection {
  if (fieldKey.startsWith("identity.")) return "identity"
  if (fieldKey.startsWith("education.")) return "education"
  if (fieldKey.startsWith("occupation.")) return "occupation"
  return "livingSituation"
}

export type ApplyClientFieldResult =
  | { ok: true; demographics: Demographics; section: ClientFieldSection }
  | { ok: false; error: string }

function employedStatus(workStatus: string): boolean {
  return (EMPLOYED_WORK_STATUSES as readonly string[]).includes(workStatus)
}

function withIdentity(demographics: Demographics, patch: Partial<IdentityFields>): Demographics {
  return { ...demographics, identity: sanitizeIdentity({ ...demographics.identity, ...patch }) }
}

/**
 * The record after Use client's for one field: the self-report answer written in, and the changed
 * section sanitized the way its save path does. Fails when there is no client answer, or when the
 * answer can't be kept (role / employer need an employed work status on file).
 */
export function applyClientField(
  fieldKey: ClientFieldKey,
  suggestions: ClientBackgroundSuggestions | null | undefined,
  demographics: Demographics
): ApplyClientFieldResult {
  const noAnswer = { ok: false as const, error: "The client didn't answer this in the self-report." }
  if (!suggestions) return noAnswer
  const { identity, education, occupation, living } = suggestions
  const section = clientFieldSection(fieldKey)
  let next: Demographics | null = null

  switch (fieldKey) {
    case "identity.sex":
      if (identity.sex) next = withIdentity(demographics, { sex: identity.sex.apply })
      break
    case "identity.genderIdentity":
      if (identity.genderIdentity) {
        next = withIdentity(demographics, { genderIdentity: identity.genderIdentity.apply })
      }
      break
    case "identity.pronouns":
      if (identity.pronouns) next = withIdentity(demographics, { pronouns: identity.pronouns.apply })
      break
    case "identity.sexualOrientation":
      if (identity.sexualOrientation) {
        next = withIdentity(demographics, {
          sexualOrientation: identity.sexualOrientation.apply
            .sexualOrientation as IdentityFields["sexualOrientation"],
          sexualOrientationOther: identity.sexualOrientation.apply.sexualOrientationOther,
        })
      }
      break
    case "identity.raceEthnicity":
      if (identity.raceEthnicity) {
        next = withIdentity(demographics, { raceEthnicity: identity.raceEthnicity.apply })
      }
      break
    case "identity.religion":
      if (identity.religion) next = withIdentity(demographics, { religion: identity.religion.apply })
      break
    case "identity.primaryLanguage":
      if (identity.primaryLanguage) {
        next = withIdentity(demographics, { primaryLanguage: identity.primaryLanguage.apply })
      }
      break
    case "identity.disability":
      if (identity.disability) {
        next = withIdentity(demographics, {
          disability: identity.disability.apply.value,
          disabilityDetail: identity.disability.apply.detail,
        })
      }
      break
    case "identity.accessibilityNeeds":
      if (identity.accessibilityNeeds) {
        next = withIdentity(demographics, { accessibilityNeeds: identity.accessibilityNeeds.apply })
      }
      break
    case "education.level":
    case "education.fieldOfStudy":
    case "education.currentlyStudying":
    case "education.disruption": {
      const current = demographics.education
      let patch: Partial<Demographics["education"]> | null = null
      if (fieldKey === "education.level" && education.level) patch = { level: education.level.apply }
      if (fieldKey === "education.fieldOfStudy" && education.fieldOfStudy) {
        patch = { fieldOfStudy: education.fieldOfStudy.apply }
      }
      if (fieldKey === "education.currentlyStudying" && education.currentlyStudying) {
        patch = {
          currentlyStudying: education.currentlyStudying.apply.value,
          currentlyStudyingDetail: education.currentlyStudying.apply.detail,
        }
      }
      if (fieldKey === "education.disruption" && education.disruption) {
        patch = {
          disruption: education.disruption.apply.value,
          disruptionDetail: education.disruption.apply.detail,
        }
      }
      if (patch) next = { ...demographics, education: sanitizeEducation({ ...current, ...patch }) }
      break
    }
    case "occupation.workStatus":
    case "occupation.role":
    case "occupation.employer":
    case "occupation.previousJob":
    case "occupation.necessities": {
      const current = demographics.occupation
      let patch: Partial<Demographics["occupation"]> | null = null
      if (fieldKey === "occupation.workStatus" && occupation.workStatus) {
        patch = {
          workStatus: occupation.workStatus.apply.workStatus,
          workStatusOther: occupation.workStatus.apply.workStatusOther,
        }
      }
      if (fieldKey === "occupation.role" && occupation.role) patch = { role: occupation.role.apply }
      if (fieldKey === "occupation.employer" && occupation.employer) {
        patch = { employer: occupation.employer.apply }
      }
      if (fieldKey === "occupation.previousJob" && occupation.previousJob) {
        patch = {
          previousJobs: [
            ...current.previousJobs,
            {
              id: crypto.randomUUID(),
              role: occupation.previousJob.apply.role,
              employer: occupation.previousJob.apply.employer,
              started: "",
              ended: "",
            },
          ],
        }
      }
      if (fieldKey === "occupation.necessities" && occupation.necessities) {
        const necessities = { ...occupation.necessities.apply }
        const anyHard = NECESSITY_KEYS.some((key) => necessities[key])
        patch = {
          necessities,
          ...(anyHard ? { financialConcerns: true as const } : {}),
        }
      }
      if (
        patch &&
        (fieldKey === "occupation.role" || fieldKey === "occupation.employer") &&
        !employedStatus(current.workStatus)
      ) {
        return {
          ok: false,
          error: `The work status on file isn't employed, so the client's ${clientFieldTitle(fieldKey).toLowerCase()} can't be saved. Use the client's work status first, or Keep this.`,
        }
      }
      if (patch) next = { ...demographics, occupation: sanitizeOccupation({ ...current, ...patch }) }
      break
    }
    case "living.housingType":
    case "living.housingStability": {
      const current = demographics.livingSituation
      let patch: Partial<Demographics["livingSituation"]> | null = null
      if (fieldKey === "living.housingType" && living.housingType) {
        patch = { housingType: living.housingType.apply }
      }
      if (fieldKey === "living.housingStability" && living.housingStability) {
        patch = { housingStability: living.housingStability.apply }
      }
      if (patch) {
        next = { ...demographics, livingSituation: sanitizeLivingSituation({ ...current, ...patch }) }
      }
      break
    }
  }

  if (!next) return noAnswer
  if (compareClientField(fieldKey, suggestions, next)?.kind !== "same") {
    return { ok: false, error: "The client's answer couldn't be saved here. Edit this item instead." }
  }
  return { ok: true, demographics: next, section }
}

export function acceptClientChangesButtonLabel(count: number): string {
  if (count === 1) return "Accept 1 client change and confirm"
  return `Accept ${count} client changes and confirm`
}

export function clientChangesPillLabel(count: number): string {
  if (count === 1) return "1 client change"
  return `${count} client changes`
}
