import { eventStartSortKey } from "@/lib/client-background/age"
import { conditionGroups, personKey } from "@/lib/client-background/condition-groups"
import { isConditionEvent, isTreatmentEvent } from "@/lib/client-background/history-links"
import { resolvedAbout } from "@/lib/client-background/interview-history"
import {
  CONDITION_EVENT_TYPES,
  EVENT_TYPE_LABELS,
  TREATMENT_ANSWERS,
  type ConditionEventType,
  type EventRecord,
  type HistoryAbout,
  type HistoryIssue,
  type StartPrecision,
  type TreatmentAnswer,
} from "@/lib/client-background/types"

export function isTreatmentAnswer(value: unknown): value is TreatmentAnswer {
  return typeof value === "string" && (TREATMENT_ANSWERS as readonly string[]).includes(value)
}

export function sanitizeHistoryIssue(value: unknown, fallbackId = ""): HistoryIssue {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const category =
    typeof raw.category === "string" && (CONDITION_EVENT_TYPES as readonly string[]).includes(raw.category)
      ? (raw.category as ConditionEventType)
      : "emotional_problems"
  const about: HistoryAbout = raw.about === "significant_other" ? "significant_other" : "self"
  const relationshipRecordId =
    about === "significant_other" && typeof raw.relationshipRecordId === "string" && raw.relationshipRecordId.trim()
      ? raw.relationshipRecordId.trim()
      : null
  const aboutOther =
    about === "significant_other" && !relationshipRecordId && typeof raw.aboutOther === "string"
      ? raw.aboutOther.trim()
      : ""
  const treatmentAnswer = isTreatmentAnswer(raw.treatmentAnswer) ? raw.treatmentAnswer : ""
  return {
    issueId: typeof raw.issueId === "string" && raw.issueId.trim() ? raw.issueId.trim() : fallbackId,
    category,
    about,
    relationshipRecordId,
    aboutOther,
    title: typeof raw.title === "string" ? raw.title : "",
    treatmentAnswer,
    displayOrder: typeof raw.displayOrder === "number" && Number.isFinite(raw.displayOrder) ? raw.displayOrder : 0,
  }
}

/** Issues derived from stored rows, or synthesised from condition groups when none were loaded. */
export function resolveHistoryIssues(events: EventRecord[], stored: HistoryIssue[] | undefined | null): HistoryIssue[] {
  if (stored && stored.length > 0) return stored.map((issue) => sanitizeHistoryIssue(issue, issue.issueId))
  return conditionGroups(events).map((group, index) => {
    const first = group.episodes[0]
    const treatments = treatmentsForIssue(events, group.id)
    return {
      issueId: group.id.startsWith("title:") ? group.id : group.id,
      category: group.eventType,
      about: resolvedAbout(first),
      relationshipRecordId: first.relationshipRecordId,
      aboutOther: first.relationshipRecordId ? "" : first.aboutOther.trim(),
      title: group.title,
      treatmentAnswer: (treatments.length > 0 ? "yes" : "") as TreatmentAnswer | "",
      displayOrder: index,
    }
  })
}

export function issueForEvent(issues: HistoryIssue[], event: EventRecord): HistoryIssue | null {
  const id = event.conditionGroupId?.trim()
  if (id && !id.startsWith("title:")) {
    return issues.find((issue) => issue.issueId === id) ?? null
  }
  if (event.conditionEventId) {
    return null
  }
  return null
}

/**
 * Treatments belonging to an issue: conditionGroupId match, or legacy conditionEventId
 * pointing at an episode of that issue.
 */
export function treatmentsForIssue(events: EventRecord[], issueId: string): EventRecord[] {
  const episodeIds = new Set(
    events
      .filter((event) => isConditionEvent(event.eventType) && event.conditionGroupId === issueId && !event.parentEventId)
      .map((event) => event.eventRecordId)
  )
  // Title-fallback groups: match episodes that share the synthetic key.
  if (issueId.startsWith("title:")) {
    const groupEpisodes = conditionGroups(events).find((group) => group.id === issueId)?.episodes ?? []
    for (const episode of groupEpisodes) episodeIds.add(episode.eventRecordId)
  }
  return events.filter((event) => {
    if (!isTreatmentEvent(event.eventType) || event.parentEventId) return false
    if (event.conditionGroupId === issueId) return true
    if (event.conditionEventId && episodeIds.has(event.conditionEventId)) return true
    return false
  })
}

export function episodesForIssue(events: EventRecord[], issueId: string): EventRecord[] {
  if (issueId.startsWith("title:")) {
    return conditionGroups(events).find((group) => group.id === issueId)?.episodes ?? []
  }
  return events.filter(
    (event) =>
      isConditionEvent(event.eventType) &&
      event.conditionGroupId === issueId &&
      !event.parentEventId
  )
}

export function unlinkedTreatments(events: EventRecord[], about: HistoryAbout = "self"): EventRecord[] {
  return events.filter((event) => {
    if (!isTreatmentEvent(event.eventType) || event.parentEventId) return false
    if (resolvedAbout(event) !== about) return false
    if (event.conditionGroupId) return false
    if (event.conditionEventId) {
      const linked = events.find((item) => item.eventRecordId === event.conditionEventId)
      if (linked && isConditionEvent(linked.eventType)) return false
    }
    return true
  })
}

export function subEventsFor(events: EventRecord[], parentId: string): EventRecord[] {
  return events.filter((event) => event.parentEventId === parentId)
}

/** Precision-aware start compare: coarser precision truncates the finer date. Undated last. */
export function comparePartialStarts(
  a: { startPrecision: StartPrecision | ""; startValue: string; displayOrder: number },
  b: { startPrecision: StartPrecision | ""; startValue: string; displayOrder: number },
  dateOfBirth: string | null | undefined
): number {
  const aKey = eventStartSortKey(dateOfBirth, a.startPrecision, a.startValue)
  const bKey = eventStartSortKey(dateOfBirth, b.startPrecision, b.startValue)
  if (aKey == null && bKey == null) return a.displayOrder - b.displayOrder
  if (aKey == null) return 1
  if (bKey == null) return -1
  const aPrecision = precisionRank(a.startPrecision)
  const bPrecision = precisionRank(b.startPrecision)
  const coarse = Math.min(aPrecision, bPrecision)
  const aTrunc = truncateKey(aKey, coarse)
  const bTrunc = truncateKey(bKey, coarse)
  if (aTrunc !== bTrunc) return aTrunc - bTrunc
  return a.displayOrder - b.displayOrder
}

function precisionRank(precision: StartPrecision | ""): number {
  if (precision === "date") return 3
  if (precision === "year_month") return 2
  if (precision === "year" || precision === "age") return 1
  return 0
}

function truncateKey(key: number, rank: number): number {
  if (rank <= 1) return Math.floor(key / 10000) * 10000
  if (rank === 2) return Math.floor(key / 100) * 100
  return key
}

export type MixedHistoryItem =
  | { kind: "episode"; event: EventRecord; episodeNumber: number }
  | { kind: "treatment"; event: EventRecord }

/**
 * Episodes and treatments of an issue, sorted by start (partial at precision;
 * episode before treatment on the same start; undated last). Episodes numbered
 * in that date order.
 */
export function mixedIssueEvents(
  events: EventRecord[],
  issueId: string,
  dateOfBirth: string | null
): MixedHistoryItem[] {
  const episodes = [...episodesForIssue(events, issueId)].sort((a, b) =>
    comparePartialStarts(a, b, dateOfBirth)
  )
  const episodeNumber = new Map(episodes.map((episode, index) => [episode.eventRecordId, index + 1]))
  const treatments = treatmentsForIssue(events, issueId)
  const mixed: MixedHistoryItem[] = [
    ...episodes.map((event) => ({
      kind: "episode" as const,
      event,
      episodeNumber: episodeNumber.get(event.eventRecordId) ?? 1,
    })),
    ...treatments.map((event) => ({ kind: "treatment" as const, event })),
  ]
  mixed.sort((a, b) => {
    const byDate = comparePartialStarts(a.event, b.event, dateOfBirth)
    if (byDate !== 0) return byDate
    if (a.kind !== b.kind) return a.kind === "episode" ? -1 : 1
    return a.event.displayOrder - b.event.displayOrder
  })
  return mixed
}

/**
 * Report rule: a treatment belongs to the latest episode of the same issue that
 * starts on or before the treatment's start; else the first episode.
 */
export function episodeForTreatment(
  treatment: EventRecord,
  episodes: EventRecord[],
  dateOfBirth: string | null
): EventRecord | null {
  if (episodes.length === 0) return null
  const sorted = [...episodes].sort((a, b) => comparePartialStarts(a, b, dateOfBirth))
  const treatmentKey = eventStartSortKey(dateOfBirth, treatment.startPrecision, treatment.startValue)
  if (treatmentKey == null) return sorted[0]
  let chosen: EventRecord | null = null
  for (const episode of sorted) {
    const episodeKey = eventStartSortKey(dateOfBirth, episode.startPrecision, episode.startValue)
    if (episodeKey == null) continue
    const coarse = Math.min(precisionRank(treatment.startPrecision), precisionRank(episode.startPrecision))
    if (truncateKey(episodeKey, coarse) <= truncateKey(treatmentKey, coarse)) chosen = episode
  }
  return chosen ?? sorted[0]
}

/** Adding a treatment sets Yes; removing the last sets Not asked (never None). */
export function treatmentAnswerAfterChange(
  current: TreatmentAnswer | "",
  treatmentCount: number
): TreatmentAnswer {
  if (treatmentCount > 0) return "yes"
  if (current === "none") return "none"
  return "not_asked"
}

export function issueNeedsWho(issue: HistoryIssue): boolean {
  return issue.about === "significant_other" && !issue.relationshipRecordId && !issue.aboutOther.trim()
}

export function issueTitle(issue: HistoryIssue): string {
  return issue.title.trim() || EVENT_TYPE_LABELS[issue.category]
}

export function issuesForCategory(
  issues: HistoryIssue[],
  category: ConditionEventType,
  about: HistoryAbout
): HistoryIssue[] {
  return issues
    .filter((issue) => issue.category === category && issue.about === about)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.title.localeCompare(b.title))
}

export function sameIssuePerson(
  issue: HistoryIssue,
  event: Pick<EventRecord, "about" | "relationshipRecordId" | "aboutOther">
): boolean {
  return personKey({
    about: issue.about,
    relationshipRecordId: issue.relationshipRecordId,
    aboutOther: issue.aboutOther,
  }) === personKey(event)
}

/** Backfill plan helpers for self-tests (mirror migration rules). */
export type IssueBackfillPlan = {
  issues: {
    issueId: string
    category: ConditionEventType
    about: HistoryAbout
    relationshipRecordId: string | null
    aboutOther: string
    title: string
    treatmentAnswer: TreatmentAnswer | ""
  }[]
  treatmentGroupLinks: { eventRecordId: string; conditionGroupId: string }[]
  otherTreatmentYes: boolean
}

export function planHistoryIssueBackfill(input: {
  events: EventRecord[]
  screening: Partial<Record<string, string>>
}): IssueBackfillPlan {
  const groups = conditionGroups(input.events).filter((group) => !group.id.startsWith("title:"))
  const treatmentGroupLinks: { eventRecordId: string; conditionGroupId: string }[] = []
  for (const event of input.events) {
    if (!isTreatmentEvent(event.eventType)) continue
    if (event.conditionGroupId) continue
    if (!event.conditionEventId) continue
    const episode = input.events.find((item) => item.eventRecordId === event.conditionEventId)
    if (episode?.conditionGroupId) {
      treatmentGroupLinks.push({ eventRecordId: event.eventRecordId, conditionGroupId: episode.conditionGroupId })
    }
  }
  const linkedByEvent = new Map(treatmentGroupLinks.map((link) => [link.eventRecordId, link.conditionGroupId]))
  const issues = groups.map((group) => {
    const first = group.episodes[0]
    const hasTreatments =
      input.events.some(
        (event) =>
          isTreatmentEvent(event.eventType) &&
          (event.conditionGroupId === group.id ||
            linkedByEvent.get(event.eventRecordId) === group.id ||
            group.episodes.some((episode) => event.conditionEventId === episode.eventRecordId))
      )
    let treatmentAnswer: TreatmentAnswer | "" = ""
    if (hasTreatments) treatmentAnswer = "yes"
    else if (resolvedAbout(first) === "self") {
      if (
        input.screening.psychiatric_admission === "no" &&
        input.screening.previous_therapy === "no" &&
        input.screening.medication_history === "no"
      ) {
        treatmentAnswer = "none"
      }
    } else if (input.screening.family_psychiatric_admission === "no") {
      treatmentAnswer = "none"
    }
    return {
      issueId: group.id,
      category: group.eventType,
      about: resolvedAbout(first),
      relationshipRecordId: first.relationshipRecordId,
      aboutOther: first.relationshipRecordId ? "" : first.aboutOther.trim(),
      title: group.title,
      treatmentAnswer,
    }
  })
  const otherTreatmentYes = unlinkedTreatments(input.events, "self").length > 0
  return { issues, treatmentGroupLinks, otherTreatmentYes }
}
