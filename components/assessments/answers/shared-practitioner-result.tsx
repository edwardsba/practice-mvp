import Link from "next/link"

import { AnswerSections } from "@/components/assessments/answers/answer-sections"
import { ResultSummaryBox } from "@/components/assessments/answers/result-summary-box"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { Button } from "@/components/ui/button"
import { buildAnswerSections } from "@/lib/assessments/answer-rows"
import type { FormAnswers, FormElement } from "@/lib/assessments/form-rules"
import { buildPractitionerEditHref } from "@/lib/assessments/practitioner-routes"
import type { ResultSummaryLine } from "@/lib/assessments/result-summaries"
import { PRACTICE_TIMEZONE } from "@/lib/dates/practice-time"

function formatAssessmentDate(value: Date | string | null): string {
  if (!value) return "—"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: PRACTICE_TIMEZONE,
  })
}

function formatSessionDate(value: string | null): string {
  if (!value) return "—"
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number)
    const date = new Date(Date.UTC(year, month - 1, day, 12))
    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: PRACTICE_TIMEZONE,
    })
  }
  return formatAssessmentDate(value)
}

export function SharedPractitionerResultView({
  clientId,
  displayName,
  clientName,
  practitionerName,
  assessmentDate,
  sessionNoteId,
  sessionDate,
  instanceId,
  resultId,
  summaryRows,
  elements,
  answers,
}: {
  clientId: string
  /** assessment_name from the definition. */
  displayName: string
  clientName: string
  practitionerName: string
  assessmentDate: Date | string | null
  sessionNoteId: string | null
  sessionDate: string | null
  instanceId: string
  resultId: string
  summaryRows: ResultSummaryLine[] | null
  elements: FormElement[]
  answers: FormAnswers
}) {
  const sections = buildAnswerSections(elements, answers)
  const editHref = buildPractitionerEditHref({
    clientId,
    instanceId,
  })

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <BackButton
            page="/clients/[client_id]/results/[result_id]"
            data={{
              clientId,
              clientName,
              resultId,
              resultDate: assessmentDate,
            }}
          />

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {displayName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {clientName} · {practitionerName} ·{" "}
                {formatAssessmentDate(assessmentDate)}
              </p>
              {sessionNoteId ? (
                <p className="text-sm text-muted-foreground">
                  Session note:{" "}
                  <Link
                    href={`/session-notes/${sessionNoteId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {formatSessionDate(sessionDate)}
                  </Link>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Session note: not attached
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" className="min-h-11" asChild>
              <Link href={editHref}>Edit</Link>
            </Button>
          </div>
        </div>

        {summaryRows && summaryRows.length > 0 ? (
          <ResultSummaryBox rows={summaryRows} />
        ) : null}

        <AnswerSections sections={sections} />
      </div>
    </AppShell>
  )
}
