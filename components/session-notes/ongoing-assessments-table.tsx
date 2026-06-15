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
import type { SessionNoteAssessmentResult } from "@/lib/session-notes/load-context"
import { cn } from "@/lib/utils"

export function OngoingAssessmentsTable({
  assessments,
  clientId,
}: {
  assessments: SessionNoteAssessmentResult[]
  clientId: string
}) {
  const router = useRouter()

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Assessment</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Functional impairment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assessments.map((result) => {
            const hasResult = Boolean(result.assessmentResultId)
            return (
              <TableRow
                key={result.code}
                className={cn(hasResult && "cursor-pointer hover:bg-muted/50")}
                onClick={
                  hasResult
                    ? () =>
                        router.push(
                          `/clients/${clientId}/results/${result.assessmentResultId}`
                        )
                    : undefined
                }
              >
                <TableCell className="font-medium">{result.name}</TableCell>
                {hasResult ? (
                  <>
                    <TableCell>
                      {result.score}
                      {result.maxScore != null ? ` / ${result.maxScore}` : ""}
                    </TableCell>
                    <TableCell className="capitalize">
                      {result.severity ?? "—"}
                    </TableCell>
                    <TableCell>
                      {result.functionalImpairmentLabel ?? "—"}
                    </TableCell>
                  </>
                ) : (
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Not completed this session
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
