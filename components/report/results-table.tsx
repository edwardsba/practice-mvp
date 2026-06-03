import type { ReportResultRow } from "@/lib/reports/snapshot"
import { cn } from "@/lib/utils"

function formatShortDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function ReportResultsTable({
  title,
  results,
  emptyMessage,
  className,
}: {
  title: string
  results: ReportResultRow[]
  emptyMessage: string
  className?: string
}) {
  return (
    <section className={cn("report-results-section", className)}>
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      <table className="report-results-table w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="h-10 px-2 text-left align-middle font-medium">Date</th>
            <th className="h-10 px-2 text-left align-middle font-medium">Score</th>
            <th className="h-10 px-2 text-left align-middle font-medium">Severity</th>
          </tr>
        </thead>
        <tbody>
          {results.length === 0 ? (
            <tr className="border-b">
              <td
                colSpan={3}
                className="p-2 py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            results.map((row) => (
              <tr key={row.assessmentResultId} className="border-b">
                <td className="p-2 align-middle">{formatShortDate(row.date)}</td>
                <td className="p-2 align-middle tabular-nums">{row.score}</td>
                <td className="p-2 align-middle capitalize">{row.severity}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <ReportImpairmentNotes results={results} />
    </section>
  )
}

function ReportImpairmentNotes({ results }: { results: ReportResultRow[] }) {
  const withImpairment = results.filter((row) => row.functionalImpairmentLabel)
  if (withImpairment.length === 0) return null

  return (
    <div className="report-impairment-notes mt-3 space-y-1 text-sm">
      {withImpairment.map((row) => (
        <p key={row.assessmentResultId}>
          <span className="font-medium">Functional impairment</span>
          {withImpairment.length > 1 ? ` (${formatShortDate(row.date)})` : null}:{" "}
          {row.functionalImpairmentLabel}
        </p>
      ))}
    </div>
  )
}

export function ReportAsqResultsTable({
  results,
  emptyMessage,
  className,
}: {
  results: ReportResultRow[]
  emptyMessage: string
  className?: string
}) {
  return (
    <section className={cn("report-results-section", className)}>
      <h3 className="mb-3 text-lg font-semibold">ASQ results</h3>
      <table className="report-results-table w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="h-10 px-2 text-left align-middle font-medium">Date</th>
            <th className="h-10 px-2 text-left align-middle font-medium">Score</th>
            <th className="h-10 px-2 text-left align-middle font-medium">
              Acute Risk Rating
            </th>
          </tr>
        </thead>
        <tbody>
          {results.length === 0 ? (
            <tr className="border-b">
              <td
                colSpan={3}
                className="p-2 py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            results.map((row) => (
              <tr key={row.assessmentResultId} className="border-b">
                <td className="p-2 align-middle">{formatShortDate(row.date)}</td>
                <td className="p-2 align-middle tabular-nums">{row.score}</td>
                <td className="p-2 align-middle">{row.acuteRiskRating ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  )
}
