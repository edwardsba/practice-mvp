"use client"

import { useState } from "react"

import { RadioOptionList } from "@/components/assessments/form/radio-option-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  formatHistoryListEntryLine,
  formatPersonListEntryLine,
  isHistoryEntryBlank,
  isPersonEntryBlank,
  listFieldLabel,
  parseHistoryListEntry,
  parsePersonListEntry,
  PERSON_LIST_FIELD_KEYS,
  serializeHistoryListEntry,
  serializePersonListEntry,
  setPersonPassedAway,
  type FormListConfig,
  type HistoryListEntry,
  type PersonListEntry,
  type PersonListFieldKey,
} from "@/lib/assessments/form-lists"
import { cn } from "@/lib/utils"

const LIVES_WITH_OPTIONS = [
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
]

type Mode = "person" | "history"

/**
 * Repeating person_list / history_list control. Collapsed rows; one open editor;
 * dashed "+ Add …" below. Blank entries are dropped when Done / Add commits.
 */
export function ListEntryInput({
  id,
  mode,
  values,
  onChange,
  config,
  disabled,
  error,
}: {
  id: string
  mode: Mode
  values: string[]
  onChange: (next: string[]) => void
  config: FormListConfig | null | undefined
  disabled?: boolean
  error?: boolean
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<PersonListEntry | HistoryListEntry>({})

  const addLabel = config?.addButtonLabel?.trim() || (mode === "person" ? "+ Add a person" : "+ Add another")
  const personFields: PersonListFieldKey[] =
    mode === "person"
      ? (config?.fields ?? [...PERSON_LIST_FIELD_KEYS]).filter((key) =>
          (PERSON_LIST_FIELD_KEYS as readonly string[]).includes(key)
        )
      : []

  function openEntry(index: number) {
    if (disabled) return
    if (index < 0 || index >= values.length) {
      setDraft({})
      setOpenIndex(index)
      return
    }
    const raw = values[index]
    if (mode === "person") {
      setDraft(parsePersonListEntry(raw, config) ?? {})
    } else {
      setDraft(parseHistoryListEntry(raw) ?? {})
    }
    setOpenIndex(index)
  }

  function commitOpen() {
    if (openIndex == null) return
    const next = [...values]
    if (mode === "person") {
      const entry = draft as PersonListEntry
      if (isPersonEntryBlank(entry)) {
        if (openIndex < next.length) next.splice(openIndex, 1)
      } else {
        const serialized = serializePersonListEntry(entry)
        if (openIndex < next.length) next[openIndex] = serialized
        else next.push(serialized)
      }
    } else {
      const entry = draft as HistoryListEntry
      if (isHistoryEntryBlank(entry)) {
        if (openIndex < next.length) next.splice(openIndex, 1)
      } else {
        const serialized = serializeHistoryListEntry(entry)
        if (openIndex < next.length) next[openIndex] = serialized
        else next.push(serialized)
      }
    }
    onChange(next)
    setOpenIndex(null)
    setDraft({})
  }

  function removeOpen() {
    if (openIndex == null) return
    if (openIndex < values.length) {
      onChange(values.filter((_, i) => i !== openIndex))
    }
    setOpenIndex(null)
    setDraft({})
  }

  function startAdd() {
    if (disabled) return
    if (openIndex != null) commitOpen()
    setDraft({})
    setOpenIndex(values.length)
  }

  function collapsedLine(raw: string, index: number) {
    if (mode === "person") {
      const entry = parsePersonListEntry(raw, config)
      if (!entry) return null
      const { name, details } = formatPersonListEntryLine(entry, config, "client")
      return (
        <div
          key={`${id}-row-${index}`}
          className={cn(
            "flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2",
            error && "border-destructive"
          )}
        >
          <p className="min-w-0 flex-1 text-sm">
            <span className="text-foreground">{name}</span>
            {details ? <span className="text-muted-foreground"> · {details}</span> : null}
          </p>
          {!disabled ? (
            <button
              type="button"
              className="shrink-0 text-sm text-primary underline-offset-4 hover:underline"
              onClick={() => openEntry(index)}
            >
              Edit
            </button>
          ) : null}
        </div>
      )
    }
    const entry = parseHistoryListEntry(raw)
    if (!entry) return null
    return (
      <div
        key={`${id}-row-${index}`}
        className={cn(
          "flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2",
          error && "border-destructive"
        )}
      >
        <p className="min-w-0 flex-1 text-sm text-foreground">{formatHistoryListEntryLine(entry)}</p>
        {!disabled ? (
          <button
            type="button"
            className="shrink-0 text-sm text-primary underline-offset-4 hover:underline"
            onClick={() => openEntry(index)}
          >
            Edit
          </button>
        ) : null}
      </div>
    )
  }

  function renderPersonFields() {
    const person = draft as PersonListEntry
    const passedAway = person.passedAway === true
    return (
      <div className="space-y-3">
        {personFields.map((field) => {
          if (field === "firstName") {
            return (
              <div key={field} className="space-y-1.5">
                <p className="text-sm font-medium">{listFieldLabel(config, "firstName")}</p>
                <Input
                  value={person.firstName ?? ""}
                  disabled={disabled}
                  className="min-h-11"
                  onChange={(event) =>
                    setDraft({ ...person, firstName: event.target.value })
                  }
                />
              </div>
            )
          }
          if (field === "passedAway") {
            const tickId = `${id}-passed-away`
            return (
              <label
                key={field}
                htmlFor={tickId}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2",
                  passedAway ? "border-primary bg-primary/5" : "border-input"
                )}
              >
                <input
                  id={tickId}
                  type="checkbox"
                  checked={passedAway}
                  disabled={disabled}
                  onChange={() => setDraft(setPersonPassedAway(person, !passedAway))}
                />
                <span className="text-sm font-medium">{listFieldLabel(config, "passedAway")}</span>
              </label>
            )
          }
          if (field === "age") {
            if (passedAway) return null
            return (
              <div key={field} className="space-y-1.5">
                <p className="text-sm font-medium">{listFieldLabel(config, "age")}</p>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={person.age ?? ""}
                  disabled={disabled}
                  className="min-h-11 max-w-xs"
                  onChange={(event) => {
                    const raw = event.target.value
                    if (raw === "") {
                      const next = { ...person }
                      delete next.age
                      setDraft(next)
                      return
                    }
                    const n = Number(raw)
                    if (!Number.isInteger(n)) return
                    setDraft({ ...person, age: n })
                  }}
                />
              </div>
            )
          }
          if (field === "relationship") {
            const options = (config?.relationshipChoices ?? []).map((c, i) => ({
              label: c.label,
              value: c.value,
              displayOrder: i + 1,
            }))
            return (
              <div key={field} className="space-y-1.5">
                <p className="text-sm font-medium">{listFieldLabel(config, "relationship")}</p>
                <RadioOptionList
                  options={options}
                  value={person.relationship}
                  disabled={disabled}
                  onValueChange={(value) => setDraft({ ...person, relationship: value })}
                />
              </div>
            )
          }
          if (field === "livesWith") {
            return (
              <div key={field} className="space-y-1.5">
                <p className="text-sm font-medium">{listFieldLabel(config, "livesWith")}</p>
                <RadioOptionList
                  options={LIVES_WITH_OPTIONS}
                  value={person.livesWith}
                  disabled={disabled}
                  onValueChange={(value) =>
                    setDraft({ ...person, livesWith: value === "yes" ? "yes" : "no" })
                  }
                />
              </div>
            )
          }
          if (field === "fromYear" || field === "toYear") {
            const current = field === "fromYear" ? person.fromYear : person.toYear
            return (
              <div key={field} className="space-y-1.5">
                <p className="text-sm font-medium">{listFieldLabel(config, field)}</p>
                <Input
                  type="number"
                  min={1000}
                  max={9999}
                  value={current ?? ""}
                  disabled={disabled}
                  className="min-h-11 max-w-xs"
                  onChange={(event) => {
                    const raw = event.target.value
                    if (raw === "") {
                      const next = { ...person }
                      delete next[field]
                      setDraft(next)
                      return
                    }
                    const n = Number(raw)
                    if (!Number.isInteger(n)) return
                    setDraft({ ...person, [field]: n })
                  }}
                />
              </div>
            )
          }
          if (field === "howEnded") {
            const options = (config?.howEndedChoices ?? []).map((c, i) => ({
              label: c.label,
              value: c.value,
              displayOrder: i + 1,
            }))
            return (
              <div key={field} className="space-y-1.5">
                <p className="text-sm font-medium">{listFieldLabel(config, "howEnded")}</p>
                <RadioOptionList
                  options={options}
                  value={person.howEnded}
                  disabled={disabled}
                  onValueChange={(value) => setDraft({ ...person, howEnded: value })}
                />
              </div>
            )
          }
          return null
        })}
      </div>
    )
  }

  function renderHistoryFields() {
    const history = draft as HistoryListEntry
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{listFieldLabel(config, "what")}</p>
          <Input
            value={history.what ?? ""}
            disabled={disabled}
            className="min-h-11"
            onChange={(event) => setDraft({ ...history, what: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{listFieldLabel(config, "when")}</p>
          <Input
            value={history.when ?? ""}
            disabled={disabled}
            className="min-h-11"
            placeholder="e.g. about age 25 or 2019"
            onChange={(event) => setDraft({ ...history, when: event.target.value })}
          />
        </div>
      </div>
    )
  }

  const personNumber = openIndex == null ? 0 : Math.min(openIndex, values.length) + 1

  return (
    <div className="space-y-2" id={id}>
      {values.map((raw, index) =>
        openIndex === index ? null : collapsedLine(raw, index)
      )}

      {openIndex != null ? (
        <div
          className={cn(
            "space-y-3 rounded-md border p-3",
            error && "border-destructive"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {mode === "person" ? `Person ${personNumber}` : `Entry ${personNumber}`}
            </p>
            {!disabled ? (
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-destructive"
                onClick={removeOpen}
              >
                Remove
              </button>
            ) : null}
          </div>
          {mode === "person" ? renderPersonFields() : renderHistoryFields()}
          {!disabled ? (
            <Button type="button" className="min-h-11 w-full" onClick={commitOpen}>
              Done
            </Button>
          ) : null}
        </div>
      ) : null}

      {!disabled && openIndex == null ? (
        <button
          type="button"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-dashed px-3 text-sm"
          onClick={startAdd}
        >
          {addLabel}
        </button>
      ) : null}
    </div>
  )
}
