"use client"

import type { ReactNode } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { SELECT_CLASS_NAME } from "@/lib/intake-interview/constants"
import { cn } from "@/lib/utils"

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function NativeSelect({
  id,
  value,
  onChange,
  children,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
  className?: string
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(SELECT_CLASS_NAME, className)}
    >
      {children}
    </select>
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
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
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
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-20"
      />
    </Field>
  )
}

export function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isNaN(parsed) ? null : parsed
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  hint,
  placeholder = "Leave blank if not applicable",
}: {
  id: string
  label: string
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  hint?: string
  placeholder?: string
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input
        id={id}
        type="number"
        min={min}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => onChange(parseOptionalInt(event.target.value))}
      />
    </Field>
  )
}

export function YesNoField({
  name,
  label,
  value,
  onChange,
  yesLabel = "Yes",
  noLabel = "No",
}: {
  name: string
  label: string
  value: boolean | null
  onChange: (value: boolean) => void
  yesLabel?: string
  noLabel?: string
}) {
  const selected = value == null ? "" : value ? "yes" : "no"
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <RadioGroup
        name={name}
        value={selected}
        onValueChange={(next) => onChange(next === "yes")}
        className="flex gap-4"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="yes" id={`${name}_yes`} />
          <Label htmlFor={`${name}_yes`} className="cursor-pointer font-normal">
            {yesLabel}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="no" id={`${name}_no`} />
          <Label htmlFor={`${name}_no`} className="cursor-pointer font-normal">
            {noLabel}
          </Label>
        </div>
      </RadioGroup>
    </div>
  )
}

export function SummarySentence({ text }: { text: string }) {
  return (
    <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{text}</p>
  )
}
