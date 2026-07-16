import { and, asc, eq, gte, inArray, lte } from "drizzle-orm"

import {
  assessmentDefinitions,
  assessmentElements,
  assessmentInstances,
  assessmentOptions,
  assessmentResponses,
  sessionNotes,
} from "@/db/schema"
import { db } from "@/lib/db"
import { MSE_ELEMENT_KEY_TO_FIELD } from "@/lib/mse/session-note-sentence"
import type { MseReportResultRow } from "@/lib/reports/snapshot"

async function buildMseRowsFromInstances(
  instances: {
    assessmentInstanceId: string
    sessionDate: string | Date
  }[]
): Promise<MseReportResultRow[]> {
  if (instances.length === 0) return []

  const instanceIds = instances.map((row) => row.assessmentInstanceId)
  const dateByInstance = new Map(
    instances.map((row) => [
      row.assessmentInstanceId,
      typeof row.sessionDate === "string"
        ? row.sessionDate
        : row.sessionDate.toISOString().slice(0, 10),
    ])
  )

  const responseRows = await db
    .select({
      assessmentInstanceId: assessmentResponses.assessmentInstanceId,
      elementKey: assessmentElements.elementKey,
      optionLabel: assessmentOptions.optionLabel,
      isReportingBaseline: assessmentOptions.isReportingBaseline,
    })
    .from(assessmentResponses)
    .innerJoin(
      assessmentElements,
      eq(
        assessmentResponses.assessmentElementId,
        assessmentElements.assessmentElementId
      )
    )
    .innerJoin(
      assessmentOptions,
      and(
        eq(
          assessmentOptions.assessmentElementId,
          assessmentResponses.assessmentElementId
        ),
        eq(assessmentOptions.optionValue, assessmentResponses.responseValue)
      )
    )
    .where(inArray(assessmentResponses.assessmentInstanceId, instanceIds))

  const fieldsByInstance = new Map<
    string,
    MseReportResultRow["fields"]
  >()

  for (const row of responseRows) {
    const fieldKey = MSE_ELEMENT_KEY_TO_FIELD[row.elementKey]
    if (!fieldKey) continue // skips suicidality

    const fields = fieldsByInstance.get(row.assessmentInstanceId) ?? {}
    fields[fieldKey] = {
      value: row.optionLabel,
      isBaseline: row.isReportingBaseline,
    }
    fieldsByInstance.set(row.assessmentInstanceId, fields)
  }

  return instances
    .map((instance) => {
      const date =
        dateByInstance.get(instance.assessmentInstanceId) ??
        (typeof instance.sessionDate === "string"
          ? instance.sessionDate
          : instance.sessionDate.toISOString().slice(0, 10))
      return {
        date,
        fields: fieldsByInstance.get(instance.assessmentInstanceId) ?? {},
      }
    })
    .sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
}

export async function loadMseResultsForDateRange(
  clientId: string,
  practiceId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<MseReportResultRow[]> {
  const startDate = rangeStart.toISOString().slice(0, 10)
  const endDate = rangeEnd.toISOString().slice(0, 10)

  const instances = await db
    .select({
      assessmentInstanceId: assessmentInstances.assessmentInstanceId,
      sessionDate: sessionNotes.sessionDate,
    })
    .from(assessmentInstances)
    .innerJoin(
      assessmentDefinitions,
      eq(
        assessmentInstances.assessmentDefinitionId,
        assessmentDefinitions.assessmentDefinitionId
      )
    )
    .innerJoin(
      sessionNotes,
      eq(sessionNotes.sessionNoteId, assessmentInstances.sessionNoteId)
    )
    .where(
      and(
        eq(assessmentInstances.clientId, clientId),
        eq(assessmentInstances.practiceId, practiceId),
        eq(assessmentDefinitions.assessmentCode, "mse"),
        gte(sessionNotes.sessionDate, startDate),
        lte(sessionNotes.sessionDate, endDate)
      )
    )
    .orderBy(asc(sessionNotes.sessionDate))

  return buildMseRowsFromInstances(instances)
}

export async function loadMseResultsForAppointments(
  clientId: string,
  practiceId: string,
  appointmentIds: string[]
): Promise<MseReportResultRow[]> {
  if (appointmentIds.length === 0) return []

  const instances = await db
    .select({
      assessmentInstanceId: assessmentInstances.assessmentInstanceId,
      sessionDate: sessionNotes.sessionDate,
    })
    .from(assessmentInstances)
    .innerJoin(
      assessmentDefinitions,
      eq(
        assessmentInstances.assessmentDefinitionId,
        assessmentDefinitions.assessmentDefinitionId
      )
    )
    .innerJoin(
      sessionNotes,
      eq(sessionNotes.sessionNoteId, assessmentInstances.sessionNoteId)
    )
    .where(
      and(
        eq(assessmentInstances.clientId, clientId),
        eq(assessmentInstances.practiceId, practiceId),
        eq(assessmentDefinitions.assessmentCode, "mse"),
        inArray(sessionNotes.appointmentId, appointmentIds)
      )
    )
    .orderBy(asc(sessionNotes.sessionDate))

  return buildMseRowsFromInstances(instances)
}
