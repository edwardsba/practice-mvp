"use client"

import { useState, type ReactNode } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { agePrecisionNote, assessAge, typedAgeMatches, yearFromTypedAge } from "@/lib/client-background/age"
import {
  MONTH_LABELS,
  formatPartialDate,
  parsePartialDate,
  type PartialDate,
} from "@/lib/client-background/partial-date"
import { todayDateString } from "@/lib/dates/practice-time"
import { cn } from "@/lib/utils"

/** 16px below the lg breakpoint so mobile browsers do not zoom on focus. */
export const mobileControlClassName = "text-base lg:text-sm"

export const selectClassName =
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 lg:text-sm dark:bg-input/30"

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input
        id={id}
        className={mobileControlClassName}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Textarea
        id={id}
        className={mobileControlClassName}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  children,
  hint,
  error,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
  hint?: string
  error?: string | null
  disabled?: boolean
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <select
        id={id}
        className={cn(selectClassName, "disabled:cursor-not-allowed disabled:opacity-50")}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </Field>
  )
}

export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const text = value.trim()
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{text || "Not recorded"}</p>
    </div>
  )
}

export function YesNoDetail({
  id,
  label,
  value,
  detail,
  detailLabel = "Detail",
  onChange,
  onDetail,
}: {
  id: string
  label: string
  value: boolean | null
  detail: string
  detailLabel?: string
  onChange: (value: boolean | null) => void
  onDetail: (detail: string) => void
}) {
  const selected = value === true ? "yes" : value === false ? "no" : ""
  return (
    <div className="space-y-2">
      <SelectField
        id={id}
        label={label}
        value={selected}
        onChange={(next) => onChange(next === "yes" ? true : next === "no" ? false : null)}
      >
        <option value="">Not recorded</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </SelectField>
      {value === true ? (
        <TextAreaField id={`${id}_detail`} label={detailLabel} value={detail} onChange={onDetail} />
      ) : null}
    </div>
  )
}

function yearChoices(selected: number | null, through: number): number[] {
  const start = through - 130
  const years: number[] = []
  for (let year = through; year >= start; year -= 1) years.push(year)
  if (selected != null && !years.includes(selected)) years.push(selected)
  return years.sort((a, b) => b - a)
}

function isWholeAge(text: string): boolean {
  return /^\d{1,3}$/.test(text) && Number(text) <= 130
}

/**
 * Partial date as three native selects. Person and client-at-event modes add
 * an age that fills the year and is never stored. Date-only mode is the selects.
 */
export function PartialDatePicker({
  id,
  dateLabel,
  value,
  onChange,
  mode,
  ageLabel,
  clientDateOfBirth = null,
  legacyAge = "",
}: {
  id: string
  dateLabel: string
  value: string
  onChange: (value: string) => void
  mode: "person" | "client-at-event" | "date-only"
  /** Names the age that fills this date. History passes start and end separately. */
  ageLabel?: string
  clientDateOfBirth?: string | null
  /** Shown in the disabled age input when a legacy age-only value could not be converted. */
  legacyAge?: string
}) {
  const asOf = todayDateString()
  const parsed = parsePartialDate(value)
  const asOfParts = parsePartialDate(asOf)
  const birthParts = parsePartialDate(clientDateOfBirth ?? "")
  const reading =
    mode === "person"
      ? assessAge(parsed, asOfParts, "person")
      : mode === "client-at-event"
        ? assessAge(parsed, birthParts, "client-at-event")
        : null
  const ageDisabled = mode === "client-at-event" && birthParts.year == null
  const [ageDraft, setAgeDraft] = useState<string | null>(null)
  const derivedNumber =
    reading && (reading.kind === "exact" || reading.kind === "approximate") ? String(reading.years) : ""
  const ageShown = ageDraft ?? (ageDisabled && legacyAge.trim() ? legacyAge.trim() : derivedNumber)
  const ageInvalid = ageDraft != null && ageDraft.trim() !== "" && !isWholeAge(ageDraft.trim())

  function commit(next: PartialDate) {
    setAgeDraft(null)
    onChange(formatPartialDate(next))
  }

  function onAgeInput(raw: string) {
    const text = raw.trim()
    if (text === "") {
      setAgeDraft(null)
      onChange("")
      return
    }
    if (!isWholeAge(text)) {
      setAgeDraft(raw)
      return
    }
    const age = Number(text)
    if (reading && typedAgeMatches(reading, age)) {
      setAgeDraft(reading.kind === "ambiguous" ? String(age) : null)
      return
    }
    const year =
      mode === "person"
        ? yearFromTypedAge(age, { kind: "today", asOf })
        : yearFromTypedAge(age, { kind: "since-birth", birthDate: clientDateOfBirth ?? "" })
    if (year == null) {
      setAgeDraft(raw)
      return
    }
    setAgeDraft(null)
    onChange(year)
  }

  const through = asOfParts.year ?? new Date().getFullYear()
  const years = yearChoices(parsed.year, through)
  const resolvedAgeLabel = ageLabel ?? (mode === "person" ? "Age" : "Client age at the time")
  const ageHint = ageInvalid
    ? "Enter an age between 0 and 130"
    : ageDisabled
      ? "The client's date of birth is needed to enter by age."
      : reading?.kind === "before_birth"
        ? mode === "client-at-event"
          ? "Before client was born"
          : undefined
        : reading
          ? agePrecisionNote(reading)
          : undefined

  const ageField =
    mode === "date-only" ? null : (
      <Field label={resolvedAgeLabel} htmlFor={`${id}-age`} hint={ageHint || undefined}>
        <Input
          id={`${id}-age`}
          className={mobileControlClassName}
          inputMode="numeric"
          autoComplete="off"
          disabled={ageDisabled}
          value={ageShown}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => onAgeInput(event.target.value)}
        />
      </Field>
    )

  const dateField = (
    <fieldset className="mx-0 w-full min-w-0 border-0 p-0">
      <legend className="mb-1.5 block w-full p-0 text-sm leading-none font-medium">{dateLabel}</legend>
      <div className="flex min-w-0 gap-2">
          <select
            id={`${id}-year`}
            aria-label={`${dateLabel} year`}
            className={cn(
              selectClassName,
              "w-0 min-w-0 flex-1 basis-0",
              parsed.year == null ? "text-muted-foreground" : "text-foreground"
            )}
            value={parsed.year == null ? "" : String(parsed.year)}
            onChange={(event) => {
              const year = event.target.value === "" ? null : Number(event.target.value)
              if (year == null) {
                commit({ year: null, month: null, day: null })
                return
              }
              commit({ year, month: parsed.month, day: parsed.month == null ? null : parsed.day })
            }}
          >
            <option value="" className="text-foreground">
              Year
            </option>
            {years.map((year) => (
              <option key={year} value={year} className="text-foreground">
                {year}
              </option>
            ))}
          </select>
          <select
            id={`${id}-month`}
            aria-label={`${dateLabel} month`}
            className={cn(
              selectClassName,
              "w-0 min-w-0 flex-1 basis-0",
              parsed.month == null ? "text-muted-foreground" : "text-foreground"
            )}
            disabled={parsed.year == null}
            value={parsed.month == null ? "" : String(parsed.month)}
            onChange={(event) => {
              if (parsed.year == null) return
              const month = event.target.value === "" ? null : Number(event.target.value)
              commit({ year: parsed.year, month, day: month == null ? null : parsed.day })
            }}
          >
            <option value="" className="text-foreground">
              Month
            </option>
            {MONTH_LABELS.map((label, index) => (
              <option key={label} value={index + 1} className="text-foreground">
                {label}
              </option>
            ))}
          </select>
          <select
            id={`${id}-day`}
            aria-label={`${dateLabel} day`}
            className={cn(
              selectClassName,
              "w-0 min-w-0 flex-1 basis-0",
              parsed.day == null ? "text-muted-foreground" : "text-foreground"
            )}
            disabled={parsed.year == null || parsed.month == null}
            value={parsed.day == null ? "" : String(parsed.day)}
            onChange={(event) => {
              if (parsed.year == null || parsed.month == null) return
              const day = event.target.value === "" ? null : Number(event.target.value)
              commit({ year: parsed.year, month: parsed.month, day })
            }}
          >
            <option value="" className="text-foreground">
              Day
            </option>
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day} className="text-foreground">
                {String(day).padStart(2, "0")}
              </option>
            ))}
          </select>
      </div>
    </fieldset>
  )

  return (
    <>
      {mode === "person" ? ageField : null}
      {dateField}
      {mode === "client-at-event" ? ageField : null}
    </>
  )
}

export function SaveRow({
  pending,
  error,
  onSave,
  extra,
}: {
  pending: boolean
  error: string | null
  onSave: () => void
  extra?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      <button
        type="button"
        className={cn(
          "inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
        )}
        disabled={pending}
        onClick={onSave}
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {extra}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
