"use client"

import { useState, type MouseEvent, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
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
import {
  clientSuggestionRowClass,
  clientUseButtonClass,
  statusColours,
} from "@/lib/ui/status-colours"
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
  client,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string | null
  client?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {client}
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

/**
 * Tap buttons for short choice lists (≤4 options including Not recorded).
 * Longer lists stay as SelectField dropdowns.
 */
export function ChoiceButtons({
  id,
  label,
  value,
  onChange,
  options,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  hint?: string
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div id={id} role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value || "__empty"}
              type="button"
              className={cn(
                "inline-flex min-h-10 items-center rounded-md border px-3 text-sm",
                selected
                  ? "border-primary bg-primary/10 font-medium text-foreground"
                  : "border-input bg-transparent text-foreground hover:bg-muted"
              )}
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </Field>
  )
}

/** Purple client line under a field label. Use writes through the field's onChange. */
export function ClientAnswer({
  label,
  matches,
  onUse,
}: {
  label: string
  matches: boolean
  onUse?: () => void
}) {
  if (matches || !onUse) {
    return <p className={cn("text-sm", statusColours.client.text)}>Client: {label}</p>
  }
  return (
    <div className={clientSuggestionRowClass}>
      <p className={cn("min-w-0 text-sm", statusColours.client.text)}>Client: {label}</p>
      <button type="button" className={clientUseButtonClass} onClick={onUse}>
        Use
      </button>
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
  client,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
  client?: ReactNode
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint} client={client}>
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
  client,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  client?: ReactNode
}) {
  return (
    <Field label={label} htmlFor={id} client={client}>
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
  client,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
  hint?: string
  error?: string | null
  disabled?: boolean
  client?: ReactNode
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} client={client}>
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
  client,
}: {
  id: string
  label: string
  value: boolean | null
  detail: string
  detailLabel?: string
  onChange: (value: boolean | null) => void
  onDetail: (detail: string) => void
  client?: ReactNode
}) {
  const selected = value === true ? "yes" : value === false ? "no" : ""
  return (
    <div className="space-y-2">
      <SelectField
        id={id}
        label={label}
        value={selected}
        client={client}
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
 * Partial date as Year / Month / Day on one line.
 * Person and client-at-event modes accept an age typed into Year (fills the year;
 * age is never stored). There is no separate Age box.
 */
export function PartialDatePicker({
  id,
  dateLabel,
  value,
  onChange,
  mode,
  ageLabel: _ageLabel,
  clientDateOfBirth = null,
  legacyAge = "",
}: {
  id: string
  dateLabel: string
  value: string
  onChange: (value: string) => void
  mode: "person" | "client-at-event" | "date-only"
  /** @deprecated Separate Age box removed — age is typed into Year. */
  ageLabel?: string
  clientDateOfBirth?: string | null
  /** Shown when a legacy age-only value could not be converted. */
  legacyAge?: string
}) {
  void _ageLabel
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
  const [yearDraft, setYearDraft] = useState<string | null>(null)
  const ageCapable = mode === "person" || mode === "client-at-event"

  function commit(next: PartialDate) {
    setYearDraft(null)
    onChange(formatPartialDate(next))
  }

  function applyYearOrAge(raw: string) {
    const text = raw.trim()
    if (text === "") {
      setYearDraft(null)
      commit({ year: null, month: null, day: null })
      return
    }
    if (/^\d{4}$/.test(text)) {
      const year = Number(text)
      setYearDraft(null)
      commit({ year, month: parsed.month, day: parsed.month == null ? null : parsed.day })
      return
    }
    if (!ageCapable || !isWholeAge(text)) {
      setYearDraft(raw)
      return
    }
    if (ageDisabled) {
      setYearDraft(raw)
      return
    }
    const age = Number(text)
    if (reading && typedAgeMatches(reading, age)) {
      setYearDraft(reading.kind === "ambiguous" ? String(age) : null)
      return
    }
    const year =
      mode === "person"
        ? yearFromTypedAge(age, { kind: "today", asOf })
        : yearFromTypedAge(age, { kind: "since-birth", birthDate: clientDateOfBirth ?? "" })
    if (year == null) {
      setYearDraft(raw)
      return
    }
    setYearDraft(null)
    onChange(year)
  }

  const through = asOfParts.year ?? new Date().getFullYear()
  const years = yearChoices(parsed.year, through)
  const yearShown =
    yearDraft ??
    (parsed.year != null
      ? String(parsed.year)
      : ageCapable && legacyAge.trim()
        ? legacyAge.trim()
        : "")
  const yearHint =
    yearDraft != null && yearDraft.trim() !== "" && !/^\d{4}$/.test(yearDraft.trim()) && !isWholeAge(yearDraft.trim())
      ? "Enter a year or an age between 0 and 130"
      : ageDisabled
        ? "The client's date of birth is needed to enter by age."
        : reading?.kind === "before_birth" && mode === "client-at-event"
          ? "Before client was born"
          : reading && ageCapable
            ? agePrecisionNote(reading)
            : undefined

  return (
    <fieldset className="mx-0 w-full min-w-0 border-0 p-0">
      <legend className="mb-1.5 block w-full p-0 text-sm leading-none font-medium">{dateLabel}</legend>
      <div className="flex min-w-0 gap-2">
        {ageCapable ? (
          <Input
            id={`${id}-year`}
            list={`${id}-year-list`}
            aria-label={`${dateLabel} year or age`}
            className={cn(mobileControlClassName, "h-9 w-0 min-w-0 flex-1 basis-0 px-2.5")}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Year or age"
            value={yearShown}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              const raw = event.target.value
              if (raw === "" || /^\d{0,4}$/.test(raw)) {
                if (raw === "" || /^\d{4}$/.test(raw) || (isWholeAge(raw) && raw.length <= 3)) {
                  applyYearOrAge(raw)
                  return
                }
                setYearDraft(raw)
                return
              }
              setYearDraft(raw)
            }}
            onBlur={() => {
              if (yearDraft != null) applyYearOrAge(yearDraft)
            }}
          />
        ) : (
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
        )}
        {ageCapable ? (
          <datalist id={`${id}-year-list`}>
            {years.map((year) => (
              <option key={year} value={String(year)} />
            ))}
          </datalist>
        ) : null}
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
      {yearHint ? <p className="mt-1 text-xs text-muted-foreground">{yearHint}</p> : null}
    </fieldset>
  )
}

export function AddButton({
  label,
  onClick,
  disabled,
  className,
}: {
  label: string
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      className={cn("min-h-11 self-start", className)}
      onClick={onClick}
    >
      {label}
    </Button>
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
          "inline-flex min-h-11 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
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
