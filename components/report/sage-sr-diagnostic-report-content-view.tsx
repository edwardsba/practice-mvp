import type { SageSrDiagnosticReportContent } from "@/lib/assessment-summary/load-sage-sr-diagnostic-report"

/**
 * Read-only rendering of a SAGE-SR Diagnostic Report's generated content — the same
 * five sections (Introduction, Exclusion Clause, Background, Core, Personality) in the
 * same order and styling as the live preview inside the "Create Report" composer
 * (app/clients/[client_id]/reports/new/report-form.tsx's isSageDiagnostic branch).
 *
 * Extracted so the composer's preview and the saved-report view
 * (app/clients/[client_id]/reports/sage-sr/[report_id]/page.tsx) render identically
 * from one place instead of two copies of the same JSX drifting apart. Deliberately
 * content-only — it does not own the composer's loading/empty/error gating states,
 * which stay in report-form.tsx since they don't apply to a saved report.
 *
 * Finalised reports pass showNoPdfCaveat={false} because a real PDF exists then;
 * the composer preview still uses the default (true) since nothing has been saved.
 */
export function SageSrDiagnosticReportContentView({
  title,
  content,
  showNoPdfCaveat = true,
}: {
  title: string
  content: SageSrDiagnosticReportContent
  showNoPdfCaveat?: boolean
}) {
  return (
    <article className="report-document mx-auto max-w-3xl space-y-6 bg-white text-foreground">
      <h2 className="text-lg font-semibold">{title}</h2>
      {content.introduction ? (
        <p className="text-sm">{content.introduction}</p>
      ) : null}
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        {content.exclusionClause}
      </div>
      {content.background ? (
        <div className="space-y-2">
          <h3 className="font-medium">Background</h3>
          {[
            content.background.opening,
            content.background.background,
            content.background.adverseChildhoodEvents,
            content.background.currentFunctioning,
            content.background.safetyAndStability,
            content.background.treatmentEngagement,
          ]
            .filter((text): text is string => Boolean(text))
            .map((text, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                {text}
              </p>
            ))}
        </div>
      ) : null}
      <div className="space-y-2">
        <h3 className="font-medium">Core</h3>
        {content.core.alertsSentence ? (
          <p className="text-sm font-medium text-destructive">
            {content.core.alertsSentence}
          </p>
        ) : null}
        {content.core.paragraphs.map((p) => (
          <p key={p.diagnosis} className="text-sm text-muted-foreground">
            {p.paragraph}
          </p>
        ))}
        {content.core.furtherEvaluationSentence ? (
          <p className="text-sm text-muted-foreground">
            {content.core.furtherEvaluationSentence}
          </p>
        ) : null}
        {content.core.absentOrMinimalSentence ? (
          <p className="text-sm text-muted-foreground">
            {content.core.absentOrMinimalSentence}
          </p>
        ) : null}
      </div>
      {content.personality ? (
        <div className="space-y-2">
          <h3 className="font-medium">Personality</h3>
          {content.personality.paragraphs.map((p) => (
            <p key={p.disorder} className="text-sm text-muted-foreground">
              {p.paragraph}
            </p>
          ))}
          {content.personality.belowThresholdSentence ? (
            <p className="text-sm text-muted-foreground">
              {content.personality.belowThresholdSentence}
            </p>
          ) : null}
        </div>
      ) : null}
      {showNoPdfCaveat ? (
        <p className="text-xs text-muted-foreground">
          This is a plain-text content preview only — there is no formatted PDF for the
          SAGE-SR Diagnostic Report yet.
        </p>
      ) : null}
    </article>
  )
}
