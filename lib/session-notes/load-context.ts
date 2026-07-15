import { and, desc, eq } from "drizzle-orm"

import {
  assessmentDefinitions,
  assessmentInstances,
  assessmentResponses,
  assessmentResults,
  crisisPlans,
  practitionerProfiles,
} from "@/db/schema"
import {
  btpRatingLabel,
  parseBtpInstanceElementsJson,
} from "@/lib/assessments/btp"
import {
  formatPractitionerName,
  formatPractitionerPreferredName,
} from "@/lib/practitioner/format"
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
  assessmentDate: Date
  score: number
  maxScore: number | null
  acuteRiskRating: string | null
} | null

export type SessionNoteMseInstance = {
  assessmentInstanceId: string
  status: string
  submittedAt: Date | null
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
  treatmentPlan: {
    treatmentPlanId: string
    versionNumber: number
    startDate: string
    therapeuticTarget: string | null
  } | null
  btpTargets: SessionNoteBtpTarget[]
  assessments: SessionNoteAssessmentResult[]
  asqResult: SessionNoteAsqResult
  mseInstance: SessionNoteMseInstance
  crisisPlan: SessionNoteCrisisPlanInfo
  nextAppointment: SessionNoteNextAppointment
  practitionerName: string
  practitionerTitle: string | null
  practitionerDisplayName: string
}

type SessionNoteRow = NonNullable<
  Awaited<ReturnType<typeof loadSessionNoteForPractice>>
>

const RESULT_COLUMNS = {
  assessmentResultId: assessmentResults.assessmentResultId,
  assessmentInstanceId: assessmentResults.assessmentInstanceId,
  assessmentDate: assessmentResults.assessmentDate,
  score: assessmentResults.score,
  severity: assessmentResults.severity,
  acuteRiskRating: assessmentResults.acuteRiskRating,
  assessmentDefinitionId: assessmentInstances.assessmentDefinitionId,
  assessmentCode: assessmentDefinitions.assessmentCode,
  assessmentName: assessmentDefinitions.assessmentName,
} as const

async function loadResultByAppointment(appointmentId: string, assessmentCode: string) {
  const [row] = await db
    .select(RESULT_COLUMNS)
    .from(assessmentInstances)
    .innerJoin(
      assessmentResults,
      eq(assessmentResults.assessmentInstanceId, assessmentInstances.assessmentInstanceId)
    )
    .innerJoin(
      assessmentDefinitions,
      eq(assessmentInstances.assessmentDefinitionId, assessmentDefinitions.assessmentDefinitionId)
    )
    .where(
      and(
        eq(assessmentInstances.appointmentId, appointmentId),
        eq(assessmentDefinitions.assessmentCode, assessmentCode)
      )
    )
    .orderBy(desc(assessmentResults.assessmentDate))
    .limit(1)

  return row ?? null
}

async function loadResultBySessionNote(sessionNoteId: string, assessmentCode: string) {
  const [row] = await db
    .select(RESULT_COLUMNS)
    .from(assessmentInstances)
    .innerJoin(
      assessmentResults,
      eq(assessmentResults.assessmentInstanceId, assessmentInstances.assessmentInstanceId)
    )
    .innerJoin(
      assessmentDefinitions,
      eq(assessmentInstances.assessmentDefinitionId, assessmentDefinitions.assessmentDefinitionId)
    )
    .where(
      and(
        eq(assessmentInstances.sessionNoteId, sessionNoteId),
        eq(assessmentDefinitions.assessmentCode, assessmentCode)
      )
    )
    .orderBy(desc(assessmentResults.assessmentDate))
    .limit(1)

  return row ?? null
}

async function buildAssessmentResult(
  row: Awaited<ReturnType<typeof loadResultByAppointment>>,
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
  if (!note.appointmentId) {
    return []
  }

  const btpResult = await loadResultByAppointment(note.appointmentId, "BTP")

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
  const row = note.appointmentId
    ? await loadResultByAppointment(note.appointmentId, code)
    : null

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
  const row = await loadResultBySessionNote(note.sessionNoteId, "ASQ")

  if (!row) {
    return null
  }

  const maxScore = await getMaxScoreForAssessmentDefinition(
    row.assessmentDefinitionId
  )

  return {
    assessmentResultId: row.assessmentResultId,
    assessmentDate: row.assessmentDate,
    score: row.score,
    maxScore,
    acuteRiskRating: row.severity,
  }
}

async function loadMseForSession(
  note: SessionNoteRow
): Promise<SessionNoteMseInstance> {
  const [row] = await db
    .select({
      assessmentInstanceId: assessmentInstances.assessmentInstanceId,
      status: assessmentInstances.status,
      submittedAt: assessmentInstances.submittedAt,
    })
    .from(assessmentInstances)
    .innerJoin(
      assessmentDefinitions,
      eq(
        assessmentInstances.assessmentDefinitionId,
        assessmentDefinitions.assessmentDefinitionId
      )
    )
    .where(
      and(
        eq(assessmentInstances.sessionNoteId, note.sessionNoteId),
        eq(assessmentDefinitions.assessmentCode, "mse")
      )
    )
    .orderBy(desc(assessmentInstances.submittedAt))
    .limit(1)

  return row ?? null
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
      firstName: practitionerProfiles.firstName,
      preferredName: practitionerProfiles.preferredName,
      lastName: practitionerProfiles.lastName,
      reportSignature: practitionerProfiles.reportSignature,
      title: practitionerProfiles.title,
    })
    .from(practitionerProfiles)
    .where(
      eq(practitionerProfiles.practitionerProfileId, note.practitionerProfileId)
    )
    .limit(1)

  const [phq9, gad7, assist, btpTargets, asqResult, mseInstance, crisisPlan, nextAppt] =
    await Promise.all([
      loadAssessmentForSession(note, "PHQ9", PHQ9_IMPAIRMENT_ELEMENT_KEY),
      loadAssessmentForSession(note, "GAD7", GAD7_IMPAIRMENT_ELEMENT_KEY),
      loadAssessmentForSession(note, "ASSIST"),
      loadBtpForSession(note),
      loadAsqForSession(note),
      loadMseForSession(note),
      loadCrisisPlanForSession(note),
      loadNextAppointmentAfterSession(
        note.clientId,
        note.practiceId,
        note.sessionDate,
        note.sessionTime
      ),
    ])

  return {
    treatmentPlan: treatmentPlan
      ? {
          treatmentPlanId: treatmentPlan.treatmentPlanId,
          versionNumber: treatmentPlan.versionNumber,
          startDate: treatmentPlan.startDate ?? "",
          therapeuticTarget: treatmentPlan.therapeuticTarget?.trim() || null,
        }
      : null,
    btpTargets,
    assessments: [phq9, gad7, assist],
    asqResult,
    mseInstance,
    crisisPlan,
    nextAppointment: nextAppt
      ? {
          appointmentId: nextAppt.appointmentId,
          label: formatNextAppointmentLine(
            nextAppt.appointmentDate,
            nextAppt.appointmentTime,
            nextAppt.location,
            nextAppt.mode,
            nextAppt.practiceLocationNickname ?? null,
            nextAppt.practiceAddress ?? null,
            nextAppt.practiceName ?? ""
          ),
        }
      : null,
    practitionerName: practitioner ? formatPractitionerName(practitioner) : "",
    practitionerTitle: practitioner?.title ?? null,
    practitionerDisplayName: practitioner
      ? [practitioner.title?.trim(), formatPractitionerPreferredName(practitioner)]
          .filter(Boolean)
          .join(" ")
      : "",
  }
}
