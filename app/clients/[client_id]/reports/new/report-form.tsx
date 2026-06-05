"use client"

import { useActionState, useCallback, useState, useTransition } from "react"

import {
  fetchReportResultsForRange,
  saveReportDraft,
  type ReportPreviewRow,
  type SaveReportDraftState,
} from "@/app/clients/[client_id]/reports/actions"
import { ReportDocument } from "@/components/report/report-document"
import { ReportBtpResultsTable } from "@/components/report/btp-results-table"
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
import type { ReportSnapshot } from "@/lib/reports/snapshot"
import { resolveReportTitle } from "@/lib/reports/snapshot"

const initialSaveState: SaveReportDraftState = {}

export function ReportForm({
  clientId,
  initialSnapshot,
}: {
  clientId: string
  initialSnapshot: Omit<
    ReportSnapshot,
    | "phq9Results"
    | "gad7Results"
    | "asqResults"
    | "assistResults"
    | "btpResults"
    | "clinicalSummaryText"
    | "recommendationsText"
    | "dateRangeStart"
    | "dateRangeEnd"
    | "generatedAt"
    | "reportTitle"
  >
}) {
  const [dateRangeStart, setDateRangeStart] = useState("")
  const [dateRangeEnd, setDateRangeEnd] = useState("")
  const [phq9Results, setPhq9Results] = useState<ReportPreviewRow[]>([])
  const [gad7Results, setGad7Results] = useState<ReportPreviewRow[]>([])
  const [asqResults, setAsqResults] = useState<ReportPreviewRow[]>([])
  const [assistResults, setAssistResults] = useState<ReportPreviewRow[]>([])
  const [btpResults, setBtpResults] = useState<
    import("@/lib/reports/snapshot").BtpReportResultRow[]
  >([])
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [clinicalSummary, setClinicalSummary] = useState("")
  const [recommendations, setRecommendations] = useState("")
  const [isPendingPreview, startPreviewTransition] = useTransition()
  const [saveState, saveAction, savePending] = useActionState(
    saveReportDraft.bind(null, clientId),
    initialSaveState
  )

  const loadPreview = useCallback(
    (start: string, end: string) => {
      if (!start || !end) {
        setPhq9Results([])
        setGad7Results([])
        setAsqResults([])
        setAssistResults([])
        setBtpResults([])
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
        setBtpResults(preview.btpResults)
        setPreviewError(error ?? null)
      })
    },
    [clientId]
  )

  function handleStartChange(value: string) {
    setDateRangeStart(value)
    loadPreview(value, dateRangeEnd)
  }

  function handleEndChange(value: string) {
    setDateRangeEnd(value)
    loadPreview(dateRangeStart, value)
  }

  function handlePrint() {
    window.print()
  }

  const previewSnapshot: ReportSnapshot | null =
    dateRangeStart && dateRangeEnd
      ? {
          ...initialSnapshot,
          reportTitle: resolveReportTitle(),
          generatedAt: new Date().toISOString(),
          dateRangeStart,
          dateRangeEnd,
          phq9Results,
          gad7Results,
          asqResults,
          assistResults,
          btpResults,
          clinicalSummaryText: clinicalSummary,
          recommendationsText: recommendations,
        }
      : null

  const previewLoading = isPendingPreview && Boolean(dateRangeStart && dateRangeEnd)

  return (
    <>
      <div className="no-print space-y-6">
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
                <ReportBtpResultsTable
                  results={btpResults}
                  emptyMessage="No Behavioural Targets Progress results in this date range."
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
            <p className="text-sm text-destructive">{saveState.error}</p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={savePending || !dateRangeStart || !dateRangeEnd}>
              {savePending ? "Saving…" : "Save Draft"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              disabled={!previewSnapshot}
            >
              Print / Save as PDF
            </Button>
          </div>
        </form>
      </div>

      {previewSnapshot ? (
        <div className="report-print-area hidden print:block">
          <ReportDocument snapshot={previewSnapshot} readOnly />
        </div>
      ) : null}
    </>
  )
}
