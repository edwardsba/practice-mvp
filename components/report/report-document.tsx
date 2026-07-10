import { ReportBtpResultsTable } from "@/components/report/btp-results-table"
import { EditableParagraph } from "@/components/report/editable-paragraph"
import type { ReportSnapshot } from "@/lib/reports/snapshot"
import {
  getAsqResultsFromSnapshot,
  getAssistResultsFromSnapshot,
  getBtpResultsFromSnapshot,
  getGad7ResultsFromSnapshot,
  getPhq9ResultsFromSnapshot,
} from "@/lib/reports/snapshot"
import { resolveTemplateKey } from "@/lib/reports/templates"
import {
  buildAssessmentSummaryParagraph,
  toAssessmentPoints,
} from "@/lib/assessment-summary/templates"
import { buildAsqSummarySentence } from "@/lib/assessment-summary/asq-template"
import { buildCrisisPlanSummarySentence } from "@/lib/assessment-summary/crisis-plan-summary"
import { buildSelfHarmHistorySentence } from "@/lib/assessment-summary/self-harm-history"
import { buildBtpSummaryParagraphs } from "@/lib/assessment-summary/btp-template"
import { buildTreatmentPlanSummary } from "@/lib/reports/treatment-plan-summary"
import {
  ReportAsqResultsTable,
  ReportResultsTable,
} from "@/components/report/results-table"

function formatDisplayDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatShortDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function LetterHeader({ snapshot }: { snapshot: ReportSnapshot }) {
  const recipientDisplayName =
    [
      snapshot.recipient?.title,
      snapshot.recipient?.firstName,
      snapshot.recipient?.lastName,
    ]
      .filter(Boolean)
      .join(" ") || snapshot.recipient?.name

  return (
    <>
      <div className="flex items-start justify-between text-sm">
        {snapshot.recipient && snapshot.recipient.type !== "none" ? (
          <div>
            {recipientDisplayName ? (
              <p className="font-medium">{recipientDisplayName}</p>
            ) : null}
            {snapshot.recipient.organisationName ? (
              <p>{snapshot.recipient.organisationName}</p>
            ) : null}
            {snapshot.recipient.streetAddress
              ? snapshot.recipient.streetAddress
                  .split(",")
                  .map((part) => part.trim())
                  .filter(Boolean)
                  .map((part, i) => (
                    <p key={`street-${i}`} className="text-muted-foreground">
                      {part}
                    </p>
                  ))
              : null}
            {snapshot.recipient.postalAddress &&
            snapshot.recipient.postalAddress !== snapshot.recipient.streetAddress
              ? snapshot.recipient.postalAddress
                  .split(",")
                  .map((part) => part.trim())
                  .filter(Boolean)
                  .map((part, i) => (
                    <p key={`postal-${i}`} className="text-muted-foreground">
                      {part}
                    </p>
                  ))
              : null}
          </div>
        ) : (
          <div />
        )}

        <div className="text-right">
          <p className="font-semibold">{snapshot.practice.practiceName}</p>
          {snapshot.practice.practiceAddress
            ? snapshot.practice.practiceAddress
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean)
                .map((part, i) => (
                  <p key={i} className="text-muted-foreground">
                    {part}
                  </p>
                ))
            : null}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {formatDisplayDate(snapshot.reportDate)}
      </p>
    </>
  )
}

function SignatureBlock({ snapshot }: { snapshot: ReportSnapshot }) {
  const practitionerLine = [snapshot.practitioner.title, snapshot.practitioner.fullName]
    .filter(Boolean)
    .join(" ")

  const practitionerLines = practitionerLine
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  return (
    <section className="report-signature">
      {snapshot.practitioner.signatureDataUrl ? (
        <img
          src={snapshot.practitioner.signatureDataUrl}
          alt="Signature"
          className="mt-4 h-16 w-auto object-contain"
        />
      ) : (
        <div className="mt-16" />
      )}
      {practitionerLines.map((line, i) => (
        <p key={i} className={i === 0 ? "mt-2 text-sm" : "text-sm text-muted-foreground"}>
          {line}
        </p>
      ))}
    </section>
  )
}

function ProgressReportBody({
  snapshot,
  readOnly = false,
  omitEmptySections = false,
  editable = false,
  onClinicalSummaryChange,
  onRecommendationsChange,
}: {
  snapshot: ReportSnapshot
  readOnly?: boolean
  omitEmptySections?: boolean
  editable?: boolean
  onClinicalSummaryChange?: (value: string) => void
  onRecommendationsChange?: (value: string) => void
}) {
  const phq9Results = getPhq9ResultsFromSnapshot(snapshot)
  const gad7Results = getGad7ResultsFromSnapshot(snapshot)
  const asqResults = getAsqResultsFromSnapshot(snapshot)
  const assistResults = getAssistResultsFromSnapshot(snapshot)
  const btpResults = getBtpResultsFromSnapshot(snapshot)

  const clinicalSummary = snapshot.clinicalSummaryText?.trim() || "—"
  const recommendations = snapshot.recommendationsText?.trim() || "—"

  const clientFirstName = snapshot.client.firstName

  const phq9Paragraph = buildAssessmentSummaryParagraph(
    "PHQ9",
    toAssessmentPoints(phq9Results),
    clientFirstName
  )
  const gad7Paragraph = buildAssessmentSummaryParagraph(
    "GAD7",
    toAssessmentPoints(gad7Results),
    clientFirstName
  )
  const assistParagraph = snapshot.assistEnabled
    ? buildAssessmentSummaryParagraph(
        "ASSIST",
        toAssessmentPoints(assistResults),
        clientFirstName
      )
    : null
  const asqSentence = buildAsqSummarySentence(
    asqResults.map((r) => ({
      date: r.date,
      recentPositive: r.recentPositive ?? false,
      currentPositive: r.currentPositive ?? false,
    }))
  )
  const selfHarmHistorySentence = buildSelfHarmHistorySentence(
    snapshot.suicideAttempts
  )
  const crisisPlanSentence = buildCrisisPlanSummarySentence(
    clientFirstName,
    snapshot.crisisPlanDate
  )
  const btpParagraphs = buildBtpSummaryParagraphs(btpResults)

  const treatmentPlanSummary = buildTreatmentPlanSummary(
    clientFirstName,
    snapshot.therapeuticTarget,
    snapshot.behaviouralTargets
  )

  return (
    <div className="space-y-4">
      <section className="report-client-details space-y-0.5 text-sm">
        <p>
          <span>Client name: </span>
          {snapshot.client.firstName} {snapshot.client.lastName}
        </p>
        <p>
          <span>Date of birth: </span>
          {formatDisplayDate(snapshot.client.dateOfBirth)}
        </p>
      </section>

      {snapshot.fundingApproval ? (
        <section className="report-funding-approval space-y-0.5 text-sm">
          <p>Approval type: {snapshot.fundingApproval.approvalTypeName}</p>
          {snapshot.fundingApproval.startDate ? (
            <p>
              Approval date:{" "}
              {formatDisplayDate(snapshot.fundingApproval.startDate)}
            </p>
          ) : null}
          <p>
            Progress: {snapshot.fundingApproval.appointmentsAttended} of{" "}
            {snapshot.fundingApproval.appointmentsApproved ?? "?"} appointments
            attended
          </p>
        </section>
      ) : null}

      {!snapshot.fundingApproval &&
      snapshot.dateRangeStart &&
      snapshot.dateRangeEnd ? (
        <section className="report-period text-sm">
          <p>
            <span className="font-medium">Reporting period: </span>
            {formatShortDate(snapshot.dateRangeStart)} –{" "}
            {formatShortDate(snapshot.dateRangeEnd)}
          </p>
        </section>
      ) : null}

      {snapshot.recipient?.type === "referrer" &&
      (snapshot.recipient.firstName || snapshot.recipient.name) ? (
        <section className="report-greeting space-y-2 text-sm">
          <p>
            Dear{" "}
            {snapshot.recipient.firstName ||
              snapshot.recipient.name?.split(" ")[0] ||
              "Doctor"}
            ,
          </p>
          <p>
            Thank you for your referral of {snapshot.client.firstName}{" "}
            {snapshot.client.lastName}. Please find below a summary of the objective
            assessments completed across this referral period.
          </p>
        </section>
      ) : null}

      <section className="report-treatment-plan-summary space-y-2">
        <h3 className="text-lg font-semibold">Treatment plan summary</h3>
        <p className="text-sm leading-relaxed">{treatmentPlanSummary}</p>
      </section>

      {(!omitEmptySections || phq9Paragraph || gad7Paragraph) ? (
        <section className="report-group-emotional-state space-y-2">
          <h3 className="text-sm font-semibold">
            Ongoing emotional state supervision
          </h3>
          <p className="text-sm leading-relaxed">
            As part of the treatment plan, ongoing emotional state was
            monitored for {clientFirstName} using the Patient Health
            Questionnaire (PHQ-9) and the Generalised Anxiety Disorder scale
            (GAD-7).
          </p>
          {phq9Paragraph ? (
            <p className="text-sm leading-relaxed">{phq9Paragraph}</p>
          ) : null}
          {gad7Paragraph ? (
            <p className="text-sm leading-relaxed">{gad7Paragraph}</p>
          ) : null}
        </section>
      ) : null}

      {(!omitEmptySections ||
        selfHarmHistorySentence ||
        asqSentence ||
        crisisPlanSentence) ? (
        <section className="report-group-risk space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Self-harm history</h3>
            <p className="text-sm leading-relaxed">{selfHarmHistorySentence}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">ASQ results summary</h3>
            <p className="text-sm leading-relaxed">
              Suicide risk was monitored throughout treatment using the Ask
              Suicide-Screening Questions (ASQ).
            </p>
            {asqSentence ? (
              <p className="text-sm leading-relaxed">{asqSentence}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Crisis plan</h3>
            <p className="text-sm leading-relaxed">{crisisPlanSentence}</p>
          </div>
        </section>
      ) : null}

      {(!omitEmptySections || btpParagraphs.length > 0 || assistParagraph) ? (
        <section className="report-group-behavioural-targets space-y-2">
          <h3 className="text-sm font-semibold">Behavioural targets</h3>
          <p className="text-sm leading-relaxed">
            Progress toward behavioural change was monitored using self-rated
            behavioural targets identified in the treatment plan
            {snapshot.assistEnabled
              ? " and the ASSIST substance-use screen"
              : ""}
            .
          </p>
          {btpParagraphs.map(({ target, paragraph }) => (
            <p key={target} className="text-sm leading-relaxed">
              {paragraph}
            </p>
          ))}
          {assistParagraph ? (
            <p className="text-sm leading-relaxed">{assistParagraph}</p>
          ) : null}
        </section>
      ) : null}

      <section className="report-clinical-summary space-y-2">
        <h3 className="text-lg font-semibold">Clinical summary</h3>
        {editable ? (
          <EditableParagraph
            value={snapshot.clinicalSummaryText ?? ""}
            onChange={(v) => onClinicalSummaryChange?.(v)}
            placeholder="Enter clinical summary…"
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {readOnly ? clinicalSummary : clinicalSummary === "—" ? "" : clinicalSummary}
          </p>
        )}
      </section>

      <section className="report-recommendations space-y-2">
        <h3 className="text-lg font-semibold">Recommendations</h3>
        {editable ? (
          <EditableParagraph
            value={snapshot.recommendationsText ?? ""}
            onChange={(v) => onRecommendationsChange?.(v)}
            placeholder="Enter recommendations…"
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {readOnly ? recommendations : recommendations === "—" ? "" : recommendations}
          </p>
        )}
      </section>

      {(!omitEmptySections ||
        phq9Results.length > 0 ||
        gad7Results.length > 0 ||
        assistResults.length > 0 ||
        asqResults.length > 0 ||
        btpResults.length > 0) ? (
        <section className="report-assessment-data space-y-4">
          <h3 className="text-lg font-semibold">Assessment Data</h3>

          {!omitEmptySections || phq9Results.length > 0 ? (
            <ReportResultsTable
              title="Patient Health Questionnaire 9 (PHQ-9) results"
              results={phq9Results}
              emptyMessage="No PHQ-9 results in this period."
              className="report-results-phq9"
              showImpairment
            />
          ) : null}

          {!omitEmptySections || gad7Results.length > 0 ? (
            <ReportResultsTable
              title="Generalised Anxiety Disorder 7 (GAD-7) results"
              results={gad7Results}
              emptyMessage="No GAD-7 results in this period."
              className="report-results-gad7"
              showImpairment
            />
          ) : null}

          {snapshot.assistEnabled &&
          (!omitEmptySections || assistResults.length > 0) ? (
            <ReportResultsTable
              title="Alcohol, Smoking and Substance Involvement Screening Test (ASSIST) results"
              results={assistResults}
              emptyMessage="No ASSIST results in this period."
              className="report-results-assist"
              severityColumnLabel="Risk Level"
              capitalizeSeverity={false}
            />
          ) : null}

          {!omitEmptySections || asqResults.length > 0 ? (
            <ReportAsqResultsTable
              results={asqResults}
              emptyMessage="No ASQ results in this period."
              className="report-results-asq"
            />
          ) : null}

          {!omitEmptySections || btpResults.length > 0 ? (
            <ReportBtpResultsTable
              results={btpResults}
              emptyMessage="No Behavioural Targets Progress results in this period."
              className="report-results-btp"
            />
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function ReferralAcknowledgementBody({
  snapshot,
  editable = false,
  onClinicalSummaryChange,
}: {
  snapshot: ReportSnapshot
  readOnly?: boolean
  editable?: boolean
  onClinicalSummaryChange?: (value: string) => void
}) {
  const fa = snapshot.fundingApproval
  const notes = snapshot.clinicalSummaryText?.trim() || ""

  const referrerFirstName =
    snapshot.recipient?.firstName?.trim() || null

  return (
    <div className="report-referral-ack space-y-4 text-sm">
      <section className="report-client-details space-y-0.5">
        <p>Client name: {snapshot.client.firstName} {snapshot.client.lastName}</p>
        {snapshot.client.dateOfBirth ? (
          <p>Date of birth: {formatDisplayDate(snapshot.client.dateOfBirth)}</p>
        ) : null}
      </section>

      {fa ? (
        <section className="report-funding-approval space-y-0.5">
          <p>Approval type: {fa.approvalTypeName}</p>
          {fa.startDate ? (
            <p>Approval date: {formatDisplayDate(fa.startDate)}</p>
          ) : null}
          <p>
            Progress: {fa.appointmentsAttended} of{" "}
            {fa.appointmentsApproved ?? "?"} appointments attended
          </p>
        </section>
      ) : null}

      <p>Dear {referrerFirstName ?? "Colleague"},</p>

      <p>
        Thank you for your referral of {snapshot.client.firstName}{" "}
        {snapshot.client.lastName}. I am writing to confirm that the referral
        has been received and treatment has commenced.
      </p>

      <p>
        I will update you with progress in due course. Please do not hesitate
        to contact me should you require any further information.
      </p>

      {editable ? (
        <EditableParagraph
          value={snapshot.clinicalSummaryText ?? ""}
          onChange={(v) => onClinicalSummaryChange?.(v)}
          placeholder="Add any additional notes for this letter…"
        />
      ) : notes ? (
        <p className="whitespace-pre-wrap">{notes}</p>
      ) : null}

      <p>Yours sincerely,</p>
    </div>
  )
}

export function ReportDocument({
  snapshot,
  readOnly = false,
  omitEmptySections = false,
  editable = false,
  onClinicalSummaryChange,
  onRecommendationsChange,
}: {
  snapshot: ReportSnapshot
  readOnly?: boolean
  omitEmptySections?: boolean
  editable?: boolean
  onClinicalSummaryChange?: (value: string) => void
  onRecommendationsChange?: (value: string) => void
}) {
  const templateKey = resolveTemplateKey(snapshot.templateKey)

  return (
    <article className="report-document mx-auto max-w-3xl bg-white text-foreground">
      <header className="report-header space-y-6 pb-6">
        <LetterHeader snapshot={snapshot} />
        <h2 className="text-lg font-semibold">{snapshot.reportTitle}</h2>
      </header>
      {templateKey === "referral_acknowledgement" ? (
        <ReferralAcknowledgementBody
          snapshot={snapshot}
          readOnly={readOnly}
          editable={editable}
          onClinicalSummaryChange={onClinicalSummaryChange}
        />
      ) : (
        <ProgressReportBody
          snapshot={snapshot}
          readOnly={readOnly}
          omitEmptySections={omitEmptySections}
          editable={editable}
          onClinicalSummaryChange={onClinicalSummaryChange}
          onRecommendationsChange={onRecommendationsChange}
        />
      )}
      <SignatureBlock snapshot={snapshot} />
    </article>
  )
}
