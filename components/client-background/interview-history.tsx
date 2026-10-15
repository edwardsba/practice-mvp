"use client"

import { useEffect, useRef, useState, type MouseEvent } from "react"
import { useRouter } from "next/navigation"

import {
  completeBackgroundInterviewAction,
  createEventAction,
  deleteEventAction,
  saveInterviewScreeningAction,
  updateEventAction,
} from "@/app/clients/[client_id]/background/actions"
import { HistoryPanel, historyEntryLines } from "@/components/client-background/history-section"
import type { SavePhase } from "@/components/client-background/interview-autosave"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  HISTORY_QUESTION_GROUPS,
  HISTORY_QUESTIONS,
  eventsForQuestion,
  unansweredQuestionLabels,
  type HistoryQuestionKey,
  type ScreeningAnswer,
  type ScreeningAnswers,
} from "@/lib/client-background/interview-history"
import { emptyEvent, type EventRecord, type RelationshipRecord } from "@/lib/client-background/types"
import { cn } from "@/lib/utils"

const ANSWERS: { value: ScreeningAnswer; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not_asked", label: "Not asked" },
]

export function InterviewHistory({
  clientId,
  dateOfBirth,
  events,
  relationships,
  screening,
  onEvents,
  onPhase,
  registerFlush,
  registerComplete,
}: {
  clientId: string
  dateOfBirth: string | null
  events: EventRecord[]
  relationships: RelationshipRecord[]
  screening: ScreeningAnswers
  onEvents: (events: EventRecord[]) => void
  onPhase: (id: string, phase: SavePhase, retry: (() => void) | null) => void
  registerFlush: (flush: () => Promise<void>) => () => void
  registerComplete: (open: () => void) => void
}) {
  const [answers, setAnswers] = useState(screening)
  const [entries, setEntries] = useState(events)
  const [sheet, setSheet] = useState<{ draft: EventRecord; editing: boolean; isNew: boolean } | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [unanswered, setUnanswered] = useState<string[]>([])
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const router = useRouter()
  const opener = useRef<HTMLElement | null>(null)
  const scrollY = useRef(0)
  const answersRef = useRef(answers)
  const entriesRef = useRef(entries)
  const token = useRef(0)
  const inflight = useRef<Promise<void> | null>(null)
  answersRef.current = answers
  entriesRef.current = entries

  useEffect(() => {
    registerComplete(() => {
      setUnanswered(unansweredQuestionLabels(answersRef.current, entriesRef.current, dateOfBirth))
      setCompleteError(null)
      setConfirmOpen(true)
    })
  }, [dateOfBirth, registerComplete])

  useEffect(() => {
    return registerFlush(async () => {
      if (inflight.current) await inflight.current
    })
  }, [registerFlush])

  function remember(event: MouseEvent<HTMLButtonElement>) {
    opener.current = event.currentTarget
    scrollY.current = window.scrollY
  }

  function closeSheet(force = false) {
    if (pending && !force) return
    setSheet(null)
    setError(null)
    const node = opener.current
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY.current)
      node?.focus()
    })
  }

  function replaceEntries(next: EventRecord[]) {
    entriesRef.current = next
    setEntries(next)
    onEvents(next)
  }

  async function choose(key: HistoryQuestionKey, answer: ScreeningAnswer) {
    const next = { ...answersRef.current, [key]: answer }
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

  function addEntry(key: HistoryQuestionKey, event: MouseEvent<HTMLButtonElement>) {
    remember(event)
    const question = HISTORY_QUESTIONS[key]
    setError(null)
    setSheet({
      draft: {
        ...emptyEvent(question.eventType, 0),
        eventRecordId: "",
        attribution: question.attribution,
      },
      editing: true,
      isNew: true,
    })
  }

  async function saveEntry() {
    if (!sheet) return
    setPending(true)
    setError(null)
    onPhase("history", "saving", null)
    const result = sheet.isNew
      ? await createEventAction(clientId, sheet.draft)
      : await updateEventAction(clientId, sheet.draft)
    setPending(false)
    if (result.error || !result.event) {
      setError(result.error ?? "Could not save this entry.")
      onPhase("history", "error", () => void saveEntry())
      return
    }
    replaceEntries(
      sheet.isNew
        ? [...entriesRef.current, result.event]
        : entriesRef.current.map((entry) =>
            entry.eventRecordId === result.event!.eventRecordId ? result.event! : entry
          )
    )
    onPhase("history", "saved", null)
    closeSheet(true)
  }

  function cancelEntry() {
    if (!sheet) return
    if (sheet.isNew) {
      closeSheet(true)
      return
    }
    const saved = entriesRef.current.find((entry) => entry.eventRecordId === sheet.draft.eventRecordId)
    if (!saved) {
      closeSheet(true)
      return
    }
    setSheet({ draft: { ...saved }, editing: false, isNew: false })
    setError(null)
  }

  async function removeEntry() {
    if (!sheet) return
    if (!window.confirm("Remove this history entry?")) return
    setPending(true)
    setError(null)
    const result = await deleteEventAction(clientId, sheet.draft.eventRecordId)
    setPending(false)
    if (result.error) {
      setError(result.error)
      onPhase("history", "error", () => void removeEntry())
      return
    }
    replaceEntries(entriesRef.current.filter((entry) => entry.eventRecordId !== sheet.draft.eventRecordId))
    onPhase("history", "saved", null)
    closeSheet(true)
  }

  async function complete() {
    setCompleting(true)
    setCompleteError(null)
    const result = await completeBackgroundInterviewAction(clientId)
    if (result.error) {
      setCompleting(false)
      setCompleteError(result.error)
      return
    }
    router.push(`/clients/${clientId}/background`)
  }

  return (
    <div className="space-y-4">
      {HISTORY_QUESTION_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle>{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.keys.map((key) => {
              const question = HISTORY_QUESTIONS[key]
              const listed = eventsForQuestion(entries, key, dateOfBirth)
              const locked = listed.length > 0
              const shown: ScreeningAnswer | null = locked ? "yes" : answers[key] ?? null
              return (
                <div key={key} className="space-y-2 border-b pb-4 last:border-b-0 last:pb-0">
                  <div className="flex min-h-11 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium">{question.label}</p>
                    <div role="group" aria-label={question.label} className="flex flex-wrap gap-1">
                      {ANSWERS.map((answer) => (
                        <button
                          key={answer.value}
                          type="button"
                          aria-pressed={shown === answer.value}
                          disabled={locked && answer.value !== "yes"}
                          className={cn(
                            "min-h-9 rounded-md border px-3 text-sm",
                            shown === answer.value && "bg-primary text-primary-foreground"
                          )}
                          onClick={() => void choose(key, answer.value)}
                        >
                          {answer.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {locked ? <p className="text-xs text-muted-foreground">Entries recorded</p> : null}
                  {shown === "yes" ? (
                    <div className="space-y-1">
                      {listed.map((entry) => {
                        const lines = historyEntryLines(entry, dateOfBirth, relationships)
                        return (
                          <button
                            key={entry.eventRecordId}
                            type="button"
                            className="flex min-h-11 w-full flex-col justify-center rounded-md px-2 text-left hover:bg-muted"
                            onClick={(event) => {
                              remember(event)
                              setSheet({ draft: { ...entry }, editing: false, isNew: false })
                              setError(null)
                            }}
                          >
                            <span className="text-sm">{lines.title}</span>
                            <span className="text-xs text-muted-foreground">{lines.meta}</span>
                          </button>
                        )
                      })}
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center px-2 text-left text-sm text-primary"
                        onClick={(event) => addEntry(key, event)}
                      >
                        + Add entry
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}

      <Sheet open={sheet != null} onOpenChange={(next) => !next && closeSheet()}>
        <SheetContent className="h-full w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{sheet ? historyEntryLines(sheet.draft, dateOfBirth, relationships).title : "History"}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <HistoryPanel
              draft={sheet?.draft ?? null}
              editing={sheet?.editing ?? false}
              pending={pending}
              error={error}
              dateOfBirth={dateOfBirth}
              relationships={relationships}
              hideBack
              isNew={sheet?.isNew ?? false}
              onEdit={() => sheet && setSheet({ ...sheet, editing: true })}
              onCancel={cancelEntry}
              onBack={() => closeSheet()}
              backLabel="← Back"
              onChange={(draft) => sheet && setSheet({ ...sheet, draft })}
              onSave={() => void saveEntry()}
              onRemove={() => void removeEntry()}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmOpen} onOpenChange={(next) => !completing && setConfirmOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete background interview</DialogTitle>
            <DialogDescription>
              {unanswered.length > 0
                ? `These will be recorded as Not asked: ${unanswered.join(", ")}.`
                : "Complete this background interview?"}
            </DialogDescription>
          </DialogHeader>
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
