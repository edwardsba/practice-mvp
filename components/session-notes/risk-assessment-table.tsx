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
import { cn } from "@/lib/utils"

export type RiskAssessmentRow = {
  code: string
  name: string
  assessmentResultId: string | null
  score: number | null
  maxScore: number | null
  acuteRiskRating: string | null
  administerHref: string | null
}

export function RiskAssessmentTable({
  rows,
  clientId,
  returnTo,
  outcomeColumnLabel = "Screen outcome",
}: {
  rows: RiskAssessmentRow[]
  clientId: string
  returnTo?: string
  outcomeColumnLabel?: string
}) {
  const router = useRouter()

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Assessment</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>{outcomeColumnLabel}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const hasResult = Boolean(row.assessmentResultId)
            const clickHref = hasResult
              ? `/clients/${clientId}/results/${row.assessmentResultId}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`
              : row.administerHref

            return (
              <TableRow
                key={row.code}
                className={cn(clickHref && "cursor-pointer hover:bg-muted/50")}
                onClick={clickHref ? () => router.push(clickHref) : undefined}
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
                    {row.administerHref
                      ? "Not administered — click to start"
                      : "Not completed this session"}
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
