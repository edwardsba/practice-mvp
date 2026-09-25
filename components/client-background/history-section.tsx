"use client"

import { useState } from "react"

import {
  createEventAction,
  deleteEventAction,
  updateEventAction,
} from "@/app/clients/[client_id]/background/actions"
import {
  PartialDateField,
  SaveRow,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/client-background/fields"
import { Button } from "@/components/ui/button"
import { clientAgeAtStart, formatPartialWhen, lifeStageAtStart } from "@/lib/client-background/age"
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
  SEVERITY_IMPACT,
  SEVERITY_LABELS,
  SUBSTANCE_STATUSES,
  SUBSTANCE_STATUS_LABELS,
  type EventRecord,
  type EventType,
  type RelationshipRecord,
} from "@/lib/client-background/types"
import { cn } from "@/lib/utils"

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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EventRecord | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function select(entry: EventRecord) {
    setSelectedId(entry.eventRecordId)
    setDraft({ ...entry })
    setError(null)
  }

  async function add(eventType: EventType) {
    setPending(true)
    setError(null)
    const result = await createEventAction(clientId, eventType)
    setPending(false)
    if (result.error || !result.event) {
      setError(result.error ?? "Could not add this entry.")
      return
    }
    setEntries((current) => [...current, result.event!])
    select(result.event)
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
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
        {error && !draft ? <p className="text-sm text-destructive">{error}</p> : null}
        {EVENT_TYPES.map((eventType) => {
          const rows = entries.filter((entry) => entry.eventType === eventType)
          return (
            <section key={eventType} className="space-y-2">
              <h2 className="text-sm font-semibold">{EVENT_TYPE_LABELS[eventType]}</h2>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing recorded</p>
              ) : (
                <ul className="space-y-1">
                  {rows.map((entry) => {
                    const active = entry.eventRecordId === selectedId
                    return (
                      <li key={entry.eventRecordId}>
                        <button
                          type="button"
                          className={cn(
                            "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                            active && "bg-muted font-medium"
                          )}
                          onClick={() => select(entry)}
                        >
                          <span className="block truncate">{entry.description.trim() || "No description"}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatPartialWhen(entry.startPrecision, entry.startValue) || "Start not recorded"}
                            {entry.endOngoing ? " · Ongoing" : ""}
                          </span>
                        </button>
                        {active && draft ? (
                          <div className="mt-2 rounded-md border p-3 lg:hidden">
                            <EventEditor
                              draft={draft}
                              dateOfBirth={dateOfBirth}
                              relationships={relationships}
                              onChange={setDraft}
                            />
                            <SaveRow
                              pending={pending}
                              error={error}
                              onSave={() => void save()}
                              extra={
                                <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => void remove()}>
                                  Remove
                                </Button>
                              }
                            />
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void add(eventType)}>
                + Add entry
              </Button>
            </section>
          )
        })}
      </div>
      <div className="hidden lg:block">
        {draft ? (
          <div className="space-y-4 rounded-md border p-4">
            <EventEditor
              draft={draft}
              dateOfBirth={dateOfBirth}
              relationships={relationships}
              onChange={setDraft}
            />
            <SaveRow
              pending={pending}
              error={error}
              onSave={() => void save()}
              extra={
                <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => void remove()}>
                  Remove
                </Button>
              }
            />
          </div>
        ) : (
          <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Select an entry from the list, or add a new one
          </div>
        )}
      </div>
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
  const age = clientAgeAtStart(dateOfBirth, draft.startPrecision, draft.startValue)
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
      next.substanceInvolvement = null
      next.requiredMedicalAttention = null
      next.requiredHospitalisation = null
    }
    if (next.eventType === "substance_use") {
      if (next.startPrecision === "age") {
        next.startPrecision = ""
        next.startValue = ""
      }
      if (next.endPrecision === "age") {
        next.endPrecision = ""
        next.endValue = ""
      }
    } else {
      next.substanceStatus = ""
      next.abstinentSincePrecision = ""
      next.abstinentSinceValue = ""
    }
    if (next.treated !== true) {
      next.treatmentType = ""
      next.treatmentDetail = ""
      next.outcome = ""
    }
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <TextAreaField
        id={`${draft.eventRecordId}_description`}
        label="Description"
        value={draft.description}
        onChange={(description) => patch({ description })}
      />
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
      <PartialDateField
        id={`${draft.eventRecordId}_start`}
        label="Start"
        precision={draft.startPrecision}
        value={draft.startValue}
        allowAge={draft.eventType !== "substance_use"}
        onChange={(startPrecision, startValue) => patch({ startPrecision, startValue })}
      />
      <div className="space-y-2">
        <PartialDateField
          id={`${draft.eventRecordId}_end`}
          label="End"
          precision={draft.endOngoing ? "" : draft.endPrecision}
          value={draft.endOngoing ? "" : draft.endValue}
          allowAge={draft.eventType !== "substance_use"}
          onChange={(endPrecision, endValue) => patch({ endPrecision, endValue, endOngoing: false })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.endOngoing}
            onChange={(event) =>
              patch({
                endOngoing: event.target.checked,
                endPrecision: event.target.checked ? "" : draft.endPrecision,
                endValue: event.target.checked ? "" : draft.endValue,
              })
            }
          />
          Ongoing
        </label>
      </div>
      {age != null ? (
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Client&apos;s age at the time: {age}</p>
          {stage ? <p>Category: {stage === "childhood" ? "Childhood" : "Adulthood"}</p> : null}
        </div>
      ) : null}
      <SelectField
        id={`${draft.eventRecordId}_resolved`}
        label="Resolved / Ongoing"
        value={draft.resolvedOrOngoing}
        onChange={(resolvedOrOngoing) => patch({ resolvedOrOngoing: resolvedOrOngoing as EventRecord["resolvedOrOngoing"] })}
      >
        <option value="">Not recorded</option>
        {RESOLVED_OR_ONGOING.map((option) => (
          <option key={option} value={option}>
            {option === "ongoing" ? "Ongoing" : "Resolved"}
          </option>
        ))}
      </SelectField>
      <SelectField
        id={`${draft.eventRecordId}_severity`}
        label="Severity / Impact"
        value={draft.severityImpact}
        onChange={(severityImpact) => patch({ severityImpact: severityImpact as EventRecord["severityImpact"] })}
      >
        <option value="">Not recorded</option>
        {SEVERITY_IMPACT.map((option) => (
          <option key={option} value={option}>
            {SEVERITY_LABELS[option]}
          </option>
        ))}
      </SelectField>
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
          <TextField id={`${draft.eventRecordId}_tx_type`} label="Treatment type" value={draft.treatmentType} onChange={(treatmentType) => patch({ treatmentType })} />
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

      {familyEvent ? (
        <SelectField
          id={`${draft.eventRecordId}_person`}
          label="Linked person"
          value={draft.relationshipRecordId ?? ""}
          onChange={(relationshipRecordId) => patch({ relationshipRecordId: relationshipRecordId || null, attribution: "self_linked" })}
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

      {draft.eventType === "self_harm" ? (
        <>
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
          <YesNo id={`${draft.eventRecordId}_substance`} label="Substance involvement at the time" value={draft.substanceInvolvement} onChange={(substanceInvolvement) => patch({ substanceInvolvement })} />
          <YesNo id={`${draft.eventRecordId}_medical`} label="Required medical attention" value={draft.requiredMedicalAttention} onChange={(requiredMedicalAttention) => patch({ requiredMedicalAttention })} />
          <YesNo id={`${draft.eventRecordId}_hospital`} label="Required hospitalisation" value={draft.requiredHospitalisation} onChange={(requiredHospitalisation) => patch({ requiredHospitalisation })} />
        </>
      ) : null}

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
            <PartialDateField
              id={`${draft.eventRecordId}_abstinent`}
              label="Abstinent since"
              precision={draft.abstinentSincePrecision}
              value={draft.abstinentSinceValue}
              onChange={(abstinentSincePrecision, abstinentSinceValue) =>
                patch({ abstinentSincePrecision, abstinentSinceValue })
              }
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function YesNo({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: boolean | null
  onChange: (value: boolean | null) => void
}) {
  return (
    <SelectField
      id={id}
      label={label}
      value={value === true ? "yes" : value === false ? "no" : ""}
      onChange={(next) => onChange(next === "yes" ? true : next === "no" ? false : null)}
    >
      <option value="">Not recorded</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </SelectField>
  )
}
