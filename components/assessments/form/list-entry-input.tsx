"use client"

import { useEffect, useRef, useState } from "react"

import { RadioOptionList } from "@/components/assessments/form/radio-option-list"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  addAnotherListButtonLabel,
  currentCalendarYear,
  formatHistoryListEntryLine,
  formatPersonListEntryLine,
  isHistoryEntryBlank,
  isPersonEntryBlank,
  listEntrySheetTitle,
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
import { statusColours } from "@/lib/ui/status-colours"
import { cn } from "@/lib/utils"

const LIVES_WITH_OPTIONS = [
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
]

type Mode = "person" | "history"

/** How the open entry is shown. Default inline keeps practitioner forms unchanged (CP-7). */
export type ListEntryPresentation = "inline" | "sheet"

function useMinWidthMd(): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const sync = () => setMatches(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  return matches
}

/**
 * Repeating person_list / history_list control. Collapsed rows; one open editor;
 * dashed "+ Add …" below. Blank entries are dropped when Done / Add commits.
 * Client forms can open the editor in a sheet (CP-7).
 */
export function ListEntryInput({
  id,
  mode,
  values,
  onChange,
  config,
  disabled,
  error,
  presentation = "inline",
}: {
  id: string
  mode: Mode
  values: string[]
  onChange: (next: string[]) => void
  config: FormListConfig | null | undefined
  disabled?: boolean
  error?: boolean
  presentation?: ListEntryPresentation
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<PersonListEntry | HistoryListEntry>({})
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const entryRefs = useRef<Map<number, HTMLDivElement | null>>(new Map())
  const addButtonRef = useRef<HTMLButtonElement | null>(null)
  const scrollTargetRef = useRef<HTMLDivElement | null>(null)
  const isMdUp = useMinWidthMd()
  const useSheet = presentation === "sheet"

  const addLabel =
    config?.addButtonLabel?.trim() ||
    (mode === "person" ? "+ Add a person" : "+ Add another")
  const addButtonText =
    values.length > 0 ? addAnotherListButtonLabel(addLabel) : addLabel
  const personFields: PersonListFieldKey[] =
    mode === "person"
      ? (config?.fields ?? [...PERSON_LIST_FIELD_KEYS]).filter((key) =>
          (PERSON_LIST_FIELD_KEYS as readonly string[]).includes(key)
        )
      : []
  const combineAgePassedAway =
    personFields.includes("age") && personFields.includes("passedAway")

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    }
  }, [])

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

  function discardOpen() {
    setOpenIndex(null)
    setDraft({})
  }

  function afterCommitScrollAndHighlight(index: number) {
    if (!useSheet) return
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    setHighlightIndex(index)
    requestAnimationFrame(() => {
      const entryEl = entryRefs.current.get(index)
      const target = scrollTargetRef.current ?? entryEl ?? addButtonRef.current
      target?.scrollIntoView({ block: "center", behavior: "smooth" })
    })
    highlightTimerRef.current = setTimeout(() => {
      setHighlightIndex(null)
      highlightTimerRef.current = null
    }, 2000)
  }

  function commitOpen() {
    if (openIndex == null) return
    const next = [...values]
    let committedIndex: number | null = null
    if (mode === "person") {
      const entry = draft as PersonListEntry
      if (isPersonEntryBlank(entry)) {
        if (openIndex < next.length) next.splice(openIndex, 1)
      } else {
        const serialized = serializePersonListEntry(entry)
        if (openIndex < next.length) {
          next[openIndex] = serialized
          committedIndex = openIndex
        } else {
          next.push(serialized)
          committedIndex = next.length - 1
        }
      }
    } else {
      const entry = draft as HistoryListEntry
      if (isHistoryEntryBlank(entry)) {
        if (openIndex < next.length) next.splice(openIndex, 1)
      } else {
        const serialized = serializeHistoryListEntry(entry)
        if (openIndex < next.length) {
          next[openIndex] = serialized
          committedIndex = openIndex
        } else {
          next.push(serialized)
          committedIndex = next.length - 1
        }
      }
    }
    onChange(next)
    setOpenIndex(null)
    setDraft({})
    if (committedIndex != null) afterCommitScrollAndHighlight(committedIndex)
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
    if (openIndex != null && !useSheet) commitOpen()
    setDraft({})
    setOpenIndex(values.length)
  }

  function collapsedLine(raw: string, index: number) {
    const highlighted = highlightIndex === index
    if (mode === "person") {
      const entry = parsePersonListEntry(raw, config)
      if (!entry) return null
      const { name, details } = formatPersonListEntryLine(entry, config, "client")
      return (
        <div
          key={`${id}-row-${index}`}
          ref={(el) => {
            entryRefs.current.set(index, el)
          }}
          className={cn(
            "flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors",
            error && "border-destructive",
            highlighted && statusColours.done.soft
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
        ref={(el) => {
          entryRefs.current.set(index, el)
        }}
        className={cn(
          "flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors",
          error && "border-destructive",
          highlighted && statusColours.done.soft
        )}
      >
        <p className="min-w-0 flex-1 text-sm text-foreground">
          {formatHistoryListEntryLine(entry)}
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

  function renderAgePassedAwayRow(person: PersonListEntry, passedAway: boolean) {
    return (
      <div key="age-passedAway" className="space-y-1.5">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">
              {passedAway ? "Age when they passed away" : listFieldLabel(config, "age")}
            </p>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              value={person.age ?? ""}
              disabled={disabled}
              className="min-h-11 max-w-32"
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
          <label
            htmlFor={`${id}-passed-away`}
            className="flex min-h-11 cursor-pointer items-center gap-2 py-2"
          >
            <input
              id={`${id}-passed-away`}
              type="checkbox"
              checked={passedAway}
              disabled={disabled}
              onChange={() => setDraft(setPersonPassedAway(person, !passedAway))}
              className="size-4 shrink-0 rounded border border-muted-foreground"
            />
            <span className="text-sm font-medium">
              {listFieldLabel(config, "passedAway")}
            </span>
          </label>
        </div>
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
            if (combineAgePassedAway) return null
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
                  className="size-4 shrink-0 rounded border border-muted-foreground"
                />
                <span className="text-sm font-medium">
                  {listFieldLabel(config, "passedAway")}
                </span>
              </label>
            )
          }
          if (field === "age") {
            if (combineAgePassedAway) {
              return renderAgePassedAwayRow(person, passedAway)
            }
            return (
              <div key={field} className="space-y-1.5">
                <p className="text-sm font-medium">
                  {passedAway
                    ? "Age when they passed away"
                    : listFieldLabel(config, "age")}
                </p>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={120}
                  value={person.age ?? ""}
                  disabled={disabled}
                  className="min-h-11 max-w-32"
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
          if (field === "deathYear") {
            if (!passedAway) return null
            return (
              <div key={field} className="space-y-1.5">
                <p className="text-sm font-medium">
                  {listFieldLabel(config, "deathYear")}
                </p>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1900}
                  max={currentCalendarYear()}
                  value={person.deathYear ?? ""}
                  disabled={disabled}
                  className="min-h-11 max-w-32"
                  onChange={(event) => {
                    const raw = event.target.value
                    if (raw === "") {
                      const next = { ...person }
                      delete next.deathYear
                      setDraft(next)
                      return
                    }
                    const n = Number(raw)
                    if (!Number.isInteger(n)) return
                    setDraft({ ...person, deathYear: n })
                  }}
                />
                <p className="text-xs text-muted-foreground">A rough guess is fine.</p>
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
                <p className="text-sm font-medium">
                  {listFieldLabel(config, "relationship")}
                </p>
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
                  inputMode="numeric"
                  min={1000}
                  max={9999}
                  value={current ?? ""}
                  disabled={disabled}
                  className="min-h-11 max-w-32"
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

  const isEditingExisting = openIndex != null && openIndex < values.length
  const sheetOpen = useSheet && openIndex != null
  const sheetTitle = listEntrySheetTitle(addLabel, isEditingExisting)
  const personNumber = openIndex == null ? 0 : Math.min(openIndex, values.length) + 1

  function editorBody() {
    return mode === "person" ? renderPersonFields() : renderHistoryFields()
  }

  function sheetFooter() {
    return (
      <>
        {isEditingExisting && !disabled ? (
          <Button
            type="button"
            variant="destructive"
            className="min-h-11 sm:mr-auto"
            onClick={removeOpen}
          >
            Remove
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={discardOpen}
        >
          Cancel
        </Button>
        {!disabled ? (
          <Button type="button" className="min-h-11" onClick={commitOpen}>
            Done
          </Button>
        ) : null}
      </>
    )
  }

  return (
    <div className="space-y-2" id={id} ref={scrollTargetRef}>
      {values.map((raw, index) =>
        !useSheet && openIndex === index ? null : collapsedLine(raw, index)
      )}

      {!useSheet && openIndex != null ? (
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
          {editorBody()}
          {!disabled ? (
            <Button type="button" className="min-h-11 w-full" onClick={commitOpen}>
              Done
            </Button>
          ) : null}
        </div>
      ) : null}

      {!disabled && (useSheet || openIndex == null) ? (
        <button
          type="button"
          ref={addButtonRef}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-dashed px-3 text-sm"
          onClick={startAdd}
        >
          {addButtonText}
        </button>
      ) : null}

      {useSheet && isMdUp ? (
        <Dialog
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!open) discardOpen()
          }}
        >
          <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
            <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12 text-left">
              <DialogTitle>{sheetTitle}</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{editorBody()}</div>
            <DialogFooter className="shrink-0 flex-row flex-wrap items-center gap-2 border-t px-4 py-3 sm:justify-end">
              {sheetFooter()}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {useSheet && !isMdUp ? (
        <Sheet
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!open) discardOpen()
          }}
        >
          <SheetContent
            side="bottom"
            showCloseButton
            className="flex h-[100dvh] max-h-[100dvh] flex-col gap-0 overflow-hidden rounded-none p-0"
          >
            <SheetHeader className="shrink-0 border-b px-4 py-3 pr-12 text-left">
              <SheetTitle>{sheetTitle}</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{editorBody()}</div>
            <SheetFooter className="shrink-0 flex-row flex-wrap items-center gap-2 border-t">
              {sheetFooter()}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  )
}
