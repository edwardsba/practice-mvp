"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "PHQ9", label: "PHQ-9" },
  { value: "GAD7", label: "GAD-7" },
  { value: "ASSIST", label: "ASSIST" },
  { value: "ASQ", label: "ASQ" },
  { value: "BTP", label: "BTP" },
  { value: "PSF", label: "Post-Session Feedback" },
] as const

const ASSESSMENT_TYPE_LABELS: Record<string, string> = {
  PHQ9: "PHQ-9",
  GAD7: "GAD-7",
  ASSIST: "ASSIST",
  ASQ: "ASQ",
  BTP: "BTP",
  PSF: "Post-Session Feedback",
}

type AssessmentResultRow = {
  assessmentResultId: string
  assessmentDate: Date
  score: number | null
  severity: string | null
  acuteRiskRating: string | null
  assessmentCode: string
  assessmentName: string
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatAssessmentType(code: string, name: string) {
  return ASSESSMENT_TYPE_LABELS[code] ?? name
}

function formatScore(result: AssessmentResultRow) {
  if (result.score === null) return "—"
  if (result.assessmentCode === "PSF") {
    return result.score > 0 ? `+${result.score}` : String(result.score)
  }
  return String(result.score)
}

function formatSeverityOrRisk(result: AssessmentResultRow) {
  if (result.assessmentCode === "ASQ") {
    return result.severity ?? "—"
  }
  if (result.assessmentCode === "BTP") {
    return "—"
  }
  if (result.assessmentCode === "PSF") {
    return result.severity ?? "—"
  }
  return result.severity ?? "—"
}

export function AssessmentsTable({
  clientId,
  results,
}: {
  clientId: string
  results: AssessmentResultRow[]
}) {
  const [filter, setFilter] = useState<string>("all")

  const filteredResults = useMemo(() => {
    if (filter === "all") return results
    return results.filter((result) => result.assessmentCode === filter)
  }, [filter, results])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="assessment_type_filter" className="text-sm font-medium">
          Assessment Type
        </label>
        <select
          id="assessment_type_filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex h-9 w-full max-w-xs rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Assessment Type</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Severity / Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResults.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-20 text-center text-muted-foreground"
                >
                  No assessment results recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              filteredResults.map((result) => {
                const resultHref = `/clients/${clientId}/results/${result.assessmentResultId}`
                return (
                  <TableRow
                    key={result.assessmentResultId}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link
                        href={resultHref}
                        className="block font-medium text-primary hover:underline"
                      >
                        {formatDate(result.assessmentDate)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={resultHref} className="block hover:underline">
                        {formatAssessmentType(
                          result.assessmentCode,
                          result.assessmentName
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={resultHref} className="block hover:underline">
                        {formatScore(result)}
                      </Link>
                    </TableCell>
                    <TableCell
                      className={cn(
                        result.assessmentCode !== "ASQ" &&
                          result.assessmentCode !== "PSF" &&
                          "capitalize"
                      )}
                    >
                      <Link href={resultHref} className="block hover:underline">
                        {formatSeverityOrRisk(result)}
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
