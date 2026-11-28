/**
 * Read-only fact lines for Background interview item rows.
 * Pure — no database.
 */

import { displayedAge, assessAge } from "@/lib/client-background/age"
import { HISTORY_QUESTIONS, type HistoryQuestionKey } from "@/lib/client-background/interview-history"
import { parsePartialDate } from "@/lib/client-background/partial-date"
import {
  CLIENT_RELATIONSHIP_STATUS_LABELS,
  CONDITION_CATEGORY_LABELS,
  EVENT_TYPE_LABELS,
  HOUSEHOLD_LABELS,
  NECESSITY_KEYS,
  NECESSITY_LABELS,
  SEXUAL_ORIENTATION_LABELS,
  WORK_STATUS_LABELS,
  type ClientRelationshipStatusValue,
  type Demographics,
  type EventRecord,
  type HistoryIssue,
  type LivingSituationFields,
  type RelationshipBlock,
  type RelationshipRecord,
} from "@/lib/client-background/types"
import {
  dependantTickFromDependency,
  householdPeopleFromRelationships,
  livingChoiceFromSituation,
  livingChoiceLabel,
  personLivesWithClient,
} from "@/lib/client-background/household"
import { todayDateString } from "@/lib/dates/practice-time"
import type { ClientFieldKey } from "@/lib/client-background/interview-client-fields"

/** One line of an interview row's on-file value, with the self-report fields it shows. */
export type InterviewValueLine = {
  text: string
  fields: readonly ClientFieldKey[]
  /**
   * False when the line doesn't show exactly what the client was asked (e.g. "Most recent job"
   * shows the first job on file), so a matching client answer must not stand in for it.
   */
  exact?: boolean
}

function tagged(text: string | null, fields: readonly ClientFieldKey[] = [], exact = true): InterviewValueLine[] {
  if (!text) return []
  return exact ? [{ text, fields }] : [{ text, fields, exact: false }]
}

function texts(lines: readonly InterviewValueLine[]): string[] {
  return lines.map((entry) => entry.text)
}

function householdPersonRole(person: RelationshipRecord): string {
  if (person.blockRole === "partner") return "partner"
  if (person.blockRole === "child") {
    return person.blockRoleType === "step_child" ? "step-child" : "child"
  }
  if (person.blockRole === "parent") {
    if (person.blockRoleType === "mother") return "mother"
    if (person.blockRoleType === "father") return "father"
    return "parent"
  }
  if (person.blockRole === "caregiver") return "caregiver"
  if (person.blockRole === "sibling") return "sibling"
  return "person"
}

function line(label: string, value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return `${label}: ${trimmed}`
}

function yesNoDetail(flag: boolean | null, detail: string): string | null {
  if (flag === null) return null
  if (!flag) return "No"
  const extra = detail.trim()
  return extra ? `Yes — ${extra}` : "Yes"
}

function orientationText(identity: Demographics["identity"]): string {
  if (!identity.sexualOrientation) return ""
  if (identity.sexualOrientation === "another") {
    return identity.sexualOrientationOther.trim() || SEXUAL_ORIENTATION_LABELS.another
  }
  return SEXUAL_ORIENTATION_LABELS[identity.sexualOrientation]
}

function pronounsText(identity: Demographics["identity"]): string {
  if (identity.pronouns === "Other") {
    return identity.pronounsOther.trim() || "Other"
  }
  return identity.pronouns.trim()
}

function workStatusText(occupation: Demographics["occupation"]): string {
  if (!occupation.workStatus) return ""
  if (occupation.workStatus === "other") {
    return occupation.workStatusOther.trim() || WORK_STATUS_LABELS.other
  }
  return WORK_STATUS_LABELS[occupation.workStatus]
}

export function identityValueLines(identity: Demographics["identity"]): InterviewValueLine[] {
  return [
    ...tagged(line("Sex", identity.sex), ["identity.sex"]),
    ...(identity.genderDiffersFromSex && identity.genderIdentity.trim()
      ? tagged(line("Gender", identity.genderIdentity), ["identity.genderIdentity"])
      : []),
    ...tagged(line("Pronouns", pronounsText(identity)), ["identity.pronouns"]),
    ...tagged(line("Sexual orientation", orientationText(identity)), ["identity.sexualOrientation"]),
    ...tagged(line("Cultural or ethnic background", identity.raceEthnicity), ["identity.raceEthnicity"]),
    ...tagged(line("Religion", identity.religion), ["identity.religion"]),
    ...tagged(line("Main language", identity.primaryLanguage), ["identity.primaryLanguage"]),
  ]
}

/** Section 3 identity facts — omit empty; caller shows "Not recorded" when empty. */
export function formatIdentityFactLines(identity: Demographics["identity"]): string[] {
  return texts(identityValueLines(identity))
}

export function disabilityValueLines(identity: Demographics["identity"]): InterviewValueLine[] {
  const disability = yesNoDetail(identity.disability, identity.disabilityDetail)
  return [
    ...tagged(disability ? `Disability: ${disability}` : null, ["identity.disability"]),
    ...tagged(line("Access needs", identity.accessibilityNeeds)),
  ]
}

export function formatDisabilityFactLines(identity: Demographics["identity"]): string[] {
  return texts(disabilityValueLines(identity))
}

export function educationValueLines(education: Demographics["education"]): InterviewValueLine[] {
  const studying = yesNoDetail(education.currentlyStudying, education.currentlyStudyingDetail)
  const disruption = yesNoDetail(education.disruption, education.disruptionDetail)
  return [
    ...tagged(line("Highest level", education.level), ["education.level"]),
    ...tagged(line("Field", education.fieldOfStudy), ["education.fieldOfStudy"]),
    ...tagged(studying ? `Currently studying: ${studying}` : null, ["education.currentlyStudying"]),
    ...tagged(disruption ? `Study interrupted: ${disruption}` : null, ["education.disruption"]),
  ]
}

export function formatEducationFactLines(education: Demographics["education"]): string[] {
  return texts(educationValueLines(education))
}

function jobText(job: { role: string; employer: string }): string {
  return [job.role.trim(), job.employer.trim()].filter(Boolean).join(" · ")
}

export function occupationValueLines(occupation: Demographics["occupation"]): InterviewValueLine[] {
  const lines = tagged(line("Work status", workStatusText(occupation)), ["occupation.workStatus"])
  const roleAndEmployer = jobText(occupation)
  if (roleAndEmployer) {
    lines.push(...tagged(`Role and employer: ${roleAndEmployer}`, ["occupation.role", "occupation.employer"]))
  } else if (occupation.previousJobs[0]) {
    const recent = jobText(occupation.previousJobs[0])
    lines.push(...tagged(recent ? `Most recent job: ${recent}` : null, ["occupation.previousJob"], false))
  }
  return lines
}

export function formatOccupationFactLines(occupation: Demographics["occupation"]): string[] {
  return texts(occupationValueLines(occupation))
}

export function financialValueLines(occupation: Demographics["occupation"]): InterviewValueLine[] {
  const concerns = yesNoDetail(occupation.financialConcerns, occupation.financialConcernsDetail)
  const hard = NECESSITY_KEYS.filter((key) => occupation.necessities[key]).map((key) => NECESSITY_LABELS[key])
  return [
    ...tagged(concerns ? `Financial concerns: ${concerns}` : null),
    ...tagged(hard.length > 0 ? `Hard to afford: ${hard.join(", ")}` : null, ["occupation.necessities"]),
  ]
}

export function formatFinancialFactLines(occupation: Demographics["occupation"]): string[] {
  return texts(financialValueLines(occupation))
}

/** Section 3 item → value lines (same text as {@link formatSection3FactLines}). */
export function section3ValueLines(demographics: Demographics): Record<string, InterviewValueLine[]> {
  return {
    s3_identity: identityValueLines(demographics.identity),
    s3_disability: disabilityValueLines(demographics.identity),
    s3_education: educationValueLines(demographics.education),
    s3_occupation: occupationValueLines(demographics.occupation),
    s3_financial: financialValueLines(demographics.occupation),
  }
}

/**
 * The on-file side of a Use client's / Keep pair, worded like its fact line
 * ("Pronouns: she/her"). Empty when nothing is on file for that field.
 */
export function clientFieldFileText(fieldKey: ClientFieldKey, demographics: Demographics): string {
  const { identity, education, occupation, livingSituation } = demographics
  const only = (lines: InterviewValueLine[]) =>
    lines.find((entry) => entry.exact !== false && entry.fields.length === 1 && entry.fields[0] === fieldKey)
      ?.text ?? ""
  switch (fieldKey) {
    case "identity.genderIdentity":
      return line("Gender", identity.genderIdentity) ?? ""
    case "identity.sex":
    case "identity.pronouns":
    case "identity.sexualOrientation":
    case "identity.raceEthnicity":
    case "identity.religion":
    case "identity.primaryLanguage":
      return only(identityValueLines(identity))
    case "identity.disability":
      return only(disabilityValueLines(identity))
    case "education.level":
    case "education.fieldOfStudy":
    case "education.currentlyStudying":
    case "education.disruption":
      return only(educationValueLines(education))
    case "occupation.workStatus":
      return only(occupationValueLines(occupation))
    case "occupation.role":
      return line("Role", occupation.role) ?? ""
    case "occupation.employer":
      return line("Employer", occupation.employer) ?? ""
    case "occupation.previousJob": {
      const jobs = occupation.previousJobs.map(jobText).filter(Boolean)
      return jobs.length > 0 ? `Previous jobs: ${jobs.join("; ")}` : ""
    }
    case "occupation.necessities":
      return only(financialValueLines(occupation))
    case "living.livesWith":
      return formatLivingWhoLine(livingSituation)
    case "living.housingType":
      return livingSituation.housingType.trim()
    case "living.housingStability":
      return livingSituation.housingStability.trim()
  }
}

/** All section-3 item → fact lines from a demographics record. */
export function formatSection3FactLines(demographics: Demographics): Record<string, string[]> {
  return {
    s3_identity: formatIdentityFactLines(demographics.identity),
    s3_disability: formatDisabilityFactLines(demographics.identity),
    s3_education: formatEducationFactLines(demographics.education),
    s3_occupation: formatOccupationFactLines(demographics.occupation),
    s3_financial: formatFinancialFactLines(demographics.occupation),
  }
}

export function formatLivingWhoLine(living: LivingSituationFields): string {
  if (living.household) return HOUSEHOLD_LABELS[living.household]
  return ""
}

/** One line per person in the home: people from sections 5–6, then others in the home. */
export function formatLivingMemberLines(
  living: LivingSituationFields,
  relationships: RelationshipRecord[]
): string[] {
  const lines: string[] = []
  for (const person of householdPeopleFromRelationships(relationships).filter(personLivesWithClient)) {
    const name = person.givenName.trim() || "Unnamed"
    const role = householdPersonRole(person)
    const choice = livingChoiceFromSituation(person.livingSituation)
    const livingBit = choice ? livingChoiceLabel(choice) : ""
    const dependant = dependantTickFromDependency(person.dependency) ? "yes" : "no"
    const mid = livingBit ? `${livingBit} · ` : ""
    lines.push(`${name} (${role}), ${mid}dependant: ${dependant}`)
  }
  for (const other of living.othersInHome ?? []) {
    const who = other.who.trim()
    if (!who) continue
    lines.push(`${who} · dependant: ${other.dependant ? "yes" : "no"}`)
  }
  return lines
}

/** Fact lines for interview s7_who — household label, then people, then others. */
export function formatLivingWhoFactLines(
  living: LivingSituationFields,
  relationships: RelationshipRecord[]
): string[] {
  const label = formatLivingWhoLine(living)
  return [...(label ? [label] : []), ...formatLivingMemberLines(living, relationships)]
}

/** Section 7 value lines: the household row, housing type and housing security. */
export function section7ValueLines(living: LivingSituationFields): Record<string, InterviewValueLine[]> {
  return {
    s7_who: tagged(formatLivingWhoLine(living) || null, ["living.livesWith"]),
    s7_housing_type: tagged(living.housingType.trim() || null, ["living.housingType"]),
    s7_housing_security: tagged(living.housingStability.trim() || null, ["living.housingStability"]),
  }
}

export function formatLivingTypeLine(living: LivingSituationFields): string {
  return living.housingType.trim() || "Not recorded"
}

export function formatLivingSecurityLine(living: LivingSituationFields): string {
  return living.housingStability.trim() || "Not recorded"
}

function personName(person: RelationshipRecord): string {
  return person.givenName.trim() || "Unnamed"
}

function personAgeLabel(person: RelationshipRecord, _clientDob: string | null): string | null {
  if (!person.dateOfBirth.trim()) return null
  const age = displayedAge(
    assessAge(parsePartialDate(person.dateOfBirth), parsePartialDate(todayDateString()), "person")
  )
  return age || null
}

function membersOf(
  block: RelationshipBlock,
  people: RelationshipRecord[],
  role: RelationshipRecord["blockRole"]
): RelationshipRecord[] {
  return people.filter(
    (person) => person.relationshipBlockId === block.relationshipBlockId && person.blockRole === role
  )
}

function statusLabel(status: string, detail: string): string {
  const known =
    status in CLIENT_RELATIONSHIP_STATUS_LABELS
      ? CLIENT_RELATIONSHIP_STATUS_LABELS[status as keyof typeof CLIENT_RELATIONSHIP_STATUS_LABELS]
      : status
  const base = known || detail.trim()
  if (status === "other" && detail.trim()) return detail.trim()
  if (base && detail.trim() && status === "other") return detail.trim()
  return base
}

/** Short list lines for relationship / history items answered Yes. */
export function formatCurrentRelationshipFacts(
  status: ClientRelationshipStatusValue,
  blocks: RelationshipBlock[],
  people: RelationshipRecord[]
): string[] {
  const current = blocks.filter((block) => block.kind === "client_current")
  const lines: string[] = []
  for (const block of current) {
    const partners = membersOf(block, people, "partner")
    const since = block.startedOn.trim()
    const st =
      statusLabel(block.status, block.statusDetail) ||
      (status.relationshipStatus
        ? status.relationshipStatus === "other"
          ? status.relationshipStatusOther.trim() || CLIENT_RELATIONSHIP_STATUS_LABELS.other
          : CLIENT_RELATIONSHIP_STATUS_LABELS[status.relationshipStatus]
        : "")
    for (const partner of partners) {
      const bits = [personName(partner)]
      if (st) bits.push(st)
      if (since) bits.push(`since ${since}`)
      lines.push(bits.join(", "))
    }
    if (partners.length === 0) {
      const bits = [st, since ? `since ${since}` : ""].filter(Boolean)
      if (bits.length > 0) lines.push(bits.join(", "))
    }
  }
  if (lines.length === 0 && status.relationshipStatus) {
    const label =
      status.relationshipStatus === "other"
        ? status.relationshipStatusOther.trim() || CLIENT_RELATIONSHIP_STATUS_LABELS.other
        : CLIENT_RELATIONSHIP_STATUS_LABELS[status.relationshipStatus]
    if (label) lines.push(label)
  }
  return lines
}

export function formatPreviousRelationshipFacts(
  blocks: RelationshipBlock[],
  people: RelationshipRecord[]
): string[] {
  const lines: string[] = []
  for (const block of blocks.filter((item) => item.kind === "client_previous")) {
    const partners = membersOf(block, people, "partner")
    const st = statusLabel(block.status, block.statusDetail)
    const range = [block.startedOn.trim(), block.endedOn.trim()].filter(Boolean).join("–")
    if (partners.length === 0) {
      lines.push([st, range].filter(Boolean).join(", ") || "Previous relationship")
      continue
    }
    for (const partner of partners) {
      lines.push([personName(partner), st, range].filter(Boolean).join(", "))
    }
  }
  return lines
}

export function formatChildrenFacts(
  blocks: RelationshipBlock[],
  people: RelationshipRecord[],
  clientDob: string | null
): string[] {
  const childBlocks = blocks.filter(
    (block) =>
      block.kind === "client_current" ||
      block.kind === "client_previous" ||
      block.kind === "client_other_children"
  )
  const lines: string[] = []
  for (const block of childBlocks) {
    for (const child of membersOf(block, people, "child")) {
      const age = personAgeLabel(child, clientDob)
      lines.push(age ? `${personName(child)} (${age})` : personName(child))
    }
  }
  return lines
}

export function formatBiologicalParentsFacts(
  blocks: RelationshipBlock[],
  people: RelationshipRecord[]
): string[] {
  const block = blocks.find((item) => item.kind === "biological_parents")
  if (!block) return []
  return membersOf(block, people, "parent").map((person) => {
    const side =
      person.blockRoleType === "mother"
        ? "Mother"
        : person.blockRoleType === "father"
          ? "Father"
          : "Parent"
    return person.notKnown ? `${side}: not known` : `${side}: ${personName(person)}`
  })
}

export function formatParentOtherFacts(
  side: "mother" | "father",
  blocks: RelationshipBlock[],
  people: RelationshipRecord[]
): string[] {
  const lines: string[] = []
  for (const block of blocks.filter(
    (item) => item.kind === "parent_other" && item.parentSide === side
  )) {
    const partners = membersOf(block, people, "partner")
    const st = statusLabel(block.status, block.statusDetail)
    if (partners.length === 0) {
      lines.push(st || "Other relationship")
      continue
    }
    for (const partner of partners) {
      lines.push([personName(partner), st].filter(Boolean).join(", "))
    }
  }
  return lines
}

export function formatCaregiverFacts(blocks: RelationshipBlock[], people: RelationshipRecord[]): string[] {
  const lines: string[] = []
  for (const block of blocks.filter((item) => item.kind === "caregiver_arrangement")) {
    const carers = membersOf(block, people, "caregiver")
    const label = block.arrangementType || block.arrangementDetail.trim() || "Arrangement"
    if (carers.length === 0) {
      lines.push(label)
      continue
    }
    for (const carer of carers) {
      lines.push(`${personName(carer)} · ${label}`)
    }
  }
  return lines
}

export function formatSiblingFacts(blocks: RelationshipBlock[], people: RelationshipRecord[]): string[] {
  const lines: string[] = []
  for (const block of blocks) {
    for (const sibling of membersOf(block, people, "sibling")) {
      lines.push(personName(sibling))
    }
  }
  return lines
}

export function formatHistoryCategoryFacts(
  key: HistoryQuestionKey,
  issues: HistoryIssue[],
  events: EventRecord[],
  about: "self" | "significant_other"
): string[] {
  const question = HISTORY_QUESTIONS[key]
  if (!question) return []
  const eventType = question.eventType
  const lines: string[] = []
  if (eventType && eventType in CONDITION_CATEGORY_LABELS) {
    const categoryIssues = issues.filter(
      (issue) => issue.about === about && issue.category === eventType
    )
    for (const issue of categoryIssues) {
      const related = events.filter((event) => event.conditionGroupId === issue.issueId)
      const episodes = related.filter((event) => event.eventType === issue.category)
      const treatments = related.filter(
        (event) =>
          event.eventType === "previous_therapy" ||
          event.eventType === "medication" ||
          event.eventType === "psychiatric_admission" ||
          event.eventType === "other_treatment"
      )
      const bits = [
        issue.title.trim() || CONDITION_CATEGORY_LABELS[issue.category] || EVENT_TYPE_LABELS[issue.category],
      ]
      if (episodes.length > 0) {
        bits.push(`${episodes.length} episode${episodes.length === 1 ? "" : "s"}`)
      }
      for (const treatment of treatments.slice(0, 3)) {
        const title = treatment.title.trim() || EVENT_TYPE_LABELS[treatment.eventType]
        const when = treatment.startValue.trim()
        bits.push(when ? `${title} ${when}` : title)
      }
      lines.push(bits.join(", "))
    }
  }
  if (eventType) {
    for (const event of events.filter(
      (item) => item.about === about && !item.conditionGroupId && item.eventType === eventType
    )) {
      const title = event.title.trim() || EVENT_TYPE_LABELS[event.eventType]
      const when = event.startValue.trim()
      lines.push(when ? `${title} (${when})` : title)
    }
  }
  return lines
}

export function factLinesOrFallback(lines: string[], emptyLabel: string): string[] {
  return lines.length > 0 ? lines : [emptyLabel]
}
