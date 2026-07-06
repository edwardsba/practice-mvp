import type { BtpReportResultRow } from "@/lib/reports/snapshot"
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

type TargetRow = {
  date: string
  score: number
  maxScore?: number | null
  ratingLabel: string
}

function pivotBtpResults(results: BtpReportResultRow[]): Map<string, TargetRow[]> {
  const map = new Map<string, TargetRow[]>()
  for (const result of results) {
    for (const target of result.targets) {
      const rows = map.get(target.target) ?? []
      rows.push({
        date: result.date,
        score: target.score,
        maxScore: target.maxScore,
        ratingLabel: target.ratingLabel,
      })
      map.set(target.target, rows)
    }
  }
  return map
}

export function ReportBtpResultsTable({
  results,
  emptyMessage,
  className,
}: {
  results: BtpReportResultRow[]
  emptyMessage: string
  className?: string
}) {
  if (results.length === 0) {
    return (
      <section className={cn("report-results-btp space-y-3 pt-4", className)}>
        <h3 className="mb-1 text-sm font-semibold">Treatment plan progress</h3>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </section>
    )
  }

  const byTarget = pivotBtpResults(results)

  return (
    <section className={cn("report-results-btp space-y-3 pt-4", className)}>
      <h3 className="mb-1 text-sm font-semibold">Treatment plan progress</h3>
      {Array.from(byTarget.entries()).map(([target, rows]) => (
        <section key={target} className="report-results-section space-y-1">
          <h4 className="mb-1 text-sm italic">{target}</h4>
          <table className="report-results-table w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={thClassName}>Date</th>
                <th className={thClassName}>Score</th>
                <th className={thClassName}>Rating</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child_td]:border-b [&_tr:last-child_td]:border-border/40">
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className={tdClassName}>{formatShortDate(row.date)}</td>
                  <td className={cn(tdClassName, "tabular-nums")}>
                    {row.maxScore != null
                      ? `${row.score} / ${row.maxScore}`
                      : row.score}
                  </td>
                  <td className={tdClassName}>{row.ratingLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </section>
  )
}
