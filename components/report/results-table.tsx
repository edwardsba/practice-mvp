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

const thClassName =
  "py-1.5 px-2 text-left align-middle font-normal border-b border-border/40"

const tdClassName = "py-1.5 px-2 align-middle"

const tbodyClassName =
  "[&_tr:last-child_td]:border-b [&_tr:last-child_td]:border-border/40"

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
      <h4 className="mb-1 text-sm italic">{title}</h4>
      <table className="report-results-table w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={thClassName}>Date</th>
            <th className={thClassName}>Score</th>
            <th className={thClassName}>{severityColumnLabel}</th>
            {showImpairment ? (
              <th className={thClassName}>Functional Impairment</th>
            ) : null}
          </tr>
        </thead>
        <tbody className={tbodyClassName}>
          {results.length === 0 ? (
            <tr>
              <td
                colSpan={columnCount}
                className="px-2 py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            results.map((row) => (
              <tr key={row.assessmentResultId}>
                <td className={tdClassName}>{formatShortDate(row.date)}</td>
                <td className={cn(tdClassName, "tabular-nums")}>
                  {row.maxScore != null
                    ? `${row.score} / ${row.maxScore}`
                    : row.score}
                </td>
                <td
                  className={
                    capitalizeSeverity
                      ? cn(tdClassName, "capitalize")
                      : tdClassName
                  }
                >
                  {row.severity ?? "—"}
                </td>
                {showImpairment ? (
                  <td className={tdClassName}>
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
      <h4 className="mb-1 text-sm italic">ASQ results</h4>
      <table className="report-results-table w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={thClassName}>Date</th>
            <th className={thClassName}>Score</th>
            <th className={thClassName}>Screen outcome</th>
          </tr>
        </thead>
        <tbody className={tbodyClassName}>
          {results.length === 0 ? (
            <tr>
              <td
                colSpan={3}
                className="px-2 py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            results.map((row) => (
              <tr key={row.assessmentResultId}>
                <td className={tdClassName}>{formatShortDate(row.date)}</td>
                <td className={cn(tdClassName, "tabular-nums")}>
                  {row.maxScore != null
                    ? `${row.score} / ${row.maxScore}`
                    : row.score}
                </td>
                <td className={tdClassName}>{row.acuteRiskRating ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  )
}
