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
  showImpairment = false,
  severityColumnLabel = "Severity",
  capitalizeSeverity = true,
}: {
  title: string
  results: ReportResultRow[]
  emptyMessage: string
  className?: string
  showImpairment?: boolean
  severityColumnLabel?: string
  capitalizeSeverity?: boolean
}) {
  const columnCount = showImpairment ? 4 : 3

  return (
    <section className={cn("report-results-section", className)}>
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      <table className="report-results-table w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="h-10 px-2 text-left align-middle font-medium">Date</th>
            <th className="h-10 px-2 text-left align-middle font-medium">Score</th>
            <th className="h-10 px-2 text-left align-middle font-medium">
              {severityColumnLabel}
            </th>
            {showImpairment ? (
              <th className="h-10 px-2 text-left align-middle font-medium">
                Functional Impairment
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {results.length === 0 ? (
            <tr className="border-b">
              <td
                colSpan={columnCount}
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
                <td
                  className={
                    capitalizeSeverity
                      ? "p-2 align-middle capitalize"
                      : "p-2 align-middle"
                  }
                >
                  {row.severity ?? "—"}
                </td>
                {showImpairment ? (
                  <td className="p-2 align-middle">
                    {row.functionalImpairmentLabel ?? "—"}
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
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
              Screen outcome
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
