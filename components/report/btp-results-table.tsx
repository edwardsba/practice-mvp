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
      <section className={cn("report-results-btp space-y-3 pt-6", className)}>
        <h3 className="text-lg font-semibold">Behavioural Targets Progress</h3>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </section>
    )
  }

  const byTarget = pivotBtpResults(results)

  return (
    <section className={cn("report-results-btp space-y-6 pt-6", className)}>
      <h3 className="text-lg font-semibold">Behavioural Targets Progress</h3>
      {Array.from(byTarget.entries()).map(([target, rows]) => (
        <section key={target} className="report-results-section space-y-2">
          <h4 className="text-sm font-medium">{target}</h4>
          <table className="report-results-table w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="h-10 border-y border-border/60 px-2 text-left align-middle font-medium">
                  Date
                </th>
                <th className="h-10 border-y border-border/60 px-2 text-left align-middle font-medium">
                  Score
                </th>
                <th className="h-10 border-y border-border/60 px-2 text-left align-middle font-medium">
                  Rating
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-border/40 last:border-b-2 last:border-border/60"
                >
                  <td className="p-2 align-middle">{formatShortDate(row.date)}</td>
                  <td className="p-2 align-middle tabular-nums">
                    {row.maxScore != null
                      ? `${row.score} / ${row.maxScore}`
                      : row.score}
                  </td>
                  <td className="p-2 align-middle">{row.ratingLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </section>
  )
}
