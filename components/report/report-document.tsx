import { ReportBtpResultsTable } from "@/components/report/btp-results-table"
import { REPORT_TITLE, type ReportSnapshot } from "@/lib/reports/snapshot"
import {
  getAsqResultsFromSnapshot,
  getAssistResultsFromSnapshot,
  getBtpResultsFromSnapshot,
  getGad7ResultsFromSnapshot,
  getPhq9ResultsFromSnapshot,
} from "@/lib/reports/snapshot"
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

export function ReportDocument({
  snapshot,
  readOnly = false,
  omitEmptySections = false,
}: {
  snapshot: ReportSnapshot
  readOnly?: boolean
  /** Saved/printed reports: hide assessment sections with no rows. */
  omitEmptySections?: boolean
}) {
  const practitionerLine = [snapshot.practitioner.title, snapshot.practitioner.fullName]
    .filter(Boolean)
    .join(" ")

  const phq9Results = getPhq9ResultsFromSnapshot(snapshot)
  const gad7Results = getGad7ResultsFromSnapshot(snapshot)
  const asqResults = getAsqResultsFromSnapshot(snapshot)
  const assistResults = getAssistResultsFromSnapshot(snapshot)
  const btpResults = getBtpResultsFromSnapshot(snapshot)

  const clinicalSummary = snapshot.clinicalSummaryText?.trim() || "—"
  const recommendations = snapshot.recommendationsText?.trim() || "—"

  return (
    <article className="report-document mx-auto max-w-3xl bg-white text-foreground">
      {/* 1. Header */}
      <header className="report-header space-y-6 border-b pb-6">
        <div className="flex justify-end text-sm">
          <div className="text-right">
            <p className="font-semibold">{snapshot.practice.practiceName}</p>
            {snapshot.practice.practiceAddress ? (
              <p className="text-muted-foreground">
                {snapshot.practice.practiceAddress}
              </p>
            ) : null}
          </div>
        </div>

        {snapshot.recipient && snapshot.recipient.type !== "none" ? (
          <div className="text-sm">
            {snapshot.recipient.name ? (
              <p className="font-medium">{snapshot.recipient.name}</p>
            ) : null}
            {snapshot.recipient.organisationName ? (
              <p>{snapshot.recipient.organisationName}</p>
            ) : null}
            {snapshot.recipient.streetAddress ? (
              <p className="text-muted-foreground">
                {snapshot.recipient.streetAddress}
              </p>
            ) : null}
            {snapshot.recipient.postalAddress &&
            snapshot.recipient.postalAddress !==
              snapshot.recipient.streetAddress ? (
              <p className="text-muted-foreground">
                {snapshot.recipient.postalAddress}
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {formatDisplayDate(snapshot.generatedAt)}
        </p>

        <h2 className="text-2xl font-semibold tracking-tight">{REPORT_TITLE}</h2>

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-muted-foreground">Client</dt>
            <dd>
              {snapshot.client.firstName} {snapshot.client.lastName}
            </dd>
            <dd className="text-muted-foreground">
              Date of birth: {formatDisplayDate(snapshot.client.dateOfBirth)}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Practitioner</dt>
            <dd>{practitionerLine}</dd>
            <dd className="text-muted-foreground">{snapshot.practice.practiceName}</dd>
          </div>
        </dl>
      </header>

      {/* 2. Reporting period */}
      <section className="report-period pt-4 text-sm">
        <span className="font-medium">Reporting period: </span>
        {formatShortDate(snapshot.dateRangeStart)} –{" "}
        {formatShortDate(snapshot.dateRangeEnd)}
      </section>

      {(!omitEmptySections || phq9Results.length > 0) ? (
        <ReportResultsTable
          title="PHQ-9 results"
          results={phq9Results}
          emptyMessage="No PHQ-9 results in this date range."
          className="report-results-phq9"
          showImpairment
        />
      ) : null}

      {(!omitEmptySections || gad7Results.length > 0) ? (
        <ReportResultsTable
          title="GAD-7 results"
          results={gad7Results}
          emptyMessage="No GAD-7 results in this date range."
          className="report-results-gad7"
          showImpairment
        />
      ) : null}

      {(!omitEmptySections || asqResults.length > 0) ? (
        <ReportAsqResultsTable
          results={asqResults}
          emptyMessage="No ASQ results in this date range."
          className="report-results-asq"
        />
      ) : null}

      {(!omitEmptySections || assistResults.length > 0) ? (
        <ReportResultsTable
          title="ASSIST results"
          results={assistResults}
          emptyMessage="No ASSIST results in this date range."
          className="report-results-assist"
          severityColumnLabel="Risk Level"
          capitalizeSeverity={false}
        />
      ) : null}

      {(!omitEmptySections || btpResults.length > 0) ? (
        <ReportBtpResultsTable
          results={btpResults}
          emptyMessage="No Behavioural Targets Progress results in this date range."
          className="report-results-btp"
        />
      ) : null}

      {/* 6. Clinical summary */}
      <section className="report-clinical-summary space-y-2">
        <h3 className="text-lg font-semibold">Clinical summary</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {readOnly ? clinicalSummary : clinicalSummary === "—" ? "" : clinicalSummary}
        </p>
      </section>

      {/* 7. Recommendations */}
      <section className="report-recommendations space-y-2">
        <h3 className="text-lg font-semibold">Recommendations</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {readOnly ? recommendations : recommendations === "—" ? "" : recommendations}
        </p>
      </section>

      {/* 8. Signature */}
      <section className="report-signature">
        <p className="text-sm text-muted-foreground">Practitioner signature</p>
        <div className="mt-12 border-b border-foreground/40" />
        <p className="mt-2 text-sm">{practitionerLine}</p>
      </section>
    </article>
  )
}
