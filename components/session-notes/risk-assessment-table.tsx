"use client"

import { useRouter } from "next/navigation"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type RiskAssessmentRow = {
  code: string
  name: string
  assessmentResultId: string | null
  score: number | null
  maxScore: number | null
  acuteRiskRating: string | null
  administerHref: string
}

export function RiskAssessmentTable({
  rows,
  clientId,
  returnTo,
}: {
  rows: RiskAssessmentRow[]
  clientId: string
  returnTo?: string
}) {
  const router = useRouter()

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Assessment</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Screen outcome</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const hasResult = Boolean(row.assessmentResultId)
            return (
              <TableRow
                key={row.code}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() =>
                  router.push(
                    hasResult
                      ? `/clients/${clientId}/results/${row.assessmentResultId}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`
                      : row.administerHref
                  )
                }
              >
                <TableCell className="font-medium">{row.name}</TableCell>
                {hasResult ? (
                  <>
                    <TableCell>
                      {row.score}
                      {row.maxScore != null ? ` / ${row.maxScore}` : ""}
                    </TableCell>
                    <TableCell>{row.acuteRiskRating ?? "—"}</TableCell>
                  </>
                ) : (
                  <TableCell colSpan={2} className="text-muted-foreground">
                    Not administered — click to start
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
