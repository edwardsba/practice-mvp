"use client"

import type { ComponentProps, ReactNode } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { StartPrecision } from "@/lib/client-background/types"
import { cn } from "@/lib/utils"

/** 16px below the lg breakpoint so mobile browsers do not zoom on focus. */
export const mobileControlClassName = "text-base lg:text-sm"

export const selectClassName =
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 lg:text-sm dark:bg-input/30"

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
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
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
  hint?: string
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <select id={id} className={selectClassName} value={value} onChange={(event) => onChange(event.target.value)}>
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

export function DateInput({ className, type = "date", ...props }: ComponentProps<typeof Input>) {
  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)] overflow-hidden">
      <Input
        type={type}
        className={cn(
          mobileControlClassName,
          "box-border block w-full max-w-full min-w-0 overflow-hidden [min-inline-size:0]",
          "[&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left",
          "[&::-webkit-datetime-edit]:block [&::-webkit-datetime-edit]:min-w-0 [&::-webkit-datetime-edit]:overflow-hidden [&::-webkit-datetime-edit]:p-0",
          className
        )}
        {...props}
      />
    </div>
  )
}

export function PartialDateField({
  id,
  label,
  precision,
  value,
  onChange,
  allowAge = true,
}: {
  id: string
  label: string
  precision: StartPrecision | ""
  value: string
  allowAge?: boolean
  onChange: (precision: StartPrecision | "", value: string) => void
}) {
  return (
    <div className="min-w-0 space-y-2">
      <SelectField
        id={`${id}_precision`}
        label={label}
        value={precision}
        onChange={(next) => onChange(next as StartPrecision | "", "")}
      >
        <option value="">Not recorded</option>
        <option value="year">Year</option>
        <option value="year_month">Month and year</option>
        <option value="date">Full date</option>
        {allowAge ? <option value="age">Age only</option> : null}
      </SelectField>
      {precision === "year" ? (
        <Input
          id={id}
          className={mobileControlClassName}
          inputMode="numeric"
          placeholder="YYYY"
          value={value}
          onChange={(event) => onChange(precision, event.target.value)}
        />
      ) : null}
      {precision === "year_month" ? (
        <DateInput id={id} type="month" value={value} onChange={(event) => onChange(precision, event.target.value)} />
      ) : null}
      {precision === "date" ? (
        <DateInput id={id} type="date" value={value} onChange={(event) => onChange(precision, event.target.value)} />
      ) : null}
      {precision === "age" ? (
        <Input
          id={id}
          className={mobileControlClassName}
          inputMode="numeric"
          placeholder="Age"
          value={value}
          onChange={(event) => onChange(precision, event.target.value)}
        />
      ) : null}
    </div>
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
