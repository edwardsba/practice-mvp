import { and, desc, eq } from "drizzle-orm"

import {
  assessmentDefinitions,
  assessmentInstances,
  assessmentResponses,
  assessmentResults,
  batteryInstances,
  crisisPlans,
  practitionerProfiles,
} from "@/db/schema"
import {
  btpRatingLabel,
  parseBtpInstanceElementsJson,
} from "@/lib/assessments/btp"
import {
  GAD7_IMPAIRMENT_ELEMENT_KEY,
  getFunctionalImpairmentLabelForResult,
  PHQ9_IMPAIRMENT_ELEMENT_KEY,
} from "@/lib/assessments/impairment"
import { getMaxScoreForAssessmentDefinition } from "@/lib/assessments/max-score"
import { db } from "@/lib/db"
import { loadActiveCrisisPlanSummary } from "@/lib/crisis-plans/load"
import { loadActiveTreatmentPlanSummary } from "@/lib/treatment-plans/load"
import { assessmentDateMatchesSessionDate } from "@/lib/session-notes/dates"
import { formatNextAppointmentLine } from "@/lib/session-notes/format"
import { loadNextAppointmentAfterSession } from "@/lib/session-notes/load"
import type { loadSessionNoteForPractice } from "@/lib/session-notes/load"

export type SessionNoteBtpTarget = {
  target: string
  score: number
  ratingLabel: string
}

export type SessionNoteAssessmentResult = {
  code: string
  name: string
  assessmentResultId: string | null
  score: number | null
  maxScore: number | null
  severity: string | null
  functionalImpairmentLabel: string | null
}

export type SessionNoteAsqResult = {
  assessmentResultId: string
  score: number
  acuteRiskRating: string | null
} | null

export type SessionNoteCrisisPlanInfo = {
  crisisPlanId: string
  versionNumber: number
  dateOfPlan: string
  updatedThisSession: boolean
} | null

export type SessionNoteNextAppointment = {
  appointmentId: string
  label: string
} | null

export type SessionNoteViewContext = {
  therapeuticTarget: string | null
  btpTargets: SessionNoteBtpTarget[]
  assessments: SessionNoteAssessmentResult[]
  asqResult: SessionNoteAsqResult
  crisisPlan: SessionNoteCrisisPlanInfo
  nextAppointment: SessionNoteNextAppointment
  practitionerName: string
  practitionerTitle: string | null
}

type SessionNoteRow = NonNullable<
  Awaited<ReturnType<typeof loadSessionNoteForPractice>>
>

async function loadResultForInstance(instanceId: string) {
  const [row] = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      assessmentInstanceId: assessmentResults.assessmentInstanceId,
      assessmentDate: assessmentResults.assessmentDate,
      score: assessmentResults.score,
      severity: assessmentResults.severity,
      assessmentDefinitionId: assessmentInstances.assessmentDefinitionId,
      assessmentCode: assessmentDefinitions.assessmentCode,
      assessmentName: assessmentDefinitions.assessmentName,
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
    .where(eq(assessmentResults.assessmentInstanceId, instanceId))
    .limit(1)

  return row ?? null
}

async function loadResultForCodeOnSessionDate(
  clientId: string,
  practiceId: string,
  assessmentCode: string,
  sessionDate: string
) {
  const rows = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      assessmentInstanceId: assessmentResults.assessmentInstanceId,
      assessmentDate: assessmentResults.assessmentDate,
      score: assessmentResults.score,
      severity: assessmentResults.severity,
      assessmentDefinitionId: assessmentInstances.assessmentDefinitionId,
      assessmentCode: assessmentDefinitions.assessmentCode,
      assessmentName: assessmentDefinitions.assessmentName,
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
        eq(assessmentDefinitions.assessmentCode, assessmentCode)
      )
    )
    .orderBy(desc(assessmentResults.assessmentDate))

  return (
    rows.find((row) =>
      assessmentDateMatchesSessionDate(row.assessmentDate, sessionDate)
    ) ?? null
  )
}

async function buildAssessmentResult(
  row: NonNullable<Awaited<ReturnType<typeof loadResultForInstance>>>,
  impairmentElementKey?: string
): Promise<SessionNoteAssessmentResult> {
  if (!row) {
    return {
      code: "",
      name: "",
      assessmentResultId: null,
      score: null,
      maxScore: null,
      severity: null,
      functionalImpairmentLabel: null,
    }
  }

  const maxScore = await getMaxScoreForAssessmentDefinition(
    row.assessmentDefinitionId
  )

  const functionalImpairmentLabel = impairmentElementKey
    ? await getFunctionalImpairmentLabelForResult(
        row.assessmentInstanceId,
        impairmentElementKey
      )
    : null

  return {
    code: row.assessmentCode,
    name: row.assessmentName,
    assessmentResultId: row.assessmentResultId,
    score: row.score,
    maxScore,
    severity: row.severity,
    functionalImpairmentLabel,
  }
}

async function loadBtpForSession(
  note: SessionNoteRow
): Promise<SessionNoteBtpTarget[]> {
  const btpResult = await loadResultForCodeOnSessionDate(
    note.clientId,
    note.practiceId,
    "BTP",
    note.sessionDate
  )

  if (!btpResult) {
    return []
  }

  const [instance] = await db
    .select({
      instanceElementsJson: assessmentInstances.instanceElementsJson,
    })
    .from(assessmentInstances)
    .where(
      eq(assessmentInstances.assessmentInstanceId, btpResult.assessmentInstanceId)
    )
    .limit(1)

  const instanceElements = parseBtpInstanceElementsJson(
    instance?.instanceElementsJson
  )
  if (!instanceElements?.items.length) {
    return []
  }

  const responseRows = await db
    .select({
      assessmentElementId: assessmentResponses.assessmentElementId,
      scoreValue: assessmentResponses.scoreValue,
    })
    .from(assessmentResponses)
    .where(
      eq(assessmentResponses.assessmentInstanceId, btpResult.assessmentInstanceId)
    )

  const scoreByElementId = new Map(
    responseRows.map((row) => [row.assessmentElementId, row.scoreValue])
  )

  return instanceElements.items
    .sort((a, b) => a.index - b.index)
    .map((item) => {
      const score = scoreByElementId.get(item.elementId) ?? 0
      return {
        target: item.targetText,
        score,
        ratingLabel: btpRatingLabel(score),
      }
    })
}

async function loadAssessmentForSession(
  note: SessionNoteRow,
  code: string,
  impairmentElementKey?: string
): Promise<SessionNoteAssessmentResult> {
  let row: Awaited<ReturnType<typeof loadResultForInstance>> | null = null

  if (note.batteryInstanceId && (code === "PHQ9" || code === "GAD7")) {
    const [battery] = await db
      .select({
        phq9InstanceId: batteryInstances.phq9InstanceId,
        gad7InstanceId: batteryInstances.gad7InstanceId,
      })
      .from(batteryInstances)
      .where(eq(batteryInstances.batteryInstanceId, note.batteryInstanceId))
      .limit(1)

    if (battery) {
      const instanceId =
        code === "PHQ9" ? battery.phq9InstanceId : battery.gad7InstanceId
      row = await loadResultForInstance(instanceId)
    }
  }

  if (!row) {
    row = await loadResultForCodeOnSessionDate(
      note.clientId,
      note.practiceId,
      code,
      note.sessionDate
    )
  }

  if (!row) {
    const names: Record<string, string> = {
      PHQ9: "PHQ-9",
      GAD7: "GAD-7",
      ASSIST: "ASSIST",
    }
    return {
      code,
      name: names[code] ?? code,
      assessmentResultId: null,
      score: null,
      maxScore: null,
      severity: null,
      functionalImpairmentLabel: null,
    }
  }

  return buildAssessmentResult(row, impairmentElementKey)
}

async function loadAsqForSession(
  note: SessionNoteRow
): Promise<SessionNoteAsqResult> {
  const rows = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      assessmentDate: assessmentResults.assessmentDate,
      score: assessmentResults.score,
      acuteRiskRating: assessmentResults.acuteRiskRating,
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
        eq(assessmentResults.clientId, note.clientId),
        eq(assessmentResults.practiceId, note.practiceId),
        eq(assessmentDefinitions.assessmentCode, "ASQ")
      )
    )
    .orderBy(desc(assessmentResults.assessmentDate))

  const match = rows.find((row) =>
    assessmentDateMatchesSessionDate(row.assessmentDate, note.sessionDate)
  )

  if (!match) {
    return null
  }

  return {
    assessmentResultId: match.assessmentResultId,
    score: match.score,
    acuteRiskRating: match.acuteRiskRating,
  }
}

async function loadCrisisPlanForSession(
  note: SessionNoteRow
): Promise<SessionNoteCrisisPlanInfo> {
  const active = await loadActiveCrisisPlanSummary(note.clientId, note.practiceId)
  if (!active) {
    return null
  }

  const [planRow] = await db
    .select({
      updatedAt: crisisPlans.updatedAt,
      createdAt: crisisPlans.createdAt,
    })
    .from(crisisPlans)
    .where(eq(crisisPlans.crisisPlanId, active.crisisPlanId))
    .limit(1)

  const updatedThisSession =
    !!planRow &&
    (assessmentDateMatchesSessionDate(planRow.updatedAt, note.sessionDate) ||
      assessmentDateMatchesSessionDate(planRow.createdAt, note.sessionDate))

  return {
    crisisPlanId: active.crisisPlanId,
    versionNumber: active.versionNumber,
    dateOfPlan: active.dateOfPlan,
    updatedThisSession,
  }
}

export async function loadSessionNoteViewContext(
  note: SessionNoteRow
): Promise<SessionNoteViewContext> {
  const treatmentPlan = await loadActiveTreatmentPlanSummary(
    note.clientId,
    note.practiceId
  )

  const [practitioner] = await db
    .select({
      fullName: practitionerProfiles.fullName,
      title: practitionerProfiles.title,
    })
    .from(practitionerProfiles)
    .where(
      eq(practitionerProfiles.practitionerProfileId, note.practitionerProfileId)
    )
    .limit(1)

  const [phq9, gad7, assist, btpTargets, asqResult, crisisPlan, nextAppt] =
    await Promise.all([
      loadAssessmentForSession(note, "PHQ9", PHQ9_IMPAIRMENT_ELEMENT_KEY),
      loadAssessmentForSession(note, "GAD7", GAD7_IMPAIRMENT_ELEMENT_KEY),
      loadAssessmentForSession(note, "ASSIST"),
      loadBtpForSession(note),
      loadAsqForSession(note),
      loadCrisisPlanForSession(note),
      loadNextAppointmentAfterSession(
        note.clientId,
        note.practiceId,
        note.sessionDate,
        note.sessionTime
      ),
    ])

  return {
    therapeuticTarget: treatmentPlan?.therapeuticTarget?.trim() || null,
    btpTargets,
    assessments: [phq9, gad7, assist],
    asqResult,
    crisisPlan,
    nextAppointment: nextAppt
      ? {
          appointmentId: nextAppt.appointmentId,
          label: formatNextAppointmentLine(
            nextAppt.appointmentDate,
            nextAppt.appointmentTime,
            nextAppt.location
          ),
        }
      : null,
    practitionerName: practitioner?.fullName ?? "",
    practitionerTitle: practitioner?.title ?? null,
  }
}
