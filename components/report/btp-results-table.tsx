import type { BtpReportResultRow } from "@/lib/reports/snapshot"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function formatShortDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
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
      <section className={`report-results-btp space-y-3 pt-6 ${className ?? ""}`}>
        <h3 className="text-lg font-semibold">Behavioural Targets Progress</h3>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </section>
    )
  }

  return (
    <section className={`report-results-btp space-y-6 pt-6 ${className ?? ""}`}>
      <h3 className="text-lg font-semibold">Behavioural Targets Progress</h3>
      {results.map((result) => (
        <div key={result.assessmentResultId} className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {formatShortDate(result.date)}
          </p>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.targets.map((target) => (
                  <TableRow key={`${result.assessmentResultId}-${target.target}`}>
                    <TableCell>{target.target}</TableCell>
                    <TableCell>{target.score}</TableCell>
                    <TableCell>{target.ratingLabel}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </section>
  )
}
