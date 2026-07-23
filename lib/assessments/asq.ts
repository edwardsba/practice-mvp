import { and, eq, inArray } from "drizzle-orm"

export const ASQ_Q5_ELEMENT_KEY = "asq_q5"
export const ASQ_HISTORICAL_ELEMENT_KEY = "asq_q4"
export const ASQ_RECENT_ELEMENT_KEYS = ["asq_q1", "asq_q2", "asq_q3"]

export type AsqFlags = {
  historicalPositive: boolean
  recentPositive: boolean
  currentPositive: boolean
}

/**
 * Computes the ASQ severity rating from the three independent flags:
 * Historical (Q4 — lifetime attempt), Recent (Q1–3), Current (Q5).
 * This is the single source of truth for ASQ severity — the result is
 * stored once on assessmentResults.severity at submission time and read
 * directly everywhere it's displayed (results page, session note,
 * client overview). It is NOT used by the Progress Report ASQ paragraph,
 * which has its own separate logic in lib/assessment-summary/asq-template.ts.
 */
export function asqScreenOutcome(flags: AsqFlags): string {
  const { historicalPositive: h, recentPositive: r, currentPositive: c } = flags

  if (!h && !r && !c) return "No history or TOSH"
  if (h && !r && !c) return "Historical attempt, no TOSH"
  if (h && r && !c) return "Historical attempt, recent no current TOSH"
  if (h && r && c) return "Historical attempt, recent and current TOSH"
  if (!h && r && !c) return "Recent no current TOSH"
  if (!h && r && c) return "Recent and current TOSH"
  if (!h && !r && c) return "Current TOSH"
  return "Historical attempt, current TOSH" // h && !r && c
}

export async function getAsqRecentAndCurrentFlags(
  assessmentInstanceIds: string[]
): Promise<Map<string, { recentPositive: boolean; currentPositive: boolean }>> {
  const result = new Map<string, { recentPositive: boolean; currentPositive: boolean }>()

  if (assessmentInstanceIds.length === 0) {
    return result
  }

  for (const instanceId of assessmentInstanceIds) {
    result.set(instanceId, { recentPositive: false, currentPositive: false })
  }

  // Lazy-load DB so pure helpers (asqScreenOutcome) can be unit-tested without
  // pulling in Next's server-only module graph.
  const { assessmentElements, assessmentResponses } = await import("@/db/schema")
  const { db } = await import("@/lib/db")

  const rows = await db
    .select({
      assessmentInstanceId: assessmentResponses.assessmentInstanceId,
      elementKey: assessmentElements.elementKey,
      responseValue: assessmentResponses.responseValue,
    })
    .from(assessmentResponses)
    .innerJoin(
      assessmentElements,
      eq(assessmentResponses.assessmentElementId, assessmentElements.assessmentElementId)
    )
    .where(
      and(
        inArray(assessmentResponses.assessmentInstanceId, assessmentInstanceIds),
        inArray(assessmentElements.elementKey, [
          ...ASQ_RECENT_ELEMENT_KEYS,
          ASQ_Q5_ELEMENT_KEY,
        ])
      )
    )

  for (const row of rows) {
    const entry = result.get(row.assessmentInstanceId)
    if (!entry) continue

    if (
      ASQ_RECENT_ELEMENT_KEYS.includes(row.elementKey) &&
      row.responseValue === "yes"
    ) {
      entry.recentPositive = true
    }
    if (row.elementKey === ASQ_Q5_ELEMENT_KEY && row.responseValue === "yes") {
      entry.currentPositive = true
    }
  }

  return result
}
