"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { createEventAction, deleteEventAction, updateEventAction } from "@/app/clients/[client_id]/background/actions"
import { ReadOnlyField, SaveRow } from "@/components/client-background/fields"
import { EventEditor } from "@/components/client-background/history-section"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { clientAgeAtStart, formatPartialWhen } from "@/lib/client-background/age"
import { conditionGroups } from "@/lib/client-background/condition-groups"
import { buildHistoryTree, type HistoryTreeNode } from "@/lib/client-background/history-tree"
import { isConditionEvent, isTreatmentEvent, treatmentsForCondition } from "@/lib/client-background/history-links"
import type { ScreeningAnswers } from "@/lib/client-background/interview-history"
import type { ProfessionalOption } from "@/lib/client-background/professionals"
import {
  emptyEvent,
  EVENT_TYPE_LABELS,
  type EventRecord,
  type RelationshipRecord,
  type StartPrecision,
} from "@/lib/client-background/types"

type Selection =
  | { kind: "entry"; id: string }
  | { kind: "condition"; id: string }
  | { kind: "add"; about: "self" | "significant_other" }
  | { kind: "treatment"; conditionId: string }

export function HistoryTreeSection({
  clientId,
  dateOfBirth,
  events,
  relationships,
  screening,
  professionals,
}: {
  clientId: string
  dateOfBirth: string | null
  events: EventRecord[]
  relationships: RelationshipRecord[]
  screening: ScreeningAnswers
  professionals: ProfessionalOption[]
}) {
  const [local, setLocal] = useState<EventRecord[] | null>(null)
  const incoming = JSON.stringify(events.map((event) => [event.eventRecordId, event.title, event.conditionEventId, event.conditionGroupId, event.startValue, event.endValue, event.resolvedOrOngoing]))
  useEffect(() => setLocal(null), [incoming])
  const shown = local ?? events
  const tree = buildHistoryTree({ events: shown, relationships, dateOfBirth, screening, professionals })
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
    const group = conditionGroups(shown, dateOfBirth).find((item) => item.id === id)
    if (entry) {
      setSelection({ kind: "entry", id })
      setDraft({ ...entry })
    } else if (group) {
      setSelection({ kind: "condition", id })
      setDraft({ ...group.episodes[0] })
    }
    setMode("view")
    setIsNew(false)
    setError(null)
  }

  function startAdd(about: "self" | "significant_other") {
    setSelection({ kind: "add", about })
    setDraft({
      ...emptyEvent("emotional_problems", 0),
      eventRecordId: "",
      about,
      attribution: about === "significant_other" ? "family" : "self",
    })
    setMode("edit")
    setIsNew(true)
    setError(null)
  }

  function startTreatment(condition: EventRecord) {
    setSelection({ kind: "treatment", conditionId: condition.eventRecordId })
    setDraft({
      ...emptyEvent("psychiatric_admission", 0),
      eventRecordId: "",
      about: condition.about,
      attribution: condition.attribution,
      relationshipRecordId: condition.relationshipRecordId,
      aboutOther: condition.aboutOther,
      familyRelation: condition.familyRelation,
      conditionEventId: condition.eventRecordId,
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
    setLocal(isNew ? [...shown, result.event] : shown.map((event) => (event.eventRecordId === result.event!.eventRecordId ? result.event! : event)))
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
    setLocal(shown.filter((event) => event.eventRecordId !== draft.eventRecordId))
    close()
  }

  const condition = selection?.kind === "condition" ? conditionGroups(shown, dateOfBirth).find((group) => group.id === selection.id) : undefined
  const entry = selection?.kind === "entry" ? shown.find((event) => event.eventRecordId === selection.id) : undefined
  const showAddTreatment = mode === "view" && (condition != null || (entry != null && isConditionEvent(entry.eventType)))
  const treatmentTarget = condition?.episodes.find((episode) => episode.endOngoing || episode.resolvedOrOngoing === "ongoing") ?? condition?.episodes[0] ?? (entry && isConditionEvent(entry.eventType) ? entry : null)

  return (
    <div className="space-y-4">
      <TreeCard title={tree.client.title} nodes={tree.client.children} onAdd={() => startAdd("self")} onOpen={openEntry} />
      <TreeCard title={tree.family.title} nodes={tree.family.children} onAdd={() => startAdd("significant_other")} onOpen={openEntry} />
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
                  <h2 className="text-base font-semibold">{draft.title.trim() || EVENT_TYPE_LABELS[draft.eventType]}</h2>
                  <Button type="button" variant="ghost" size="sm" onClick={close}>
                    Close
                  </Button>
                </div>
                {mode === "edit" ? (
                  <>
                    <EventEditor draft={draft} dateOfBirth={dateOfBirth} relationships={relationships} events={shown} professionals={professionals} onChange={setDraft} />
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
                    <EntryDetails
                      entry={draft}
                      conditionEpisodes={condition?.episodes}
                      events={shown}
                      dateOfBirth={dateOfBirth}
                    />
                    <div className="mt-6 flex gap-2">
                      {showAddTreatment && treatmentTarget ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => startTreatment(treatmentTarget)}>
                          + Add treatment
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" onClick={() => setMode("edit")}>
                        Edit
                      </Button>
                    </div>
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

function EntryDetails({
  entry,
  conditionEpisodes,
  events,
  dateOfBirth,
}: {
  entry: EventRecord
  conditionEpisodes?: EventRecord[]
  events: EventRecord[]
  dateOfBirth: string | null
}) {
  const episodes = conditionEpisodes ?? (isConditionEvent(entry.eventType) ? [entry] : [])
  const treatments = episodes.flatMap((episode) => treatmentsForCondition(events, episode.eventRecordId))
  const linked = entry.conditionEventId ? events.find((event) => event.eventRecordId === entry.conditionEventId) : undefined
  const endOngoing = entry.endOngoing || entry.resolvedOrOngoing === "ongoing"
  return (
    <div className="space-y-4">
      <ReadOnlyField label="Type" value={EVENT_TYPE_LABELS[entry.eventType]} />
      <ReadOnlyField label="Title" value={entry.title} />
      <ReadOnlyField label="Start" value={dated(entry.startPrecision, entry.startValue, dateOfBirth)} />
      <ReadOnlyField label="End" value={endOngoing ? ongoingEnd(entry, dateOfBirth) : dated(entry.endPrecision, entry.endValue, dateOfBirth)} />
      <ReadOnlyField label="Description" value={entry.description} />
      {episodes.length > 0 ? (
        <ReadOnlyField
          label="Treatments"
          value={treatments.length > 0 ? treatments.map((treatment) => treatment.title.trim() || EVENT_TYPE_LABELS[treatment.eventType]).join(", ") : "No treatment recorded"}
        />
      ) : null}
      {isTreatmentEvent(entry.eventType) ? (
        <ReadOnlyField label="For" value={linked ? linked.title.trim() || EVENT_TYPE_LABELS[linked.eventType] : ""} />
      ) : null}
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
}: {
  title: string
  nodes: HistoryTreeNode[]
  onAdd: () => void
  onOpen: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <button type="button" className="text-sm text-primary underline-offset-2 hover:underline" onClick={onAdd}>
          + Add
        </button>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {nodes.map((node) =>
            node.kind === "section" ? (
              <div key={node.title}>
                <h3 className="mb-2 text-sm font-semibold">{node.title}</h3>
                {node.children.length > 0 ? <ConnectedList nodes={node.children} onOpen={onOpen} /> : null}
              </div>
            ) : null
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ConnectedList({ nodes, onOpen }: { nodes: HistoryTreeNode[]; onOpen: (id: string) => void }) {
  return (
    <ul>
      {nodes.map((node, index) => (
        <li key={nodeKey(node, index)} className="relative pl-4">
          <span aria-hidden className="absolute top-0 left-0 w-0.5 bg-[#a1a1aa]" style={{ height: index === nodes.length - 1 ? 20 : "100%" }} />
          <span aria-hidden className="absolute top-5 left-0 h-0.5 w-4 bg-[#a1a1aa]" />
          {node.kind === "note" ? (
            <p className="flex min-h-10 items-center px-1 text-sm text-muted-foreground italic">{node.text}</p>
          ) : node.kind === "band" ? (
            <>
              <button type="button" className="flex min-h-10 w-full flex-col justify-center rounded-[8px] bg-[#f4f4f5] px-3 py-2 text-left hover:bg-[#e4e4e7]" onClick={() => onOpen(node.id)}>
                <span className="text-sm font-medium">{node.heading}</span>
                {node.meta ? <span className="text-xs text-muted-foreground">{node.meta}</span> : null}
              </button>
              {node.children.length > 0 ? <ConnectedList nodes={node.children} onOpen={onOpen} /> : null}
            </>
          ) : node.kind === "row" ? (
            <>
              <button type="button" className="flex min-h-10 w-full items-center rounded-md px-1 text-left text-sm hover:bg-muted" onClick={() => onOpen(node.id)}>
                <RowLine line={node.line} />
              </button>
              {node.children.length > 0 ? <ConnectedList nodes={node.children} onOpen={onOpen} /> : null}
            </>
          ) : null}
        </li>
      ))}
    </ul>
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
  return node.id
}
