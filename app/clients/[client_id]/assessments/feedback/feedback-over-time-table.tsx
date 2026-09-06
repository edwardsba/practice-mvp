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
import type {
  CompletedAppointment,
  PsfFeedbackSession,
} from "@/lib/assessments/load-psf-feedback"
import { calculatePsfFeedbackTrend } from "@/lib/assessments/psf"
import { cn } from "@/lib/utils"

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function inRange(date: string, start: string, end: string) {
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

function formatTrend(trend: number | null) {
  if (trend === null) return "—"
  const rounded = Math.round(trend * 10) / 10
  return rounded > 0 ? `+${rounded}` : String(rounded)
}

export function FeedbackOverTimeTable({
  clientId,
  sessions,
  completedAppointments,
}: {
  clientId: string
  sessions: PsfFeedbackSession[]
  completedAppointments: CompletedAppointment[]
}) {
  const [dateStart, setDateStart] = useState("")
  const [dateEnd, setDateEnd] = useState("")

  const filteredSessions = useMemo(
    () => sessions.filter((s) => inRange(s.date, dateStart, dateEnd)),
    [sessions, dateStart, dateEnd]
  )

  const filteredCompletedAppointments = useMemo(
    () =>
      completedAppointments.filter((a) => inRange(a.date, dateStart, dateEnd)),
    [completedAppointments, dateStart, dateEnd]
  )

  const sortedSessions = useMemo(
    () =>
      [...filteredSessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [filteredSessions]
  )

  const trend = useMemo(
    () => calculatePsfFeedbackTrend(filteredSessions),
    [filteredSessions]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="feedback_date_start" className="text-sm font-medium">
            From
          </label>
          <input
            id="feedback_date_start"
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className="flex h-9 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="feedback_date_end" className="text-sm font-medium">
            To
          </label>
          <input
            id="feedback_date_end"
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className="flex h-9 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
        {(dateStart || dateEnd) && (
          <button
            type="button"
            onClick={() => {
              setDateStart("")
              setDateEnd("")
            }}
            className="h-9 self-end px-2 text-sm text-muted-foreground hover:underline"
          >
            Clear range
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Feedback trend</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatTrend(trend)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Recency-weighted; negative feedback counts more than positive, and
            recent sessions count more than older ones. Higher means more
            concerning.
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Completion</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {filteredSessions.length} of {filteredCompletedAppointments.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Completed sessions in this range with feedback recorded.
          </p>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Positive</TableHead>
              <TableHead>Negative</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSessions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-20 text-center text-muted-foreground"
                >
                  No feedback recorded in this range.
                </TableCell>
              </TableRow>
            ) : (
              sortedSessions.map((session) => {
                const resultHref = `/clients/${clientId}/results/${session.assessmentResultId}`
                return (
                  <TableRow
                    key={session.assessmentResultId}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      session.negativeFeedback > 0 && "bg-destructive/10"
                    )}
                  >
                    <TableCell>
                      <Link
                        href={resultHref}
                        className="block font-medium text-primary hover:underline"
                      >
                        {formatDate(session.date)}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <Link href={resultHref} className="block hover:underline">
                        {session.positiveFeedback}/10
                      </Link>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "tabular-nums",
                        session.negativeFeedback > 0 &&
                          "font-medium text-destructive"
                      )}
                    >
                      <Link href={resultHref} className="block hover:underline">
                        {session.negativeFeedback}/10
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
