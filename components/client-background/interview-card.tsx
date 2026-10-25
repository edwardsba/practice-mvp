"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { startBackgroundInterviewAction } from "@/app/clients/[client_id]/background/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { INTERVIEW_ANSWER_TOTAL } from "@/lib/client-background/interview-history"
import type { BackgroundInterviewCardData } from "@/lib/client-background/load"

export function BackgroundInterviewCard({
  clientId,
  summary,
}: {
  clientId: string
  summary: BackgroundInterviewCardData
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setPending(true)
    setError(null)
    const result = await startBackgroundInterviewAction(clientId)
    if (result.error || !result.interviewId) {
      setPending(false)
      setError(result.error ?? "Could not start the background interview.")
      return
    }
    router.push(`/clients/${clientId}/background/interview`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Background interview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary.inProgress ? (
          <p className="text-sm">
            In progress · started {summary.inProgress.startedAt} · History: {summary.inProgress.answered} of {INTERVIEW_ANSWER_TOTAL} answered
          </p>
        ) : (
          <p className="text-sm">
            {summary.lastCompletedAt ? `Last completed ${summary.lastCompletedAt}` : "No background interview yet"}
          </p>
        )}
        {summary.inProgress ? (
          <Button
            type="button"
            className="min-h-11"
            onClick={() => router.push(`/clients/${clientId}/background/interview`)}
          >
            Resume background interview
          </Button>
        ) : (
          <Button type="button" className="min-h-11" disabled={pending} onClick={() => void start()}>
            {pending ? "Starting…" : "Start background interview"}
          </Button>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {summary.completed.length > 0 ? (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {summary.completed.map((item) => (
              <li key={item.interviewId}>
                {item.completedAt} · {item.practitionerName}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}
