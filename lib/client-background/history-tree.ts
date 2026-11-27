import { clientAgeAtStart, compareEventsChronologically } from "@/lib/client-background/age"
import {
  comparePartialStarts,
  issueNeedsWho,
  issueTitle,
  issuesForCategory,
  mixedIssueEvents,
  resolveHistoryIssues,
  subEventsFor,
} from "@/lib/client-background/history-issues"
import {
  isConditionEvent,
  isNestedHistoryEvent,
  isOtherEvent,
  isTreatmentEvent,
} from "@/lib/client-background/history-links"
import {
  HISTORY_QUESTION_GROUPS,
  HISTORY_QUESTIONS,
  resolvedAbout,
  type HistoryQuestionKey,
  type ScreeningAnswers,
} from "@/lib/client-background/interview-history"
import { professionalSummary, type ProfessionalOption } from "@/lib/client-background/professionals"
import {
  ADMISSION_TYPE_LABELS,
  EVENT_TYPE_LABELS,
  type EventRecord,
  type EventType,
  type HistoryIssue,
  type RelationshipRecord,
  type StartPrecision,
  type TreatmentAnswer,
} from "@/lib/client-background/types"

export type HistoryTreeNode =
  | { kind: "section"; title: string; screeningKey?: string; children: HistoryTreeNode[] }
  | {
      kind: "band"
      id: string
      heading: string
      meta: string
      treatmentAnswer?: TreatmentAnswer | ""
      needsWho?: boolean
      children: HistoryTreeNode[]
    }
  | {
      kind: "row"
      id: string
      line: string
      tag?: "Episode" | "Treatment" | "Other" | "Step"
      children: HistoryTreeNode[]
    }
  | { kind: "note"; text: string }
  | {
      kind: "actions"
      issueId?: string
      /** Parent single-event id when adding under self-harm / traumatic / significant. */
      parentEventId?: string
      about: "self" | "significant_other"
      category?: EventType
    }

export type HistoryTreeCard = { title: string; children: HistoryTreeNode[] }

export type HistoryTree = { client: HistoryTreeCard; family: HistoryTreeCard }

type Input = {
  events: EventRecord[]
  relationships: RelationshipRecord[]
  dateOfBirth: string | null
  screening: ScreeningAnswers
  professionals?: ProfessionalOption[]
  issues?: HistoryIssue[]
  /** When true, include "+ Add event" action nodes (interview). */
  interactive?: boolean
}

type HistorySectionDef = {
  title: string
  screening: HistoryQuestionKey
  eventType: EventType
  mode: "condition" | "event"
}

function sectionsFromGroup(groupIndex: 0 | 1): HistorySectionDef[] {
  return HISTORY_QUESTION_GROUPS[groupIndex].keys.map((key) => {
    const question = HISTORY_QUESTIONS[key]
    if (!question.eventType) {
      throw new Error(`History question ${key} has no event type`)
    }
    return {
      title: question.label,
      screening: key,
      eventType: question.eventType,
      mode: question.mode,
    }
  })
}

const CLIENT_SECTIONS = sectionsFromGroup(0)
const FAMILY_SECTIONS = sectionsFromGroup(1)

/**
 * Singular "+ Add …" labels for each history category title (board AC / Round R).
 * Kept next to the section definitions — do not string-build from the plural title.
 */
export const HISTORY_CATEGORY_ADD_LABELS: Record<string, string> = {
  "Mental health": "+ Add mental health issue",
  "Substance use": "+ Add substance use issue",
  "Physical health": "+ Add physical health issue",
  "Self-harm": "+ Add self-harm",
  "Traumatic events": "+ Add traumatic event",
  "Other significant events": "+ Add significant event",
  "Significant events": "+ Add significant event",
}

export function historyCategoryAddLabel(title: string): string {
  return HISTORY_CATEGORY_ADD_LABELS[title] ?? `+ Add ${title.toLowerCase()}`
}

/**
 * Visual tree layer for a History node: anything directly under a category is
 * layer 2 (issue or single event); its children are layer 3; steps are layer 4.
 */
export function historyVisualLayer(
  kind: "band" | "row" | "note" | "actions",
  options?: { parentLayer?: 1 | 2 | 3 | 4; tag?: "Episode" | "Treatment" | "Other" | "Step" }
): 2 | 3 | 4 {
  if (kind === "note" || kind === "actions") return 2
  if (kind === "band") return 2
  if (options?.tag === "Step") return 4
  const parent = options?.parentLayer ?? 1
  if (parent <= 1) return 2
  if (parent === 2) return 3
  return 4
}

export function buildHistoryTree(input: Input): HistoryTree {
  const issues = resolveHistoryIssues(input.events, input.issues)
  const self = input.events.filter((event) => resolvedAbout(event) === "self" && !event.parentEventId)
  const sections: HistoryTreeNode[] = CLIENT_SECTIONS.map((section) => {
    if (section.mode === "condition") {
      const matched = issuesForCategory(issues, section.eventType as "emotional_problems" | "substance_use" | "illness_injury", "self")
      const children = matched.map((issue) => issueBand(issue, input, issues, false))
      if (children.length === 0) {
        return emptySection(section.title, section.screening, input.screening)
      }
      return { kind: "section", title: section.title, screeningKey: section.screening, children }
    }
    const matched = self
      .filter((event) => event.eventType === section.eventType)
      .sort((a, b) => comparePartialStarts(a, b, input.dateOfBirth))
    if (matched.length === 0) {
      return emptySection(section.title, section.screening, input.screening)
    }
    return {
      kind: "section",
      title: section.title,
      screeningKey: section.screening,
      children: matched.map((event) => eventRow(event, input)),
    }
  })

  return {
    client: { title: HISTORY_QUESTION_GROUPS[0].title, children: sections },
    family: { title: HISTORY_QUESTION_GROUPS[1].title, children: familySections(input, issues) },
  }
}

function emptySection(
  title: string,
  screening: keyof ScreeningAnswers,
  answers: ScreeningAnswers
): HistoryTreeNode {
  const answer = answers[screening]
  const note = answer === "yes" ? [] : [{ kind: "note" as const, text: answer === "no" ? "None" : "Not asked" }]
  return { kind: "section", title, screeningKey: screening, children: note }
}

function issueBand(issue: HistoryIssue, input: Input, _issues: HistoryIssue[], family: boolean): HistoryTreeNode {
  const mixed = mixedIssueEvents(input.events, issue.issueId, input.dateOfBirth)
  const episodes = mixed.filter((item) => item.kind === "episode").map((item) => item.event)
  const who = family ? whoLabel(issue, input.relationships) : ""
  const heading = family
    ? who
      ? `${issueTitle(issue)} · ${who}`
      : `${issueTitle(issue)} · Needs who`
    : issueTitle(issue)
  const meta = issueSpanMeta(episodes, input.dateOfBirth)
  const children: HistoryTreeNode[] = mixed.map((item) => {
    if (item.kind === "episode") {
      return {
        kind: "row",
        id: item.event.eventRecordId,
        line: episodeLine(item.event, item.episodeNumber, input.dateOfBirth),
        tag: "Episode" as const,
        children: subEventNodes(input.events, item.event.eventRecordId, input),
      }
    }
    if (item.kind === "other") {
      return {
        kind: "row",
        id: item.event.eventRecordId,
        line: eventLine(item.event, input.dateOfBirth),
        tag: "Other" as const,
        children: subEventNodes(input.events, item.event.eventRecordId, input),
      }
    }
    return {
      kind: "row",
      id: item.event.eventRecordId,
      line: treatmentLine(item.event, input),
      tag: "Treatment" as const,
      children: subEventNodes(input.events, item.event.eventRecordId, input),
    }
  })
  if (input.interactive) {
    children.push({
      kind: "actions",
      issueId: issue.issueId,
      about: issue.about,
      category: issue.category,
    })
  }
  return {
    kind: "band",
    id: issue.issueId,
    heading,
    meta,
    treatmentAnswer: issue.treatmentAnswer,
    needsWho: issueNeedsWho(issue),
    children,
  }
}

function episodeLine(event: EventRecord, number: number, dateOfBirth: string | null): string {
  const when = spanLine(event, dateOfBirth)
  return [`Episode ${number}`, when].filter(Boolean).join(" · ")
}

function eventRow(event: EventRecord, input: Input, tag?: "Episode" | "Treatment" | "Other" | "Step"): HistoryTreeNode {
  const line = isTreatmentEvent(event.eventType)
    ? treatmentLine(event, input)
    : eventLine(event, input.dateOfBirth)
  const children = nestedOrStepNodes(input.events, event.eventRecordId, input)
  const actions: HistoryTreeNode[] = input.interactive
    ? [
        {
          kind: "actions",
          parentEventId: event.eventRecordId,
          about: event.about === "significant_other" ? "significant_other" : "self",
          category: event.eventType,
        },
      ]
    : []
  return {
    kind: "row",
    id: event.eventRecordId,
    line,
    tag: tag ?? (isTreatmentEvent(event.eventType) ? "Treatment" : isOtherEvent(event.eventType) ? "Other" : undefined),
    children: [...children, ...actions],
  }
}

/** Nested Episode/Treatment/Other under a parent, plus free-text steps. */
function nestedOrStepNodes(events: EventRecord[], parentId: string, input: Input): HistoryTreeNode[] {
  return subEventsFor(events, parentId)
    .sort((a, b) => comparePartialStarts(a, b, input.dateOfBirth))
    .map((event) => {
      if (isNestedHistoryEvent(event.eventType) && event.eventType !== "family_events") {
        if (isConditionEvent(event.eventType)) {
          return {
            kind: "row" as const,
            id: event.eventRecordId,
            line: eventLine(event, input.dateOfBirth),
            tag: "Episode" as const,
            children: subEventNodes(events, event.eventRecordId, input),
          }
        }
        if (isOtherEvent(event.eventType)) {
          return {
            kind: "row" as const,
            id: event.eventRecordId,
            line: eventLine(event, input.dateOfBirth),
            tag: "Other" as const,
            children: subEventNodes(events, event.eventRecordId, input),
          }
        }
        return {
          kind: "row" as const,
          id: event.eventRecordId,
          line: treatmentLine(event, input),
          tag: "Treatment" as const,
          children: subEventNodes(events, event.eventRecordId, input),
        }
      }
      return {
        kind: "row" as const,
        id: event.eventRecordId,
        line: eventLine(event, input.dateOfBirth),
        tag: "Step" as const,
        children: [] as HistoryTreeNode[],
      }
    })
}

function subEventNodes(events: EventRecord[], parentId: string, input: Input): HistoryTreeNode[] {
  return nestedOrStepNodes(events, parentId, input)
}

function issueSpanMeta(episodes: EventRecord[], dateOfBirth: string | null): string {
  if (episodes.length === 0) return ""
  const sorted = [...episodes].sort((a, b) => comparePartialStarts(a, b, dateOfBirth))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const start = yearOf(first.startValue)
  const end = last.endOngoing || last.resolvedOrOngoing === "ongoing" ? "ongoing" : yearOf(last.endValue) || yearOf(last.startValue)
  const span = start && end && start !== end ? `${start} – ${end}` : start || end
  if (episodes.length === 1) return span
  return [span, `${episodes.length} episodes`].filter(Boolean).join(" · ")
}

function eventLine(event: EventRecord, dateOfBirth: string | null): string {
  const title = event.title.trim() || EVENT_TYPE_LABELS[event.eventType]
  const when = spanLine(event, dateOfBirth)
  return [title, when].filter(Boolean).join(" · ")
}

function treatmentLine(event: EventRecord, input: Input): string {
  const when = datePhrase(event)
  if (event.eventType === "psychiatric_admission" && event.admissionType === "residential_rehab") {
    return ["Residential rehab", when.dates].filter(Boolean).join(" · ")
  }
  if (event.eventType === "psychiatric_admission") {
    const type = event.admissionType ? ADMISSION_TYPE_LABELS[event.admissionType].toLowerCase() : ""
    return ["Hospital admission", type, when.dates, event.admissionLength.trim()].filter(Boolean).join(" · ")
  }
  if (event.eventType === "previous_therapy") {
    return ["Therapy", event.title.trim().toLowerCase(), when.dates].filter(Boolean).join(" · ")
  }
  if (event.eventType === "other_treatment") {
    return [event.title.trim() || "Other treatment", when.dates].filter(Boolean).join(" · ")
  }
  const prescriber = prescriberLabel(event, input.professionals ?? [])
  return ["Medication", event.title.trim().toLowerCase(), when.dates, ongoing(event) ? "ongoing" : "", prescriber]
    .filter(Boolean)
    .join(" · ")
}

function familySections(input: Input, issues: HistoryIssue[]): HistoryTreeNode[] {
  return FAMILY_SECTIONS.map((section) => {
    if (section.mode === "condition") {
      const matched = issuesForCategory(
        issues,
        section.eventType as "emotional_problems" | "substance_use" | "illness_injury",
        "significant_other"
      )
      const children = matched.map((issue) => issueBand(issue, input, issues, true))
      if (children.length === 0) {
        return emptySection(section.title, section.screening, input.screening)
      }
      return { kind: "section", title: section.title, screeningKey: section.screening, children }
    }
    const matched = input.events
      .filter(
        (event) =>
          resolvedAbout(event) === "significant_other" &&
          !event.parentEventId &&
          !isConditionEvent(event.eventType) &&
          !isTreatmentEvent(event.eventType) &&
          (event.eventType === section.eventType ||
            (section.eventType === "significant_history" && event.eventType === "family_events"))
      )
      .sort((a, b) => comparePartialStarts(a, b, input.dateOfBirth))
    if (matched.length === 0) {
      return emptySection(section.title, section.screening, input.screening)
    }
    return {
      kind: "section",
      title: section.title,
      screeningKey: section.screening,
      children: matched.map((event) => eventRow(event, input)),
    }
  })
}

function whoLabel(issue: HistoryIssue, people: RelationshipRecord[]): string {
  if (issue.relationshipRecordId) {
    const person = people.find((item) => item.relationshipRecordId === issue.relationshipRecordId)
    if (!person) return ""
    const role = roleWord(person)
    const name = person.givenName.trim()
    if (name) return `${name} (${role.toLowerCase()})`
    return role
  }
  const other = issue.aboutOther.trim()
  return other
}

function roleWord(person: RelationshipRecord): string {
  const rel = person.relationshipToClient
  if (rel === "mother" || person.blockRoleType === "mother") return "Mother"
  if (rel === "father" || person.blockRoleType === "father") return "Father"
  if (rel === "step_parent") return "Step-parent"
  if (rel === "current_partner" || rel === "prior_partner" || person.blockRole === "partner") return "Partner"
  if (rel.startsWith("child") || person.blockRole === "child") {
    if (person.sex === "Female") return "Daughter"
    if (person.sex === "Male") return "Son"
    return "Child"
  }
  if (rel.startsWith("sibling") || person.blockRole === "sibling") {
    if (person.sex === "Female") return "Sister"
    if (person.sex === "Male") return "Brother"
    return "Sibling"
  }
  if (rel === "other_caregiver" || person.blockRole === "caregiver") return "Caregiver"
  return "Relative"
}

function ongoing(event: EventRecord): boolean {
  return event.endOngoing || event.resolvedOrOngoing === "ongoing"
}

function yearOf(value: string): string {
  return /(\d{4})/.exec(value)?.[1] ?? ""
}

function datePhrase(event: EventRecord): { dates: string } {
  const start = yearOf(event.startValue)
  const end = yearOf(event.endValue)
  if (ongoing(event)) return { dates: start ? `since ${start}` : "" }
  if (start && end && start !== end) return { dates: `${start}–${end}` }
  return { dates: start || end }
}

function agePhrase(event: EventRecord, dateOfBirth: string | null): string {
  const start = clientAgeAtStart(dateOfBirth, event.startPrecision as StartPrecision | "", event.startValue)
  const end = clientAgeAtStart(dateOfBirth, event.endPrecision as StartPrecision | "", event.endValue)
  if (ongoing(event)) return start != null ? `from age ${start}` : ""
  if (start != null && end != null && start !== end) return `age ${start} to ${end}`
  if (start != null) return `age ${start}`
  if (end != null) return `age ${end}`
  return ""
}

function spanLine(event: EventRecord, dateOfBirth: string | null): string {
  return [datePhrase(event).dates, agePhrase(event, dateOfBirth)].filter(Boolean).join(" · ")
}

function professionShort(value: string | null | undefined): string {
  const text = (value ?? "").trim()
  if (/^general practitioners?$/i.test(text) || /^g\.?p\.?$/i.test(text)) return "GP"
  return text
}

function prescriberLabel(event: EventRecord, professionals: ProfessionalOption[]): string {
  const professional = professionals.find((item) => item.professionalId === event.prescriberProfessionalId)
  if (!professional) return event.prescriberName.trim()
  const name = [professional.title?.trim(), professional.firstName.trim(), professional.lastName.trim()].filter(Boolean).join(" ")
  const profession = professionShort(professional.professionName)
  if (name && profession) return `${name}, ${profession}`
  return name || professionalSummary(professional)
}

/** Keep for callers that still sort family people by relationship order. */
export function compareEventsChronologicallyForTree(
  a: EventRecord,
  b: EventRecord,
  dateOfBirth: string | null
): number {
  return compareEventsChronologically(a, b, dateOfBirth)
}
