"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import {
  createEventAction,
  deleteEventAction,
  updateEventAction,
  updateHistoryIssueTreatmentAnswerAction,
} from "@/app/clients/[client_id]/background/actions"
import { ReadOnlyField, SaveRow, SelectField } from "@/components/client-background/fields"
import { EventEditor } from "@/components/client-background/history-section"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { clientAgeAtStart, formatPartialWhen } from "@/lib/client-background/age"
import { resolveHistoryIssues } from "@/lib/client-background/history-issues"
import { buildHistoryTree, type HistoryTreeNode } from "@/lib/client-background/history-tree"
import { isConditionEvent, isTreatmentEvent } from "@/lib/client-background/history-links"
import type { ScreeningAnswers } from "@/lib/client-background/interview-history"
import type { ProfessionalOption } from "@/lib/client-background/professionals"
import {
  emptyEvent,
  EVENT_TYPE_LABELS,
  TREATMENT_ANSWER_LABELS,
  TREATMENT_ANSWERS,
  type EventRecord,
  type HistoryIssue,
  type RelationshipRecord,
  type StartPrecision,
  type TreatmentAnswer,
} from "@/lib/client-background/types"
import { cn } from "@/lib/utils"

type Selection =
  | { kind: "entry"; id: string }
  | { kind: "issue"; id: string }
  | { kind: "add"; about: "self" | "significant_other"; eventType?: EventRecord["eventType"]; issueId?: string }
  | { kind: "treatment"; issueId: string }
  | { kind: "step"; parentId: string }

export function HistoryTreeSection({
  clientId,
  dateOfBirth,
  events,
  relationships,
  screening,
  professionals,
  issues: storedIssues,
  readOnly = false,
}: {
  clientId: string
  dateOfBirth: string | null
  events: EventRecord[]
  relationships: RelationshipRecord[]
  screening: ScreeningAnswers
  professionals: ProfessionalOption[]
  issues?: HistoryIssue[]
  readOnly?: boolean
}) {
  const [localEvents, setLocalEvents] = useState<EventRecord[] | null>(null)
  const [localIssues, setLocalIssues] = useState<HistoryIssue[] | null>(null)
  const incoming = JSON.stringify(
    events.map((event) => [
      event.eventRecordId,
      event.title,
      event.conditionGroupId,
      event.parentEventId,
      event.startValue,
      event.endValue,
    ])
  )
  useEffect(() => {
    setLocalEvents(null)
    setLocalIssues(null)
  }, [incoming])
  const shown = localEvents ?? events
  const issues = resolveHistoryIssues(shown, localIssues ?? storedIssues)
  const tree = buildHistoryTree({
    events: shown,
    relationships,
    dateOfBirth,
    screening,
    professionals,
    issues,
  })
  const [selection, setSelection] = useState<Selection | null>(null)
  const [mode, setMode] = useState<"view" | "edit">("view")
  const [draft, setDraft] = useState<EventRecord | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  useEffect(() => {
    if (!selection) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selection])

  function close() {
    setSelection(null)
    setDraft(null)
    setMode("view")
    setIsNew(false)
    setError(null)
  }

  function openEntry(id: string) {
    const entry = shown.find((event) => event.eventRecordId === id)
    const issue = issues.find((item) => item.issueId === id)
    if (entry) {
      setSelection({ kind: "entry", id })
      setDraft({ ...entry })
    } else if (issue) {
      setSelection({ kind: "issue", id })
      const episode = shown.find((event) => event.conditionGroupId === id && isConditionEvent(event.eventType))
      setDraft(episode ? { ...episode } : null)
    }
    setMode("view")
    setIsNew(false)
    setError(null)
  }

  function startAdd(about: "self" | "significant_other", eventType: EventRecord["eventType"] = "emotional_problems", issueId?: string) {
    setSelection({ kind: "add", about, eventType, issueId })
    setDraft({
      ...emptyEvent(eventType, 0),
      eventRecordId: "",
      about,
      conditionGroupId: issueId ?? null,
    })
    setMode("edit")
    setIsNew(true)
    setError(null)
  }

  function startTreatment(issue: HistoryIssue) {
    setSelection({ kind: "treatment", issueId: issue.issueId })
    setDraft({
      ...emptyEvent("psychiatric_admission", 0),
      eventRecordId: "",
      about: issue.about,
      relationshipRecordId: issue.relationshipRecordId,
      conditionGroupId: issue.issueId,
    })
    setMode("edit")
    setIsNew(true)
    setError(null)
  }

  function startStep(parent: EventRecord) {
    setSelection({ kind: "step", parentId: parent.eventRecordId })
    setDraft({
      ...emptyEvent(parent.eventType, 0),
      eventRecordId: "",
      about: parent.about,
      relationshipRecordId: parent.relationshipRecordId,
      aboutOther: parent.aboutOther,
      conditionGroupId: parent.conditionGroupId,
      parentEventId: parent.eventRecordId,
    })
    setMode("edit")
    setIsNew(true)
    setError(null)
  }

  async function save() {
    if (!draft) return
    setPending(true)
    setError(null)
    const result = isNew ? await createEventAction(clientId, draft) : await updateEventAction(clientId, draft)
    setPending(false)
    if (result.error || !result.event) {
      setError(result.error ?? "Could not save this entry.")
      return
    }
    setLocalEvents(isNew ? [...shown, result.event] : shown.map((event) => (event.eventRecordId === result.event!.eventRecordId ? result.event! : event)))
    setDraft(result.event)
    setSelection({ kind: "entry", id: result.event.eventRecordId })
    setIsNew(false)
    setMode("view")
  }

  function cancel() {
    if (isNew) {
      close()
      return
    }
    const saved = shown.find((event) => event.eventRecordId === draft?.eventRecordId)
    if (saved) setDraft({ ...saved })
    setMode("view")
    setError(null)
  }

  async function remove() {
    if (!draft?.eventRecordId) return
    if (!window.confirm("Remove this history entry?")) return
    setPending(true)
    const result = await deleteEventAction(clientId, draft.eventRecordId)
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setLocalEvents(shown.filter((event) => event.eventRecordId !== draft.eventRecordId && event.parentEventId !== draft.eventRecordId))
    close()
  }

  const selectedIssue =
    selection?.kind === "issue"
      ? issues.find((item) => item.issueId === selection.id)
      : selection?.kind === "treatment"
        ? issues.find((item) => item.issueId === selection.issueId)
        : undefined
  const entry = selection?.kind === "entry" ? shown.find((event) => event.eventRecordId === selection.id) : undefined
  const showAddTreatment = !readOnly && mode === "view" && selectedIssue != null
  const showAddStep = !readOnly && mode === "view" && entry != null && !entry.parentEventId

  async function setTreatmentAnswer(issueId: string, value: TreatmentAnswer | "") {
    const result = await updateHistoryIssueTreatmentAnswerAction(clientId, issueId, value)
    if (result.error || !result.issue) {
      setError(result.error ?? "Could not save the treatment answer.")
      return
    }
    setLocalIssues(issues.map((item) => (item.issueId === result.issue!.issueId ? result.issue! : item)))
  }

  return (
    <div className="space-y-4">
      <TreeCard
        title={tree.client.title}
        nodes={tree.client.children}
        onAdd={readOnly ? undefined : () => startAdd("self")}
        onOpen={openEntry}
        onAddEpisode={readOnly ? undefined : (issueId) => startAdd("self", "emotional_problems", issueId)}
        onAddTreatment={readOnly ? undefined : (issueId) => {
          const found = issues.find((item) => item.issueId === issueId)
          if (found) startTreatment(found)
        }}
        onAddStep={readOnly ? undefined : (parentId) => {
          const parent = shown.find((event) => event.eventRecordId === parentId)
          if (parent) startStep(parent)
        }}
        onTreatmentAnswer={readOnly ? undefined : (issueId, value) => void setTreatmentAnswer(issueId, value)}
        readOnly={readOnly}
      />
      <TreeCard
        title={tree.family.title}
        nodes={tree.family.children}
        onAdd={readOnly ? undefined : () => startAdd("significant_other")}
        onOpen={openEntry}
        onAddEpisode={readOnly ? undefined : (issueId) => {
          const found = issues.find((item) => item.issueId === issueId)
          startAdd("significant_other", found?.category ?? "emotional_problems", issueId)
        }}
        onAddTreatment={readOnly ? undefined : (issueId) => {
          const found = issues.find((item) => item.issueId === issueId)
          if (found) startTreatment(found)
        }}
        onAddStep={readOnly ? undefined : (parentId) => {
          const parent = shown.find((event) => event.eventRecordId === parentId)
          if (parent) startStep(parent)
        }}
        onTreatmentAnswer={readOnly ? undefined : (issueId, value) => void setTreatmentAnswer(issueId, value)}
        readOnly={readOnly}
      />
      {ready && selection && draft
        ? createPortal(
            <div className="fixed inset-0 z-50">
              <button type="button" className="absolute inset-0 bg-black/20" aria-label="Dismiss" onClick={close} />
              <aside
                role="dialog"
                aria-modal="true"
                aria-label={draft.title.trim() || "History"}
                className="absolute inset-y-0 right-0 flex w-full animate-[relationship-panel_200ms_ease-out] flex-col overflow-y-auto bg-background p-4 shadow-xl sm:w-[440px]"
              >
                <style>{`@keyframes relationship-panel { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold">
                    {draft.parentEventId ? "Step" : draft.title.trim() || EVENT_TYPE_LABELS[draft.eventType]}
                  </h2>
                  <Button type="button" variant="ghost" size="sm" onClick={close}>
                    Close
                  </Button>
                </div>
                {mode === "edit" ? (
                  <>
                    {draft.parentEventId ? (
                      <StepEditor draft={draft} dateOfBirth={dateOfBirth} onChange={setDraft} />
                    ) : (
                      <EventEditor
                        draft={draft}
                        dateOfBirth={dateOfBirth}
                        relationships={relationships}
                        events={shown}
                        professionals={professionals}
                        onChange={setDraft}
                      />
                    )}
                    <div className="mt-4">
                      <SaveRow
                        pending={pending}
                        error={error}
                        onSave={() => void save()}
                        extra={
                          <>
                            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={cancel}>
                              Cancel
                            </Button>
                            {isNew ? null : (
                              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => void remove()}>
                                Remove
                              </Button>
                            )}
                          </>
                        }
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <EntryDetails entry={draft} dateOfBirth={dateOfBirth} />
                    {selectedIssue ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Treatment: {treatmentAnswerText(selectedIssue.treatmentAnswer)}
                      </p>
                    ) : null}
                    <div className="mt-6 flex flex-wrap gap-2">
                      {showAddTreatment && selectedIssue ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => startTreatment(selectedIssue)}>
                          + Add treatment
                        </Button>
                      ) : null}
                      {showAddStep && entry ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => startStep(entry)}>
                          + Add step
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" onClick={() => setMode("edit")}>
                        Edit
                      </Button>
                    </div>
                    {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
                  </>
                )}
              </aside>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}

function treatmentAnswerText(answer: TreatmentAnswer | ""): string {
  if (answer === "none") return "None"
  if (answer === "not_asked") return "not asked"
  if (answer === "yes") return "Yes"
  return ""
}

function StepEditor({
  draft,
  dateOfBirth,
  onChange,
}: {
  draft: EventRecord
  dateOfBirth: string | null
  onChange: (next: EventRecord) => void
}) {
  void dateOfBirth
  return (
    <div className="space-y-4">
      <SelectField
        id="step_title"
        label="Title"
        value=""
        onChange={() => undefined}
      >
        <option value="">Use text field below</option>
      </SelectField>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Title</span>
        <input
          className="flex h-11 w-full rounded-md border px-3 text-base"
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Date (year, or year-month, or full date)</span>
        <input
          className="flex h-11 w-full rounded-md border px-3 text-base"
          value={draft.startValue}
          placeholder="YYYY or YYYY-MM or YYYY-MM-DD"
          onChange={(event) => {
            const value = event.target.value.trim()
            const precision: StartPrecision | "" =
              /^\d{4}-\d{2}-\d{2}$/.test(value) ? "date" : /^\d{4}-\d{2}$/.test(value) ? "year_month" : /^\d{4}$/.test(value) ? "year" : ""
            onChange({ ...draft, startValue: value, startPrecision: precision })
          }}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Note</span>
        <textarea
          className="min-h-24 w-full rounded-md border px-3 py-2 text-base"
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </label>
    </div>
  )
}

function EntryDetails({ entry, dateOfBirth }: { entry: EventRecord; dateOfBirth: string | null }) {
  const endOngoing = entry.endOngoing || entry.resolvedOrOngoing === "ongoing"
  return (
    <div className="space-y-4">
      <ReadOnlyField label="Type" value={EVENT_TYPE_LABELS[entry.eventType]} />
      <ReadOnlyField label="Title" value={entry.title} />
      <ReadOnlyField label="Start" value={dated(entry.startPrecision, entry.startValue, dateOfBirth)} />
      <ReadOnlyField
        label="End"
        value={endOngoing ? ongoingEnd(entry, dateOfBirth) : dated(entry.endPrecision, entry.endValue, dateOfBirth)}
      />
      <ReadOnlyField label="Description" value={entry.description} />
    </div>
  )
}

function dated(precision: StartPrecision | "", value: string, dateOfBirth: string | null): string {
  const when = formatPartialWhen(precision, value)
  const age = clientAgeAtStart(dateOfBirth, precision, value)
  return [when, age != null ? `age ${age}` : ""].filter(Boolean).join(" · ")
}

function ongoingEnd(entry: EventRecord, dateOfBirth: string | null): string {
  const age = clientAgeAtStart(dateOfBirth, entry.startPrecision, entry.startValue)
  return age != null ? `Ongoing · from age ${age}` : "Ongoing"
}

function TreeCard({
  title,
  nodes,
  onAdd,
  onOpen,
  onAddEpisode,
  onAddTreatment,
  onAddStep,
  onTreatmentAnswer,
  readOnly,
}: {
  title: string
  nodes: HistoryTreeNode[]
  onAdd?: () => void
  onOpen: (id: string) => void
  onAddEpisode?: (issueId: string) => void
  onAddTreatment?: (issueId: string) => void
  onAddStep?: (parentId: string) => void
  onTreatmentAnswer?: (issueId: string, value: TreatmentAnswer | "") => void
  readOnly?: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {onAdd ? (
          <button type="button" className="text-sm text-primary underline-offset-2 hover:underline" onClick={onAdd}>
            + Add
          </button>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {nodes.map((node) =>
            node.kind === "section" ? (
              <div key={node.title}>
                <h3 className="mb-2 text-sm font-semibold">{node.title}</h3>
                {node.children.length > 0 ? (
                  <ConnectedList
                    nodes={node.children}
                    onOpen={onOpen}
                    onAddEpisode={onAddEpisode}
                    onAddTreatment={onAddTreatment}
                    onAddStep={onAddStep}
                    onTreatmentAnswer={onTreatmentAnswer}
                    readOnly={readOnly}
                  />
                ) : null}
              </div>
            ) : null
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ConnectedList({
  nodes,
  onOpen,
  onAddEpisode,
  onAddTreatment,
  onAddStep,
  onTreatmentAnswer,
  readOnly,
}: {
  nodes: HistoryTreeNode[]
  onOpen: (id: string) => void
  onAddEpisode?: (issueId: string) => void
  onAddTreatment?: (issueId: string) => void
  onAddStep?: (parentId: string) => void
  onTreatmentAnswer?: (issueId: string, value: TreatmentAnswer | "") => void
  readOnly?: boolean
}) {
  return (
    <ul>
      {nodes.map((node, index) => (
        <li key={nodeKey(node, index)} className="relative pl-4">
          <span
            aria-hidden
            className="absolute top-0 left-0 w-0.5 bg-[#a1a1aa]"
            style={{ height: index === nodes.length - 1 ? 20 : "100%" }}
          />
          <span aria-hidden className="absolute top-5 left-0 h-0.5 w-4 bg-[#a1a1aa]" />
          {node.kind === "note" ? (
            <p className="flex min-h-10 items-center px-1 text-sm text-muted-foreground italic">{node.text}</p>
          ) : node.kind === "band" ? (
            <>
              <button
                type="button"
                className="flex min-h-10 w-full flex-col justify-center rounded-[8px] bg-[#f4f4f5] px-3 py-2 text-left hover:bg-[#e4e4e7]"
                onClick={() => onOpen(node.id)}
              >
                <span className="text-sm font-medium">{node.heading}</span>
                {node.meta ? <span className="text-xs text-muted-foreground">{node.meta}</span> : null}
                {node.needsWho ? (
                  <span className="mt-1 w-fit rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-950">
                    Needs who
                  </span>
                ) : null}
              </button>
              {readOnly && node.treatmentAnswer ? (
                <p className="px-1 py-1 text-xs text-muted-foreground">
                  Treatment: {treatmentAnswerText(node.treatmentAnswer)}
                </p>
              ) : null}
              {!readOnly && onTreatmentAnswer ? (
                <div className="py-1 pl-1">
                  <SelectField
                    id={`treatment_${node.id}`}
                    label="Treatment"
                    value={node.treatmentAnswer || ""}
                    disabled={Boolean(
                      node.children.some((child) => child.kind === "row" && child.tag === "Treatment")
                    )}
                    onChange={(next) => {
                      const value =
                        next === "yes" || next === "none" || next === "not_asked" ? next : ""
                      onTreatmentAnswer(node.id, value)
                    }}
                  >
                    <option value="">Select…</option>
                    {TREATMENT_ANSWERS.map((option) => (
                      <option
                        key={option}
                        value={option}
                        disabled={
                          node.children.some((child) => child.kind === "row" && child.tag === "Treatment") &&
                          option !== "yes"
                        }
                      >
                        {TREATMENT_ANSWER_LABELS[option]}
                      </option>
                    ))}
                  </SelectField>
                </div>
              ) : null}
              {node.children.length > 0 ? (
                <ConnectedList
                  nodes={node.children}
                  onOpen={onOpen}
                  onAddEpisode={onAddEpisode}
                  onAddTreatment={onAddTreatment}
                  onAddStep={onAddStep}
                  onTreatmentAnswer={onTreatmentAnswer}
                  readOnly={readOnly}
                />
              ) : null}
              {!readOnly && (onAddEpisode || onAddTreatment) ? (
                <div className="flex flex-wrap gap-3 px-1 py-1 text-sm">
                  {onAddEpisode ? (
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => onAddEpisode(node.id)}
                    >
                      + Add episode
                    </button>
                  ) : null}
                  {onAddTreatment ? (
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => onAddTreatment(node.id)}
                    >
                      + Add treatment
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : node.kind === "row" ? (
            <>
              <button
                type="button"
                className="flex min-h-10 w-full items-center gap-2 rounded-md px-1 text-left text-sm hover:bg-muted"
                onClick={() => onOpen(node.id)}
              >
                {node.tag ? <Tag label={node.tag} /> : null}
                <RowLine line={node.line} />
              </button>
              {node.children.length > 0 ? (
                <ConnectedList
                  nodes={node.children}
                  onOpen={onOpen}
                  onAddEpisode={onAddEpisode}
                  onAddTreatment={onAddTreatment}
                  onAddStep={onAddStep}
                  onTreatmentAnswer={onTreatmentAnswer}
                  readOnly={readOnly}
                />
              ) : null}
              {!readOnly && onAddStep && !node.tag?.includes("Step") ? (
                <button
                  type="button"
                  className="px-1 py-1 text-sm text-primary underline-offset-2 hover:underline"
                  onClick={() => onAddStep(node.id)}
                >
                  + Add step
                </button>
              ) : null}
            </>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function Tag({ label }: { label: "Episode" | "Treatment" | "Step" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        label === "Episode" && "bg-indigo-100 text-indigo-800",
        label === "Treatment" && "bg-emerald-100 text-emerald-800",
        label === "Step" && "bg-zinc-100 text-zinc-700"
      )}
    >
      {label}
    </span>
  )
}

function RowLine({ line }: { line: string }) {
  const [name, ...rest] = line.split(" · ")
  return (
    <span>
      <span className="font-medium">{name}</span>
      {rest.length > 0 ? <span className="text-muted-foreground"> · {rest.join(" · ")}</span> : null}
    </span>
  )
}

function nodeKey(node: HistoryTreeNode, index: number): string {
  if (node.kind === "note") return `${node.text}-${index}`
  if (node.kind === "section") return node.title
  if (node.kind === "actions") return `actions-${node.issueId ?? index}`
  return node.id
}
