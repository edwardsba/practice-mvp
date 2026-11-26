"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

export type RadioOption = {
  label: string
  value: string
}

/**
 * Shared vertical radio list (client questionnaire style).
 * Full-width bordered rows, round radio + label, selected-row highlight.
 * onOptionActivate fires on every row click, including re-tapping the
 * already-selected option (Radix onValueChange does not).
 */
export function RadioOptionList({
  options,
  value,
  onValueChange,
  onOptionActivate,
  name,
  "aria-labelledby": ariaLabelledBy,
  required,
  disabled,
}: {
  options: RadioOption[]
  value?: string
  onValueChange: (value: string) => void
  /** Called when the practitioner taps any option row (including re-tap). */
  onOptionActivate?: (value: string) => void
  name?: string
  "aria-labelledby"?: string
  required?: boolean
  disabled?: boolean
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={onValueChange}
      name={name}
      aria-labelledby={ariaLabelledBy}
      required={required}
      disabled={disabled}
      className="gap-2"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors",
            value === option.value
              ? "border-primary bg-primary/5"
              : "border-transparent hover:bg-muted/60"
          )}
          onClick={() => {
            if (disabled) return
            onOptionActivate?.(option.value)
          }}
        >
          <RadioGroupItem value={option.value} className="mt-0.5" />
          <span className="text-sm leading-snug">{option.label}</span>
        </label>
      ))}
    </RadioGroup>
  )
}
