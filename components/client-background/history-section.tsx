"use client"

import { useState } from "react"

import {
  createEventAction,
  deleteEventAction,
  updateEventAction,
} from "@/app/clients/[client_id]/background/actions"
import {
  PartialDatePicker,
  ReadOnlyField,
  SaveRow,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/client-background/fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  compareEventsChronologically,
  describeClientAge,
  displayedAge,
  formatPartialWhen,
  lifeStageAtStart,
} from "@/lib/client-background/age"
import { formatPartialDate, parsePartialDate, precisionForPartialDate } from "@/lib/client-background/partial-date"
import { personName } from "@/lib/client-background/tree"
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  FAMILY_RELATION_PICKS,
  FAMILY_SIDES,
  FAMILY_SIDE_LABELS,
  RESOLVED_OR_ONGOING,
  SELF_HARM_TYPES,
  SELF_HARM_TYPE_LABELS,
  SUBSTANCE_STATUSES,
  SUBSTANCE_STATUS_LABELS,
  type EventRecord,
  type EventType,
  type RelationshipRecord,
} from "@/lib/client-background/types"
import { cn } from "@/lib/utils"

type HistoryView = "chronological" | "by_type"

export function HistorySection({
  clientId,
  dateOfBirth,
  events,
  relationships,
}: {
  clientId: string
  dateOfBirth: string | null
  events: EventRecord[]
  relationships: RelationshipRecord[]
}) {
  const [entries, setEntries] = useState(events)
  const [view, setView] = useState<HistoryView>("chronological")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileScreen, setMobileScreen] = useState<"list" | "detail" | "edit">("list")
  const [draft, setDraft] = useState<EventRecord | null>(null)
  const [editing, setEditing] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function select(entry: EventRecord, startEditing = false) {
    setSelectedId(entry.eventRecordId)
    setDraft({ ...entry })
    setEditing(startEditing)
    setMobileScreen(startEditing ? "edit" : "detail")
    setError(null)
  }

  async function add(eventType: EventType) {
    setPickerOpen(false)
    setPending(true)
    setError(null)
    const result = await createEventAction(clientId, eventType)
    setPending(false)
    if (result.error || !result.event) {
      setError(result.error ?? "Could not add this entry.")
      return
    }
    setEntries((current) => [...current, result.event!])
    select(result.event, true)
  }

  async function save() {
    if (!draft) return
    setPending(true)
    setError(null)
    const result = await updateEventAction(clientId, draft)
    setPending(false)
    if (result.error || !result.event) {
      setError(result.error ?? "Could not save this entry.")
      return
    }
    setEntries((current) =>
      current.map((entry) => (entry.eventRecordId === result.event!.eventRecordId ? result.event! : entry))
    )
    setDraft(result.event)
    setEditing(false)
    setMobileScreen("detail")
  }

  function cancel() {
    const saved = entries.find((entry) => entry.eventRecordId === draft?.eventRecordId)
    if (saved) setDraft({ ...saved })
    setEditing(false)
    setMobileScreen((current) => (current === "edit" ? "detail" : current))
    setError(null)
  }

  async function remove() {
    if (!draft) return
    if (!window.confirm("Remove this history entry?")) return
    setPending(true)
    setError(null)
    const result = await deleteEventAction(clientId, draft.eventRecordId)
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setEntries((current) => current.filter((entry) => entry.eventRecordId !== draft.eventRecordId))
    setSelectedId(null)
    setDraft(null)
    setEditing(false)
    setMobileScreen("list")
  }

  function leaveRecord() {
    if (editing) {
      cancel()
      return
    }
    setMobileScreen("list")
  }

  const chronological = [...entries].sort((a, b) => compareEventsChronologically(a, b, dateOfBirth))

  function renderPanel() {
    return (
      <HistoryPanel
        draft={draft}
        editing={editing}
        pending={pending}
        error={error}
        dateOfBirth={dateOfBirth}
        relationships={relationships}
        onEdit={() => {
          setEditing(true)
          setMobileScreen("edit")
        }}
        onCancel={cancel}
        onBack={leaveRecord}
        backLabel={editing ? "← Back" : "← Back to list"}
        onChange={setDraft}
        onSave={() => void save()}
        onRemove={() => void remove()}
      />
    )
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className={mobileScreen === "list" ? "block" : "hidden lg:block"}>
        <HistoryViewSwitch view={view} onChange={setView} />
      </div>
      <div className="lg:grid lg:grid-cols-2 lg:gap-4">
        <div className={mobileScreen === "list" ? "min-w-0 space-y-5 lg:max-h-[75vh] lg:overflow-y-auto lg:pr-1" : "hidden min-w-0 space-y-5 lg:block lg:max-h-[75vh] lg:overflow-y-auto lg:pr-1"}>
          {error && !draft ? <p className="text-sm text-destructive">{error}</p> : null}
          {view === "chronological" ? (
            <section className="space-y-2">
              <Button type="button" size="sm" disabled={pending} onClick={() => setPickerOpen(true)}>
                + Add entry
              </Button>
              {chronological.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing recorded</p>
              ) : (
                <ul className="space-y-1">
                  {chronological.map((entry) => (
                    <HistoryRow
                      key={entry.eventRecordId}
                      entry={entry}
                      active={entry.eventRecordId === selectedId}
                      dateOfBirth={dateOfBirth}
                      relationships={relationships}
                      onSelect={() => select(entry)}
                    />
                  ))}
                </ul>
              )}
            </section>
          ) : (
            EVENT_TYPES.map((eventType) => {
              const rows = entries.filter((entry) => entry.eventType === eventType)
              return (
                <section key={eventType} className="space-y-2">
                  <h2 className="text-sm font-semibold">{EVENT_TYPE_LABELS[eventType]}</h2>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing recorded</p>
                  ) : (
                    <ul className="space-y-1">
                      {rows.map((entry) => (
                        <HistoryRow
                          key={entry.eventRecordId}
                          entry={entry}
                          active={entry.eventRecordId === selectedId}
                          dateOfBirth={dateOfBirth}
                          relationships={relationships}
                          onSelect={() => select(entry)}
                        />
                      ))}
                    </ul>
                  )}
                  <Button type="button" size="sm" disabled={pending} onClick={() => void add(eventType)}>
                    + Add entry
                  </Button>
                </section>
              )
            })
          )}
        </div>
        <div className={mobileScreen === "list" ? "hidden min-w-0 lg:block" : "min-w-0"}>{renderPanel()}</div>
      </div>
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add entry</DialogTitle>
            <DialogDescription>Choose the event type for this entry.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {EVENT_TYPES.map((eventType) => (
              <Button key={eventType} type="button" variant="outline" disabled={pending} onClick={() => void add(eventType)}>
                {EVENT_TYPE_LABELS[eventType]}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function HistoryViewSwitch({ view, onChange }: { view: HistoryView; onChange: (view: HistoryView) => void }) {
  const options: { id: HistoryView; label: string }[] = [
    { id: "chronological", label: "Chronological" },
    { id: "by_type", label: "Event type" },
  ]
  return (
    <div className="inline-flex rounded-lg bg-muted p-1" role="group" aria-label="History view">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={view === option.id}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            view === option.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          )}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function HistoryRow({
  entry,
  active,
  dateOfBirth,
  relationships,
  onSelect,
}: {
  entry: EventRecord
  active: boolean
  dateOfBirth: string | null
  relationships: RelationshipRecord[]
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        className={cn("w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", active && "bg-muted font-medium")}
        onClick={onSelect}
      >
        <span className="block truncate">{entryListLabel(entry)}</span>
        <span className="block text-xs text-muted-foreground">
          {rowWhen(entry, dateOfBirth)} · {attributionLabel(entry, relationships)}
        </span>
      </button>
    </li>
  )
}

function HistoryPanel({
  draft,
  editing,
  pending,
  error,
  dateOfBirth,
  relationships,
  onEdit,
  onCancel,
  onBack,
  backLabel,
  onChange,
  onSave,
  onRemove,
}: {
  draft: EventRecord | null
  editing: boolean
  pending: boolean
  error: string | null
  dateOfBirth: string | null
  relationships: RelationshipRecord[]
  onEdit: () => void
  onCancel: () => void
  onBack: () => void
  backLabel: string
  onChange: (event: EventRecord) => void
  onSave: () => void
  onRemove: () => void
}) {
  if (!draft) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Select an entry from the list, or add a new one
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-4">
      <Button type="button" variant="ghost" size="sm" className="lg:hidden" onClick={onBack}>
        {backLabel}
      </Button>
      <div className="min-w-0 space-y-4 rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{entryListLabel(draft)}</p>
        {editing ? null : (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        )}
      </div>
      {editing ? (
        <>
          <EventEditor draft={draft} dateOfBirth={dateOfBirth} relationships={relationships} onChange={onChange} />
          <SaveRow
            pending={pending}
            error={error}
            onSave={onSave}
            extra={
              <>
                <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onCancel}>
                  Cancel
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onRemove}>
                  Remove
                </Button>
              </>
            }
          />
        </>
      ) : (
        <EventReadOnly draft={draft} dateOfBirth={dateOfBirth} relationships={relationships} />
      )}
      </div>
    </div>
  )
}

function entryListLabel(entry: Pick<EventRecord, "title" | "eventType">) {
  return entry.title.trim() || EVENT_TYPE_LABELS[entry.eventType]
}

function ageText(dateOfBirth: string | null, precision: EventRecord["startPrecision"], value: string) {
  return displayedAge(describeClientAge(dateOfBirth, precision, value))
}

function storedPartial(value: string) {
  const parsed = parsePartialDate(value)
  return { precision: precisionForPartialDate(parsed), value: formatPartialDate(parsed) }
}

function rowWhen(entry: EventRecord, dateOfBirth: string | null) {
  const formatted = formatPartialWhen(entry.startPrecision, entry.startValue)
  const described = describeClientAge(dateOfBirth, entry.startPrecision, entry.startValue)
  const ageLabel = displayedAge(described)
  if (!formatted && described.kind === "none") return "Date not recorded"
  if (entry.startPrecision === "age") return formatted || "Date not recorded"
  if (described.kind === "before_birth") {
    return formatted ? `Before client was born · ${formatted}` : "Before client was born"
  }
  if (described.kind === "exact" && formatted) return `Age ${described.years} · ${formatted}`
  if (described.kind === "approximate" && formatted) return `Age ~${described.years} · ${formatted}`
  if (ageLabel && formatted) return `${ageLabel} · ${formatted}`
  if (ageLabel) return ageLabel
  return formatted
}

function attributionLabel(entry: EventRecord, relationships: RelationshipRecord[]) {
  if (entry.attribution === "family") {
    const relation = entry.familyRelation.trim()
    const side = entry.familySide ? FAMILY_SIDE_LABELS[entry.familySide] : ""
    const who = [relation, side].filter(Boolean).join(", ")
    return who ? `Family · ${who}` : "Family member"
  }
  if (entry.attribution === "self_linked") {
    const person = relationships.find((item) => item.relationshipRecordId === entry.relationshipRecordId)
    return person ? personName(person) : "Linked person"
  }
  return "Self"
}

function yesNoLabel(value: boolean | null) {
  if (value == null) return ""
  return value ? "Yes" : "No"
}

function EventReadOnly({
  draft,
  dateOfBirth,
  relationships,
}: {
  draft: EventRecord
  dateOfBirth: string | null
  relationships: RelationshipRecord[]
}) {
  const stage = lifeStageAtStart(dateOfBirth, draft.startPrecision, draft.startValue)
  const linked = relationships.find((person) => person.relationshipRecordId === draft.relationshipRecordId)

  return (
    <div className="space-y-3">
      {draft.eventType === "family_events" ? (
        <ReadOnlyField label="Linked person" value={linked ? personName(linked) : ""} />
      ) : (
        <ReadOnlyField label="Attribution" value={attributionLabel(draft, relationships)} />
      )}
      <ReadOnlyField label="Event type" value={EVENT_TYPE_LABELS[draft.eventType]} />
      {draft.eventType === "self_harm" ? (
        <ReadOnlyField
          label="Type of self-harm behaviour"
          value={draft.selfHarmType ? SELF_HARM_TYPE_LABELS[draft.selfHarmType] : ""}
        />
      ) : null}
      <ReadOnlyField label="Title" value={draft.title} />
      <ReadOnlyField label="Description" value={draft.description} />
      <ReadOnlyField label="Start" value={formatPartialWhen(draft.startPrecision, draft.startValue)} />
      <ReadOnlyField label="Client's age at start" value={ageText(dateOfBirth, draft.startPrecision, draft.startValue)} />
      <ReadOnlyField
        label="End"
        value={draft.resolvedOrOngoing === "ongoing" ? "Left blank — ongoing" : formatPartialWhen(draft.endPrecision, draft.endValue)}
      />
      {draft.resolvedOrOngoing === "ongoing" ? null : (
        <ReadOnlyField label="Client's age at end" value={ageText(dateOfBirth, draft.endPrecision, draft.endValue)} />
      )}
      {stage ? <ReadOnlyField label="Category" value={stage === "childhood" ? "Childhood" : "Adulthood"} /> : null}
      <ReadOnlyField label="Treated" value={yesNoLabel(draft.treated)} />
      {draft.treated === true ? (
        <>
          <ReadOnlyField label="Treatment type" value={draft.treatmentType} />
          <ReadOnlyField label="Treatment detail" value={draft.treatmentDetail} />
          <ReadOnlyField label="Outcome" value={draft.outcome} />
        </>
      ) : null}
      <ReadOnlyField
        label="Resolved / Ongoing"
        value={draft.resolvedOrOngoing === "ongoing" ? "Ongoing" : draft.resolvedOrOngoing === "resolved" ? "Resolved" : ""}
      />
      {draft.eventType === "substance_use" ? (
        <>
          <ReadOnlyField label="Status" value={draft.substanceStatus ? SUBSTANCE_STATUS_LABELS[draft.substanceStatus] : ""} />
          {draft.substanceStatus === "abstinent" ? (
            <ReadOnlyField
              label="Abstinent since"
              value={formatPartialWhen(draft.abstinentSincePrecision, draft.abstinentSinceValue)}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function EventEditor({
  draft,
  dateOfBirth,
  relationships,
  onChange,
}: {
  draft: EventRecord
  dateOfBirth: string | null
  relationships: RelationshipRecord[]
  onChange: (event: EventRecord) => void
}) {
  const stage = lifeStageAtStart(dateOfBirth, draft.startPrecision, draft.startValue)
  const familyEvent = draft.eventType === "family_events"

  function patch(partial: Partial<EventRecord>) {
    const next = { ...draft, ...partial }
    if (partial.eventType === "family_events") {
      next.attribution = "self_linked"
      next.familyRelation = ""
      next.familySide = ""
    } else if (partial.eventType && next.attribution === "self_linked") {
      next.attribution = "self"
      next.relationshipRecordId = null
    }
    if (next.attribution !== "family") {
      next.familyRelation = ""
      next.familySide = ""
    }
    if (next.attribution !== "self_linked") next.relationshipRecordId = null
    if (next.eventType !== "self_harm") {
      next.selfHarmType = ""
    }
    if (next.eventType !== "substance_use") {
      next.substanceStatus = ""
      next.abstinentSincePrecision = ""
      next.abstinentSinceValue = ""
    }
    if (next.treated !== true) {
      next.treatmentType = ""
      next.treatmentDetail = ""
      next.outcome = ""
    }
    if (next.resolvedOrOngoing === "ongoing") {
      next.endPrecision = ""
      next.endValue = ""
      next.endOngoing = true
    } else {
      next.endOngoing = false
    }
    onChange(next)
  }

  return (
    <div className="min-w-0 space-y-4">
      {familyEvent ? (
        <SelectField
          id={`${draft.eventRecordId}_person`}
          label="Linked person"
          value={draft.relationshipRecordId ?? ""}
          onChange={(relationshipRecordId) =>
            patch({ relationshipRecordId: relationshipRecordId || null, attribution: "self_linked" })
          }
        >
          <option value="">Select someone from Relationships</option>
          {relationships.map((person) => (
            <option key={person.relationshipRecordId} value={person.relationshipRecordId}>
              {personName(person)}
            </option>
          ))}
        </SelectField>
      ) : (
        <>
          <SelectField
            id={`${draft.eventRecordId}_attribution`}
            label="Attribution"
            value={draft.attribution === "family" ? "family" : "self"}
            onChange={(attribution) => patch({ attribution: attribution === "family" ? "family" : "self" })}
          >
            <option value="self">Self</option>
            <option value="family">Family member</option>
          </SelectField>
          {draft.attribution === "family" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Relation</p>
              <div className="flex flex-wrap gap-1">
                {FAMILY_RELATION_PICKS.map((pick) => (
                  <Button
                    key={pick}
                    type="button"
                    size="sm"
                    variant={draft.familyRelation === pick ? "secondary" : "outline"}
                    onClick={() => patch({ familyRelation: pick === "Other" ? "" : pick, attribution: "family" })}
                  >
                    {pick}
                  </Button>
                ))}
              </div>
              <TextField
                id={`${draft.eventRecordId}_relation`}
                label="Relation"
                value={draft.familyRelation}
                onChange={(familyRelation) => patch({ familyRelation, attribution: "family" })}
              />
              <SelectField
                id={`${draft.eventRecordId}_side`}
                label="Side"
                value={draft.familySide}
                onChange={(familySide) => patch({ familySide: familySide as EventRecord["familySide"], attribution: "family" })}
              >
                <option value="">Not recorded</option>
                {FAMILY_SIDES.map((side) => (
                  <option key={side} value={side}>
                    {FAMILY_SIDE_LABELS[side]}
                  </option>
                ))}
              </SelectField>
            </div>
          ) : null}
        </>
      )}
      <SelectField
        id={`${draft.eventRecordId}_type`}
        label="Event type"
        value={draft.eventType}
        onChange={(eventType) => patch({ eventType: eventType as EventType })}
      >
        {EVENT_TYPES.map((eventType) => (
          <option key={eventType} value={eventType}>
            {EVENT_TYPE_LABELS[eventType]}
          </option>
        ))}
      </SelectField>
      {draft.eventType === "self_harm" ? (
        <SelectField
          id={`${draft.eventRecordId}_self_harm_type`}
          label="Type of self-harm behaviour"
          value={draft.selfHarmType}
          onChange={(selfHarmType) => patch({ selfHarmType: selfHarmType as EventRecord["selfHarmType"] })}
        >
          <option value="">Not recorded</option>
          {SELF_HARM_TYPES.map((option) => (
            <option key={option} value={option}>
              {SELF_HARM_TYPE_LABELS[option]}
            </option>
          ))}
        </SelectField>
      ) : null}
      <TextField
        id={`${draft.eventRecordId}_title`}
        label="Title"
        value={draft.title}
        onChange={(title) => patch({ title })}
        placeholder="Optional"
      />
      <TextAreaField
        id={`${draft.eventRecordId}_description`}
        label="Description"
        value={draft.description}
        onChange={(description) => patch({ description })}
      />
      <PartialDatePicker
        id={`${draft.eventRecordId}_start`}
        dateLabel="Start"
        ageLabel="Client's age at start"
        mode="client-at-event"
        clientDateOfBirth={dateOfBirth}
        value={draft.startPrecision === "age" ? "" : draft.startValue}
        legacyAge={draft.startPrecision === "age" ? draft.startValue : ""}
        onChange={(startValue) => {
          const next = storedPartial(startValue)
          patch({ startPrecision: next.precision, startValue: next.value })
        }}
      />
      {draft.resolvedOrOngoing === "ongoing" ? (
        <p className="text-xs text-muted-foreground">End date stays blank while this is ongoing.</p>
      ) : (
        <PartialDatePicker
          id={`${draft.eventRecordId}_end`}
          dateLabel="End"
          ageLabel="Client's age at end"
          mode="client-at-event"
          clientDateOfBirth={dateOfBirth}
          value={draft.endPrecision === "age" ? "" : draft.endValue}
          legacyAge={draft.endPrecision === "age" ? draft.endValue : ""}
          onChange={(endValue) => {
            const next = storedPartial(endValue)
            patch({ endPrecision: next.precision, endValue: next.value })
          }}
        />
      )}
      {stage ? (
        <p className="text-sm text-muted-foreground">
          Category: {stage === "childhood" ? "Childhood" : "Adulthood"}
        </p>
      ) : null}
      <SelectField
        id={`${draft.eventRecordId}_treated`}
        label="Treated"
        value={draft.treated === true ? "yes" : draft.treated === false ? "no" : ""}
        onChange={(next) => patch({ treated: next === "yes" ? true : next === "no" ? false : null })}
      >
        <option value="">Not recorded</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </SelectField>
      {draft.treated === true ? (
        <>
          <TextField
            id={`${draft.eventRecordId}_tx_type`}
            label="Treatment type"
            value={draft.treatmentType}
            onChange={(treatmentType) => patch({ treatmentType })}
          />
          <TextAreaField
            id={`${draft.eventRecordId}_tx_detail`}
            label="Treatment detail"
            value={draft.treatmentDetail}
            onChange={(treatmentDetail) => patch({ treatmentDetail })}
          />
          <TextAreaField
            id={`${draft.eventRecordId}_outcome`}
            label="Outcome"
            value={draft.outcome}
            onChange={(outcome) => patch({ outcome })}
          />
        </>
      ) : null}
      <SelectField
        id={`${draft.eventRecordId}_resolved`}
        label="Resolved / Ongoing"
        value={draft.resolvedOrOngoing}
        onChange={(resolvedOrOngoing) =>
          patch({ resolvedOrOngoing: resolvedOrOngoing as EventRecord["resolvedOrOngoing"] })
        }
      >
        <option value="">Not recorded</option>
        {RESOLVED_OR_ONGOING.map((option) => (
          <option key={option} value={option}>
            {option === "ongoing" ? "Ongoing" : "Resolved"}
          </option>
        ))}
      </SelectField>
      {draft.eventType === "substance_use" ? (
        <>
          <SelectField
            id={`${draft.eventRecordId}_substance_status`}
            label="Status"
            value={draft.substanceStatus}
            onChange={(substanceStatus) => patch({ substanceStatus: substanceStatus as EventRecord["substanceStatus"] })}
          >
            <option value="">Not recorded</option>
            {SUBSTANCE_STATUSES.map((option) => (
              <option key={option} value={option}>
                {SUBSTANCE_STATUS_LABELS[option]}
              </option>
            ))}
          </SelectField>
          {draft.substanceStatus === "abstinent" ? (
            <PartialDatePicker
              id={`${draft.eventRecordId}_abstinent`}
              dateLabel="Abstinent since"
              mode="date-only"
              value={draft.abstinentSincePrecision === "age" ? "" : draft.abstinentSinceValue}
              onChange={(abstinentSinceValue) => {
                const next = storedPartial(abstinentSinceValue)
                patch({ abstinentSincePrecision: next.precision, abstinentSinceValue: next.value })
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

