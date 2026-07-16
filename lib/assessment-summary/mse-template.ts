import { MSE_INSERT_WORDS } from "@/lib/mse/insert-words"
import { MSE_OPTION_DISPLAY_ORDER } from "@/lib/mse/option-display-order"
import {
  joinNames,
  mseLowercaseExceptFirst,
  MSE_DISCERNMENT_FIELDS,
  MSE_MENTAL_FUNCTION_GROUPS,
  MSE_PRESENTATION_FIELDS,
  type MseSentenceFieldKey,
} from "@/lib/mse/session-note-sentence"
import type { MseReportResultRow } from "@/lib/reports/snapshot"

function insertWord(
  fieldKey: MseSentenceFieldKey,
  optionLabel: string
): string | null {
  return MSE_INSERT_WORDS[fieldKey]?.[optionLabel] ?? null
}

function optionOrder(fieldKey: MseSentenceFieldKey, optionLabel: string): number {
  return MSE_OPTION_DISPLAY_ORDER[fieldKey]?.[optionLabel] ?? Number.MAX_SAFE_INTEGER
}

type AbnormalTally = {
  optionLabel: string
  count: number
  displayOrder: number
}

function tallyAbnormalsForField(
  sessions: MseReportResultRow[],
  fieldKey: MseSentenceFieldKey
): { alwaysBaseline: boolean; tallies: AbnormalTally[] } {
  const counts = new Map<string, number>()
  let observed = 0
  let baselineCount = 0

  for (const session of sessions) {
    const selection = session.fields[fieldKey]
    if (!selection) continue
    observed += 1
    if (selection.isBaseline) {
      baselineCount += 1
      continue
    }
    counts.set(selection.value, (counts.get(selection.value) ?? 0) + 1)
  }

  if (observed === 0) {
    return { alwaysBaseline: true, tallies: [] }
  }

  if (baselineCount === observed) {
    return { alwaysBaseline: true, tallies: [] }
  }

  const tallies = [...counts.entries()]
    .map(([optionLabel, count]) => ({
      optionLabel,
      count,
      displayOrder: optionOrder(fieldKey, optionLabel),
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder)

  return { alwaysBaseline: false, tallies }
}

function formatAbnormalFragments(
  fieldKey: MseSentenceFieldKey,
  tallies: AbnormalTally[],
  totalSessions: number
): string[] {
  const fragments: string[] = []
  for (const tally of tallies) {
    const word = insertWord(fieldKey, tally.optionLabel)
    if (!word) continue
    fragments.push(`${word} on ${tally.count} of ${totalSessions} sessions`)
  }
  return fragments
}

function buildConsistentlyNormalPresentation(labels: string[]): string {
  const joined = joinNames(mseLowercaseExceptFirst(labels))
  if (labels.length === 1) {
    return `${joined} was consistently within expected limits.`
  }
  if (labels.length === 2) {
    return `${joined} were consistently within expected limits.`
  }
  return `${joined} were all consistently within expected limits.`
}

function buildConsistentlyNormalMentalFunction(names: string[]): string {
  const joined = joinNames(mseLowercaseExceptFirst(names))
  if (names.length === 1 || names.length === 2) {
    return `${joined} were consistently within expected limits.`
  }
  return `${joined} were all consistently within expected limits.`
}

function buildConsistentlyNormalDiscernment(labels: string[]): string {
  const joined = joinNames(mseLowercaseExceptFirst(labels))
  if (labels.length === 1) {
    return `${joined} was consistently good.`
  }
  return `${joined} were both consistently good.`
}

function buildPresentationBlock(
  sessions: MseReportResultRow[],
  totalSessions: number
): string {
  const normalLabels: string[] = []
  const abnormalSentences: string[] = []

  for (const field of MSE_PRESENTATION_FIELDS) {
    const { alwaysBaseline, tallies } = tallyAbnormalsForField(
      sessions,
      field.key
    )
    if (alwaysBaseline) {
      normalLabels.push(field.label)
      continue
    }
    const fragments = formatAbnormalFragments(field.key, tallies, totalSessions)
    if (fragments.length === 0) continue
    abnormalSentences.push(`${field.label} was ${joinNames(fragments)}.`)
  }

  const parts: string[] = []
  if (normalLabels.length > 0) {
    parts.push(buildConsistentlyNormalPresentation(normalLabels))
  }
  parts.push(...abnormalSentences)
  return parts.join(" ")
}

function buildMentalFunctionBlock(
  sessions: MseReportResultRow[],
  totalSessions: number
): string {
  const normalGroupNames: string[] = []
  const abnormalSentences: string[] = []

  for (const group of MSE_MENTAL_FUNCTION_GROUPS) {
    const fieldResults = group.fields.map((key) => ({
      key,
      ...tallyAbnormalsForField(sessions, key),
    }))

    const groupAlwaysNormal = fieldResults.every((r) => r.alwaysBaseline)

    if (groupAlwaysNormal) {
      normalGroupNames.push(group.name)
      continue
    }

    const fragments: string[] = []
    for (const result of fieldResults) {
      if (result.alwaysBaseline) continue
      fragments.push(
        ...formatAbnormalFragments(result.key, result.tallies, totalSessions)
      )
    }

    if (fragments.length > 0) {
      abnormalSentences.push(
        `${group.name} included ${joinNames(fragments)}.`
      )
    }
  }

  const parts: string[] = []
  if (normalGroupNames.length > 0) {
    parts.push(buildConsistentlyNormalMentalFunction(normalGroupNames))
  }
  parts.push(...abnormalSentences)
  return parts.join(" ")
}

function buildDiscernmentBlock(
  sessions: MseReportResultRow[],
  totalSessions: number
): string {
  const normalLabels: string[] = []
  const abnormalSentences: string[] = []

  for (const field of MSE_DISCERNMENT_FIELDS) {
    const { alwaysBaseline, tallies } = tallyAbnormalsForField(
      sessions,
      field.key
    )
    if (alwaysBaseline) {
      normalLabels.push(field.label)
      continue
    }
    const fragments = formatAbnormalFragments(field.key, tallies, totalSessions)
    if (fragments.length === 0) continue
    abnormalSentences.push(`${field.label} was ${joinNames(fragments)}.`)
  }

  const parts: string[] = []
  if (normalLabels.length > 0) {
    parts.push(buildConsistentlyNormalDiscernment(normalLabels))
  }
  parts.push(...abnormalSentences)
  return parts.join(" ")
}

/**
 * Aggregates MSE sessions across a Progress Report period into one paragraph.
 * Returns null when there are no sessions (caller supplies the fallback sentence).
 */
export function buildMseProgressReportParagraph(
  sessions: MseReportResultRow[]
): string | null {
  if (sessions.length === 0) return null

  const totalSessions = sessions.length
  return [
    buildPresentationBlock(sessions, totalSessions),
    buildMentalFunctionBlock(sessions, totalSessions),
    buildDiscernmentBlock(sessions, totalSessions),
  ]
    .filter((block) => block.trim().length > 0)
    .join(" ")
}
