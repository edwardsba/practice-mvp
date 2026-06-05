"use client"

import Link from "next/link"
import { useActionState, useCallback, useEffect, useState, useTransition } from "react"

import {
  updateReportDraft,
  type UpdateReportDraftState,
} from "@/app/clients/[client_id]/reports/[report_id]/edit/actions"
import {
  fetchReportResultsForRange,
  type ReportPreviewRow,
} from "@/app/clients/[client_id]/reports/actions"
import {
  ReportAsqResultsTable,
  ReportResultsTable,
} from "@/components/report/results-table"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const initialState: UpdateReportDraftState = {}

function formatDateInput(value: string | Date | null): string {
  if (!value) return ""
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ""
    return value.toISOString().slice(0, 10)
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

export function EditReportForm({
  clientId,
  reportId,
  initial,
}: {
  clientId: string
  reportId: string
  initial: {
    dateRangeStart: string | Date
    dateRangeEnd: string | Date
    clinicalSummaryText: string | null
    recommendationsText: string | null
  }
}) {
  const [dateRangeStart, setDateRangeStart] = useState(
    formatDateInput(initial.dateRangeStart)
  )
  const [dateRangeEnd, setDateRangeEnd] = useState(formatDateInput(initial.dateRangeEnd))
  const [phq9Results, setPhq9Results] = useState<ReportPreviewRow[]>([])
  const [gad7Results, setGad7Results] = useState<ReportPreviewRow[]>([])
  const [asqResults, setAsqResults] = useState<ReportPreviewRow[]>([])
  const [assistResults, setAssistResults] = useState<ReportPreviewRow[]>([])
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [clinicalSummary, setClinicalSummary] = useState(
    initial.clinicalSummaryText ?? ""
  )
  const [recommendations, setRecommendations] = useState(
    initial.recommendationsText ?? ""
  )
  const [isPendingPreview, startPreviewTransition] = useTransition()
  const [saveState, saveAction, savePending] = useActionState(
    updateReportDraft.bind(null, clientId, reportId),
    initialState
  )

  const loadPreview = useCallback(
    (start: string, end: string) => {
      if (!start || !end) {
        setPhq9Results([])
        setGad7Results([])
        setAsqResults([])
        setAssistResults([])
        setPreviewError(null)
        return
      }

      startPreviewTransition(async () => {
        const { preview, error } = await fetchReportResultsForRange(
          clientId,
          start,
          end
        )
        setPhq9Results(preview.phq9Results)
        setGad7Results(preview.gad7Results)
        setAsqResults(preview.asqResults)
        setAssistResults(preview.assistResults)
        setPreviewError(error ?? null)
      })
    },
    [clientId]
  )

  useEffect(() => {
    if (dateRangeStart && dateRangeEnd) {
      loadPreview(dateRangeStart, dateRangeEnd)
    }
  }, [dateRangeStart, dateRangeEnd, loadPreview])

  function handleStartChange(value: string) {
    setDateRangeStart(value)
    loadPreview(value, dateRangeEnd)
  }

  function handleEndChange(value: string) {
    setDateRangeEnd(value)
    loadPreview(dateRangeStart, value)
  }

  const previewLoading = isPendingPreview && Boolean(dateRangeStart && dateRangeEnd)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Date range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date_range_start">Start date</Label>
              <Input
                id="date_range_start"
                type="date"
                value={dateRangeStart}
                onChange={(e) => handleStartChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_range_end">End date</Label>
              <Input
                id="date_range_end"
                type="date"
                value={dateRangeEnd}
                onChange={(e) => handleEndChange(e.target.value)}
              />
            </div>
          </div>
          {previewError ? (
            <p className="mt-3 text-sm text-destructive">{previewError}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {!dateRangeStart || !dateRangeEnd ? (
            <p className="text-sm text-muted-foreground">
              Select a date range to preview results.
            </p>
          ) : previewLoading ? (
            <p className="text-sm text-muted-foreground">Loading results…</p>
          ) : (
            <>
              <ReportResultsTable
                title="PHQ-9 Results"
                results={phq9Results}
                emptyMessage="No PHQ-9 results in this date range."
                showImpairment
              />
              <ReportResultsTable
                title="GAD-7 Results"
                results={gad7Results}
                emptyMessage="No GAD-7 results in this date range."
                showImpairment
              />
              <ReportAsqResultsTable
                results={asqResults}
                emptyMessage="No ASQ results in this date range."
              />
              <ReportResultsTable
                title="ASSIST Results"
                results={assistResults}
                emptyMessage="No ASSIST results in this date range."
                severityColumnLabel="Risk Level"
                capitalizeSeverity={false}
              />
            </>
          )}
        </CardContent>
      </Card>

      <form action={saveAction} className="space-y-6">
        <input type="hidden" name="date_range_start" value={dateRangeStart} />
        <input type="hidden" name="date_range_end" value={dateRangeEnd} />

        <Card>
          <CardHeader>
            <CardTitle>Clinical summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              name="clinical_summary_text"
              value={clinicalSummary}
              onChange={(e) => setClinicalSummary(e.target.value)}
              placeholder="Enter clinical summary…"
              rows={6}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              name="recommendations_text"
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              placeholder="Enter recommendations…"
              rows={6}
            />
          </CardContent>
        </Card>

        {saveState.error ? (
          <p className="text-sm text-destructive" role="alert">
            {saveState.error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={savePending || !dateRangeStart || !dateRangeEnd}>
            {savePending ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/clients/${clientId}/reports/${reportId}`}>Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
