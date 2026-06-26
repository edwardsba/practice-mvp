import { and, desc, eq, inArray } from "drizzle-orm"

import {
  assessmentDefinitions,
  assessmentInstances,
  assessmentResponses,
  assessmentResults,
} from "@/db/schema"
import {
  btpRatingLabel,
  parseBtpInstanceElementsJson,
} from "@/lib/assessments/btp"
import { db } from "@/lib/db"

export type BtpTargetResultRow = {
  target: string
  score: number
  ratingLabel: string
}

export type BtpResultSummary = {
  assessmentResultId: string
  assessmentDate: Date
  targets: BtpTargetResultRow[]
}

export async function loadLatestBtpResultForClient(
  clientId: string,
  practiceId: string
): Promise<BtpResultSummary | null> {
  const [latest] = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      assessmentDate: assessmentResults.assessmentDate,
      assessmentInstanceId: assessmentResults.assessmentInstanceId,
      instanceElementsJson: assessmentInstances.instanceElementsJson,
    })
    .from(assessmentResults)
    .innerJoin(
      assessmentInstances,
      eq(
        assessmentResults.assessmentInstanceId,
        assessmentInstances.assessmentInstanceId
      )
    )
    .innerJoin(
      assessmentDefinitions,
      eq(
        assessmentInstances.assessmentDefinitionId,
        assessmentDefinitions.assessmentDefinitionId
      )
    )
    .where(
      and(
        eq(assessmentResults.clientId, clientId),
        eq(assessmentResults.practiceId, practiceId),
        eq(assessmentDefinitions.assessmentCode, "BTP")
      )
    )
    .orderBy(desc(assessmentResults.assessmentDate))
    .limit(1)

  if (!latest) return null

  const instanceElements = parseBtpInstanceElementsJson(latest.instanceElementsJson)
  if (!instanceElements?.items.length) return null

  const responses = await db
    .select({
      assessmentElementId: assessmentResponses.assessmentElementId,
      scoreValue: assessmentResponses.scoreValue,
    })
    .from(assessmentResponses)
    .where(
      eq(assessmentResponses.assessmentInstanceId, latest.assessmentInstanceId)
    )

  const scoreByElementId = new Map(
    responses.map((row) => [row.assessmentElementId, row.scoreValue])
  )

  const targets = instanceElements.items
    .sort((a, b) => a.index - b.index)
    .map((item) => {
      const score = scoreByElementId.get(item.elementId) ?? 0
      return {
        target: item.targetText,
        score,
        ratingLabel: btpRatingLabel(score),
      }
    })

  return {
    assessmentResultId: latest.assessmentResultId,
    assessmentDate: latest.assessmentDate,
    targets,
  }
}

export async function loadBtpResultsForDateRange(
  clientId: string,
  practiceId: string,
  rangeStart: Date,
  rangeEnd: Date
) {
  const rows = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      assessmentDate: assessmentResults.assessmentDate,
      assessmentInstanceId: assessmentResults.assessmentInstanceId,
      instanceElementsJson: assessmentInstances.instanceElementsJson,
    })
    .from(assessmentResults)
    .innerJoin(
      assessmentInstances,
      eq(
        assessmentResults.assessmentInstanceId,
        assessmentInstances.assessmentInstanceId
      )
    )
    .innerJoin(
      assessmentDefinitions,
      eq(
        assessmentInstances.assessmentDefinitionId,
        assessmentDefinitions.assessmentDefinitionId
      )
    )
    .where(
      and(
        eq(assessmentResults.clientId, clientId),
        eq(assessmentResults.practiceId, practiceId),
        eq(assessmentDefinitions.assessmentCode, "BTP")
      )
    )
    .orderBy(desc(assessmentResults.assessmentDate))

  const inRange = rows.filter(
    (row) =>
      row.assessmentDate.getTime() >= rangeStart.getTime() &&
      row.assessmentDate.getTime() <= rangeEnd.getTime()
  )

  const summaries: BtpResultSummary[] = []

  for (const row of inRange) {
    const instanceElements = parseBtpInstanceElementsJson(row.instanceElementsJson)
    if (!instanceElements?.items.length) continue

    const responses = await db
      .select({
        assessmentElementId: assessmentResponses.assessmentElementId,
        scoreValue: assessmentResponses.scoreValue,
      })
      .from(assessmentResponses)
      .where(
        eq(assessmentResponses.assessmentInstanceId, row.assessmentInstanceId)
      )

    const scoreByElementId = new Map(
      responses.map((response) => [
        response.assessmentElementId,
        response.scoreValue,
      ])
    )

    const targets = instanceElements.items
      .sort((a, b) => a.index - b.index)
      .map((item) => {
        const score = scoreByElementId.get(item.elementId) ?? 0
        return {
          target: item.targetText,
          score,
          ratingLabel: btpRatingLabel(score),
        }
      })

    summaries.push({
      assessmentResultId: row.assessmentResultId,
      assessmentDate: row.assessmentDate,
      targets,
    })
  }

  return summaries
}

export async function loadBtpResultsForAppointments(
  clientId: string,
  practiceId: string,
  appointmentIds: string[]
): Promise<BtpResultSummary[]> {
  if (appointmentIds.length === 0) return []

  const rows = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      assessmentDate: assessmentResults.assessmentDate,
      assessmentInstanceId: assessmentResults.assessmentInstanceId,
      instanceElementsJson: assessmentInstances.instanceElementsJson,
    })
    .from(assessmentResults)
    .innerJoin(
      assessmentInstances,
      eq(
        assessmentResults.assessmentInstanceId,
        assessmentInstances.assessmentInstanceId
      )
    )
    .innerJoin(
      assessmentDefinitions,
      eq(
        assessmentInstances.assessmentDefinitionId,
        assessmentDefinitions.assessmentDefinitionId
      )
    )
    .where(
      and(
        eq(assessmentResults.clientId, clientId),
        eq(assessmentResults.practiceId, practiceId),
        eq(assessmentDefinitions.assessmentCode, "BTP"),
        inArray(assessmentInstances.appointmentId, appointmentIds)
      )
    )
    .orderBy(desc(assessmentResults.assessmentDate))

  const summaries: BtpResultSummary[] = []

  for (const row of rows) {
    const instanceElements = parseBtpInstanceElementsJson(row.instanceElementsJson)
    if (!instanceElements?.items.length) continue

    const responses = await db
      .select({
        assessmentElementId: assessmentResponses.assessmentElementId,
        scoreValue: assessmentResponses.scoreValue,
      })
      .from(assessmentResponses)
      .where(
        eq(assessmentResponses.assessmentInstanceId, row.assessmentInstanceId)
      )

    const scoreByElementId = new Map(
      responses.map((response) => [
        response.assessmentElementId,
        response.scoreValue,
      ])
    )

    const targets = instanceElements.items
      .sort((a, b) => a.index - b.index)
      .map((item) => {
        const score = scoreByElementId.get(item.elementId) ?? 0
        return {
          target: item.targetText,
          score,
          ratingLabel: btpRatingLabel(score),
        }
      })

    summaries.push({
      assessmentResultId: row.assessmentResultId,
      assessmentDate: row.assessmentDate,
      targets,
    })
  }

  return summaries
}
