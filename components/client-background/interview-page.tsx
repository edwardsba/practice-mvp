"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import {
  saveEducationAction,
  saveIdentityAction,
  saveLivingSituationAction,
  saveOccupationAction,
} from "@/app/clients/[client_id]/background/actions"
import {
  EducationFieldsEditor,
  IdentityFieldsEditor,
  LivingFieldsEditor,
  OccupationFieldsEditor,
} from "@/components/client-background/demographics-section"
import { AutosaveFields, type SavePhase } from "@/components/client-background/interview-autosave"
import { InterviewHistory } from "@/components/client-background/interview-history"
import { InterviewRelationships } from "@/components/client-background/interview-relationships"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { backgroundAnswersToClientBackground } from "@/lib/background-questionnaire/to-client-background"
import type { BackgroundSelfReport } from "@/lib/background-questionnaire/types"
import { assessAge, displayedAge } from "@/lib/client-background/age"
import { parsePartialDate } from "@/lib/client-background/partial-date"
import type { ScreeningAnswers } from "@/lib/client-background/interview-history"
import type { ClientBackgroundData, RelationshipRecord } from "@/lib/client-background/types"
import { todayDateString } from "@/lib/dates/practice-time"
import { cn } from "@/lib/utils"

type InterviewPageId = "background" | "history"

function clientAge(dateOfBirth: string | null) {
  if (!dateOfBirth) return ""
  return displayedAge(assessAge(parsePartialDate(dateOfBirth), parsePartialDate(todayDateString()), "person"))
}

export function InterviewPage({
  clientId,
  clientName,
  initialPage,
  data,
  screening,
  selfReport,
}: {
  clientId: string
  clientName: string
  initialPage: InterviewPageId
  data: ClientBackgroundData
  screening: ScreeningAnswers
  selfReport: BackgroundSelfReport | null
}) {
  const router = useRouter()
  const [page, setPage] = useState<InterviewPageId>(initialPage)
  const [relationships, setRelationships] = useState(data.relationships)
  const [phases, setPhases] = useState<Record<string, { phase: SavePhase; retry: (() => void) | null }>>({})
  const flushers = useRef(new Set<() => Promise<void>>())
  const completeRef = useRef<() => void>(() => {})
  const age = clientAge(data.dateOfBirth)
  const suggestions = selfReport ? backgroundAnswersToClientBackground(selfReport.answers) : null
  const received = selfReport ? formatReceived(selfReport.assessmentDate) : ""

  const onPhase = useCallback((id: string, phase: SavePhase, retry: (() => void) | null) => {
    setPhases((current) => ({ ...current, [id]: { phase, retry } }))
  }, [])

  const registerFlush = useCallback((flush: () => Promise<void>) => {
    flushers.current.add(flush)
    return () => {
      flushers.current.delete(flush)
    }
  }, [])

  const onRelationships = useCallback((next: RelationshipRecord[]) => {
    setRelationships(next)
  }, [])

  const registerComplete = useCallback((open: () => void) => {
    completeRef.current = open
  }, [])

  const values = Object.values(phases)
  const saving = values.some((item) => item.phase === "saving")
  const failed = values.filter((item) => item.phase === "error")
  const saveLabel = saving ? "Saving…" : failed.length > 0 ? "Couldn't save — retry" : "Saved"

  async function flushAll() {
    await Promise.all([...flushers.current].map((flush) => flush()))
  }

  function show(next: InterviewPageId) {
    setPage(next)
    const href =
      next === "history"
        ? `/clients/${clientId}/background/interview?page=history`
        : `/clients/${clientId}/background/interview`
    router.replace(href, { scroll: false })
    window.scrollTo(0, 0)
  }

  async function leave() {
    await flushAll()
    router.push(`/clients/${clientId}/background`)
  }

  async function beginComplete() {
    await flushAll()
    completeRef.current()
  }

  function retryFailed() {
    for (const item of failed) item.retry?.()
  }

  return (
    <div className="mx-auto min-w-0 max-w-2xl">
      <header className="sticky top-0 z-30 -mx-4 border-b bg-background px-4">
        <div className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Background interview</p>
            <p className="truncate text-sm text-muted-foreground">
              {clientName}
              {age ? `, ${age}` : ""}
            </p>
          </div>
          <button type="button" className="min-h-11 shrink-0 text-sm underline" onClick={() => void leave()}>
            Save and leave
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 pb-3">
          <div role="group" aria-label="Interview page" className="inline-flex rounded-md border p-0.5">
            <PageButton pressed={page === "background"} onClick={() => show("background")}>
              Background
            </PageButton>
            <PageButton pressed={page === "history"} onClick={() => show("history")}>
              History
            </PageButton>
          </div>
          {failed.length > 0 && !saving ? (
            <button type="button" className="min-h-11 text-sm text-destructive underline" onClick={retryFailed}>
              {saveLabel}
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">{saveLabel}</p>
          )}
          {page === "history" ? (
            <Button type="button" className="min-h-11" onClick={() => void beginComplete()}>
              Complete
            </Button>
          ) : null}
        </div>
      </header>

      {selfReport ? (
        <p className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Self-report received {received}. Blue lines show the client&apos;s answers; items without one aren&apos;t in
          the self-report. &quot;Use&quot; copies an answer into the field; nothing is filled in automatically.
        </p>
      ) : null}

      <div className={cn("space-y-4 py-4", page !== "background" && "hidden")}>
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent>
            <AutosaveFields
              saved={data.demographics.identity}
              save={async (value) => {
                const result = await saveIdentityAction(clientId, value)
                if ("error" in result && result.error) return { error: result.error }
                if (!("identity" in result) || !result.identity) return { error: "Could not save." }
                return { value: result.identity }
              }}
              onPhase={(phase, retry) => onPhase("identity", phase, retry)}
              registerFlush={registerFlush}
            >
              {(value, onChange, commit) => (
                <IdentityFieldsEditor
                  value={value}
                  onChange={onChange}
                  onCommit={commit}
                  client={suggestions?.identity}
                />
              )}
            </AutosaveFields>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Education</CardTitle>
          </CardHeader>
          <CardContent>
            <AutosaveFields
              saved={data.demographics.education}
              save={async (value) => {
                const result = await saveEducationAction(clientId, value)
                if ("error" in result && result.error) return { error: result.error }
                if (!("education" in result) || !result.education) return { error: "Could not save." }
                return { value: result.education }
              }}
              onPhase={(phase, retry) => onPhase("education", phase, retry)}
              registerFlush={registerFlush}
            >
              {(value, onChange, commit) => (
                <EducationFieldsEditor
                  value={value}
                  onChange={onChange}
                  onCommit={commit}
                  client={suggestions?.education}
                />
              )}
            </AutosaveFields>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Occupation and financial</CardTitle>
          </CardHeader>
          <CardContent>
            <AutosaveFields
              saved={data.demographics.occupation}
              save={async (value) => {
                const result = await saveOccupationAction(clientId, value)
                if ("error" in result && result.error) return { error: result.error }
                if (!("occupation" in result) || !result.occupation) return { error: "Could not save." }
                return { value: result.occupation }
              }}
              onPhase={(phase, retry) => onPhase("occupation", phase, retry)}
              registerFlush={registerFlush}
            >
              {(value, onChange, commit) => (
                <OccupationFieldsEditor
                  value={value}
                  onChange={onChange}
                  onCommit={commit}
                  client={suggestions?.occupation}
                />
              )}
            </AutosaveFields>
          </CardContent>
        </Card>
        <InterviewRelationships
          clientId={clientId}
          relationships={data.relationships}
          partnerships={data.partnerships}
          relationshipStatus={data.relationshipStatus}
          onRelationships={onRelationships}
          onPhase={onPhase}
          registerFlush={registerFlush}
          relationshipClient={suggestions?.relationshipStatus}
          childrenPrompt={suggestions?.numberOfChildren?.label ?? null}
        />
        <Card>
          <CardHeader>
            <CardTitle>Living situation</CardTitle>
          </CardHeader>
          <CardContent>
            <AutosaveFields
              saved={data.demographics.livingSituation}
              save={async (value) => {
                const result = await saveLivingSituationAction(clientId, value)
                if ("error" in result && result.error) return { error: result.error }
                if (!("livingSituation" in result) || !result.livingSituation) return { error: "Could not save." }
                return { value: result.livingSituation }
              }}
              onPhase={(phase, retry) => onPhase("living", phase, retry)}
              registerFlush={registerFlush}
            >
              {(value, onChange, commit) => (
                <LivingFieldsEditor
                  value={value}
                  relationships={relationships}
                  onChange={onChange}
                  onCommit={commit}
                  client={suggestions?.living}
                />
              )}
            </AutosaveFields>
          </CardContent>
        </Card>
        <Button type="button" className="min-h-11" onClick={() => show("history")}>
          Continue to History
        </Button>
      </div>

      <div className={cn("py-4", page !== "history" && "hidden")}>
        <InterviewHistory
          clientId={clientId}
          dateOfBirth={data.dateOfBirth}
          events={data.events}
          relationships={relationships}
          screening={screening}
          medication={data.medication}
          stressors={data.stressors}
          selfReportId={selfReport?.resultId ?? null}
          historyClient={suggestions?.history}
          medicationClient={suggestions?.medication}
          stressorsClient={suggestions?.stressors}
          onEvents={() => {}}
          onPhase={onPhase}
          registerFlush={registerFlush}
          registerComplete={registerComplete}
        />
      </div>
    </div>
  )
}

function formatReceived(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Sydney",
  })
}

function PageButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn("min-h-11 rounded px-3 text-sm", pressed && "bg-muted font-medium")}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
