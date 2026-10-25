"use client"

import { useState } from "react"

import { saveMedicationAction, saveStressorsAction } from "@/app/clients/[client_id]/background/actions"
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

export function MedicationStressorsPanel({
  clientId,
  medication,
  stressors,
}: {
  clientId: string
  medication: MedicationRecord
  stressors: StressorsRecord
}) {
  return (
    <div className="grid gap-6 border-t pt-6 lg:grid-cols-2">
      <EditableBlock
        title="Medication"
        saved={medication}
        save={(value) => saveMedicationAction(clientId, value)}
        read={(value) => <MedicationReadOnly value={value} />}
        edit={(value, onChange) => <MedicationFields idPrefix="background_medication" value={value} onChange={onChange} />}
      />
      <EditableBlock
        title="Stressors"
        saved={stressors}
        save={(value) => saveStressorsAction(clientId, value)}
        read={(value) => <StressorsReadOnly value={value} />}
        edit={(value, onChange) => <StressorsFields idPrefix="background_stressors" value={value} onChange={onChange} />}
      />
    </div>
  )
}

function MedicationReadOnly({ value }: { value: MedicationRecord }) {
  return (
    <div className="space-y-3">
      <ReadOnlyField label="Currently taking" value={triStateLabel(value.currentlyTaking)} />
      {value.currentlyTaking === "yes" ? (
        <ReadOnlyField label="Supervised by" value={value.supervisedBy} />
      ) : null}
      {value.currentlyTaking === "no" ? (
        <ReadOnlyField label="Taken in the past" value={triStateLabel(value.previouslyTaken)} />
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

function EditableBlock<T>({
  title,
  saved,
  save,
  read,
  edit,
}: {
  title: string
  saved: T
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
      "medication" in result && result.medication
        ? (result.medication as T)
        : "stressors" in result && result.stressors
          ? (result.stressors as T)
          : draft
    setStored(next)
    setDraft(next)
    setEditing(false)
  }

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
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
            Edit
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
