import { ReportBtpResultsTable } from "@/components/report/btp-results-table"
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
}: {
  snapshot: ReportSnapshot
  readOnly?: boolean
  omitEmptySections?: boolean
}) {
  const phq9Results = getPhq9ResultsFromSnapshot(snapshot)
  const gad7Results = getGad7ResultsFromSnapshot(snapshot)
  const asqResults = getAsqResultsFromSnapshot(snapshot)
  const assistResults = getAssistResultsFromSnapshot(snapshot)
  const btpResults = getBtpResultsFromSnapshot(snapshot)

  const clinicalSummary = snapshot.clinicalSummaryText?.trim() || "—"
  const recommendations = snapshot.recommendationsText?.trim() || "—"

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

      {(!omitEmptySections ||
        phq9Results.length > 0 ||
        gad7Results.length > 0 ||
        assistResults.length > 0) ? (
        <section className="report-group-ongoing space-y-3">
          <h3 className="text-sm font-semibold">Ongoing objective assessments</h3>

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

          {!omitEmptySections || assistResults.length > 0 ? (
            <ReportResultsTable
              title="Alcohol, Smoking and Substance Involvement Screening Test (ASSIST) results"
              results={assistResults}
              emptyMessage="No ASSIST results in this period."
              className="report-results-assist"
              severityColumnLabel="Risk Level"
              capitalizeSeverity={false}
            />
          ) : null}
        </section>
      ) : null}

      {!omitEmptySections || asqResults.length > 0 ? (
        <section className="report-group-risk space-y-3">
          <h3 className="text-sm font-semibold">Risk assessments</h3>

          {!omitEmptySections || asqResults.length > 0 ? (
            <ReportAsqResultsTable
              results={asqResults}
              emptyMessage="No ASQ results in this period."
              className="report-results-asq"
            />
          ) : null}
        </section>
      ) : null}

      {!omitEmptySections || btpResults.length > 0 ? (
        <ReportBtpResultsTable
          results={btpResults}
          emptyMessage="No Behavioural Targets Progress results in this period."
          className="report-results-btp"
          therapeuticTarget={snapshot.therapeuticTarget ?? null}
          clientFirstName={snapshot.client.firstName}
        />
      ) : null}

      <section className="report-clinical-summary space-y-2">
        <h3 className="text-lg font-semibold">Clinical summary</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {readOnly ? clinicalSummary : clinicalSummary === "—" ? "" : clinicalSummary}
        </p>
      </section>

      <section className="report-recommendations space-y-2">
        <h3 className="text-lg font-semibold">Recommendations</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {readOnly ? recommendations : recommendations === "—" ? "" : recommendations}
        </p>
      </section>
    </div>
  )
}

function ReferralAcknowledgementBody({
  snapshot,
}: {
  snapshot: ReportSnapshot
  readOnly?: boolean
}) {
  const clientName = `${snapshot.client.firstName} ${snapshot.client.lastName}`
  const recipientName = snapshot.recipient?.name?.trim()
  const salutation = recipientName ? `Dear ${recipientName},` : "Dear Colleague,"
  const fa = snapshot.fundingApproval
  const notes = snapshot.clinicalSummaryText?.trim() || ""

  return (
    <div className="report-referral-ack space-y-4 pt-4 text-sm leading-relaxed">
      <p>
        <span className="font-medium">Re: </span>
        {clientName}
        {snapshot.client.dateOfBirth
          ? ` (DOB ${formatDisplayDate(snapshot.client.dateOfBirth)})`
          : ""}
      </p>

      <p>{salutation}</p>

      <p>
        Thank you for your referral of {clientName} to{" "}
        {snapshot.practice.practiceName}. I am writing to confirm that the
        referral has been received
        {fa ? ` under the ${fa.approvalTypeName}` : ""}
        {fa?.startDate ? `, dated ${formatDisplayDate(fa.startDate)}` : ""}
        {fa?.appointmentsApproved != null
          ? `, approving ${fa.appointmentsApproved} session${
              fa.appointmentsApproved === 1 ? "" : "s"
            }`
          : ""}
        .
      </p>

      <p>
        An appointment has been arranged and {clientName} will be contacted to
        commence treatment. I will provide progress reports in accordance with
        the referral&apos;s reporting requirements.
      </p>

      {notes ? <p className="whitespace-pre-wrap">{notes}</p> : null}

      <p>
        Please do not hesitate to contact me should you require any further
        information.
      </p>
    </div>
  )
}

export function ReportDocument({
  snapshot,
  readOnly = false,
  omitEmptySections = false,
}: {
  snapshot: ReportSnapshot
  readOnly?: boolean
  omitEmptySections?: boolean
}) {
  const templateKey = resolveTemplateKey(snapshot.templateKey)

  return (
    <article className="report-document mx-auto max-w-3xl bg-white text-foreground">
      <header className="report-header space-y-6 pb-6">
        <LetterHeader snapshot={snapshot} />
        <h2 className="text-lg font-semibold">{snapshot.reportTitle}</h2>
      </header>
      {templateKey === "referral_acknowledgement" ? (
        <ReferralAcknowledgementBody snapshot={snapshot} readOnly={readOnly} />
      ) : (
        <ProgressReportBody
          snapshot={snapshot}
          readOnly={readOnly}
          omitEmptySections={omitEmptySections}
        />
      )}
      <SignatureBlock snapshot={snapshot} />
    </article>
  )
}
