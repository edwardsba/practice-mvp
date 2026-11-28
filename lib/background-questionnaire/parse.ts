/**
 * Pure parser: shared-form response rows → BackgroundSelfReportV2.
 */

import {
  IN_PERSON_VALUE,
  parseHistoryListEntry,
  parsePersonListEntry,
  type FormListConfig,
  type HistoryListEntry,
  type PersonListEntry,
} from "@/lib/assessments/form-lists"
import { BACKGROUND_SR_ELEMENTS } from "@/lib/assessments/definitions/background-sr"
import {
  CLIENT_RELATIONSHIP_STATUSES,
  EDUCATION_LEVEL_OPTIONS,
  HOUSING_STABILITY_OPTIONS,
  HOUSING_TYPE_OPTIONS,
  NECESSITY_KEYS,
  SEX_OPTIONS,
  WORK_STATUSES,
  type ClientRelationshipStatus,
  type NecessityKey,
  type SexOption,
  type WorkStatus,
} from "@/lib/client-background/types"
import {
  LIVES_WITH_SELF_REPORT_VALUES,
  PARENTS_TOGETHER_VALUES,
  type BackgroundResponseRow,
  type BackgroundSelfReportV2,
  type LivesWithSelfReportValue,
  type ParentsTogetherValue,
  type YesNoInPerson,
} from "@/lib/background-questionnaire/types"

const LIST_CONFIG_BY_KEY = new Map(
  BACKGROUND_SR_ELEMENTS.filter((el) => el.listConfig).map((el) => [
    el.elementKey,
    el.listConfig as FormListConfig,
  ])
)

const KNOWN_KEYS = new Set(BACKGROUND_SR_ELEMENTS.map((el) => el.elementKey))

export type ParseBackgroundSelfReportResult = {
  report: BackgroundSelfReportV2
  /** Element keys present in rows but not part of BACKGROUND_SR v2. */
  droppedUnknownKeys: string[]
  /** Values dropped as blank, invalid, or unparseable. */
  droppedValues: Array<{ elementKey: string; responseValue: string; reason: string }>
}

export function emptyBackgroundSelfReportV2(): BackgroundSelfReportV2 {
  return {
    version: 2,
    sex: null,
    genderDiffers: null,
    genderIdentity: "",
    pronouns: "",
    culturalBackground: "",
    religion: "",
    language: "",
    disability: null,
    disabilityDetail: "",
    accessNeeds: "",
    educationLevel: null,
    fieldOfStudy: "",
    currentlyStudying: null,
    studyingDetail: "",
    studyInterrupted: null,
    interruptedDetail: "",
    workStatus: null,
    jobRole: "",
    employer: "",
    recentJob: "",
    workOther: "",
    hardToAfford: [],
    relationshipStatus: null,
    partner: [],
    children: [],
    previousRelationships: [],
    parents: [],
    parentsTogether: null,
    siblings: [],
    livesWith: [],
    livesWithOthers: "",
    housingType: null,
    housingSecurity: null,
    histPhysical: null,
    histPhysicalList: [],
    histSubstance: null,
    histMental: null,
    histMentalList: [],
    histSelfharm: null,
    histTrauma: null,
    famMental: null,
    famSubstance: null,
  }
}

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value)
}

function asTrimmed(value: string): string {
  return value.trim()
}

function parseYesNoInPerson(
  raw: string,
  dropped: ParseBackgroundSelfReportResult["droppedValues"],
  elementKey: string
): YesNoInPerson | null {
  const value = asTrimmed(raw)
  if (!value) {
    dropped.push({ elementKey, responseValue: raw, reason: "blank" })
    return null
  }
  if (value === "yes" || value === "no" || value === IN_PERSON_VALUE) return value
  dropped.push({ elementKey, responseValue: raw, reason: "invalid_yes_no" })
  return null
}

function parseSingleChoice<T extends string>(
  raw: string,
  allowed: readonly T[],
  dropped: ParseBackgroundSelfReportResult["droppedValues"],
  elementKey: string
): T | null {
  const value = asTrimmed(raw)
  if (!value) {
    dropped.push({ elementKey, responseValue: raw, reason: "blank" })
    return null
  }
  if (isOneOf(value, allowed)) return value
  dropped.push({ elementKey, responseValue: raw, reason: "invalid_choice" })
  return null
}

function parseText(
  raw: string,
  dropped: ParseBackgroundSelfReportResult["droppedValues"],
  elementKey: string
): string {
  const value = asTrimmed(raw)
  if (!value) {
    dropped.push({ elementKey, responseValue: raw, reason: "blank" })
    return ""
  }
  return value
}

function valuesForKey(rows: BackgroundResponseRow[], elementKey: string): string[] {
  return rows
    .filter((row) => row.elementKey === elementKey)
    .sort((a, b) => (a.responseOrder ?? 0) - (b.responseOrder ?? 0))
    .map((row) => row.responseValue)
}

function parsePersonList(
  values: string[],
  elementKey: string,
  dropped: ParseBackgroundSelfReportResult["droppedValues"]
): PersonListEntry[] {
  const config = LIST_CONFIG_BY_KEY.get(elementKey)
  const out: PersonListEntry[] = []
  for (const raw of values) {
    if (typeof raw !== "string" || !raw.trim()) {
      dropped.push({ elementKey, responseValue: raw ?? "", reason: "blank_list_entry" })
      continue
    }
    const entry = parsePersonListEntry(raw, config)
    if (!entry) {
      dropped.push({ elementKey, responseValue: raw, reason: "invalid_person_list" })
      continue
    }
    out.push(entry)
  }
  return out
}

function parseHistoryList(
  values: string[],
  elementKey: string,
  dropped: ParseBackgroundSelfReportResult["droppedValues"]
): HistoryListEntry[] {
  const out: HistoryListEntry[] = []
  for (const raw of values) {
    if (typeof raw !== "string" || !raw.trim()) {
      dropped.push({ elementKey, responseValue: raw ?? "", reason: "blank_list_entry" })
      continue
    }
    const entry = parseHistoryListEntry(raw)
    if (!entry) {
      dropped.push({ elementKey, responseValue: raw, reason: "invalid_history_list" })
      continue
    }
    out.push(entry)
  }
  return out
}

function firstOrNull(values: string[]): string | null {
  return values.length > 0 ? values[0]! : null
}

/**
 * Parse stored assessment response rows into a typed v2 self-report.
 * Unknown keys and bad values are dropped (listed in the result).
 */
export function parseBackgroundSelfReport(
  rows: readonly BackgroundResponseRow[]
): ParseBackgroundSelfReportResult {
  const droppedUnknownKeys: string[] = []
  const droppedValues: ParseBackgroundSelfReportResult["droppedValues"] = []
  const seenUnknown = new Set<string>()

  for (const row of rows) {
    if (!KNOWN_KEYS.has(row.elementKey) && !seenUnknown.has(row.elementKey)) {
      seenUnknown.add(row.elementKey)
      droppedUnknownKeys.push(row.elementKey)
    }
  }

  const report = emptyBackgroundSelfReportV2()
  const list = [...rows]

  const sexRaw = firstOrNull(valuesForKey(list, "sex"))
  if (sexRaw != null) {
    report.sex = parseSingleChoice(sexRaw, SEX_OPTIONS as readonly SexOption[], droppedValues, "sex")
  }

  const genderDiffersRaw = firstOrNull(valuesForKey(list, "gender_differs"))
  if (genderDiffersRaw != null) {
    report.genderDiffers = parseYesNoInPerson(genderDiffersRaw, droppedValues, "gender_differs")
  }
  for (const raw of valuesForKey(list, "gender_identity")) {
    const text = parseText(raw, droppedValues, "gender_identity")
    if (text) report.genderIdentity = text
  }
  for (const raw of valuesForKey(list, "pronouns")) {
    const text = parseText(raw, droppedValues, "pronouns")
    if (text) report.pronouns = text
  }
  for (const raw of valuesForKey(list, "cultural_background")) {
    const text = parseText(raw, droppedValues, "cultural_background")
    if (text) report.culturalBackground = text
  }
  for (const raw of valuesForKey(list, "religion")) {
    const text = parseText(raw, droppedValues, "religion")
    if (text) report.religion = text
  }
  for (const raw of valuesForKey(list, "language")) {
    const text = parseText(raw, droppedValues, "language")
    if (text) report.language = text
  }

  const disabilityRaw = firstOrNull(valuesForKey(list, "disability"))
  if (disabilityRaw != null) {
    report.disability = parseYesNoInPerson(disabilityRaw, droppedValues, "disability")
  }
  for (const raw of valuesForKey(list, "disability_detail")) {
    const text = parseText(raw, droppedValues, "disability_detail")
    if (text) report.disabilityDetail = text
  }
  for (const raw of valuesForKey(list, "access_needs")) {
    const text = parseText(raw, droppedValues, "access_needs")
    if (text) report.accessNeeds = text
  }

  const educationRaw = firstOrNull(valuesForKey(list, "education_level"))
  if (educationRaw != null) {
    report.educationLevel = parseSingleChoice(
      educationRaw,
      EDUCATION_LEVEL_OPTIONS as readonly string[],
      droppedValues,
      "education_level"
    )
  }
  for (const raw of valuesForKey(list, "field_of_study")) {
    const text = parseText(raw, droppedValues, "field_of_study")
    if (text) report.fieldOfStudy = text
  }

  const studyingRaw = firstOrNull(valuesForKey(list, "currently_studying"))
  if (studyingRaw != null) {
    report.currentlyStudying = parseYesNoInPerson(studyingRaw, droppedValues, "currently_studying")
  }
  for (const raw of valuesForKey(list, "studying_detail")) {
    const text = parseText(raw, droppedValues, "studying_detail")
    if (text) report.studyingDetail = text
  }

  const interruptedRaw = firstOrNull(valuesForKey(list, "study_interrupted"))
  if (interruptedRaw != null) {
    report.studyInterrupted = parseYesNoInPerson(interruptedRaw, droppedValues, "study_interrupted")
  }
  for (const raw of valuesForKey(list, "interrupted_detail")) {
    const text = parseText(raw, droppedValues, "interrupted_detail")
    if (text) report.interruptedDetail = text
  }

  const workRaw = firstOrNull(valuesForKey(list, "work_status"))
  if (workRaw != null) {
    report.workStatus = parseSingleChoice(
      workRaw,
      WORK_STATUSES as readonly WorkStatus[],
      droppedValues,
      "work_status"
    )
  }
  for (const raw of valuesForKey(list, "job_role")) {
    const text = parseText(raw, droppedValues, "job_role")
    if (text) report.jobRole = text
  }
  for (const raw of valuesForKey(list, "employer")) {
    const text = parseText(raw, droppedValues, "employer")
    if (text) report.employer = text
  }
  for (const raw of valuesForKey(list, "recent_job")) {
    const text = parseText(raw, droppedValues, "recent_job")
    if (text) report.recentJob = text
  }
  for (const raw of valuesForKey(list, "work_other")) {
    const text = parseText(raw, droppedValues, "work_other")
    if (text) report.workOther = text
  }

  const hard: NecessityKey[] = []
  const hardSeen = new Set<NecessityKey>()
  for (const raw of valuesForKey(list, "hard_to_afford")) {
    const value = asTrimmed(raw)
    if (!value) {
      droppedValues.push({ elementKey: "hard_to_afford", responseValue: raw, reason: "blank" })
      continue
    }
    if (isOneOf(value, NECESSITY_KEYS)) {
      if (!hardSeen.has(value)) {
        hardSeen.add(value)
        hard.push(value)
      }
      continue
    }
    droppedValues.push({
      elementKey: "hard_to_afford",
      responseValue: raw,
      reason: "invalid_choice",
    })
  }
  report.hardToAfford = NECESSITY_KEYS.filter((key) => hardSeen.has(key))

  const relRaw = firstOrNull(valuesForKey(list, "relationship_status"))
  if (relRaw != null) {
    report.relationshipStatus = parseSingleChoice(
      relRaw,
      CLIENT_RELATIONSHIP_STATUSES as readonly ClientRelationshipStatus[],
      droppedValues,
      "relationship_status"
    )
  }
  report.partner = parsePersonList(valuesForKey(list, "partner"), "partner", droppedValues)
  report.children = parsePersonList(valuesForKey(list, "children"), "children", droppedValues)
  report.previousRelationships = parsePersonList(
    valuesForKey(list, "previous_relationships"),
    "previous_relationships",
    droppedValues
  )

  report.parents = parsePersonList(valuesForKey(list, "parents"), "parents", droppedValues)
  const parentsTogetherRaw = firstOrNull(valuesForKey(list, "parents_together"))
  if (parentsTogetherRaw != null) {
    report.parentsTogether = parseSingleChoice(
      parentsTogetherRaw,
      PARENTS_TOGETHER_VALUES as readonly ParentsTogetherValue[],
      droppedValues,
      "parents_together"
    )
  }
  report.siblings = parsePersonList(valuesForKey(list, "siblings"), "siblings", droppedValues)

  const lives: LivesWithSelfReportValue[] = []
  const livesSeen = new Set<LivesWithSelfReportValue>()
  for (const raw of valuesForKey(list, "lives_with")) {
    const value = asTrimmed(raw)
    if (!value) {
      droppedValues.push({ elementKey: "lives_with", responseValue: raw, reason: "blank" })
      continue
    }
    if (isOneOf(value, LIVES_WITH_SELF_REPORT_VALUES)) {
      if (!livesSeen.has(value)) {
        livesSeen.add(value)
        lives.push(value)
      }
      continue
    }
    droppedValues.push({ elementKey: "lives_with", responseValue: raw, reason: "invalid_choice" })
  }
  report.livesWith = LIVES_WITH_SELF_REPORT_VALUES.filter((key) => livesSeen.has(key))

  for (const raw of valuesForKey(list, "lives_with_others")) {
    const text = parseText(raw, droppedValues, "lives_with_others")
    if (text) report.livesWithOthers = text
  }

  const housingTypeRaw = firstOrNull(valuesForKey(list, "housing_type"))
  if (housingTypeRaw != null) {
    report.housingType = parseSingleChoice(
      housingTypeRaw,
      HOUSING_TYPE_OPTIONS as readonly string[],
      droppedValues,
      "housing_type"
    )
  }
  const housingSecurityRaw = firstOrNull(valuesForKey(list, "housing_security"))
  if (housingSecurityRaw != null) {
    report.housingSecurity = parseSingleChoice(
      housingSecurityRaw,
      HOUSING_STABILITY_OPTIONS as readonly string[],
      droppedValues,
      "housing_security"
    )
  }

  const histPhysicalRaw = firstOrNull(valuesForKey(list, "hist_physical"))
  if (histPhysicalRaw != null) {
    report.histPhysical = parseYesNoInPerson(histPhysicalRaw, droppedValues, "hist_physical")
  }
  report.histPhysicalList = parseHistoryList(
    valuesForKey(list, "hist_physical_list"),
    "hist_physical_list",
    droppedValues
  )

  const histSubstanceRaw = firstOrNull(valuesForKey(list, "hist_substance"))
  if (histSubstanceRaw != null) {
    report.histSubstance = parseYesNoInPerson(histSubstanceRaw, droppedValues, "hist_substance")
  }

  const histMentalRaw = firstOrNull(valuesForKey(list, "hist_mental"))
  if (histMentalRaw != null) {
    report.histMental = parseYesNoInPerson(histMentalRaw, droppedValues, "hist_mental")
  }
  report.histMentalList = parseHistoryList(
    valuesForKey(list, "hist_mental_list"),
    "hist_mental_list",
    droppedValues
  )

  const histSelfharmRaw = firstOrNull(valuesForKey(list, "hist_selfharm"))
  if (histSelfharmRaw != null) {
    report.histSelfharm = parseYesNoInPerson(histSelfharmRaw, droppedValues, "hist_selfharm")
  }

  const histTraumaRaw = firstOrNull(valuesForKey(list, "hist_trauma"))
  if (histTraumaRaw != null) {
    report.histTrauma = parseYesNoInPerson(histTraumaRaw, droppedValues, "hist_trauma")
  }

  const famMentalRaw = firstOrNull(valuesForKey(list, "fam_mental"))
  if (famMentalRaw != null) {
    report.famMental = parseYesNoInPerson(famMentalRaw, droppedValues, "fam_mental")
  }
  const famSubstanceRaw = firstOrNull(valuesForKey(list, "fam_substance"))
  if (famSubstanceRaw != null) {
    report.famSubstance = parseYesNoInPerson(famSubstanceRaw, droppedValues, "fam_substance")
  }

  return { report, droppedUnknownKeys, droppedValues }
}

/** True when the rows look like a v2 shared-form submission (any known key present). */
export function hasBackgroundSelfReportV2Rows(rows: readonly BackgroundResponseRow[]): boolean {
  return rows.some((row) => KNOWN_KEYS.has(row.elementKey))
}
