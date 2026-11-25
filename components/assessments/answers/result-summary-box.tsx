import type { ResultSummaryLine } from "@/lib/assessments/result-summaries"

export function ResultSummaryBox({ rows }: { rows: ResultSummaryLine[] }) {
  if (rows.length === 0) return null

  return (
    <div className="rounded-lg border-2 border-foreground/80 bg-card p-4">
      <h2 className="text-sm font-semibold tracking-wide uppercase">Summary</h2>
      <dl className="mt-3 space-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[minmax(0,38%)_minmax(0,62%)] gap-x-3 gap-y-1 text-sm"
          >
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0">
              {row.lead ? (
                <>
                  <span className="font-bold">{row.lead}</span>{" "}
                  <span>{row.value}</span>
                </>
              ) : (
                <span className="font-medium">{row.value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
