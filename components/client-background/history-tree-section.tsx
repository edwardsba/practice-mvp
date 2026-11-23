"use client"

import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import {
  createEventAction,
  createHistoryIssueAction,
  createUnplacedPersonAction,
  deleteEventAction,
  updateEventAction,
  updateHistoryIssueTreatmentAnswerAction,
} from "@/app/clients/[client_id]/background/actions"
import { ContextStrip } from "@/components/client-background/context-strip"
import { ClientAnswer, ReadOnlyField, SaveRow, SelectField } from "@/components/client-background/fields"
import { NewPersonDraftForm } from "@/components/client-background/new-person-draft-form"
import {
  RelationshipPanelShell,
  type PersonDraft,
} from "@/components/client-background/relationship-panel-shared"
import { EventEditor } from "@/components/client-background/history-section"
import {
  NewEventForm,
  NewIssueForm,
  blankEpisodeForIssue,
  blankIssueDraft,
  eventTypeForSmartKind,
  treatmentTypeChoiceForEventType,
} from "@/components/client-background/smart-history-forms"
import {
  InterviewSectionCard,
  needsBadge,
} from "@/components/client-background/interview-section-card"
import {
  TreeBranch,
  TreeInlineSelect,
  treeItemStateClassName,
  treeLayer1ClassName,
  treeLayer2MetaClassName,
  treeLayer2ShellClassName,
  treeLayer2TitleClassName,
  treeLayer3MetaClassName,
  treeLayer3ShellClassName,
  treeLayer3TitleClassName,
  treeLayer4MetaClassName,
  treeLayer4ShellClassName,
  treeLayer4TitleClassName,
  treeSelectedTitleClassName,
} from "@/components/client-background/tree-levels"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { clientAgeAtStart, formatPartialWhen } from "@/lib/client-background/age"
import { formatContextStrip, resolveFormContext } from "@/lib/client-background/form-context"
import { resolveHistoryIssues } from "@/lib/client-background/history-issues"
import {
  buildHistoryTree,
  historyCategoryAddLabel,
  historyVisualLayer,
  type HistoryTreeNode,
} from "@/lib/client-background/history-tree"
import { isConditionEvent, isSingleEventType } from "@/lib/client-background/history-links"
import { smartKindForEventType } from "@/lib/client-background/smart-event-fields"
import type { ScreeningAnswer, ScreeningAnswers } from "@/lib/client-background/interview-history"
import {
  HISTORY_QUESTIONS,
  type HistoryQuestionKey,
} from "@/lib/client-background/interview-history"
import type { ProfessionalOption } from "@/lib/client-background/professionals"
import {
  CONDITION_CATEGORY_LABELS,
  CONDITION_EVENT_TYPES,
  emptyEvent,
  EVENT_TYPE_LABELS,
  TREATMENT_ANSWER_LABELS,
  TREATMENT_ANSWERS,
  type ConditionEventType,
  type EventRecord,
  type EventType,
  type HistoryIssue,
  type RelationshipRecord,
  type SmartEventKind,
  type StartPrecision,
  type TreatmentAnswer,
  type TreatmentTypeChoice,
} from "@/lib/client-background/types"
import { cn } from "@/lib/utils"

type Selection =
  | { kind: "entry"; id: string }
  | { kind: "issue"; id: string }
  | { kind: "new_issue"; about: "self" | "significant_other"; category: ConditionEventType }
  | {
      kind: "new_event"
      about: "self" | "significant_other"
      issueId?: string
      parentEventId?: string
      category?: EventType
    }
  | { kind: "step"; parentId: string }

type Presentation = "cards" | "interview"

export function HistoryTreeSection({
  clientId,
  clientName = "Client",
  dateOfBirth,
  events,
  relationships,
  screening,
  medicalContacts = [],
  professionals,
  issues: storedIssues,
  readOnly = false,
  presentation = "cards",
  sectionOpen,
  onToggleSection,
  sectionNeeds,
  onScreeningChange,
  onEventsChange,
  onIssuesChange,
  medicationClient,
  historyClient,
}: {
  clientId: string
  /** First name (or display name) for context strip "About: Tom (client)". */
  clientName?: string
  dateOfBirth: string | null
  events: EventRecord[]
  relationships: RelationshipRecord[]
  screening: ScreeningAnswers
  medicalContacts?: ProfessionalOption[]
  professionals: ProfessionalOption[]
  issues?: HistoryIssue[]
  readOnly?: boolean
  presentation?: Presentation
  sectionOpen?: Record<string, boolean>
  onToggleSection?: (title: string) => void
  sectionNeeds?: Record<string, number>
  onScreeningChange?: (key: HistoryQuestionKey, answer: ScreeningAnswer | "") => void
  onEventsChange?: (events: EventRecord[]) => void
  onIssuesChange?: (issues: HistoryIssue[]) => void
  medicationClient?: {
    everAdmitted?: { label: string }
    previousTherapy?: { label: string }
    everMedication?: { label: string }
    currentlyTaking?: { label: string }
  }
  historyClient?: Partial<Record<HistoryQuestionKey, { label: string; apply: ScreeningAnswer }>>
}) {
  const [localEvents, setLocalEvents] = useState<EventRecord[] | null>(null)
  const [localIssues, setLocalIssues] = useState<HistoryIssue[] | null>(null)
  const [localPeople, setLocalPeople] = useState<RelationshipRecord[] | null>(null)
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
    setLocalPeople(null)
  }, [incoming])
  const shown = localEvents ?? events
  const people = localPeople ?? relationships
  const issues = resolveHistoryIssues(shown, localIssues ?? storedIssues)
  const tree = buildHistoryTree({
    events: shown,
    relationships: people,
    dateOfBirth,
    screening,
    professionals,
    issues,
  })
  const [selection, setSelection] = useState<Selection | null>(null)
  const [mode, setMode] = useState<"view" | "edit">("view")
  const [draft, setDraft] = useState<EventRecord | null>(null)
  const [issueDraft, setIssueDraft] = useState<HistoryIssue | null>(null)
  const [smartKind, setSmartKind] = useState<SmartEventKind>("episode")
  const [treatmentType, setTreatmentType] = useState<TreatmentTypeChoice | "">("")
  const [isNew, setIsNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [ready, setReady] = useState(false)
  const [unplacedDraftOpen, setUnplacedDraftOpen] = useState(false)
  const [unplacedDraftSaving, setUnplacedDraftSaving] = useState(false)
  const [unplacedDraftError, setUnplacedDraftError] = useState<string | null>(null)
  useEffect(() => setReady(true), [])
  useEffect(() => {
    if (!selection && !unplacedDraftOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (unplacedDraftOpen) {
          setUnplacedDraftOpen(false)
          setUnplacedDraftError(null)
          return
        }
        close()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selection])

  function publishEvents(next: EventRecord[]) {
    setLocalEvents(next)
    onEventsChange?.(next)
  }

  function publishIssues(next: HistoryIssue[]) {
    setLocalIssues(next)
    onIssuesChange?.(next)
  }

  function close() {
    setSelection(null)
    setDraft(null)
    setIssueDraft(null)
    setMode("view")
    setIsNew(false)
    setError(null)
    setSmartKind("episode")
    setTreatmentType("")
  }

  function openEntry(id: string) {
    const entry = shown.find((event) => event.eventRecordId === id)
    const issue = issues.find((item) => item.issueId === id)
    if (entry) {
      setSelection({ kind: "entry", id })
      setDraft({ ...entry })
      setIssueDraft(null)
    } else if (issue) {
      setSelection({ kind: "issue", id })
      setIssueDraft({ ...issue })
      const episode = shown.find((event) => event.conditionGroupId === id && isConditionEvent(event.eventType))
      setDraft(episode ? { ...episode } : null)
    }
    setMode("view")
    setIsNew(false)
    setError(null)
  }

  function startNewIssue(about: "self" | "significant_other", category: ConditionEventType) {
    setSelection({ kind: "new_issue", about, category })
    setIssueDraft(blankIssueDraft(category, about))
    setDraft(blankEpisodeForIssue(category, about))
    setMode("edit")
    setIsNew(true)
    setError(null)
  }

  function startNewEvent(options: {
    about: "self" | "significant_other"
    issueId?: string
    parentEventId?: string
    category?: EventType
  }) {
    const issue = options.issueId ? issues.find((item) => item.issueId === options.issueId) : undefined
    const parent = options.parentEventId
      ? shown.find((event) => event.eventRecordId === options.parentEventId)
      : undefined
    const category =
      options.category ??
      issue?.category ??
      parent?.eventType ??
      ("emotional_problems" as EventType)
    const about = issue?.about ?? parent?.about ?? options.about
    setSelection({
      kind: "new_event",
      about,
      issueId: options.issueId,
      parentEventId: options.parentEventId,
      category,
    })
    setSmartKind("episode")
    setTreatmentType("")
    setDraft({
      ...emptyEvent(
        eventTypeForSmartKind("episode", { category }),
        0
      ),
      eventRecordId: "",
      about,
      relationshipRecordId: issue?.relationshipRecordId ?? parent?.relationshipRecordId ?? null,
      aboutOther: issue?.aboutOther ?? parent?.aboutOther ?? "",
      conditionGroupId: options.issueId ?? parent?.conditionGroupId ?? null,
      parentEventId: options.parentEventId ?? null,
    })
    setIssueDraft(null)
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
    if (selection?.kind === "new_issue" && issueDraft) {
      setPending(true)
      setError(null)
      const first =
        draft && (draft.startValue.trim() || draft.endValue.trim() || draft.resolvedOrOngoing === "ongoing")
          ? {
              startPrecision: draft.startPrecision,
              startValue: draft.startValue,
              endPrecision: draft.endPrecision,
              endValue: draft.endValue,
              endOngoing: draft.endOngoing,
              resolvedOrOngoing: draft.resolvedOrOngoing,
            }
          : null
      const result = await createHistoryIssueAction(clientId, issueDraft, first)
      setPending(false)
      if (result.error || !result.issue) {
        setError(result.error ?? "Could not save this issue.")
        return
      }
      publishIssues([...issues, result.issue])
      if (result.event) publishEvents([...shown, result.event])
      setIssueDraft(result.issue)
      setDraft(result.event ?? null)
      setSelection({ kind: "issue", id: result.issue.issueId })
      setIsNew(false)
      setMode("view")
      return
    }
    if (!draft) return
    setPending(true)
    setError(null)
    const result = isNew ? await createEventAction(clientId, draft) : await updateEventAction(clientId, draft)
    setPending(false)
    if (result.error || !result.event) {
      setError(result.error ?? "Could not save this entry.")
      return
    }
    publishEvents(
      isNew ? [...shown, result.event] : shown.map((event) => (event.eventRecordId === result.event!.eventRecordId ? result.event! : event))
    )
    if (isNew && isConditionEvent(result.event.eventType) === false) {
      // Adding a treatment sets the issue Treatment answer to Yes (server syncs).
      const issueId = result.event.conditionGroupId
      if (issueId) {
        publishIssues(
          issues.map((item) =>
            item.issueId === issueId ? { ...item, treatmentAnswer: "yes" as TreatmentAnswer } : item
          )
        )
      }
    }
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

  /** Browser-only — opens the shared person form; no write until Save. */
  function startUnplacedPersonDraft() {
    setUnplacedDraftOpen(true)
    setUnplacedDraftError(null)
  }

  async function saveUnplacedPersonDraft(fields: PersonDraft) {
    setUnplacedDraftSaving(true)
    setUnplacedDraftError(null)
    try {
      const result = await createUnplacedPersonAction(clientId, {
        givenName: fields.givenName,
        sex: fields.sex,
        dateOfBirth: fields.dateOfBirth,
        healthStatus: fields.healthStatus,
        deceased: fields.deceased,
        dateOfDeath: fields.dateOfDeath,
        supportive: fields.supportive,
        conflict: fields.conflict,
        qualityOfRelationship: fields.qualityOfRelationship,
        dependency: fields.dependency,
        livingSituation: fields.livingSituation,
        notKnown: fields.notKnown,
        blockRoleType: fields.blockRoleType,
      })
      if (!result || ("error" in result && result.error)) {
        setUnplacedDraftError(
          result && "error" in result && result.error ? String(result.error) : "Could not add a person."
        )
        return
      }
      if ("relationships" in result && result.relationships) {
        setLocalPeople(result.relationships)
        const createdId =
          "createdMemberId" in result && typeof result.createdMemberId === "string"
            ? result.createdMemberId
            : result.relationships.find(
                (person) => !people.some((existing) => existing.relationshipRecordId === person.relationshipRecordId)
              )?.relationshipRecordId
        if (createdId && issueDraft) {
          setIssueDraft({ ...issueDraft, relationshipRecordId: createdId, aboutOther: "" })
        }
      }
      setUnplacedDraftOpen(false)
    } finally {
      setUnplacedDraftSaving(false)
    }
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
    publishEvents(shown.filter((event) => event.eventRecordId !== draft.eventRecordId && event.parentEventId !== draft.eventRecordId))
    close()
  }

  const selectedIssue =
    selection?.kind === "issue"
      ? issues.find((item) => item.issueId === selection.id) ?? issueDraft
      : selection?.kind === "new_event" && selection.issueId
        ? issues.find((item) => item.issueId === selection.issueId)
        : selection?.kind === "new_issue"
          ? issueDraft
          : undefined
  const entry = selection?.kind === "entry" ? shown.find((event) => event.eventRecordId === selection.id) : undefined
  const showAddStep =
    !readOnly &&
    ((entry != null && (mode === "view" || mode === "edit") && !isNew) ||
      (selection?.kind === "new_event" && mode === "edit" && draft?.eventRecordId))
  const selectedId =
    selection?.kind === "entry" || selection?.kind === "issue"
      ? selection.id
      : selection?.kind === "new_event"
        ? selection.issueId ?? selection.parentEventId ?? null
        : selection?.kind === "step"
          ? selection.parentId
          : null

  async function setTreatmentAnswer(issueId: string, value: TreatmentAnswer | "") {
    const result = await updateHistoryIssueTreatmentAnswerAction(clientId, issueId, value)
    if (result.error || !result.issue) {
      setError(result.error ?? "Could not save the treatment answer.")
      return
    }
    publishIssues(issues.map((item) => (item.issueId === result.issue!.issueId ? result.issue! : item)))
  }

  const contextForPanel = (() => {
    if (!selection) return null
    const about =
      selection.kind === "new_issue" || selection.kind === "new_event"
        ? selection.about
        : draft?.about === "significant_other"
          ? "significant_other"
          : selectedIssue?.about === "significant_other"
            ? "significant_other"
            : "self"
    const personId =
      selectedIssue?.relationshipRecordId ??
      issueDraft?.relationshipRecordId ??
      draft?.relationshipRecordId ??
      null
    const person = personId ? people.find((item) => item.relationshipRecordId === personId) : null
    const category =
      selection.kind === "new_issue"
        ? selection.category
        : selection.kind === "new_event"
          ? selection.category ?? selectedIssue?.category ?? null
          : selectedIssue?.category ?? draft?.eventType ?? null
    const issue =
      selectedIssue ??
      (selection.kind === "new_event" && selection.issueId
        ? issues.find((item) => item.issueId === selection.issueId)
        : null)
    return resolveFormContext(
      {
        clientName,
        about,
        person,
        aboutOther: selectedIssue?.aboutOther ?? draft?.aboutOther ?? "",
        category,
        issue: selection.kind === "new_issue" ? null : issue,
      },
      people
    )
  })()

  const treeProps = {
    onOpen: openEntry,
    onAddEvent: readOnly
      ? undefined
      : (issueId: string, about: "self" | "significant_other") => {
          const found = issues.find((item) => item.issueId === issueId)
          startNewEvent({
            about,
            issueId,
            category: found?.category,
          })
        },
    onAddNestedEvent: readOnly
      ? undefined
      : (parentEventId: string, about: "self" | "significant_other") => {
          const parent = shown.find((event) => event.eventRecordId === parentEventId)
          startNewEvent({
            about,
            parentEventId,
            category: parent?.eventType,
          })
        },
    onAddCategory: readOnly
      ? undefined
      : (about: "self" | "significant_other", eventType: EventType) => {
          if ((CONDITION_EVENT_TYPES as readonly string[]).includes(eventType)) {
            startNewIssue(about, eventType as ConditionEventType)
            return
          }
          startNewEvent({ about, category: eventType })
        },
    onTreatmentAnswer: readOnly ? undefined : (issueId: string, value: TreatmentAnswer | "") => void setTreatmentAnswer(issueId, value),
    onScreeningChange: presentation === "interview" ? onScreeningChange : undefined,
    screening,
    historyClient: presentation === "interview" ? historyClient : undefined,
    selectedId,
    readOnly,
  }

  return (
    <div className="space-y-4">
      {presentation === "interview" ? (
        <>
          <InterviewSectionCard
            title={tree.client.title}
            open={Boolean(sectionOpen?.[tree.client.title])}
            onToggle={() => onToggleSection?.(tree.client.title)}
            badge={needsBadge(sectionNeeds?.[tree.client.title] ?? 0)}
          >
            {medicationClient ? (
              <div className="mb-4 space-y-1 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
                {medicationClient.everAdmitted ? (
                  <ClientAnswer label={`Ever admitted: ${medicationClient.everAdmitted.label}`} matches={false} />
                ) : null}
                {medicationClient.previousTherapy ? (
                  <ClientAnswer label={`Previous therapy: ${medicationClient.previousTherapy.label}`} matches={false} />
                ) : null}
                {medicationClient.everMedication ? (
                  <ClientAnswer label={`Ever taken medication: ${medicationClient.everMedication.label}`} matches={false} />
                ) : null}
                {medicationClient.currentlyTaking ? (
                  <ClientAnswer label={`Currently taking: ${medicationClient.currentlyTaking.label}`} matches={false} />
                ) : null}
              </div>
            ) : null}
            <SectionBody nodes={tree.client.children} about="self" {...treeProps} />
          </InterviewSectionCard>
          <InterviewSectionCard
            title={tree.family.title}
            open={Boolean(sectionOpen?.[tree.family.title])}
            onToggle={() => onToggleSection?.(tree.family.title)}
            badge={needsBadge(sectionNeeds?.[tree.family.title] ?? 0)}
          >
            <SectionBody nodes={tree.family.children} about="significant_other" {...treeProps} />
          </InterviewSectionCard>
        </>
      ) : (
        <>
          <TreeCard title={tree.client.title}>
            <SectionBody nodes={tree.client.children} about="self" {...treeProps} />
          </TreeCard>
          <TreeCard title={tree.family.title}>
            <SectionBody nodes={tree.family.children} about="significant_other" {...treeProps} />
          </TreeCard>
        </>
      )}
      {ready && selection && (draft || issueDraft)
        ? createPortal(
            <div className="fixed inset-0 z-50">
              <button type="button" className="absolute inset-0 bg-black/20" aria-label="Dismiss" onClick={close} />
              <aside
                role="dialog"
                aria-modal="true"
                aria-label={
                  selection.kind === "new_issue"
                    ? "New issue"
                    : selection.kind === "new_event"
                      ? "New event"
                      : draft?.title.trim() || issueDraft?.title.trim() || "History"
                }
                className="absolute inset-y-0 right-0 flex w-full animate-[relationship-panel_200ms_ease-out] flex-col overflow-y-auto bg-background p-4 shadow-xl sm:w-[440px]"
              >
                <style>{`@keyframes relationship-panel { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold">
                    {selection.kind === "new_issue"
                      ? "New issue"
                      : selection.kind === "new_event"
                        ? "New event"
                        : selection.kind === "step" || draft?.parentEventId
                          ? "Step"
                          : draft?.title.trim() ||
                            issueDraft?.title.trim() ||
                            (draft ? EVENT_TYPE_LABELS[draft.eventType] : "History")}
                  </h2>
                  <Button type="button" variant="ghost" size="sm" onClick={close}>
                    Close
                  </Button>
                </div>
                {contextForPanel ? (
                  <ContextStrip
                    lines={contextForPanel.lines}
                    readOnly={mode === "view" || readOnly}
                    editors={
                      mode === "edit"
                        ? {
                            about: (
                              <SelectField
                                id="context_about"
                                label="About"
                                value={draft?.about === "significant_other" || issueDraft?.about === "significant_other" ? "significant_other" : "self"}
                                onChange={(about) => {
                                  const next = about === "significant_other" ? "significant_other" : "self"
                                  if (issueDraft) setIssueDraft({ ...issueDraft, about: next })
                                  if (draft) setDraft({ ...draft, about: next })
                                }}
                              >
                                <option value="self">Self</option>
                                <option value="significant_other">Family and significant others</option>
                              </SelectField>
                            ),
                            category:
                              selection.kind === "new_issue" && issueDraft ? (
                                <SelectField
                                  id="context_category"
                                  label="Category"
                                  value={issueDraft.category}
                                  onChange={(category) => {
                                    if ((CONDITION_EVENT_TYPES as readonly string[]).includes(category)) {
                                      setIssueDraft({ ...issueDraft, category: category as ConditionEventType })
                                      if (draft) setDraft({ ...draft, eventType: category as ConditionEventType })
                                    }
                                  }}
                                >
                                  {CONDITION_EVENT_TYPES.map((option) => (
                                    <option key={option} value={option}>
                                      {CONDITION_CATEGORY_LABELS[option]}
                                    </option>
                                  ))}
                                </SelectField>
                              ) : undefined,
                          }
                        : undefined
                    }
                  />
                ) : null}
                {mode === "edit" ? (
                  <>
                    {selection.kind === "new_issue" && issueDraft && draft ? (
                      <NewIssueForm
                        draft={issueDraft}
                        firstEpisode={draft}
                        dateOfBirth={dateOfBirth}
                        relationships={people}
                        onIssueChange={setIssueDraft}
                        onEpisodeChange={setDraft}
                        onAddPerson={startUnplacedPersonDraft}
                      />
                    ) : selection.kind === "new_event" && draft ? (
                      <NewEventForm
                        draft={draft}
                        kind={smartKind}
                        treatmentType={treatmentType}
                        category={selection.category ?? null}
                        dateOfBirth={dateOfBirth}
                        clientId={clientId}
                        medicalContacts={medicalContacts}
                        professionals={professionals}
                        onKindChange={setSmartKind}
                        onTreatmentTypeChange={setTreatmentType}
                        onChange={setDraft}
                      />
                    ) : selection.kind === "step" && draft ? (
                      <StepEditor draft={draft} dateOfBirth={dateOfBirth} onChange={setDraft} />
                    ) : draft ? (
                      <EventEditor
                        draft={draft}
                        dateOfBirth={dateOfBirth}
                        relationships={people}
                        events={shown}
                        clientId={clientId}
                        medicalContacts={medicalContacts}
                        professionals={professionals}
                        onChange={setDraft}
                        lockContext
                      />
                    ) : null}
                    <div className="mt-4 space-y-3">
                      {selection.kind === "new_event" && draft ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              void save().then(() => {
                                /* after save, selection becomes entry — add step from there */
                              })
                            }}
                          >
                            Add step
                          </Button>
                          <Button type="button" size="sm" disabled={pending} onClick={() => void save()}>
                            Done
                          </Button>
                        </div>
                      ) : null}
                      {showAddStep && entry && selection.kind !== "new_event" ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => startStep(entry)}>
                          Add step
                        </Button>
                      ) : null}
                      {selection.kind === "new_event" ? null : (
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
                      )}
                      {selection.kind === "new_event" && error ? (
                        <p className="text-sm text-destructive">{error}</p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    {draft ? <EntryDetails entry={draft} dateOfBirth={dateOfBirth} /> : null}
                    {selectedIssue ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Treatment: {treatmentAnswerText(selectedIssue.treatmentAnswer)}
                      </p>
                    ) : null}
                    <div className="mt-6 flex flex-wrap gap-2">
                      {showAddStep && entry ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => startStep(entry)}>
                          Add step
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
      {ready && unplacedDraftOpen
        ? createPortal(
            <RelationshipPanelShell
              ariaLabel="New person"
              onDismiss={() => {
                setUnplacedDraftOpen(false)
                setUnplacedDraftError(null)
              }}
            >
              <NewPersonDraftForm
                block={null}
                people={people}
                role="unplaced"
                error={unplacedDraftError}
                saving={unplacedDraftSaving}
                title="New person"
                contextLine="Adding an unplaced person for History Who"
                onSave={(fields) => void saveUnplacedPersonDraft(fields)}
                onCancel={() => {
                  setUnplacedDraftOpen(false)
                  setUnplacedDraftError(null)
                }}
              />
            </RelationshipPanelShell>,
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

function TreeCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

type SectionBodyProps = {
  nodes: HistoryTreeNode[]
  about: "self" | "significant_other"
  onOpen: (id: string) => void
  onAddEvent?: (issueId: string, about: "self" | "significant_other") => void
  onAddNestedEvent?: (parentEventId: string, about: "self" | "significant_other") => void
  onAddCategory?: (about: "self" | "significant_other", eventType: EventType) => void
  onTreatmentAnswer?: (issueId: string, value: TreatmentAnswer | "") => void
  onScreeningChange?: (key: HistoryQuestionKey, answer: ScreeningAnswer | "") => void
  screening: ScreeningAnswers
  historyClient?: Partial<Record<HistoryQuestionKey, { label: string; apply: ScreeningAnswer }>>
  selectedId: string | null
  readOnly?: boolean
}

function SectionBody({ nodes, about, ...rest }: SectionBodyProps) {
  return (
    <div className="space-y-6">
      {nodes.map((node) =>
        node.kind === "section" ? (
          <CategoryBlock key={node.title} node={node} about={about} {...rest} />
        ) : null
      )}
    </div>
  )
}

function CategoryBlock({
  node,
  about,
  onOpen,
  onAddEvent,
  onAddNestedEvent,
  onAddCategory,
  onTreatmentAnswer,
  onScreeningChange,
  screening,
  historyClient,
  selectedId,
  readOnly,
}: {
  node: Extract<HistoryTreeNode, { kind: "section" }>
  about: "self" | "significant_other"
} & Omit<SectionBodyProps, "nodes" | "about">) {
  const key = node.screeningKey as HistoryQuestionKey | undefined
  const question = key ? HISTORY_QUESTIONS[key] : undefined
  const locked =
    Boolean(key) &&
    node.children.some((child) => child.kind === "band" || child.kind === "row")
  const shown: ScreeningAnswer | "" = locked
    ? "yes"
    : key
      ? screening[key] ?? ""
      : ""
  const suggestion = key ? historyClient?.[key] : undefined
  const treeChildren =
    onScreeningChange && shown !== "yes" && shown !== ""
      ? node.children.filter((child) => child.kind === "note")
      : onScreeningChange && shown === "yes"
        ? node.children.filter((child) => child.kind !== "note")
        : node.children
  const eventType = question?.eventType
  const addLabel = historyCategoryAddLabel(node.title)

  return (
    <div id={key ? `check-history-${key}` : undefined} className="scroll-mt-28 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={treeLayer1ClassName}>{node.title}</h3>
        {onScreeningChange && key ? (
          <TreeInlineSelect
            id={`history_${key}`}
            aria-label={node.title}
            value={shown}
            disabled={locked}
            onChange={(next) => {
              if (locked) return
              void onScreeningChange(key, next === "yes" || next === "no" || next === "not_asked" ? next : "")
            }}
          >
            <option value="">Select…</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="not_asked">Not asked</option>
          </TreeInlineSelect>
        ) : null}
      </div>
      {suggestion && onScreeningChange ? (
        <ClientAnswer
          label={suggestion.label}
          matches={shown === suggestion.apply}
          onUse={locked ? undefined : () => void onScreeningChange(key!, suggestion.apply)}
        />
      ) : null}
      {treeChildren.length > 0 ? (
        <ConnectedList
          nodes={treeChildren}
          about={about}
          itemLayer={2}
          onOpen={onOpen}
          onAddEvent={onAddEvent}
          onAddNestedEvent={onAddNestedEvent}
          onTreatmentAnswer={onTreatmentAnswer}
          selectedId={selectedId}
          readOnly={readOnly}
        />
      ) : null}
      {!readOnly && onAddCategory && eventType && (shown === "yes" || !onScreeningChange) ? (
        <button
          type="button"
          className="px-1 text-sm text-primary underline-offset-2 hover:underline"
          onClick={() => onAddCategory(about, eventType)}
        >
          {addLabel}
        </button>
      ) : null}
      {!readOnly && onAddCategory && question?.mode === "other_treatment" && shown === "yes" ? (
        <button
          type="button"
          className="px-1 text-sm text-primary underline-offset-2 hover:underline"
          onClick={() => onAddCategory(about, "psychiatric_admission")}
        >
          {addLabel}
        </button>
      ) : null}
    </div>
  )
}

function ConnectedList({
  nodes,
  about,
  itemLayer,
  onOpen,
  onAddEvent,
  onAddNestedEvent,
  onTreatmentAnswer,
  selectedId,
  readOnly,
}: {
  nodes: HistoryTreeNode[]
  about: "self" | "significant_other"
  /** Visual layer for bands/rows in this list (2 under a category, 3 under an item). */
  itemLayer: 2 | 3 | 4
  onOpen: (id: string) => void
  onAddEvent?: (issueId: string, about: "self" | "significant_other") => void
  onAddNestedEvent?: (parentEventId: string, about: "self" | "significant_other") => void
  onTreatmentAnswer?: (issueId: string, value: TreatmentAnswer | "") => void
  selectedId: string | null
  readOnly?: boolean
}) {
  return (
    <ul>
      {nodes.map((node, index) => {
        const isLast = index === nodes.length - 1
        if (node.kind === "note") {
          return (
            <TreeBranch key={nodeKey(node, index)} intoLayer={itemLayer === 4 ? 3 : itemLayer} isLast={isLast}>
              <p className="flex min-h-10 items-center px-1 text-sm text-muted-foreground italic">{node.text}</p>
            </TreeBranch>
          )
        }
        if (node.kind === "band") {
          const layer = historyVisualLayer("band", { parentLayer: 1 })
          const selected = selectedId === node.id
          return (
            <TreeBranch key={nodeKey(node, index)} intoLayer={layer} isLast={isLast}>
              <button
                type="button"
                aria-current={selected ? "true" : undefined}
                className={cn(treeLayer2ShellClassName, treeItemStateClassName({ selected, square: true }))}
                onClick={() => onOpen(node.id)}
              >
                <span className={cn(treeLayer2TitleClassName, treeSelectedTitleClassName(selected))}>{node.heading}</span>
                {node.meta ? (
                  <span className={cn(treeLayer2MetaClassName, selected && "text-[#1e3a8a]")}>{node.meta}</span>
                ) : null}
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
                  <TreeInlineSelect
                    id={`treatment_${node.id}`}
                    label="Treatment"
                    value={node.treatmentAnswer || ""}
                    disabled={Boolean(node.children.some((child) => child.kind === "row" && child.tag === "Treatment"))}
                    onChange={(next) => {
                      const value = next === "yes" || next === "none" || next === "not_asked" ? next : ""
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
                  </TreeInlineSelect>
                </div>
              ) : null}
              {node.children.length > 0 ? (
                <ConnectedList
                  nodes={node.children}
                  about={about}
                  itemLayer={3}
                  onOpen={onOpen}
                  onAddEvent={onAddEvent}
                  onAddNestedEvent={onAddNestedEvent}
                  onTreatmentAnswer={onTreatmentAnswer}
                  selectedId={selectedId}
                  readOnly={readOnly}
                />
              ) : null}
              {!readOnly && onAddEvent ? (
                <div className="flex flex-wrap gap-3 px-1 py-1 text-sm">
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => onAddEvent(node.id, about)}
                  >
                    + Add event
                  </button>
                </div>
              ) : null}
            </TreeBranch>
          )
        }
        if (node.kind === "row") {
          const isStep = node.tag === "Step"
          const layer = historyVisualLayer("row", { parentLayer: itemLayer === 2 ? 1 : 2, tag: node.tag })
          // When this list is already under an item (itemLayer 3+), rows stay at that layer
          // unless they are steps (always 4). Category-level rows use layer 2.
          const visualLayer: 2 | 3 | 4 = isStep ? 4 : itemLayer === 2 ? 2 : itemLayer === 3 ? 3 : 4
          const selected = selectedId === node.id
          const { title, meta } = splitLine(node.line)
          const rowChildren = node.children.filter((child) => child.kind !== "actions")
          const shell =
            visualLayer === 2
              ? treeLayer2ShellClassName
              : visualLayer === 4
                ? treeLayer4ShellClassName
                : treeLayer3ShellClassName
          const titleClass =
            visualLayer === 2
              ? treeLayer2TitleClassName
              : visualLayer === 4
                ? treeLayer4TitleClassName
                : treeLayer3TitleClassName
          const metaClass =
            visualLayer === 2
              ? treeLayer2MetaClassName
              : visualLayer === 4
                ? treeLayer4MetaClassName
                : treeLayer3MetaClassName
          void layer
          return (
            <TreeBranch
              key={nodeKey(node, index)}
              intoLayer={visualLayer}
              isLast={isLast}
              dashed={isStep}
            >
              <button
                type="button"
                aria-current={selected ? "true" : undefined}
                className={cn(
                  shell,
                  treeItemStateClassName({ selected, square: visualLayer === 2 })
                )}
                onClick={() => onOpen(node.id)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {node.tag ? <Tag label={node.tag} /> : null}
                  <span className={cn(titleClass, treeSelectedTitleClassName(selected), "min-w-0")}>{title}</span>
                </span>
                {meta ? (
                  <span className={cn(metaClass, selected && "text-[#1e3a8a]", "w-full")}>{meta}</span>
                ) : null}
              </button>
              {rowChildren.length > 0 ? (
                <ConnectedList
                  nodes={rowChildren}
                  about={about}
                  itemLayer={visualLayer === 2 ? 3 : 4}
                  onOpen={onOpen}
                  onAddEvent={onAddEvent}
                  onAddNestedEvent={onAddNestedEvent}
                  onTreatmentAnswer={onTreatmentAnswer}
                  selectedId={selectedId}
                  readOnly={readOnly}
                />
              ) : null}
              {!readOnly &&
              !isStep &&
              onAddNestedEvent &&
              node.tag !== "Episode" &&
              node.tag !== "Treatment" &&
              node.tag !== "Other" ? (
                <div className="flex flex-wrap gap-3 px-1 py-1 text-sm">
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => onAddNestedEvent(node.id, about)}
                  >
                    + Add event
                  </button>
                </div>
              ) : null}
            </TreeBranch>
          )
        }
        return null
      })}
    </ul>
  )
}

function splitLine(line: string): { title: string; meta: string } {
  const [title, ...rest] = line.split(" · ")
  return { title: title ?? line, meta: rest.join(" · ") }
}

function Tag({ label }: { label: "Episode" | "Treatment" | "Other" | "Step" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        label === "Episode" && "bg-indigo-100 text-indigo-800",
        label === "Treatment" && "bg-emerald-100 text-emerald-800",
        label === "Other" && "bg-zinc-200 text-zinc-700",
        label === "Step" && "bg-zinc-100 text-zinc-700"
      )}
    >
      {label}
    </span>
  )
}

function nodeKey(node: HistoryTreeNode, index: number): string {
  if (node.kind === "note") return `${node.text}-${index}`
  if (node.kind === "section") return node.title
  if (node.kind === "actions") return `actions-${node.issueId ?? index}`
  return node.id
}
