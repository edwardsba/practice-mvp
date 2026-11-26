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
  LIVES_WITH_LABELS,
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
import { todayDateString } from "@/lib/dates/practice-time"

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

/** Section 3 identity facts — omit empty; caller shows "Not recorded" when empty. */
export function formatIdentityFactLines(identity: Demographics["identity"]): string[] {
  const lines: string[] = []
  const sex = line("Sex", identity.sex)
  if (sex) lines.push(sex)
  if (identity.genderDiffersFromSex && identity.genderIdentity.trim()) {
    const gender = line("Gender", identity.genderIdentity)
    if (gender) lines.push(gender)
  }
  const pronouns = line("Pronouns", pronounsText(identity))
  if (pronouns) lines.push(pronouns)
  const orientation = line("Sexual orientation", orientationText(identity))
  if (orientation) lines.push(orientation)
  const culture = line("Cultural or ethnic background", identity.raceEthnicity)
  if (culture) lines.push(culture)
  const religion = line("Religion", identity.religion)
  if (religion) lines.push(religion)
  const language = line("Main language", identity.primaryLanguage)
  if (language) lines.push(language)
  return lines
}

export function formatDisabilityFactLines(identity: Demographics["identity"]): string[] {
  const lines: string[] = []
  const disability = yesNoDetail(identity.disability, identity.disabilityDetail)
  if (disability) lines.push(`Disability: ${disability}`)
  const access = line("Access needs", identity.accessibilityNeeds)
  if (access) lines.push(access)
  return lines
}

export function formatEducationFactLines(education: Demographics["education"]): string[] {
  const lines: string[] = []
  const level = line("Highest level", education.level)
  if (level) lines.push(level)
  const field = line("Field", education.fieldOfStudy)
  if (field) lines.push(field)
  const studying = yesNoDetail(education.currentlyStudying, education.currentlyStudyingDetail)
  if (studying) lines.push(`Currently studying: ${studying}`)
  const disruption = yesNoDetail(education.disruption, education.disruptionDetail)
  if (disruption) lines.push(`Study interrupted: ${disruption}`)
  return lines
}

export function formatOccupationFactLines(occupation: Demographics["occupation"]): string[] {
  const lines: string[] = []
  const status = line("Work status", workStatusText(occupation))
  if (status) lines.push(status)
  const roleBits = [occupation.role.trim(), occupation.employer.trim()].filter(Boolean)
  if (roleBits.length > 0) {
    lines.push(`Role and employer: ${roleBits.join(" · ")}`)
  } else if (occupation.previousJobs[0]) {
    const job = occupation.previousJobs[0]
    const bits = [job.role.trim(), job.employer.trim()].filter(Boolean)
    if (bits.length > 0) lines.push(`Most recent job: ${bits.join(" · ")}`)
  }
  return lines
}

export function formatFinancialFactLines(occupation: Demographics["occupation"]): string[] {
  const lines: string[] = []
  const concerns = yesNoDetail(occupation.financialConcerns, occupation.financialConcernsDetail)
  if (concerns) lines.push(`Financial concerns: ${concerns}`)
  const hard = NECESSITY_KEYS.filter((key) => occupation.necessities[key]).map((key) => NECESSITY_LABELS[key])
  if (hard.length > 0) lines.push(`Hard to afford: ${hard.join(", ")}`)
  return lines
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
  if (!living.livesWith) return "Not recorded"
  if (living.livesWith === "other") {
    return living.livesWithOther.trim() || LIVES_WITH_LABELS.other
  }
  return LIVES_WITH_LABELS[living.livesWith]
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

function personAgeLabel(person: RelationshipRecord, clientDob: string | null): string | null {
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
  if (question.mode === "other_treatment") {
    for (const event of events.filter(
      (item) =>
        item.about === about &&
        (item.eventType === "other_treatment" ||
          item.eventType === "previous_therapy" ||
          item.eventType === "medication" ||
          item.eventType === "psychiatric_admission") &&
        !item.conditionGroupId
    )) {
      const title = event.title.trim() || EVENT_TYPE_LABELS[event.eventType]
      const when = event.startValue.trim()
      lines.push(when ? `${title} (${when})` : title)
    }
  } else if (eventType) {
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
