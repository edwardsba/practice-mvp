import { BTP_TOOL_CONFIG } from "./config"
import { computeGenericOverviewStats } from "./stats"
import { classifyTrend } from "./trend"
import { buildVariabilityPatternSentence } from "./templates"
import {
  classifySeverityPattern,
  buildSeveritySentence,
} from "./severity-pattern"
import type { AssessmentPoint } from "./stats"
import type { BtpReportResultRow } from "@/lib/reports/snapshot"

function pivotByTarget(
  results: BtpReportResultRow[]
): Map<string, AssessmentPoint[]> {
  const map = new Map<string, { date: string; score: number }[]>()
  for (const result of results) {
    for (const t of result.targets) {
      const rows = map.get(t.target) ?? []
      rows.push({ date: result.date, score: t.score })
      map.set(t.target, rows)
    }
  }

  const withIndex = new Map<string, AssessmentPoint[]>()
  for (const [target, rows] of map.entries()) {
    const sorted = [...rows].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    withIndex.set(
      target,
      sorted.map((r, i) => ({ date: r.date, score: r.score, sessionIndex: i + 1 }))
    )
  }
  return withIndex
}

/**
 * Builds one summary paragraph per behavioural target (a client may have more
 * than one target running at once, each rated separately).
 *
 * `behaviouralTargets` is the treatment plan's canonical, ordered target
 * list — numbering ("Behavioural target 1: ...", "Behavioural target 2:
 * ...") follows this order, matching the same numbering used in the
 * Treatment Plan Summary section earlier in the report. Any target present
 * in the results but not in this list is appended afterward, still
 * numbered, rather than dropped.
 *
 * Three shapes per target, matching the PHQ-9/GAD-7/ASSIST pattern:
 * - n = 1: a single sentence reporting the one rating.
 * - n > 1, all ratings identical: a single sentence reporting the shared
 *   rating across all submissions.
 * - n > 1, ratings vary: the original 3-sentence paragraph.
 */
export function buildBtpSummaryParagraphs(
  results: BtpReportResultRow[],
  clientFirstName: string,
  behaviouralTargets: string[]
): { target: string; paragraph: string }[] {
  const byTarget = pivotByTarget(results)
  const config = BTP_TOOL_CONFIG
  const output: { target: string; paragraph: string }[] = []

  const orderedTargets = [...behaviouralTargets]
  for (const target of byTarget.keys()) {
    if (!orderedTargets.includes(target)) {
      orderedTargets.push(target)
    }
  }

  orderedTargets.forEach((target, index) => {
    const points = byTarget.get(target)
    if (!points) return

    const stats = computeGenericOverviewStats(points, config.variabilityBands)
    if (!stats) return

    const targetNumber = index + 1
    const targetSentence = `Behavioural target ${targetNumber}: ${target}.`

    if (points.length === 1) {
      const score = points[0].score
      const band = config.ratingFromScore(score)
      output.push({
        target,
        paragraph:
          `${targetSentence} ${clientFirstName} rated their effectiveness at ` +
          `${score}/${config.maxScore} (${band}) at the only submission during this period.`,
      })
      return
    }

    const allIdentical = points.every((p) => p.score === points[0].score)
    if (allIdentical) {
      const score = points[0].score
      const band = config.ratingFromScore(score)
      output.push({
        target,
        paragraph:
          `${targetSentence} ${clientFirstName} rated their effectiveness at a consistent ` +
          `${score}/${config.maxScore} (${band}) across all ${points.length} submissions during this period.`,
      })
      return
    }

    const resultsSentence =
      `Across the referral period, ${clientFirstName} rated their effectiveness between ` +
      `${stats.min}/${config.maxScore} (${config.ratingFromScore(stats.min)}) and ` +
      `${stats.max}/${config.maxScore} (${config.ratingFromScore(stats.max)}), ` +
      `with a mean rating of ${stats.mean}/${config.maxScore} (${config.ratingFromScore(Math.round(stats.mean))}) ` +
      `and a median rating of ${stats.median}/${config.maxScore} (${config.ratingFromScore(Math.round(stats.median))}) (n = ${stats.n}).`

    const overviewSentence = `${targetSentence} ${resultsSentence}`

    const trendShape = classifyTrend(points, config.maxScore)
    const variabilityPatternSentence = buildVariabilityPatternSentence(
      stats.variabilityLabel,
      trendShape,
      "ratings"
    )

    const bands = points.map((p) => config.ratingFromScore(p.score))
    const severityCase = classifySeverityPattern(
      bands,
      config.bandOrder,
      config.bottomTwoBands,
      config.topTwoBands
    )
    const severitySentence = buildSeveritySentence(severityCase, "rating")

    output.push({
      target,
      paragraph: [overviewSentence, variabilityPatternSentence, severitySentence].join(" "),
    })
  })

  return output
}
