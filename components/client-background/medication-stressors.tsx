"use client"

import { useState } from "react"

import { saveStressorsAction } from "@/app/clients/[client_id]/background/actions"
import { ClientAnswer, ReadOnlyField, SaveRow, SelectField, TextAreaField, TextField } from "@/components/client-background/fields"
import { Button } from "@/components/ui/button"
import type { ClientBackgroundSuggestions } from "@/lib/background-questionnaire/to-client-background"
import {
  STRESSOR_ITEMS,
  triStateLabel,
  type MedicationRecord,
  type StressorsRecord,
  type TriStateAnswer,
} from "@/lib/client-background/types"
import { cn } from "@/lib/utils"

export function AnswerTag({ answer }: { answer: TriStateAnswer | null }) {
  if (answer == null) return <span className="text-xs text-muted-foreground">Not answered</span>
  const label = answer === "yes" ? "Yes" : answer === "no" ? "No" : "Not asked"
  const tone =
    answer === "yes"
      ? "bg-neutral-900 text-white"
      : answer === "no"
        ? "bg-neutral-200 text-neutral-700"
        : "border border-dashed border-neutral-400 text-neutral-600"
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium", tone)}>
      {label}
    </span>
  )
}

export function TriStateField({
  id,
  label,
  value,
  onChange,
  client,
  disabled,
}: {
  id: string
  label: string
  value: TriStateAnswer | null
  onChange: (value: TriStateAnswer | null) => void
  client?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <SelectField
      id={id}
      label={label}
      value={value ?? ""}
      disabled={disabled}
      client={client}
      onChange={(next) => onChange(next === "yes" || next === "no" || next === "not_asked" ? next : null)}
    >
      <option value="">Select…</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
      <option value="not_asked">Not asked</option>
    </SelectField>
  )
}

export function MedicationFields({
  idPrefix,
  value,
  onChange,
  onCommit,
  client,
}: {
  idPrefix: string
  value: MedicationRecord
  onChange: (value: MedicationRecord) => void
  onCommit?: () => void
  client?: ClientBackgroundSuggestions["medication"]
}) {
  function apply(next: MedicationRecord) {
    onChange(next)
    onCommit?.()
  }
  const current = client?.currentlyTaking
  const previous = client?.previouslyTaken
  return (
    <>
      <TriStateField
        id={`${idPrefix}_currently_taking`}
        label="Currently taking medication"
        value={value.currentlyTaking}
        client={
          current ? (
            <ClientAnswer
              label={current.label}
              matches={value.currentlyTaking === current.apply}
              onUse={() => apply({ ...value, currentlyTaking: current.apply })}
            />
          ) : undefined
        }
        onChange={(currentlyTaking) => onChange({ ...value, currentlyTaking })}
      />
      {value.currentlyTaking === "yes" ? (
        <TextField
          id={`${idPrefix}_supervised_by`}
          label="Supervised by"
          value={value.supervisedBy}
          placeholder="e.g. Dr Patel (GP)"
          onChange={(supervisedBy) => onChange({ ...value, supervisedBy })}
        />
      ) : null}
      {value.currentlyTaking === "no" ? (
        <TriStateField
          id={`${idPrefix}_previously_taken`}
          label="Taken medication in the past"
          value={value.previouslyTaken}
          client={
            previous ? (
              <ClientAnswer
                label={previous.label}
                matches={value.previouslyTaken === previous.apply}
                onUse={() => apply({ ...value, previouslyTaken: previous.apply })}
              />
            ) : undefined
          }
          onChange={(previouslyTaken) => onChange({ ...value, previouslyTaken })}
        />
      ) : null}
    </>
  )
}

export function StressorsFields({
  idPrefix,
  value,
  onChange,
  onCommit,
  client,
}: {
  idPrefix: string
  value: StressorsRecord
  onChange: (value: StressorsRecord) => void
  onCommit?: () => void
  client?: ClientBackgroundSuggestions["stressors"]
}) {
  function apply(next: StressorsRecord) {
    onChange(next)
    onCommit?.()
  }
  const mainReason = client?.mainReason
  return (
    <>
      {STRESSOR_ITEMS.map((item) => {
        const suggestion = client?.[item.key]
        return (
          <TriStateField
            key={item.key}
            id={`${idPrefix}_${item.key}`}
            label={item.label}
            value={value[item.key]}
            client={
              suggestion ? (
                <ClientAnswer
                  label={suggestion.label}
                  matches={value[item.key] === suggestion.apply}
                  onUse={() => apply({ ...value, [item.key]: suggestion.apply })}
                />
              ) : undefined
            }
            onChange={(next) => onChange({ ...value, [item.key]: next })}
          />
        )
      })}
      <TextAreaField
        id={`${idPrefix}_main_reason`}
        label="Main reason for attending"
        value={value.mainReason}
        client={
          mainReason ? (
            <ClientAnswer
              label={mainReason.label}
              matches={value.mainReason === mainReason.apply}
              onUse={() => apply({ ...value, mainReason: mainReason.apply })}
            />
          ) : undefined
        }
        onChange={(next) => onChange({ ...value, mainReason: next })}
      />
    </>
  )
}

export function StressorsEditor({
  clientId,
  stressors,
  onSaved,
  title = "Stressors",
  editLabel = "Edit",
  read,
}: {
  clientId: string
  stressors: StressorsRecord
  onSaved?: (value: StressorsRecord) => void
  title?: string
  editLabel?: string
  read?: (value: StressorsRecord) => React.ReactNode
}) {
  return (
    <EditableBlock
      title={title}
      editLabel={editLabel}
      saved={stressors}
      onSaved={onSaved}
      save={(value) => saveStressorsAction(clientId, value)}
      read={read ?? ((value) => <StressorsReadOnly value={value} />)}
      edit={(value, onChange) => <StressorsFields idPrefix="background_stressors" value={value} onChange={onChange} />}
    />
  )
}

export function BackgroundStressorsSection({
  clientId,
  stressors,
}: {
  clientId: string
  stressors: StressorsRecord
}) {
  return (
    <StressorsEditor
      clientId={clientId}
      stressors={stressors}
      title=""
      editLabel="Edit"
      read={(value) => (
        <div className="space-y-2">
          {STRESSOR_ITEMS.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-3">
              <span className="text-sm">{item.label}</span>
              <AnswerTag answer={value[item.key]} />
            </div>
          ))}
          <div className="space-y-1 pt-1">
            <p className="text-sm font-medium">Main reason for attending</p>
            <p className="text-sm whitespace-pre-wrap">{value.mainReason.trim() || "Not recorded"}</p>
          </div>
        </div>
      )}
    />
  )
}

export function MedicationReadOnly({ value }: { value: MedicationRecord }) {
  return (
    <div className="space-y-3">
      <ReadOnlyField label="Currently taking medication" value={triStateLabel(value.currentlyTaking)} />
      {value.currentlyTaking === "yes" && value.supervisedBy.trim() ? (
        <ReadOnlyField label="Supervised by" value={value.supervisedBy} />
      ) : null}
      {value.currentlyTaking === "no" ? (
        <ReadOnlyField label="Taken medication in the past" value={triStateLabel(value.previouslyTaken)} />
      ) : null}
    </div>
  )
}

function StressorsReadOnly({ value }: { value: StressorsRecord }) {
  return (
    <div className="space-y-3">
      {STRESSOR_ITEMS.map((item) => (
        <ReadOnlyField key={item.key} label={item.label} value={triStateLabel(value[item.key])} />
      ))}
      <ReadOnlyField label="Main reason for attending" value={value.mainReason} />
    </div>
  )
}

export function EditableBlock<T>({
  title,
  editLabel = "Edit",
  saved,
  onSaved,
  save,
  read,
  edit,
}: {
  title?: string
  editLabel?: string
  saved: T
  onSaved?: (value: T) => void
  save: (value: T) => Promise<{ error?: string } & Record<string, unknown>>
  read: (value: T) => React.ReactNode
  edit: (value: T, onChange: (value: T) => void) => React.ReactNode
}) {
  const [stored, setStored] = useState(saved)
  const [draft, setDraft] = useState(saved)
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSave() {
    setPending(true)
    setError(null)
    const result = await save(draft)
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    const next =
      "reason" in result && result.reason
        ? (result.reason as T)
        : "medication" in result && result.medication
          ? (result.medication as T)
          : "stressors" in result && result.stressors
            ? (result.stressors as T)
            : draft
    setStored(next)
    setDraft(next)
    setEditing(false)
    onSaved?.(next)
  }

  return (
    <section className="min-w-0 space-y-3">
      <div className={cn("flex items-center gap-3", title ? "justify-between" : "justify-end")}>
        {title ? <h3 className="text-sm font-semibold">{title}</h3> : null}
        {editing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              setDraft(stored)
              setError(null)
              setEditing(false)
            }}
          >
            Cancel
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            {editLabel}
          </Button>
        )}
      </div>
      {editing ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void onSave()
          }}
        >
          {edit(draft, setDraft)}
          <SaveRow pending={pending} error={error} onSave={() => void onSave()} />
        </form>
      ) : (
        read(stored)
      )}
    </section>
  )
}
