"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import {
  completeBackgroundInterviewAction,
  saveInterviewScreeningAction,
  saveStressorsAction,
} from "@/app/clients/[client_id]/background/actions"
import { AutosaveFields, type SavePhase } from "@/components/client-background/interview-autosave"
import {
  InterviewSectionCard,
  needsBadge,
  readSectionOpenState,
  writeSectionOpenState,
} from "@/components/client-background/interview-section-card"
import { HistoryTreeSection } from "@/components/client-background/history-tree-section"
import { StressorsFields } from "@/components/client-background/medication-stressors"
import { WorthCheckingLinks } from "@/components/client-background/worth-checking"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ClientBackgroundSuggestions } from "@/lib/background-questionnaire/to-client-background"
import type { ProfessionalOption } from "@/lib/client-background/professionals"
import type { BackgroundCheck } from "@/lib/client-background/checks"
import {
  HISTORY_QUESTION_GROUPS,
  HISTORY_QUESTIONS,
  unansweredInterviewLabels,
  type HistoryQuestionKey,
  type ScreeningAnswer,
  type ScreeningAnswers,
} from "@/lib/client-background/interview-history"
import type {
  EventRecord,
  HistoryIssue,
  RelationshipRecord,
  StressorsRecord,
} from "@/lib/client-background/types"

export function InterviewHistory({
  clientId,
  dateOfBirth,
  events,
  relationships,
  screening,
  stressors,
  selfReportId,
  historyClient,
  medicationClient,
  professionals,
  stressorsClient,
  issues,
  onEvents,
  onPhase,
  registerFlush,
  registerComplete,
  getChecks,
  onJumpToCheck,
  sectionSyncKey = 0,
}: {
  clientId: string
  dateOfBirth: string | null
  events: EventRecord[]
  relationships: RelationshipRecord[]
  screening: ScreeningAnswers
  stressors: StressorsRecord
  selfReportId: string | null
  historyClient?: ClientBackgroundSuggestions["history"]
  medicationClient?: ClientBackgroundSuggestions["medication"]
  professionals: ProfessionalOption[]
  stressorsClient?: ClientBackgroundSuggestions["stressors"]
  issues?: HistoryIssue[]
  onEvents: (events: EventRecord[]) => void
  onPhase: (id: string, phase: SavePhase, retry: (() => void) | null) => void
  registerFlush: (flush: () => Promise<void>) => () => void
  registerComplete: (open: () => void) => void
  getChecks: (current: {
    screening: ScreeningAnswers
    events: EventRecord[]
    stressors: StressorsRecord
  }) => BackgroundCheck[]
  onJumpToCheck: (check: BackgroundCheck) => void
  /** Bumped when Worth checking opens a history section via sessionStorage. */
  sectionSyncKey?: number
}) {
  const [answers, setAnswers] = useState(screening)
  const [entries, setEntries] = useState(events)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [unanswered, setUnanswered] = useState<string[]>([])
  const [checks, setChecks] = useState<BackgroundCheck[]>([])
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({})
  const router = useRouter()
  useEffect(() => {
    setSectionOpen(readSectionOpenState(clientId, "history"))
  }, [clientId, sectionSyncKey])

  function toggleHistorySection(id: string) {
    setSectionOpen((current) => {
      const next = { ...current, [id]: !current[id] }
      writeSectionOpenState(clientId, "history", next)
      return next
    })
  }
  const answersRef = useRef(answers)
  const entriesRef = useRef(entries)
  const stressorsRef = useRef(stressors)
  const token = useRef(0)
  const inflight = useRef<Promise<void> | null>(null)
  answersRef.current = answers
  entriesRef.current = entries
  stressorsRef.current = stressors

  useEffect(() => {
    registerComplete(() => {
      setUnanswered(
        unansweredInterviewLabels(
          answersRef.current,
          entriesRef.current,
          dateOfBirth,
          stressorsRef.current,
          issues ?? []
        )
      )
      setChecks(
        getChecks({
          screening: answersRef.current,
          events: entriesRef.current,
          stressors: stressorsRef.current,
        })
      )
      setCompleteError(null)
      setConfirmOpen(true)
    })
  }, [dateOfBirth, getChecks, issues, registerComplete])

  useEffect(() => {
    return registerFlush(async () => {
      if (inflight.current) await inflight.current
    })
  }, [registerFlush])

  function replaceEntries(next: EventRecord[]) {
    entriesRef.current = next
    setEntries(next)
    onEvents(next)
  }

  async function choose(key: HistoryQuestionKey, answer: ScreeningAnswer | "") {
    const next = { ...answersRef.current }
    if (answer === "") delete next[key]
    else next[key] = answer
    answersRef.current = next
    setAnswers(next)
    const current = ++token.current
    onPhase("screening", "saving", null)
    const work = (async () => {
      const result = await saveInterviewScreeningAction(clientId, next)
      if (current !== token.current) return
      if (result.error || !result.screening) {
        onPhase("screening", "error", () => void choose(key, answer))
        return
      }
      answersRef.current = result.screening
      setAnswers(result.screening)
      onPhase("screening", "saved", null)
    })()
    inflight.current = work
    try {
      await work
    } finally {
      if (inflight.current === work) inflight.current = null
    }
  }

  async function complete() {
    setCompleting(true)
    setCompleteError(null)
    const result = await completeBackgroundInterviewAction(clientId, selfReportId)
    if (result.error) {
      setCompleting(false)
      setCompleteError(result.error)
      return
    }
    router.push(`/clients/${clientId}/background`)
  }

  const liveChecks = getChecks({
    screening: answers,
    events: entries,
    stressors: stressorsRef.current,
  })

  function historyGroupNeeds(group: (typeof HISTORY_QUESTION_GROUPS)[number]): number {
    const keys = new Set<string>(group.keys)
    return liveChecks.filter((check) => {
      if (check.target !== "history") return false
      if (check.id.startsWith("history-")) return keys.has(check.id.slice("history-".length))
      const match = /^(?:detail|unlinked)-(.+)$/.exec(check.id)
      if (!match) return false
      const event = entries.find((item) => item.eventRecordId === match[1])
      if (!event) return false
      const about = event.about === "significant_other" ? "significant_other" : "self"
      return group.keys.some((key) => HISTORY_QUESTIONS[key].about === about)
    }).length
  }

  const sectionNeeds: Record<string, number> = {}
  for (const group of HISTORY_QUESTION_GROUPS) {
    sectionNeeds[group.title] = historyGroupNeeds(group)
  }

  return (
    <div className="space-y-4">
      <HistoryTreeSection
        clientId={clientId}
        dateOfBirth={dateOfBirth}
        events={entries}
        relationships={relationships}
        screening={answers}
        professionals={professionals}
        issues={issues}
        presentation="interview"
        sectionOpen={sectionOpen}
        onToggleSection={toggleHistorySection}
        sectionNeeds={sectionNeeds}
        onScreeningChange={(key, answer) => void choose(key, answer)}
        onEventsChange={replaceEntries}
        medicationClient={medicationClient}
        historyClient={historyClient}
      />

      <InterviewSectionCard
        title="Stressors"
        open={Boolean(sectionOpen.Stressors)}
        onToggle={() => toggleHistorySection("Stressors")}
        badge={needsBadge(0)}
      >
        <AutosaveFields
          saved={stressors}
          save={async (value) => {
            stressorsRef.current = value
            const result = await saveStressorsAction(clientId, value)
            if (result.error || !("stressors" in result) || !result.stressors) {
              return { error: result.error ?? "Could not save stressors." }
            }
            stressorsRef.current = result.stressors
            return { value: result.stressors }
          }}
          onPhase={(phase, retry) => onPhase("stressors", phase, retry)}
          registerFlush={registerFlush}
        >
          {(value, onChange, commit) => {
            stressorsRef.current = value
            return (
              <StressorsFields
                idPrefix="interview_stressors"
                value={value}
                onChange={onChange}
                onCommit={commit}
                client={stressorsClient}
              />
            )
          }}
        </AutosaveFields>
      </InterviewSectionCard>

      <Dialog open={confirmOpen} onOpenChange={(next) => !completing && setConfirmOpen(next)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete background interview</DialogTitle>
          </DialogHeader>
          {unanswered.length > 0 ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">Still unanswered</p>
              <p className="text-sm text-muted-foreground">
                These will be recorded as Not asked: {unanswered.join(", ")}.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Complete this background interview?</p>
          )}
          {checks.length > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <p className="font-medium">Worth checking ({checks.length})</p>
              <div className="mt-2">
                <WorthCheckingLinks
                  checks={checks}
                  onJump={(check) => {
                    setConfirmOpen(false)
                    onJumpToCheck(check)
                  }}
                />
              </div>
            </div>
          ) : null}
          {completeError ? <p className="text-sm text-destructive">{completeError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" disabled={completing} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="min-h-11" disabled={completing} onClick={() => void complete()}>
              {completing ? "Completing…" : "Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
