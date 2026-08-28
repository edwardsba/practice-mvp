import { PRACTICE_TIMEZONE } from "@/lib/dates/practice-time"

export type SageSrModuleType = "core" | "background" | "personality"

const MODULE_LABELS: Record<SageSrModuleType, string> = {
  core: "Core",
  background: "Background",
  personality: "Personality",
}

/** Printed order used throughout the rest of this report's design (Introduction,
 *  Background, Core, Personality) — module mentions here follow the same order rather
 *  than whatever order imports happen to be passed in. */
const MODULE_ORDER: SageSrModuleType[] = ["core", "background", "personality"]

export interface SageSrModuleImport {
  module: SageSrModuleType
  /** The module's own "Evaluation Date" as printed on its source report — a real Date
   *  (e.g. assessmentResults.assessmentDate / assessmentInstances.submittedAt), not a
   *  string this generator would need to parse itself. Evaluation date extraction and
   *  storage already happens once, at import time (lib/sage-sr/detect-report.ts) —
   *  this generator is purely presentational. */
  evaluationDate: Date
}

/** Core's own completion/validity metrics (reliability check, duration, items
 *  skipped) — administrative data that belongs in the Introduction's meta-info, not in
 *  Core's own clinical body, per Ben's explicit call. Optional: omitted when Core
 *  wasn't imported for this client, or when the source PDF had no Metrics box. Only
 *  Core's parser produces this shape — Background and Personality have no equivalent
 *  metrics box (confirmed: no "metrics" field exists on either parser's result type). */
export interface SageSrCoreCompletionMetrics {
  reliabilityItemsCorrect: string | null
  durationMinutes: number | null
  itemsSkipped: string | null
}

export interface SageSrIntroductionInput {
  imports: SageSrModuleImport[]
  reportGeneratedAt: Date
  coreMetrics?: SageSrCoreCompletionMetrics
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: PRACTICE_TIMEZONE,
  })
}

function joinList(items: string[]): string {
  if (items.length === 0) return ""
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

/**
 * Builds the Introduction section — the simplest of the report's four sections,
 * per Ben's own framing: basic meta only (which modules were imported, their
 * evaluation dates, report generation date, plus Core's completion metrics). No
 * clinical content, no interpretation. Comes first in the report, per the approved
 * structure — Background, Core, Personality follow.
 *
 * Returns null only when there's nothing to introduce at all (no modules imported) —
 * shouldn't happen in practice (Core is the minimum required module to generate this
 * report at all, per the approved report-structure decision), but handled the same
 * defensive way every other section generator on this report handles an empty input
 * rather than assuming it can't occur.
 */
export function buildSageSrIntroductionSection(input: SageSrIntroductionInput): string | null {
  if (input.imports.length === 0) return null

  const sorted = [...input.imports].sort(
    (a, b) => MODULE_ORDER.indexOf(a.module) - MODULE_ORDER.indexOf(b.module)
  )

  const moduleNames = sorted.map((i) => MODULE_LABELS[i.module])
  const modulesSentence = `This report synthesizes the client's SAGE-SR ${joinList(moduleNames)} module results.`

  const datesSentence =
    `${joinList(
      sorted.map((i) => `${MODULE_LABELS[i.module]} was completed on ${formatDate(i.evaluationDate)}`)
    )}.`

  // Only ever describe Core's metrics when Core was actually imported for this
  // report — `coreMetrics` being present on the input isn't enough on its own (a
  // caller could pass it while `imports` omits "core", which would otherwise
  // print "The Core module ..." with no matching "Core was completed on ..."
  // sentence above it).
  const coreWasImported = sorted.some((i) => i.module === "core")

  // Each metric gets its own short, complete sentence rather than being joined as
  // three fragments into one ("took 26 minutes to complete, 5/5 reliability items
  // answered correctly, and no items skipped") — those three fragments don't share
  // a grammatical subject/verb shape, so joining them with joinList read as a
  // run-on. Separate sentences sidestep that without inventing new subject/verb
  // phrasing for data this generator doesn't otherwise reshape.
  const metricsSentences: string[] = []
  if (input.coreMetrics && coreWasImported) {
    if (input.coreMetrics.durationMinutes !== null) {
      metricsSentences.push(`The Core module took ${input.coreMetrics.durationMinutes} minutes to complete.`)
    }
    if (input.coreMetrics.reliabilityItemsCorrect !== null) {
      metricsSentences.push(`${input.coreMetrics.reliabilityItemsCorrect} reliability items were answered correctly.`)
    }
    if (input.coreMetrics.itemsSkipped !== null) {
      metricsSentences.push(`${input.coreMetrics.itemsSkipped}.`)
    }
  }

  const generatedSentence = `This report was generated on ${formatDate(input.reportGeneratedAt)}.`

  return [modulesSentence, datesSentence, ...metricsSentences, generatedSentence].join(" ")
}
